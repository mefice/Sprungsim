import assert from 'node:assert/strict';
import test from 'node:test';
import { DIVES } from '../src/dives.js';
import { angleScore, bandScore, evaluate, peakScore } from '../src/scoring.js';

const perfectRaw = {
  approach: 1,
  takeoffTiming: 1,
  takeoffPower: 1,
  powerRaw: 0.7,
  powerBand: [0.56, 0.82],
  avgPose: 0.9,
  twistHits: 2,
  angleError: 0,
  grab: 1,
};

test('Timing am Scheitel ist besser als ein früher Druck', () => {
  assert.equal(peakScore(1), 1);
  assert.ok(peakScore(0.8) < peakScore(0.95));
  assert.ok(peakScore(0.1) < 0.15);
});

test('Kraft im Band ist voll, daneben schlechter', () => {
  assert.equal(bandScore(0.7, [0.56, 0.82]), 1);
  assert.ok(bandScore(0.2, [0.56, 0.82]) < 0.5);
  assert.ok(bandScore(1, [0.56, 0.82]) < bandScore(0.84, [0.56, 0.82]));
});

test('Ausführung × DD und Rip bleiben nachvollziehbar', () => {
  const easy = evaluate(perfectRaw, DIVES[0]);
  const hard = evaluate({ ...perfectRaw, powerBand: DIVES[2].powerBand }, DIVES[2]);
  assert.equal(easy.execution, 10);
  assert.equal(hard.execution, 10);
  assert.ok(hard.total > easy.total);
  assert.equal(easy.total, 14);
  assert.equal(hard.total, 20);
  assert.equal(easy.rip, true);
  assert.match(easy.notes.takeoff, /Absprung/);
  assert.match(easy.notes.entry, /Rip/);
});

test('Verpasster Eintritt senkt die Ausführung deutlich', () => {
  const good = evaluate(perfectRaw, DIVES[0]);
  const missed = evaluate({ ...perfectRaw, grab: 0 }, DIVES[0]);
  assert.ok(good.execution - missed.execution >= 2);
  assert.match(missed.notes.entry, /verpasst/);
  assert.ok(angleScore(1.4) < angleScore(0.1));
});
