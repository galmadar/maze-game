import { describe, expect, it } from 'vitest';
import { TIMER_OPEN_TICKS } from '../content/hardness';
import type { RoomDef } from '../content/types';
import { LevelRun } from './LevelRun';
import type { TickInput } from './types';

/** A corridor with a timer pad at x≈110 and the door it opens at x=200. */
function timerRoom(openTicks?: number): RoomDef {
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
    timers: [
      { id: 'pad', zone: { x: 90, y: 30, w: 40, h: 40 }, ...(openTicks ? { openTicks } : {}) },
    ],
    doors: [{ id: 'door', rect: { x: 200, y: 30, w: 20, h: 40 }, buttonIds: [], timerIds: ['pad'] }],
  };
}

const idle: TickInput = { dx: 0, dy: 0, down: false };

function walkOntoPad(run: LevelRun): void {
  for (let i = 0; i < 5; i++) run.tick({ dx: 20, dy: 0, down: false });
  expect(run.liveFrame.x).toBe(110);
}

function click(run: LevelRun): void {
  run.tick({ dx: 0, dy: 0, down: true });
  run.tick(idle);
}

/** How many ticks in a row the door stays open from here, standing still. */
function tickUntilItShuts(run: LevelRun, limit = 2000): number {
  let open = 0;
  for (let i = 0; i < limit; i++) {
    if (!run.roomState.openDoors.has('door')) return open;
    open++;
    run.tick(idle);
  }
  throw new Error('the timer door never shut');
}

describe('timer door — a click buys a few seconds of open door', () => {
  it('is shut until someone clicks the pad', () => {
    const run = new LevelRun(timerRoom(), 2000, 5);
    walkOntoPad(run);
    for (let i = 0; i < 30; i++) run.tick(idle);
    expect(run.roomState.openDoors.has('door')).toBe(false);
  });

  it('opens on the click, and shuts again after its time is up', () => {
    const run = new LevelRun(timerRoom(30), 2000, 5);
    walkOntoPad(run);
    click(run);
    expect(run.roomState.openDoors.has('door')).toBe(true);
    expect(run.roomState.timersLeft.get('pad')).toBe(29); // one tick of it already spent

    expect(tickUntilItShuts(run)).toBe(29);
    expect(run.roomState.timersLeft.has('pad')).toBe(false);
  });

  it('uses the tuning number from the config when the room does not say otherwise', () => {
    const run = new LevelRun(timerRoom(), 4000, 5);
    walkOntoPad(run);
    run.tick({ dx: 0, dy: 0, down: true });
    expect(run.roomState.timersLeft.get('pad')).toBe(TIMER_OPEN_TICKS);
  });

  it('RESTARTS on a second click rather than stacking two lots of time onto one', () => {
    const run = new LevelRun(timerRoom(30), 2000, 5);
    walkOntoPad(run);
    click(run);
    for (let i = 0; i < 10; i++) run.tick(idle); // 10 of the 30 ticks gone
    expect(run.roomState.timersLeft.get('pad')).toBe(19);

    click(run);
    expect(run.roomState.timersLeft.get('pad')).toBe(29);
    // 29 more, not 19 + 30: the clock went back to full, it did not add up.
    expect(tickUntilItShuts(run)).toBe(29);
  });

  it('a self PARKED on the pad with the button down does not hold it open for ever', () => {
    const run = new LevelRun(timerRoom(30), 2000, 5);
    walkOntoPad(run);
    for (let i = 0; i < 200; i++) run.tick({ dx: 0, dy: 0, down: true });
    // One press, one window, and it closed long ago — this is not a hold button.
    expect(run.roomState.openDoors.has('door')).toBe(false);
  });

  it('every round starts with the timer dark again', () => {
    const run = new LevelRun(timerRoom(30), 2000, 5);
    walkOntoPad(run);
    click(run);
    expect(run.roomState.openDoors.has('door')).toBe(true);
    run.endRound();
    expect(run.roomState.openDoors.has('door')).toBe(false);
  });
});

describe('timer door — the relay it is for', () => {
  it('one self clicks while another, already at the door, goes through', () => {
    const run = new LevelRun(timerRoom(30), 2000, 5);

    // Round 1: walk to the pad and click it on tick 5. That click happens again,
    // on the same tick, in every later round.
    walkOntoPad(run);
    click(run);
    run.endRound();
    expect(run.round).toBe(2);

    // Round 2: this self is waiting right at the door when the past self clicks.
    for (let i = 0; i < 9; i++) run.tick({ dx: 21, dy: 0, down: false });
    expect(run.liveFrame.x).toBeGreaterThan(180);
    expect(run.roomState.openDoors.has('door')).toBe(true);
    for (let i = 0; i < 10 && !run.won; i++) run.tick({ dx: 22, dy: 0, down: false });
    expect(run.won).toBe(true);
  });

  it('a self that dawdles finds the door shut again', () => {
    const run = new LevelRun(timerRoom(30), 2000, 5);
    walkOntoPad(run);
    click(run);
    run.endRound();

    // Round 2: waits out the window before setting off.
    for (let i = 0; i < 60; i++) run.tick(idle);
    expect(run.roomState.openDoors.has('door')).toBe(false);
    for (let i = 0; i < 30 && !run.won; i++) run.tick({ dx: 22, dy: 0, down: false });
    expect(run.won).toBe(false);
    expect(run.liveFrame.x).toBeLessThan(200);
  });
});
