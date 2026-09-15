import { describe, expect, it } from 'vitest';
import type { RoomDef } from '../content/types';
import { LevelRun } from './LevelRun';
import type { TickInput } from './types';

/**
 * A corridor with a key lying at x=110, a lock at x=155..185, and the door the
 * lock opens at x=200. The way out is past the door.
 */
function keyRoom(): RoomDef {
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
    keys: [{ id: 'key', at: { x: 110, y: 50 } }],
    locks: [{ id: 'lock', zone: { x: 155, y: 30, w: 30, h: 40 } }],
    doors: [{ id: 'door', rect: { x: 200, y: 30, w: 20, h: 40 }, buttonIds: [], lockIds: ['lock'] }],
  };
}

const idle: TickInput = { dx: 0, dy: 0, down: false };

function theKey(run: LevelRun) {
  const k = run.roomState.keys.find((s) => s.id === 'key');
  if (!k) throw new Error('no key in the room');
  return k;
}

function walkOntoKey(run: LevelRun): void {
  for (let i = 0; i < 5; i++) run.tick({ dx: 20, dy: 0, down: false });
  expect(run.liveFrame.x).toBe(110);
}

function click(run: LevelRun): void {
  run.tick({ dx: 0, dy: 0, down: true });
  run.tick(idle);
}

describe('key — click to pick it up, click to put it down', () => {
  it('starts on the floor where the room put it, carried by nobody', () => {
    const run = new LevelRun(keyRoom(), 2000, 5);
    expect(theKey(run)).toEqual({ id: 'key', x: 110, y: 50, carrier: null });
  });

  it('is picked up by a click on it', () => {
    const run = new LevelRun(keyRoom(), 2000, 5);
    walkOntoKey(run);
    click(run);
    expect(theKey(run).carrier).toBe(0); // the only self in round 1
  });

  it('is not picked up by a click nowhere near it', () => {
    const run = new LevelRun(keyRoom(), 2000, 5);
    for (let i = 0; i < 3; i++) run.tick({ dx: 20, dy: 0, down: false }); // x=70, well short
    click(run);
    expect(theKey(run).carrier).toBe(null);
    expect(theKey(run).x).toBe(110);
  });

  it('follows its carrier, tick for tick', () => {
    const run = new LevelRun(keyRoom(), 2000, 5);
    walkOntoKey(run);
    click(run);
    for (const x of [130, 150, 170]) {
      run.tick({ dx: 20, dy: 0, down: false });
      expect(run.liveFrame.x).toBe(x);
      expect(theKey(run).x).toBe(x);
    }
  });

  it('is put down where it was put down, and stays there', () => {
    const run = new LevelRun(keyRoom(), 2000, 5);
    walkOntoKey(run);
    click(run);
    run.tick({ dx: 20, dy: 0, down: false }); // carried to x=130
    click(run); // and dropped there

    expect(theKey(run)).toEqual({ id: 'key', x: 130, y: 50, carrier: null });
    for (let i = 0; i < 20; i++) run.tick({ dx: 3, dy: 0, down: false });
    expect(theKey(run).x).toBe(130); // the arrow walked on; the key did not
  });

  it('is not snatched straight back up by the same click that dropped it', () => {
    const run = new LevelRun(keyRoom(), 2000, 5);
    walkOntoKey(run);
    click(run);
    run.tick({ dx: 0, dy: 0, down: true }); // the drop
    expect(theKey(run).carrier).toBe(null);
    run.tick(idle);
    expect(theKey(run).carrier).toBe(null);
  });
});

describe('key — carrying it onto the lock opens the door for good', () => {
  it('opens the lock the moment the key reaches it, and it never shuts again', () => {
    const run = new LevelRun(keyRoom(), 2000, 5);
    walkOntoKey(run);
    click(run);
    expect(run.roomState.locksOpen.has('lock')).toBe(false);

    for (let i = 0; i < 3; i++) run.tick({ dx: 20, dy: 0, down: false }); // key to x=170
    expect(run.roomState.locksOpen.has('lock')).toBe(true);
    expect(run.roomState.openDoors.has('door')).toBe(true);

    // Carry it away again: the lock has already been opened, and stays open.
    click(run); // drop it
    for (let i = 0; i < 40; i++) run.tick({ dx: -10, dy: 0, down: false });
    expect(run.roomState.locksOpen.has('lock')).toBe(true);
    expect(run.roomState.openDoors.has('door')).toBe(true);
  });

  it('a key left lying on the lock opens it just the same', () => {
    const run = new LevelRun(keyRoom(), 2000, 5);
    walkOntoKey(run);
    click(run);
    for (let i = 0; i < 3; i++) run.tick({ dx: 20, dy: 0, down: false });
    click(run); // put down on the lock, and walk off
    expect(theKey(run).carrier).toBe(null);
    for (let i = 0; i < 40; i++) run.tick({ dx: -10, dy: 0, down: false });
    expect(run.roomState.locksOpen.has('lock')).toBe(true);
  });

  it('the whole job in one round: take it, carry it, walk out', () => {
    const run = new LevelRun(keyRoom(), 2000, 5);
    walkOntoKey(run);
    click(run);
    for (let i = 0; i < 3; i++) run.tick({ dx: 20, dy: 0, down: false });
    for (let i = 0; i < 20 && !run.won; i++) run.tick({ dx: 22, dy: 0, down: false });
    expect(run.won).toBe(true);
  });

  it('every round puts the key back where it was lying, and shuts the lock', () => {
    const run = new LevelRun(keyRoom(), 2000, 5);
    walkOntoKey(run);
    click(run);
    for (let i = 0; i < 3; i++) run.tick({ dx: 20, dy: 0, down: false });
    expect(run.roomState.locksOpen.has('lock')).toBe(true);

    run.endRound();
    expect(theKey(run)).toEqual({ id: 'key', x: 110, y: 50, carrier: null });
    expect(run.roomState.locksOpen.has('lock')).toBe(false);
  });
});

describe('key — a past self carrying it walks it round the room on its own', () => {
  /** Round 1: pick the key up on tick 5 and carry it two steps, to x=150. */
  function roundThatCarriesIt(run: LevelRun): void {
    walkOntoKey(run);
    click(run); // ticks 5 and 6
    run.tick({ dx: 20, dy: 0, down: false }); // tick 7, key to 130
    run.tick({ dx: 20, dy: 0, down: false }); // tick 8, key to 150
    run.endRound();
  }

  it('the key moves with nobody living touching it', () => {
    const run = new LevelRun(keyRoom(), 2000, 5);
    roundThatCarriesIt(run);
    expect(run.round).toBe(2);

    // This round the live arrow never moves and never clicks. The key still goes.
    const seen: number[] = [];
    for (let i = 0; i < 12; i++) {
      run.tick(idle);
      seen.push(theKey(run).x);
    }
    // Tick 5 is the pick-up; ticks 7 and 8 carry it; after that its carrier froze.
    expect(seen).toEqual([110, 110, 110, 110, 110, 110, 110, 130, 150, 150, 150, 150]);
    expect(theKey(run).carrier).toBe(0); // still the round-1 self, not the live one
  });

  it('a self that FROZE holding the key holds it there for the rest of the round', () => {
    const run = new LevelRun(keyRoom(), 2000, 5);
    roundThatCarriesIt(run);
    for (let i = 0; i < 900; i++) run.tick(idle);
    expect(theKey(run)).toEqual({ id: 'key', x: 150, y: 50, carrier: 0 });
  });

  it('and nobody can take it off them — a frozen hand is still a full hand', () => {
    const run = new LevelRun(keyRoom(), 2000, 5);
    roundThatCarriesIt(run);
    for (let i = 0; i < 100; i++) run.tick(idle);
    // Walk the live arrow right up to the frozen self and click on the key.
    for (let i = 0; i < 7; i++) run.tick({ dx: 21, dy: 0, down: false });
    expect(run.liveFrame.x).toBe(157); // right on top of the frozen self and its key
    click(run);
    expect(theKey(run).carrier).toBe(0);
  });

  it('two past selves each carrying one key do not fight over it', () => {
    const run = new LevelRun(keyRoom(), 2000, 6);
    roundThatCarriesIt(run);
    roundThatCarriesIt(run);
    // Both click on tick 5, both in reach. The earlier round takes it; the other
    // walks on empty-handed, and the key goes exactly where the first self went.
    for (let i = 0; i < 12; i++) run.tick(idle);
    expect(theKey(run)).toEqual({ id: 'key', x: 150, y: 50, carrier: 0 });
  });
});
