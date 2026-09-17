import { describe, expect, it } from 'vitest';
import { clockTicksFor, HARDNESS, roundLimitFor } from './hardness';
import { LEVELS } from './levels';
import { LevelRun } from '../sim/LevelRun';
import { ARROW_RADIUS } from '../sim/Collision';
import { activeWalls, type RoomState } from '../sim/Simulation';
import type { Vec2 } from '../sim/types';
import { VictoryReplay } from '../sim/VictoryReplay';
import { cellCenter } from './rooms';
import type { RoomDef } from './types';

const SPEED = 22; // matches sim's MAX_SPEED_PER_TICK

/** Move straight right by `distance`, landing exactly on target — never overshoots a zone. */
function moveRight(run: LevelRun, distance: number, down: boolean) {
  const steps = Math.max(1, Math.ceil(distance / SPEED));
  const step = distance / steps;
  let last = { won: false, ranOutOfRounds: false, roundOver: false };
  for (let i = 0; i < steps && !run.won; i++) last = run.tick({ dx: step, dy: 0, down });
  return last;
}

function holdUntilRoundEnds(run: LevelRun, down: boolean) {
  let last = { won: false, ranOutOfRounds: false, roundOver: false };
  while (!last.roundOver && !run.won) last = run.tick({ dx: 0, dy: 0, down });
  return last;
}

function level(id: string) {
  const def = LEVELS.find((l) => l.id === id);
  if (!def) throw new Error(`missing level ${id}`);
  return def;
}

describe('Hold the door — level solvable with scripted rounds', () => {
  const hardness = HARDNESS.medium;
  const def = level('hold-the-door');
  const clockTicks = clockTicksFor(hardness);
  const roundLimit = roundLimitFor(def.minRounds, hardness);

  it('cannot be won in round 1 alone — the closed door blocks a straight rush', () => {
    const run = new LevelRun(def.build(hardness.corridorWidth), clockTicks, roundLimit);
    moveRight(run, 820, false); // spawn(40) toward exit(~860), door1 at x=480 is closed
    expect(run.won).toBe(false);
  });

  it('is won in round 2, within the medium round limit', () => {
    const run = new LevelRun(def.build(hardness.corridorWidth), clockTicks, roundLimit);
    expect(roundLimit).toBeGreaterThanOrEqual(2);

    // Round 1: walk to the button (center x=290) and hold it for the rest of the round.
    moveRight(run, 250, false);
    holdUntilRoundEnds(run, true);
    expect(run.round).toBe(2);

    // Round 2: past self holds the door open; walk straight through to the exit.
    moveRight(run, 820, false);
    expect(run.won).toBe(true);
    expect(run.round).toBeLessThanOrEqual(roundLimit);
  });
});

// The clock now grows with the round, so round 1 is the shortest it will ever be.
// These prove the real levels are still winnable on every hardness, and that the
// past selves go on holding their doors once their short recordings run out.
describe('every hardness — levels still winnable under the growing clock', () => {
  for (const hardness of Object.values(HARDNESS)) {
    it(`${hardness.id}: Hold the door is won in round 2`, () => {
      const def = level('hold-the-door');
      const run = new LevelRun(
        def.build(hardness.corridorWidth),
        clockTicksFor(hardness),
        roundLimitFor(def.minRounds, hardness),
      );

      moveRight(run, 250, false);
      holdUntilRoundEnds(run, true);
      expect(run.round).toBe(2);

      moveRight(run, 820, false);
      expect(run.won).toBe(true);
    });

    it(`${hardness.id}: Relay is won in round 4, inside the round limit`, () => {
      const def = level('relay');
      const roundLimit = roundLimitFor(def.minRounds, hardness);
      const run = new LevelRun(def.build(hardness.corridorWidth), clockTicksFor(hardness), roundLimit);

      for (const distance of [130, 330, 530]) {
        moveRight(run, distance, false);
        holdUntilRoundEnds(run, true);
      }
      expect(run.round).toBe(4);

      moveRight(run, 820, false);
      expect(run.won).toBe(true);
      expect(run.round).toBeLessThanOrEqual(roundLimit);
    });
  }
});

describe('Relay — level solvable with scripted rounds', () => {
  const hardness = HARDNESS.medium;
  const def = level('relay');
  const clockTicks = clockTicksFor(hardness);
  const roundLimit = roundLimitFor(def.minRounds, hardness);

  it('is not won in rounds 1-3 — each round only sets up the next hold', () => {
    const run = new LevelRun(def.build(hardness.corridorWidth), clockTicks, roundLimit);

    moveRight(run, 130, false); // to button1 (center x=170)
    holdUntilRoundEnds(run, true);
    expect(run.won).toBe(false);
    expect(run.round).toBe(2);

    moveRight(run, 330, false); // to button2 (center x=370), through door1
    holdUntilRoundEnds(run, true);
    expect(run.won).toBe(false);
    expect(run.round).toBe(3);

    moveRight(run, 530, false); // to button3 (center x=570), through door1+door2
    holdUntilRoundEnds(run, true);
    expect(run.won).toBe(false);
    expect(run.round).toBe(4);
  });

  it('is won in round 4, within the medium round limit', () => {
    const run = new LevelRun(def.build(hardness.corridorWidth), clockTicks, roundLimit);
    expect(roundLimit).toBeGreaterThanOrEqual(4);

    moveRight(run, 130, false);
    holdUntilRoundEnds(run, true);

    moveRight(run, 330, false);
    holdUntilRoundEnds(run, true);

    moveRight(run, 530, false);
    holdUntilRoundEnds(run, true);

    // Round 4: door1/door2/door3 all held open by the three past selves — walk to the exit.
    moveRight(run, 820, false);
    expect(run.won).toBe(true);
    expect(run.round).toBeLessThanOrEqual(roundLimit);
  });
});

// ---------------------------------------------------------------------------
// The plate levels: real maze rooms, and the weight plate.
// ---------------------------------------------------------------------------

/** Walk to a point in a straight line, never overshooting it. */
function walkTo(run: LevelRun, target: Vec2, down: boolean, beforeTick?: () => void): boolean {
  for (let guard = 0; guard < 3000; guard++) {
    if (run.won) return false;
    const dx = target.x - run.liveFrame.x;
    const dy = target.y - run.liveFrame.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) return false;
    const scale = Math.min(1, SPEED / dist);
    beforeTick?.();
    if (run.tick({ dx: dx * scale, dy: dy * scale, down }).roundOver) return true;
  }
  throw new Error(`stuck short of ${target.x},${target.y} — something is blocking the way`);
}

/** Walk a path of maze cells. Returns true if the round's clock ran out on the way. */
function walk(run: LevelRun, cells: string[], down = false, beforeTick?: () => void): boolean {
  for (const ref of cells) {
    const [c, r] = ref.split(',').map(Number);
    if (walkTo(run, cellCenter(c, r), down, beforeTick)) return true;
  }
  return false;
}

interface SetupRound {
  /** Cells to walk through; the arrow stays on the last one until the clock runs out. */
  path: string[];
  /** Hold the mouse button once there — for a hold button, not for a plate. */
  hold?: boolean;
}
interface Plan {
  setup: SetupRound[];
  win: string[];
}

const PLANS: Record<string, Plan> = {
  heavy: {
    // Two rounds go and stand on the plate; the third strolls out.
    setup: [{ path: ['1,1', '1,0', '2,0'] }, { path: ['1,1', '1,0', '2,0'] }],
    win: ['1,1', '2,1', '3,1', '4,1', '5,1'],
  },
  'dead-ends': {
    setup: [
      { path: ['0,1', '1,1', '1,2'] },
      { path: ['0,1', '1,1', '1,2'] },
      { path: ['1,0', '2,0', '3,0', '4,0', '5,0', '5,1'] },
      { path: ['1,0', '2,0', '3,0', '4,0', '5,0', '5,1'] },
    ],
    win: ['1,0', '2,0', '3,0', '4,0', '5,0', '5,1', '5,2', '5,3', '6,3'],
  },
  'the-crowd': {
    setup: [
      { path: ['0,2', '0,3', '1,3'] },
      { path: ['0,2', '0,3', '1,3'] },
      { path: ['1,1', '2,1', '3,1', '4,1', '4,0', '5,0'] },
      { path: ['1,1', '2,1', '3,1', '4,1', '4,0', '5,0'] },
      { path: ['1,1', '2,1', '3,1', '4,1', '4,0', '5,0'] },
    ],
    win: ['1,1', '2,1', '3,1', '4,1', '4,2', '5,2', '5,3', '6,3', '7,3'],
  },
};

describe('The plate levels — every one beatable in the rounds it claims', () => {
  for (const [id, plan] of Object.entries(PLANS)) {
    const def = level(id);

    it(`${id} claims ${def.minRounds} rounds, and the plan uses exactly that many`, () => {
      expect(plan.setup.length + 1).toBe(def.minRounds);
    });

    for (const hardness of Object.values(HARDNESS)) {
      it(`${hardness.id}: ${id} is won in round ${def.minRounds}`, () => {
        const roundLimit = roundLimitFor(def.minRounds, hardness);
        const run = new LevelRun(def.build(hardness.corridorWidth), clockTicksFor(hardness), roundLimit);

        plan.setup.forEach((round, i) => {
          const down = round.hold ?? false;
          // The clock must not run out on the way there — if it does, the
          // round is too short for what the level asks of it.
          expect(walk(run, round.path, down)).toBe(false);
          holdUntilRoundEnds(run, down);
          expect(run.won).toBe(false);
          expect(run.round).toBe(i + 2);
        });

        walk(run, plan.win);
        expect(run.won).toBe(true);
        expect(run.round).toBe(def.minRounds);
        expect(run.round).toBeLessThanOrEqual(roundLimit);
      });
    }
  }
});

describe('The plate levels — one round short is not enough', () => {
  // The honest half of minRounds: play every setup round but the last, then try
  // to walk out anyway. The last door should still be shut.
  const hardness = HARDNESS.medium;

  for (const [id, plan] of Object.entries(PLANS)) {
    const def = level(id);

    it(`${id} cannot be won in round ${def.minRounds - 1}`, () => {
      const run = new LevelRun(
        def.build(hardness.corridorWidth),
        clockTicksFor(hardness),
        roundLimitFor(def.minRounds, hardness),
      );

      for (const round of plan.setup.slice(0, -1)) {
        const down = round.hold ?? false;
        walk(run, round.path, down);
        holdUntilRoundEnds(run, down);
      }
      expect(run.round).toBe(def.minRounds - 1);

      walk(run, plan.win);
      expect(run.won).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// The victory replay: the whole winning run played again, every round at once.
// ---------------------------------------------------------------------------

/** Everything the room is doing — the things that remember included, because those are the fragile ones. */
function roomStateAsLists(state: RoomState): Record<string, unknown> {
  return {
    heldButtons: [...state.heldButtons].sort(),
    satisfiedPlates: [...state.satisfiedPlates].sort(),
    switchesOn: [...state.switchesOn].sort(),
    timersLeft: [...state.timersLeft].sort(),
    keys: state.keys.map((k) => [k.id, k.x, k.y, k.carrier]),
    locksOpen: [...state.locksOpen].sort(),
    openDoors: [...state.openDoors].sort(),
  };
}

interface PlayedRun {
  run: LevelRun;
  /** Indexed by the winning round's tick: the room `LevelRun` read before that tick ran. */
  statesByTick: RoomState[];
}

/**
 * Play a plan to its win. `endSetupsEarly` is the player pressing space the
 * moment a self is in place, which leaves short recordings behind; otherwise
 * every setup round sits out its whole clock.
 */
function playPlan(def: (typeof LEVELS)[number], plan: Plan, endSetupsEarly: boolean): PlayedRun {
  const hardness = HARDNESS.medium;
  const room = def.build(hardness.corridorWidth);
  const run = new LevelRun(room, clockTicksFor(hardness), roundLimitFor(def.minRounds, hardness));

  for (const round of plan.setup) {
    const down = round.hold ?? false;
    walk(run, round.path, down);
    if (endSetupsEarly) run.endRound();
    else holdUntilRoundEnds(run, down);
  }

  const statesByTick: RoomState[] = [];
  walk(run, plan.win, false, () => statesByTick.push(run.roomState));
  return { run, statesByTick };
}

function replayOf(run: LevelRun): VictoryReplay {
  // The winning round never became a replay — the level ended before it rolled over.
  return new VictoryReplay(run.room, [...run.replays, run.currentRecording]);
}

/** Walk the replay through the winning round, checking it against what play showed. */
function expectReplayMatches(replay: VictoryReplay, statesByTick: RoomState[]): void {
  for (let t = 0; t < statesByTick.length; t++) {
    expect(replay.tickIndex).toBe(t);
    expect(roomStateAsLists(replay.roomState)).toEqual(roomStateAsLists(statesByTick[t]));
    expect(replay.won).toBe(t === replay.winTick);
    replay.advance();
  }
  expect(replay.tickIndex).toBe(replay.winTick);
  expect(replay.won).toBe(true);
}

describe('the victory replay plays back the run that really happened', () => {
  for (const [id, plan] of Object.entries(PLANS)) {
    const def = level(id);

    it(`${id}: every recording from tick 0 opens the same doors and wins on the same tick`, () => {
      const { run, statesByTick } = playPlan(def, plan, false);
      expect(run.won).toBe(true);

      const replay = replayOf(run);
      expect(replay.recordings).toHaveLength(def.minRounds);
      expect(replay.winTick).toBe(run.currentRecording.length - 1);
      expectReplayMatches(replay, statesByTick);

      // A door really did open during the run — otherwise the agreement above
      // would be the agreement of two empty sets.
      expect(new Set(statesByTick.flatMap((s) => [...s.openDoors])).size).toBeGreaterThan(0);
    });

    it(`${id}: selves whose rounds were cut short freeze, and the replay is still won`, () => {
      const { run, statesByTick } = playPlan(def, plan, true);
      expect(run.won).toBe(true);

      const replay = replayOf(run);
      const setups = replay.recordings.slice(0, -1);

      setups.forEach((recording, i) => {
        // Cut short, so every one of them runs out well before the winning round does.
        expect(recording.length).toBeLessThan(replay.winTick + 1);
        const frozen = recording[recording.length - 1];
        for (let t = recording.length; t <= replay.winTick; t++) {
          expect(replay.framesAt(t)[i]).toEqual(frozen);
        }
      });

      // And frozen is not the same as gone: the doors they hold stay held, tick
      // for tick, exactly as play showed them.
      expectReplayMatches(replay, statesByTick);
    });
  }
});

describe('Heavy — a real player dawdles, and the plate must still be held down', () => {
  // Round 1 on medium is only 5 seconds, so by the time a real player walks out
  // in round 3 both earlier selves have long run out of recording. They stay
  // standing on the plate, which is the only reason the door is still open.
  it('is won in round 3 even after both past selves have run out of recording', () => {
    const hardness = HARDNESS.medium;
    const def = level('heavy');
    const plan = PLANS.heavy;
    const run = new LevelRun(
      def.build(hardness.corridorWidth),
      clockTicksFor(hardness),
      roundLimitFor(def.minRounds, hardness),
    );

    for (const round of plan.setup) {
      walk(run, round.path);
      holdUntilRoundEnds(run, false);
    }
    expect(run.replays.map((r) => r.length)).toEqual([300, 600]); // 5s then 10s

    // Stand about until both recordings are over, then stroll out.
    for (let i = 0; i < 650; i++) run.tick({ dx: 0, dy: 0, down: false });
    expect(run.tickIndex).toBeGreaterThan(Math.max(...run.replays.map((r) => r.length)));
    expect(run.roomState.satisfiedPlates.has('plate')).toBe(true);

    walk(run, plan.win);
    expect(run.won).toBe(true);
    expect(run.round).toBe(3);
  });
});

/** Flood the room from the spawn. Can any arrow reach the way out? */
function exitReachable(room: RoomDef, openDoors: Set<string>): boolean {
  const walls = activeWalls(room, openDoors);
  const STEP = 10;
  const cols = Math.floor(room.width / STEP);
  const rows = Math.floor(room.height / STEP);
  const free = (x: number, y: number): boolean =>
    !walls.some(
      (w) =>
        x > w.x - ARROW_RADIUS &&
        x < w.x + w.w + ARROW_RADIUS &&
        y > w.y - ARROW_RADIUS &&
        y < w.y + w.h + ARROW_RADIUS,
    );

  const seen = new Set<number>();
  const start = [Math.round(room.spawn.x / STEP), Math.round(room.spawn.y / STEP)] as const;
  const queue: [number, number][] = [[start[0], start[1]]];
  seen.add(start[0] * 10000 + start[1]);

  while (queue.length > 0) {
    const [i, j] = queue.pop()!;
    const x = i * STEP;
    const y = j * STEP;
    if (x >= room.exit.x && x <= room.exit.x + room.exit.w && y >= room.exit.y && y <= room.exit.y + room.exit.h) {
      return true;
    }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni > cols || nj > rows) continue;
      const key = ni * 10000 + nj;
      if (seen.has(key) || !free(ni * STEP, nj * STEP)) continue;
      seen.add(key);
      queue.push([ni, nj]);
    }
  }
  return false;
}

describe('every level with a door — the way out really is behind it', () => {
  for (const def of LEVELS.filter((l) => l.build(HARDNESS.medium.corridorWidth).doors.length > 0)) {
    for (const hardness of Object.values(HARDNESS)) {
      it(`${hardness.id}: ${def.id} cannot be walked in one round with the doors shut`, () => {
        const room = def.build(hardness.corridorWidth);
        expect(exitReachable(room, new Set())).toBe(false);
        // And the same flood, with the doors open, does get there — otherwise
        // the check above would pass on a level that is simply impossible.
        expect(exitReachable(room, new Set(room.doors.map((d) => d.id)))).toBe(true);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// The levels that teach the switch, the timer and the key — and then cross them
// with each other and with the plate.
//
// Every one of them is played here by a SCRIPT: a list of setup rounds, then
// the round that wins. A round is a list of steps, because these levels need
// more than a path — a click on a switch, a press that stays pressed, a wait
// at a door until a past self's click opens it.
//
// Three things are checked for every script, on every hardness: the level is
// won in exactly the rounds it claims; no setup round runs out of clock on the
// way; and one round short of the claim it cannot be won at all.
// ---------------------------------------------------------------------------

type Step =
  /** Walk through these cells, in order. */
  | { go: string[] }
  /** Press and let go, n times — a switch, a timer pad, a key picked up or put down. */
  | { click: number }
  /** Press and keep it pressed for the rest of the round — a hold button. */
  | { press: true }
  /** Stand still until that door is open. */
  | { untilOpen: string }
  /** Stand still for this many ticks. */
  | { wait: number };

interface Script {
  setup: Step[][];
  win: Step[];
  /**
   * For the timer levels: one self trying to do the whole job alone, at full
   * speed, in round 1. Played on easy, where the clock is never what stops it —
   * so if this fails to win, the distance from the pad to its door is the
   * reason, which is exactly the claim `minRounds` makes.
   */
  solo?: Step[];
}

/**
 * Walk toward a point. Unlike `walkTo` above this gives up instead of throwing
 * when a shut door is in the way — the "one round short" test needs to try a
 * route that does not work and be told so.
 */
function walkToward(run: LevelRun, target: Vec2, down: boolean, onTick?: () => void): 'there' | 'stuck' {
  let closest = Infinity;
  let stale = 0;
  for (let guard = 0; guard < 4000; guard++) {
    const dx = target.x - run.liveFrame.x;
    const dy = target.y - run.liveFrame.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) return 'there';
    if (dist < closest - 0.5) {
      closest = dist;
      stale = 0;
    } else if (++stale > 120) {
      return 'stuck'; // a door that never opened
    }
    const scale = Math.min(1, SPEED / dist);
    onTick?.();
    run.tick({ dx: dx * scale, dy: dy * scale, down });
    if (run.won || run.tickIndex === 0) return 'stuck'; // won, or the round rolled over
  }
  return 'stuck';
}

/**
 * Play one round's steps. Returns false if the round could not be played out —
 * the clock ran out, or a door the script waited on never opened.
 */
function playSteps(run: LevelRun, steps: Step[], onTick?: () => void): boolean {
  let down = false;
  const tick = (isDown: boolean): boolean => {
    onTick?.();
    run.tick({ dx: 0, dy: 0, down: isDown });
    return !run.won && run.tickIndex > 0;
  };

  for (const step of steps) {
    if ('go' in step) {
      for (const ref of step.go) {
        const [c, r] = ref.split(',').map(Number);
        if (walkToward(run, cellCenter(c, r), down, onTick) === 'stuck') return false;
      }
    } else if ('click' in step) {
      for (let i = 0; i < step.click; i++) {
        if (!tick(true) || !tick(false)) return false;
      }
      down = false;
    } else if ('press' in step) {
      if (!tick(true)) return false;
      down = true;
    } else if ('untilOpen' in step) {
      let open = false;
      for (let guard = 0; guard < 2000 && !open; guard++) {
        if (run.roomState.openDoors.has(step.untilOpen)) open = true;
        else if (!tick(down)) return false;
      }
      if (!open) return false;
    } else {
      for (let i = 0; i < step.wait; i++) if (!tick(down)) return false;
    }
  }
  return true;
}

/** The long way round to In a hurry's timer pad, and the long way to its door. */
const TO_THE_PAD = ['1,0', '2,0', '3,0', '4,0', '5,0', '6,0', '6,1', '5,1', '4,1', '3,1', '2,1', '1,1'];
const TO_THE_DOOR = ['0,1', '0,2', '1,2', '2,2', '3,2', '4,2', '5,2', '6,2', '6,3', '5,3', '4,3'];

const SCRIPTS: Record<string, Script> = {
  // Down the pocket, flip the switch, and stroll back out through the door it
  // left open. Nobody is parked anywhere.
  'flip-it': {
    setup: [],
    win: [{ go: ['1,1', '1,0', '2,0'] }, { click: 1 }, { go: ['1,0', '1,1', '2,1', '3,1'] }],
  },

  // Take the key out of its pocket, walk it round to the lock, walk out.
  'carry-it': {
    setup: [],
    win: [
      { go: ['1,1', '1,0'] },
      { click: 1 },
      { go: ['1,1', '2,1', '2,2', '3,2'] },
      { go: ['2,2', '2,1', '3,1', '4,1'] },
    ],
  },

  // Round 1 walks the long arm and clicks the pad. Round 2 is already standing
  // at the door, a whole room away, when that click happens again.
  'in-a-hurry': {
    setup: [[{ go: TO_THE_PAD }, { click: 1 }]],
    win: [{ go: TO_THE_DOOR }, { untilOpen: 'door' }, { go: ['3,3'] }],
  },

  // Round 1 flips the switch, goes through the door it opened, and stays on the
  // button behind it. Round 2 walks the whole way out.
  'two-jobs': {
    setup: [
      [
        { go: ['1,1', '1,0', '2,0'] },
        { click: 1 },
        { go: ['1,0', '1,1', '2,1'] },
        { untilOpen: 'door1' },
        { go: ['3,1', '3,0'] },
        { press: true },
      ],
    ],
    win: [
      { go: ['1,1', '2,1'] },
      { untilOpen: 'door1' },
      { go: ['3,1', '3,2'] },
      { untilOpen: 'door2' },
      { go: ['4,2'] },
    ],
  },

  // Round 1 stands on the button that holds the cage open. Round 2 goes in for
  // the key and takes it the long way round to the lock.
  fetch: {
    setup: [[{ go: ['1,1', '1,2'] }, { press: true }]],
    win: [
      { go: ['1,1', '2,1'] },
      { untilOpen: 'door1' },
      { go: ['3,1', '3,0'] },
      { click: 1 },
      { go: ['3,1', '3,2', '4,2'] },
      { go: ['4,1'] },
      { untilOpen: 'door2' },
      { go: ['4,0'] },
    ],
  },

  // Round 1 walks all the way round to the pad and clicks. Round 2 is waiting at
  // the door: in, key, and out again inside the second and a half.
  'in-and-out': {
    setup: [[{ go: ['0,1', '0,2', '0,3', '1,3', '2,3', '3,3', '4,3', '5,3'] }, { click: 1 }]],
    win: [
      { go: ['1,0', '2,0', '3,0'] },
      { untilOpen: 'door1' },
      { go: ['4,0', '5,0'] },
      { click: 1 },
      { go: ['4,0', '3,0', '2,0', '2,1'] },
      { untilOpen: 'door2' },
      { go: ['2,2'] },
    ],
    // Eleven cells back from the pad to the door, and the light lasts nine.
    solo: [
      { go: ['0,1', '0,2', '0,3', '1,3', '2,3', '3,3', '4,3', '5,3'] },
      { click: 1 },
      { go: ['4,3', '3,3', '2,3', '1,3', '0,3', '0,2', '0,1', '0,0', '1,0', '2,0', '3,0'] },
      { go: ['4,0', '5,0'] },
      { click: 1 },
      { go: ['4,0', '3,0', '2,0', '2,1'] },
      { go: ['2,2'] },
    ],
  },

  // Round 1 carries the key to the lock, then puts it down to press the button —
  // pressing drops it, and by then the key has done its work. Round 2 walks out.
  'let-go': {
    setup: [
      [
        { go: ['0,0'] },
        { click: 1 },
        { go: ['0,1', '1,1', '2,1', '2,2'] },
        { go: ['2,1', '3,1', '3,0'] },
        { press: true },
      ],
    ],
    win: [
      { go: ['1,1', '2,1'] },
      { untilOpen: 'door1' },
      { go: ['3,1', '4,1'] },
      { untilOpen: 'door2' },
      { go: ['5,1'] },
    ],
  },

  // Round 1 takes the long way to the switch so that nobody has to stand on the
  // button, then doubles back and joins the plate. Rounds 2 and 3 walk straight.
  'either-way': {
    setup: [
      [
        { go: ['0,2', '0,3', '1,3'] },
        { click: 1 },
        { go: ['0,3', '0,2', '0,1', '1,1'] },
        { untilOpen: 'door1' },
        { go: ['2,1', '3,1', '3,0'] },
      ],
      [{ go: ['1,1'] }, { untilOpen: 'door1' }, { go: ['2,1', '3,1', '3,0'] }],
    ],
    win: [
      { go: ['1,1'] },
      { untilOpen: 'door1' },
      { go: ['2,1', '3,1', '4,1'] },
      { untilOpen: 'door2' },
      { go: ['5,1'] },
    ],
  },

  // Two rounds stand on the plate. Only then is there a way through to the key.
  'two-to-fetch': {
    setup: [[{ go: ['1,1', '1,2', '2,2'] }], [{ go: ['1,1', '1,2', '2,2'] }]],
    win: [
      { go: ['1,1', '2,1'] },
      { untilOpen: 'door1' },
      { go: ['3,1', '3,2'] },
      { click: 1 },
      { go: ['3,1', '4,1', '4,0'] },
      { untilOpen: 'door2' },
      { go: ['5,0'] },
    ],
  },

  // Round 1 flips the switch on its way past. Round 2 walks over the very same
  // square and does NOT click — that is the level.
  'only-one-of-you': {
    setup: [
      [{ go: ['1,1'] }, { click: 1 }, { go: ['2,1', '2,0'] }],
      [{ go: ['1,1'] }, { untilOpen: 'door1' }, { go: ['2,1', '2,0'] }],
    ],
    win: [
      { go: ['1,1'] },
      { untilOpen: 'door1' },
      { go: ['2,1', '3,1', '4,1'] },
      { untilOpen: 'door2' },
      { go: ['5,1'] },
    ],
  },

  // One click picks the key up and opens the door in the same tick. Round 1 runs
  // the key to the lock and then joins the plate; rounds 2 and 3 follow.
  'two-at-once': {
    setup: [
      [
        { go: ['1,1', '1,0'] },
        { click: 1 },
        { go: ['1,1', '2,1'] },
        { untilOpen: 'door1' },
        { go: ['3,1', '3,0'] },
        { go: ['3,1', '4,1', '4,2'] },
      ],
      [{ go: ['1,1', '2,1'] }, { untilOpen: 'door1' }, { go: ['3,1', '4,1', '4,2'] }],
    ],
    win: [
      { go: ['1,1', '2,1'] },
      { untilOpen: 'door1' },
      { go: ['3,1', '4,1'] },
      { untilOpen: 'door2' },
      { go: ['5,1'] },
      { untilOpen: 'door3' },
      { go: ['5,0'] },
    ],
  },

  // Round 1 walks the long arm and clicks the pad, empty-handed — it has to be,
  // because a hand with a key in it cannot click. Round 2 carries the key
  // through and cannot get back out. Round 3 leaves by the door the lock opened.
  'hands-full': {
    setup: [
      [{ go: ['1,0', '2,0', '3,0', '4,0', '5,0', '6,0', '6,1', '5,1', '4,1', '3,1', '2,1'] }, { click: 1 }],
      [
        { go: ['0,1'] },
        { click: 1 },
        { go: ['0,2', '1,2', '2,2', '3,2'] },
        { untilOpen: 'door1' },
        { go: ['4,2', '5,2', '6,2', '6,3', '5,3', '4,3', '3,3'] },
      ],
    ],
    win: [{ go: ['0,1', '0,2', '0,3', '0,4', '1,4'] }, { untilOpen: 'door2' }, { go: ['2,4'] }],
    // Sixteen cells back from the pad to its door, and a second and a half of light.
    solo: [
      { go: ['1,0', '2,0', '3,0', '4,0', '5,0', '6,0', '6,1', '5,1', '4,1', '3,1', '2,1'] },
      { click: 1 },
      { go: ['3,1', '4,1', '5,1', '6,1', '6,0', '5,0', '4,0', '3,0', '2,0', '1,0', '0,0'] },
      { go: ['0,1', '0,2', '1,2', '2,2', '3,2'] },
      { go: ['4,2'] },
    ],
  },

  // Round 1 clicks the first pad. Round 2 waits at the first door, gets through,
  // and clicks the second pad from inside. Round 3 waits at the second door.
  chain: {
    setup: [
      [{ go: ['0,1', '0,2', '0,3', '1,3', '2,3', '3,3', '4,3'] }, { click: 1 }],
      [
        { go: ['1,0', '2,0'] },
        { untilOpen: 'door1' },
        { go: ['3,0', '4,0', '5,0', '6,0', '6,1'] },
        { click: 1 },
      ],
    ],
    win: [{ go: ['1,0', '1,1', '1,2'] }, { untilOpen: 'door2' }, { go: ['2,2'] }],
    // Nine cells from the first pad back to its door, and one second of light.
    solo: [
      { go: ['0,1', '0,2', '0,3', '1,3', '2,3', '3,3', '4,3'] },
      { click: 1 },
      { go: ['3,3', '2,3', '1,3', '0,3', '0,2', '0,1', '0,0', '1,0', '2,0'] },
      { go: ['3,0'] },
    ],
  },

  // Round 1 does the whole key run: first key to its lock, put it down, second
  // key to its lock, then stand on the plate. Rounds 2 and 3 walk it.
  'two-keys': {
    setup: [
      [
        { go: ['1,0'] },
        { click: 1 },
        { go: ['1,1', '0,1'] },
        { go: ['1,1'] },
        { untilOpen: 'door1' },
        { go: ['2,1'] },
        { click: 1 }, // the first key goes on the floor — a hand holds one
        { go: ['2,0'] },
        { click: 1 },
        { go: ['2,1', '2,2'] },
        { go: ['2,1'] },
        { untilOpen: 'door2' },
        { go: ['3,1', '3,0'] },
      ],
      [
        { untilOpen: 'door1' },
        { go: ['2,1'] },
        { untilOpen: 'door2' },
        { go: ['3,1', '3,0'] },
      ],
    ],
    win: [
      { untilOpen: 'door1' },
      { go: ['2,1'] },
      { untilOpen: 'door2' },
      { go: ['3,1'] },
      { untilOpen: 'door3' },
      { go: ['4,1'] },
    ],
  },
};

/** Play a script to its win, and keep the room play showed on every tick of the last round. */
function playScript(id: string, hardness: (typeof HARDNESS)[keyof typeof HARDNESS], rounds?: number): PlayedRun {
  const def = level(id);
  const script = SCRIPTS[id];
  const run = new LevelRun(
    def.build(hardness.corridorWidth),
    clockTicksFor(hardness),
    roundLimitFor(def.minRounds, hardness),
  );

  const setup = script.setup.slice(0, rounds ?? script.setup.length);
  setup.forEach((steps, i) => {
    expect(playSteps(run, steps)).toBe(true); // the round's clock was long enough for its job
    expect(run.won).toBe(false);
    expect(run.round).toBe(i + 1); // and it did not run out on its own
    run.endRound();
  });

  const statesByTick: RoomState[] = [];
  playSteps(run, script.win, () => statesByTick.push(run.roomState));
  return { run, statesByTick };
}

describe('the switch, timer and key levels — every one beatable in the rounds it claims', () => {
  for (const id of Object.keys(SCRIPTS)) {
    const def = level(id);

    it(`${id} claims ${def.minRounds} rounds, and its script uses exactly that many`, () => {
      expect(SCRIPTS[id].setup.length + 1).toBe(def.minRounds);
    });

    for (const hardness of Object.values(HARDNESS)) {
      it(`${hardness.id}: ${id} is won in round ${def.minRounds}`, () => {
        const { run } = playScript(id, hardness);
        expect(run.won).toBe(true);
        expect(run.round).toBe(def.minRounds);
        expect(run.round).toBeLessThanOrEqual(roundLimitFor(def.minRounds, hardness));
      });
    }
  }
});

describe('the switch, timer and key levels — one round short is not enough', () => {
  const hardness = HARDNESS.medium;

  for (const id of Object.keys(SCRIPTS)) {
    const def = level(id);
    if (def.minRounds < 2) continue; // nothing to be one round short of

    it(`${id} cannot be won in round ${def.minRounds - 1}`, () => {
      const run = new LevelRun(
        def.build(hardness.corridorWidth),
        clockTicksFor(hardness),
        roundLimitFor(def.minRounds, hardness),
      );
      for (const steps of SCRIPTS[id].setup.slice(0, -1)) {
        playSteps(run, steps);
        run.endRound();
      }
      expect(run.round).toBe(def.minRounds - 1);

      playSteps(run, SCRIPTS[id].win);
      expect(run.won).toBe(false);
    });
  }
});

describe('the timer levels — one self can never click the pad and use the door', () => {
  // Played on easy: round 1 is 8 seconds there, far more than the walk takes,
  // so the only thing that can stop it is the door shutting again.
  const hardness = HARDNESS.easy;

  for (const [id, script] of Object.entries(SCRIPTS)) {
    if (!script.solo) continue;
    const def = level(id);

    it(`${id}: the door has shut again by the time the clicker gets there`, () => {
      const run = new LevelRun(
        def.build(hardness.corridorWidth),
        clockTicksFor(hardness),
        roundLimitFor(def.minRounds, hardness),
      );
      // The whole level, attempted alone. It has to get STUCK — not merely fail
      // to win — or this proves nothing about the door.
      expect(playSteps(run, script.solo!)).toBe(false);
      expect(run.round).toBe(1); // the clock never ran out, so it was not the clock
      expect(run.won).toBe(false);
    });
  }
});

describe('the switch, timer and key levels — the victory replay shows what play showed', () => {
  for (const id of Object.keys(SCRIPTS)) {
    it(`${id}: every tick of the winning round reads the same back`, () => {
      const { run, statesByTick } = playScript(id, HARDNESS.medium);
      expect(run.won).toBe(true);

      const replay = replayOf(run);
      expect(replay.recordings).toHaveLength(level(id).minRounds);
      expect(replay.winTick).toBe(run.currentRecording.length - 1);
      expectReplayMatches(replay, statesByTick);

      // And something really did change in the room, or the agreement above is
      // the agreement of two rooms where nothing happened.
      const shots = statesByTick.map((s) => JSON.stringify(roomStateAsLists(s)));
      expect(new Set(shots).size).toBeGreaterThan(1);
    });
  }
});

describe('the switch levels still punish a second click', () => {
  it('flip-it: a second self flipping the same switch shuts the door again', () => {
    const hardness = HARDNESS.medium;
    const def = level('flip-it');
    const run = new LevelRun(def.build(hardness.corridorWidth), clockTicksFor(hardness), 6);

    // Two rounds that each go and flip it. Two clicks, back where it started.
    for (let i = 0; i < 2; i++) {
      walk(run, ['1,1', '1,0', '2,0']);
      run.tick({ dx: 0, dy: 0, down: true });
      run.tick({ dx: 0, dy: 0, down: false });
      run.endRound();
    }
    expect(run.round).toBe(3);

    walk(run, ['1,1', '1,0', '2,0']); // far enough in for both past clicks to have happened
    expect(run.roomState.switchesOn.has('flip')).toBe(false);
    walk(run, ['1,0', '1,1', '2,1']);
    expect(run.won).toBe(false);
  });

  it('carry-it: without the key the lock stays shut and the way out is closed', () => {
    const hardness = HARDNESS.medium;
    const def = level('carry-it');
    const run = new LevelRun(def.build(hardness.corridorWidth), clockTicksFor(hardness), 3);

    walk(run, ['1,1', '2,1', '2,2', '3,2']); // stand on the lock yourself — an arrow is not a key
    expect(run.roomState.locksOpen.has('lock')).toBe(false);
    walk(run, ['2,2', '2,1', '3,1']);
    expect(run.won).toBe(false);
  });

  it('in-a-hurry: one self cannot click the pad and be through the door in time', () => {
    // On easy the round is long enough to walk the whole way, so what stops it
    // is the timer and nothing else.
    const hardness = HARDNESS.easy;
    const def = level('in-a-hurry');
    const run = new LevelRun(
      def.build(hardness.corridorWidth),
      clockTicksFor(hardness),
      roundLimitFor(def.minRounds, hardness),
    );

    walk(run, TO_THE_PAD);
    run.tick({ dx: 0, dy: 0, down: true });
    run.tick({ dx: 0, dy: 0, down: false });
    expect(run.roomState.openDoors.has('door')).toBe(true); // it did open — just not for long enough

    // All the way back and round to the door, as fast as an arrow can go.
    expect(walk(run, [...TO_THE_PAD].reverse().slice(1))).toBe(false);
    expect(walk(run, ['0,0', ...TO_THE_DOOR])).toBe(false);

    // It got there — the round had not run out — and found the door shut again.
    expect(run.liveFrame).toMatchObject(cellCenter(4, 3));
    expect(run.roomState.openDoors.has('door')).toBe(false);
    walk(run, ['3,3']);
    expect(run.won).toBe(false);
  });
});

// These are the rules the new levels are BUILT on. If any of them stopped
// biting, the level above it would still be winnable — just not a puzzle.
describe('the rules the new levels lean on really do bite', () => {
  const hardness = HARDNESS.medium;

  function fresh(id: string, roundLimit = 6): LevelRun {
    const def = level(id);
    return new LevelRun(def.build(hardness.corridorWidth), clockTicksFor(hardness), roundLimit);
  }

  it('only-one-of-you: a second self clicking the switch shuts the door on the third', () => {
    const run = fresh('only-one-of-you');

    // Round 1 flips it and goes on to the plate, the right way round.
    playSteps(run, [{ go: ['1,1'] }, { click: 1 }, { untilOpen: 'door1' }, { go: ['2,1', '2,0'] }]);
    run.endRound();
    // Round 2 cannot resist flipping it too — and shuts itself out.
    playSteps(run, [{ go: ['1,1'] }, { wait: 30 }, { click: 1 }]);
    run.endRound();
    expect(run.round).toBe(3);

    // Two clicks, so by the time both have happened the switch is back off.
    playSteps(run, [{ go: ['1,1'] }, { wait: 60 }]);
    expect(run.roomState.switchesOn.has('flip')).toBe(false);
    expect(run.roomState.openDoors.has('door1')).toBe(false);
    expect(playSteps(run, [{ go: ['2,1', '3,1', '4,1', '5,1'] }])).toBe(false);
    expect(run.won).toBe(false);
  });

  it('two-at-once: one click picks the key up AND flips the switch under it', () => {
    const run = fresh('two-at-once');
    playSteps(run, [{ go: ['1,1', '1,0'] }, { click: 1 }]);

    const state = run.roomState;
    expect(state.switchesOn.has('flip')).toBe(true);
    expect(state.keys[0].carrier).toBe(0); // in the live self's hand
    expect(state.openDoors.has('door1')).toBe(true);
  });

  it('two-keys: a hand holds one key, so clicking by the second one puts the first down', () => {
    const run = fresh('two-keys');
    playSteps(run, [
      { go: ['1,0'] },
      { click: 1 },
      { go: ['1,1', '0,1'] },
      { go: ['1,1'] },
      { untilOpen: 'door1' },
      { go: ['2,1', '2,0'] },
      { click: 1 }, // standing right on top of key2, with key1 still in hand
    ]);

    const keys = Object.fromEntries(run.roomState.keys.map((k) => [k.id, k.carrier]));
    expect(keys).toEqual({ key1: null, key2: null }); // it let go rather than taking both
  });

  it('hands-full: a self carrying the key cannot click the pad without dropping it', () => {
    const run = fresh('hands-full');
    playSteps(run, [
      { go: ['0,1'] },
      { click: 1 },
      { go: ['0,0', '1,0', '2,0', '3,0', '4,0', '5,0', '6,0', '6,1', '5,1', '4,1', '3,1', '2,1'] },
    ]);
    expect(run.roomState.keys[0].carrier).toBe(0);

    playSteps(run, [{ click: 1 }]);
    expect(run.roomState.keys[0].carrier).toBeNull(); // the pad click cost it the key
    expect(run.roomState.timersLeft.get('pad')).toBeGreaterThan(0);
  });

  it('two-keys: the second lock will not take the first key', () => {
    const run = fresh('two-keys');
    playSteps(run, [
      { go: ['1,0'] },
      { click: 1 },
      { go: ['1,1', '0,1'] },
      { go: ['1,1'] },
      { untilOpen: 'door1' },
      { go: ['2,1', '2,2'] }, // key1, carried onto lock2
    ]);
    expect(run.roomState.locksOpen.has('lock1')).toBe(true);
    expect(run.roomState.locksOpen.has('lock2')).toBe(false);
  });
});

describe('every level is covered by a test', () => {
  it('leaves no level without a script or a plan', () => {
    const tutorial = ['hello', 'hold-the-door', 'relay'];
    const covered = new Set([...tutorial, ...Object.keys(PLANS), ...Object.keys(SCRIPTS)]);
    expect(LEVELS.filter((l) => !covered.has(l.id)).map((l) => l.id)).toEqual([]);
  });
});

describe('the first three levels are still the first three levels', () => {
  it('keeps Hello, Hold the door and Relay at the front, unchanged', () => {
    expect(LEVELS.slice(0, 3).map((l) => [l.id, l.minRounds])).toEqual([
      ['hello', 1],
      ['hold-the-door', 2],
      ['relay', 4],
    ]);
    const hello = level('hello').build(HARDNESS.medium.corridorWidth);
    expect(hello.doors).toEqual([]);
    expect(hello.plates).toEqual([]);
  });
});
