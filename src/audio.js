let ctx;
let ambience;
let ambienceGain;
let noise;

function context() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noiseBuffer(audio) {
  if (noise) return noise;
  const length = audio.sampleRate;
  noise = audio.createBuffer(1, length, audio.sampleRate);
  const data = noise.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    brown = brown * 0.97 + white * 0.03;
    data[i] = brown * 2.2;
  }
  return noise;
}

function burst(seconds, frequency, q, gainValue) {
  const audio = context();
  if (!audio) return;
  const source = audio.createBufferSource();
  source.buffer = noiseBuffer(audio);
  const filter = audio.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(gainValue, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + seconds);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  source.start();
  source.stop(audio.currentTime + seconds + 0.02);
}

function tone(frequency, duration, gainValue, type = 'sine') {
  const audio = context();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(gainValue, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration + 0.02);
}

function ensureAmbience() {
  const audio = context();
  if (!audio || ambience) return;
  ambience = audio.createBufferSource();
  ambience.buffer = noiseBuffer(audio);
  ambience.loop = true;
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  ambienceGain = audio.createGain();
  ambienceGain.gain.value = 0.0001;
  ambience.connect(filter);
  filter.connect(ambienceGain);
  ambienceGain.connect(audio.destination);
  ambience.start();
}

export function unlockAudio() {
  ensureAmbience();
  setAmbience('idle');
}

export function setAmbience(mode) {
  const audio = context();
  if (!audio || !ambienceGain) return;
  const level = mode === 'hush' ? 0.0015 : mode === 'after' ? 0.02 : 0.008;
  ambienceGain.gain.cancelScheduledValues(audio.currentTime);
  ambienceGain.gain.setTargetAtTime(level, audio.currentTime, 0.25);
}

export function playCreak() {
  tone(92, 0.09, 0.03, 'triangle');
  tone(180, 0.05, 0.012, 'sine');
}

export function playSpin() {
  tone(760, 0.045, 0.03);
}

export function playWhoosh() {
  burst(0.28, 900, 0.7, 0.03);
}

export function playJudge(score) {
  if (score >= 0.92) tone(880, 0.08, 0.04);
  else if (score >= 0.62) tone(640, 0.07, 0.03);
  else tone(196, 0.1, 0.035, 'triangle');
}

export function playSplash(rip) {
  if (rip) {
    burst(0.12, 1800, 4, 0.07);
    tone(660, 0.08, 0.03);
    return;
  }
  burst(0.42, 240, 0.6, 0.08);
  tone(110, 0.18, 0.04, 'triangle');
}
