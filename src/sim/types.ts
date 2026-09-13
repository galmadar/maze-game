export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One recorded/replayed tick: absolute position and button state. */
export interface Frame {
  x: number;
  y: number;
  down: boolean;
}

/** One tick of live input: desired movement this tick, and button state. */
export interface TickInput {
  dx: number;
  dy: number;
  down: boolean;
}
