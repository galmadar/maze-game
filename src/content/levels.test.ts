import { describe, expect, it } from 'vitest';
import { clockTicksFor, HARDNESS, roundLimitFor } from './hardness';
import { LEVELS } from './levels';
import { LevelRun } from '../sim/LevelRun';

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
