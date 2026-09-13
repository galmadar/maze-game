// Best times, unlocked levels, and the mute flag — the only bits that persist.
import type { Hardness } from './content/hardness';

const BEST_PREFIX = 'maze-run:best:';
const UNLOCKED_KEY = 'maze-run:unlocked';
const MUTED_KEY = 'maze-run:muted';

export function bestTimeKey(levelId: string, hardness: Hardness): string {
  return `${BEST_PREFIX}${levelId}:${hardness}`;
}

export function getBestTime(levelId: string, hardness: Hardness): number | null {
  const raw = localStorage.getItem(bestTimeKey(levelId, hardness));
  return raw === null ? null : Number(raw);
}

export function saveBestTime(levelId: string, hardness: Hardness, seconds: number): number {
  const prev = getBestTime(levelId, hardness);
  const best = prev === null ? seconds : Math.min(prev, seconds);
  localStorage.setItem(bestTimeKey(levelId, hardness), String(best));
  return best;
}

export function getUnlockedCount(): number {
  const raw = localStorage.getItem(UNLOCKED_KEY);
  return raw === null ? 1 : Number(raw);
}

export function unlockUpTo(count: number): void {
  const current = getUnlockedCount();
  if (count > current) localStorage.setItem(UNLOCKED_KEY, String(count));
}

export function getMuted(): boolean {
  return localStorage.getItem(MUTED_KEY) === '1';
}

export function setMuted(muted: boolean): void {
  localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
}
