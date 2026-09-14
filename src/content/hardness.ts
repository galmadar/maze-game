export type Hardness = 'easy' | 'medium' | 'hard';

export interface HardnessConfig {
  id: Hardness;
  label: string;
  /** Each round's clock is this many seconds longer than the round before it. */
  clockStepSeconds: number;
  spareRounds: number;
  corridorWidth: number;
}

// Every number from DESIGN.md's hardness table, in one place.
// Medium is the rule as asked for: round 1 = 5s, round 2 = 10s, round 3 = 15s.
// Easy grows faster and hard slower, keeping roughly the old 30/20/14 spread.
export const HARDNESS: Record<Hardness, HardnessConfig> = {
  easy: { id: 'easy', label: 'Easy', clockStepSeconds: 8, spareRounds: 3, corridorWidth: 140 },
  medium: { id: 'medium', label: 'Medium', clockStepSeconds: 5, spareRounds: 1, corridorWidth: 100 },
  hard: { id: 'hard', label: 'Hard', clockStepSeconds: 3, spareRounds: 0, corridorWidth: 70 },
};

export const TICKS_PER_SECOND = 60;

/** Round N's clock: N × the step. Round 1's clock is therefore one step. */
export function clockSecondsFor(hardness: HardnessConfig, round = 1): number {
  return round * hardness.clockStepSeconds;
}

/**
 * Ticks on round N's clock. Called with no round it gives round 1 — which is
 * also the per-round step LevelRun is built with.
 */
export function clockTicksFor(hardness: HardnessConfig, round = 1): number {
  return Math.round(clockSecondsFor(hardness, round) * TICKS_PER_SECOND);
}

export function roundLimitFor(minRounds: number, hardness: HardnessConfig): number {
  return minRounds + hardness.spareRounds;
}
