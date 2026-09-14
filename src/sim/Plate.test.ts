import { describe, expect, it } from 'vitest';
import type { RoomDef } from '../content/types';
import { LevelRun } from './LevelRun';
import { roomStateFor, stepTick } from './Simulation';
import type { Frame, TickInput } from './types';

/** A corridor with a weight plate at x≈110 and the door it opens at x=200. */
function plateRoom(needs = 2): RoomDef {
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
    plates: [{ id: 'plate', zone: { x: 90, y: 30, w: 40, h: 40 }, needs }],
    doors: [{ id: 'door', rect: { x: 200, y: 30, w: 20, h: 40 }, buttonIds: [], plateIds: ['plate'] }],
  };
}

const onPlate = (down = false): Frame => ({ x: 110, y: 50, down });
const offPlate = (down = false): Frame => ({ x: 160, y: 50, down });
const idle: TickInput = { dx: 0, dy: 0, down: false };

describe('weight plate — it takes a crowd, not a hero', () => {
  it('a plate needing 2 stays shut with one arrow on it', () => {
    const room = plateRoom(2);
    const state = roomStateFor(room, [onPlate()]);
    expect(state.satisfiedPlates.has('plate')).toBe(false);
    expect(state.openDoors.has('door')).toBe(false);
  });

  it('a plate needing 2 opens with two arrows on it', () => {
    const room = plateRoom(2);
    const state = roomStateFor(room, [onPlate(), onPlate()]);
    expect(state.satisfiedPlates.has('plate')).toBe(true);
    expect(state.openDoors.has('door')).toBe(true);
  });

  it('nobody has to hold the mouse button — standing on it is enough', () => {
    const room = plateRoom(2);
    expect(roomStateFor(room, [onPlate(false), onPlate(false)]).openDoors.has('door')).toBe(true);
  });

  it('a plate needing 3 is not fooled by two', () => {
    const room = plateRoom(3);
    expect(roomStateFor(room, [onPlate(), onPlate()]).openDoors.has('door')).toBe(false);
    expect(roomStateFor(room, [onPlate(), onPlate(), onPlate()]).openDoors.has('door')).toBe(true);
  });

  it('an arrow standing beside the plate does not count', () => {
    const room = plateRoom(2);
    expect(roomStateFor(room, [onPlate(), offPlate()]).openDoors.has('door')).toBe(false);
  });

  it('a door can list both a button and a plate, and opens either way', () => {
    const room = plateRoom(2);
    room.buttons = [{ id: 'btn', zone: { x: 40, y: 30, w: 30, h: 40 } }];
    room.doors = [
      { id: 'door', rect: { x: 200, y: 30, w: 20, h: 40 }, buttonIds: ['btn'], plateIds: ['plate'] },
    ];
    const held: Frame = { x: 55, y: 50, down: true };

    expect(roomStateFor(room, [held]).openDoors.has('door')).toBe(true);
    expect(roomStateFor(room, [onPlate(), onPlate()]).openDoors.has('door')).toBe(true);
    expect(roomStateFor(room, [offPlate()]).openDoors.has('door')).toBe(false);
  });
});

describe('weight plate — past selves count, frozen ones included', () => {
  it('a past self whose recording ran out goes on weighing the plate down', () => {
    const room = plateRoom(2);
    const live = onPlate();
    const oneTickLong = [onPlate()]; // a very short early round, ended on the plate

    for (const tickIndex of [1, 2, 60, 5000]) {
      const { doorsOpen } = stepTick(room, live, [oneTickLong], tickIndex, idle, room.spawn);
      expect(doorsOpen.has('door')).toBe(true);
    }
  });

  it('two frozen past selves hold it down with nobody else there', () => {
    const room = plateRoom(2);
    const away: Frame = { x: 10, y: 50, down: false };
    const frozen = [[onPlate()], [onPlate()]];
    const { doorsOpen } = stepTick(room, away, frozen, 900, idle, room.spawn);
    expect(doorsOpen.has('door')).toBe(true);
  });

  it('a past self that walked off the plate before its round ended does not count', () => {
    const room = plateRoom(2);
    const walkedOff = [onPlate(), offPlate()];
    const { doorsOpen } = stepTick(room, onPlate(), [walkedOff], 400, idle, room.spawn);
    expect(doorsOpen.has('door')).toBe(false);
  });
});

describe('weight plate — a whole level run, the way it is actually played', () => {
  function moveTicks(run: LevelRun, dx: number, ticks: number): void {
    for (let i = 0; i < ticks; i++) run.tick({ dx, dy: 0, down: false });
  }

  function restOfRound(run: LevelRun): void {
    let over = false;
    while (!over && !run.won) over = run.tick(idle).roundOver;
  }

  it('one stands, one joins, one walks out — and stepping off shuts the door again', () => {
    const run = new LevelRun(plateRoom(2), 30, 3); // rounds of 30, 60, 90 ticks

    // Round 1: walk onto the plate and stay there, so it freezes on the plate.
    moveTicks(run, 20, 5);
    expect(run.liveFrame.x).toBe(110);
    restOfRound(run);
    expect(run.round).toBe(2);

    // Round 2: joining the past self opens the door...
    moveTicks(run, 20, 5);
    expect(run.roomState.satisfiedPlates.has('plate')).toBe(true);
    expect(run.roomState.openDoors.has('door')).toBe(true);

    // ...but the moment this arrow steps off to use it, the plate is one short.
    moveTicks(run, 22, 10);
    expect(run.roomState.openDoors.has('door')).toBe(false);
    expect(run.liveFrame.x).toBe(190); // stopped dead against the closed door
    expect(run.won).toBe(false);

    // So it goes back and stands on the plate too.
    moveTicks(run, -20, 4);
    expect(run.liveFrame.x).toBe(110);
    restOfRound(run);
    expect(run.round).toBe(3);

    // Round 3: two frozen selves on the plate, so this one can walk straight out.
    for (let i = 0; i < 90 && !run.won; i++) run.tick({ dx: 22, dy: 0, down: false });
    expect(run.won).toBe(true);
  });
});
