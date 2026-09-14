import { describe, expect, it } from 'vitest';
import { clockTicksFor, HARDNESS, roundLimitFor } from './hardness';
import { LEVELS } from './levels';
import { LevelRun } from '../sim/LevelRun';
import { ARROW_RADIUS } from '../sim/Collision';
import { activeWalls } from '../sim/Simulation';
import type { Vec2 } from '../sim/types';
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
function walkTo(run: LevelRun, target: Vec2, down: boolean): boolean {
  for (let guard = 0; guard < 3000; guard++) {
    if (run.won) return false;
    const dx = target.x - run.liveFrame.x;
    const dy = target.y - run.liveFrame.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) return false;
    const scale = Math.min(1, SPEED / dist);
    if (run.tick({ dx: dx * scale, dy: dy * scale, down }).roundOver) return true;
  }
  throw new Error(`stuck short of ${target.x},${target.y} — something is blocking the way`);
}

/** Walk a path of maze cells. Returns true if the round's clock ran out on the way. */
function walk(run: LevelRun, cells: string[], down = false): boolean {
  for (const ref of cells) {
    const [c, r] = ref.split(',').map(Number);
    if (walkTo(run, cellCenter(c, r), down)) return true;
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
