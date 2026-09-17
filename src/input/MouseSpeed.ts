import type { Vec2 } from '../sim/types';

// How far the arrow may travel ACROSS THE SCREEN in one tick. The room is scaled
// to fit the window, so a cap in room units costs a big room far more screen
// speed than a small one — that is what made the maze levels crawl.
// 40px a tick is 2400px a second, past any real mouse move; it is also low
// enough that 40 / scale stays inside the sim's own MAX_SPEED_PER_TICK for every
// room here — the biggest sits at scale ~0.55 in a small window, so 73 units.
export const MAX_SCREEN_SPEED_PER_TICK = 40;

/**
 * One tick of mouse movement, screen pixels in, room units out — capped on the
 * screen side, so the cap costs the same hand speed in every room.
 */
export function roomMovePerTick(screenDx: number, screenDy: number, scale: number): Vec2 {
  const len = Math.hypot(screenDx, screenDy);
  const keep = len > MAX_SCREEN_SPEED_PER_TICK ? MAX_SCREEN_SPEED_PER_TICK / len : 1;
  return { x: (screenDx * keep) / scale, y: (screenDy * keep) / scale };
}
