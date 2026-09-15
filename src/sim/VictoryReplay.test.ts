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

/**
 * EVERYTHING the room is doing, flattened so two of them can be compared. The
 * things that remember — switches, timers, keys, locks — are in here on purpose:
 * they are the ones that could look right in play and wrong in the replay.
 */
function sets(state: RoomState): Record<string, unknown> {
  return {
    heldButtons: [...state.heldButtons].sort(),
    satisfiedPlates: [...state.satisfiedPlates].sort(),
    switchesOn: [...state.switchesOn].sort(),
    timersLeft: [...state.timersLeft].sort(),
    keys: state.keys.map((k) => [k.id, k.x, k.y, k.carrier]),
    locksOpen: [...state.locksOpen].sort(),
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

// ---------------------------------------------------------------------------
// The things that REMEMBER something: a switch left flipped, a timer counting
// down, a key somebody picked up, a lock a key reached.
//
// THIS is the test that matters. None of that is a tally the live game keeps
// and the replay doesn't — it is folded out of the frames — and the proof is
// that the replay, handed nothing but the recordings, arrives at the same room
// on the same ticks. A switch whose state lived outside the sim would look
// right in play and wrong here.
// ---------------------------------------------------------------------------

/** The same corridor as ever, with one of the newer things standing in it. */
function corridor(extra: Partial<RoomDef>): RoomDef {
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
    plates: [],
    doors: [],
    ...extra,
  };
}

type Step = { dx: number; dy: number; down: boolean };

const move = (n: number, dx: number): Step[] =>
  Array.from({ length: n }, () => ({ dx, dy: 0, down: false }));
const wait = (n: number): Step[] => move(n, 0);
/** Press and let go: one click, of the kind a hand actually makes. */
const click: Step[] = [
  { dx: 0, dy: 0, down: true },
  { dx: 0, dy: 0, down: false },
];

/** Play scripted rounds to a win, keeping the room play showed on every tick of the last one. */
function playScript(room: RoomDef, setups: Step[][], win: Step[]): Played {
  const run = new LevelRun(room, 4000, 10);
  for (const setup of setups) {
    for (const s of setup) run.tick(s);
    run.endRound();
  }

  const statesByTick: RoomState[] = [];
  for (const s of win) {
    if (run.won) break;
    statesByTick.push(run.roomState);
    run.tick(s);
  }
  expect(run.won).toBe(true);
  return { run, recordings: recordingsOf(run), statesByTick };
}

/** Walk the replay through the winning round, tick for tick, against what play showed. */
function expectSameRoomEveryTick(room: RoomDef, played: Played): VictoryReplay {
  const replay = new VictoryReplay(room, played.recordings);
  for (let t = 0; t < played.statesByTick.length; t++) {
    expect(replay.tickIndex).toBe(t);
    expect(sets(replay.roomState)).toEqual(sets(played.statesByTick[t]));
    replay.advance();
  }
  expect(replay.tickIndex).toBe(replay.winTick);
  expect(replay.won).toBe(true);
  return replay;
}

/** The distinct values something took during the winning round — proof it moved at all. */
function changesIn<T>(played: Played, read: (s: RoomState) => T): Set<string> {
  return new Set(played.statesByTick.map((s) => JSON.stringify(read(s))));
}

describe('VictoryReplay — a switch that stays flipped', () => {
  const room = (): RoomDef =>
    corridor({
      switches: [{ id: 'sw', zone: { x: 90, y: 30, w: 40, h: 40 } }],
      doors: [
        { id: 'door', rect: { x: 200, y: 30, w: 20, h: 40 }, buttonIds: [], switchIds: ['sw'] },
      ],
    });

  // Round 1 goes and flips it on. The winning round walks up to it, flips it off,
  // flips it on again, and only then walks out — so the switch is seen doing
  // both things, several times, on known ticks.
  const setup = [...move(5, 20), ...click];
  const win = [...move(5, 20), ...wait(1), ...click, ...click, ...move(20, 22)];

  it('flips at the same ticks in the replay as it did in play', () => {
    const r = room();
    const played = playScript(r, [setup], win);
    expect(changesIn(played, (s) => [...s.switchesOn]).size).toBe(2); // on AND off, really
    expect(changesIn(played, (s) => [...s.openDoors]).size).toBe(2);
    expectSameRoomEveryTick(r, played);
  });

  it('the fold is the same whoever runs it — a fresh replay agrees with itself', () => {
    const r = room();
    const played = playScript(r, [setup], win);
    const a = new VictoryReplay(r, played.recordings);
    const b = new VictoryReplay(r, played.recordings);
    // b reads the ticks backwards, so its cache is filled in a different order.
    for (let t = played.statesByTick.length - 1; t >= 0; t--) {
      b.tickIndex = t;
      a.tickIndex = t;
      expect(sets(b.roomState)).toEqual(sets(a.roomState));
    }
  });
});

describe('VictoryReplay — a door on a timer', () => {
  const room = (): RoomDef =>
    corridor({
      timers: [{ id: 'pad', zone: { x: 90, y: 30, w: 40, h: 40 }, openTicks: 30 }],
      doors: [
        { id: 'door', rect: { x: 200, y: 30, w: 20, h: 40 }, buttonIds: [], timerIds: ['pad'] },
      ],
    });

  // Round 1 clicks the pad on tick 5. The winning round lets that window open and
  // shut again before clicking the pad itself and running through the second one.
  const setup = [...move(5, 20), ...click];
  const win = [...wait(50), ...move(5, 20), ...click, ...move(20, 22)];

  it('counts down at the same ticks in the replay as it did in play', () => {
    const r = room();
    const played = playScript(r, [setup], win);

    const doors = played.statesByTick.map((s) => s.openDoors.has('door'));
    expect(doors.slice(0, 6).every((d) => !d)).toBe(true); // shut before anyone clicks
    expect(doors.includes(true)).toBe(true);
    // It opened, shut, and opened again — the shut stretch in the middle is the
    // thing a replay that just remembered "it was open" would get wrong.
    expect(doors.indexOf(false, doors.indexOf(true))).toBeGreaterThan(0);

    expectSameRoomEveryTick(r, played);
  });

  it('shows the same ticks left on the clock, not just open or shut', () => {
    const r = room();
    const played = playScript(r, [setup], win);
    const replay = new VictoryReplay(r, played.recordings);
    for (const state of played.statesByTick) {
      expect(replay.roomState.timersLeft.get('pad')).toBe(state.timersLeft.get('pad'));
      replay.advance();
    }
  });
});

describe('VictoryReplay — a key carried to a lock', () => {
  const room = (): RoomDef =>
    corridor({
      keys: [{ id: 'key', at: { x: 110, y: 50 } }],
      locks: [{ id: 'lock', zone: { x: 155, y: 30, w: 30, h: 40 } }],
      doors: [
        { id: 'door', rect: { x: 200, y: 30, w: 20, h: 40 }, buttonIds: [], lockIds: ['lock'] },
      ],
    });

  // Round 1 picks the key up, carries it two steps and puts it down short of the
  // lock. The winning round waits for that to happen, takes the key off the floor
  // where its past self left it, and carries it the last step onto the lock.
  const setup = [...move(5, 20), ...click, ...move(2, 20), ...click];
  const win = [...wait(10), ...move(7, 20), ...click, ...move(1, 20), ...move(20, 22)];

  it('is in the same hand, in the same place, on every tick of the replay', () => {
    const r = room();
    const played = playScript(r, [setup], win);

    const carriers = played.statesByTick.map((s) => s.keys[0].carrier);
    expect(new Set(carriers)).toEqual(new Set([null, 0, 1])); // floor, past self, winner
    expect(changesIn(played, (s) => s.keys[0].x).size).toBeGreaterThan(2);
    expect(changesIn(played, (s) => [...s.locksOpen]).size).toBe(2); // shut, then open

    expectSameRoomEveryTick(r, played);
  });

  it('a self that froze holding the key holds it in the replay too', () => {
    const r = room();
    // Same round 1, but it never puts the key down — it freezes holding it.
    const holding = [...move(5, 20), ...click, ...move(2, 20)];
    const run = new LevelRun(r, 4000, 10);
    for (const s of holding) run.tick(s);
    run.endRound();

    // Round 2 can do nothing about that, so it walks to the exit — and can't,
    // because the lock was never reached. Run it out and read the key instead.
    const statesByTick: RoomState[] = [];
    for (let i = 0; i < 60; i++) {
      statesByTick.push(run.roomState);
      run.tick({ dx: 22, dy: 0, down: false });
    }
    expect(run.won).toBe(false);

    const frozen = statesByTick[statesByTick.length - 1].keys[0];
    expect(frozen).toEqual({ id: 'key', x: 150, y: 50, carrier: 0 });

    // The same recordings read back give the same frozen key on the same ticks.
    const replay = new VictoryReplay(r, [...run.replays, run.currentRecording]);
    for (const state of statesByTick) {
      expect(sets(replay.roomState)).toEqual(sets(state));
      replay.tickIndex++;
    }
  });
});
