// Draws the room and arrows on a flat 2D canvas. No three.js — the game is flat.
import type { RoomDef } from '../content/types';
import type { Frame } from '../sim/types';

export interface DrawArrow {
  frame: Frame;
  label?: string; // round number for past selves
  alpha: number;
}

function drawArrowShape(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number, fill: string): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 14);
  ctx.lineTo(4, 11);
  ctx.lineTo(7, 17);
  ctx.lineTo(9, 15);
  ctx.lineTo(6, 9);
  ctx.lineTo(11, 9);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

export class Renderer {
  constructor(private ctx: CanvasRenderingContext2D) {}

  draw(room: RoomDef, openDoors: Set<string>, arrows: DrawArrow[]): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, room.width, room.height);
    ctx.fillStyle = '#141820';
    ctx.fillRect(0, 0, room.width, room.height);

    ctx.fillStyle = '#3a4356';
    for (const w of room.walls) ctx.fillRect(w.x, w.y, w.w, w.h);

    ctx.fillStyle = 'rgba(95, 208, 138, 0.85)';
    ctx.fillRect(room.exit.x, room.exit.y, room.exit.w, room.exit.h);

    for (const b of room.buttons) {
      const held = room.doors.some((d) => openDoors.has(d.id) && d.buttonIds.includes(b.id));
      ctx.fillStyle = held ? '#ffce54' : '#6b7280';
      ctx.fillRect(b.zone.x, b.zone.y, b.zone.w, b.zone.h);
    }

    for (const d of room.doors) {
      const open = openDoors.has(d.id);
      ctx.fillStyle = open ? 'rgba(107, 167, 224, 0.25)' : '#7a4b4b';
      ctx.fillRect(d.rect.x, d.rect.y, d.rect.w, d.rect.h);
    }

    for (const a of arrows) {
      drawArrowShape(ctx, a.frame.x, a.frame.y, a.alpha, a.frame.down ? '#ffce54' : '#e6e9ef');
      if (a.label) {
        ctx.save();
        ctx.globalAlpha = a.alpha;
        ctx.fillStyle = '#e6e9ef';
        ctx.font = '11px ui-monospace, monospace';
        ctx.fillText(a.label, a.frame.x + 13, a.frame.y + 10);
        ctx.restore();
      }
    }
  }
}
