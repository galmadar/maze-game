// Pointer lock: turns raw mouse movement into per-tick deltas + button state for the sim.
export class PointerInput {
  private pendingDx = 0;
  private pendingDy = 0;
  private down = false;
  private locked = false;

  constructor(
    private el: HTMLElement,
    private onLockChange: (locked: boolean) => void,
  ) {
    document.addEventListener('pointerlockchange', this.handleLockChange);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mousedown', this.handleMouseDown);
    document.addEventListener('mouseup', this.handleMouseUp);
  }

  requestLock(): void {
    this.el.requestPointerLock();
  }

  isLocked(): boolean {
    return this.locked;
  }

  /** Consume accumulated movement since the last call — call once per fixed tick. */
  consumeTick(): { dx: number; dy: number; down: boolean } {
    const dx = this.pendingDx;
    const dy = this.pendingDy;
    this.pendingDx = 0;
    this.pendingDy = 0;
    return { dx, dy, down: this.down };
  }

  dispose(): void {
    document.removeEventListener('pointerlockchange', this.handleLockChange);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mousedown', this.handleMouseDown);
    document.removeEventListener('mouseup', this.handleMouseUp);
  }

  private handleLockChange = (): void => {
    this.locked = document.pointerLockElement === this.el;
    if (!this.locked) this.down = false;
    this.onLockChange(this.locked);
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.locked) return;
    this.pendingDx += e.movementX;
    this.pendingDy += e.movementY;
  };

  private handleMouseDown = (): void => {
    if (this.locked) this.down = true;
  };

  private handleMouseUp = (): void => {
    this.down = false;
  };
}

export function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}
