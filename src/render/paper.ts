// The hand-drawn paper look, in canvas terms: palette, seeded wobble, pencil hatching.
// The mockups get their wobble from an SVG feTurbulence displacement filter, which a
// 2D canvas has no equivalent for — so every line here is jittered by a hash of where
// it is, never by a random number. Same input, same squiggle, every single frame.

export const PAPER = {
  sheet: '#f5ecd9',
  rule: '#c9b89a',
  ink: '#2f3b4a',
  inkDeep: '#1d2733',
  pencil: '#5a6675',
  pencilEdge: '#3f4a58',
  red: '#c25b4a',
  wood: '#b0895f',
  greenInk: '#4d7548',
  greenPencil: '#5f8a5a',
  faint: '#8a7d63',
} as const;

/** Integer hash → 0..1. The whole look rests on this being pure. */
function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function jitter(seed: number, i: number, channel: number, amp: number): number {
  return (hash(seed * 2654435761 + i * 2246822519 + channel * 3266489917) - 0.5) * 2 * amp;
}

/** A stable seed for anything the level places at fixed coordinates. */
export function seedOf(...nums: number[]): number {
  let s = 0x811c9dc5;
  for (const n of nums) s = Math.imul(s ^ Math.round(n * 16), 0x01000193);
  return s >>> 0;
}

type Pt = [number, number];

function jitteredLine(a: Pt, b: Pt, seed: number, amp: number, step: number): Pt[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.round(len / step));
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([
      a[0] + (b[0] - a[0]) * t + jitter(seed, i, 1, amp),
      a[1] + (b[1] - a[1]) * t + jitter(seed, i, 2, amp),
    ]);
  }
  return pts;
}

/** Lay a smooth path through the points, so the wobble reads as a drawn line, not a zigzag. */
function tracePoints(ctx: CanvasRenderingContext2D, pts: Pt[], close: boolean): void {
  if (pts.length < 2) return;
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
  if (close) ctx.closePath();
}

export function wobblyLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  seed: number,
  amp: number,
  step: number,
): void {
  ctx.beginPath();
  tracePoints(ctx, jitteredLine([x0, y0], [x1, y1], seed, amp, step), false);
  ctx.stroke();
}

/** A closed wobbly rectangle path — stroke it, fill it, or both. */
export function wobblyRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  amp: number,
  step: number,
): void {
  const corners: Pt[] = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
  const pts: Pt[] = [];
  for (let s = 0; s < 4; s++) {
    const side = jitteredLine(corners[s], corners[(s + 1) % 4], seed + s * 97, amp, step);
    pts.push(...side.slice(0, -1));
  }
  ctx.beginPath();
  tracePoints(ctx, [...pts, pts[0]], true);
}

export function wobblyCirclePath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  seed: number,
  amp: number,
): void {
  const n = Math.max(10, Math.round((r * Math.PI * 2) / 14));
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r + jitter(seed, i, 1, amp);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  ctx.beginPath();
  tracePoints(ctx, [...pts, pts[0]], true);
}

/**
 * A wobbly arc — the ring of time left on a timer door. Angles in radians;
 * it runs from `a0` to `a1`, so a shrinking `a1` is a clock running down.
 */
export function wobblyArcPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  seed: number,
  amp: number,
): void {
  const n = Math.max(3, Math.round((Math.abs(a1 - a0) * r) / 12));
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const rr = r + jitter(seed, i, 1, amp);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  ctx.beginPath();
  tracePoints(ctx, pts, false);
}

/** A 45° pencil hatch, built once into a tile so filling a shape costs nothing. */
export function makeHatch(
  ctx: CanvasRenderingContext2D,
  color: string,
  gap: number,
  width: number,
): CanvasPattern | null {
  const tile = document.createElement('canvas');
  tile.width = gap;
  tile.height = gap;
  const tctx = tile.getContext('2d');
  if (!tctx) return null;
  tctx.strokeStyle = color;
  tctx.lineWidth = width;
  tctx.lineCap = 'round';
  tctx.beginPath();
  tctx.moveTo(0, gap);
  tctx.lineTo(gap, 0);
  tctx.stroke();
  return ctx.createPattern(tile, 'repeat');
}

/** The cursor, as the mockups draw it. Unit shape is 28 × 43. */
export const ARROW_PATH: Pt[] = [
  [0, 0],
  [0, 38],
  [9, 29],
  [15, 43],
  [23, 39],
  [17, 26],
  [28, 26],
];

export function traceArrow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const k = size / 43;
  ctx.beginPath();
  ctx.moveTo(x + ARROW_PATH[0][0] * k, y + ARROW_PATH[0][1] * k);
  for (let i = 1; i < ARROW_PATH.length; i++) {
    ctx.lineTo(x + ARROW_PATH[i][0] * k, y + ARROW_PATH[i][1] * k);
  }
  ctx.closePath();
}
