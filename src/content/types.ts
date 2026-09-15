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

/**
 * A switch that stays where it was put. Every CLICK flips it — the tick a mouse
 * button goes down on it — so a self parked on it flips it once, not sixty times
 * a second. Past selves click too, which is the whole point: the crowd you built
 * is the thing you have to count.
 */
export interface SwitchDef {
  id: string;
  zone: Rect;
}

/**
 * A pad that opens its door for a few seconds and then lets it shut. Clicking it
 * again while it is still open restarts the count rather than adding to it.
 */
export interface TimerDef {
  id: string;
  zone: Rect;
  /** Ticks of light one click buys. Left out, TIMER_OPEN_TICKS. */
  openTicks?: number;
}

/** A key lying on the floor. Click to pick it up, click again to put it down. */
export interface KeyDef {
  id: string;
  at: Vec2;
}

/** Where a key has to end up. Once one touches it, it is open for good. */
export interface LockDef {
  id: string;
  zone: Rect;
  /** Which keys fit. Left out, any key does. */
  keyIds?: string[];
}

export interface DoorDef {
  id: string;
  rect: Rect;
  // A door is open while ANY of its openers is satisfied: a button being held,
  // a plate carrying enough arrows, a switch left flipped on, a timer still
  // counting down, or a lock a key has reached. A door can list several kinds
  // and any one of them will do.
  buttonIds: string[];
  plateIds?: string[];
  switchIds?: string[];
  timerIds?: string[];
  lockIds?: string[];
  /**
   * Which way through the door is blocked — 'x' for a door across a left-right
   * passage, 'y' for one across an up-down passage. Only the drawing cares: it
   * decides which way the leaf swings. Defaults to 'x'.
   */
  blocks?: 'x' | 'y';
}

// A room's own things. The newer ones are optional, so a room with none of them
// — and every test fixture written before they existed — is still a RoomDef.
export interface RoomDef {
  width: number;
  height: number;
  spawn: Vec2;
  exit: Rect;
  walls: Rect[];
  buttons: ButtonDef[];
  plates: PlateDef[];
  doors: DoorDef[];
  switches?: SwitchDef[];
  timers?: TimerDef[];
  keys?: KeyDef[];
  locks?: LockDef[];
}

export interface LevelDef {
  id: string;
  name: string;
  minRounds: number;
  build: (corridorWidth: number) => RoomDef;
}
