/**
 * How many sim ticks an animation frame is worth.
 *
 * THE POINT: the sim has no clock of its own — it only ever advances one fixed
 * tick at a time. So "run faster" can only mean MORE ticks per animation frame,
 * never bigger ones. Fast-forward therefore cannot change a recording or a
 * score: same ticks in, same ticks out, just less real time spent watching.
 */

export const TICK_SECONDS = 1 / 60;

/** How much faster the sim runs while the hurry key is held. */
export const FAST_FORWARD_RATE = 3;

export interface Paced {
  /** Ticks to run this frame. */
  ticks: number;
  /** Ticks a normal-speed frame would have run — what one mouse reading spreads over. */
  baseTicks: number;
  /** Time left over, to carry into the next frame. */
  carry: number;
}

export function paceFrame(carry: number, dt: number, rate = 1, step = TICK_SECONDS): Paced {
  let left = carry + dt;
  let baseTicks = 0;
  while (left >= step) {
    left -= step;
    baseTicks++;
  }
  return { ticks: baseTicks * rate, baseTicks, carry: left };
}
