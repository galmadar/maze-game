import type { RoomDef } from '../content/types';
import { pastSelfFrameAt } from './PastSelf';
import { roomStateFor, stepTick, type RoomState } from './Simulation';
import type { Frame, TickInput } from './types';

export interface TickReport {
  won: boolean;
  ranOutOfRounds: boolean;
  roundOver: boolean;
  // The live frame produced by this tick, captured before any round-rollover reset.
  frame: Frame;
}

/** Runs one level attempt: rounds, past-self replays, the clock, and the round limit. */
export class LevelRun {
  readonly room: RoomDef;
  /** Each round is this many ticks longer than the one before — round 1 is one step. */
  readonly clockStepTicks: number;
  readonly roundLimit: number;

  replays: Frame[][] = [];
  round = 1;
  tickIndex = 0;
  liveFrame: Frame;
  currentRecording: Frame[] = [];
  finished = false;
  won = false;

  constructor(room: RoomDef, clockStepTicks: number, roundLimit: number) {
    this.room = room;
    this.clockStepTicks = clockStepTicks;
    this.roundLimit = roundLimit;
    this.liveFrame = { x: room.spawn.x, y: room.spawn.y, down: false };
  }

  /** The CURRENT round's clock. Read as a plain property by the HUD every frame. */
  get clockTicks(): number {
    return this.round * this.clockStepTicks;
  }

  /** Every arrow — you and each past self — where it stood on the previous tick. */
  private prevStates(): Frame[] {
    const spawnFrame: Frame = { x: this.room.spawn.x, y: this.room.spawn.y, down: false };
    const replays = this.replays.map((r) => pastSelfFrameAt(r, this.tickIndex - 1, spawnFrame));
    const live = this.tickIndex === 0 ? spawnFrame : this.currentRecording[this.tickIndex - 1];
    return [live, ...replays];
  }

  /**
   * The room as the sim sees it this tick. The renderer asks for this rather
   * than working it out again and drifting from the sim.
   */
  get roomState(): RoomState {
    return roomStateFor(this.room, this.prevStates());
  }

  /** Where each past self is standing right now, frozen ones included. */
  pastSelfFrames(): Frame[] {
    const spawnFrame: Frame = { x: this.room.spawn.x, y: this.room.spawn.y, down: false };
    return this.replays.map((r) => pastSelfFrameAt(r, this.tickIndex, spawnFrame));
  }

  private resetForNewRound(): void {
    this.tickIndex = 0;
    this.currentRecording = [];
    this.liveFrame = { x: this.room.spawn.x, y: this.room.spawn.y, down: false };
  }

  tick(input: TickInput): TickReport {
    if (this.finished) {
      return { won: false, ranOutOfRounds: false, roundOver: false, frame: this.liveFrame };
    }

    const { liveFrame, won } = stepTick(
      this.room,
      this.liveFrame,
      this.replays,
      this.tickIndex,
      input,
      this.room.spawn,
    );
    this.liveFrame = liveFrame;
    this.currentRecording.push(liveFrame);
    this.tickIndex++;

    if (won) {
      this.finished = true;
      this.won = true;
      return { won: true, ranOutOfRounds: false, roundOver: true, frame: liveFrame };
    }

    if (this.tickIndex >= this.clockTicks) {
      this.replays.push(this.currentRecording);
      this.round++;
      if (this.round > this.roundLimit) {
        this.replays = [];
        this.round = 1;
        this.resetForNewRound();
        return { won: false, ranOutOfRounds: true, roundOver: true, frame: liveFrame };
      }
      this.resetForNewRound();
      return { won: false, ranOutOfRounds: false, roundOver: true, frame: liveFrame };
    }

    return { won: false, ranOutOfRounds: false, roundOver: false, frame: liveFrame };
  }

  /** Full clocks of every finished round, plus progress into the current one. */
  elapsedSeconds(ticksPerSecond = 60): number {
    // Summed from the recordings, because every round's clock is a different length.
    const finished = this.replays.reduce((total, r) => total + r.length, 0);
    return (finished + this.tickIndex) / ticksPerSecond;
  }
}
