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

// ---- the things in the room ----
// Same idea as the hardness table: the numbers that decide how a thing feels
// live here, not buried in the rules that read them.

/**
 * How long a timer door stays open after a click. Long enough to be worth
 * running for, short enough that one arrow usually can't click it and be
 * through it — which is what makes it a relay between two of your selves.
 */
export const TIMER_OPEN_SECONDS = 3;
export const TIMER_OPEN_TICKS = Math.round(TIMER_OPEN_SECONDS * TICKS_PER_SECOND);

/** How near an arrow has to be to a key to pick it up — a little wider than the arrow. */
export const KEY_REACH = 30;

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
