import { describe, expect, it } from 'vitest';
import { ARROW_RADIUS, MAX_SPEED_PER_TICK, moveWithCollision } from './Collision';
import { HARDNESS } from '../content/hardness';
import { LEVELS } from '../content/levels';
import { activeWalls } from './Simulation';

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

// What the per-tick limit is really protecting: a door opens on where everyone
// stood LAST tick, so an arrow that could cross a door in one tick could hold its
// own button and be through — and Relay would stop needing four rounds.
describe('the per-tick limit keeps a held door out of one arrow’s reach', () => {
  it('cannot carry an arrow from Relay’s button to the far side of its door in one tick', () => {
    const room = LEVELS.find((l) => l.id === 'relay')!.build(HARDNESS.easy.corridorWidth);
    const button = room.buttons.find((b) => b.id === 'btn1')!.zone;
    const door = room.doors.find((d) => d.id === 'door1')!.rect;

    // Standing on the very edge of the button, door held open, asking for far
    // more speed than the tick allows.
    const from = { x: button.x + button.w, y: button.y + button.h / 2 };
    const pos = moveWithCollision(from, MAX_SPEED_PER_TICK * 10, 0, activeWalls(room, new Set(['door1'])));

    expect(pos.x).toBeLessThan(door.x + door.w + ARROW_RADIUS);
  });
});
