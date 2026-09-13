import type { Rect, Vec2 } from './types';

export const ARROW_RADIUS = 10;
// Caps how far the arrow can move in one tick — without this, a single fast
// mouse-move tick could cross a "held open for one tick" door, breaking the
// round-count puzzles (see levels.ts comment on Relay's minRounds).
export const MAX_SPEED_PER_TICK = 22;

function clampVector(dx: number, dy: number, max: number): Vec2 {
  const len = Math.hypot(dx, dy);
  if (len <= max || len === 0) return { x: dx, y: dy };
  const s = max / len;
  return { x: dx * s, y: dy * s };
}

function expand(r: Rect, radius: number): Rect {
  return { x: r.x - radius, y: r.y - radius, w: r.w + radius * 2, h: r.h + radius * 2 };
}

interface Hit {
  t: number;
  nx: number;
  ny: number;
}

/** Slab-method swept point-vs-rect test. Returns the earliest entry, or null if it never enters. */
function sweepRect(p0: Vec2, p1: Vec2, rect: Rect): Hit | null {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;

  let tEnterX = -Infinity;
  let tExitX = Infinity;
  let nx = 0;
  if (dx !== 0) {
    const tx1 = (rect.x - p0.x) / dx;
    const tx2 = (rect.x + rect.w - p0.x) / dx;
    tEnterX = Math.min(tx1, tx2);
    tExitX = Math.max(tx1, tx2);
    nx = tx1 < tx2 ? -1 : 1;
  } else if (p0.x <= rect.x || p0.x >= rect.x + rect.w) {
    return null;
  }

  let tEnterY = -Infinity;
  let tExitY = Infinity;
  let ny = 0;
  if (dy !== 0) {
    const ty1 = (rect.y - p0.y) / dy;
    const ty2 = (rect.y + rect.h - p0.y) / dy;
    tEnterY = Math.min(ty1, ty2);
    tExitY = Math.max(ty1, ty2);
    ny = ty1 < ty2 ? -1 : 1;
  } else if (p0.y <= rect.y || p0.y >= rect.y + rect.h) {
    return null;
  }

  const tEnter = Math.max(tEnterX, tEnterY);
  const tExit = Math.min(tExitX, tExitY);
  if (tEnter > tExit || tEnter > 1 || tEnter < 0) return null;

  // Whichever axis entered last is the one that blocked — that's the normal.
  if (tEnterX > tEnterY) return { t: tEnter, nx, ny: 0 };
  return { t: tEnter, nx: 0, ny };
}

/**
 * Move a point by (dx,dy), sliding along any wall it hits, never tunnelling
 * through it — collision is swept against the full segment of travel, not
 * just the start/end positions, so a fast move can't skip past a thin wall.
 */
export function moveWithCollision(from: Vec2, dx: number, dy: number, walls: Rect[]): Vec2 {
  let pos: Vec2 = { ...from };
  let remaining = clampVector(dx, dy, MAX_SPEED_PER_TICK);
  const expanded = walls.map((w) => expand(w, ARROW_RADIUS));

  for (let iter = 0; iter < 4; iter++) {
    if (remaining.x === 0 && remaining.y === 0) break;
    const target = { x: pos.x + remaining.x, y: pos.y + remaining.y };

    let closest: Hit | null = null;
    for (const rect of expanded) {
      const hit = sweepRect(pos, target, rect);
      if (hit && (!closest || hit.t < closest.t)) closest = hit;
    }

    if (!closest) {
      pos = target;
      break;
    }

    pos = { x: pos.x + remaining.x * closest.t, y: pos.y + remaining.y * closest.t };
    const leftoverT = 1 - closest.t;
    remaining = {
      x: closest.nx !== 0 ? 0 : remaining.x * leftoverT,
      y: closest.ny !== 0 ? 0 : remaining.y * leftoverT,
    };
  }

  return pos;
}
