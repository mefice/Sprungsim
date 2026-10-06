import { WORLD, emptyInput, oscAt, predictError } from './sim.js';

export function createLatch() {
  return { approachBeat: -1, approach: false, snap: false, twist: false };
}

/** Dieselbe Eingabe wie in den Tests. `perfect` ist der Referenzsprung. */
export function policyInput(state, mode, latch) {
  const input = emptyInput();
  if (mode === 'none') return input;

  if (state.phase === 'approach') {
    const period = state.approachPeriod ?? WORLD.approachPeriod;
    const beat = Math.floor(state.time / period);
    if (latch.approachBeat !== beat) {
      latch.approachBeat = beat;
      latch.approach = false;
    }
    const osc = oscAt(state.time, period);
    const hit = mode === 'sloppy' ? osc >= 0.02 && osc <= 0.18 : osc >= 0.93;
    if (hit && !latch.approach) {
      input.spacePressed = true;
      latch.approach = true;
    }
  }

  if (state.phase === 'takeoff' && state.stage === 'charge' && !state.needFreshPress) {
    const [min, max] = state.metrics?.powerBand ?? state.dive.powerBand;
    const mid = (min + max) / 2;
    input.spaceDown = mode === 'sloppy' ? state.power < 0.12 : state.power < mid;
  }

  if (state.phase === 'takeoff' && state.stage === 'snap' && !state.needFreshPress) {
    const osc = oscAt(state.boardT, state.takeoffPeriod ?? WORLD.takeoffPeriod);
    const hit = mode === 'sloppy' ? osc >= 0.12 && osc <= 0.3 : osc >= 0.93;
    if (hit && !latch.snap) {
      input.spacePressed = true;
      latch.snap = true;
    }
  }

  const airborne = state.phase === 'flight' || state.phase === 'kickout';
  if (mode !== 'sloppy' && airborne && !state.opened) {
    if (state.phase === 'kickout' && mode === 'early') input.tuckDown = false;
    else if (state.phase === 'kickout') input.tuckDown = predictError(state) < -0.05;
    else input.tuckDown = true;

    if (state.dive.twistHalves > 0) {
      const osc = oscAt(state.airTime, state.twistPeriod ?? WORLD.twistPeriod);
      if (osc >= 0.93 && !latch.twist) {
        input.twistPressed = true;
        latch.twist = true;
      }
      if (osc < 0.4) latch.twist = false;
    }
  }

  if (mode !== 'sloppy' && mode !== 'no-grab' && state.phase === 'entry' && !state.grabbed) {
    const dist = WORLD.waterY - state.y;
    if (dist <= 130 && dist >= 20) input.spacePressed = true;
  }

  return input;
}
