# Maze Run — design

You play with a team of yourselves. Every round you play is recorded, and in the
next round all your earlier selves play again beside you, doing exactly what you
did. You can't beat a level alone; you beat it as the crowd.

Closest known game: *Cursor\*10* (Nekogames, 2008).

## The pointer

Browsers never let a page move the real mouse pointer. What they do allow is
**pointer lock**: after one click, the page hides the real pointer and gets the
raw mouse movement. The game draws its own arrow, looking just like the real one,
and moves it.

Because the game owns that arrow, **walls really block**, like in any maze.
Esc always gives the real pointer back (the browser makes sure of it), and that
pauses the game.

Past selves are drawn with the same arrow, faded, with a round number next to it.

## Levels and rounds

- The game is a list of **levels**. Each level is one maze room with an exit.
- Each round has its own **clock**, and **every round is longer than the last**.
  Round 1 is 5 seconds, round 2 is 10, round 3 is 15, and so on.
- That clock is a **ceiling, not a duration**. A round ends the moment you say you
  are done — press **space** — or when the clock runs out, whichever comes first.
  Time goes back to 0, the next round starts, and everything in the room resets.
- Standing about waiting for the clock is the thing the game must never make you do.
  Space is the cure when you have finished; **hold shift** is the cure when you
  haven't, because you are waiting for a past self to walk somewhere. Shift runs the
  whole simulation faster — more ticks per drawn frame, never bigger ones — so the
  recording and the time come out exactly as they would at normal speed. Your own
  arrow speeds up with everything else, which is awkward to steer; it is meant for
  use while parked.
- All earlier rounds play back at the same time as you, from second 0.
- The level is won the moment **any** arrow — you or a past self — reaches the exit.
- Each level has a **round limit**. Run out of rounds and the level starts over
  from round 1 with no past selves.

Timing is the puzzle. Your first round is short, so early selves can only do one
small job — walk somewhere and hold. Later rounds are long enough to use what they
set up, and long enough to go wrong.

## Things in the room

| Thing | Built? | How it works |
|---|---|---|
| **Hold button** | yes | A door is open only while some arrow holds the mouse button down on it. |
| **Weight plate** | yes | A square on the floor that counts arrows. Its door is open only while 2 or 3 of them stand on it together. No click needed — standing there is enough. |
| **Click switch** | yes | A lever in a box. One click flips it on and it **stays** on — nobody has to wait by it. Clicking again flips it back, and every arrow's click counts. |
| **Timer door** | yes | A pad with a ring of time on it. A click opens its door for a few seconds and then lets it shut. Clicking again starts the few seconds over, it never adds up. |
| **Key** | yes | A key lying on the floor. Click to pick it up, click again to put it down. It goes wherever its carrier goes. |
| **Lock** | yes | A keyhole on the floor. A key touching it opens its door, and that door stays open for good. |
| **Pressure plate** | not yet | Open while some arrow rests on it. No click needed. |
| **Crusher** | not yet | Closes on any arrow under it. That arrow is out for the rest of the round. |

A door lists what opens it, and is open while **any** of those is satisfied — so one
door can have a button *and* a plate, and either will do. A switch, a timer or a lock
goes on the same list: there is one question, "is this door open", and one answer.

Every arrow on a plate counts the same: you, and every past self, whether or not it is
holding the mouse button. Which is the whole point — you cannot stand on a 2-plate
alone. Someone you used to be has to still be standing there.

### A click is the tick the button goes down

The hold button and the plate ask "is it down now". The three newer things ask
something different: **did somebody click**, meaning the one tick a mouse button went
from up to down. That is why a self parked on a switch with the button held flips it
once, not sixty times a second, and why a self that froze holding the button is not
flipping it for ever.

### The switch: your own crowd is the obstacle

Every click flips it, yours and every past self's, and it stays where it was put. So a
round that walks over and flips it on is a round that has done its job and can walk
away — nobody is parked. But the next round your earlier self walks over and flips it
**again**. Counting how many of your selves touch that switch is the puzzle.

Two selves clicking it on the same tick cancel out. The room only ever counts the
clicks and asks whether the number is odd.

### The timer door: a relay, not a hold

A click buys a few seconds and the door shuts again. One arrow usually cannot click it
and be through in time, so the job splits in two: one self clicks, while another —
already standing at the door when that click happens again — walks through. That is
the point of it, and the reason it is not just a hold button with extra steps.

Re-clicking while it is still open **restarts** the few seconds. It never stacks, so
you cannot bank time by clicking at it.

### The key: something that moves

Everything else in the room is nailed down. A key is not: click it to pick it up, click
again to put it down, carry it onto a lock and the lock is open for good.

The interesting part is what that does to a past self. A self that picked up the key
picks it up again next round, at the same tick, and **carries it round the room on its
own** while you are busy elsewhere. And a self that ran out of recording with the key
in its hand freezes holding it — so the key freezes too, out in the middle of the
floor where that self happened to stop. Nobody can take it off them. Planning where
your selves put the key down is the whole of it.

A hand holds one key. An arrow is not a key: standing on a lock does nothing.

Past selves always do exactly what they did, even when it no longer makes sense. If a
crusher gets one, it stops there. Getting in each other's way is part of the game.

Because rounds get longer, an early self **runs out of things to do** before the round
ends. When that happens it **stops where it finished and stands there**, still doing
whatever it was doing — if it was holding a button down, it goes on holding it. A short
first round makes a good doorstop.

Ending a round early rides on exactly that. A round you cut short at 2 seconds is a
2-second recording, and from second 2 onwards that self is frozen — holding its button,
weighing down its plate — for the rest of every later round. So cutting a round short
costs you nothing except the time you didn't spend.

## The levels

Levels 1-3 are one straight corridor: nothing to read but the doors. From 4 on the
rooms are proper little mazes — corners, branches and dead ends — and the corridor
width from the hardness table is how wide their passages are.

Each level's **minimum rounds** is the fewest it can actually be beaten in; the round
limit adds the hardness table's spare rounds on top. Hard gives none, so on hard every
round has to count.

**The rule for the whole list: each level has to ask something none of the others do.**
Not another room with one of each thing in it — a question. Where two of them turned
out to ask the same one, one of them was cut.

### Learning to be a crowd (1-6)

| # | Level | What it asks | Rounds |
|---|---|---|---|
| 1 | **Hello** | Just move. | 1 |
| 2 | **Hold the door** | Somebody has to stay on the button. | 2 |
| 3 | **Relay** | Three doors, each button behind the last one. | 4 |
| 4 | **Heavy** | A plate for two: you cannot open it alone. | 3 |
| 5 | **Dead ends** | Two plates, one behind the other, in a maze of wrong turns. | 5 |
| 6 | **The crowd** | A 2-plate opens the way to a 3-plate. Everyone you have. | 6 |

### One new thing each (7-9)

| # | Level | What it asks | Rounds |
|---|---|---|---|
| 7 | **Flip it** | A switch stays flipped — unlike a button, nobody stays behind. | 1 |
| 8 | **Carry it** | Take the key to the lock and the door is open for good. | 1 |
| 9 | **In a hurry** | The pad is a room away from its door: the clicker is never the one who goes through. | 2 |

### Crossing them (10-20)

| # | Level | What it asks | Rounds |
|---|---|---|---|
| 10 | **Two jobs** | Flipping is free; holding costs a self. One round does both, in that order. | 2 |
| 11 | **In and out** | In through the window, take the key, and back out before it shuts. | 2 |
| 12 | **Hands full** | A hand with a key in it cannot click, so the carrier can never be the clicker. | 2 |
| 13 | **Keep it open** | One pad, two doors a corridor apart. Clicking again restarts the light — go back and do it. | 2 |
| 14 | **Let go** | Pressing a button IS a click, so it drops the key. Fine, once the lock is open. | 2 |
| 15 | **Either way** | One door, a button and a switch. Spend a self, or walk six cells further. | 3 |
| 16 | **Two to fetch** | The key is behind the crowd: two on the plate before anyone can reach it. | 3 |
| 17 | **Only one of you** | The switch is in the corridor all three of you walk down. Exactly one may click it. | 3 |
| 18 | **Two at once** | The key is lying on the switch. One click does both, and there is no doing one alone. | 3 |
| 19 | **Chain** | Two timer doors, the second pad shut in behind the first. | 3 |
| 20 | **Two keys** | A hand holds one key. Put the first down before you can pick the second up. | 3 |

### Everything at once (21-26)

| # | Level | What it asks | Rounds |
|---|---|---|---|
| 21 | **Through together** | Two of you have to catch the same window to fill one plate. | 4 |
| 22 | **Crossroads** | Four arms, a different job down three of them. Which of you can afford which? | 4 |
| 23 | **The hall** | No corridors at all — an open floor with pillars, and nothing telling you where to go. | 4 |
| 24 | **Hold it open** | A plate, a button behind its door, and a key run for whoever is left. | 4 |
| 25 | **The long way** | Button, key, lock, and a plate for three, in one line. Nobody spare. | 5 |
| 26 | **Everyone** | Six of you, six jobs, not one of them the same. | 6 |

### What a round count is allowed to rest on

A level's minimum rounds has to be forced by the room, not by the clock — the clock is
three times longer on easy than on hard, so anything resting on it is only true on hard.
The things that really do cost a round:

- a **hold button**, which costs the self that stands on it for ever;
- a **plate**, which costs one self per arrow it needs;
- a **timer pad** far enough from its door that the walk takes longer than the light
  lasts — and note that clicking again only moves the light along with you, so no
  amount of clicking shortens that walk;
- a **key in a hand**, because that hand cannot click anything at all.

A switch costs nothing: one self flips it and walks on. So a switch never adds a round
by itself, only interest.

**What a round count may NOT rest on: somebody being shut in behind a timer door.** A
self parked on a pad can click it over and over, so a timer door can be held open for a
whole round — and on easy that round is eight seconds long. Two levels were built on
that mistake and had to be corrected.

## Hardness

| | Easy | Medium | Hard |
|---|---|---|---|
| Each round longer than the last by | 8s | 5s | 3s |
| So rounds 1, 2, 3 run | 8s, 16s, 24s | 5s, 10s, 15s | 3s, 6s, 9s |
| Spare rounds over the minimum | +3 | +1 | 0 |
| Corridor width | wide | normal | narrow |

Hardness sets how fast the clock grows: on Easy every round gives you a lot more time
than the one before, on Hard only a little. Medium is the plain 5-second step.

Every number lives in one config file — including the two the newer things are made of:

| Number | Now | What it decides |
|---|---|---|
| **Timer door, seconds open** | 3 | How long one click keeps a timer door open. Turn it down and a relay has to be tighter; turn it up and one arrow starts being able to do it alone. A room can override it for one pad. |
| **Key reach** | 30 | How near an arrow has to be to a key to pick it up. A bit wider than the arrow itself, so you don't have to be exact. |

The same hardness that makes passages narrower does **not** shorten the timer. How far
apart the pad and its door are is the level's job, not the hardness table's.

## Recording and replay

A past self is a list of what the arrow did at each game tick: where it was, and
whether the button was down. Playback puts it exactly there — it does not replay
raw mouse movement, so it can't drift.

A recording is **as long as the round actually lasted**, not as long as its clock.
End a round at second 2 of a 15-second clock and the recording is 2 seconds; past
that it is the freeze above.

The game runs on fixed ticks (60 a second), so the same inputs always give the same
result. That lets the tests play a level from recordings.

**The room is worked out from those frames, never kept alongside them.** A button or a
plate only needs this tick's frames. A switch, a timer, a carried key or an opened lock
needs the ones before as well — so the game reads them forward from tick 0 of the
round, out of the frames and nothing else, and keeps no running tally of its own. Ask
the same recordings twice and you get the same room both times. That is what makes the
victory replay below possible at all: a switch that remembered its own state would look
right while you played and wrong when you watched it back.

Frames are always kept in **round order** — the earliest self first, you last — in play
and in the replay alike. It is how a key knows whose hand it is in from one tick to the
next, and from play into the replay.

The simulation has **no clock of its own** — it only ever advances one fixed tick at
a time, and is handed those ticks by the drawing loop. That is what makes fast-forward
safe: holding shift makes the loop hand over three ticks per drawn frame instead of
one, and a tick is a tick. A recording made hurrying and one made at normal speed
from the same input are identical, ticks for ticks, and a test proves it.

## Winning: the run, played back

The premise is that you beat a level **as a crowd**, and while you are playing you
never get to see it — you are busy being one of them. So the moment you win, the
whole run plays again on the same sheet: every round you recorded, plus the round
that got out, all moving at once from second 0. Doors swing as they are held, plates
go green as selves stand on them, and the winning arrow reaches the way out. Then it
waits a beat on that frame and **starts again from zero**, looping until you press a
button.

It is **your run and nothing else**. Nothing is worked out or made up for it: every
arrow, the winning one included, is a recording being read back, exactly the way a
past self is read back in play. The room is asked of the simulation from those same
frames, so there is only ever one answer to "is this door open" — a door drawn open
in the replay is a door that really was open.

That goes for the things that remember, too. The switch flips on the tick it flipped,
the timer shows the seconds it had left, the key is in the hand it was in and on the
floor where it was dropped. None of it is replayed from a note the live game kept; it
is read forward out of the recordings, the same way play read it. A test walks the two
side by side, tick for tick, and they have to agree on everything.

The result — the time, and your best — is written in the margins, above and below,
so it reads as a caption and never covers the maze. The buttons (next, again, the
levels) sit in the bottom margin beside it, and pressing any of them stops the loop.

The waiting beat between loops is counted in **sim ticks**, like everything else, so
there is no second clock anywhere in the game.

## How it's built

A brother of `cranes-game`: TypeScript + Vite, same rule.

- `src/sim/` — rules: rooms, things, clock, rounds, recording and replay, and how many ticks a drawn frame is worth. The things that remember something are folded out of the frames here, and only here. No drawing, no browser. Tested.
- `src/content/` — the room shapes (a straight corridor, and a maze), the level list and the hardness table.
- `src/render/` — draws on a 2D canvas. No three.js; the game is flat.
- `src/input/` — pointer lock, turning mouse events into moves and button presses for the sim.

`npm test` checks that `sim/` and `content/` never touch the DOM or the renderer.

## Score

**Fastest time.** A level's time is the time you **actually spent**: every tick of
every round you played, added up, stopping the moment an arrow reaches the exit. A
round you ended after 2 seconds costs 2 seconds, not its whole clock.

So there are two ways to get a better time, and both are the player doing something
rather than waiting: use fewer rounds, and finish each round sooner. Standing about
watching a clock run down now costs exactly what it looks like it costs.

Best time per level and hardness is saved in the browser. The saved-time key carries
a version, bumped when this rule changed — times measured on full clocks can't be
compared with times measured this way, so the old ones are left behind rather than
sitting there unbeatable.

## Platform

Desktop only, with a mouse. No phone or touch support. On a touch device the game
says so and doesn't start.

## Open questions for Gal

- Sound in the first version?
