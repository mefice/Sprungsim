/** Transparente Slice-Wertung: Ausführung 0–10, Punkte = Ausführung × DD. */

const WEIGHTS = {
  approach: 1.0,
  takeoff: 2.2,
  flight: 2.2,
  kickout: 1.8,
  entry: 2.6,
};

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

/** 1 im goldenen Scheitel. Knapp daneben bleibt brauchbar, weit daneben nicht. */
export function peakScore(value) {
  const v = clamp(value);
  if (v >= 0.86) return 1;
  if (v >= 0.55) return 0.7 + ((v - 0.55) / 0.31) * 0.3;
  if (v >= 0.28) return 0.34 + ((v - 0.28) / 0.27) * 0.36;
  return (v / 0.28) * 0.34;
}

/** Training zieht einen knapp verpassten Druck deutlich näher an den Scheitel. */
export function rateOsc(osc, training = false) {
  const eased = training ? osc + (1 - osc) * 0.5 : osc;
  return peakScore(eased);
}

export function bandFor(band, training = false) {
  if (!training) return band;
  const [min, max] = band;
  return [Math.max(0.08, min - 0.24), Math.min(1, max + 0.2)];
}

/** 1 innerhalb des Kraftbands, linear abfallend außerhalb. */
export function bandScore(value, [min, max]) {
  if (value >= min && value <= max) return 1;
  const span = Math.max(0.08, max - min);
  const dist = value < min ? min - value : value - max;
  return clamp(1 - dist / (span + 0.25));
}

/** 1 bei vertikalem Eintritt. errorRad = Ist-Rotation minus Soll. */
export function angleScore(errorRad) {
  const a = Math.abs(errorRad);
  if (a <= 0.16) return 1;
  if (a <= 0.45) return 1 - ((a - 0.16) / 0.29) * 0.35;
  if (a <= 1.15) return 0.65 - ((a - 0.45) / 0.7) * 0.55;
  return clamp(0.1 - (a - 1.15) * 0.08, 0, 1);
}

/** Distanz der Hände über dem Wasser, Ideal 72 px. Das Fenster ist bewusst lesbar. */
export function grabScore(dist) {
  const d = Math.abs(dist - 72);
  if (d <= 70) return 1;
  if (d <= 130) return 1 - ((d - 70) / 60) * 0.45;
  if (d <= 210) return 0.55 - ((d - 130) / 80) * 0.5;
  return 0.05;
}

export function formatPoints(value, digits = 2) {
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function ratingFor(execution) {
  if (execution >= 8.5) return { text: 'Ausgezeichnet', className: 'excellent' };
  if (execution >= 7) return { text: 'Gut', className: 'good' };
  if (execution >= 5.5) return { text: 'Ordentlich', className: 'ok' };
  return { text: 'Verbesserungswürdig', className: 'poor' };
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function takeoffNote(raw, takeoff) {
  if (takeoff >= 0.9) return 'Absprung sitzt: Tiefpunkt und Kraft passen.';
  const timing = raw.takeoffTiming >= 0.85
    ? 'Timing am Tiefpunkt'
    : raw.takeoffTiming >= 0.55
      ? 'Absprung knapp neben dem Tiefpunkt'
      : 'Absprung verpasst';
  let power = 'Kraft außerhalb des Ziels';
  if (raw.takeoffPower >= 0.85) power = 'Kraft im Zielbereich';
  else if (raw.powerRaw < raw.powerBand[0]) power = 'zu wenig Kraft für diesen Sprung';
  else if (raw.powerRaw > raw.powerBand[1]) power = 'zu viel Kraft, die Kontrolle leidet';
  else power = 'Kraft leicht daneben';
  return `${timing}. ${power}.`;
}

function rotationNote(raw, dive, kickout) {
  const error = raw.angleError;
  let line;
  if (raw.avgPose < 0.35) line = 'Position zu offen, die Rotation kommt nicht herum.';
  else if (error > 0.5) line = 'Überdreht — zu spät geöffnet.';
  else if (error < -0.5) line = 'Zu früh geöffnet, der Sprung kommt kurz.';
  else if (kickout >= 0.85 && raw.avgPose >= 0.62) line = 'Rotation und Linie sitzen.';
  else line = 'Linie fast vertikal, das Öffnen war nicht ganz sauber.';

  if (dive.twistHalves <= 0) return line;
  const twist = clamp(raw.twistHits / dive.twistHalves);
  if (twist >= 0.85) return `${line} Schraube im Rhythmus.`;
  if (twist >= 0.45) return `${line} Schraube unruhig.`;
  return `${line} Schraube aus dem Takt.`;
}

function entryNote(raw, kickout) {
  if (raw.grab >= 0.88 && kickout >= 0.72) return 'Rip — Hände flach, fast ohne Spritzer.';
  if (raw.grab >= 0.65) return 'Sauberer Eintritt, kleiner Spritzer.';
  if (raw.grab <= 0.001) return 'Hand-Grab verpasst, großer Spritzer.';
  if (kickout < 0.4) return 'Eintrittswinkel flach, dazu unruhige Hände.';
  return 'Eintritt mit sichtbarem Spritzer.';
}

/**
 * @param {object} raw Messwerte eines Sprungs
 * @param {object} dive Sprungdefinition
 */
export function evaluate(raw, dive) {
  const approach = clamp(raw.approach);
  const takeoff = clamp(raw.takeoffTiming * 0.5 + raw.takeoffPower * 0.5);
  const tuck = clamp(raw.avgPose / 0.72);
  const twist = dive.twistHalves > 0 ? clamp(raw.twistHits / dive.twistHalves) : 1;
  const flight = dive.twistHalves > 0 ? tuck * 0.62 + twist * 0.38 : tuck;
  const kickout = angleScore(raw.angleError);
  const entry = clamp(raw.grab);

  const parts = [
    ['Anlauf', approach, WEIGHTS.approach],
    ['Absprung', takeoff, WEIGHTS.takeoff],
    ['Rotation', flight, WEIGHTS.flight],
    ['Öffnen', kickout, WEIGHTS.kickout],
    ['Eintritt', entry, WEIGHTS.entry],
  ];

  let deduction = 0;
  const breakdown = parts.map(([label, value, weight]) => {
    const loss = (1 - value) * weight;
    deduction += loss;
    return { label, value, deduction: round1(loss) };
  });

  const rip = raw.grab >= 0.88 && Math.abs(raw.angleError) <= 0.4 && kickout >= 0.72;
  let execution = 10 - deduction + (rip ? 0.3 : 0);
  execution = clamp(execution, 0, 10);
  execution = Math.round(execution * 10) / 10;
  const total = Math.round(execution * dive.dd * 100) / 100;

  return {
    execution,
    total,
    dd: dive.dd,
    rip,
    rating: ratingFor(execution),
    breakdown,
    phases: { approach, takeoff, flight, kickout, entry },
    notes: {
      takeoff: takeoffNote(raw, takeoff),
      rotation: rotationNote(raw, dive, kickout),
      entry: entryNote(raw, kickout),
    },
  };
}
