import { describe, expect, it } from 'vitest';
import { clockSecondsFor, clockTicksFor, HARDNESS, TICKS_PER_SECOND } from './hardness';

describe('the round clock grows every round', () => {
  it("matches Gal's numbers on medium — round 1: 5s, 2: 10s, 3: 15s", () => {
    expect(clockSecondsFor(HARDNESS.medium, 1)).toBe(5);
    expect(clockSecondsFor(HARDNESS.medium, 2)).toBe(10);
    expect(clockSecondsFor(HARDNESS.medium, 3)).toBe(15);
  });

  for (const hardness of Object.values(HARDNESS)) {
    it(`${hardness.id}: round N gets N × ${hardness.clockStepSeconds}s, +1 step each round`, () => {
      for (let round = 1; round <= 6; round++) {
        expect(clockSecondsFor(hardness, round)).toBe(round * hardness.clockStepSeconds);
        expect(clockTicksFor(hardness, round)).toBe(
          Math.round(round * hardness.clockStepSeconds * TICKS_PER_SECOND),
        );
      }

      for (let round = 2; round <= 6; round++) {
        const grew = clockSecondsFor(hardness, round) - clockSecondsFor(hardness, round - 1);
        expect(grew).toBe(hardness.clockStepSeconds);
      }
    });
  }

  it('called with no round gives round 1, which is also the per-round step', () => {
    for (const hardness of Object.values(HARDNESS)) {
      expect(clockTicksFor(hardness)).toBe(clockTicksFor(hardness, 1));
      expect(clockTicksFor(hardness)).toBe(hardness.clockStepSeconds * TICKS_PER_SECOND);
    }
  });

  it('easy rounds grow fastest and hard rounds slowest', () => {
    expect(HARDNESS.easy.clockStepSeconds).toBeGreaterThan(HARDNESS.medium.clockStepSeconds);
    expect(HARDNESS.medium.clockStepSeconds).toBeGreaterThan(HARDNESS.hard.clockStepSeconds);
  });
});
