import { describe, expect, it } from 'vitest';
import { pastSelfFrameAt } from './PastSelf';
import type { Frame } from './types';

const spawn: Frame = { x: 0, y: 0, down: false };

describe('pastSelfFrameAt — a past self whose recording has run out', () => {
  const recording: Frame[] = [
    { x: 10, y: 50, down: false },
    { x: 20, y: 50, down: true },
    { x: 30, y: 50, down: true },
  ];

  it('plays back its recorded frame while the recording lasts', () => {
    expect(pastSelfFrameAt(recording, 0, spawn)).toEqual(recording[0]);
    expect(pastSelfFrameAt(recording, 2, spawn)).toEqual(recording[2]);
  });

  it('freezes on its last recorded frame once the recording runs out', () => {
    for (const tick of [3, 4, 50, 5000]) {
      expect(pastSelfFrameAt(recording, tick, spawn)).toEqual(recording[2]);
    }
  });

  it('never hands the simulation an undefined frame', () => {
    for (let tick = -1; tick < 200; tick++) {
      expect(pastSelfFrameAt(recording, tick, spawn)).toBeDefined();
    }
    expect(pastSelfFrameAt([], 7, spawn)).toEqual(spawn);
  });

  it('keeps the button DOWN after the recording ends if it ended holding', () => {
    const held: Frame[] = [{ x: 110, y: 50, down: true }];
    expect(pastSelfFrameAt(held, 99, spawn).down).toBe(true);
  });

  it('keeps the button UP after the recording ends if it had let go', () => {
    const released: Frame[] = [{ x: 110, y: 50, down: true }, { x: 110, y: 50, down: false }];
    expect(pastSelfFrameAt(released, 99, spawn).down).toBe(false);
  });

  it('is still at spawn before its first tick', () => {
    expect(pastSelfFrameAt(recording, -1, spawn)).toEqual(spawn);
  });
});
