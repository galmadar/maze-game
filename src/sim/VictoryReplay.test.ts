import { describe, expect, it } from 'vitest';
import type { RoomDef } from '../content/types';
import { LevelRun } from './LevelRun';
import type { RoomState } from './Simulation';
import type { Frame } from './types';
import { VictoryReplay, WIN_HOLD_TICKS } from './VictoryReplay';

/** A corridor with a held door two thirds of the way along, and the way out past it. */
function doorRoom(): RoomDef {
  return {
    width: 300,
    height: 100,
    spawn: { x: 10, y: 50 },
    exit: { x: 280, y: 40, w: 20, h: 20 },
    walls: [
      { x: 0, y: 0, w: 300, h: 30 },
      { x: 0, y: 70, w: 300, h: 30 },
    ],
    buttons: [{ id: 'btn', zone: { x: 100, y: 30, w: 20, h: 40 } }],
    plates: [],
    doors: [{ id: 'door', rect: { x: 200, y: 30, w: 20, h: 40 }, buttonIds: ['btn'] }],
  };
}

/** The same corridor, but the door wants two arrows standing on a plate instead. */
function plateRoom(): RoomDef {
  return {
    width: 300,
    height: 100,
    spawn: { x: 10, y: 50 },
    exit: { x: 280, y: 40, w: 20, h: 20 },
    walls: [
      { x: 0, y: 0, w: 300, h: 30 },
      { x: 0, y: 70, w: 300, h: 30 },
    ],
    buttons: [],
    plates: [{ id: 'plate', zone: { x: 90, y: 30, w: 40, h: 40 }, needs: 2 }],
    doors: [{ id: 'door', rect: { x: 200, y: 30, w: 20, h: 40 }, buttonIds: [], plateIds: ['plate'] }],
  };
}

/** Everything the replay is handed, plus the room state play showed on each tick of the win. */
interface Played {
  run: LevelRun;
  recordings: Frame[][];
  /** Indexed by the winning round's tick: what `LevelRun.roomState` read before that tick ran. */
  statesByTick: RoomState[];
}

function recordingsOf(run: LevelRun): Frame[][] {
  return [...run.replays, run.currentRecording];
}

function sets(state: RoomState): Record<string, string[]> {
  return {
    heldButtons: [...state.heldButtons].sort(),
    satisfiedPlates: [...state.satisfiedPlates].sort(),
    openDoors: [...state.openDoors].sort(),
  };
}

/**
 * Play the door room: `setups` short rounds that walk to the button and hold it,
 * then one round that walks straight out. The room state is captured on every
 * tick of that last round, which is what the replay has to reproduce.
 */
function playDoorRoom(room: RoomDef, setups: number, setupTicks: number): Played {
  const run = new LevelRun(room, 600, 10);
  for (let r = 0; r < setups; r++) {
    for (let t = 0; t < setupTicks; t++) run.tick({ dx: t < 5 ? 20 : 0, dy: 0, down: t >= 5 });
    run.endRound();
  }

  const statesByTick: RoomState[] = [];
  while (!run.won) {
    statesByTick.push(run.roomState);
    run.tick({ dx: 20, dy: 0, down: false });
  }
  return { run, recordings: recordingsOf(run), statesByTick };
}

describe('VictoryReplay — the winning run, played again from tick 0', () => {
  it('wins on the tick it was won on, and not a tick before', () => {
    const room = doorRoom();
    const { run, recordings } = playDoorRoom(room, 1, 8);
    expect(run.won).toBe(true);

    const replay = new VictoryReplay(room, recordings);
    expect(replay.winTick).toBe(run.currentRecording.length - 1);

    for (let t = 0; t < replay.winTick; t++) {
      replay.tickIndex = t;
      expect(replay.won).toBe(false);
    }
    replay.tickIndex = replay.winTick;
    expect(replay.won).toBe(true);
  });

  it('shows the same room at the same ticks as the round that won', () => {
    const room = doorRoom();
    const { recordings, statesByTick } = playDoorRoom(room, 1, 8);
    const replay = new VictoryReplay(room, recordings);

    for (let t = 0; t < statesByTick.length; t++) {
      expect(replay.tickIndex).toBe(t);
      expect(sets(replay.roomState)).toEqual(sets(statesByTick[t]));
      replay.advance();
    }
    // The door really did both things during the run, or this proves nothing.
    expect(statesByTick.some((s) => s.openDoors.has('door'))).toBe(true);
    expect(statesByTick.some((s) => !s.openDoors.has('door'))).toBe(true);
  });

  it('reproduces a plate going green at the same ticks it did in play', () => {
    const room = plateRoom();
    const run = new LevelRun(room, 600, 10);
    // Two short rounds go and stand on the plate; the third strolls out past its door.
    for (let r = 0; r < 2; r++) {
      for (let t = 0; t < 10; t++) run.tick({ dx: t < 5 ? 20 : 0, dy: 0, down: false });
      run.endRound();
    }
    const statesByTick: RoomState[] = [];
    while (!run.won) {
      statesByTick.push(run.roomState);
      run.tick({ dx: 20, dy: 0, down: false });
    }
    expect(run.won).toBe(true);

    const replay = new VictoryReplay(room, recordingsOf(run));
    for (const state of statesByTick) {
      expect(sets(replay.roomState)).toEqual(sets(state));
      replay.advance();
    }
    expect(statesByTick.some((s) => s.satisfiedPlates.has('plate'))).toBe(true);
    expect(statesByTick.some((s) => !s.satisfiedPlates.has('plate'))).toBe(true);
  });

  it('draws the round that got out last, so it is the one on top', () => {
    const room = doorRoom();
    const { recordings } = playDoorRoom(room, 1, 8);
    const replay = new VictoryReplay(room, recordings);
    expect(replay.winnerIndex).toBe(recordings.length - 1);
    expect(replay.frames()).toHaveLength(recordings.length);
  });
});

describe('VictoryReplay — a self that ran out of recording', () => {
  it('freezes on its last frame, as in play, and goes on holding its button', () => {
    const room = doorRoom();
    // Round 1 is 8 ticks; the round that wins is far longer, so self 1 runs out early.
    const { run, recordings } = playDoorRoom(room, 1, 8);
    const short = recordings[0];
    expect(short).toHaveLength(8);
    expect(run.currentRecording.length).toBeGreaterThan(short.length);

    const replay = new VictoryReplay(room, recordings);
    const frozen = short[short.length - 1];
    expect(frozen.down).toBe(true);

    for (let t = short.length; t <= replay.winTick; t++) {
      expect(replay.framesAt(t)[0]).toEqual(frozen);
    }
    // And because it is still holding, the door is still open the whole way out.
    replay.tickIndex = replay.winTick;
    expect(replay.roomState.heldButtons.has('btn')).toBe(true);
    expect(replay.roomState.openDoors.has('door')).toBe(true);
  });

  it('stands everyone at the spawn before their first tick', () => {
    const room = doorRoom();
    const { recordings } = playDoorRoom(room, 1, 8);
    const replay = new VictoryReplay(room, recordings);
    for (const f of replay.framesAt(-1)) {
      expect(f).toEqual({ x: room.spawn.x, y: room.spawn.y, down: false });
    }
  });
});

describe('VictoryReplay — the loop', () => {
  it('runs to the win, waits a beat on it, then starts again at zero', () => {
    const room = doorRoom();
    const { recordings } = playDoorRoom(room, 1, 8);
    const replay = new VictoryReplay(room, recordings);

    for (let t = 0; t < replay.winTick; t++) replay.advance();
    expect(replay.tickIndex).toBe(replay.winTick);
    expect(replay.holding).toBe(false);

    // The beat: still parked on the winning frame, so the win has time to land.
    replay.advance();
    expect(replay.holding).toBe(true);
    for (let i = 0; i < WIN_HOLD_TICKS; i++) {
      expect(replay.tickIndex).toBe(replay.winTick);
      expect(replay.won).toBe(true);
      replay.advance();
    }

    expect(replay.tickIndex).toBe(0);
    expect(replay.holding).toBe(false);

    // Second time round is the same run again, frame for frame.
    const second: Frame[][] = [];
    for (let t = 0; t <= replay.winTick; t++) second.push(replay.framesAt(t));
    const first = new VictoryReplay(room, recordings);
    const firstFrames: Frame[][] = [];
    for (let t = 0; t <= first.winTick; t++) firstFrames.push(first.framesAt(t));
    expect(second).toEqual(firstFrames);
  });

  it('never runs past the winning tick, so nobody walks on after the exit', () => {
    const room = doorRoom();
    const { recordings } = playDoorRoom(room, 1, 8);
    const replay = new VictoryReplay(room, recordings);
    for (let i = 0; i < replay.winTick * 3 + WIN_HOLD_TICKS * 3; i++) {
      replay.advance();
      expect(replay.tickIndex).toBeLessThanOrEqual(replay.winTick);
    }
  });
});
