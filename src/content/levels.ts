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

// 11. The key is behind a timer door, and the pad that opens it is eleven cells
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

// 14. One door, two ways to open it: a button a step off the path that somebody
// has to stand on for ever, or a switch six cells down a dead end that nobody
// has to stand on at all. The walk is the price of not spending a self.
const EITHER_WAY: MazeSpec = {
  cols: 6,
  rows: 4,
  spawn: '0,1',
  exit: '5,1',
  links: [
    '0,1-1,1',
    '1,1-1,0', // the button, right there
    '0,1-0,2',
    '0,2-0,3',
    '0,3-1,3', // the switch, the long way round
    '1,3-2,3', // dead end
    '2,1-2,0', // dead end
    '2,1-3,1',
    '3,1-3,0', // the plate
    '3,1-4,1',
    '4,1-4,2', // dead end
    '4,2-5,2', // dead end
  ],
  switches: [{ id: 'flip', at: '1,3' }],
  buttons: [{ id: 'btn', at: '1,0' }],
  plates: [{ id: 'plate', at: '3,0', needs: 2 }],
  doors: [
    { id: 'door1', at: '1,1-2,1', openedBy: ['btn', 'flip'] },
    { id: 'door2', at: '4,1-5,1', openedBy: ['plate'] },
  ],
};

// 15. The key is behind the crowd: nothing can reach it until two of you are
// standing on the plate, so the one who fetches it is always the third.
const TWO_TO_FETCH: MazeSpec = {
  cols: 6,
  rows: 4,
  spawn: '0,1',
  exit: '5,0',
  links: [
    '0,1-1,1',
    '1,1-1,2',
    '1,2-2,2', // the plate
    '1,2-1,3', // dead end
    '1,1-2,1',
    '2,1-2,0', // dead end
    '3,1-3,2', // the key
    '3,1-4,1',
    '4,1-4,0', // the lock
    '0,1-0,0', // dead end
    '0,1-0,2', // dead end
  ],
  plates: [{ id: 'plate', at: '2,2', needs: 2 }],
  keys: [{ id: 'key', at: '3,2' }],
  locks: [{ id: 'lock', at: '4,0' }],
  doors: [
    { id: 'door1', at: '2,1-3,1', openedBy: ['plate'] },
    { id: 'door2', at: '4,0-5,0', openedBy: ['lock'] },
  ],
};

// 16. The switch sits in the corridor everybody walks down, and the plate behind
// it needs two of you. Every click flips it, so exactly one of the three may
// touch it — the second self has to walk over it and keep its hands to itself.
const ONLY_ONE_OF_YOU: MazeSpec = {
  cols: 6,
  rows: 3,
  spawn: '0,1',
  exit: '5,1',
  links: [
    '0,1-1,1', // the switch is here, on the way
    '2,1-2,0', // the plate
    '2,1-2,2', // dead end
    '2,1-3,1',
    '3,1-3,2', // dead end
    '3,1-4,1',
    '4,1-4,0', // dead end
    '0,1-0,0', // dead end
    '0,1-0,2', // dead end
  ],
  switches: [{ id: 'flip', at: '1,1' }],
  plates: [{ id: 'plate', at: '2,0', needs: 2 }],
  doors: [
    { id: 'door1', at: '1,1-2,1', openedBy: ['flip'] },
    { id: 'door2', at: '4,1-5,1', openedBy: ['plate'] },
  ],
};

// 17. The key is lying on the switch. One click does both jobs — it comes up in
// your hand and the door down the corridor opens — and there is no way to do
// one without the other.
const TWO_AT_ONCE: MazeSpec = {
  cols: 6,
  rows: 4,
  spawn: '0,1',
  exit: '5,0',
  links: [
    '0,1-1,1',
    '1,1-1,0', // the switch, with the key lying on it
    '1,1-2,1',
    '2,1-2,2', // dead end
    '3,1-3,0', // the lock
    '3,1-3,2', // dead end
    '3,1-4,1',
    '4,1-4,2', // the plate
    '4,2-4,3', // dead end
    '0,1-0,0', // dead end
    '0,1-0,2',
    '0,2-0,3', // dead end
  ],
  switches: [{ id: 'flip', at: '1,0' }],
  keys: [{ id: 'key', at: '1,0' }],
  locks: [{ id: 'lock', at: '3,0' }],
  plates: [{ id: 'plate', at: '4,2', needs: 2 }],
  doors: [
    { id: 'door1', at: '2,1-3,1', openedBy: ['flip'] },
    { id: 'door2', at: '4,1-5,1', openedBy: ['lock'] },
    { id: 'door3', at: '5,1-5,0', openedBy: ['plate'] },
  ],
};

// A hand holding a key cannot click anything — a click is how you put it down.
// So the self that carries the key can never be the self that works the timer
// pad: click it and the key is on the floor eleven cells from where it is
// wanted. Somebody empty-handed has to make that walk.
const HANDS_FULL: MazeSpec = {
  cols: 7,
  rows: 5,
  spawn: '0,0',
  exit: '3,4',
  links: [
    // the long way round to the pad
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
    // the short way to the door it opens, past the key
    '0,0-0,1',
    '0,1-0,2',
    '0,2-1,2',
    '1,2-2,2',
    '2,2-3,2',
    // and the wing beyond it, with the lock at the far end of it
    '4,2-5,2',
    '5,2-6,2',
    '6,2-6,3',
    '6,3-5,3',
    '5,3-4,3',
    '4,3-3,3',
    '0,2-0,3', // dead end
    '0,3-0,4', // dead end
  ],
  timers: [{ id: 'pad', at: '2,1', openTicks: 90 }],
  keys: [{ id: 'key', at: '0,1' }],
  locks: [{ id: 'lock', at: '3,3' }],
  doors: [
    { id: 'door1', at: '3,2-4,2', openedBy: ['pad'] },
    { id: 'door2', at: '3,3-3,4', openedBy: ['lock'] },
  ],
};

// 19. Two timer doors, and the second one's pad is behind the first. So the self
// that clicks the second pad is shut in behind the first door for ever, and the
// third of you is standing at the second door when that click comes round again.
const CHAIN: MazeSpec = {
  cols: 7,
  rows: 4,
  spawn: '0,0',
  exit: '2,2',
  links: [
    // the long way round to the first pad
    '0,0-0,1',
    '0,1-0,2',
    '0,2-0,3',
    '0,3-1,3',
    '1,3-2,3',
    '2,3-3,3',
    '3,3-4,3',
    '4,3-5,3', // dead end
    '3,3-3,2', // dead end
    // the short way to the first door
    '0,0-1,0',
    '1,0-2,0',
    '2,0-2,1', // dead end
    // beyond it, the second pad
    '3,0-4,0',
    '4,0-5,0',
    '5,0-6,0',
    '6,0-6,1',
    '6,1-6,2', // dead end
    '5,0-5,1', // dead end
    // and the branch the second door stands in
    '1,0-1,1',
    '1,1-1,2',
  ],
  timers: [
    { id: 'pad1', at: '4,3', openTicks: 60 },
    { id: 'pad2', at: '6,1', openTicks: 60 },
  ],
  doors: [
    { id: 'door1', at: '2,0-3,0', openedBy: ['pad1'] },
    { id: 'door2', at: '1,2-2,2', openedBy: ['pad2'] },
  ],
};

// 20. Two keys, two locks, and each key only fits its own. A hand holds one key,
// so the first has to go on the floor before the second can be picked up — and
// the plate at the end still wants two of you.
const TWO_KEYS: MazeSpec = {
  cols: 5,
  rows: 3,
  spawn: '1,1',
  exit: '4,1',
  links: [
    '1,1-1,0', // the first key
    '1,1-0,1', // the first lock
    '0,1-0,0', // dead end
    '0,1-0,2', // dead end
    '2,1-2,0', // the second key
    '2,1-2,2', // the second lock
    '3,1-3,0', // the plate
    '3,1-3,2', // dead end
  ],
  keys: [
    { id: 'key1', at: '1,0' },
    { id: 'key2', at: '2,0' },
  ],
  locks: [
    { id: 'lock1', at: '0,1', keyIds: ['key1'] },
    { id: 'lock2', at: '2,2', keyIds: ['key2'] },
  ],
  plates: [{ id: 'plate', at: '3,0', needs: 2 }],
  doors: [
    { id: 'door1', at: '1,1-2,1', openedBy: ['lock1'] },
    { id: 'door2', at: '2,1-3,1', openedBy: ['lock2'] },
    { id: 'door3', at: '3,1-4,1', openedBy: ['plate'] },
  ],
};

// One pad, and two doors on it, a corridor apart. One click cannot keep them
// both open long enough to walk from one to the other — and clicking again does
// not ADD time, it starts the second over, which is exactly what is wanted: go
// back and click it a second time, later, before the round is done.
const KEEP_IT_OPEN: MazeSpec = {
  cols: 8,
  rows: 5,
  spawn: '0,0',
  exit: '5,2',
  links: [
    // the long way round to the pad
    '0,0-0,1',
    '0,1-0,2',
    '0,2-0,3',
    '0,3-0,4',
    '0,4-1,4',
    '1,4-2,4',
    '2,4-3,4',
    '3,4-4,4', // dead end
    '4,4-5,4', // dead end
    '5,4-6,4', // dead end
    '3,4-3,3', // dead end
    // the first door stands one cell from the spawn
    '0,0-1,0',
    '1,0-1,1', // dead end
    // and eight cells of corridor between it and the second
    '2,0-3,0',
    '3,0-4,0',
    '4,0-5,0',
    '5,0-6,0',
    '6,0-7,0',
    '7,0-7,1',
    '7,1-7,2',
    '7,2-6,2',
    '6,0-6,1', // dead end
  ],
  timers: [{ id: 'pad', at: '3,4', openTicks: 60 }],
  doors: [
    { id: 'doorA', at: '1,0-2,0', openedBy: ['pad'] },
    { id: 'doorB', at: '6,2-5,2', openedBy: ['pad'] },
  ],
};

// Two on a plate, one on a button behind the plate's door, and the fourth of
// you finally free to do the long job: in for the key, and all the way back to
// the lock by the spawn. Four of you, four different things to be doing.
const HOLD_IT_OPEN: MazeSpec = {
  cols: 7,
  rows: 4,
  spawn: '0,1',
  exit: '0,3',
  links: [
    '0,1-1,1',
    '1,1-1,0',
    '1,0-2,0', // the plate
    '1,1-2,1',
    '2,1-2,2', // dead end
    '3,1-3,0', // the button
    '3,1-4,1',
    '4,1-4,2', // dead end
    '5,1-5,0', // the key
    '5,1-6,1', // dead end
    '0,1-0,2',
    '0,2-1,2', // the lock
  ],
  plates: [{ id: 'plate', at: '2,0', needs: 2 }],
  buttons: [{ id: 'btn', at: '3,0' }],
  keys: [{ id: 'key', at: '5,0' }],
  locks: [{ id: 'lock', at: '1,2' }],
  doors: [
    { id: 'door1', at: '2,1-3,1', openedBy: ['plate'] },
    { id: 'door2', at: '4,1-5,1', openedBy: ['btn'] },
    { id: 'door3', at: '0,2-0,3', openedBy: ['lock'] },
  ],
};

// 22. A plate for two, shut in behind a timer door thirteen cells from its pad.
// So one of you clicks and two more have to catch the same second and a half,
// one in each of two later rounds, and a fourth walks out.
const THROUGH_TOGETHER: MazeSpec = {
  cols: 6,
  rows: 5,
  spawn: '0,2',
  exit: '1,0',
  links: [
    // the zig-zag out to the pad
    '0,2-1,2',
    '1,2-1,1',
    '1,1-2,1',
    '2,1-2,0',
    '2,0-3,0',
    '3,0-4,0',
    '4,0-5,0',
    '5,0-5,1',
    '5,1-4,1',
    '2,1-3,1', // dead end
    // the short way down to the door it opens
    '0,2-0,3',
    '0,3-1,3',
    '1,3-2,3',
    '2,3-3,3',
    '0,3-0,4', // dead end
    '3,3-3,4', // dead end
    // the wing beyond it
    '4,3-5,3',
    '5,3-5,4',
    '4,3-4,4', // dead end
    // the way out, back on this side
    '0,2-0,1',
    '0,1-0,0',
  ],
  timers: [{ id: 'pad', at: '4,1', openTicks: 90 }],
  plates: [{ id: 'plate', at: '5,4', needs: 2 }],
  doors: [
    { id: 'door1', at: '3,3-4,3', openedBy: ['pad'] },
    { id: 'door2', at: '0,0-1,0', openedBy: ['plate'] },
  ],
};

// 23. Four arms off one junction, and a different job at the end of three of
// them. Nothing here is hard on its own; working out which of you can afford
// which arm, with round 1 the shortest round you will ever have, is.
const CROSSROADS: MazeSpec = {
  cols: 7,
  rows: 5,
  spawn: '3,2',
  exit: '0,2',
  links: [
    // north, to the switch
    '3,2-3,1',
    '3,1-3,0',
    '3,0-2,0', // pocket
    '3,0-4,0', // pocket
    // south, behind the switch's door, to the plate
    '3,3-3,4',
    '3,4-2,4', // pocket
    '3,4-4,4', // pocket
    // east, to the button
    '3,2-4,2',
    '4,2-5,2',
    '5,2-6,2',
    '5,2-5,1', // pocket
    '5,2-5,3', // pocket
    // west, behind the button's door, to the way out
    '2,2-1,2',
    '1,2-1,1', // pocket
    '1,2-1,3', // pocket
  ],
  switches: [{ id: 'flip', at: '3,0' }],
  buttons: [{ id: 'btn', at: '6,2' }],
  plates: [{ id: 'plate', at: '3,4', needs: 2 }],
  doors: [
    { id: 'door1', at: '3,2-3,3', openedBy: ['flip'] },
    { id: 'door2', at: '3,2-2,2', openedBy: ['btn'] },
    { id: 'door3', at: '1,2-0,2', openedBy: ['plate'] },
  ],
};

/** Every cell joined to every neighbour: no corridors, just a floor with pillars. */
function hallLinks(cols: number, rows: number): string[] {
  const links: string[] = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (c + 1 < cols) links.push(`${c},${r}-${c + 1},${r}`);
      if (r + 1 < rows) links.push(`${c},${r}-${c},${r + 1}`);
    }
  }
  return links;
}

// 24. No corridors at all — one open floor with pillars, which is a different
// kind of hard: nothing tells you where to go. Three of you hold the middle
// while the fourth crosses the whole room twice for the key.
const THE_HALL: MazeSpec = {
  cols: 6,
  rows: 5,
  spawn: '0,4',
  exit: '5,0',
  links: hallLinks(5, 5),
  plates: [{ id: 'plate', at: '2,2', needs: 3 }],
  keys: [{ id: 'key', at: '5,2' }],
  locks: [{ id: 'lock', at: '0,0' }],
  doors: [
    { id: 'door1', at: '4,2-5,2', openedBy: ['plate'] },
    { id: 'door2', at: '4,0-5,0', openedBy: ['lock'] },
  ],
};

// 25. Everything at once and in a line: a button somebody holds for ever, a key
// through the door it opens, a lock, and a plate that wants three of you behind
// that. Five rounds and nobody spare.
const THE_LONG_WAY: MazeSpec = {
  cols: 7,
  rows: 4,
  spawn: '0,1',
  exit: '6,1',
  links: [
    '0,1-0,0', // the button
    '0,1-0,2', // dead end
    '0,1-1,1',
    '1,1-1,2', // dead end
    '2,1-2,0', // the key
    '2,1-3,1',
    '3,1-3,2', // the lock
    '3,1-3,0', // dead end
    '4,1-4,0', // the plate
    '4,1-5,1',
    '5,1-5,2', // dead end
  ],
  buttons: [{ id: 'btn', at: '0,0' }],
  keys: [{ id: 'key', at: '2,0' }],
  locks: [{ id: 'lock', at: '3,2' }],
  plates: [{ id: 'plate', at: '4,0', needs: 3 }],
  doors: [
    { id: 'door1', at: '1,1-2,1', openedBy: ['btn'] },
    { id: 'door2', at: '3,1-4,1', openedBy: ['lock'] },
    { id: 'door3', at: '5,1-6,1', openedBy: ['plate'] },
  ],
};

// 26. All six of you, each with one job and none of them the same: one holds the
// button that opens the room at all, one runs the long arm to the pad, three
// catch the second it buys and stand on the plate behind the door, and the last
// walks out of a door on this side that the three of them opened.
const EVERYONE: MazeSpec = {
  cols: 7,
  rows: 5,
  spawn: '0,2',
  exit: '1,4',
  links: [
    '0,2-0,1', // the button
    '0,1-0,0', // dead end
    // beyond the button's door, the long arm to the pad
    '1,2-1,1',
    '1,1-2,1',
    '2,1-3,1',
    '3,1-4,1',
    '4,1-5,1',
    '5,1-6,1',
    '6,1-6,0',
    '6,0-5,0',
    '5,0-4,0',
    '3,1-3,0', // dead end
    // and the way down to the timer door
    '1,2-1,3',
    '1,3-2,3',
    '2,3-3,3',
    '2,3-2,4', // dead end
    // the wing beyond it
    '4,3-5,3',
    '5,3-5,4',
    '5,3-6,3', // dead end
    // the way out, on this side
    '0,2-0,3',
    '0,3-0,4',
  ],
  buttons: [{ id: 'btn', at: '0,1' }],
  timers: [{ id: 'pad', at: '4,0', openTicks: 60 }],
  plates: [{ id: 'plate', at: '5,4', needs: 3 }],
  doors: [
    { id: 'door1', at: '0,2-1,2', openedBy: ['btn'] },
    { id: 'door2', at: '3,3-4,3', openedBy: ['pad'] },
    { id: 'door3', at: '0,4-1,4', openedBy: ['plate'] },
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
    // Eleven cells from the pad to the door it opens, and only ninety ticks of
    // light — so the clicker is never the one who goes in.
    id: 'in-and-out',
    name: 'In and out',
    minRounds: 2,
    build: (cw) => mazeRoom(cw, IN_AND_OUT),
  },
  {
    // A hand with a key in it cannot click, so the pad and the key have to be
    // two different selves — and sixteen cells apart, the clicker can never be
    // the one who walks through.
    id: 'hands-full',
    name: 'Hands full',
    minRounds: 2,
    build: (cw) => mazeRoom(cw, HANDS_FULL),
  },
  {
    // One click buys sixty ticks and the corridor between the two doors takes
    // eighty. Go back and click it again, later — it starts over, never stacks.
    id: 'keep-it-open',
    name: 'Keep it open',
    minRounds: 2,
    build: (cw) => mazeRoom(cw, KEEP_IT_OPEN),
  },
  {
    // The key opens the first door, then the hand that carried it is needed on
    // a button — and a held button is a self that cannot leave.
    id: 'let-go',
    name: 'Let go',
    minRounds: 2,
    build: (cw) => mazeRoom(cw, LET_GO),
  },
  {
    // The plate needs two, so three rounds whichever way you open the first
    // door — but the switch route leaves all three of you free to walk.
    id: 'either-way',
    name: 'Either way',
    minRounds: 3,
    build: (cw) => mazeRoom(cw, EITHER_WAY),
  },
  {
    // Two rounds on the plate, and only then can anybody get at the key.
    id: 'two-to-fetch',
    name: 'Two to fetch',
    minRounds: 3,
    build: (cw) => mazeRoom(cw, TWO_TO_FETCH),
  },
  {
    // Three of you walk over the switch and exactly one may click it. Two
    // clicks put it back where it started and shut the door on the third.
    id: 'only-one-of-you',
    name: 'Only one of you',
    minRounds: 3,
    build: (cw) => mazeRoom(cw, ONLY_ONE_OF_YOU),
  },
  {
    // Picking up the key flips the switch under it. One self does the whole
    // key run; the plate at the end still needs a second and a third.
    id: 'two-at-once',
    name: 'Two at once',
    minRounds: 3,
    build: (cw) => mazeRoom(cw, TWO_AT_ONCE),
  },
  {
    // Three rounds, three jobs: click the first pad, get through and click the
    // second, and be standing at the second door when that click comes round.
    id: 'chain',
    name: 'Chain',
    minRounds: 3,
    build: (cw) => mazeRoom(cw, CHAIN),
  },
  {
    // Round 1 does both keys, putting the first down to free its hand. The
    // plate then wants two of you, so a third walks out.
    id: 'two-keys',
    name: 'Two keys',
    minRounds: 3,
    build: (cw) => mazeRoom(cw, TWO_KEYS),
  },
  {
    // One clicker, two who catch the window and stand on the plate behind the
    // door, and a fourth who walks out on this side.
    id: 'through-together',
    name: 'Through together',
    minRounds: 4,
    build: (cw) => mazeRoom(cw, THROUGH_TOGETHER),
  },
  {
    // Two on the plate, one on the button, one out of the door — and the switch
    // is free, so round 1 can flip it and still get to the plate in time.
    id: 'crossroads',
    name: 'Crossroads',
    minRounds: 4,
    build: (cw) => mazeRoom(cw, CROSSROADS),
  },
  {
    // Three of you on the plate in the middle; the fourth crosses the hall for
    // the key and crosses it again to the lock.
    id: 'the-hall',
    name: 'The hall',
    minRounds: 4,
    build: (cw) => mazeRoom(cw, THE_HALL),
  },
  {
    // Two on the plate, one on the button behind it, and the fourth walks the
    // length of the room for the key and the length of it back to the lock.
    id: 'hold-it-open',
    name: 'Hold it open',
    minRounds: 4,
    build: (cw) => mazeRoom(cw, HOLD_IT_OPEN),
  },
  {
    // A button held, a key run, and a plate for three: five jobs and five of
    // you, with the key fitted into the same round as the first plate stander.
    id: 'the-long-way',
    name: 'The long way',
    minRounds: 5,
    build: (cw) => mazeRoom(cw, THE_LONG_WAY),
  },
  {
    // A button, a pad, three on a plate and one walking out: six rounds, and not
    // one of them can be spent on anything else.
    id: 'everyone',
    name: 'Everyone',
    minRounds: 6,
    build: (cw) => mazeRoom(cw, EVERYONE),
  },
];
