// Synthetische Soundeffekte (Web Audio) – keine Audiodateien nötig, läuft offline.
// Mischpult: Effekte (sfxBus) und Musik (musicBus, duckbar) → Master → sanfter Limiter → Ausgang.
// Ein gemeinsamer Hall (Faltung mit erzeugter Impulsantwort) wird von Effekten und Musik angesteuert.
import { save } from './save.js';

let ctx = null, failed = false, test = false, muted = false;
let master = null, sfxBus = null, sfxRev = null, musicBus = null, musicRev = null, duck = [], noiseBuf = null;
const last = {}, hooks = [];
const MASTER = 0.36, SFX_WET = 0.16; // Master leiser als früher (0.5): der Limiter hebt leise Signale um ~3 dB an

const hidden = () => typeof document !== 'undefined' && !!document.hidden;
/** Lautstärke aus den Einstellungen (0..1); fehlt der Wert, gilt der Standard. */
function vol(k, d) { const v = save.settings[k]; return typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(1, v)) : d; }
const quiet = (p) => { if (p && p.catch) p.catch(() => {}); };

function build(a) {
  const gain = (v, to) => { const n = a.createGain(); n.gain.value = v; n.connect(to); return n; };
  const comp = a.createDynamicsCompressor(); // fängt gestapelte Effekte ab, bevor es übersteuert
  comp.threshold.value = -9; comp.knee.value = 8; comp.ratio.value = 12; comp.attack.value = 0.003; comp.release.value = 0.2;
  comp.connect(a.destination);
  master = gain(save.settings.sound ? MASTER : 0, comp);
  const rev = a.createConvolver();
  rev.buffer = impulse(a, 1.6);
  rev.connect(gain(2, master)); // die normierte Faltung ist recht leise
  const s = vol('sfxVol', 1), m = vol('musicVol', 0.6);
  sfxBus = gain(s, master); sfxRev = gain(s * SFX_WET, rev);
  duck = [gain(1, master), gain(1, rev)];
  musicBus = gain(m, duck[0]); musicRev = gain(m, duck[1]);
}

/** Hall-Impulsantwort: Stereo-Rauschen, klingt exponentiell ab und wird nach hinten dunkler (einmalig erzeugt). */
function impulse(a, sec) {
  const sr = a.sampleRate, n = Math.floor(sr * sec), pre = Math.floor(sr * 0.012), b = a.createBuffer(2, n, sr);
  const dEnv = Math.pow(0.001, 1 / (n - pre)), dK = Math.pow(0.1, 1 / (n - pre)), fade = sr * 0.005;
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let lp = 0, lo = 0, env = 1, k = 0.85;
    for (let i = pre; i < n; i++) {
      lp += k * (Math.random() * 2 - 1 - lp); // Tiefpass schließt sich mit der Zeit
      lo += 0.025 * (lp - lo); // tiefe Anteile abziehen (kein Dröhnen)
      d[i] = (lp - lo) * env * Math.min(1, (i - pre) / fade);
      env *= dEnv; k *= dK;
    }
  }
  return b;
}

function ac() {
  if (!save.settings.sound) { mute(); return null; }
  if (!ctx) {
    if (failed) return null;
    const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
    if (!AC) { failed = true; return null; }
    try { ctx = new AC(); build(ctx); } catch (e) { ctx = null; failed = true; return null; }
  }
  if (muted) unmute();
  if (!test && ctx.state !== 'running' && !hidden()) quiet(ctx.resume());
  return ctx;
}
/** Ton aus: Master schnell stumm, danach den Kontext anhalten (spart Akku). */
function mute() {
  if (!ctx || muted) return;
  muted = true;
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
  if (!test) setTimeout(() => { if (muted && ctx.state === 'running' && ctx.suspend) quiet(ctx.suspend()); }, 160);
}
function unmute() { muted = false; master.gain.setTargetAtTime(MASTER, ctx.currentTime, 0.015); }

// App im Hintergrund → Kontext anhalten, beim Zurückkehren fortsetzen (die Musik pausiert ihren Planer selbst)
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', () => {
    if (ctx && !test) {
      if (document.hidden) { if (ctx.state === 'running' && ctx.suspend) quiet(ctx.suspend()); }
      else if (save.settings.sound) quiet(ctx.resume());
    }
    for (const f of hooks) f();
  });
}

/** Ziel eines Effekts: trocken in den sfxBus, optional zusätzlich in den Hall. */
function out(a, n, wet) {
  n.connect(sfxBus);
  if (!wet) return;
  if (wet >= 1) n.connect(sfxRev);
  else { const s = a.createGain(); s.gain.value = wet; n.connect(s).connect(sfxRev); }
}
const nbuf = (a) => {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
};
const krate = (p) => { try { p.automationRate = 'k-rate'; } catch (e) { /* ältere Browser */ } return p; };

/** Ton: Frequenz, Dauer, Wellenform, Lautstärke, Gleiten (Hz), Verzögerung; o = { lp, atk, det, wet }. */
function tone(freq, dur, type = 'sine', vol = 0.1, slide = 0, delay = 0, o = {}) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay;
  const osc = a.createOscillator(), g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  if (o.det) osc.detune.value = o.det;
  if (o.atk) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + o.atk); } else g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let f = null;
  if (o.lp) { f = a.createBiquadFilter(); f.frequency.value = o.lp; osc.connect(f).connect(g); } else osc.connect(g);
  out(a, g, o.wet);
  osc.start(t); osc.stop(t + dur + 0.02);
  osc.onended = () => { g.disconnect(); if (f) f.disconnect(); };
}
/** Rauschen: Dauer, Lautstärke, Filterfrequenz, Verzögerung; o = { ft (Filtertyp), q, to (Filterfahrt), atk, wet }. */
function noise(dur, vol, filterFreq = 1200, delay = 0, o = {}) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay;
  const src = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
  src.buffer = nbuf(a); src.loop = dur > 0.45;
  f.type = o.ft || 'lowpass'; f.frequency.setValueAtTime(filterFreq, t);
  if (o.q) f.Q.value = o.q;
  if (o.to) krate(f.frequency).exponentialRampToValueAtTime(o.to, t + dur);
  if (o.atk) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + o.atk); } else g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g);
  out(a, g, o.wet);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  src.onended = () => { g.disconnect(); f.disconnect(); };
}
/** FM-Glocke: Träger + Modulator (Verhältnis r, Index i) – Glas, Glocken, Metall. */
function fm(freq, dur, vol, delay = 0, r = 3.5, i = 2, wet = 0) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay;
  const c = a.createOscillator(), m = a.createOscillator(), mg = a.createGain(), g = a.createGain();
  c.frequency.value = freq; m.frequency.value = freq * r;
  mg.gain.setValueAtTime(freq * i, t); mg.gain.exponentialRampToValueAtTime(freq * i * 0.04 + 1, t + dur * 0.6);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  m.connect(mg).connect(c.frequency); c.connect(g);
  out(a, g, wet);
  c.start(t); m.start(t); c.stop(t + dur + 0.02); m.stop(t + dur + 0.02);
  c.onended = () => { g.disconnect(); mg.disconnect(); };
}
/** Begrenzt, wie oft ein Sound pro Sekunde spielen darf. */
function throttle(key, ms) {
  const now = performance.now();
  if (last[key] && now - last[key] < ms) return false;
  last[key] = now;
  return true;
}
const EL = (e) => (e === 'fire' || e === 'cold' || e === 'light' || e === 'chaos' ? e : 'phys');
const XP = [1047, 1175, 1319, 1568, 1760, 2093]; // pentatonisch: schnelle Aufsammel-Folgen klingen melodisch

export const sfx = {
  click: () => tone(520, 0.05, 'triangle', 0.06),
  ui: () => throttle('ui', 30) && tone(1150, 0.035, 'sine', 0.04, -260),
  hit: () => throttle('hit', 70) && (tone(190 + Math.random() * 70, 0.06, 'triangle', 0.04, -80), noise(0.035, 0.03, 1900, 0, { ft: 'bandpass', q: 1.2 })),
  crit: () => throttle('crit', 90) && (tone(900, 0.08, 'triangle', 0.05, -300), tone(2400, 0.07, 'sine', 0.015, -500), noise(0.06, 0.03, 4200, 0, { ft: 'highpass' })),
  impact: (e) => {
    if (!throttle('impact', 80)) return;
    tone(135, 0.12, 'sine', 0.065, -75); noise(0.07, 0.06, 1300);
    const k = EL(e);
    if (k === 'fire') noise(0.12, 0.025, 2600, 0.015, { ft: 'bandpass', q: 1.5 });
    else if (k === 'cold') tone(3100, 0.07, 'sine', 0.014);
    else if (k === 'light') tone(1600, 0.05, 'sawtooth', 0.012, -900, 0, { lp: 5000 });
    else if (k === 'chaos') tone(96, 0.13, 'sawtooth', 0.03, -30, 0, { lp: 500 });
  },
  kill: () => throttle('kill', 60) && (noise(0.08, 0.05, 900), tone(240, 0.06, 'sine', 0.015, -140)),
  xp: () => throttle('xp', 45) && tone(XP[Math.floor(Math.random() * XP.length)], 0.045, 'sine', 0.025),
  gold: () => throttle('gold', 80) && (tone(1976, 0.05, 'triangle', 0.035), tone(2637, 0.09, 'triangle', 0.035, 0, 0.045)),
  hurt: () => throttle('hurt', 150) && (noise(0.18, 0.16, 600), tone(140, 0.2, 'sawtooth', 0.05, -60, 0, { lp: 1200 }), tone(78, 0.18, 'sine', 0.06, -28)),
  dodge: () => throttle('dodge', 150) && (tone(700, 0.06, 'sine', 0.035, 300), noise(0.12, 0.04, 1200, 0, { ft: 'bandpass', q: 1.5, to: 3600 })),
  heartbeat: () => throttle('heart', 900) && (tone(76, 0.15, 'sine', 0.14, -24), noise(0.06, 0.05, 220), tone(70, 0.17, 'sine', 0.11, -24, 0.19), noise(0.06, 0.04, 200, 0.19)),
  levelup: () => { [659, 831, 988, 1319].forEach((f, i) => fm(f, i < 3 ? 0.35 : 0.8, 0.045, i * 0.08, 2, 1, 0.6)); tone(1976, 0.5, 'sine', 0.012, 0, 0.3, { atk: 0.05, wet: 1 }); },
  boom: () => throttle('boom', 90) && (noise(0.3, 0.12, 400, 0, { wet: 0.6 }), tone(92, 0.32, 'sine', 0.07, -55)),
  zap: () => throttle('zap', 80) && (tone(1800, 0.06, 'sawtooth', 0.025, -1200), noise(0.03, 0.015, 5500, 0, { ft: 'highpass' })),
  chain: () => throttle('chain', 90) && (tone(2400, 0.06, 'sawtooth', 0.016, -1700, 0, { lp: 6000 }), noise(0.06, 0.025, 6000, 0, { ft: 'highpass' })),
  cast: (e) => {
    if (!throttle('cast', 90)) return;
    switch (EL(e)) {
      case 'fire': noise(0.15, 0.03, 600, 0, { ft: 'bandpass', q: 0.9, to: 2600, atk: 0.04 }); break;
      case 'cold': tone(2350 + Math.random() * 250, 0.09, 'sine', 0.014, 280); tone(3520, 0.07, 'sine', 0.007, 0, 0.012); break;
      case 'light': tone(1500, 0.05, 'sawtooth', 0.01, -700, 0, { lp: 4000 }); noise(0.035, 0.016, 5000, 0, { ft: 'highpass' }); break;
      case 'chaos': tone(118, 0.14, 'sawtooth', 0.022, -35, 0, { lp: 650 }); tone(125, 0.14, 'triangle', 0.022, -35); break;
      default: noise(0.06, 0.028, 1100, 0, { ft: 'bandpass', q: 1.1, to: 450 }); tone(170, 0.05, 'sine', 0.022, -60);
    }
  },
  explode: (e) => {
    if (!throttle('explode', 120)) return;
    const k = EL(e), ff = { fire: 900, cold: 2600, light: 1800, chaos: 500, phys: 600 }[k];
    noise(k === 'fire' ? 0.45 : 0.32, 0.1, ff, 0, { ft: k === 'cold' || k === 'light' ? 'bandpass' : 'lowpass', q: 0.8, to: ff * 0.35, wet: 0.6 });
    tone(k === 'chaos' ? 70 : 95, 0.3, 'sine', 0.065, -55);
    if (k === 'fire') noise(0.25, 0.03, 3500, 0.06, { ft: 'bandpass', q: 2 });
    else if (k === 'cold') { tone(2900, 0.18, 'sine', 0.018, 0, 0.02); tone(4100, 0.12, 'sine', 0.012, 0, 0.05); }
    else if (k === 'light') tone(2200, 0.08, 'sawtooth', 0.014, -1500, 0, { lp: 5000 });
    else if (k === 'chaos') tone(150, 0.25, 'sawtooth', 0.025, -90, 0, { lp: 600 });
  },
  /** Meteor: absteigendes Pfeifen, nach `fall` Sekunden ein dumpfer Einschlag. */
  meteor: (fall = 0.45) => {
    if (!throttle('meteor', 150)) return;
    const d = Math.max(0.15, Math.min(1.2, +fall || 0.45));
    tone(1700, d, 'sine', 0.02, -1250, 0, { atk: d * 0.5 });
    noise(d, 0.02, 1500, 0, { ft: 'bandpass', q: 3, to: 400, atk: d * 0.6 });
    tone(70, 0.4, 'sine', 0.075, -35, d); noise(0.35, 0.08, 380, d, { wet: 0.7 });
  },
  summon: () => {
    if (!throttle('summon', 300)) return;
    [392, 494, 587, 784].forEach((f, i) => tone(f, 0.55 - i * 0.05, 'sine', 0.028, f * 0.06, i * 0.05, { atk: 0.08, wet: 1 }));
    noise(0.4, 0.022, 800, 0, { ft: 'bandpass', q: 1.5, to: 4000, atk: 0.2, wet: 1 });
  },
  shatter: () => {
    if (!throttle('shatter', 120)) return;
    noise(0.22, 0.05, 3200, 0, { ft: 'highpass', wet: 0.6 });
    for (let i = 0; i < 3; i++) tone(2500 + Math.random() * 4000, 0.15 + Math.random() * 0.2, 'sine', 0.022, 0, i * 0.02 + Math.random() * 0.02, { wet: 0.6 });
  },
  trap: () => throttle('trap', 100) && (tone(1900, 0.02, 'square', 0.02, 0, 0, { lp: 3000 }), tone(1300, 0.03, 'square', 0.02, 0, 0.06, { lp: 3000 }), tone(320, 0.05, 'triangle', 0.03, -80, 0.06)),
  chest: () => {
    tone(110, 0.3, 'sawtooth', 0.03, 70, 0, { lp: 700 }); noise(0.08, 0.05, 900, 0.25);
    [1047, 1319, 1568, 2093].forEach((f, i) => fm(f, 0.6, 0.03, 0.3 + i * 0.06, 2, 1, 1));
    noise(0.8, 0.02, 6000, 0.3, { ft: 'bandpass', q: 1, atk: 0.2, wet: 1 });
  },
  craft: () => {
    fm(1250, 0.5, 0.07, 0, 1.41, 2.5, 0.5); noise(0.04, 0.05, 3000, 0, { ft: 'highpass' });
    fm(1250, 0.35, 0.03, 0.14, 1.41, 2, 0.5);
    [2637, 3136, 3951].forEach((f, i) => tone(f, 0.18, 'sine', 0.014, 0, 0.18 + i * 0.05, { wet: 1 }));
  },
  evolve: () => {
    [523, 659, 740, 784, 988, 1175, 1319].forEach((f, i) => fm(f, 0.7, 0.035, i * 0.07, 2, 1, 1)); // lydisch aufwärts
    noise(1.1, 0.025, 5000, 0.1, { ft: 'bandpass', q: 1.2, atk: 0.5, wet: 1 });
    [1047, 1319, 1568].forEach((f) => tone(f, 1, 'sine', 0.016, 0, 0.5, { atk: 0.15, wet: 1 }));
  },
  boss: () => { tone(80, 1.2, 'sawtooth', 0.12, -30, 0, { lp: 900, wet: 0.5 }); noise(1, 0.1, 300); },
  bossPhase: () => {
    tone(55, 1.6, 'sawtooth', 0.08, 0, 0, { lp: 320, atk: 0.6, wet: 1 });
    tone(82.5, 1.6, 'sawtooth', 0.05, 0, 0, { lp: 280, atk: 0.7, det: 8, wet: 1 });
    fm(310, 1.4, 0.07, 0.55, 1.41, 3, 1); noise(0.6, 0.06, 500, 0.55, { wet: 1 });
  },
  bossDie: () => {
    noise(1.2, 0.16, 320, 0, { wet: 1 }); tone(70, 1.4, 'sine', 0.2, -45);
    tone(420, 1.6, 'sawtooth', 0.05, -360, 0.05, { lp: 1400, wet: 1 });
    [1568, 1976, 2349, 2637, 3136].forEach((f, i) => fm(f, 1.2, 0.022, 0.35 + i * 0.22, 2, 1.2, 1));
  },
  nemesis: () => {
    [73.4, 77.8, 103.8].forEach((f) => tone(f, 1.4, 'sawtooth', 0.05, 0, 0, { lp: 600, atk: 0.25, wet: 1 }));
    fm(740, 1.2, 0.04, 0.05, 1.41, 3, 1); noise(0.5, 0.08, 400, 0, { wet: 1 });
  },
  death: () => { tone(300, 1, 'sawtooth', 0.12, -250, 0, { lp: 1500, wet: 0.6 }); noise(0.8, 0.15, 500, 0, { wet: 0.6 }); tone(110, 1.2, 'sine', 0.1, -55); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => { tone(f, 0.3, 'triangle', 0.07, 0, i * 0.12, { wet: 0.5 }); fm(f * 2, 0.5, 0.012, i * 0.12, 2, 0.6); }); },
  loot: () => { fm(880, 0.4, 0.06, 0, 2, 1.2, 0.5); fm(1320, 0.6, 0.06, 0.08, 2, 1.2, 0.5); },
  deny: () => { tone(150, 0.15, 'square', 0.04, 0, 0, { lp: 900 }); tone(146, 0.15, 'triangle', 0.04); },
  /** Musik für `seconds` auf `level` (0..1) absenken, danach sanft zurück. */
  setDuck: (level = 0.3, seconds = 1.5) => {
    if (!ctx || muted) return;
    const t = ctx.currentTime, l = Math.max(0, Math.min(1, +level || 0)), h = Math.max(0, +seconds || 0);
    for (const n of duck) {
      const p = n.gain;
      p.cancelScheduledValues(t); p.setValueAtTime(p.value, t);
      p.linearRampToValueAtTime(l, t + 0.1); p.setValueAtTime(l, t + 0.1 + h); p.linearRampToValueAtTime(1, t + 1.5 + h);
    }
  },
};

export function buzz(p) {
  if (save.settings.vibrate && typeof navigator !== 'undefined' && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* egal */ } }
}
export const unlockAudio = () => ac();

// ---------------------------------------------------------------- Schnittstelle für Musik und Einstellungen
/** AudioContext (wird bei Bedarf erzeugt) oder null, wenn Ton aus / kein Web Audio. */
export const audioCtx = () => ac();
/** Eingang des Musik-Busses (trocken) bzw. des Musik-Hallwegs – oder null. */
export const musicOut = () => (ac() ? musicBus : null);
export const musicSend = () => (ac() ? musicRev : null);
/** Gemeinsamer Rauschpuffer (1 s, mono). */
export const noiseBuffer = () => (ac() ? nbuf(ctx) : null);
/** Rückruf bei Änderungen an Ton/Lautstärke/Sichtbarkeit (die Musik nutzt das zum Pausieren). */
export const onAudio = (fn) => { hooks.push(fn); };
/** Einstellungen neu einlesen (Ton an/aus, sfxVol, musicVol) und sanft übernehmen. */
export function applyVolumes() {
  if (ctx) {
    if (!save.settings.sound) mute();
    else { if (muted) unmute(); if (!test && ctx.state !== 'running' && !hidden()) quiet(ctx.resume()); }
    const t = ctx.currentTime, s = vol('sfxVol', 1), m = vol('musicVol', 0.6);
    sfxBus.gain.setTargetAtTime(s, t, 0.04); sfxRev.gain.setTargetAtTime(s * SFX_WET, t, 0.04);
    musicBus.gain.setTargetAtTime(m, t, 0.04); musicRev.gain.setTargetAtTime(m, t, 0.04);
  }
  for (const f of hooks) f();
}
/** Nur für Tests: einen eigenen (z. B. Offline-)Kontext verwenden. */
export function _useContext(c) { ctx = c; test = true; muted = false; failed = false; noiseBuf = null; build(c); }
