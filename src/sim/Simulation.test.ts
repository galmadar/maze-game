import { describe, expect, it } from 'vitest';
import type { RoomDef } from '../content/types';
import { stepTick } from './Simulation';
import type { Frame } from './types';

function room(): RoomDef {
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

describe('stepTick — hold button / door', () => {
  it('door is closed by default', () => {
    const r = room();
    const live: Frame = { x: 10, y: 50, down: false };
    const { doorsOpen } = stepTick(r, live, [], 0, { dx: 0, dy: 0, down: false }, r.spawn);
    expect(doorsOpen.has('door')).toBe(false);
  });

  it('door opens only while a past self is holding the button, based on its previous tick', () => {
    const r = room();
    const live: Frame = { x: 10, y: 50, down: false };
    const holding: Frame = { x: 110, y: 50, down: true };
    const released: Frame = { x: 110, y: 50, down: false };

    // tickIndex 1 reads the replay's frame at index 0 (its previous tick).
    const opened = stepTick(r, live, [[holding, released]], 1, { dx: 0, dy: 0, down: false }, r.spawn);
    expect(opened.doorsOpen.has('door')).toBe(true);

    const closed = stepTick(r, live, [[released, holding]], 1, { dx: 0, dy: 0, down: false }, r.spawn);
    expect(closed.doorsOpen.has('door')).toBe(false);
  });

  it('closed door blocks the live arrow from crossing it', () => {
    const r = room();
    const live: Frame = { x: 190, y: 50, down: false };
    const { liveFrame } = stepTick(r, live, [], 0, { dx: 40, dy: 0, down: false }, r.spawn);
    expect(liveFrame.x).toBeLessThan(200);
  });
});

describe('stepTick — past self past the end of its recording', () => {
  const holding: Frame = { x: 110, y: 50, down: true };
  const idle = { dx: 0, dy: 0, down: false };

  it('a self that ended holding the button keeps the door open, round after round', () => {
    const r = room();
    const live: Frame = { x: 10, y: 50, down: false };
    const shortRecording = [holding, holding]; // only two ticks long

    for (const tickIndex of [2, 3, 60, 1000]) {
      const { doorsOpen } = stepTick(r, live, [shortRecording], tickIndex, idle, r.spawn);
      expect(doorsOpen.has('door')).toBe(true);
    }
  });

  it('a self that let go before its recording ended leaves the door shut', () => {
    const r = room();
    const live: Frame = { x: 10, y: 50, down: false };
    const released = [holding, { x: 110, y: 50, down: false }];

    const { doorsOpen } = stepTick(r, live, [released], 60, idle, r.spawn);
    expect(doorsOpen.has('door')).toBe(false);
  });

  it('the live arrow can walk through a door held open by a frozen past self', () => {
    const r = room();
    const live: Frame = { x: 190, y: 50, down: false };
    const { liveFrame } = stepTick(r, live, [[holding]], 500, { dx: 22, dy: 0, down: false }, r.spawn);
    expect(liveFrame.x).toBeGreaterThan(200);
  });
});
