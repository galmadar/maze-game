import { describe, expect, it } from 'vitest';
import type { RoomDef } from '../content/types';
import { LevelRun } from './LevelRun';
import type { TickInput } from './types';

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

  it('resets to round 1 with no past selves after the round limit is exceeded', () => {
    const run = new LevelRun(simpleRoom(), 5, 2);
    for (let i = 0; i < 5; i++) run.tick({ dx: 0, dy: 0, down: false });
    expect(run.round).toBe(2);
    expect(run.replays).toHaveLength(1);

    let last = { won: false, ranOutOfRounds: false, roundOver: false };
    for (let i = 0; i < 5; i++) last = run.tick({ dx: 0, dy: 0, down: false });
    expect(last.ranOutOfRounds).toBe(true);
    expect(run.round).toBe(1);
    expect(run.replays).toHaveLength(0);
  });
});
