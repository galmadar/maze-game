import { clockTicksFor, HARDNESS, roundLimitFor, type Hardness } from './content/hardness';
import { LEVELS } from './content/levels';
import { isTouchDevice, PointerInput } from './input/PointerInput';
import { Renderer, type DrawArrow } from './render/Renderer';
import { LevelRun } from './sim/LevelRun';
import * as audio from './audio/Audio';
import { getBestTime, getUnlockedCount, saveBestTime, unlockUpTo } from './storage';

const app = document.getElementById('app')!;

let hardness: Hardness = 'medium';

function render(html: string): void {
  app.innerHTML = html;
}

function muteButtonHtml(id: string): string {
  return `<button id="${id}">${audio.isMuted() ? '🔇 muted (M)' : '🔊 sound (M)'}</button>`;
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

function showTouchBlocked(): void {
  render(`
    <div class="screen">
      <h1>Maze Run</h1>
      <p>This game needs a mouse. Try it on a desktop.</p>
    </div>
  `);
}

function showTitle(): void {
  render(`
    <div class="screen">
      <h1>Maze Run</h1>
      <p class="dim">You play with a team of yourselves. Every round replays beside you.</p>
      <div class="row">
        ${(['easy', 'medium', 'hard'] as Hardness[])
          .map((h) => `<button class="pick ${h === hardness ? 'is-selected' : ''}" data-hardness="${h}">${HARDNESS[h].label}</button>`)
          .join('')}
      </div>
      <button class="primary" id="start-btn">Play</button>
      ${muteButtonHtml('mute-btn')}
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

function showLevelSelect(): void {
  const unlocked = getUnlockedCount();
  render(`
    <div class="screen">
      <h1>Choose a level — ${HARDNESS[hardness].label}</h1>
      <div class="row">
        ${LEVELS.map((lvl, i) => {
          const best = getBestTime(lvl.id, hardness);
          const locked = i >= unlocked;
          return `<button class="pick" data-level="${lvl.id}" ${locked ? 'disabled' : ''}>
            ${i + 1}. ${lvl.name}${locked ? ' 🔒' : ''}
            ${best !== null ? `<br><span class="dim">best ${best.toFixed(2)}s</span>` : ''}
          </button>`;
        }).join('')}
      </div>
      <button id="back-btn">Back</button>
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
      <div id="hud-top" class="hud">
        <span>${levelName} — round <span id="hud-round">1</span>/${roundLimit}</span>
        <span>Clock <span class="clock-track"><span id="hud-clock-bar" class="clock-bar"></span></span></span>
        <span id="hud-time">0.00s</span>
        ${muteButtonHtml('mute-btn')}
      </div>
      <canvas id="canvas" width="${room.width}" height="${room.height}"></canvas>
      <div id="pause-overlay" class="hidden">
        <p>Paused — click to resume</p>
        <button id="quit-btn">Quit to level select</button>
      </div>
      <p class="dim">Click the maze to lock your mouse. Esc pauses.</p>
    </div>
  `);
  wireMuteButton('mute-btn');
  document.getElementById('quit-btn')!.addEventListener('click', () => {
    input.dispose();
    showLevelSelect();
  });

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const renderer = new Renderer(ctx);
  const run = new LevelRun(room, clockTicks, roundLimit);

  let prevDown = false;
  let prevDoors = new Set<string>();
  let lastTickSecond = -1;
  let stopped = false;

  const input = new PointerInput(canvas, (locked) => {
    document.getElementById('pause-overlay')!.classList.toggle('hidden', locked);
  });
  canvas.addEventListener('click', () => {
    audio.resumeAudio();
    input.requestLock();
  });
  audio.playRoundStart();

  const STEP = 1 / 60;
  let acc = 0;
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

  function frame(now: number): void {
    if (stopped) return;
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    acc += dt;

    let ticks = 0;
    while (acc >= STEP) {
      acc -= STEP;
      ticks++;
    }

    if (ticks > 0 && input.isLocked()) {
      const raw = input.consumeTick();
      const dx = raw.dx / ticks;
      const dy = raw.dy / ticks;
      for (let i = 0; i < ticks; i++) {
        const before = run.liveFrame;
        const doorsBefore = new Set(prevDoors);
        const report = run.tick({ dx, dy, down: raw.down });
        const actualMove = Math.hypot(report.frame.x - before.x, report.frame.y - before.y);
        const requestedMove = Math.hypot(dx, dy);
        const secondsLeft = (clockTicks - run.tickIndex) / 60;
        handleTickAudio(secondsLeft, requestedMove, actualMove, report.frame.down);

        if (report.roundOver) {
          if (report.won) {
            audio.playLevelWinJingle();
            finishWin(levelId, levelName, run.elapsedSeconds());
            return;
          }
          audio.playRoundEndWhoosh();
          lastTickSecond = -1;
          if (report.ranOutOfRounds) {
            finishOutOfRounds(levelId, levelName, room, clockTicks, roundLimit);
            return;
          }
          audio.playRoundStart();
        }
        void doorsBefore;
      }
    }

    document.getElementById('hud-round')!.textContent = String(run.round);
    document.getElementById('hud-time')!.textContent = `${run.elapsedSeconds().toFixed(2)}s`;
    const pct = Math.max(0, 100 - (run.tickIndex / clockTicks) * 100);
    document.getElementById('hud-clock-bar')!.style.width = `${pct}%`;

    const arrows: DrawArrow[] = run.replays.map((r, i) => ({
      frame: r[Math.min(run.tickIndex, r.length - 1)],
      label: String(i + 1),
      alpha: 0.4,
    }));
    arrows.push({ frame: run.liveFrame, alpha: 1 });
    renderer.draw(room, computeOpenDoors(room, run), arrows);

    requestAnimationFrame(frame);
  }

  function finishWin(id: string, name: string, seconds: number): void {
    stopped = true;
    input.dispose();
    const best = saveBestTime(id, hardness, seconds);
    const idx = LEVELS.findIndex((l) => l.id === id);
    unlockUpTo(idx + 2);
    render(`
      <div class="screen">
        <h1>${name} — cleared!</h1>
        <p>Time: ${seconds.toFixed(2)}s</p>
        <p class="dim">Best: ${best.toFixed(2)}s</p>
        <div class="row">
          <button id="retry-btn">Retry</button>
          ${idx + 1 < LEVELS.length ? '<button id="next-btn" class="primary">Next level</button>' : ''}
          <button id="select-btn">Level select</button>
        </div>
      </div>
    `);
    document.getElementById('retry-btn')!.addEventListener('click', () => startLevel(id));
    document.getElementById('select-btn')!.addEventListener('click', showLevelSelect);
    document.getElementById('next-btn')?.addEventListener('click', () => startLevel(LEVELS[idx + 1].id));
  }

  function finishOutOfRounds(
    id: string,
    name: string,
    _room: ReturnType<(typeof LEVELS)[number]['build']>,
    _clockTicks: number,
    _roundLimit: number,
  ): void {
    stopped = true;
    input.dispose();
    render(`
      <div class="screen">
        <h1>Out of rounds</h1>
        <p>${name} starts over from round 1.</p>
        <div class="row">
          <button id="retry-btn" class="primary">Try again</button>
          <button id="select-btn">Level select</button>
        </div>
      </div>
    `);
    document.getElementById('retry-btn')!.addEventListener('click', () => startLevel(id));
    document.getElementById('select-btn')!.addEventListener('click', showLevelSelect);
  }

  requestAnimationFrame(frame);
}

function computeOpenDoors(room: ReturnType<(typeof LEVELS)[number]['build']>, run: LevelRun): Set<string> {
  // Recreate the same previous-tick-based door state used by the sim, for drawing only.
  const spawnFrame = { x: room.spawn.x, y: room.spawn.y, down: false };
  const prevReplays = run.replays.map((r) => r[Math.max(0, run.tickIndex - 1)] ?? spawnFrame);
  const prevLive = run.tickIndex === 0 ? spawnFrame : run.currentRecording[run.tickIndex - 1] ?? run.liveFrame;
  const heldButtons = new Set<string>();
  for (const b of room.buttons) {
    for (const s of [prevLive, ...prevReplays]) {
      if (s.down && s.x >= b.zone.x && s.x <= b.zone.x + b.zone.w && s.y >= b.zone.y && s.y <= b.zone.y + b.zone.h) {
        heldButtons.add(b.id);
        break;
      }
    }
  }
  const open = new Set<string>();
  for (const d of room.doors) if (d.buttonIds.some((id) => heldButtons.has(id))) open.add(d.id);
  return open;
}

if (isTouchDevice()) {
  showTouchBlocked();
} else {
  showTitle();
}
