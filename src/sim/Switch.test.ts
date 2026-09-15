import { describe, expect, it } from 'vitest';
import type { RoomDef } from '../content/types';
import { LevelRun } from './LevelRun';
import type { TickInput } from './types';

/** A corridor with a switch at x≈110 and the door it flips at x=200. */
function switchRoom(): RoomDef {
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
    switches: [{ id: 'sw', zone: { x: 90, y: 30, w: 40, h: 40 } }],
    doors: [{ id: 'door', rect: { x: 200, y: 30, w: 20, h: 40 }, buttonIds: [], switchIds: ['sw'] }],
  };
}

const idle: TickInput = { dx: 0, dy: 0, down: false };

function walkOntoSwitch(run: LevelRun): void {
  for (let i = 0; i < 5; i++) run.tick({ dx: 20, dy: 0, down: false });
  expect(run.liveFrame.x).toBe(110);
}

/** Press and let go again: one click, of the kind a hand actually makes. */
function click(run: LevelRun): void {
  run.tick({ dx: 0, dy: 0, down: true });
  run.tick(idle);
}

describe('click switch — one click flips it, and it stays flipped', () => {
  it('starts off, with its door shut', () => {
    const run = new LevelRun(switchRoom(), 600, 5);
    expect(run.roomState.switchesOn.has('sw')).toBe(false);
    expect(run.roomState.openDoors.has('door')).toBe(false);
  });

  it('one click opens the door, and it stays open with nobody there', () => {
    const run = new LevelRun(switchRoom(), 600, 5);
    walkOntoSwitch(run);
    click(run);
    expect(run.roomState.switchesOn.has('sw')).toBe(true);

    // Walk away from it entirely — the door is still open a hundred ticks later.
    for (let i = 0; i < 100; i++) run.tick({ dx: -1, dy: 0, down: false });
    expect(run.roomState.switchesOn.has('sw')).toBe(true);
    expect(run.roomState.openDoors.has('door')).toBe(true);
  });

  it('a second click shuts it again', () => {
    const run = new LevelRun(switchRoom(), 600, 5);
    walkOntoSwitch(run);
    click(run);
    expect(run.roomState.switchesOn.has('sw')).toBe(true);
    click(run);
    expect(run.roomState.switchesOn.has('sw')).toBe(false);
    expect(run.roomState.openDoors.has('door')).toBe(false);
  });

  it('a self RESTING on it with the button down does not toggle it sixty times a second', () => {
    const run = new LevelRun(switchRoom(), 600, 5);
    walkOntoSwitch(run);
    // 200 ticks of holding the button down on the switch: one edge, one flip.
    for (let i = 0; i < 200; i++) run.tick({ dx: 0, dy: 0, down: true });
    expect(run.roomState.switchesOn.has('sw')).toBe(true);
  });

  it('clicking beside the switch does nothing to it', () => {
    const run = new LevelRun(switchRoom(), 600, 5);
    for (let i = 0; i < 8; i++) run.tick({ dx: 20, dy: 0, down: false }); // past it, at x=170
    click(run);
    expect(run.roomState.switchesOn.has('sw')).toBe(false);
  });
});

describe('click switch — your own crowd is the obstacle', () => {
  /** Round 1: walk onto the switch, click it, and stop there. */
  function roundThatFlipsIt(run: LevelRun): void {
    walkOntoSwitch(run);
    click(run);
    run.endRound();
  }

  it('a past self flips it, and the next round walks straight out', () => {
    const run = new LevelRun(switchRoom(), 600, 5);
    roundThatFlipsIt(run);
    expect(run.round).toBe(2);

    // The past self's click happens again on tick 5 of this round, and stays done.
    for (let i = 0; i < 6; i++) run.tick(idle);
    expect(run.roomState.switchesOn.has('sw')).toBe(true);

    for (let i = 0; i < 20 && !run.won; i++) run.tick({ dx: 22, dy: 0, down: false });
    expect(run.won).toBe(true);
  });

  it('a SECOND self doing the same thing flips it back, and the door shuts', () => {
    const run = new LevelRun(switchRoom(), 600, 5);
    roundThatFlipsIt(run);
    roundThatFlipsIt(run);
    expect(run.round).toBe(3);

    // Round 3: two past selves each click it on tick 5. Two clicks, no change.
    for (let i = 0; i < 10; i++) run.tick(idle);
    expect(run.roomState.switchesOn.has('sw')).toBe(false);
    expect(run.roomState.openDoors.has('door')).toBe(false);

    for (let i = 0; i < 30 && !run.won; i++) run.tick({ dx: 22, dy: 0, down: false });
    expect(run.won).toBe(false);
    expect(run.liveFrame.x).toBeLessThan(200); // stopped dead against the shut door
  });

  it('three selves clicking it leave it on again — it is the count that matters', () => {
    const run = new LevelRun(switchRoom(), 600, 6);
    roundThatFlipsIt(run);
    roundThatFlipsIt(run);
    roundThatFlipsIt(run);
    expect(run.round).toBe(4);

    for (let i = 0; i < 10; i++) run.tick(idle);
    expect(run.roomState.switchesOn.has('sw')).toBe(true);
  });

  it('two selves clicking it on the SAME tick cancel out', () => {
    const run = new LevelRun(switchRoom(), 600, 5);
    roundThatFlipsIt(run);
    roundThatFlipsIt(run);
    // Tick 5 is the one tick both recordings have the button down on.
    for (let i = 0; i < 5; i++) run.tick(idle);
    expect(run.roomState.switchesOn.has('sw')).toBe(false);
    run.tick(idle);
    expect(run.roomState.switchesOn.has('sw')).toBe(false);
  });

  it('every round starts with the switch off again', () => {
    const run = new LevelRun(switchRoom(), 600, 5);
    walkOntoSwitch(run);
    click(run);
    expect(run.roomState.switchesOn.has('sw')).toBe(true);
    run.endRound();
    expect(run.roomState.switchesOn.has('sw')).toBe(false);
  });
});
