import { playCreak, playJudge, playSplash, playWhoosh, setAmbience, unlockAudio } from './audio.js';
import {
  clearCareer,
  isUnlocked,
  loadCareer,
  lockRival,
  nextUnlock,
  recordDive,
  rivalFor,
  rivalSlot,
  saveCareer,
  standings,
  suggestProgram,
  tierName,
  REGIONAL_AT,
} from './career.js';
import { DIVES } from './dives.js';
import { createLatch, policyInput } from './policy.js';
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
  ring: document.getElementById('cue-ring'),
  ringLabel: document.getElementById('cue-label'),
  ringZone: document.getElementById('cue-zone'),
  ringDot: document.getElementById('cue-dot'),
  power: document.getElementById('power-meter'),
  powerFill: document.getElementById('power-fill'),
  powerZone: document.getElementById('power-zone'),
  powerTarget: document.getElementById('power-target'),
  lineup: document.getElementById('lineup-meter'),
  lineupNeedle: document.getElementById('lineup-needle'),
  score: document.getElementById('score-display'),
  judge: document.getElementById('judge-feedback'),
  instructions: document.getElementById('instructions'),
  tip: document.getElementById('tip'),
  pause: document.getElementById('pause-overlay'),
  resume: document.getElementById('resume-btn'),
  restart: document.getElementById('restart-btn'),
  pauseMenu: document.getElementById('pause-menu-btn'),
  modeTraining: document.getElementById('mode-training'),
  modeMeet: document.getElementById('mode-meet'),
  modeCopy: document.getElementById('mode-copy'),
  buttons: document.getElementById('dive-buttons'),
  start: document.getElementById('start-btn'),
  meetBtn: document.getElementById('meet-btn'),
  meetSetup: document.getElementById('meet-setup'),
  meetRival: document.getElementById('meet-rival-label'),
  meetSlots: document.getElementById('meet-slots'),
  meetSuggest: document.getElementById('meet-suggest'),
  meetGo: document.getElementById('meet-go'),
  meetBack: document.getElementById('meet-back'),
  pauseCopy: document.getElementById('pause-copy'),
  reference: document.getElementById('reference-btn'),
  stats: document.getElementById('session-stats'),
};

const ORDER = ['approach', 'takeoff', 'flight', 'kickout', 'entry'];
const down = new Set();
const pressed = new Set();
let career = loadCareer();
let rival = null;
let lastProgress = null;
let meet = null;

let selectedId = DIVES[0].id;
let training = true;
let paused = false;
let state = null;
let running = false;
let logged = false;
let shown = false;
let reference = false;
let latch = null;
let lastFlash = 0;
let heardPhase = '';
let heardSplash = false;
let bendHot = false;
let lastTime = performance.now();

const RING_START = 132;
function ringPoint(value) {
  const deg = RING_START * (1 - value);
  const rad = deg * Math.PI / 180;
  return [50 + Math.sin(rad) * 40, 50 - Math.cos(rad) * 40];
}

function ringZonePath() {
  const [x1, y1] = ringPoint(0.55);
  const [x2, y2] = ringPoint(1);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A 40 40 0 0 0 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

window.addEventListener('keydown', (event) => {
  if (['Space', 'ArrowDown', 'ArrowUp', 'KeyS', 'KeyT', 'Escape', 'KeyR'].includes(event.code)) event.preventDefault();
  if (event.code === 'Escape' && running) {
    setPaused(!paused);
    return;
  }
  if (event.code === 'KeyR' && running && !state?.result) {
    begin(activeDiveId(), false);
    return;
  }
  if (paused) return;
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
  if (!isUnlocked(career, DIVES.find((item) => item.id === selectedId))) selectedId = '101C';
  ui.buttons.replaceChildren();
  for (const dive of DIVES) {
    const open = isUnlocked(career, dive);
    const button = document.createElement('button');
    button.type = 'button';
    button.disabled = !open;
    button.className = `dive-btn${dive.id === selectedId ? ' selected' : ''}${open ? '' : ' locked'}`;
    const text = document.createElement('div');
    const title = document.createElement('div');
    title.innerHTML = `<strong>${dive.id}</strong> — ${dive.name}`;
    const summary = document.createElement('div');
    summary.className = 'dive-difficulty';
    const best = career.bestByDive[dive.id];
    summary.textContent = open
      ? `${dive.level} · ${dive.summary}${best ? ` · Best ${formatPoints(best)}` : ''}`
      : `ab ${dive.unlockAt} Punkten · ${dive.summary}`;
    text.append(title, summary);
    const dd = document.createElement('div');
    dd.className = 'dive-dd';
    dd.textContent = open ? `DD ${formatPoints(dive.dd, 1)}` : 'Gesperrt';
    button.append(text, dd);
    if (open) {
      button.addEventListener('click', () => {
        selectedId = dive.id;
        renderMenu();
      });
    }
    ui.buttons.append(button);
  }

  ui.stats.replaceChildren();
  const heading = document.createElement('h3');
  heading.textContent = tierName(career.tier);
  ui.stats.append(heading);
  const upcoming = nextUnlock(career, DIVES);
  const rows = [
    ['Karrierepunkte', formatPoints(career.points)],
    ['Highscore', career.best > 0 ? formatPoints(career.best) : '—'],
    ['Sprünge', String(career.dives)],
    ['Rips', String(career.rips)],
  ];
  if (career.tier === 'club') {
    rows.splice(1, 0, ['Bis zur Region', formatPoints(Math.max(0, REGIONAL_AT - career.points))]);
  }
  if (upcoming) rows.push(['Nächster Sprung', `${upcoming.id} ab ${upcoming.unlockAt}`]);
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
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'text-btn';
  reset.textContent = 'Karriere zurücksetzen';
  reset.addEventListener('click', () => {
    career = clearCareer();
    selectedId = '101C';
    renderMenu();
  });
  ui.stats.append(reset);
}

function activeDiveId() {
  if (meet) return meet.program[meet.index].id;
  return selectedId;
}

function begin(diveId, asReference = false) {
  const dive = DIVES.find((item) => item.id === diveId);
  if (!dive || !isUnlocked(career, dive)) return;
  if (asReference) meet = null;
  if (meet && !asReference) rival = rivalSlot(meet.locked, dive, meet.index);
  else rival = !asReference && !training ? rivalFor(dive, career) : null;
  lastProgress = null;
  state = startDive(dive, { training });
  running = true;
  paused = false;
  ui.pause.classList.add('hidden');
  reference = asReference;
  latch = asReference ? createLatch() : null;
  logged = false;
  shown = false;
  lastFlash = 0;
  heardPhase = '';
  heardSplash = false;
  bendHot = false;
  setAmbience('idle');
  ui.menu.classList.add('hidden');
  ui.overlay.classList.add('active');
  ui.score.classList.remove('visible');
  ui.judge.classList.remove('visible');
  ui.score.replaceChildren();
  ui.judge.replaceChildren();
  ui.diveName.textContent = meet
    ? `Dreikampf ${meet.index + 1}/3 — ${dive.id}`
    : `${dive.id} — ${dive.name}`;
  ui.diveDd.textContent = `DD ${formatPoints(dive.dd, 1)} · ${dive.somersaults.toLocaleString('de-DE')} Saltos · ${training ? 'Training' : 'Wettkampf'}`;
}

function setPaused(next) {
  paused = next;
  ui.pause.classList.toggle('hidden', !paused);
  ui.restart.classList.toggle('hidden', Boolean(state?.result));
  ui.pauseMenu.textContent = meet ? 'Meet abbrechen' : 'Sprung wechseln';
  ui.pauseCopy.textContent = meet
    ? 'Esc macht weiter. R wiederholt den laufenden Versuch, solange die Note noch nicht steht. Meet abbrechen verwirft nur den offenen Sprung.'
    : 'Esc macht weiter. R startet den laufenden Versuch neu, solange die Note noch nicht steht.';
  pressed.clear();
  down.clear();
}

function leaveToMenu() {
  meet = null;
  running = false;
  paused = false;
  ui.pause.classList.add('hidden');
  ui.overlay.classList.remove('active');
  ui.menu.classList.remove('hidden');
  renderMenu();
}

function meetStandText() {
  if (!meet || !meet.rounds.length || state?.phase === 'result') return '';
  const table = standings(meet.rounds);
  return `Stand ${formatPoints(table.player)} : ${formatPoints(table.rival)} · ${meet.locked.name}`;
}

function sync(view) {
  if (!view) return;
  ui.phase.textContent = view.phaseLabel;
  ui.instructions.textContent = view.timingHot ? `Jetzt. ${view.instruction}` : view.instruction;
  ui.instructions.classList.toggle('hidden', !view.instruction);
  ui.instructions.classList.toggle('hot', view.timingHot);
  ui.tip.textContent = view.tip || '';
  ui.tip.classList.toggle('hidden', !view.tip);
  const showRing = view.showTiming || view.showGrab || view.showTwist;
  ui.meters.classList.toggle('hidden', !(view.showPower || view.showLineup));
  ui.ring.classList.toggle('hidden', !showRing);
  const rotation = `Rotation ${view.somersaults.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${view.somersaultTarget.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  ui.readout.textContent = view.inAir ? rotation : meetStandText();

  const current = ORDER.indexOf(view.phase);
  for (const item of ui.track.children) {
    const index = ORDER.indexOf(item.dataset.phase);
    item.classList.toggle('done', current > index || view.phase === 'result');
    item.classList.toggle('current', item.dataset.phase === view.phase);
  }

  const cue = view.showTwist ? view.twist : view.showGrab ? view.grab : view.timing;
  const [cx, cy] = ringPoint(cue);
  ui.ringDot.setAttribute('cx', cx.toFixed(2));
  ui.ringDot.setAttribute('cy', cy.toFixed(2));
  ui.ring.classList.toggle('hot', cue >= 0.92);
  if (view.showTwist) ui.ringLabel.textContent = `Schraube ${view.twistTaps}/${view.twistNeed}`;
  else if (view.showGrab) ui.ringLabel.textContent = 'Hand-Grab';
  else ui.ringLabel.textContent = 'Ziel';

  ui.power.classList.toggle('hidden', !view.showPower);
  ui.powerFill.style.width = `${view.power * 100}%`;
  ui.powerZone.style.left = `${view.powerBand[0] * 100}%`;
  ui.powerZone.style.width = `${(view.powerBand[1] - view.powerBand[0]) * 100}%`;
  ui.powerTarget.textContent = `Ziel ${Math.round(view.powerBand[0] * 100)}–${Math.round(view.powerBand[1] * 100)} %`;

  ui.lineup.classList.toggle('hidden', !view.showLineup);
  ui.lineupNeedle.style.left = `${(view.lineup + 1) * 50}%`;
  syncSound();

  if (view.flash && view.flash.id !== lastFlash) {
    lastFlash = view.flash.id;
    playJudge(view.flash.score);
  }

  if (state?.result && !logged && !reference) {
    logged = true;
    lastProgress = recordDive(career, state.dive, state.result.total, state.result.rip, DIVES);
    career = lastProgress.career;
    saveCareer(career);
    if (meet && rival) {
      meet.rounds.push({ diveId: state.dive.id, player: state.result.total, rival: rival.total });
    }
  }

  if (state?.result && state.splashT > 1.15 && !shown) {
    shown = true;
    showResult(state.result);
  }
}

function syncSound() {
  if (!state) return;
  if (state.phase !== heardPhase) {
    if (state.phase === 'flight') {
      setAmbience('hush');
      playWhoosh();
    } else if (state.phase === 'kickout' || state.phase === 'entry') {
      setAmbience('hush');
    } else if (state.phase === 'approach' || state.phase === 'takeoff') {
      setAmbience('idle');
    }
    heardPhase = state.phase;
  }
  if (state.phase === 'takeoff') {
    const hot = state.bend > 22;
    if (hot && !bendHot) playCreak();
    bendHot = hot;
  }
  if (state.result && !heardSplash) {
    heardSplash = true;
    setAmbience('after');
    playSplash(state.result.rip);
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
  rating.textContent = `${reference ? 'Referenz · ' : ''}${result.rip ? `${result.rating.text} · Rip` : result.rating.text}`;
  const actions = document.createElement('div');
  actions.className = 'result-actions';
  const again = document.createElement('button');
  again.type = 'button';
  again.className = 'continue-btn';
  again.textContent = meet ? 'Zur Auswahl' : 'Nochmal';
  again.addEventListener('click', () => {
    if (meet) leaveToMenu();
    else begin(selectedId, false);
  });
  const menu = document.createElement('button');
  menu.type = 'button';
  menu.className = 'continue-btn';
  if (meet && meet.index < 2) {
    menu.textContent = 'Nächster Sprung';
    menu.addEventListener('click', () => {
      meet.index += 1;
      begin(meet.program[meet.index].id, false);
    });
  } else {
    menu.textContent = meet ? 'Ende' : 'Zur Auswahl';
    menu.addEventListener('click', leaveToMenu);
  }
  actions.append(again);
  if (!meet || meet.index < 2) actions.append(menu);
  ui.score.append(total, breakdown, rating);
  if (meet) {
    const stand = document.createElement('div');
    stand.className = 'standings';
    const table = standings(meet.rounds);
    const finalLabel = meet.rounds.length >= 3;
    const verdict = table.verdict === 'vorn' ? 'du liegst vorn' : table.verdict === 'hinten' ? 'der Rivale liegt vorn' : 'gleichauf';
    stand.textContent = `${finalLabel ? 'Endstand' : `Nach Sprung ${meet.rounds.length}/3`} ${formatPoints(table.player)} : ${formatPoints(table.rival)} — ${verdict}`;
    ui.score.append(stand);
  }
  if (!reference && lastProgress) {
    const progress = document.createElement('div');
    progress.className = 'career-note';
    const bits = [`+${formatPoints(lastProgress.gained)} Karrierepunkte · ${tierName(career.tier)}`];
    if (lastProgress.promoted) bits.push('Aufstieg in die Region');
    if (lastProgress.unlocked.length) {
      bits.push(`Frei: ${lastProgress.unlocked.map((item) => item.id).join(', ')}`);
    }
    progress.textContent = bits.join(' · ');
    ui.score.append(progress);
  }
  if (!reference && rival) {
    const line = document.createElement('div');
    line.className = 'career-note';
    const delta = result.total - rival.total;
    const verdict = delta >= 0.5 ? 'du liegst vorn' : delta <= -0.5 ? 'der Gegner liegt vorn' : 'fast gleich';
    line.textContent = `${rival.name} ${formatPoints(rival.total)} — ${verdict}`;
    ui.score.append(line);
  }
  ui.score.append(actions);
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
  if (running && state && !paused) {
    const input = reference ? policyInput(state, 'perfect', latch) : consumeInput();
    if (reference) pressed.clear();
    step(state, input, dt);
  } else pressed.clear();
  draw(ctx, running ? state : null, canvas.clientWidth, canvas.clientHeight);
  if (running) sync(present(state));
  requestAnimationFrame(frame);
}

ui.start.addEventListener('click', () => {
  meet = null;
  unlockAudio();
  begin(selectedId, false);
});

ui.reference.addEventListener('click', () => {
  unlockAudio();
  begin(selectedId, true);
});

ui.resume.addEventListener('click', () => setPaused(false));
ui.restart.addEventListener('click', () => {
  if (state?.result) return;
  begin(activeDiveId(), false);
});
ui.pauseMenu.addEventListener('click', leaveToMenu);

function setMode(nextTraining) {
  training = nextTraining;
  ui.modeTraining.classList.toggle('selected', training);
  ui.modeMeet.classList.toggle('selected', !training);
  ui.start.textContent = training ? 'Sprung starten' : 'Einzelsprung';
  ui.meetBtn.classList.toggle('hidden', training);
  ui.meetSetup.classList.add('hidden');
  ui.modeCopy.textContent = training
    ? 'Weitere Fenster. Ein brauchbarer Sprung gelingt schnell, Gold bleibt knapp.'
    : 'Engere Fenster. Einzelsprung gegen einen Rivalen, oder ein Dreikampf über drei Sprünge.';
}

function openMeetSetup() {
  const locked = lockRival(career);
  ui.meetRival.textContent = `Rivale für alle drei Sprünge: ${locked.name}`;
  ui.meetSetup.dataset.seed = String(locked.seed);
  ui.meetSetup.dataset.base = String(locked.base);
  ui.meetSetup.dataset.name = locked.name;
  const suggestion = suggestProgram(DIVES, career);
  ui.meetSlots.replaceChildren();
  for (let slot = 0; slot < 3; slot += 1) {
    const label = document.createElement('label');
    label.textContent = `Sprung ${slot + 1}`;
    const select = document.createElement('select');
    select.id = `meet-slot-${slot}`;
    select.name = select.id;
    select.dataset.slot = String(slot);
    for (const dive of DIVES.filter((item) => isUnlocked(career, item))) {
      const option = document.createElement('option');
      option.value = dive.id;
      option.textContent = `${dive.id} · DD ${formatPoints(dive.dd, 1)}`;
      if (dive.id === suggestion[slot]) option.selected = true;
      select.append(option);
    }
    label.append(select);
    ui.meetSlots.append(label);
  }
  ui.meetSetup.classList.remove('hidden');
}

function chosenProgram() {
  return [...ui.meetSlots.querySelectorAll('select')].map((select) => select.value);
}

ui.meetBtn.addEventListener('click', () => {
  unlockAudio();
  openMeetSetup();
});
ui.meetSuggest.addEventListener('click', () => {
  const suggestion = suggestProgram(DIVES, career);
  ui.meetSlots.querySelectorAll('select').forEach((select, index) => {
    select.value = suggestion[index];
  });
});
ui.meetBack.addEventListener('click', () => ui.meetSetup.classList.add('hidden'));
ui.meetGo.addEventListener('click', () => {
  const ids = chosenProgram();
  if (ids.length !== 3 || ids.some((id) => !isUnlocked(career, DIVES.find((item) => item.id === id)))) return;
  meet = {
    program: ids.map((id) => DIVES.find((item) => item.id === id)),
    index: 0,
    locked: {
      name: ui.meetSetup.dataset.name,
      base: Number(ui.meetSetup.dataset.base),
      seed: Number(ui.meetSetup.dataset.seed),
    },
    rounds: [],
  };
  ui.meetSetup.classList.add('hidden');
  training = false;
  begin(meet.program[0].id, false);
});

ui.modeTraining.addEventListener('click', () => setMode(true));
ui.modeMeet.addEventListener('click', () => setMode(false));

window.addEventListener('resize', resize);
ui.ringZone.setAttribute('d', ringZonePath());
renderMenu();
resize();
requestAnimationFrame(frame);
