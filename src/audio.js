let ctx;

function context() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() {
  context();
}

function tone(frequency, duration, gainValue, type = 'sine') {
  const audio = context();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = gainValue;
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration);
}

export function playJudge(score) {
  if (score >= 0.92) tone(880, 0.09, 0.05);
  else if (score >= 0.62) tone(640, 0.08, 0.04);
  else tone(196, 0.12, 0.04, 'triangle');
}

export function playEntry(rip) {
  tone(rip ? 520 : 140, rip ? 0.12 : 0.22, 0.06, rip ? 'sine' : 'triangle');
}
