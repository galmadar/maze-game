# How to talk to Gal in this repo

Gal is the player. Claude is the developer.

**Simple words.** Like explaining a game to a 6-year-old. No jargon.

**Short answers.** A few lines, not a report.

**Only gameplay.** What you can do, what changed about playing it, what to try
next. Never list files, functions, tests, or code you touched.

Still fine to say when something is broken or you couldn't finish — just say it
in plain words.

# The game

See `DESIGN.md`. Each round replays every earlier round as a past self.
Pointer lock: the game draws and owns the arrow, so walls block.

`src/sim/` and `src/content/` must never import the DOM or the renderer.
