import { describe, expect, it } from 'vitest';
import { clockTicksFor, HARDNESS } from '../content/hardness';
import type { RoomDef } from '../content/types';
import { LevelRun } from './LevelRun';
import { FAST_FORWARD_RATE, paceFrame, TICK_SECONDS } from './Pacing';
import type { Frame, TickInput } from './types';

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

function simpleRoom(): RoomDef {
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
  };
}

describe('LevelRun replay', () => {
  it('reproduces a recorded round exactly on the next round', () => {
    const run = new LevelRun(simpleRoom(), 20, 3);
    const script: TickInput[] = [];
    for (let i = 0; i < 20; i++) script.push({ dx: i % 3 === 0 ? 5 : -2, dy: i % 4 === 0 ? 1 : 0, down: i % 5 === 0 });

    const recorded = script.map((input) => {
      const report = run.tick(input);
      expect(report.won).toBe(false);
      return report.frame;
    });

    expect(run.round).toBe(2);
    expect(run.replays).toHaveLength(1);
    expect(run.replays[0]).toEqual(recorded);
  });

  // Updated for the growing clock: round 2 now runs two steps (10 ticks), not 5.
  it('resets to round 1 with no past selves after the round limit is exceeded', () => {
    const run = new LevelRun(simpleRoom(), 5, 2);
    for (let i = 0; i < 5; i++) run.tick({ dx: 0, dy: 0, down: false });
    expect(run.round).toBe(2);
    expect(run.replays).toHaveLength(1);

    let last = { won: false, ranOutOfRounds: false, roundOver: false };
    for (let i = 0; i < 10; i++) last = run.tick({ dx: 0, dy: 0, down: false });
    expect(last.ranOutOfRounds).toBe(true);
    expect(run.round).toBe(1);
    expect(run.replays).toHaveLength(0);
  });
});

describe('LevelRun clock — each round runs one step longer than the one before', () => {
  it('run.clockTicks reads as a plain property and is the CURRENT round', () => {
    const run = new LevelRun(simpleRoom(), 5, 10);
    expect(run.clockTicks).toBe(5);
    for (let i = 0; i < 5; i++) run.tick({ dx: 0, dy: 0, down: false });
    expect(run.round).toBe(2);
    expect(run.clockTicks).toBe(10);
  });

  for (const hardness of Object.values(HARDNESS)) {
    it(`${hardness.id}: round N lasts N × ${hardness.clockStepSeconds}s of ticks`, () => {
      const step = clockTicksFor(hardness);
      const run = new LevelRun(simpleRoom(), step, 5);

      for (let round = 1; round <= 4; round++) {
        expect(run.round).toBe(round);
        expect(run.clockTicks).toBe(clockTicksFor(hardness, round));

        let ticks = 0;
        let last = { roundOver: false };
        while (!last.roundOver) {
          last = run.tick({ dx: 0, dy: 0, down: false });
          ticks++;
        }
        expect(ticks).toBe(round * step);
        expect(run.replays[round - 1]).toHaveLength(round * step);
      }
    });
  }

  it('elapsed time adds up the different round lengths, not one fixed clock', () => {
    const run = new LevelRun(simpleRoom(), 60, 5); // 1s steps
    for (let i = 0; i < 60; i++) run.tick({ dx: 0, dy: 0, down: false }); // round 1: 1s
    for (let i = 0; i < 120; i++) run.tick({ dx: 0, dy: 0, down: false }); // round 2: 2s
    for (let i = 0; i < 30; i++) run.tick({ dx: 0, dy: 0, down: false }); // half into round 3
    expect(run.elapsedSeconds()).toBeCloseTo(3.5);
  });
});

describe('LevelRun — a short early round left behind as a doorstop', () => {
  const idle: TickInput = { dx: 0, dy: 0, down: false };

  function playRound(run: LevelRun, input: (tick: number) => TickInput) {
    let tick = 0;
    let last = { roundOver: false, won: false };
    while (!last.roundOver && !run.won) last = run.tick(input(tick++));
    return last;
  }

  it('round 1 holds the button to the end, and still holds it deep into round 2', () => {
    const run = new LevelRun(doorRoom(), 30, 4); // round 1 = 30 ticks, round 2 = 60
    // Round 1: 5 ticks to reach the button at x=110, then hold until the clock runs out.
    playRound(run, (t) => ({ dx: t < 5 ? 20 : 0, dy: 0, down: t >= 5 }));
    expect(run.round).toBe(2);

    const recording = run.replays[0];
    expect(recording).toHaveLength(30);
    expect(recording[29].down).toBe(true);

    // Round 2: wait past tick 30 — where the recording ends — then walk through the door.
    for (let i = 0; i < 40; i++) run.tick(idle);
    expect(run.won).toBe(false);
    for (let i = 0; i < 15 && !run.won; i++) run.tick({ dx: 22, dy: 0, down: false });

    expect(run.won).toBe(true);
  });

  it('a round 1 that let go of the button does NOT keep the door open in round 2', () => {
    const run = new LevelRun(doorRoom(), 30, 4);
    // Same walk to the button, but the button is released before the clock runs out.
    playRound(run, (t) => ({ dx: t < 5 ? 20 : 0, dy: 0, down: t >= 5 && t < 20 }));
    expect(run.replays[0][29].down).toBe(false);

    for (let i = 0; i < 40; i++) run.tick(idle);
    for (let i = 0; i < 15 && !run.won; i++) run.tick({ dx: 22, dy: 0, down: false });

    expect(run.won).toBe(false);
    expect(run.liveFrame.x).toBeLessThan(200);
  });
});

// ---------------------------------------------------------------------------
// Ending a round early — the clock is a ceiling, not a duration.
// ---------------------------------------------------------------------------

const idleInput: TickInput = { dx: 0, dy: 0, down: false };

describe('LevelRun — the player says when a round is over', () => {
  it('stops the recording at the tick the player ended on', () => {
    const run = new LevelRun(simpleRoom(), 60, 5); // the clock would have allowed 60
    for (let i = 0; i < 12; i++) run.tick({ dx: 3, dy: 0, down: false });

    const report = run.endRound();

    expect(report.roundOver).toBe(true);
    expect(report.ranOutOfRounds).toBe(false);
    expect(run.replays).toHaveLength(1);
    expect(run.replays[0]).toHaveLength(12); // not 60
    expect(run.round).toBe(2);
    expect(run.tickIndex).toBe(0);
  });

  it('still lets the clock end a round nobody ended sooner', () => {
    const run = new LevelRun(simpleRoom(), 30, 5);
    let last = { roundOver: false };
    let ticks = 0;
    while (!last.roundOver) {
      last = run.tick(idleInput);
      ticks++;
    }
    expect(ticks).toBe(30);
    expect(run.replays[0]).toHaveLength(30);
  });

  it('ending early on the last round still runs the player out of rounds', () => {
    const run = new LevelRun(simpleRoom(), 30, 2);
    run.tick(idleInput);
    run.endRound();
    expect(run.round).toBe(2);

    run.tick(idleInput);
    const report = run.endRound();
    expect(report.ranOutOfRounds).toBe(true);
    expect(run.round).toBe(1);
    expect(run.replays).toHaveLength(0);
  });

  it('a self that ended early while holding the button goes on holding it', () => {
    const run = new LevelRun(doorRoom(), 60, 4);
    // Round 1: 5 ticks to the button at x=110, hold for 3 more, then done — 8 of 60.
    for (let t = 0; t < 8; t++) run.tick({ dx: t < 5 ? 20 : 0, dy: 0, down: t >= 5 });
    run.endRound();

    expect(run.replays[0]).toHaveLength(8);
    expect(run.replays[0][7].down).toBe(true);
    expect(run.round).toBe(2);

    // Round 2: wait long past the end of that 8-tick recording, then walk through.
    for (let i = 0; i < 40; i++) run.tick(idleInput);
    expect(run.roomState.heldButtons.has('btn')).toBe(true);
    for (let i = 0; i < 15 && !run.won; i++) run.tick({ dx: 22, dy: 0, down: false });

    expect(run.won).toBe(true);
  });
});

describe('LevelRun score — the time you actually spent', () => {
  it('counts ticks run, not clocks handed out', () => {
    const run = new LevelRun(simpleRoom(), 60, 5);
    for (let i = 0; i < 20; i++) run.tick(idleInput); // round 1: 20 of 60 ticks
    run.endRound();
    for (let i = 0; i < 45; i++) run.tick(idleInput); // round 2: 45 of 120 so far

    expect(run.elapsedTicks).toBe(65);
    expect(run.elapsedSeconds()).toBeCloseTo(65 / 60);
  });

  it('ending rounds early gives a better time than sitting out the clock', () => {
    const play = (endEarlyAfter: number | null): LevelRun => {
      const run = new LevelRun(simpleRoom(), 60, 5);
      for (let round = 0; round < 2; round++) {
        if (endEarlyAfter === null) {
          let last = { roundOver: false };
          while (!last.roundOver) last = run.tick(idleInput);
        } else {
          for (let i = 0; i < endEarlyAfter; i++) run.tick(idleInput);
          run.endRound();
        }
      }
      return run;
    };

    const patient = play(null); // 60 + 120 ticks of standing about
    const brisk = play(15); // 15 + 15

    expect(patient.elapsedTicks).toBe(180);
    expect(brisk.elapsedTicks).toBe(30);
    expect(brisk.elapsedSeconds()).toBeLessThan(patient.elapsedSeconds());
  });
});

// ---------------------------------------------------------------------------
// Fast-forward. The sim has no clock of its own, so hurrying can only change how
// many ticks an animation frame dispatches — never what a tick is.
// ---------------------------------------------------------------------------

interface MouseReading {
  dx: number;
  dy: number;
  down: boolean;
}

/** main.ts's loop arithmetic with no DOM: real animation frames in, sim ticks out. */
function driveFrames(run: LevelRun, mouse: MouseReading[], rate: number): void {
  let carry = 0;
  for (const raw of mouse) {
    const paced = paceFrame(carry, TICK_SECONDS, rate);
    carry = paced.carry;
    if (paced.ticks === 0) continue;
    // One mouse reading spreads over a NORMAL frame's ticks, so a tick of input
    // means the same thing hurrying or not.
    const dx = raw.dx / paced.baseTicks;
    const dy = raw.dy / paced.baseTicks;
    for (let i = 0; i < paced.ticks; i++) run.tick({ dx, dy, down: raw.down });
  }
}

function parked(frames: number): MouseReading[] {
  return Array.from({ length: frames }, () => ({ dx: 0, dy: 0, down: true }));
}

describe('fast-forward — the same ticks, in less real time', () => {
  it('records a round byte for byte the same as normal speed', () => {
    // The real use: parked on a button, waiting for a past self. 300 ticks of it.
    const normal = new LevelRun(doorRoom(), 300, 4);
    driveFrames(normal, parked(300), 1);

    const hurried = new LevelRun(doorRoom(), 300, 4);
    driveFrames(hurried, parked(300 / FAST_FORWARD_RATE), FAST_FORWARD_RATE);

    expect(normal.round).toBe(2);
    expect(hurried.round).toBe(2);
    expect(JSON.stringify(hurried.replays)).toBe(JSON.stringify(normal.replays));
    expect(hurried.elapsedTicks).toBe(normal.elapsedTicks);
  });

  it('gets through the round in a third of the animation frames', () => {
    const framesToFinish = (rate: number): number => {
      const run = new LevelRun(simpleRoom(), 300, 4);
      let frames = 0;
      while (run.round === 1) {
        driveFrames(run, parked(1), rate);
        frames++;
      }
      return frames;
    };
    expect(framesToFinish(1)).toBe(300);
    expect(framesToFinish(FAST_FORWARD_RATE)).toBe(100);
  });

  it('leaves the recording alone however the ticks are grouped into frames', () => {
    // A moving, clicking script, dispatched one tick per frame and three per frame.
    const script: TickInput[] = [];
    for (let i = 0; i < 90; i++) {
      script.push({ dx: i % 3 === 0 ? 7 : -2, dy: i % 5 === 0 ? 4 : -1, down: i % 7 === 0 });
    }
    const recordFor = (perFrame: number): Frame[][] => {
      const run = new LevelRun(doorRoom(), 30, 5);
      for (let i = 0; i < script.length; i += perFrame) {
        for (const input of script.slice(i, i + perFrame)) run.tick(input);
      }
      return run.replays;
    };

    expect(JSON.stringify(recordFor(FAST_FORWARD_RATE))).toBe(JSON.stringify(recordFor(1)));
  });
});
