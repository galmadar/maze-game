import { describe, expect, it } from 'vitest';
import { ARROW_RADIUS, moveWithCollision } from '../sim/Collision';
import { activeWalls } from '../sim/Simulation';
import { HARDNESS } from './hardness';
import { CELL, cellCenter, mazeRoom, type MazeSpec } from './rooms';

// A little maze with a corner, a branch and two dead ends:
//
//   0,0 — 1,0     2,0 is solid
//          |
//   0,1   1,1 — 2,1
//          |
//         1,2            (dead end)
const SPEC: MazeSpec = {
  cols: 3,
  rows: 3,
  spawn: '0,0',
  exit: '2,1',
  links: ['0,0-1,0', '1,0-1,1', '1,1-2,1', '1,1-1,2'],
};

/** Push the arrow one way until it stops, and report how far it actually got. */
function push(room: ReturnType<typeof mazeRoom>, from: { x: number; y: number }, dx: number, dy: number) {
  let pos = from;
  for (let i = 0; i < 60; i++) pos = moveWithCollision(pos, dx, dy, room.walls);
  return pos;
}

describe('mazeRoom — corners, branches and dead ends', () => {
  it('is as big as its grid of cells', () => {
    const room = mazeRoom(HARDNESS.medium.corridorWidth, SPEC);
    expect(room.width).toBe(3 * CELL);
    expect(room.height).toBe(3 * CELL);
    expect(room.spawn).toEqual(cellCenter(0, 0));
  });

  it('lets the arrow walk a passage, and turn the corner at the far end', () => {
    const room = mazeRoom(HARDNESS.medium.corridorWidth, SPEC);
    const right = push(room, cellCenter(0, 0), 20, 0);
    expect(right.x).toBeGreaterThanOrEqual(cellCenter(1, 0).x);

    const down = push(room, cellCenter(1, 0), 0, 20);
    expect(down.y).toBeGreaterThanOrEqual(cellCenter(1, 1).y);
  });

  it('walls off a pair of cells with no passage between them', () => {
    const room = mazeRoom(HARDNESS.medium.corridorWidth, SPEC);
    // 0,0 and 0,1 are neighbours but not joined — the way down is plugged.
    const down = push(room, cellCenter(0, 0), 0, 20);
    expect(down.y).toBeLessThan(cellCenter(0, 1).y);
  });

  it('fills in a cell that nothing leads to, instead of leaving a sealed pocket', () => {
    const room = mazeRoom(HARDNESS.medium.corridorWidth, SPEC);
    const up = push(room, cellCenter(2, 1), 0, -20);
    expect(up.y).toBeGreaterThan(cellCenter(2, 0).y);
  });

  it('glues a straight stretch of wall into one rectangle, not a row of bricks', () => {
    const room = mazeRoom(HARDNESS.medium.corridorWidth, SPEC);
    // The top border runs the whole width in one piece.
    expect(room.walls.some((w) => w.x === 0 && w.y === 0 && w.w === room.width)).toBe(true);
    // And nothing is drawn twice: no two wall rectangles overlap.
    for (let i = 0; i < room.walls.length; i++) {
      for (let j = i + 1; j < room.walls.length; j++) {
        const a = room.walls[i];
        const b = room.walls[j];
        const apart =
          a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(apart).toBe(true);
      }
    }
  });

  it('keeps the arrow inside the sheet', () => {
    const room = mazeRoom(HARDNESS.medium.corridorWidth, SPEC);
    expect(push(room, cellCenter(0, 0), -20, 0).x).toBeGreaterThan(0);
    expect(push(room, cellCenter(0, 0), 0, -20).y).toBeGreaterThan(0);
    expect(push(room, cellCenter(1, 2), 0, 20).y).toBeLessThan(room.height);
  });

  it('a dead end really is a dead end', () => {
    const room = mazeRoom(HARDNESS.medium.corridorWidth, SPEC);
    const inIt = push(room, cellCenter(1, 2), 20, 0);
    expect(inIt.x).toBeLessThan(cellCenter(2, 2).x);
    expect(push(room, cellCenter(1, 2), -20, 0).x).toBeGreaterThan(cellCenter(0, 2).x);
  });
});

describe('mazeRoom — the hardness corridor width still means something', () => {
  // Half a passage, less the arrow's own size: how far sideways it can get
  // before a wall stops it. Straight out of the hardness table.
  function clearance(corridorWidth: number): number {
    const room = mazeRoom(corridorWidth, SPEC);
    const start = cellCenter(0, 0);
    return push(room, start, 0, 20).y - start.y;
  }

  for (const hardness of Object.values(HARDNESS)) {
    it(`${hardness.id}: passages are ${hardness.corridorWidth} wide`, () => {
      expect(clearance(hardness.corridorWidth)).toBeCloseTo(hardness.corridorWidth / 2 - ARROW_RADIUS);
    });
  }

  it('easy passages are roomier than hard ones', () => {
    expect(clearance(HARDNESS.easy.corridorWidth)).toBeGreaterThan(clearance(HARDNESS.medium.corridorWidth));
    expect(clearance(HARDNESS.medium.corridorWidth)).toBeGreaterThan(clearance(HARDNESS.hard.corridorWidth));
  });
});

describe('mazeRoom — doors and plates', () => {
  const withDoor: MazeSpec = {
    cols: 3,
    rows: 1,
    spawn: '0,0',
    exit: '2,0',
    links: ['0,0-1,0'],
    plates: [{ id: 'plate', at: '0,0', needs: 2 }],
    doors: [{ id: 'door', at: '1,0-2,0', openedBy: ['plate'] }],
  };

  it('a shut door blocks the passage it stands in, an open one does not', () => {
    const room = mazeRoom(HARDNESS.medium.corridorWidth, withDoor);
    const shut = activeWalls(room, new Set());
    const open = activeWalls(room, new Set(['door']));

    let blocked = cellCenter(1, 0);
    for (let i = 0; i < 40; i++) blocked = moveWithCollision(blocked, 20, 0, shut);
    expect(blocked.x).toBeLessThan(2 * CELL);

    let through = cellCenter(1, 0);
    for (let i = 0; i < 40; i++) through = moveWithCollision(through, 20, 0, open);
    expect(through.x).toBeGreaterThan(cellCenter(2, 0).x);
  });

  it('works out for itself whether an opener is a button or a plate', () => {
    const room = mazeRoom(HARDNESS.medium.corridorWidth, withDoor);
    expect(room.doors[0].plateIds).toEqual(['plate']);
    expect(room.doors[0].buttonIds).toEqual([]);
    expect(room.plates[0].needs).toBe(2);
  });

  it('refuses a room that does not add up', () => {
    const bad = (spec: Partial<MazeSpec>) => () =>
      mazeRoom(100, { cols: 3, rows: 3, spawn: '0,0', exit: '1,0', links: ['0,0-1,0'], ...spec });

    expect(bad({ links: ['0,0-2,0'] })).toThrow(/not neighbours/);
    expect(bad({ links: ['0,0-1,0', '2,2-3,2'] })).toThrow(/leaves the grid/);
    expect(bad({ links: ['0,0-1,0', '1,0-0,0'] })).toThrow(/listed twice/);
    expect(bad({ doors: [{ id: 'd', at: '1,0-2,0', openedBy: ['nope'] }] })).toThrow(/no button or plate/);
    expect(bad({ spawn: '2,2' })).toThrow(/walled in/);
  });
});
