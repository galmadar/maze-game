import { corridorRoom, mazeRoom, type MazeSpec } from './rooms';
import type { LevelDef } from './types';

// Levels 1-3 are one straight corridor, teaching the hold button. From 4 on the
// rooms are real mazes — corners, branches and dead ends — and the new thing in
// them is the weight plate: a door that only opens while two or three arrows
// stand on it together. You cannot open one alone, only as a crowd.

const HEAVY: MazeSpec = {
  cols: 6,
  rows: 3,
  spawn: '0,1',
  exit: '5,1',
  links: [
    '0,1-1,1',
    '1,1-2,1',
    '2,1-3,1',
    '3,1-4,1',
    '1,1-1,0', // up to the plate
    '1,0-2,0',
    '0,1-0,2', // a long way down that goes nowhere
    '0,2-1,2',
    '1,2-2,2',
    '3,1-3,0', // dead end
    '3,1-3,2', // dead end
    '3,2-4,2', // dead end
  ],
  plates: [{ id: 'plate', at: '2,0', needs: 2 }],
  doors: [{ id: 'door', at: '4,1-5,1', openedBy: ['plate'] }],
};

const DEAD_ENDS: MazeSpec = {
  cols: 7,
  rows: 4,
  spawn: '0,0',
  exit: '6,3',
  links: [
    '0,0-1,0',
    '1,0-2,0',
    '2,0-3,0',
    '2,0-2,1', // dead end
    '0,0-0,1', // down to the first plate
    '0,1-1,1',
    '1,1-1,2',
    '1,2-2,2', // dead end
    '0,1-0,2',
    '0,2-0,3', // dead end
    // ---- everything below here is behind the first heavy door ----
    '4,0-5,0',
    '5,0-5,1',
    '5,1-5,2',
    '5,2-5,3',
    '4,0-4,1',
    '4,1-3,1', // dead end
    '5,2-4,2', // dead end
    '5,3-4,3', // dead end
  ],
  plates: [
    { id: 'first', at: '1,2', needs: 2 },
    { id: 'second', at: '5,1', needs: 2 },
  ],
  doors: [
    { id: 'door1', at: '3,0-4,0', openedBy: ['first'] },
    { id: 'door2', at: '5,3-6,3', openedBy: ['second'] },
  ],
};

const THE_CROWD: MazeSpec = {
  cols: 8,
  rows: 4,
  spawn: '0,1',
  exit: '7,3',
  links: [
    '0,1-1,1',
    '1,1-2,1',
    '2,1-3,1',
    '1,1-1,0',
    '1,0-2,0', // dead end
    '0,1-0,2', // down to the first plate
    '0,2-0,3',
    '0,3-1,3',
    '1,3-2,3', // dead end
    '2,1-2,2',
    '2,2-3,2', // dead end
    '3,1-3,0', // dead end
    // ---- everything below here is behind the first heavy door ----
    '4,1-4,0',
    '4,0-5,0',
    '5,0-6,0', // dead end
    '6,0-7,0', // dead end
    '4,1-4,2',
    '4,2-5,2',
    '5,2-5,3',
    '5,3-6,3',
    '4,2-4,3', // dead end
    '5,2-6,2', // dead end
  ],
  plates: [
    { id: 'two', at: '1,3', needs: 2 },
    { id: 'three', at: '5,0', needs: 3 },
  ],
  doors: [
    { id: 'door1', at: '3,1-4,1', openedBy: ['two'] },
    { id: 'door2', at: '6,3-7,3', openedBy: ['three'] },
  ],
};

// ---------------------------------------------------------------------------
// One small room each for the three newer things, so they can be played and
// seen. These are proofs that the thing works, not the levels that will teach
// it — those are somebody else's job.
// ---------------------------------------------------------------------------

// A switch in a dead-end pocket. Flip it and walk away: the door stays open.
// The catch is not here, it is in every later round — your own past self walks
// back in and flips it shut again.
const FLIP_IT: MazeSpec = {
  cols: 3,
  rows: 2,
  spawn: '0,0',
  exit: '2,0',
  links: ['0,0-1,0', '1,0-1,1', '1,1-2,1'],
  switches: [{ id: 'flip', at: '2,1' }],
  doors: [{ id: 'door', at: '1,0-2,0', openedBy: ['flip'] }],
};

// Two long arms out of the spawn: the timer pad down one, the door down the
// other. Whoever clicks the pad is far too far away to use it, so one self
// clicks while another — already waiting at the door — goes through.
const IN_A_HURRY: MazeSpec = {
  cols: 7,
  rows: 4,
  spawn: '0,0',
  exit: '3,3',
  links: [
    // the long way round to the timer pad
    '0,0-1,0',
    '1,0-2,0',
    '2,0-3,0',
    '3,0-4,0',
    '4,0-5,0',
    '5,0-6,0',
    '6,0-6,1',
    '6,1-5,1',
    '5,1-4,1',
    '4,1-3,1',
    '3,1-2,1',
    '2,1-1,1',
    // and the long way round to the door
    '0,0-0,1',
    '0,1-0,2',
    '0,2-1,2',
    '1,2-2,2',
    '2,2-3,2',
    '3,2-4,2',
    '4,2-5,2',
    '5,2-6,2',
    '6,2-6,3',
    '6,3-5,3',
    '5,3-4,3',
  ],
  timers: [{ id: 'pad', at: '1,1' }],
  doors: [{ id: 'door', at: '4,3-3,3', openedBy: ['pad'] }],
};

// Click the key to pick it up, carry it to the lock, and the lock stays open.
// A past self that picked it up carries it again next round — so the key walks
// around the room on its own.
const CARRY_IT: MazeSpec = {
  cols: 4,
  rows: 2,
  spawn: '0,0',
  exit: '3,0',
  links: ['0,0-0,1', '0,0-1,0', '1,0-2,0', '2,0-2,1'],
  keys: [{ id: 'key', at: '0,1' }],
  locks: [{ id: 'lock', at: '2,1' }],
  doors: [{ id: 'door', at: '2,0-3,0', openedBy: ['lock'] }],
};

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
  {
    // Two rounds go and stand on the plate and stay there; the third walks out.
    // Nobody can be on the plate and at the exit at the same time, so two is
    // impossible however fast you are.
    id: 'heavy',
    name: 'Heavy',
    minRounds: 3,
    build: (cw) => mazeRoom(cw, HEAVY),
  },
  {
    // Two plates, one behind the other: two rounds for the first, two for the
    // second, one to walk out.
    id: 'dead-ends',
    name: 'Dead ends',
    minRounds: 5,
    build: (cw) => mazeRoom(cw, DEAD_ENDS),
  },
  {
    // Everyone you have: two on the first plate, three on the second, and the
    // sixth of you finally walks out.
    id: 'the-crowd',
    name: 'The crowd',
    minRounds: 6,
    build: (cw) => mazeRoom(cw, THE_CROWD),
  },
  {
    // One round: go and flip the switch, then stroll out through the door it
    // left open. Nobody has to wait anywhere.
    id: 'flip-it',
    name: 'Flip it',
    minRounds: 1,
    build: (cw) => mazeRoom(cw, FLIP_IT),
  },
  {
    // The pad is a whole room away from the door it opens — too far to click it
    // and be through in the few seconds it gives you. Round 1 goes and clicks
    // it; round 2 is already standing at the door when it does.
    id: 'in-a-hurry',
    name: 'In a hurry',
    minRounds: 2,
    build: (cw) => mazeRoom(cw, IN_A_HURRY),
  },
  {
    // One round: take the key, carry it to the lock, walk out.
    id: 'carry-it',
    name: 'Carry it',
    minRounds: 1,
    build: (cw) => mazeRoom(cw, CARRY_IT),
  },
];
