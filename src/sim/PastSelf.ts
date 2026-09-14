import type { Frame } from './types';

/**
 * THE SWITCH: what a past self does once its recording runs out. Rounds get
 * longer, so an early self always has fewer frames than the round it replays into.
 *
 * Today it FREEZES — stands on its last recorded frame keeping whatever it was
 * doing, so a self that ended holding a button goes on holding it and works as a
 * doorstop. To make it VANISH, return null here and skip nulls in Simulation.ts.
 * To make it LOOP, use `recording[tickIndex % recording.length]`.
 */
export function pastSelfFrameAt(recording: Frame[], tickIndex: number, spawnFrame: Frame): Frame {
  // Before its first tick — and for a round that recorded nothing — it is still at spawn.
  if (tickIndex < 0 || recording.length === 0) return spawnFrame;
  return recording[Math.min(tickIndex, recording.length - 1)];
}
