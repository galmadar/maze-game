// The things in the room that REMEMBER something: a switch that stays flipped, a
// timer still counting down, a key somebody picked up, a lock a key has reached.
//
// THE RULE THAT MATTERS: none of this is a running total the live game keeps and
// the replay doesn't. It is a fold over the frames — where every arrow stood and
// whether its button was down, tick by tick — and nothing else. Hand the same
// recordings to a new fold and you get the same answers, which is the only
// reason the victory replay can show what play showed.
import { KEY_REACH, TIMER_OPEN_TICKS } from '../content/hardness';
import type { RoomDef } from '../content/types';
import type { Frame, Rect } from './types';

function isInRect(p: { x: number; y: number }, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/** A key: where it is, and which self is carrying it. */
export interface KeyState {
  id: string;
  x: number;
  y: number;
  /**
   * Index into the frames array of whoever is carrying it, or null on the floor.
   *
   * The frames array is in ROUND ORDER — the earlier selves, then you — in play
   * and in the replay alike, so index N is the same self in both. That is what
   * lets a carrier survive from one tick to the next, and from play into the replay.
   */
  carrier: number | null;
}

export interface LatchState {
  switchesOn: Set<string>;
  /** Ticks of light left on each timer. Not listed means shut. */
  timersLeft: Map<string, number>;
  keys: KeyState[];
  locksOpen: Set<string>;
}

/** The room as it starts — every round, because a round resets the room. */
export function initialLatches(room: RoomDef): LatchState {
  return {
    switchesOn: new Set(),
    timersLeft: new Map(),
    keys: (room.keys ?? []).map((k) => ({ id: k.id, x: k.at.x, y: k.at.y, carrier: null })),
    locksOpen: new Set(),
  };
}

/**
 * A CLICK is the tick the button goes down, not every tick it is held. Without
 * this a self resting on a switch with the button down would flip it sixty times
 * a second, and a frozen self would flip it forever.
 */
function clicked(frames: Frame[], prevFrames: Frame[], i: number): boolean {
  return frames[i].down && !(prevFrames[i]?.down ?? false);
}

/**
 * One tick on. Given what the room remembered, where everyone stood last tick
 * and where they stand now, what does it remember next?
 */
export function stepLatches(
  room: RoomDef,
  prev: LatchState,
  prevFrames: Frame[],
  frames: Frame[],
): LatchState {
  const clicks: number[] = [];
  for (let i = 0; i < frames.length; i++) if (clicked(frames, prevFrames, i)) clicks.push(i);

  // ---- switches: every click flips it, whoever makes it ----
  // Two selves clicking the same switch on the same tick cancel out, which is
  // why this counts the clicks and looks at the parity rather than flipping in
  // a loop — the answer can't depend on who is read first.
  const switchesOn = new Set(prev.switchesOn);
  for (const s of room.switches ?? []) {
    const flips = clicks.reduce((n, i) => (isInRect(frames[i], s.zone) ? n + 1 : n), 0);
    if (flips % 2 === 1) {
      if (switchesOn.has(s.id)) switchesOn.delete(s.id);
      else switchesOn.add(s.id);
    }
  }

  // ---- timer doors: a click buys the whole time again, it never stacks ----
  const timersLeft = new Map<string, number>();
  for (const t of room.timers ?? []) {
    const restarted = clicks.some((i) => isInRect(frames[i], t.zone));
    const left = restarted
      ? (t.openTicks ?? TIMER_OPEN_TICKS)
      : Math.max(0, (prev.timersLeft.get(t.id) ?? 0) - 1);
    if (left > 0) timersLeft.set(t.id, left);
  }

  // ---- keys: click to pick up, click to put down, and they go where their carrier goes ----
  const keys = prev.keys.map((k) => ({ ...k }));
  const handsFull = new Set<number>();
  for (const k of keys) if (k.carrier !== null) handsFull.add(k.carrier);

  // Dropping first. A key follows its carrier every tick it is not dropped —
  // including the ticks after that self ran out of recording, so a self that
  // froze holding the key leaves the key frozen with it.
  const justDropped = new Set<number>();
  for (const k of keys) {
    if (k.carrier === null) continue;
    const carrier = frames[k.carrier];
    if (carrier === undefined) continue; // no such self this round — leave it where it lies
    k.x = carrier.x;
    k.y = carrier.y;
    if (clicked(frames, prevFrames, k.carrier)) {
      justDropped.add(k.carrier);
      handsFull.delete(k.carrier);
      k.carrier = null;
    }
  }

  // Then picking up. An empty hand that clicked takes the nearest key in reach;
  // a hand that just put one down does not pick the same one straight back up.
  for (const i of clicks) {
    if (handsFull.has(i) || justDropped.has(i)) continue;
    let best: KeyState | null = null;
    let bestDist = Infinity;
    for (const k of keys) {
      if (k.carrier !== null) continue;
      const d = Math.hypot(frames[i].x - k.x, frames[i].y - k.y);
      if (d <= KEY_REACH && d < bestDist) {
        bestDist = d;
        best = k;
      }
    }
    if (best) {
      best.carrier = i;
      best.x = frames[i].x;
      best.y = frames[i].y;
      handsFull.add(i);
    }
  }

  // ---- locks: a key touching one opens it for good ----
  const locksOpen = new Set(prev.locksOpen);
  for (const l of room.locks ?? []) {
    if (locksOpen.has(l.id)) continue;
    const fits = (k: KeyState): boolean => l.keyIds === undefined || l.keyIds.includes(k.id);
    if (keys.some((k) => fits(k) && isInRect(k, l.zone))) locksOpen.add(l.id);
  }

  return { switchesOn, timersLeft, keys, locksOpen };
}

/**
 * The latched state of a room, tick by tick, worked out from the frames alone.
 * `at(t)` is the state AFTER tick t has run; `at(-1)` is the room as it starts.
 *
 * It caches, but it is a cache of a fold, not a tally: two timelines over the
 * same frames agree everywhere. Play builds one over the round being played and
 * the victory replay builds another over the same recordings, and they give the
 * same answers at the same ticks — which is the thing the replay rests on.
 *
 * Only ask for a tick whose frames are settled. In play that means never past
 * the last recorded tick, or a frame that is still being written would be
 * folded in as if it were final.
 */
export class LatchTimeline {
  /** states[t + 1] is at(t), so states[0] is the room before anything happened. */
  private states: LatchState[];
  /** A room with none of these things never changes, so it is never folded at all. */
  private readonly nothingToRemember: boolean;

  constructor(
    private room: RoomDef,
    private framesAt: (tick: number) => Frame[],
  ) {
    this.states = [initialLatches(room)];
    this.nothingToRemember =
      (room.switches?.length ?? 0) === 0 &&
      (room.timers?.length ?? 0) === 0 &&
      (room.keys?.length ?? 0) === 0 &&
      (room.locks?.length ?? 0) === 0;
  }

  at(tick: number): LatchState {
    if (tick < 0 || this.nothingToRemember) return this.states[0];
    const from = this.states.length - 1;
    if (from <= tick) {
      let prevFrames = this.framesAt(from - 1);
      for (let t = from; t <= tick; t++) {
        const frames = this.framesAt(t);
        this.states[t + 1] = stepLatches(this.room, this.states[t], prevFrames, frames);
        prevFrames = frames;
      }
    }
    return this.states[tick + 1];
  }
}
