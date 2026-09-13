// All sound is synthesized with the Web Audio API — no audio files.
import { getMuted, setMuted } from '../storage';

let ctx: AudioContext | null = null;
let muted = getMuted();
let lastBump = 0;

function context(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** Call from a user gesture (e.g. the pointer-lock click) so the context is allowed to start. */
export function resumeAudio(): void {
  const c = context();
  if (c.state === 'suspended') void c.resume();
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMuted(): boolean {
  muted = !muted;
  setMuted(muted);
  return muted;
}

function tone(freq: number, duration: number, opts: { type?: OscillatorType; gain?: number; sweepTo?: number } = {}): void {
  if (muted) return;
  const c = context();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (opts.sweepTo) osc.frequency.exponentialRampToValueAtTime(opts.sweepTo, c.currentTime + duration);
  const peak = opts.gain ?? 0.2;
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(peak, c.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration + 0.02);
}

export function playRoundStart(): void {
  tone(440, 0.15, { type: 'triangle' });
}

export function playTick(): void {
  tone(880, 0.05, { type: 'square', gain: 0.08 });
}

export function playButtonPress(): void {
  tone(300, 0.08, { type: 'square', sweepTo: 500 });
}

export function playButtonRelease(): void {
  tone(500, 0.08, { type: 'square', sweepTo: 300 });
}

export function playDoorOpen(): void {
  tone(220, 0.25, { type: 'sawtooth', sweepTo: 440, gain: 0.15 });
}

export function playDoorClose(): void {
  tone(440, 0.25, { type: 'sawtooth', sweepTo: 220, gain: 0.15 });
}

/** Rate-limited so bumping a wall repeatedly doesn't spam the ear. */
export function playWallBump(): void {
  const now = performance.now();
  if (now - lastBump < 150) return;
  lastBump = now;
  tone(120, 0.06, { type: 'square', gain: 0.15 });
}

export function playRoundEndWhoosh(): void {
  tone(600, 0.4, { type: 'sine', sweepTo: 80, gain: 0.18 });
}

export function playLevelWinJingle(): void {
  if (muted) return;
  [523, 659, 784, 1047].forEach((freq, i) => {
    setTimeout(() => tone(freq, 0.2, { type: 'triangle', gain: 0.2 }), i * 90);
  });
}
