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
// Levels 4-8: real maze rooms, and the weight plate.
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
  'hold-and-stand': {
    setup: [
      { path: ['0,1', '1,1'], hold: true }, // round 1 holds the door open for good
      { path: ['1,0', '2,0', '3,0', '4,0'] },
      { path: ['1,0', '2,0', '3,0', '4,0'] },
    ],
    win: ['1,0', '2,0', '3,0', '4,0', '4,1', '4,2', '4,3', '5,3'],
  },
  'three-of-you': {
    setup: [
      { path: ['1,1', '2,1', '2,2'] },
      { path: ['1,1', '2,1', '2,2'] },
      { path: ['1,1', '2,1', '2,2'] },
    ],
    win: ['1,1', '2,1', '3,1', '4,1', '5,1', '6,1'],
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

describe('Levels 4-8 — every one beatable in the rounds it claims', () => {
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

describe('Levels 4-8 — one round short is not enough', () => {
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
// One small room each for the newer things: a switch that stays flipped, a door
// on a timer, a key you carry to a lock. Enough to prove each one is playable —
// not the levels that will teach them.
// ---------------------------------------------------------------------------

/** One click: press, then let go. */
function clickOnce(run: LevelRun, beforeTick?: () => void): void {
  for (const down of [true, false]) {
    beforeTick?.();
    run.tick({ dx: 0, dy: 0, down });
  }
}

/** Stand still until the room does something. */
function waitFor(run: LevelRun, ready: () => boolean, beforeTick?: () => void): void {
  for (let guard = 0; guard < 3000; guard++) {
    if (ready()) return;
    beforeTick?.();
    if (run.tick({ dx: 0, dy: 0, down: false }).roundOver) return;
  }
  throw new Error('waited for something that never happened');
}

/** The long way round to the timer pad, and the long way round to the door it opens. */
const TO_THE_PAD = ['1,0', '2,0', '3,0', '4,0', '5,0', '6,0', '6,1', '5,1', '4,1', '3,1', '2,1', '1,1'];
const TO_THE_DOOR = ['0,1', '0,2', '1,2', '2,2', '3,2', '4,2', '5,2', '6,2', '6,3', '5,3', '4,3'];

/** Play one of the three to its win, keeping the room play showed on every tick of the last round. */
function playNewLevel(id: string, hardness: (typeof HARDNESS)[keyof typeof HARDNESS]): PlayedRun {
  const def = level(id);
  const run = new LevelRun(
    def.build(hardness.corridorWidth),
    clockTicksFor(hardness),
    roundLimitFor(def.minRounds, hardness),
  );
  const statesByTick: RoomState[] = [];
  const rec = (): void => {
    statesByTick.push(run.roomState);
  };

  if (id === 'flip-it') {
    // Down the pocket, flip the switch, and walk back out through the door it left open.
    walk(run, ['1,0', '1,1', '2,1'], false, rec);
    clickOnce(run, rec);
    walk(run, ['1,1', '1,0', '2,0'], false, rec);
  } else if (id === 'in-a-hurry') {
    // Round 1 goes the long way to the pad and clicks it at the end of its walk.
    walk(run, TO_THE_PAD);
    clickOnce(run);
    run.endRound();
    // Round 2 is already standing at the door when that click happens again.
    walk(run, TO_THE_DOOR, false, rec);
    waitFor(run, () => run.roomState.openDoors.has('door'), rec);
    walk(run, ['3,3'], false, rec);
  } else {
    // Take the key, carry it to the lock, walk out.
    walk(run, ['0,1'], false, rec);
    clickOnce(run, rec);
    walk(run, ['0,0', '1,0', '2,0', '2,1'], false, rec);
    walk(run, ['2,0', '3,0'], false, rec);
  }
  return { run, statesByTick };
}

describe('Flip it, In a hurry, Carry it — the three newer things, played', () => {
  for (const id of ['flip-it', 'in-a-hurry', 'carry-it']) {
    const def = level(id);

    for (const hardness of Object.values(HARDNESS)) {
      it(`${hardness.id}: ${id} is won in round ${def.minRounds}`, () => {
        const { run } = playNewLevel(id, hardness);
        expect(run.won).toBe(true);
        expect(run.round).toBe(def.minRounds);
        expect(run.round).toBeLessThanOrEqual(roundLimitFor(def.minRounds, hardness));
      });
    }

    it(`${id}: the victory replay shows the same room on every tick it did in play`, () => {
      const { run, statesByTick } = playNewLevel(id, HARDNESS.medium);
      expect(run.won).toBe(true);

      const replay = replayOf(run);
      expect(replay.winTick).toBe(run.currentRecording.length - 1);
      expectReplayMatches(replay, statesByTick);

      // And the thing really did change state during the round, or the agreement
      // above is the agreement of two rooms where nothing happened.
      const shots = statesByTick.map((s) => JSON.stringify(roomStateAsLists(s)));
      expect(new Set(shots).size).toBeGreaterThan(1);
      expect(new Set(statesByTick.map((s) => [...s.openDoors].join())).size).toBe(2);
    });
  }

  it('flip-it: a second self flipping the same switch shuts the door again', () => {
    const hardness = HARDNESS.medium;
    const def = level('flip-it');
    const run = new LevelRun(def.build(hardness.corridorWidth), clockTicksFor(hardness), 6);

    // Two rounds that each go and flip it. Two clicks, back where it started.
    for (let i = 0; i < 2; i++) {
      walk(run, ['1,0', '1,1', '2,1']);
      clickOnce(run);
      run.endRound();
    }
    expect(run.round).toBe(3);

    walk(run, ['1,0', '1,1', '2,1']); // far enough in for both past clicks to have happened
    expect(run.roomState.switchesOn.has('flip')).toBe(false);
    walk(run, ['1,1', '1,0', '2,0']);
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
    clickOnce(run);
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

  it('carry-it: without the key the lock stays shut and the way out is closed', () => {
    const hardness = HARDNESS.medium;
    const def = level('carry-it');
    const run = new LevelRun(def.build(hardness.corridorWidth), clockTicksFor(hardness), 3);

    walk(run, ['1,0', '2,0', '2,1']); // stand on the lock yourself — an arrow is not a key
    expect(run.roomState.locksOpen.has('lock')).toBe(false);
    walk(run, ['2,0', '3,0']);
    expect(run.won).toBe(false);
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
