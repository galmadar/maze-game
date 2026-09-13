import type { ButtonDef, DoorDef, LevelDef, RoomDef } from './types';

const ROOM_W = 900;
const ROOM_H = 300;
const CENTER_Y = ROOM_H / 2;

interface DoorSpec {
  id: string;
  x: number;
  w: number;
  buttonIds: string[];
}
interface ButtonSpec {
  id: string;
  x: number;
  w: number;
}

// All three levels are one straight corridor — doors and buttons just sit
// along it at different x positions. More room shapes can be added later by
// writing a different `build` for a level; nothing else has to change.
function corridorRoom(corridorWidth: number, doorSpecs: DoorSpec[], buttonSpecs: ButtonSpec[]): RoomDef {
  const half = corridorWidth / 2;
  const top = CENTER_Y - half;
  const bottom = CENTER_Y + half;

  const walls = [
    { x: 0, y: 0, w: ROOM_W, h: top },
    { x: 0, y: bottom, w: ROOM_W, h: ROOM_H - bottom },
  ];

  const doors: DoorDef[] = doorSpecs.map((d) => ({
    id: d.id,
    rect: { x: d.x, y: top, w: d.w, h: corridorWidth },
    buttonIds: d.buttonIds,
  }));

  const buttons: ButtonDef[] = buttonSpecs.map((b) => ({
    id: b.id,
    zone: { x: b.x, y: CENTER_Y - 20, w: b.w, h: 40 },
  }));

  return {
    width: ROOM_W,
    height: ROOM_H,
    spawn: { x: 40, y: CENTER_Y },
    exit: { x: ROOM_W - 60, y: CENTER_Y - 25, w: 40, h: 50 },
    walls,
    buttons,
    doors,
  };
}

export const LEVELS: LevelDef[] = [
  {
    id: 'hello',
    name: 'Hello',
    minRounds: 1,
    build: (cw) => corridorRoom(cw, [], []),
  },
  {
    id: 'hold-the-door',
    name: 'Hold the door',
    minRounds: 2,
    build: (cw) =>
      corridorRoom(
        cw,
        [{ id: 'door1', x: 480, w: 24, buttonIds: ['btn1'] }],
        [{ id: 'btn1', x: 260, w: 60 }],
      ),
  },
  {
    // A single arrow can only be in one place holding one button at a time,
    // and a door only stays open while held — so each door needs its own
    // round to hold it, plus one final round to walk the whole chain. Three
    // doors need four rounds, not three as DESIGN.md's flavour text says;
    // using three would make Hard (no spare rounds) unwinnable.
    id: 'relay',
    name: 'Relay',
    minRounds: 4,
    build: (cw) =>
      corridorRoom(
        cw,
        [
          { id: 'door1', x: 260, w: 24, buttonIds: ['btn1'] },
          { id: 'door2', x: 460, w: 24, buttonIds: ['btn2'] },
          { id: 'door3', x: 660, w: 24, buttonIds: ['btn3'] },
        ],
        [
          { id: 'btn1', x: 140, w: 60 },
          { id: 'btn2', x: 340, w: 60 },
          { id: 'btn3', x: 540, w: 60 },
        ],
      ),
  },
];
