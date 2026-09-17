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
// From here on the levels teach the three newer things — the switch that stays
// flipped, the door on a timer, the key you carry — and then start crossing
// them with each other and with the plate. The rule for all of them: each one
// has to ask something none of the others do.
// ---------------------------------------------------------------------------

// 7. A switch down a dead end. Flip it and stroll out: unlike the hold button,
// nobody has to stay behind. That is the whole lesson.
const FLIP_IT: MazeSpec = {
  cols: 4,
  rows: 3,
  spawn: '0,1',
  exit: '3,1',
  links: [
    '0,1-1,1',
    '1,1-2,1',
    '1,1-1,0',
    '1,0-2,0', // the switch pocket
    '0,1-0,0', // dead end
    '0,1-0,2', // dead end
    '2,1-2,2', // dead end
  ],
  switches: [{ id: 'flip', at: '2,0' }],
  doors: [{ id: 'door', at: '2,1-3,1', openedBy: ['flip'] }],
};

// 8. A key in one pocket, a lock in another, and the way out behind the lock.
// Pick it up, carry it there, and that door is open for good.
const CARRY_IT: MazeSpec = {
  cols: 5,
  rows: 3,
  spawn: '0,1',
  exit: '4,1',
  links: [
    '0,1-1,1',
    '1,1-1,0', // the key pocket
    '1,0-2,0', // dead end
    '1,1-2,1',
    '2,1-3,1',
    '2,1-2,2',
    '2,2-3,2', // the lock pocket
    '3,1-3,0', // dead end
  ],
  keys: [{ id: 'key', at: '1,0' }],
  locks: [{ id: 'lock', at: '3,2' }],
  doors: [{ id: 'door', at: '3,1-4,1', openedBy: ['lock'] }],
};

// 9. Two long arms out of the spawn: the timer pad down one, the door down the
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

// 10. The switch buys you past the first door — and finds a hold button behind
// it. One self does both jobs, in that order, and then has to stand there; the
// second self walks the whole way out. Flipping is free, holding costs a self.
const TWO_JOBS: MazeSpec = {
  cols: 5,
  rows: 3,
  spawn: '0,1',
  exit: '4,2',
  links: [
    '0,1-1,1',
    '1,1-1,0',
    '1,0-2,0', // the switch pocket
    '1,1-2,1',
    '2,1-2,2', // dead end
    '3,1-3,0', // the button pocket
    '3,1-3,2',
    '0,1-0,2', // dead end
    '0,2-1,2', // dead end
  ],
  switches: [{ id: 'flip', at: '2,0' }],
  buttons: [{ id: 'btn', at: '3,0' }],
  doors: [
    { id: 'door1', at: '2,1-3,1', openedBy: ['flip'] },
    { id: 'door2', at: '3,2-4,2', openedBy: ['btn'] },
  ],
};

// 11. The key is in a cage, and the cage's door is a hold button's. One self
// has to stand on that button for ever so a later one can go in, take the key
// out and walk it the long way round to the lock.
const FETCH: MazeSpec = {
  cols: 5,
  rows: 3,
  spawn: '0,1',
  exit: '4,0',
  links: [
    '0,1-1,1',
    '1,1-1,2', // the button pocket
    '1,1-2,1',
    '2,1-2,2', // dead end
    '3,1-3,0', // the cage, with the key in it
    '3,1-3,2',
    '3,2-4,2',
    '4,2-4,1',
    '0,1-0,0', // dead end
  ],
  buttons: [{ id: 'btn', at: '1,2' }],
  keys: [{ id: 'key', at: '3,0' }],
  locks: [{ id: 'lock', at: '4,2' }],
  doors: [
    { id: 'door1', at: '2,1-3,1', openedBy: ['btn'] },
    { id: 'door2', at: '4,1-4,0', openedBy: ['lock'] },
  ],
};

// 12. The key is behind a timer door, and the pad that opens it is eleven cells
// away round the outside — nobody can click it and reach the door in the second
// and a half it gives. So one self clicks, and the next is already standing at
// the door: in, grab the key, and out again before it shuts.
const IN_AND_OUT: MazeSpec = {
  cols: 6,
  rows: 4,
  spawn: '0,0',
  exit: '2,2',
  links: [
    // the long way round to the pad
    '0,0-0,1',
    '0,1-0,2',
    '0,2-0,3',
    '0,3-1,3',
    '1,3-2,3',
    '2,3-3,3',
    '3,3-4,3',
    '4,3-5,3',
    // and the short way to the door it opens
    '0,0-1,0',
    '1,0-2,0',
    '2,0-3,0',
    '4,0-5,0', // the pocket beyond the door
    '5,0-5,1', // dead end
    '2,0-2,1', // the lock, back on this side
    '1,0-1,1', // dead end
  ],
  timers: [{ id: 'pad', at: '5,3', openTicks: 90 }],
  keys: [{ id: 'key', at: '5,0' }],
  locks: [{ id: 'lock', at: '2,1' }],
  doors: [
    { id: 'door1', at: '3,0-4,0', openedBy: ['pad'] },
    { id: 'door2', at: '2,1-2,2', openedBy: ['lock'] },
  ],
};

// 13. The other half of that lesson. Pressing a hold button IS a click, so the
// hand carrying the key drops it the moment it presses — which is fine here,
// because the lock is already open by then. Put it down and get on with it.
const LET_GO: MazeSpec = {
  cols: 6,
  rows: 3,
  spawn: '0,1',
  exit: '5,1',
  links: [
    '0,1-0,0', // the key
    '0,1-1,1',
    '1,1-2,1',
    '2,1-2,2', // the lock
    '1,1-1,2', // dead end
    '3,1-3,0', // the button
    '3,1-4,1',
    '4,1-4,2', // dead end
    '0,1-0,2', // dead end
  ],
  keys: [{ id: 'key', at: '0,0' }],
  locks: [{ id: 'lock', at: '2,2' }],
  buttons: [{ id: 'btn', at: '3,0' }],
  doors: [
    { id: 'door1', at: '2,1-3,1', openedBy: ['lock'] },
    { id: 'door2', at: '4,1-5,1', openedBy: ['btn'] },
  ],
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
    // left open. Nobody has to wait anywhere — that is the point of it.
    id: 'flip-it',
    name: 'Flip it',
    minRounds: 1,
    build: (cw) => mazeRoom(cw, FLIP_IT),
  },
  {
    // One round: take the key, carry it to the lock, walk out.
    id: 'carry-it',
    name: 'Carry it',
    minRounds: 1,
    build: (cw) => mazeRoom(cw, CARRY_IT),
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
    // Round 1 flips the switch and then has to stay on the button behind it.
    // Nobody can hold a button and walk out, so the second self does the walk.
    id: 'two-jobs',
    name: 'Two jobs',
    minRounds: 2,
    build: (cw) => mazeRoom(cw, TWO_JOBS),
  },
  {
    // The button holding the cage shut has to be held by somebody, so it can
    // never be the self that carries the key out of it.
    id: 'fetch',
    name: 'Fetch',
    minRounds: 2,
    build: (cw) => mazeRoom(cw, FETCH),
  },
  {
    // Eleven cells from the pad to the door it opens, and only ninety ticks of
    // light — so the clicker is never the one who goes in.
    id: 'in-and-out',
    name: 'In and out',
    minRounds: 2,
    build: (cw) => mazeRoom(cw, IN_AND_OUT),
  },
  {
    // The key opens the first door, then the hand that carried it is needed on
    // a button — and a held button is a self that cannot leave.
    id: 'let-go',
    name: 'Let go',
    minRounds: 2,
    build: (cw) => mazeRoom(cw, LET_GO),
  },
];
