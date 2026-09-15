import type { RoomDef } from '../content/types';
import { pastSelfFrameAt } from './PastSelf';
import { reachedExit, roomStateFor, type RoomState } from './Simulation';
import type { Frame } from './types';

/** How long the crowd stands on the winning frame before the run starts over. */
export const WIN_HOLD_TICKS = 72;

/** The first tick an arrow stood in the way out — the tick the level was won on. */
function findWinTick(room: RoomDef, recordings: Frame[][], spawn: Frame): number {
  const lastTick = Math.max(0, ...recordings.map((r) => r.length)) - 1;
  for (let t = 0; t <= lastTick; t++) {
    if (reachedExit(room, recordings.map((r) => pastSelfFrameAt(r, t, spawn)))) return t;
  }
  return Math.max(0, lastTick);
}

/**
 * The whole winning run played again from tick 0 — every round at once, the
 * earlier selves beside the one that got out.
 *
 * Nothing is simulated here. Every arrow, the winner included, is a recording
 * read back the way a past self is read back in play, and the room is asked of
 * the sim from those same frames. So a door drawn open in the replay is a door
 * that really was open: there is only ever one answer to that question.
 */
export class VictoryReplay {
  readonly room: RoomDef;
  /** Every round of the run, oldest first; the last one is the round that got out. */
  readonly recordings: Frame[][];
  readonly winTick: number;
  tickIndex = 0;
  private holdLeft = 0;

  constructor(room: RoomDef, recordings: Frame[][]) {
    this.room = room;
    this.recordings = recordings;
    this.winTick = findWinTick(room, recordings, this.spawnFrame);
  }

  /** Which recording is the round that got out — drawn as "you", the rest as past selves. */
  get winnerIndex(): number {
    return this.recordings.length - 1;
  }

  private get spawnFrame(): Frame {
    return { x: this.room.spawn.x, y: this.room.spawn.y, down: false };
  }

  /** Where every self stands on a given tick. Past the end of a recording it freezes, as in play. */
  framesAt(tick: number): Frame[] {
    const spawn = this.spawnFrame;
    return this.recordings.map((r) => pastSelfFrameAt(r, tick, spawn));
  }

  frames(): Frame[] {
    return this.framesAt(this.tickIndex);
  }

  /**
   * The room this tick, read from where everyone stood on the PREVIOUS tick —
   * exactly how `LevelRun` reads it, so the replay shows the doors play showed.
   */
  get roomState(): RoomState {
    return roomStateFor(this.room, this.framesAt(this.tickIndex - 1));
  }

  get won(): boolean {
    return reachedExit(this.room, this.frames());
  }

  /** True while the run is parked on its winning frame, before starting over. */
  get holding(): boolean {
    return this.holdLeft > 0;
  }

  /** One tick on. Runs to the winning tick, waits a beat there, then starts again at 0. */
  advance(): void {
    if (this.holdLeft > 0) {
      this.holdLeft--;
      if (this.holdLeft === 0) this.tickIndex = 0;
      return;
    }
    if (this.tickIndex >= this.winTick) {
      this.holdLeft = WIN_HOLD_TICKS;
      return;
    }
    this.tickIndex++;
  }
}
