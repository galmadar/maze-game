// The room shapes a level can be built out of. A level's `build` picks one and
// hands it the hardness's corridor width, so the same room is roomy on easy and
// tight on hard.
import type { Rect, Vec2 } from '../sim/types';
import type { ButtonDef, DoorDef, PlateDef, RoomDef } from './types';

// ---------------------------------------------------------------- corridor

const CORRIDOR_ROOM_W = 900;
const CORRIDOR_ROOM_H = 300;
const CORRIDOR_CENTER_Y = CORRIDOR_ROOM_H / 2;

export interface DoorSpec {
  id: string;
  x: number;
  w: number;
  buttonIds: string[];
}
export interface ButtonSpec {
  id: string;
  x: number;
  w: number;
}

// Levels 1-3 are one straight corridor — doors and buttons just sit along it at
// different x positions. Levels 4 and up use `mazeRoom` instead.
export function corridorRoom(
  corridorWidth: number,
  doorSpecs: DoorSpec[],
  buttonSpecs: ButtonSpec[],
): RoomDef {
  const half = corridorWidth / 2;
  const top = CORRIDOR_CENTER_Y - half;
  const bottom = CORRIDOR_CENTER_Y + half;

  const walls = [
    { x: 0, y: 0, w: CORRIDOR_ROOM_W, h: top },
    { x: 0, y: bottom, w: CORRIDOR_ROOM_W, h: CORRIDOR_ROOM_H - bottom },
  ];

  const doors: DoorDef[] = doorSpecs.map((d) => ({
    id: d.id,
    rect: { x: d.x, y: top, w: d.w, h: corridorWidth },
    buttonIds: d.buttonIds,
  }));

  const buttons: ButtonDef[] = buttonSpecs.map((b) => ({
    id: b.id,
    zone: { x: b.x, y: CORRIDOR_CENTER_Y - 20, w: b.w, h: 40 },
  }));

  return {
    width: CORRIDOR_ROOM_W,
    height: CORRIDOR_ROOM_H,
    spawn: { x: 40, y: CORRIDOR_CENTER_Y },
    exit: { x: CORRIDOR_ROOM_W - 60, y: CORRIDOR_CENTER_Y - 25, w: 40, h: 50 },
    walls,
    buttons,
    plates: [],
    doors,
  };
}

// -------------------------------------------------------------------- maze

// A maze is a grid of square cells whose floor is `corridorWidth` across; the
// rest of each cell is wall, so a narrow corridor means fat walls.
export const CELL = 220;

export type CellRef = string; // 'c,r'
export type LinkRef = string; // 'c,r-c,r', two neighbouring cells

export interface MazeDoorSpec {
  id: string;
  /** The passage this door stands in. */
  at: LinkRef;
  /** Ids of the buttons and/or plates that open it. */
  openedBy: string[];
}
export interface MazeButtonSpec {
  id: string;
  at: CellRef;
}
export interface MazePlateSpec {
  id: string;
  at: CellRef;
  needs: number;
}

export interface MazeSpec {
  cols: number;
  rows: number;
  spawn: CellRef;
  exit: CellRef;
  /** Open passages between neighbouring cells. Doors add their own. */
  links: LinkRef[];
  doors?: MazeDoorSpec[];
  buttons?: MazeButtonSpec[];
  plates?: MazePlateSpec[];
}

type Cell = [number, number];

function parseCell(s: CellRef): Cell {
  const m = /^\s*(\d+)\s*,\s*(\d+)\s*$/.exec(s);
  if (!m) throw new Error(`maze: bad cell "${s}" — expected "c,r"`);
  return [Number(m[1]), Number(m[2])];
}

/** Two neighbouring cells, always returned left-to-right or top-to-bottom. */
function parseLink(s: LinkRef): [Cell, Cell] {
  const parts = s.split('-');
  if (parts.length !== 2) throw new Error(`maze: bad link "${s}" — expected "c,r-c,r"`);
  const a = parseCell(parts[0]);
  const b = parseCell(parts[1]);
  if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) {
    throw new Error(`maze: link "${s}" joins cells that are not neighbours`);
  }
  return a[0] + a[1] <= b[0] + b[1] ? [a, b] : [b, a];
}

function keyOf([c, r]: Cell): string {
  return `${c},${r}`;
}

function linkKeyOf(a: Cell, b: Cell): string {
  return `${keyOf(a)}|${keyOf(b)}`;
}

// Glue wall tiles that sit edge to edge into longer rectangles: the renderer
// outlines each one, so without this a straight wall is drawn as a row of bricks.
function mergeWalls(rects: Rect[]): Rect[] {
  const out = rects.slice();
  for (let merged = true; merged; ) {
    merged = false;
    for (let i = 0; i < out.length && !merged; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        const sideBySide = a.y === b.y && a.h === b.h && (a.x + a.w === b.x || b.x + b.w === a.x);
        const stacked = a.x === b.x && a.w === b.w && (a.y + a.h === b.y || b.y + b.h === a.y);
        if (!sideBySide && !stacked) continue;
        out[i] = sideBySide
          ? { x: Math.min(a.x, b.x), y: a.y, w: a.w + b.w, h: a.h }
          : { x: a.x, y: Math.min(a.y, b.y), w: a.w, h: a.h + b.h };
        out.splice(j, 1);
        merged = true;
        break;
      }
    }
  }
  return out;
}

export function cellCenter(c: number, r: number): Vec2 {
  return { x: (c + 0.5) * CELL, y: (r + 0.5) * CELL };
}

function centeredSquare(cell: Cell, side: number): Rect {
  const { x, y } = cellCenter(cell[0], cell[1]);
  return { x: x - side / 2, y: y - side / 2, w: side, h: side };
}

export function mazeRoom(corridorWidth: number, spec: MazeSpec): RoomDef {
  const { cols, rows } = spec;
  // Clamped rather than asserted so a future hardness tweak can never make a
  // room with no wall left between its passages.
  const cw = Math.max(40, Math.min(corridorWidth, CELL - 60));
  const edge = (CELL - cw) / 2; // solid margin around a cell's floor
  const width = cols * CELL;
  const height = rows * CELL;

  const inside = ([c, r]: Cell): boolean => c >= 0 && c < cols && r >= 0 && r < rows;

  /** The rectangle that fills the gap between two neighbouring cells. */
  const gapRect = (a: Cell, b: Cell): Rect =>
    a[1] === b[1]
      ? { x: b[0] * CELL - edge, y: a[1] * CELL + edge, w: edge * 2, h: cw }
      : { x: a[0] * CELL + edge, y: b[1] * CELL - edge, w: cw, h: edge * 2 };

  const passages = new Set<string>();
  const addPassage = (ref: LinkRef): [Cell, Cell] => {
    const [a, b] = parseLink(ref);
    if (!inside(a) || !inside(b)) throw new Error(`maze: link "${ref}" leaves the grid`);
    const key = linkKeyOf(a, b);
    if (passages.has(key)) throw new Error(`maze: passage "${ref}" listed twice`);
    passages.add(key);
    return [a, b];
  };

  for (const ref of spec.links) addPassage(ref);

  const plates: PlateDef[] = (spec.plates ?? []).map((p) => ({
    id: p.id,
    zone: centeredSquare(parseCell(p.at), Math.min(cw * 0.86, 112)),
    needs: p.needs,
  }));
  const buttons: ButtonDef[] = (spec.buttons ?? []).map((b) => ({
    id: b.id,
    zone: centeredSquare(parseCell(b.at), Math.min(cw * 0.7, 84)),
  }));

  const plateIdSet = new Set(plates.map((p) => p.id));
  const buttonIdSet = new Set(buttons.map((b) => b.id));
  const doors: DoorDef[] = (spec.doors ?? []).map((d) => {
    const [a, b] = addPassage(d.at);
    for (const id of d.openedBy) {
      if (!plateIdSet.has(id) && !buttonIdSet.has(id)) {
        throw new Error(`maze: door ${d.id} is opened by "${id}", which is no button or plate here`);
      }
    }
    return {
      id: d.id,
      rect: gapRect(a, b),
      buttonIds: d.openedBy.filter((id) => buttonIdSet.has(id)),
      plateIds: d.openedBy.filter((id) => plateIdSet.has(id)),
      blocks: a[1] === b[1] ? 'x' : 'y',
    };
  });

  // ---- the solid parts ----
  // The border of the sheet, as four strips that meet at the corners rather
  // than overlap — overlapping ones would be drawn over twice.
  const walls: Rect[] = [
    { x: 0, y: 0, w: width, h: edge },
    { x: 0, y: height - edge, w: width, h: edge },
    { x: 0, y: edge, w: edge, h: height - edge * 2 },
    { x: width - edge, y: edge, w: edge, h: height - edge * 2 },
  ];

  // A block wherever two grid lines cross, inside the sheet.
  for (let c = 1; c < cols; c++) {
    for (let r = 1; r < rows; r++) {
      walls.push({ x: c * CELL - edge, y: r * CELL - edge, w: edge * 2, h: edge * 2 });
    }
  }

  // A plug in every gap that no passage goes through. A doored passage keeps
  // its gap clear — the door rect stands there instead, and can be lifted away.
  const degree = new Map<string, number>();
  const bump = (cell: Cell): void => {
    degree.set(keyOf(cell), (degree.get(keyOf(cell)) ?? 0) + 1);
  };

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      for (const b of [[c + 1, r] as Cell, [c, r + 1] as Cell]) {
        if (!inside(b)) continue;
        const a: Cell = [c, r];
        if (passages.has(linkKeyOf(a, b))) {
          bump(a);
          bump(b);
        } else {
          walls.push(gapRect(a, b));
        }
      }
    }
  }

  // A cell nothing leads to is solid all the way through — that is how a maze
  // gets thick walls instead of sealed little pockets of floor.
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if ((degree.get(`${c},${r}`) ?? 0) === 0) {
        walls.push({ x: c * CELL + edge, y: r * CELL + edge, w: cw, h: cw });
      }
    }
  }

  const reachable = (ref: CellRef, what: string): Cell => {
    const cell = parseCell(ref);
    if (!inside(cell)) throw new Error(`maze: ${what} "${ref}" is off the grid`);
    if ((degree.get(keyOf(cell)) ?? 0) === 0) throw new Error(`maze: ${what} "${ref}" is walled in`);
    return cell;
  };

  for (const p of spec.plates ?? []) reachable(p.at, `plate ${p.id}`);
  for (const b of spec.buttons ?? []) reachable(b.at, `button ${b.id}`);

  return {
    width,
    height,
    spawn: cellCenter(...reachable(spec.spawn, 'spawn')),
    exit: centeredSquare(reachable(spec.exit, 'exit'), Math.min(cw * 0.62, 84)),
    walls: mergeWalls(walls),
    buttons,
    plates,
    doors,
  };
}
