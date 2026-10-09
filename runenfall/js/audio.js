// Synthetische Soundeffekte (Web Audio) – keine Audiodateien nötig, läuft offline.
import { save } from './save.js';

let ctx = null;
let master = null;
const last = {};

function ac() {
  if (!save.settings.sound) return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch (e) { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'sine', vol = 0.1, slide = 0, delay = 0) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}
let noiseBuf = null;
function noise(dur, vol, filterFreq = 1200) {
  const a = ac(); if (!a) return;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
  src.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = filterFreq;
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  src.connect(f).connect(g).connect(master);
  src.start(); src.stop(a.currentTime + dur);
}
/** Begrenzt, wie oft ein Sound pro Sekunde spielen darf. */
function throttle(key, ms) {
  const now = performance.now();
  if (last[key] && now - last[key] < ms) return false;
  last[key] = now;
  return true;
}

export const sfx = {
  click: () => tone(520, 0.05, 'triangle', 0.06),
  hit: () => throttle('hit', 70) && tone(220 + Math.random() * 80, 0.05, 'square', 0.025, -80),
  crit: () => throttle('crit', 90) && tone(900, 0.07, 'triangle', 0.05, -300),
  kill: () => throttle('kill', 60) && noise(0.08, 0.05, 900),
  xp: () => throttle('xp', 45) && tone(1000 + Math.random() * 400, 0.04, 'sine', 0.025),
  gold: () => throttle('gold', 80) && tone(1500, 0.06, 'triangle', 0.04),
  hurt: () => throttle('hurt', 150) && (noise(0.18, 0.18, 600), tone(140, 0.2, 'sawtooth', 0.06, -60)),
  dodge: () => throttle('dodge', 150) && tone(700, 0.06, 'sine', 0.04, 300),
  levelup: () => { tone(440, 0.12, 'triangle', 0.08); tone(660, 0.12, 'triangle', 0.08, 0, 0.1); tone(880, 0.25, 'triangle', 0.08, 0, 0.2); },
  boom: () => throttle('boom', 90) && noise(0.3, 0.12, 400),
  zap: () => throttle('zap', 80) && tone(1800, 0.06, 'sawtooth', 0.025, -1200),
  boss: () => { tone(80, 1.2, 'sawtooth', 0.12, -30); noise(1, 0.1, 300); },
  death: () => { tone(300, 1, 'sawtooth', 0.12, -250); noise(0.8, 0.15, 500); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.08, 0, i * 0.12)); },
  loot: () => { tone(880, 0.1, 'sine', 0.07); tone(1320, 0.2, 'sine', 0.07, 0, 0.08); },
  deny: () => tone(150, 0.15, 'square', 0.06),
};

export function buzz(p) {
  if (save.settings.vibrate && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* egal */ } }
}
export const unlockAudio = () => ac();
