import { clockTicksFor, HARDNESS, roundLimitFor, type Hardness } from './content/hardness';
import { LEVELS } from './content/levels';
import type { RoomDef } from './content/types';
import { isTouchDevice, PointerInput } from './input/PointerInput';
import { Renderer, type DrawArrow } from './render/Renderer';
import { LevelRun, type TickReport } from './sim/LevelRun';
import { FAST_FORWARD_RATE, paceFrame, TICK_SECONDS } from './sim/Pacing';
import type { Frame } from './sim/types';
import { VictoryReplay } from './sim/VictoryReplay';
import * as audio from './audio/Audio';
import { getBestTime, getUnlockedCount, saveBestTime, unlockUpTo } from './storage';

const app = document.getElementById('app')!;

let hardness: Hardness = 'medium';

function render(html: string): void {
  app.innerHTML = paperDefs() + html;
}

/** One turbulence filter for every wobbly SVG on the page. */
function paperDefs(): string {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <filter id="soft" x="-8%" y="-8%" width="116%" height="116%">
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="9" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs></svg>`;
}

function arrowGlyph(color: string, opacity = 1): string {
  return `<svg width="17" height="24" viewBox="0 0 28 43" opacity="${opacity}" aria-hidden="true"><path d="M0 0 L0 38 L9 29 L15 43 L23 39 L17 26 L28 26 Z" fill="${color}"/></svg>`;
}

function soundIcon(color: string): string {
  return `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l4-3v12l-4-3H4z"/><path d="M15 8.5c1 1.5 1 4 0 5.5"/></svg>`;
}

function muteButtonHtml(id: string): string {
  return `<button id="${id}" class="plain">${soundIcon('currentColor')} ${audio.isMuted() ? 'sound off — press M' : 'sound on — press M'}</button>`;
}

function wireMuteButton(id: string, onToggle?: () => void): void {
  document.getElementById(id)!.addEventListener('click', () => {
    audio.toggleMuted();
    onToggle?.();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') audio.toggleMuted();
});

/** The three keys the game is played with, written on the paper so nobody has to be told. */
function keyHints(): string {
  return [
    ['space', 'done — start the next round'],
    ['shift', 'hold to hurry time along'],
    ['esc', 'pause'],
  ]
    .map(([key, what]) => `<span><b class="key">${key}</b> ${what}</span>`)
    .join('');
}

function showTouchBlocked(): void {
  render(`
    <div class="sheet">
      <div class="start-body">
        <h1>Maze Run</h1>
        <p class="lead">This game needs a mouse. Try it on a desktop.</p>
      </div>
    </div>
  `);
}

/** The whole idea of the game, sketched once in the corner of the sheet. */
function startSketch(): string {
  return `
    <div class="corner-sketch">
      <svg viewBox="0 0 400 470" aria-hidden="true">
        <g filter="url(#soft)" stroke="#2f3b4a" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.9">
          <path d="M40 40 H360 M40 40 V430 M360 40 V430 M40 430 H360"/>
          <path d="M120 40 V190 M120 280 V430 M200 130 H300 M200 130 V330 M280 330 H360"/>
        </g>
        <g opacity="0.35">
          <g filter="url(#soft)" transform="translate(74 300)">
            <path d="M0 0 L0 26 L6 20 L10 30 L16 27 L11 17 L19 17 Z" fill="#5a6675" stroke="#3f4a58" stroke-width="2" stroke-linejoin="round"/>
          </g>
          <text x="98" y="298" font-family="Caveat, cursive" font-size="20" font-weight="700" fill="#5a6675">1</text>
        </g>
        <g opacity="0.55">
          <g filter="url(#soft)" transform="translate(162 210)">
            <path d="M0 0 L0 26 L6 20 L10 30 L16 27 L11 17 L19 17 Z" fill="#5a6675" stroke="#3f4a58" stroke-width="2" stroke-linejoin="round"/>
          </g>
          <text x="186" y="208" font-family="Caveat, cursive" font-size="20" font-weight="700" fill="#5a6675">2</text>
        </g>
        <g filter="url(#soft)" transform="translate(248 250)">
          <path d="M0 0 L0 32 L8 25 L13 37 L20 34 L14 22 L24 22 Z" fill="#2f3b4a" stroke="#1d2733" stroke-width="2.4" stroke-linejoin="round"/>
        </g>
        <text x="278" y="250" font-family="Caveat, cursive" font-size="22" font-weight="700" fill="#2f3b4a">3</text>
        <g filter="url(#soft)"><rect x="300" y="360" width="50" height="50" rx="5" fill="none" stroke="#4d7548" stroke-width="4"/></g>
        <text x="325" y="435" text-anchor="middle" font-family="Caveat, cursive" font-size="22" font-weight="700" fill="#4d7548">out</text>
      </svg>
      <div class="corner-cap quiet">three of you, one way out</div>
    </div>
  `;
}

function showTitle(): void {
  render(`
    <div class="sheet">
      <div class="start-body">
        <h1>Maze Run</h1>
        <p class="lead" style="margin-top: 26px;">
          You play with a team of yourselves. Every round you play is recorded, and the next
          round they all run it again beside you.
        </p>
        <p class="note" style="margin-top: 14px;">You can’t beat a level alone. You beat it as the crowd.</p>
        <div class="start-row">
          <div class="picker">
            <div class="note">how hard?</div>
            <div class="row">
              ${(['easy', 'medium', 'hard'] as Hardness[])
                .map(
                  (h) =>
                    `<button class="pick ${h === hardness ? 'is-selected' : ''}" data-hardness="${h}">${HARDNESS[h].label.toLowerCase()}</button>`,
                )
                .join('')}
            </div>
          </div>
          <button class="primary" id="start-btn">Play →</button>
        </div>
      </div>
      ${startSketch()}
      <div class="sheet-foot">
        <span class="quiet">mouse only — no phone</span>
        ${muteButtonHtml('mute-btn')}
      </div>
    </div>
  `);
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-hardness]')) {
    btn.addEventListener('click', () => {
      hardness = btn.dataset.hardness as Hardness;
      showTitle();
    });
  }
  document.getElementById('start-btn')!.addEventListener('click', showLevelSelect);
  wireMuteButton('mute-btn', showTitle);
}

const CARD_MAZES = [
  'M110 40 V130 M180 90 H250 M180 90 V196',
  'M130 40 V120 M130 196 V160 M210 40 V130 M210 130 H304',
  'M110 40 V150 M190 90 V196 M250 40 V130',
];

type CardState = 'done' | 'next' | 'ready' | 'locked';

function levelCardArt(index: number, state: CardState): string {
  const inner = CARD_MAZES[index % CARD_MAZES.length];
  const paper = state === 'next' ? '#f0e2c0' : state === 'locked' ? '#e9ddc3' : '#efe3c9';
  const edge = state === 'next' ? '#c25b4a' : state === 'locked' ? '#8a7d63' : '#2f3b4a';
  const dash = state === 'locked' ? ' stroke-dasharray="13 9"' : '';
  const wallInk = state === 'locked' ? '#8a7d63' : '#2f3b4a';
  const mark =
    state === 'done'
      ? '<path d="M58 118 L86 150 L146 74" fill="none" stroke="#4d7548" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" filter="url(#soft)" opacity="0.9"/>'
      : state === 'locked'
        ? `<g filter="url(#soft)" transform="translate(154 96)">
             <rect x="0" y="14" width="36" height="28" rx="5" fill="none" stroke="#6b6250" stroke-width="3.4"/>
             <path d="M7 14 V9 a11 11 0 0 1 22 0 v5" fill="none" stroke="#6b6250" stroke-width="3.4" stroke-linecap="round"/>
           </g>`
        : state === 'next'
          ? '<g filter="url(#soft)"><circle cx="82" cy="150" r="17" fill="none" stroke="#c25b4a" stroke-width="3.4"/></g>'
          : '';
  return `
    <svg viewBox="0 0 344 236" aria-hidden="true">
      <rect x="5" y="5" width="334" height="226" rx="10" fill="${paper}" stroke="${edge}" stroke-width="4"${dash} filter="url(#soft)"/>
      <g filter="url(#soft)" stroke="${wallInk}" stroke-width="4" stroke-linecap="round" fill="none" opacity="0.6">
        <path d="M40 40 H304 M40 40 V196 M304 40 V196 M40 196 H304"/>
        <path d="${inner}"/>
      </g>
      <g filter="url(#soft)"><rect x="258" y="150" width="34" height="34" rx="4" fill="none" stroke="#4d7548" stroke-width="3.4"/></g>
      ${mark}
    </svg>
  `;
}

function showLevelSelect(): void {
  const unlocked = getUnlockedCount();
  // "you're here" belongs on one card only: the first one open but not yet beaten.
  const nextIndex = LEVELS.findIndex((lvl, i) => i < unlocked && getBestTime(lvl.id, hardness) === null);
  render(`
    <div class="sheet">
      <div class="head-row">
        <div>
          <h2>Pick a level</h2>
          <p class="note" style="margin-top: 8px;">${HARDNESS[hardness].label.toLowerCase()}</p>
        </div>
        <button id="back-btn" class="plain">← back</button>
      </div>
      <div class="levels">
        ${LEVELS.map((lvl, i) => {
          const best = getBestTime(lvl.id, hardness);
          const locked = i >= unlocked;
          const state: CardState = locked ? 'locked' : best !== null ? 'done' : i === nextIndex ? 'next' : 'ready';
          const foot = locked
            ? `<div class="level-locked">finish ${i} first</div>`
            : best !== null
              ? `<div class="level-best">best ${best.toFixed(2)}s</div>`
              : state === 'next'
                ? '<div class="level-locked" style="color: var(--red);">you’re here</div>'
                : '<div class="level-locked">not played yet</div>';
          return `<button class="level-card" data-level="${lvl.id}" ${locked ? 'disabled' : ''}>
            ${levelCardArt(i, state)}
            <div class="level-name">
              <b>${i + 1}. ${lvl.name}</b>
              <span class="note">${roundLimitFor(lvl.minRounds, HARDNESS[hardness])} rounds</span>
            </div>
            ${foot}
          </button>`;
        }).join('')}
      </div>
    </div>
  `);
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-level]')) {
    btn.addEventListener('click', () => startLevel(btn.dataset.level!));
  }
  document.getElementById('back-btn')!.addEventListener('click', showTitle);
}

function startLevel(levelId: string): void {
  const def = LEVELS.find((l) => l.id === levelId);
  if (!def) return;
  const hc = HARDNESS[hardness];
  const room = def.build(hc.corridorWidth);
  const clockTicks = clockTicksFor(hc);
  const roundLimit = roundLimitFor(def.minRounds, hc);
  runLevel(def.id, def.name, room, clockTicks, roundLimit);
}

function runLevel(
  levelId: string,
  levelName: string,
  room: ReturnType<(typeof LEVELS)[number]['build']>,
  clockTicks: number,
  roundLimit: number,
): void {
  render(`
    <div id="game-wrap">
      <canvas id="canvas"></canvas>
      <div id="hud-top">
        <div>
          <div class="hud-title">${levelName}</div>
          <div class="hud-sub">round <span id="hud-round">1</span> of ${roundLimit}</div>
        </div>
        <div class="hud-clock">
          <div class="hud-clock-head">
            <span>clock — as long as you want it<span id="hud-ff" class="ff hidden"> · hurrying ×${FAST_FORWARD_RATE}</span></span>
            <span id="hud-time">0.00s</span>
          </div>
          <div class="clock-track"><div id="hud-clock-bar" class="clock-bar"></div></div>
        </div>
        <div class="hud-right">
          ${muteButtonHtml('mute-btn')}
          <div class="hud-keys">${keyHints()}</div>
        </div>
      </div>
      <div class="legend">
        <span>${arrowGlyph('#2f3b4a')} you</span>
        <span>${arrowGlyph('#5a6675', 0.45)} the ones before you</span>
        <span>click the maze to take the mouse</span>
      </div>
      <div id="pause-overlay" class="hidden">
        <p class="paused">Paused</p>
        <p class="note">click to carry on</p>
        <div class="hud-keys pause-keys">${keyHints()}</div>
        <button id="quit-btn" class="boxed">back to the levels</button>
      </div>
    </div>
  `);
  wireMuteButton('mute-btn');

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const renderer = new Renderer(canvas, {
    top: document.getElementById('hud-top'),
    bottom: document.querySelector<HTMLElement>('.legend'),
  });
  const run = new LevelRun(room, clockTicks, roundLimit);

  let prevDown = false;
  let lastTickSecond = -1;
  let stopped = false;
  let hurrying = false;
  let endRoundAsked = false;

  const input = new PointerInput(canvas, (locked) => {
    document.getElementById('pause-overlay')!.classList.toggle('hidden', locked);
    // Let go of both keys on pause — a key held when the mouse was taken away
    // would otherwise still be "down" when the player comes back.
    if (!locked) {
      hurrying = false;
      endRoundAsked = false;
    }
  });

  // Space ends the round, shift hurries the whole sim along. Space because it is
  // the one key a hand on the mouse can hit blind; shift because it is the usual
  // "faster" key and, unlike a letter, it does nothing on its own.
  const onKeyDown = (e: KeyboardEvent): void => {
    if (!input.isLocked()) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) endRoundAsked = true; // one press, one round — not one per repeat
    } else if (e.key === 'Shift') {
      hurrying = true;
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === 'Shift') hurrying = false;
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  function onBlur(): void {
    hurrying = false;
  }

  function teardown(): void {
    stopped = true;
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    input.dispose();
    renderer.dispose();
  }

  document.getElementById('quit-btn')!.addEventListener('click', (e) => {
    e.stopPropagation(); // don't let the overlay grab the mouse again
    teardown();
    showLevelSelect();
  });
  const takeMouse = (): void => {
    audio.resumeAudio();
    input.requestLock();
  };
  canvas.addEventListener('click', takeMouse);
  document.getElementById('pause-overlay')!.addEventListener('click', takeMouse);
  audio.playRoundStart();

  // Paint once up front, so the room is on the paper before the first tick.
  renderer.draw(room, run.roomState, [{ frame: run.liveFrame, alpha: 1 }]);

  let carry = 0;
  let last = performance.now();

  function handleTickAudio(secondsLeft: number, requestedMove: number, actualMove: number, down: boolean): void {
    const secondBucket = Math.ceil(secondsLeft);
    if (secondsLeft <= 3 && secondBucket !== lastTickSecond) {
      lastTickSecond = secondBucket;
      audio.playTick();
    }
    if (down !== prevDown) {
      if (down) audio.playButtonPress();
      else audio.playButtonRelease();
      prevDown = down;
    }
    if (requestedMove > 1 && actualMove < requestedMove * 0.3) audio.playWallBump();
  }

  /** Round bookkeeping and sound. True when the level is over and the loop must stop. */
  function handleRoundOver(report: TickReport): boolean {
    if (!report.roundOver) return false;
    if (report.won) {
      audio.playLevelWinJingle();
      finishWin(levelId, levelName, run.elapsedSeconds());
      return true;
    }
    audio.playRoundEndWhoosh();
    lastTickSecond = -1;
    if (report.ranOutOfRounds) {
      finishOutOfRounds(levelId, levelName);
      return true;
    }
    audio.playRoundStart();
    return false;
  }

  function frame(now: number): void {
    if (stopped) return;
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;

    // Hurrying runs MORE ticks per animation frame, never bigger ones, so the
    // recording and the score come out exactly as they would at normal speed.
    const paced = paceFrame(carry, dt, hurrying ? FAST_FORWARD_RATE : 1);
    carry = paced.carry;

    if (paced.ticks > 0 && input.isLocked()) {
      const raw = input.consumeTick();
      // Mouse movement is screen pixels; the room is drawn scaled up to fill the window.
      // One reading spreads over a NORMAL frame's ticks, so a tick of input means
      // the same thing whether or not the player is hurrying.
      const dx = raw.dx / paced.baseTicks / renderer.scale;
      const dy = raw.dy / paced.baseTicks / renderer.scale;
      for (let i = 0; i < paced.ticks; i++) {
        if (endRoundAsked) {
          endRoundAsked = false;
          if (handleRoundOver(run.endRound())) return;
          continue; // the rest of this frame's ticks belong to the new round
        }
        const before = run.liveFrame;
        const report = run.tick({ dx, dy, down: raw.down });
        const actualMove = Math.hypot(report.frame.x - before.x, report.frame.y - before.y);
        const requestedMove = Math.hypot(dx, dy);
        const secondsLeft = (run.clockTicks - run.tickIndex) * TICK_SECONDS;
        handleTickAudio(secondsLeft, requestedMove, actualMove, report.frame.down);
        if (handleRoundOver(report)) return;
      }
    }

    document.getElementById('hud-round')!.textContent = String(run.round);
    document.getElementById('hud-time')!.textContent = `${run.elapsedSeconds().toFixed(2)}s`;
    document.getElementById('hud-ff')!.classList.toggle('hidden', !hurrying);
    const pct = Math.max(0, 100 - (run.tickIndex / run.clockTicks) * 100);
    document.getElementById('hud-clock-bar')!.style.width = `${pct}%`;

    const arrows: DrawArrow[] = run.pastSelfFrames().map((frame, i) => ({
      frame,
      label: String(i + 1),
      alpha: 0.45,
    }));
    arrows.push({ frame: run.liveFrame, alpha: 1 });
    renderer.draw(room, run.roomState, arrows);

    requestAnimationFrame(frame);
  }

  function finishWin(id: string, name: string, seconds: number): void {
    teardown();
    const best = saveBestTime(id, hardness, seconds);
    const idx = LEVELS.findIndex((l) => l.id === id);
    unlockUpTo(idx + 2);
    // The winning round is still sitting in currentRecording — it never became a
    // replay, because the level ended before the round could roll over.
    showVictoryReplay({
      levelId: id,
      levelIndex: idx,
      name,
      room,
      recordings: [...run.replays, run.currentRecording],
      seconds,
      best,
    });
  }

  function finishOutOfRounds(id: string, name: string): void {
    teardown();
    render(`
      <div class="sheet">
        <div class="start-body">
          <h1>Out of rounds</h1>
          <p class="lead" style="margin-top: 20px;">${name} starts over from round 1.</p>
          <div class="row" style="margin-top: 36px;">
            <button id="retry-btn" class="primary">Try again</button>
            <button id="select-btn" class="boxed">the levels</button>
          </div>
        </div>
      </div>
    `);
    document.getElementById('retry-btn')!.addEventListener('click', () => startLevel(id));
    document.getElementById('select-btn')!.addEventListener('click', showLevelSelect);
  }

  requestAnimationFrame(frame);
}

interface WinScreen {
  levelId: string;
  levelIndex: number;
  name: string;
  room: RoomDef;
  /** Every round of the run, oldest first; the last one is the round that got out. */
  recordings: Frame[][];
  seconds: number;
  best: number;
}

/**
 * The payoff. The premise of the game is that you beat it as a crowd, and until
 * this screen the player never gets to watch the crowd do it — during play they
 * are busy being one of them. So the whole run plays again, every self at once,
 * looping until a button is pressed.
 *
 * The room comes from `VictoryReplay.roomState`, which is the sim's own answer:
 * a door drawn open here is a door that really was open.
 */
function showVictoryReplay(win: WinScreen): void {
  const hasNext = win.levelIndex + 1 < LEVELS.length;
  // The writing lives in the margins, top and bottom, and the room is fitted
  // between them — the replay is the point, the words are the caption.
  render(`
    <div id="game-wrap">
      <canvas id="canvas"></canvas>
      <div id="hud-top">
        <div>
          <div class="hud-title">${win.name} — out!</div>
          <div class="hud-sub">everyone you were, all at once — over and over</div>
        </div>
        <div class="win-score">
          <div class="win-time">${win.seconds.toFixed(2)}s</div>
          <div class="hud-sub">best so far ${win.best.toFixed(2)}s</div>
        </div>
      </div>
      <div class="win-foot">
        <div class="legend-inline">
          <span>${arrowGlyph('#2f3b4a')} the round that got out</span>
          <span>${arrowGlyph('#5a6675', 0.45)} the ones before</span>
        </div>
        <div class="row">
          ${hasNext ? '<button id="next-btn" class="primary">Next →</button>' : ''}
          <button id="retry-btn" class="boxed">again</button>
          <button id="select-btn" class="boxed">the levels</button>
        </div>
      </div>
    </div>
  `);

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const renderer = new Renderer(canvas, {
    top: document.getElementById('hud-top'),
    bottom: document.querySelector<HTMLElement>('.win-foot'),
  });
  const replay = new VictoryReplay(win.room, win.recordings);

  let raf = 0;
  let stopped = false;
  let carry = 0;
  let last = performance.now();

  // The only thing left running is the animation frame — the beat between loops
  // is counted in sim ticks, so there is no timer to forget about either.
  function stop(): void {
    stopped = true;
    cancelAnimationFrame(raf);
    renderer.dispose();
  }

  function leave(go: () => void): (e: Event) => void {
    return (e) => {
      e.stopPropagation();
      stop();
      go();
    };
  }

  document.getElementById('retry-btn')!.addEventListener('click', leave(() => startLevel(win.levelId)));
  document.getElementById('select-btn')!.addEventListener('click', leave(showLevelSelect));
  document
    .getElementById('next-btn')
    ?.addEventListener('click', leave(() => startLevel(LEVELS[win.levelIndex + 1].id)));

  function drawReplay(): void {
    // Same arrows as in play: the round that got out is drawn as "you", last so
    // it sits on top; the earlier rounds are the faded, numbered past selves.
    const arrows: DrawArrow[] = replay
      .frames()
      .map((frame, i) => (i === replay.winnerIndex ? { frame, alpha: 1 } : { frame, label: String(i + 1), alpha: 0.45 }));
    renderer.draw(win.room, replay.roomState, arrows);
  }

  function frame(now: number): void {
    if (stopped) return;
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    const paced = paceFrame(carry, dt);
    carry = paced.carry;
    for (let i = 0; i < paced.ticks; i++) replay.advance();
    drawReplay();
    raf = requestAnimationFrame(frame);
  }

  drawReplay();
  raf = requestAnimationFrame(frame);
}

if (isTouchDevice()) {
  showTouchBlocked();
} else {
  showTitle();
}
