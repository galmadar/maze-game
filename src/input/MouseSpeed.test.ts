import { describe, expect, it } from 'vitest';
import { MAX_SCREEN_SPEED_PER_TICK, roomMovePerTick } from './MouseSpeed';
import { ARROW_RADIUS, MAX_SPEED_PER_TICK, moveWithCollision } from '../sim/Collision';
import { HARDNESS } from '../content/hardness';
import { LEVELS } from '../content/levels';

// Room units per screen pixel, as Renderer.layout works them out: a corridor room
// (900x300) is scaled up to fit the window, a maze room (in-a-hurry, 1540x880) down.
const SMALL_ROOM_SCALE = 1.54;
const BIG_ROOM_SCALE = 0.66;
// The smallest scale the sim guard is sized for — in-a-hurry in a 1280x700 window
// sits at 0.55, so anything the game draws today has more room than this.
const SMALLEST_SCALE = 0.5;

function thinnestWallInTheGame(): number {
  let thinnest = Infinity;
  for (const hardness of Object.values(HARDNESS)) {
    for (const level of LEVELS) {
      for (const wall of level.build(hardness.corridorWidth).walls) {
        thinnest = Math.min(thinnest, wall.w, wall.h);
      }
    }
  }
  return thinnest;
}

describe('roomMovePerTick', () => {
  it('moves the arrow the same distance across the screen in a small room and a big one', () => {
    const small = roomMovePerTick(18, 24, SMALL_ROOM_SCALE); // 30px of mouse
    const big = roomMovePerTick(18, 24, BIG_ROOM_SCALE);

    // Room units differ — the big room is drawn smaller, so the same pixels are
    // more of it — but what the player sees move is the same 30px either way.
    expect(Math.hypot(big.x, big.y)).toBeGreaterThan(Math.hypot(small.x, small.y));
    expect(Math.hypot(small.x * SMALL_ROOM_SCALE, small.y * SMALL_ROOM_SCALE)).toBeCloseTo(30, 6);
    expect(Math.hypot(big.x * BIG_ROOM_SCALE, big.y * BIG_ROOM_SCALE)).toBeCloseTo(30, 6);
  });

  it('caps a flick at the same screen distance in a small room and a big one', () => {
    const small = roomMovePerTick(900, 1200, SMALL_ROOM_SCALE); // 1500px, far past the cap
    const big = roomMovePerTick(900, 1200, BIG_ROOM_SCALE);

    expect(Math.hypot(small.x * SMALL_ROOM_SCALE, small.y * SMALL_ROOM_SCALE)).toBeCloseTo(
      MAX_SCREEN_SPEED_PER_TICK,
      6,
    );
    expect(Math.hypot(big.x * BIG_ROOM_SCALE, big.y * BIG_ROOM_SCALE)).toBeCloseTo(
      MAX_SCREEN_SPEED_PER_TICK,
      6,
    );
  });

  it('never asks the sim for more than its own guard allows', () => {
    const fastest = roomMovePerTick(MAX_SCREEN_SPEED_PER_TICK, 0, SMALLEST_SCALE);
    expect(Math.hypot(fastest.x, fastest.y)).toBeLessThanOrEqual(MAX_SPEED_PER_TICK);
  });
});

describe('the sim guard, at the fastest the input layer can now produce', () => {
  it('still stops the arrow crossing the thinnest wall in the game', () => {
    const thickness = thinnestWallInTheGame();
    const wall = { x: 200, y: 0, w: thickness, h: 400 };
    // Touching the wall already — nothing of the tick is spent getting there.
    const from = { x: wall.x - ARROW_RADIUS - 0.5, y: 200 };
    const fastest = roomMovePerTick(MAX_SCREEN_SPEED_PER_TICK, 0, SMALLEST_SCALE);

    const pos = moveWithCollision(from, fastest.x, fastest.y, [wall]);
    expect(pos.x).toBeLessThan(wall.x - ARROW_RADIUS + 0.01);
  });
});
