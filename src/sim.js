import { bandFor, bandScore, evaluate, grabScore, rateOsc } from './scoring.js';

export const WORLD = {
  width: 1280,
  height: 720,
  waterY: 676,
  platformY: 214,
  g: 760,
  approachPeriod: 1.2,
  takeoffPeriod: 1.15,
  twistPeriod: 0.68,
  chargeRate: 0.48,
  poseK: 9,
};

const STEP_X = [120, 190, 260, 325];

export function emptyInput() {
  return {
    spaceDown: false,
    spacePressed: false,
    tuckDown: false,
    twistPressed: false,
  };
}

/** Scheitel bei 1, ruht dort kurz — das ist das Zielfenster. */
export function oscAt(time, period) {
  const local = ((time % period) + period) % period / period;
  return Math.sin(Math.PI * local) ** 2;
}

export function timeToY(y, vy, targetY) {
  if (y >= targetY) return 0;
  const a = 0.5 * WORLD.g;
  const b = vy;
  const c = y - targetY;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return 2.5;
  const root = Math.sqrt(disc);
  const candidates = [(-b + root) / (2 * a), (-b - root) / (2 * a)].filter((t) => t > 0.001);
  return candidates.length ? Math.min(...candidates) : 0.001;
}

export function timeToWater(y, vy) {
  return timeToY(y, vy, WORLD.waterY);
}

/** Rotation beim Eintauchen, wenn die Hocke jetzt gelöst wird. */
export function predictRotation(state, seconds) {
  const k = WORLD.poseK;
  const poseIntegral = seconds <= 0 ? 0 : state.pose * (1 - Math.exp(-k * seconds)) / k;
  return state.rotation
    + state.omegaStraight * seconds
    + (state.omegaTuck - state.omegaStraight) * poseIntegral;
}

export function predictError(state) {
  const t = timeToWater(state.y, state.vy);
  return predictRotation(state, t) - state.targetRad;
}

export function startDive(dive, options = {}) {
  const training = Boolean(options.training);
  return {
    dive,
    training,
    approachPeriod: training ? 1.7 : 1.38,
    takeoffPeriod: training ? 1.55 : 1.22,
    twistPeriod: training ? 0.98 : 0.74,
    phase: 'approach',
    stage: null,
    time: 0,
    age: 0,
    airTime: 0,
    boardT: 0,
    x: STEP_X[0],
    y: WORLD.platformY - 42,
    vx: 0,
    vy: 0,
    rotation: 0,
    pose: 0,
    opened: false,
    targetRad: dive.somersaults * Math.PI * 2,
    omegaStraight: 0,
    omegaTuck: 0,
    power: 0,
    charging: false,
    needFreshPress: false,
    takeoffDone: false,
    approachScores: [],
    approachLead: training ? 1.15 : 0.55,
    beatHit: false,
    halfCount: 0,
    halfPulse: 0,
    halfSeq: 0,
    kickoutAge: 0,
    releaseQueued: false,
    chargeTime: 0,
    snapTime: 0,
    bend: 0,
    poseSum: 0,
    poseN: 0,
    twistHits: 0,
    twistTaps: 0,
    tuckWasDown: false,
    grabbed: false,
    grabValue: null,
    entryCue: null,
    flash: null,
    flashSeq: 0,
    splash: [],
    splashT: 0,
    result: null,
    metrics: {
      approach: 0,
      takeoffTiming: 0,
      takeoffPower: 0,
      powerRaw: 0,
      powerBand: bandFor(dive.powerBand, training),
      avgPose: 0,
      twistHits: 0,
      angleError: Math.PI,
      grab: 0,
    },
  };
}

export function step(state, input, dt) {
  const frame = Math.min(Math.max(dt, 0), 0.05);
  state.age += frame;
  decayFlash(state, frame);

  if (state.phase === 'result') {
    noteSpin(state, frame);
    state.splashT += frame;
    state.y = Math.min(WORLD.waterY + 48, WORLD.waterY + 10 + state.splashT * 42);
    advanceSplash(state, frame);
    return state;
  }

  if (state.phase === 'approach') updateApproach(state, input, frame);
  else if (state.phase === 'takeoff') updateTakeoff(state, input, frame);
  else updateAir(state, input, frame);

  noteSpin(state, frame);
  return state;
}

function noteSpin(state, dt) {
  if (state.halfPulse > 0) state.halfPulse = Math.max(0, state.halfPulse - dt);
  if (state.phase === 'approach' || state.phase === 'takeoff' || state.phase === 'result') return;
  const half = Math.floor((state.rotation + 0.12) / Math.PI);
  if (half > state.halfCount) {
    state.halfCount = half;
    state.halfPulse = 0.34;
    state.halfSeq += 1;
  }
}

function feltOsc(state, key, osc, dt) {
  if (state.holdKey !== key) {
    state.holdKey = key;
    state.oscHold = 0;
    state.oscHoldAge = 0;
  }
  const grace = state.training ? 0.16 : 0.1;
  if (osc >= state.oscHold) {
    state.oscHold = osc;
    state.oscHoldAge = 0;
  } else {
    state.oscHoldAge += dt;
    if (state.oscHoldAge > grace) state.oscHold = osc;
  }
  return Math.max(osc, state.oscHold);
}

function updateApproach(state, input, dt) {
  placeOnBoard(state);
  if (state.approachLead > 0) {
    state.approachLead -= dt;
    return;
  }
  const period = state.approachPeriod;
  const previousBeat = Math.floor(state.time / period);
  state.time += dt;
  const beat = Math.floor(state.time / period);
  const osc = feltOsc(state, 'approach', oscAt(state.time, period), dt);

  if (input.spacePressed && !state.beatHit && state.phase === 'approach') {
    state.beatHit = true;
    recordApproach(state, rateOsc(osc, state.training));
  }

  if (beat > previousBeat && state.phase === 'approach') {
    if (!state.beatHit) recordApproach(state, 0);
    state.beatHit = false;
    state.holdKey = '';
  }
}

function recordApproach(state, score) {
  state.approachScores.push(score);
  state.x = STEP_X[Math.min(STEP_X.length - 1, state.approachScores.length)];
  setFlash(state, score);
  if (state.approachScores.length >= 3) beginTakeoff(state);
}

function beginTakeoff(state) {
  state.phase = 'takeoff';
  state.stage = 'charge';
  state.time = 0;
  state.boardT = 0;
  state.chargeTime = 0;
  state.snapTime = 0;
  state.needFreshPress = true;
  state.charging = false;
  state.power = 0;
  state.holdKey = '';
  state.metrics.approach = average(state.approachScores);
}

function updateTakeoff(state, input, dt) {
  state.boardT += dt;
  placeOnBoard(state);

  if (state.needFreshPress) {
    state.needFreshPress = false;
    return;
  }

  if (state.stage === 'charge') {
    state.chargeTime += dt;
    if (input.spaceDown) {
      state.charging = true;
      const band = state.metrics.powerBand;
      const inBand = state.power >= band[0] && state.power <= band[1];
      const rate = WORLD.chargeRate * (inBand ? 0.42 : 1) * (state.training ? 0.82 : 1);
      state.power = Math.min(1, state.power + rate * dt);
    }
    const released = state.charging && !input.spaceDown;
    const toppedOut = state.power >= 0.995 && state.charging;
    if (released || toppedOut) {
      state.stage = 'snap';
      state.charging = false;
      state.needFreshPress = true;
      state.snapTime = 0;
      state.metrics.powerRaw = state.power;
      state.metrics.takeoffPower = bandScore(state.power, state.metrics.powerBand);
      return;
    }
    if (state.chargeTime > 4.2 && !state.charging) {
      state.metrics.powerRaw = state.power;
      state.metrics.takeoffPower = 0;
      state.metrics.takeoffTiming = 0;
      launch(state);
    }
    return;
  }

  state.snapTime += dt;
  const snapOsc = feltOsc(state, 'snap', oscAt(state.boardT, state.takeoffPeriod), dt);
  if (input.spacePressed) {
    state.metrics.powerRaw = state.power;
    state.metrics.takeoffPower = bandScore(state.power, state.metrics.powerBand);
    state.metrics.takeoffTiming = rateOsc(snapOsc, state.training);
    setFlash(state, state.metrics.takeoffTiming);
    launch(state);
    return;
  }

  if (state.snapTime > 3.6) {
    state.metrics.takeoffTiming = 0;
    launch(state);
  }
}

function launch(state) {
  const timing = state.metrics.takeoffTiming;
  const power = state.metrics.takeoffPower;
  const height = 70 + 80 * (0.4 + 0.6 * power) * (0.8 + 0.2 * timing);
  state.vy = -Math.sqrt(2 * WORLD.g * height);
  state.vx = 128;
  state.phase = 'flight';
  state.stage = null;
  state.bend = 0;
  state.airTime = 0;
  state.opened = false;
  state.pose = 0;
  state.poseSum = 0;
  state.poseN = 0;
  state.takeoffDone = true;

  const air = Math.max(0.9, timeToWater(state.y, state.vy));
  const quality = 0.88 + 0.12 * (timing * 0.5 + power * 0.5);
  state.omegaTuck = (state.targetRad / (air * 0.8)) * quality;
  state.omegaStraight = state.omegaTuck / 2.55;
}

function updateAir(state, input, dt) {
  const phaseAtStart = state.phase;

  if (phaseAtStart === 'kickout') {
    state.kickoutAge += dt;
    if (!input.tuckDown) state.releaseQueued = true;
    const arm = state.training ? 0.2 : 0.12;
    if (!state.opened && state.kickoutAge >= arm && state.releaseQueued) state.opened = true;
  }
  if (phaseAtStart === 'entry' && input.spacePressed) {
    const dist = WORLD.waterY - state.y;
    if (dist < 230 && dist > 6) {
      const judged = state.training ? 72 + (dist - 72) * 0.62 : dist;
      const score = grabScore(judged);
      if (!state.grabbed || score >= state.grabValue) {
        state.grabbed = true;
        state.grabValue = score;
        setFlash(state, score);
      }
    }
  }

  if (!state.opened && (phaseAtStart === 'flight' || phaseAtStart === 'kickout')) {
    state.poseSum += state.pose;
    state.poseN += 1;
    if (input.twistPressed && state.dive.twistHalves > 0 && state.twistTaps < state.dive.twistHalves) {
      state.twistTaps += 1;
      const twistOsc = feltOsc(state, 'twist', oscAt(state.airTime, state.twistPeriod), dt);
      state.twistHits += rateOsc(twistOsc, state.training);
      setFlash(state, rateOsc(twistOsc, state.training));
    }
  }

  const sub = 4;
  const h = dt / sub;
  for (let i = 0; i < sub; i += 1) {
    integrateAir(state, h, input.tuckDown && !state.opened);
    state.airTime += h;
    if (state.y >= WORLD.waterY) {
      state.tuckWasDown = input.tuckDown;
      finish(state);
      return;
    }
  }

  if (!state.opened && phaseAtStart === 'flight') {
    const remaining = timeToWater(state.y, state.vy);
    if (remaining < 1.12 && state.airTime > 0.28) state.phase = 'kickout';
  }

  if (!state.opened && (state.phase === 'kickout' || state.phase === 'flight')) {
    const remaining = timeToWater(state.y, state.vy);
    if (remaining < 0.09) state.opened = true;
  }

  if (state.opened && state.phase !== 'entry') {
    if (!state.entryCue) {
      state.entryCue = {
        start: state.airTime,
        peak: state.airTime + timeToY(state.y, state.vy, WORLD.waterY - 72),
        end: state.airTime + timeToWater(state.y, state.vy),
      };
    }
    state.phase = 'entry';
  }
  state.tuckWasDown = input.tuckDown;
}

function integrateAir(state, dt, tuckDown) {
  const targetPose = state.opened || !tuckDown ? 0 : 1;
  const pose0 = state.pose;
  const pose1 = targetPose + (pose0 - targetPose) * Math.exp(-WORLD.poseK * dt);
  const avgPose = (pose0 + pose1) * 0.5;
  state.pose = pose1;
  const omega = state.omegaStraight + (state.omegaTuck - state.omegaStraight) * avgPose;
  state.rotation += omega * dt;
  state.y += state.vy * dt + 0.5 * WORLD.g * dt * dt;
  state.vy += WORLD.g * dt;
  state.x += state.vx * dt;
}

function finish(state) {
  if (state.result) return;
  state.y = WORLD.waterY + 6;
  state.vy = 0;
  state.metrics.avgPose = state.poseN ? state.poseSum / state.poseN : 0;
  state.metrics.twistHits = state.twistHits;
  const rawError = state.rotation - state.targetRad;
  state.metrics.angleError = state.training ? rawError * 0.72 : rawError;
  state.metrics.grab = state.grabValue ?? 0;
  state.metrics.approach = average(state.approachScores);
  state.result = evaluate(state.metrics, state.dive);
  state.phase = 'result';
  state.splash = createSplash(state.x, WORLD.waterY, state.result);
  state.splashT = 0;
}

function placeOnBoard(state) {
  state.bend = state.phase === 'takeoff'
    ? oscAt(state.boardT, state.takeoffPeriod) * 30
    : 0;
  state.y = WORLD.platformY + state.bend - 42;
  if (state.phase === 'approach') {
    state.x = STEP_X[Math.min(STEP_X.length - 1, state.approachScores.length)];
  }
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function setFlash(state, score) {
  state.flashSeq += 1;
  state.flash = {
    id: state.flashSeq,
    score,
    text: score >= 0.92 ? 'Perfekt' : score >= 0.62 ? 'Gut' : score >= 0.28 ? 'Knapp' : 'Daneben',
    life: 0.45,
  };
}

function decayFlash(state, dt) {
  if (!state.flash) return;
  state.flash.life -= dt;
  if (state.flash.life <= 0) state.flash = null;
}

function createSplash(x, y, result) {
  const entry = result.phases?.entry ?? 0;
  const rip = result.rip;
  const messy = !rip && entry < 0.45;
  const particles = [];
  const drops = rip ? 9 : messy ? 26 : 14;
  const spread = rip ? 0.38 : messy ? 2.05 : 1.05;
  for (let i = 0; i < drops; i += 1) {
    const angle = -Math.PI / 2 + ((i / (drops - 1)) - 0.5) * spread;
    const speed = (rip ? 60 : messy ? 150 : 100) + (i % 5) * (rip ? 14 : 28);
    particles.push({
      kind: 'drop',
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: rip ? 2.2 : 3.1 + (i % 3),
      life: rip ? 1.15 : messy ? 1.45 : 1.25,
      max: rip ? 1.15 : messy ? 1.45 : 1.25,
    });
  }
  particles.push({
    kind: 'ring',
    x,
    y,
    r: 8,
    vr: rip ? 70 : messy ? 240 : 140,
    life: rip ? 1.6 : 1.15,
    max: rip ? 1.6 : 1.15,
    rip,
  });
  if (messy) {
    particles.push({
      kind: 'sheet',
      x,
      y,
      r: 22,
      vr: 150,
      life: 1.35,
      max: 1.35,
    });
  }
  const bubbles = rip ? 10 : entry > 0.5 ? 4 : 0;
  for (let i = 0; i < bubbles; i += 1) {
    particles.push({
      kind: 'bubble',
      x: x + ((i % 5) - 2) * (rip ? 3 : 7),
      y: y + 8 + (i % 3) * 6,
      vy: rip ? -70 - (i % 4) * 16 : -40,
      phase: i * 0.7,
      r: rip ? 2.4 + (i % 3) : 3.2,
      life: 1.7,
      max: 1.7,
    });
  }
  return particles;
}

function advanceSplash(state, dt) {
  for (const particle of state.splash) {
    if (particle.kind === 'bubble') {
      particle.y += particle.vy * dt;
      particle.x += Math.sin(state.splashT * 7 + particle.phase) * 18 * dt;
    } else if (particle.kind === 'ring' || particle.kind === 'sheet') {
      particle.r += particle.vr * dt;
    } else {
      particle.vy += 820 * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }
    particle.life -= dt;
  }
}

export function present(state) {
  if (!state) return null;
  const osc = state.phase === 'approach'
    ? oscAt(state.time, state.approachPeriod)
    : state.phase === 'takeoff'
      ? oscAt(state.boardT, state.takeoffPeriod)
      : 0;
  const band = state.metrics.powerBand;
  const inBand = state.power >= band[0] && state.power <= band[1];
  const copy = cues(state, inBand);

  const showTiming = state.phase === 'approach' || (state.phase === 'takeoff' && state.stage === 'snap');
  const showPower = state.phase === 'takeoff' && state.stage === 'charge';
  const remaining = state.phase === 'flight' || state.phase === 'kickout'
    ? timeToWater(state.y, state.vy)
    : 99;
  const showLineup = !state.opened && (
    state.phase === 'kickout' || (state.phase === 'flight' && state.airTime > 0.45 && remaining < 1.35)
  );
  const showGrab = state.phase === 'entry';
  const showTwist = state.dive.twistHalves > 0 && (state.phase === 'flight' || state.phase === 'kickout') && !state.opened;
  const twistOsc = oscAt(state.airTime, state.twistPeriod);
  const grabOsc = showGrab ? grabMarker(state) : 0;
  const active = showTwist ? twistOsc : showGrab ? grabOsc : osc;
  const hotAt = state.training ? 0.78 : 0.86;
  const errorScale = state.training ? 0.7 : 1;

  return {
    phase: state.phase,
    phaseLabel: phaseLabel(state),
    instruction: copy.instruction,
    tip: copy.tip,
    training: state.training,
    showTiming,
    timing: osc,
    timingHot: active >= hotAt,
    showPower,
    power: state.power,
    powerHot: inBand && state.phase === 'takeoff' && state.stage === 'charge',
    powerBand: band,
    showLineup,
    lineup: showLineup ? clampMeter((predictError(state) * errorScale) / (Math.PI / 2)) : 0,
    showGrab,
    grab: grabOsc,
    showTwist,
    twist: showTwist ? twistOsc : 0,
    twistTaps: state.twistTaps,
    twistNeed: state.dive.twistHalves,
    somersaults: state.rotation / (Math.PI * 2),
    somersaultTarget: state.dive.somersaults,
    halfCount: state.halfCount,
    halfTarget: Math.round(state.dive.somersaults * 2),
    halfPulse: state.halfPulse,
    halfSeq: state.halfSeq,
    inAir: state.phase === 'flight' || state.phase === 'kickout' || state.phase === 'entry',
    flash: state.flash,
    result: state.result,
    splashT: state.splashT,
    dive: state.dive,
  };
}

function cues(state, inBand) {
  const step = Math.min(3, Math.floor(state.time / state.approachPeriod) + 1);
  if (state.phase === 'approach' && state.approachLead > 0) {
    return {
      instruction: 'Bereit — der Ring startet gleich',
      tip: 'Leertaste, wenn er oben gold wird. Drei Schritte.',
    };
  }
  if (state.phase === 'approach') {
    return {
      instruction: `Anlauf ${step}/3 — Leertaste, wenn der Ring gold wird`,
      tip: 'Drei Schritte. Gold ist voll, knapp daneben zählt noch.',
    };
  }
  if (state.phase === 'takeoff' && state.stage === 'charge') {
    return inBand
      ? { instruction: 'Absprung — jetzt loslassen', tip: 'Die Kraft sitzt im grünen Band.' }
      : { instruction: 'Absprung — Leertaste halten, bis die Kraft grün ist', tip: 'Im grünen Band läuft die Anzeige langsamer.' };
  }
  if (state.phase === 'takeoff') {
    return {
      instruction: 'Absprung — noch einmal Leertaste im goldenen Ring',
      tip: 'Das ist der tiefste Punkt des Bretts.',
    };
  }
  if (state.phase === 'flight') {
    const quiet = state.airTime > 0.3 && state.pose < 0.3;
    const twist = state.dive.twistHalves > 0
      ? ` Dazu T im goldenen Ring (${state.twistTaps}/${state.dive.twistHalves}).`
      : '';
    return quiet
      ? { instruction: 'Flug — S oder ↓ gedrückt halten', tip: 'Ohne Hocke kommt die Drehung nicht herum.' }
      : { instruction: `Flug — S halten, bis die Drehung sitzt.${twist}`, tip: 'Der Ring an der Figur füllt jede halbe Drehung.' };
  }
  if (state.phase === 'kickout' && state.kickoutAge < (state.training ? 0.2 : 0.12)) {
    return {
      instruction: 'Öffnen — Nadel lesen, S noch halten',
      tip: 'Gleich loslassen, wenn sie in der Mitte steht.',
    };
  }
  if (state.phase === 'kickout') {
    return {
      instruction: 'Öffnen — S loslassen, wenn die Nadel in der Mitte steht',
      tip: 'Links ist zu kurz, rechts überdreht.',
    };
  }
  if (state.phase === 'entry') {
    return state.grabbed
      ? { instruction: 'Eintritt — Hände sind gesetzt', tip: 'Ein späterer, besserer Druck ersetzt den ersten.' }
      : { instruction: 'Eintritt — Leertaste, wenn der Ring auf der Wasserlinie aufgeht', tip: 'Gold heißt greifen. Die Note nutzt denselben Moment.' };
  }
  return { instruction: '', tip: '' };
}

function phaseLabel(state) {
  if (state.phase === 'approach') return 'Anlauf';
  if (state.phase === 'takeoff') return 'Absprung';
  if (state.phase === 'flight') return 'Flug';
  if (state.phase === 'kickout') return 'Öffnen';
  if (state.phase === 'entry') return 'Eintritt';
  return 'Ergebnis';
}

function clampMeter(value) {
  return Math.min(1, Math.max(-1, value));
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

/** Dieselbe Öffnung wie die Note: 1, wenn die Hände über der Wasserlinie greifen sollen. */
export function grabOpen(state) {
  return grabMarker(state);
}

function grabMarker(state) {
  if (!state.entryCue) return 0;
  const span = Math.max(0.001, state.entryCue.end - state.entryCue.start);
  const progress = (state.airTime - state.entryCue.start) / span;
  const peak = clamp01((state.entryCue.peak - state.entryCue.start) / span);
  const distance = Math.abs(progress - peak) / 0.62;
  if (distance >= 1) return 0;
  return Math.cos(distance * Math.PI / 2);
}
