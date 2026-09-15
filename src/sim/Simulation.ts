import type { RoomDef } from '../content/types';
import { moveWithCollision } from './Collision';
import { pastSelfFrameAt } from './PastSelf';
import type { Frame, Rect, TickInput, Vec2 } from './types';

function isInRect(p: { x: number; y: number }, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/** What the room's things are doing, given where every arrow was on a given tick. */
export interface RoomState {
  heldButtons: Set<string>;
  satisfiedPlates: Set<string>;
  openDoors: Set<string>;
}

/**
 * Every arrow counts the same here — live or past self — so a self that ran out
 * of recording and froze on a plate goes on weighing it down for good.
 */
export function roomStateFor(room: RoomDef, states: Frame[]): RoomState {
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
    if (held || weighed) openDoors.add(d.id);
  }

  return { heldButtons, satisfiedPlates, openDoors };
}

/** Which doors are open, based on where every arrow was as of the previous tick. */
export function openDoorsFor(room: RoomDef, prevStates: Frame[]): Set<string> {
  return roomStateFor(room, prevStates).openDoors;
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
 */
export function stepTick(
  room: RoomDef,
  prevLive: Frame,
  replays: Frame[][],
  tickIndex: number,
  input: TickInput,
  spawn: Vec2,
): TickResult {
  const spawnFrame: Frame = { x: spawn.x, y: spawn.y, down: false };
  const prevReplays = replays.map((r) => pastSelfFrameAt(r, tickIndex - 1, spawnFrame));
  const doorsOpen = openDoorsFor(room, [prevLive, ...prevReplays]);
  const walls = activeWalls(room, doorsOpen);

  const pos = moveWithCollision(prevLive, input.dx, input.dy, walls);
  const liveFrame: Frame = { x: pos.x, y: pos.y, down: input.down };

  const replayCurrent = replays.map((r) => pastSelfFrameAt(r, tickIndex, spawnFrame));
  const won = reachedExit(room, [liveFrame, ...replayCurrent]);

  return { liveFrame, doorsOpen, won };
}
