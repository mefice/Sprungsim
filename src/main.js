import { playEntry, playJudge, unlockAudio } from './audio.js';
import { DIVES } from './dives.js';
import { draw } from './render.js';
import { formatPoints } from './scoring.js';
import { present, startDive, step } from './sim.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const ui = {
  overlay: document.getElementById('ui-overlay'),
  menu: document.getElementById('menu-overlay'),
  phase: document.getElementById('phase-indicator'),
  track: document.getElementById('phase-track'),
  readout: document.getElementById('readout'),
  diveName: document.getElementById('dive-name'),
  diveDd: document.getElementById('dive-dd'),
  meters: document.getElementById('meters'),
  timing: document.getElementById('timing-bar-container'),
  marker: document.getElementById('timing-marker'),
  target: document.getElementById('timing-target'),
  power: document.getElementById('power-meter'),
  powerFill: document.getElementById('power-fill'),
  powerZone: document.getElementById('power-zone'),
  powerTarget: document.getElementById('power-target'),
  lineup: document.getElementById('lineup-meter'),
  lineupNeedle: document.getElementById('lineup-needle'),
  grab: document.getElementById('grab-meter'),
  grabNeedle: document.getElementById('grab-needle'),
  twist: document.getElementById('twist-meter'),
  twistNeedle: document.getElementById('twist-needle'),
  twistCount: document.getElementById('twist-count'),
  score: document.getElementById('score-display'),
  judge: document.getElementById('judge-feedback'),
  instructions: document.getElementById('instructions'),
  buttons: document.getElementById('dive-buttons'),
  start: document.getElementById('start-btn'),
  stats: document.getElementById('session-stats'),
};

const ORDER = ['approach', 'takeoff', 'flight', 'kickout', 'entry'];
const down = new Set();
const pressed = new Set();
const session = { dives: 0, total: 0, best: 0, rips: 0 };

let selectedId = DIVES[0].id;
let state = null;
let running = false;
let logged = false;
let shown = false;
let lastFlash = 0;
let lastTime = performance.now();

window.addEventListener('keydown', (event) => {
  if (['Space', 'ArrowDown', 'ArrowUp', 'KeyS', 'KeyT'].includes(event.code)) event.preventDefault();
  if (!down.has(event.code)) pressed.add(event.code);
  down.add(event.code);
});

window.addEventListener('keyup', (event) => {
  down.delete(event.code);
});

window.addEventListener('blur', () => {
  down.clear();
  pressed.clear();
});

function consumeInput() {
  const input = {
    spaceDown: down.has('Space'),
    spacePressed: pressed.has('Space'),
    tuckDown: down.has('KeyS') || down.has('ArrowDown'),
    twistPressed: pressed.has('KeyT'),
  };
  pressed.clear();
  return input;
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function renderMenu() {
  ui.buttons.replaceChildren();
  for (const dive of DIVES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `dive-btn${dive.id === selectedId ? ' selected' : ''}`;
    const text = document.createElement('div');
    const title = document.createElement('div');
    title.innerHTML = `<strong>${dive.id}</strong> — ${dive.name}`;
    const summary = document.createElement('div');
    summary.className = 'dive-difficulty';
    summary.textContent = `${dive.level} · ${dive.summary}`;
    text.append(title, summary);
    const dd = document.createElement('div');
    dd.className = 'dive-dd';
    dd.textContent = `DD ${formatPoints(dive.dd, 1)}`;
    button.append(text, dd);
    button.addEventListener('click', () => {
      selectedId = dive.id;
      renderMenu();
    });
    ui.buttons.append(button);
  }

  ui.stats.replaceChildren();
  const heading = document.createElement('h3');
  heading.textContent = 'Session';
  ui.stats.append(heading);
  if (session.dives === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-stats';
    empty.textContent = 'Noch kein Sprung. Die Note folgt nur aus dem Timing.';
    ui.stats.append(empty);
    return;
  }
  const rows = [
    ['Sprünge', String(session.dives)],
    ['Schnitt', formatPoints(session.total / session.dives)],
    ['Bestleistung', formatPoints(session.best)],
    ['Rips', String(session.rips)],
  ];
  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'stat-row';
    const name = document.createElement('span');
    name.className = 'label';
    name.textContent = label;
    const number = document.createElement('span');
    number.className = 'value';
    number.textContent = value;
    row.append(name, number);
    ui.stats.append(row);
  }
}

function begin(diveId) {
  const dive = DIVES.find((item) => item.id === diveId);
  state = startDive(dive);
  running = true;
  logged = false;
  shown = false;
  lastFlash = 0;
  ui.menu.classList.add('hidden');
  ui.overlay.classList.add('active');
  ui.score.classList.remove('visible');
  ui.judge.classList.remove('visible');
  ui.score.replaceChildren();
  ui.judge.replaceChildren();
  ui.diveName.textContent = `${dive.id} — ${dive.name}`;
  ui.diveDd.textContent = `DD ${formatPoints(dive.dd, 1)} · ${dive.somersaults.toLocaleString('de-DE')} Saltos`;
}

function sync(view) {
  if (!view) return;
  ui.phase.textContent = view.phaseLabel;
  ui.instructions.textContent = view.instruction;
  ui.instructions.classList.toggle('hidden', !view.instruction);
  ui.meters.classList.toggle('hidden', !(view.showTiming || view.showPower || view.showLineup || view.showGrab || view.showTwist));
  ui.readout.textContent = view.inAir
    ? `Rotation ${view.somersaults.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${view.somersaultTarget.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
    : '';

  const current = ORDER.indexOf(view.phase);
  for (const item of ui.track.children) {
    const index = ORDER.indexOf(item.dataset.phase);
    item.classList.toggle('done', current > index || view.phase === 'result');
    item.classList.toggle('current', item.dataset.phase === view.phase);
  }

  ui.timing.classList.toggle('hidden', !view.showTiming);
  ui.timing.classList.toggle('hot', view.timingHot);
  ui.marker.style.left = `${view.timing * 100}%`;
  ui.target.style.left = '72%';
  ui.target.style.width = '28%';

  ui.power.classList.toggle('hidden', !view.showPower);
  ui.powerFill.style.width = `${view.power * 100}%`;
  ui.powerZone.style.left = `${view.powerBand[0] * 100}%`;
  ui.powerZone.style.width = `${(view.powerBand[1] - view.powerBand[0]) * 100}%`;
  ui.powerTarget.textContent = `Ziel ${Math.round(view.powerBand[0] * 100)}–${Math.round(view.powerBand[1] * 100)} %`;

  ui.lineup.classList.toggle('hidden', !view.showLineup);
  ui.lineupNeedle.style.left = `${(view.lineup + 1) * 50}%`;
  ui.grab.classList.toggle('hidden', !view.showGrab);
  ui.grabNeedle.style.left = `${view.grab * 100}%`;
  ui.twist.classList.toggle('hidden', !view.showTwist);
  ui.twistNeedle.style.left = `${view.twist * 100}%`;
  ui.twistCount.textContent = `${view.twistTaps}/${view.twistNeed}`;

  if (view.flash && view.flash.id !== lastFlash) {
    lastFlash = view.flash.id;
    playJudge(view.flash.score);
  }

  if (state?.result && !logged) {
    logged = true;
    session.dives += 1;
    session.total += state.result.total;
    session.best = Math.max(session.best, state.result.total);
    if (state.result.rip) session.rips += 1;
    playEntry(state.result.rip);
  }

  if (state?.result && state.splashT > 0.45 && !shown) {
    shown = true;
    showResult(state.result);
  }
}

function showResult(result) {
  ui.score.replaceChildren();
  const total = document.createElement('div');
  total.className = 'final-score';
  total.textContent = formatPoints(result.total);
  const breakdown = document.createElement('div');
  breakdown.className = 'score-breakdown';
  breakdown.textContent = `Ausführung ${formatPoints(result.execution, 1)} × DD ${formatPoints(result.dd, 1)}`;
  const rating = document.createElement('div');
  rating.className = `rating ${result.rating.className}`;
  rating.textContent = result.rip ? `${result.rating.text} · Rip` : result.rating.text;
  const actions = document.createElement('div');
  actions.className = 'result-actions';
  const again = document.createElement('button');
  again.type = 'button';
  again.className = 'continue-btn';
  again.textContent = 'Nochmal';
  again.addEventListener('click', () => begin(selectedId));
  const menu = document.createElement('button');
  menu.type = 'button';
  menu.className = 'continue-btn';
  menu.textContent = 'Zur Auswahl';
  menu.addEventListener('click', () => {
    running = false;
    ui.overlay.classList.remove('active');
    ui.menu.classList.remove('hidden');
    renderMenu();
  });
  actions.append(again, menu);
  ui.score.append(total, breakdown, rating, actions);
  ui.score.classList.add('visible');

  ui.judge.replaceChildren();
  const title = document.createElement('h3');
  title.textContent = 'Kampfrichter';
  ui.judge.append(title);
  for (const [label, text] of [
    ['Absprung', result.notes.takeoff],
    ['Rotation', result.notes.rotation],
    ['Eintritt', result.notes.entry],
  ]) {
    const note = document.createElement('p');
    note.className = 'judge-note';
    const strong = document.createElement('strong');
    strong.textContent = label;
    note.append(strong, document.createTextNode(` ${text}`));
    ui.judge.append(note);
  }
  for (const part of result.breakdown) {
    const row = document.createElement('div');
    row.className = 'feedback-item';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = part.label;
    const value = document.createElement('span');
    value.className = `value ${part.value >= 0.85 ? 'good' : part.value >= 0.55 ? 'ok' : 'bad'}`;
    value.textContent = part.deduction > 0 ? `−${formatPoints(part.deduction, 1)}` : '0,0';
    row.append(label, value);
    ui.judge.append(row);
  }
  ui.judge.classList.add('visible');
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (canvas.clientWidth !== Math.round(canvas.width / (window.devicePixelRatio || 1))) resize();
  if (running && state) step(state, consumeInput(), dt);
  else pressed.clear();
  draw(ctx, running ? state : null, canvas.clientWidth, canvas.clientHeight);
  if (running) sync(present(state));
  requestAnimationFrame(frame);
}

ui.start.addEventListener('click', () => {
  unlockAudio();
  begin(selectedId);
});

window.addEventListener('resize', resize);
renderMenu();
resize();
requestAnimationFrame(frame);
