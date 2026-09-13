# Maze Run — design

The mouse pointer *is* the player. No avatar, no custom cursor: the little arrow
you already have is the thing being chased.

## The one hard fact everything bends around

A web page cannot move or stop your real pointer. So walls can't block you — they
**hurt** you. Touching a wall, or leaving the game window, is a hit.

To stop cheating by flicking the mouse across a wall, we check the whole line
between two mouse positions, not just where it landed.

## A run

1. Pick hardness: **Easy / Medium / Hard**.
2. Park the pointer on the glowing **start pad**. The round only begins once you're
   on it (we can't put the pointer there for you).
3. Play rounds until you run out of hearts (3).
4. Score = how deep into the maze you got.

## A round (~10 seconds)

Each round the screen says one short order — *CLICK*, *HOLD*, *GO*, *FREEZE* — and a
timer bar drains. Do it before the bar empties and a new piece of maze opens up.
Fail and you lose a heart and replay that round.

Meanwhile **the Dark** creeps in from the edges and follows the pointer. It never
stops, so dawdling is dangerous even when the order is easy.

| Order | What you do |
|---|---|
| **GO** | Get to the exit door without touching walls. |
| **CLICK** | Click the 3 keys scattered in the corridor, in any order. |
| **HOLD** | Hold the mouse button down on a door until it opens (~2s). Let go and it closes. |
| **FREEZE** | Don't move at all. A searchlight sweeps past — any wiggle and it sees you. |
| **FOLLOW** | Stay inside a firefly's glow while it flies through the maze. |
| **DOUBLE** | Double-click switches to flip bridges over gaps. |
| **SQUEEZE** | Corridor narrows to a few pixels. Slow hands. |

New orders unlock as you go deeper; early rounds are only GO and CLICK.

## Hardness

| | Easy | Medium | Hard |
|---|---|---|---|
| Round time | 14s | 10s | 7s |
| Corridor width | wide | normal | narrow |
| Dark speed | slow | normal | fast |
| Wall touch | lose a heart, keep going | lose a heart, replay round | lose a heart, replay round |

All numbers live in one config file so they're easy to tune.

## Getting deeper

The maze is one big map that grows. Each won round opens the next chunk and the
view slides over to it. Every 5 rounds is a new **zone** with its own look and one
new order — so "levels" are zones, and progress is visible as the map you've opened.

Mazes are generated from a seed, so the same seed gives the same maze (handy for
"beat my score on this one").

## How it's built

A brother of `cranes-game`: TypeScript + Vite, same shape, same rule.

- `src/sim/` — the game rules: maze, rounds, orders, the Dark, scoring. Plain logic,
  no drawing, no browser. Fully tested.
- `src/content/` — the order list, zones, hardness table.
- `src/render/` — draws it on a 2D canvas. No three.js; this game is flat.
- `src/input/` — turns mouse events into `move / down / up / leave` for the sim.

`npm test` enforces that `sim/` and `content/` never touch the drawing or the DOM.

## Open questions for Gal

- Touch screens: skip them (no hover on a phone), or make finger = pointer?
- Sound: yes/no for the first version?
- The Dark as the chaser — or something with a face (a ghost, a cat)?
