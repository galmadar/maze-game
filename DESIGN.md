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
- A **round** is one run of that clock. When it runs out, time goes back to 0 and
  the next round starts. Everything in the room resets.
- All earlier rounds play back at the same time as you, from second 0.
- The level is won the moment **any** arrow — you or a past self — reaches the exit.
- Each level has a **round limit**. Run out of rounds and the level starts over
  from round 1 with no past selves.

Timing is the puzzle. Your first round is short, so early selves can only do one
small job — walk somewhere and hold. Later rounds are long enough to use what they
set up, and long enough to go wrong.

## Things in the room

| Thing | How it works |
|---|---|
| **Hold button** | A door is open only while some arrow holds the mouse button down on it. |
| **Click switch** | One click flips a door or bridge. Clicking again flips it back. |
| **Pressure plate** | Open while some arrow rests on it. No click needed. |
| **Weight plate** | Needs 2 or 3 arrows on it together. |
| **Timer door** | A click opens it for a few seconds. |
| **Crusher** | Closes on any arrow under it. That arrow is out for the rest of the round. |
| **Key** | Click to pick it up, then carry it to a lock. |

Past selves always do exactly what they did, even when it no longer makes sense. If a
crusher gets one, it stops there. Getting in each other's way is part of the game.

Because rounds get longer, an early self **runs out of things to do** before the round
ends. When that happens it **stops where it finished and stands there**, still doing
whatever it was doing — if it was holding a button down, it goes on holding it. A short
first round makes a good doorstop.

## First levels (to teach one thing at a time)

1. **Hello** — a clear path to the exit. Just move.
2. **Hold the door** — a hold button, and a door behind it. Needs 2 rounds.
3. **Relay** — three doors in a row, each button behind the last door. 3 rounds.
4. **Heavy** — a 2-arrow weight plate plus a hold button. 3 rounds.
5. **Crusher hall** — one self stands on a plate that stops the crusher while the others run.

After that levels mix things up, and the round limit gets tighter.

## Hardness

| | Easy | Medium | Hard |
|---|---|---|---|
| Each round longer than the last by | 8s | 5s | 3s |
| So rounds 1, 2, 3 run | 8s, 16s, 24s | 5s, 10s, 15s | 3s, 6s, 9s |
| Spare rounds over the minimum | +3 | +1 | 0 |
| Corridor width | wide | normal | narrow |

Hardness sets how fast the clock grows: on Easy every round gives you a lot more time
than the one before, on Hard only a little. Medium is the plain 5-second step.

Every number lives in one config file.

## Recording and replay

A past self is a list of what the arrow did at each game tick: where it was, and
whether the button was down. Playback puts it exactly there — it does not replay
raw mouse movement, so it can't drift.

The game runs on fixed ticks (60 a second), so the same inputs always give the same
result. That lets the tests play a level from recordings.

## How it's built

A brother of `cranes-game`: TypeScript + Vite, same rule.

- `src/sim/` — rules: rooms, things, clock, rounds, recording and replay. No drawing, no browser. Tested.
- `src/content/` — the level list and hardness table.
- `src/render/` — draws on a 2D canvas. No three.js; the game is flat.
- `src/input/` — pointer lock, turning mouse events into moves and button presses for the sim.

`npm test` checks that `sim/` and `content/` never touch the DOM or the renderer.

## Score

**Fastest time.** A level's time adds up every round you played: each full clock you
used up — and they get longer — plus how far into the last round an arrow reached the
exit. Using fewer rounds gives a better time on its own, and it counts for more now
that a late round costs so much. Best time per level and hardness is saved in the
browser.

## Platform

Desktop only, with a mouse. No phone or touch support. On a touch device the game
says so and doesn't start.

## Open questions for Gal

- Sound in the first version?
