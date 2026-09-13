import { describe, expect, it } from 'vitest';
import { ARROW_RADIUS, moveWithCollision } from './Collision';

describe('moveWithCollision', () => {
  it('stops at a wall instead of passing through it', () => {
    const wall = { x: 100, y: 0, w: 10, h: 200 };
    const pos = moveWithCollision({ x: 50, y: 50 }, 200, 0, [wall]);
    expect(pos.x).toBeLessThan(wall.x - ARROW_RADIUS + 0.01);
  });

  it('never tunnels through a thin wall even with a huge single-tick move', () => {
    // A wall thinner than the per-tick clamp would allow crossing without sweeping.
    const wall = { x: 100, y: 0, w: 2, h: 200 };
    const pos = moveWithCollision({ x: 50, y: 50 }, 5000, 0, [wall]);
    expect(pos.x).toBeLessThan(wall.x - ARROW_RADIUS + 0.01);
  });

  it('moves freely when nothing is in the way', () => {
    const pos = moveWithCollision({ x: 0, y: 0 }, 5, 5, []);
    expect(pos).toEqual({ x: 5, y: 5 });
  });
});
