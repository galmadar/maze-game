import type { RoomDef } from '../content/types';
import { moveWithCollision } from './Collision';
import { pastSelfFrameAt } from './PastSelf';
import type { Frame, Rect, TickInput, Vec2 } from './types';

function isInRect(p: { x: number; y: number }, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/** Which doors are open, based on who was holding which button as of the previous tick. */
export function openDoorsFor(room: RoomDef, prevStates: Frame[]): Set<string> {
  const heldButtons = new Set<string>();
  for (const b of room.buttons) {
    if (prevStates.some((s) => s.down && isInRect(s, b.zone))) heldButtons.add(b.id);
  }
  const open = new Set<string>();
  for (const d of room.doors) {
    if (d.buttonIds.some((id) => heldButtons.has(id))) open.add(d.id);
  }
  return open;
}

export function activeWalls(room: RoomDef, openDoorIds: Set<string>): Rect[] {
  const closedDoors = room.doors.filter((d) => !openDoorIds.has(d.id)).map((d) => d.rect);
  return [...room.walls, ...closedDoors];
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
  const won = [liveFrame, ...replayCurrent].some((f) => isInRect(f, room.exit));

  return { liveFrame, doorsOpen, won };
}
