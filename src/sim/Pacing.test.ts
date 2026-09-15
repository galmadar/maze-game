import { describe, expect, it } from 'vitest';
import { FAST_FORWARD_RATE, paceFrame, TICK_SECONDS } from './Pacing';

describe('paceFrame — hurrying runs more ticks, never bigger ones', () => {
  it('a normal frame is worth one tick', () => {
    const paced = paceFrame(0, TICK_SECONDS);
    expect(paced).toEqual({ ticks: 1, baseTicks: 1, carry: 0 });
  });

  it('hurrying multiplies the tick COUNT and nothing else', () => {
    for (const dt of [TICK_SECONDS, TICK_SECONDS * 2.5, 0.1, 0.25]) {
      const normal = paceFrame(0, dt);
      const fast = paceFrame(0, dt, FAST_FORWARD_RATE);
      expect(fast.ticks).toBe(normal.ticks * FAST_FORWARD_RATE);
      // The step size and the leftover time are untouched — the only difference
      // is how many identical ticks come out.
      expect(fast.baseTicks).toBe(normal.baseTicks);
      expect(fast.carry).toBe(normal.carry);
    }
  });

  it('carries the leftover time so no time is lost between frames', () => {
    let carry = 0;
    let ticks = 0;
    // 100 frames of 10ms is 1 second, which is 60 ticks however it is chopped up.
    for (let i = 0; i < 100; i++) {
      const paced = paceFrame(carry, 0.01);
      carry = paced.carry;
      ticks += paced.ticks;
    }
    expect(ticks).toBe(60);
  });
});
