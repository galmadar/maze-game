import { describe, expect, it } from 'vitest';
import type { RoomDef } from '../content/types';
import { hitsLitLaser, laserLit } from './Lasers';
import { LevelRun } from './LevelRun';
import { VictoryReplay } from './VictoryReplay';

// An open floor with one upright beam at x=200: lit for 10 ticks, dark for 10.
function room(): RoomDef {
  return {
    width: 400,
    height: 100,
    spawn: { x: 40, y: 50 },
    exit: { x: 360, y: 30, w: 30, h: 40 },
    walls: [],
    buttons: [],
    plates: [],
    doors: [],
    lasers: [{ id: 'beam', rect: { x: 197, y: 0, w: 6, h: 100 }, onTicks: 10, offTicks: 10 }],
  };
}

describe('a laser', () => {
  it('blinks on its own rhythm, shifted by its phase', () => {
    const beam = room().lasers![0];
    expect([0, 9, 10, 19, 20].map((t) => laserLit(beam, t))).toEqual([true, true, false, false, true]);
    const late = { ...beam, phase: 10 };
    expect([0, 10].map((t) => laserLit(late, t))).toEqual([false, true]);
  });

  it('catches a fast arrow that would jump clean over the beam in one tick', () => {
    expect(hitsLitLaser(room(), 0, { x: 150, y: 50 }, { x: 250, y: 50 })).toBe(true);
    expect(hitsLitLaser(room(), 10, { x: 150, y: 50 }, { x: 250, y: 50 })).toBe(false);
  });

  it('sends the live arrow back to the start when it walks into a lit beam', () => {
    const run = new LevelRun(room(), 600, 3);
    let report = run.tick({ dx: 0, dy: 0, down: false });
    for (let i = 0; i < 20 && !report.zapped; i++) report = run.tick({ dx: 20, dy: 0, down: false });
    expect(report.zapped).toBe(true);
    expect(run.liveFrame).toMatchObject(run.room.spawn);
  });

  it('burns an arrow standing still in the beam the moment it lights', () => {
    const run = new LevelRun(room(), 600, 3);
    for (let i = 0; i < 10; i++) run.tick({ dx: 0, dy: 0, down: false }); // wait out the first light
    run.tick({ dx: 80, dy: 0, down: false });
    run.tick({ dx: 80, dy: 0, down: false }); // now standing on the beam, still dark
    expect(run.liveFrame.x).toBe(200);
    let zapped = false;
    for (let i = 0; i < 10 && !zapped; i++) zapped = run.tick({ dx: 0, dy: 0, down: false }).zapped ?? false;
    expect(zapped).toBe(true);
  });

  it('lets you straight through while it is dark, and the replay shows the same beams', () => {
    const run = new LevelRun(room(), 600, 3);
    for (let i = 0; i < 10; i++) run.tick({ dx: 0, dy: 0, down: false });
    for (let i = 0; i < 20 && !run.won; i++) run.tick({ dx: 80, dy: 0, down: false });
    expect(run.won).toBe(true);

    const replay = new VictoryReplay(run.room, [run.currentRecording]);
    for (let t = 0; t < 12; t++) {
      expect(replay.roomState.lasersLit.has('beam')).toBe(laserLit(run.room.lasers![0], t - 1));
      replay.advance();
    }
  });
});
