import type { Rect, Vec2 } from '../sim/types';

export interface ButtonDef {
  id: string;
  zone: Rect;
}

export interface DoorDef {
  id: string;
  rect: Rect;
  // Door is open while ANY of these buttons is held.
  buttonIds: string[];
}

// A room's own things — walls/doors/buttons/exit today, more things later
// (pressure plates, keys, crushers...) slot in the same way.
export interface RoomDef {
  width: number;
  height: number;
  spawn: Vec2;
  exit: Rect;
  walls: Rect[];
  buttons: ButtonDef[];
  doors: DoorDef[];
}

export interface LevelDef {
  id: string;
  name: string;
  minRounds: number;
  build: (corridorWidth: number) => RoomDef;
}
