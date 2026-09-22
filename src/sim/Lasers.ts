// A laser beam blinks on its own fixed rhythm, counted from tick 0 of the round.
// It remembers nothing and reads no one: whether it is lit is a pure function of
// the tick, so play and the victory replay can never disagree about it.
import type { LaserDef, RoomDef } from '../content/types';
import { ARROW_RADIUS } from './Collision';
import type { Rect, Vec2 } from './types';

export function laserLit(laser: LaserDef, tick: number): boolean {
  const period = laser.onTicks + laser.offTicks;
  if (period <= 0) return false;
  const t = (((tick + (laser.phase ?? 0)) % period) + period) % period;
  return t < laser.onTicks;
}

export function litLasers(room: RoomDef, tick: number): Set<string> {
  const lit = new Set<string>();
  for (const l of room.lasers ?? []) if (laserLit(l, tick)) lit.add(l.id);
  return lit;
}

/** Does the path from `a` to `b` pass within the arrow's radius of `r`? Liang-Barsky clip. */
function segmentTouchesRect(a: Vec2, b: Vec2, r: Rect): boolean {
  const minX = r.x - ARROW_RADIUS;
  const maxX = r.x + r.w + ARROW_RADIUS;
  const minY = r.y - ARROW_RADIUS;
  const maxY = r.y + r.h + ARROW_RADIUS;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, a.x - minX],
    [dx, maxX - a.x],
    [-dy, a.y - minY],
    [dy, maxY - a.y],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
  }
  return true;
}

/** Swept, so a fast arrow can't skip over a thin beam between two ticks. */
export function hitsLitLaser(room: RoomDef, tick: number, from: Vec2, to: Vec2): boolean {
  return (room.lasers ?? []).some((l) => laserLit(l, tick) && segmentTouchesRect(from, to, l.rect));
}
