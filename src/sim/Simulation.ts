import type { RoomDef } from '../content/types';
import { moveWithCollision } from './Collision';
import { initialLatches, type KeyState, type LatchState } from './Latches';
import { pastSelfFrameAt } from './PastSelf';
import type { Frame, Rect, TickInput, Vec2 } from './types';

function isInRect(p: { x: number; y: number }, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/** What the room's things are doing, given where every arrow was on a given tick. */
export interface RoomState {
  heldButtons: Set<string>;
  satisfiedPlates: Set<string>;
  /** Switches left flipped on. */
  switchesOn: Set<string>;
  /** Ticks of light left on each timer still counting. Not listed means shut. */
  timersLeft: Map<string, number>;
  /** Where every key is, and who is carrying it. */
  keys: KeyState[];
  locksOpen: Set<string>;
  openDoors: Set<string>;
}

/**
 * Every arrow counts the same here — live or past self — so a self that ran out
 * of recording and froze on a plate goes on weighing it down for good.
 *
 * Buttons and plates are read straight off where everyone is standing NOW.
 * Switches, timers, keys and locks can't be: they depend on what happened
 * before now, so they are folded out of the frames by `Latches.ts` and handed in
 * here. Left out, they read as the room at the start of a round.
 */
export function roomStateFor(
  room: RoomDef,
  states: Frame[],
  latch: LatchState = initialLatches(room),
): RoomState {
  const heldButtons = new Set<string>();
  for (const b of room.buttons) {
    if (states.some((s) => s.down && isInRect(s, b.zone))) heldButtons.add(b.id);
  }

  const satisfiedPlates = new Set<string>();
  for (const p of room.plates) {
    // Standing on it is enough — nobody has to hold the mouse button down.
    const standing = states.reduce((n, s) => (isInRect(s, p.zone) ? n + 1 : n), 0);
    if (standing >= p.needs) satisfiedPlates.add(p.id);
  }

  const openDoors = new Set<string>();
  for (const d of room.doors) {
    const held = d.buttonIds.some((id) => heldButtons.has(id));
    const weighed = (d.plateIds ?? []).some((id) => satisfiedPlates.has(id));
    const flipped = (d.switchIds ?? []).some((id) => latch.switchesOn.has(id));
    const counting = (d.timerIds ?? []).some((id) => (latch.timersLeft.get(id) ?? 0) > 0);
    const unlocked = (d.lockIds ?? []).some((id) => latch.locksOpen.has(id));
    if (held || weighed || flipped || counting || unlocked) openDoors.add(d.id);
  }

  return {
    heldButtons,
    satisfiedPlates,
    switchesOn: latch.switchesOn,
    timersLeft: latch.timersLeft,
    keys: latch.keys,
    locksOpen: latch.locksOpen,
    openDoors,
  };
}

/** Which doors are open, based on where every arrow was as of the previous tick. */
export function openDoorsFor(room: RoomDef, prevStates: Frame[], latch?: LatchState): Set<string> {
  return roomStateFor(room, prevStates, latch).openDoors;
}

export function activeWalls(room: RoomDef, openDoorIds: Set<string>): Rect[] {
  const closedDoors = room.doors.filter((d) => !openDoorIds.has(d.id)).map((d) => d.rect);
  return [...room.walls, ...closedDoors];
}

/** The one thing that wins a level: any arrow — you or a past self — standing in the way out. */
export function reachedExit(room: RoomDef, frames: Frame[]): boolean {
  return frames.some((f) => isInRect(f, room.exit));
}

export interface TickResult {
  liveFrame: Frame;
  doorsOpen: Set<string>;
  won: boolean;
}

/**
 * Advance one fixed tick. Past-self arrows just play back their recorded
 * frame for this tick — verbatim, even if it no longer makes sense — only
 * the live arrow is actually simulated against current doors/walls.
 * Past the end of a recording, see `pastSelfFrameAt`.
 *
 * Door state for THIS tick is read from the PREVIOUS tick's positions, not
 * this tick's, so an arrow can't hold a button and be already past its door
 * in the same tick — see MAX_SPEED_PER_TICK for the matching distance rule.
 *
 * Frames are always in ROUND ORDER — the earlier selves, then you — because a
 * key remembers its carrier by position in that list, and the victory replay
 * lays its recordings out the same way.
 */
export function stepTick(
  room: RoomDef,
  prevLive: Frame,
  replays: Frame[][],
  tickIndex: number,
  input: TickInput,
  spawn: Vec2,
  latch?: LatchState,
): TickResult {
  const spawnFrame: Frame = { x: spawn.x, y: spawn.y, down: false };
  const prevReplays = replays.map((r) => pastSelfFrameAt(r, tickIndex - 1, spawnFrame));
  const doorsOpen = openDoorsFor(room, [...prevReplays, prevLive], latch);
  const walls = activeWalls(room, doorsOpen);

  const pos = moveWithCollision(prevLive, input.dx, input.dy, walls);
  const liveFrame: Frame = { x: pos.x, y: pos.y, down: input.down };

  const replayCurrent = replays.map((r) => pastSelfFrameAt(r, tickIndex, spawnFrame));
  const won = reachedExit(room, [...replayCurrent, liveFrame]);

  return { liveFrame, doorsOpen, won };
}
