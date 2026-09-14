// Draws the room and arrows on a flat 2D canvas. No three.js — the game is flat.
// The canvas is the whole window; the room is scaled up to fill it, leaving a
// margin of bare paper for the writing in the HUD.
import type { RoomDef } from '../content/types';
import type { Frame } from '../sim/types';
import {
  makeHatch,
  PAPER,
  seedOf,
  traceArrow,
  wobblyCirclePath,
  wobblyLine,
  wobblyRectPath,
} from './paper';

export interface DrawArrow {
  frame: Frame;
  label?: string; // round number for past selves
  alpha: number;
}

const MARGIN_TOP = 132;
const MARGIN_BOTTOM = 86;
const MARGIN_SIDE = 64;
const GAP = 18;

/** The writing in the margins. The room is fitted to whatever space it leaves. */
export interface Margins {
  top?: HTMLElement | null;
  bottom?: HTMLElement | null;
}

const CAVEAT = "'Caveat', 'Bradley Hand', cursive";

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private cssWidth = 0;
  private cssHeight = 0;
  /** Room units → CSS pixels. Mouse movement is divided by this so the arrow keeps mouse speed. */
  scale = 1;
  private originX = 0;
  private originY = 0;
  private wallHatch: CanvasPattern | null = null;
  private exitHatch: CanvasPattern | null = null;
  private redHatch: CanvasPattern | null = null;
  /** Writing is laid down after the room transform is undone, so it stays screen-sized. */
  private pendingLabels: { text: string; x: number; y: number; color: string; size: number }[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private margins: Margins = {},
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    this.ctx = ctx;
    this.wallHatch = makeHatch(ctx, 'rgba(47, 59, 74, 0.22)', 9, 1.6);
    this.exitHatch = makeHatch(ctx, PAPER.greenPencil, 7, 2.4);
    this.redHatch = makeHatch(ctx, PAPER.red, 8, 2);
    window.addEventListener('resize', this.handleResize);
    this.measure();
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
  }

  private handleResize = (): void => {
    this.measure();
  };

  /** Match the backing store to the window and the device's pixel density. */
  private measure(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.cssWidth = w;
    this.cssHeight = h;
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private layout(room: RoomDef): void {
    const side = Math.min(MARGIN_SIDE, this.cssWidth * 0.06);
    const top = Math.min(this.marginFor('top'), this.cssHeight * 0.35);
    const bottom = Math.min(this.marginFor('bottom'), this.cssHeight * 0.25);
    const availW = Math.max(80, this.cssWidth - side * 2);
    const availH = Math.max(80, this.cssHeight - top - bottom);
    this.scale = Math.min(availW / room.width, availH / room.height);
    this.originX = (this.cssWidth - room.width * this.scale) / 2;
    this.originY = top + (availH - room.height * this.scale) / 2;
  }

  /** How much paper the HUD is actually using right now — it reflows, so ask every frame. */
  private marginFor(edge: 'top' | 'bottom'): number {
    const el = edge === 'top' ? this.margins.top : this.margins.bottom;
    const fallback = edge === 'top' ? MARGIN_TOP : MARGIN_BOTTOM;
    if (!el || !el.isConnected) return fallback;
    const r = el.getBoundingClientRect();
    if (r.height === 0) return fallback;
    return edge === 'top' ? r.bottom + GAP : this.cssHeight - r.top + GAP;
  }

  private toScreenX(x: number): number {
    return this.originX + x * this.scale;
  }

  private toScreenY(y: number): number {
    return this.originY + y * this.scale;
  }

  draw(room: RoomDef, openDoors: Set<string>, arrows: DrawArrow[]): void {
    this.measure();
    this.layout(room);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);

    ctx.save();
    ctx.translate(this.originX, this.originY);
    ctx.scale(this.scale, this.scale);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const px = 1 / this.scale; // one screen pixel, in room units
    const amp = 1.6 * px;
    const step = 22 * px;

    this.pendingLabels = [];
    this.drawWalls(room, px, amp, step);
    this.drawExit(room, px, amp, step);
    this.drawButtons(room, openDoors, px, amp);
    this.drawDoors(room, openDoors, px, amp, step);

    ctx.restore();

    for (const l of this.pendingLabels) this.label(l.text, l.x, l.y, l.color, l.size);
    this.drawArrows(arrows);
  }

  private drawWalls(room: RoomDef, px: number, amp: number, step: number): void {
    const ctx = this.ctx;

    // Solid ground, hatched in pencil the way you'd shade a wall in a notebook.
    if (this.wallHatch) {
      ctx.save();
      ctx.scale(px, px);
      ctx.fillStyle = this.wallHatch;
      for (const w of room.walls) {
        ctx.fillRect(w.x / px, w.y / px, w.w / px, w.h / px);
      }
      ctx.restore();
    }

    ctx.strokeStyle = PAPER.ink;
    ctx.lineWidth = 5 * px;
    for (const w of room.walls) {
      wobblyRectPath(ctx, w.x, w.y, w.w, w.h, seedOf(w.x, w.y, w.w, w.h), amp, step);
      ctx.stroke();
    }

    // The sheet's edge, gone over a second time — the room really does stop here.
    ctx.lineWidth = 6 * px;
    wobblyRectPath(ctx, 0, 0, room.width, room.height, seedOf(room.width, room.height, 7), amp, step);
    ctx.stroke();
  }

  private drawExit(room: RoomDef, px: number, amp: number, step: number): void {
    const ctx = this.ctx;
    const e = room.exit;
    const seed = seedOf(e.x, e.y, e.w, e.h, 3);

    if (this.exitHatch) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      wobblyRectPath(ctx, e.x, e.y, e.w, e.h, seed, amp, step);
      ctx.clip();
      ctx.scale(px, px);
      ctx.fillStyle = this.exitHatch;
      ctx.fillRect((e.x - 4) / px, (e.y - 4) / px, (e.w + 8) / px, (e.h + 8) / px);
      ctx.restore();
    }

    ctx.strokeStyle = PAPER.greenInk;
    ctx.lineWidth = 4 * px;
    wobblyRectPath(ctx, e.x, e.y, e.w, e.h, seed, amp, step);
    ctx.stroke();

    const outSize = Math.min(26, e.h * this.scale * 0.46);
    this.pendingLabels.push({
      text: 'out',
      x: this.toScreenX(e.x + e.w / 2),
      y: this.toScreenY(e.y + e.h / 2) + outSize * 0.36,
      color: PAPER.greenInk,
      size: outSize,
    });
  }

  private drawButtons(room: RoomDef, openDoors: Set<string>, px: number, amp: number): void {
    const ctx = this.ctx;
    for (const b of room.buttons) {
      const held = room.doors.some((d) => openDoors.has(d.id) && d.buttonIds.includes(b.id));
      const cx = b.zone.x + b.zone.w / 2;
      const cy = b.zone.y + b.zone.h / 2;
      const r = Math.min(b.zone.w, b.zone.h) / 2;
      const seed = seedOf(b.zone.x, b.zone.y, b.zone.w, b.zone.h);

      if (this.redHatch) {
        ctx.save();
        ctx.globalAlpha = held ? 0.85 : 0.35;
        wobblyCirclePath(ctx, cx, cy, r, seed, amp);
        ctx.clip();
        ctx.scale(px, px);
        ctx.fillStyle = this.redHatch;
        ctx.fillRect((cx - r - 4) / px, (cy - r - 4) / px, (r * 2 + 8) / px, (r * 2 + 8) / px);
        ctx.restore();
      }

      ctx.strokeStyle = PAPER.red;
      ctx.lineWidth = (held ? 5.5 : 4) * px;
      wobblyCirclePath(ctx, cx, cy, r, seed, amp);
      ctx.stroke();

      const size = Math.min(22, r * this.scale * 0.8);
      this.pendingLabels.push({
        text: 'hold',
        x: this.toScreenX(cx),
        y: this.toScreenY(cy) + size * 0.36,
        color: PAPER.red,
        size,
      });
    }
  }

  private drawDoors(room: RoomDef, openDoors: Set<string>, px: number, amp: number, step: number): void {
    const ctx = this.ctx;
    for (const d of room.doors) {
      const open = openDoors.has(d.id);
      const mx = d.rect.x + d.rect.w / 2;
      const top = d.rect.y;
      const bottom = d.rect.y + d.rect.h;
      const seed = seedOf(d.rect.x, d.rect.y, d.rect.w, d.rect.h);

      if (open) {
        // Swung out of the way: a dashed ghost where it was, and the leaf ajar.
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.setLineDash([5 * px, 9 * px]);
        ctx.strokeStyle = PAPER.red;
        ctx.lineWidth = 3 * px;
        wobblyLine(ctx, mx, top, mx, bottom, seed, amp, step);
        ctx.restore();

        ctx.strokeStyle = PAPER.red;
        ctx.lineWidth = 5 * px;
        const leaf = d.rect.h * 0.42;
        wobblyLine(ctx, mx, top, mx + leaf * 0.8, top + leaf * 0.6, seed + 11, amp, step);
      } else {
        ctx.strokeStyle = PAPER.wood;
        ctx.lineWidth = 7 * px;
        wobblyLine(ctx, mx, top, mx, bottom, seed, amp, step);
      }
    }
  }

  /** Arrows are drawn in screen pixels so they stay cursor-sized however far the room is zoomed. */
  private drawArrows(arrows: DrawArrow[]): void {
    const ctx = this.ctx;
    for (const a of arrows) {
      const x = this.toScreenX(a.frame.x);
      const y = this.toScreenY(a.frame.y);
      const past = a.label !== undefined;
      const size = past ? 30 : 38;

      ctx.save();
      ctx.globalAlpha = a.alpha;
      ctx.lineJoin = 'round';
      traceArrow(ctx, x, y, size);
      ctx.fillStyle = past ? PAPER.pencil : a.frame.down ? PAPER.red : PAPER.ink;
      ctx.fill();
      ctx.strokeStyle = past ? PAPER.pencilEdge : PAPER.inkDeep;
      ctx.lineWidth = past ? 2.2 : 2.8;
      ctx.stroke();

      if (a.label !== undefined) {
        const cx = x + size * 0.62;
        const cy = y - size * 0.2;
        ctx.strokeStyle = PAPER.pencil;
        ctx.lineWidth = 2.2;
        wobblyCirclePath(ctx, cx, cy, 13, seedOf(Number(a.label), 5), 1.1);
        ctx.stroke();
        this.label(a.label, cx, cy + 7, PAPER.pencil, 20);
      }
      ctx.restore();
    }
  }

  private label(text: string, x: number, y: number, color: string, size: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `700 ${size}px ${CAVEAT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }
}
