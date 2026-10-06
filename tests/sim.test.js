import assert from 'node:assert/strict';
import test from 'node:test';
import { DIVES } from '../src/dives.js';
import { createLatch, policyInput } from '../src/policy.js';
import { startDive, step } from '../src/sim.js';

function run(dive, mode) {
  const state = startDive(dive);
  const seen = new Set([state.phase]);
  const latch = createLatch();
  for (let i = 0; i < 60 * 18; i += 1) {
    if (state.phase === 'result') break;
    step(state, policyInput(state, mode, latch), 1 / 60);
    seen.add(state.phase);
  }
  return { state, seen };
}

function dump(state) {
  return JSON.stringify({
    phase: state.phase,
    execution: state.result?.execution,
    total: state.result?.total,
    notes: state.result?.notes,
    phases: state.result?.phases,
    metrics: state.metrics,
    rotation: Number(state.rotation.toFixed(3)),
    target: Number(state.targetRad.toFixed(3)),
  }, null, 2);
}

test('ein sauberer 101C durchläuft alle fünf Phasen und liegt über 8', () => {
  const { state, seen } = run(DIVES[0], 'perfect');
  for (const phase of ['approach', 'takeoff', 'flight', 'kickout', 'entry', 'result']) {
    assert.ok(seen.has(phase), `${phase} fehlt\n${dump(state)}`);
  }
  assert.ok(state.result.execution >= 8, dump(state));
  assert.ok(state.result.total > 11, dump(state));
});

test('derselbe Sprung wird bei schlechtem Timing klar schlechter', () => {
  const good = run(DIVES[0], 'perfect').state.result;
  const bad = run(DIVES[0], 'sloppy').state.result;
  const idle = run(DIVES[0], 'none').state.result;
  assert.ok(good.execution - bad.execution >= 2.5, JSON.stringify({ good, bad }, null, 2));
  assert.ok(idle.execution < 5, JSON.stringify(idle, null, 2));
  assert.ok(bad.total < good.total);
});

test('früher öffnen und verpasster Hand-Grab kosten Punkte', () => {
  const good = run(DIVES[1], 'perfect').state;
  const early = run(DIVES[1], 'early').state;
  const noGrab = run(DIVES[0], 'no-grab').state;
  assert.ok(good.result.execution >= 8, dump(good));
  assert.ok(early.result.phases.kickout < good.result.phases.kickout, `${dump(early)}\n${dump(good)}`);
  assert.ok(early.result.total < good.result.total - 0.6);
  assert.ok(noGrab.result.phases.entry < 0.2, dump(noGrab));
  assert.ok(noGrab.result.total < run(DIVES[0], 'perfect').state.result.total - 1.5);
});

test('Salto und Schraube bleiben bei gutem Input wertbar und der DD hebt die Punktzahl', () => {
  const salto = run(DIVES[1], 'perfect').state;
  const twist = run(DIVES[2], 'perfect').state;
  assert.ok(salto.result.execution >= 8, dump(salto));
  assert.ok(twist.result.execution >= 8, dump(twist));
  assert.equal(twist.metrics.twistHits, 2);
  assert.ok(twist.result.total > salto.result.total);
  assert.match(twist.result.notes.rotation, /Schraube/);
});
