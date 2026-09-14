import { describe, expect, it } from 'vitest';
import { clockTicksFor, HARDNESS } from '../content/hardness';
import type { RoomDef } from '../content/types';
import { LevelRun } from './LevelRun';
import type { TickInput } from './types';

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
