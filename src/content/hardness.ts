export type Hardness = 'easy' | 'medium' | 'hard';

export interface HardnessConfig {
  id: Hardness;
  label: string;
  clockSeconds: number;
  spareRounds: number;
  corridorWidth: number;
}

// Every number from DESIGN.md's hardness table, in one place.
export const HARDNESS: Record<Hardness, HardnessConfig> = {
  easy: { id: 'easy', label: 'Easy', clockSeconds: 30, spareRounds: 3, corridorWidth: 140 },
  medium: { id: 'medium', label: 'Medium', clockSeconds: 20, spareRounds: 1, corridorWidth: 100 },
  hard: { id: 'hard', label: 'Hard', clockSeconds: 14, spareRounds: 0, corridorWidth: 70 },
};

export const TICKS_PER_SECOND = 60;

export function clockTicksFor(hardness: HardnessConfig): number {
  return Math.round(hardness.clockSeconds * TICKS_PER_SECOND);
}

export function roundLimitFor(minRounds: number, hardness: HardnessConfig): number {
  return minRounds + hardness.spareRounds;
}
