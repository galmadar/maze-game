import type { Rect, Vec2 } from '../sim/types';

export interface ButtonDef {
  id: string;
  zone: Rect;
}

/**
 * A weight plate: it counts arrows standing on it, no mouse button needed.
 * You cannot open one of these alone — only as a crowd.
 */
export interface PlateDef {
  id: string;
  zone: Rect;
  /** How many arrows must stand on it together. 2 or 3. */
  needs: number;
}

export interface DoorDef {
  id: string;
  rect: Rect;
  // A door is open while ANY of its openers is satisfied: a button being held,
  // or a plate carrying enough arrows. A door can list both and open either way.
  buttonIds: string[];
  plateIds?: string[];
  /**
   * Which way through the door is blocked — 'x' for a door across a left-right
   * passage, 'y' for one across an up-down passage. Only the drawing cares: it
   * decides which way the leaf swings. Defaults to 'x'.
   */
  blocks?: 'x' | 'y';
}

// A room's own things — walls/doors/buttons/plates/exit today, more things later
// (keys, crushers...) slot in the same way.
export interface RoomDef {
  width: number;
  height: number;
  spawn: Vec2;
  exit: Rect;
  walls: Rect[];
  buttons: ButtonDef[];
  plates: PlateDef[];
  doors: DoorDef[];
}

export interface LevelDef {
  id: string;
  name: string;
  minRounds: number;
  build: (corridorWidth: number) => RoomDef;
}
