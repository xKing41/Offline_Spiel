// Prozedurale Hintergrundmusik (Web Audio) – jedes Biom hat ein eigenes Thema, Schichten folgen der Kampfintensität.
// Keine Audiodateien: Akkordfolgen, Melodien und Rhythmen entstehen live aus einem Zufallsgenerator mit Startwert
// und werden mit kurzem Vorlauf auf der Audio-Uhr geplant (Lookahead-Planer).
import { save } from './save.js';
import { audioCtx, musicOut, musicSend, noiseBuffer, onAudio } from './audio.js';

const LOOK = 0.2, TICK = 50, XF = 1.6, MIX = 0.45; // Vorlauf (s), Takt des Planers (ms), Überblendzeit (s), Gesamtpegel der Musik
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mod = (n, m) => ((n % m) + m) % m;
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
/** Zufallsgenerator mit Startwert (mulberry32). */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const kr = (p) => { try { p.automationRate = 'k-rate'; } catch (e) { /* ältere Browser */ } return p; };
const isHidden = () => typeof document !== 'undefined' && !!document.hidden;
const musicVol = () => { const v = save.settings.musicVol; return typeof v === 'number' && isFinite(v) ? v : 0.6; };

// ---------------------------------------------------------------- Harmonik
const SC = {
  aeol: [0, 2, 3, 5, 7, 8, 10], dor: [0, 2, 3, 5, 7, 9, 10], phr: [0, 1, 3, 5, 7, 8, 10], lyd: [0, 2, 4, 6, 7, 9, 11],
  loc: [0, 1, 3, 5, 6, 8, 10], hmin: [0, 2, 3, 5, 7, 8, 11], ion: [0, 2, 4, 5, 7, 9, 11], pent: [0, 3, 5, 7, 10],
};
const RN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'], RS = [0, 2, 4, 5, 7, 9, 11];
/** Akkordsymbol relativ zur Tonika: 'i', 'bVI', 'V', 'iv7', 'IM7', 'bIII+', 'i°', 'IVs4', 'i9' … */
function chord(tok) {
  const m = /^([b#]?)(I{1,3}|IV|VI{0,2}|i{1,3}|iv|vi{0,2})(°|\+)?(s2|s4)?(M7|7)?(9)?$/.exec(tok) || ['', '', 'i'];
  const deg = RN.indexOf(m[2].toUpperCase()), r = mod(RS[deg] + (m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0), 12);
  let t3 = m[2] === m[2].toLowerCase() ? 3 : 4, t5 = 7, i3 = 2;
  if (m[3] === '°') { t3 = 3; t5 = 6; } else if (m[3] === '+') t5 = 8;
  if (m[4]) { t3 = m[4] === 's2' ? 2 : 5; i3 = m[4] === 's2' ? 1 : 3; }
  const iv = [[0, 0], [t3, i3], [t5, 4]];
  if (m[5]) iv.push([m[5] === 'M7' ? 11 : m[3] === '°' ? 9 : 10, 6]);
  if (m[6]) iv.push([14, 1]);
  // pcs: Tonhöhenklassen relativ zur Tonika, ix: zugehörige Leiterstufe (für Alterationen)
  return { r, pcs: iv.map(([x]) => mod(r + x, 12)), ix: iv.map(([, i]) => (deg + i) % 7) };
}
/** Tonleiter passend zum Akkord: leiterfremde Akkordtöne ersetzen ihre Stufe (z. B. Dur-V in Moll → harmonisch Moll). */
function scaleFor(sc, ch) {
  if (sc.length !== 7) return sc;
  const s = sc.slice();
  ch.pcs.forEach((p, i) => { s[ch.ix[i]] = p; });
  return s.sort((a, b) => a - b);
}
/** Stufe → Halbtöne über der Tonika (Stufen dürfen negativ sein oder über die Oktave gehen). */
const d2s = (sc, d) => { const n = sc.length, o = Math.floor(d / n); return o * 12 + sc[d - o * n]; };
/** Stimmführung: Umkehrung im Bereich lo..hi, die sich am wenigsten vom vorigen Akkord entfernt. */
function voicing(ch, key, lo, hi, n, prev) {
  const pcs = ch.pcs.slice(0, n);
  let best = null, bs = 1e9;
  for (let inv = 0; inv < pcs.length; inv++) {
    for (let b = lo + mod(key + pcs[inv] - lo, 12); b <= hi; b += 12) {
      const v = [b];
      for (let k = 1; k < pcs.length; k++) { let m = v[k - 1] + 1; while (mod(m - key - pcs[(inv + k) % pcs.length], 12)) m++; v.push(m); }
      if (v[v.length - 1] > hi + 2) continue;
      const sc = prev ? v.reduce((s, m, i) => s + Math.abs(m - prev[Math.min(i, prev.length - 1)]), 0) : Math.abs(v[0] - lo - 5);
      if (sc < bs) { bs = sc; best = v; }
    }
  }
  return best || [lo + mod(key + pcs[0] - lo, 12)];
}

// ---------------------------------------------------------------- Klangquellen
const WAVE = {
  warm: (n) => 1 / Math.pow(n, 1.5), // weicher Sägezahn für Flächen
  hollow: (n) => (n % 2 ? 1 / n : 0.12 / n), // hohl, klarinettenartig
  soft: (n) => [1, 0.3, 0.12, 0.05][n - 1] || 0, // fast Sinus (Flöte, Okarina)
  // Bass mit eingebauter Suboktave (Grundton halbiert): gerade Teiltöne bilden Sägezahn bzw. Dreieck
  subsaw: (n) => (n === 1 ? 0.5 : n % 2 ? 0 : 2 / n),
  subtri: (n) => { if (n === 1) return 0.5; const k = n / 2; return n % 2 || k % 2 === 0 ? 0 : (k % 4 === 1 ? 1 : -1) / (k * k); },
};
const waves = new WeakMap();
function setW(a, o, w) {
  if (!WAVE[w]) { o.type = w; return; }
  let c = waves.get(a);
  if (!c) waves.set(a, (c = {}));
  if (!c[w]) { const N = w.startsWith('sub') ? 64 : 32, re = new Float32Array(N), im = new Float32Array(N); for (let n = 1; n < N; n++) im[n] = WAVE[w](n); c[w] = a.createPeriodicWave(re, im); }
  o.setPeriodicWave(c[w]);
}
let nb = null, nbCtx = null;
const NB = (a) => (nbCtx === a && nb ? nb : ((nbCtx = a), (nb = noiseBuffer())));
const pan = (a, v) => { if (!a.createStereoPanner) return a.createGain(); const p = a.createStereoPanner(); p.pan.value = v; return p; };

/** Stimme registrieren: starten/stoppen, danach trennen; bei vollem Stimmenkontingent die älteste ausblenden. */
function voice(I, L, srcs, g, t, e, extra) {
  if (L.vs.length >= L.max) steal(L.vs.shift(), t);
  for (const s of srcs) { s.start(t, s._o || 0); s.stop(e); }
  srcs[0].onended = () => { try { g.disconnect(); if (extra) for (const n of extra) n.disconnect(); } catch (err) { /* schon getrennt */ } };
  L.vs.push({ s: srcs, g, e, t0: t });
}
function steal(v, t) {
  if (!v || v.e <= t + 0.05) return;
  try {
    const p = v.g.gain;
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); }
    p.setTargetAtTime(0, t, 0.015);
    for (const s of v.s) s.stop(t + 0.1);
    v.e = t + 0.1;
  } catch (e) { /* egal */ }
}
/** Hüllkurve: Anstieg auf pk, Halten (optional auf sus-Anteil abfallend), Ausklingen ab t+h. */
function env(p, t, at, pk, h, rel, sus = 1, dk = 0.3) {
  p.setValueAtTime(0, t); p.linearRampToValueAtTime(pk, t + at);
  if (sus < 1) p.setTargetAtTime(pk * sus, t + at, dk);
  p.setTargetAtTime(0, t + h, rel / 4.5);
}

const INS = {
  /** Fläche: ein Oszillator je Ton, Breite und Schwebung kommen vom Chorus der Schicht. */
  pad(I, L, t, m, d, v, dst = L.in) {
    const a = I.a, o = a.createOscillator(), g = a.createGain(), at = L.atk || 1.5, rel = L.rel || 2, h = Math.max(d, at);
    setW(a, o, L.w || 'warm'); o.frequency.value = mtof(m); o.detune.value = (I.r() - 0.5) * (L.det ?? 12);
    env(g.gain, t, at, v * L.v, h, rel);
    o.connect(g).connect(dst);
    voice(I, L, [o], g, t, t + h + rel * 1.2);
  },
  /** Gezupft: Oszillator durch sich schließenden Tiefpass (Harfe, Kalimba-artig, Ostinato). */
  pluck(I, L, t, m, d, v, dst = L.in) {
    const a = I.a, f = mtof(m), o = a.createOscillator(), fl = a.createBiquadFilter(), g = a.createGain(), dc = L.dec || 0.4;
    setW(a, o, L.w || 'sawtooth'); o.frequency.value = f;
    kr(fl.frequency).setValueAtTime(Math.min(15000, f * (L.br || 7) * (0.6 + 0.4 * v)), t);
    fl.frequency.setTargetAtTime(Math.min(15000, f * 1.3), t, dc * 0.25); fl.Q.value = L.q || 0.9;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * L.v, t + 0.004); g.gain.setTargetAtTime(0, t + 0.004, dc / 5);
    o.connect(fl).connect(g).connect(dst);
    voice(I, L, [o], g, t, t + dc * 1.25 + 0.02, [fl]);
  },
  /** FM-Glocke: Träger + Modulator – Glocken, Glas, Celesta, je nach Verhältnis und Index. */
  bell(I, L, t, m, d, v, dst = L.in) {
    const a = I.a, f = mtof(m), c = a.createOscillator(), md = a.createOscillator(), mg = a.createGain(), g = a.createGain();
    const dc = L.dec || 1.2, ix = f * (L.idx || 1.5) * (0.5 + 0.5 * v);
    c.frequency.value = f; md.frequency.value = f * (L.ratio || 3.5);
    mg.gain.setValueAtTime(ix, t); mg.gain.setTargetAtTime(ix * 0.06, t, L.md || dc * 0.18);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * L.v, t + 0.003); g.gain.setTargetAtTime(0, t + 0.003, dc / 5);
    md.connect(mg).connect(c.frequency); c.connect(g).connect(dst);
    voice(I, L, [c, md], g, t, t + dc * 1.2, [mg]);
  },
  /** Melodiestimme: weicher Einsatz, verzögertes Vibrato, optional Portamento und Atemgeräusch (Flöte). */
  lead(I, L, t, m, d, v, dst = L.in) {
    const a = I.a, f = mtof(m), o = a.createOscillator(), g = a.createGain(), at = L.atk || 0.05, rel = L.rel || 0.3;
    const h = Math.max(d, at + 0.02), pk = v * L.v, src = [o], ex = [];
    setW(a, o, L.w || 'triangle');
    if (L.port && L.pm && L.pe > t - 0.03) { o.frequency.setValueAtTime(mtof(L.pm), t); o.frequency.exponentialRampToValueAtTime(f, t + L.port); } else o.frequency.value = f;
    L.pm = m; L.pe = t + h;
    if (L.vib && h > 0.45) { // Vibrato nur auf längeren Tönen (spart Oszillatoren)
      const lf = a.createOscillator(), lg = a.createGain();
      lf.frequency.value = (L.vr || 5) * (0.92 + 0.16 * I.r());
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(L.vib, t + Math.min(0.6, h * 0.7));
      lf.connect(lg).connect(o.detune); src.push(lf); ex.push(lg);
    }
    if (L.br) { // Atem: Rauschen im Bandpass, kurzer „Chiff“ beim Anblasen
      const n = a.createBufferSource(), bf = a.createBiquadFilter(), bg = a.createGain();
      n.buffer = NB(a); n.loop = true; n._o = I.r() * 0.8; bf.type = 'bandpass'; bf.frequency.value = Math.min(9000, f * 3); bf.Q.value = 1.2;
      bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(pk * L.br, t + 0.03); bg.gain.setTargetAtTime(pk * L.br * 0.22, t + 0.03, 0.08); bg.gain.setTargetAtTime(0, t + h, rel / 4);
      n.connect(bf).connect(bg).connect(dst); src.push(n); ex.push(bf, bg);
    }
    env(g.gain, t, at, pk, h, rel, L.sus ?? 0.75, 0.4);
    o.connect(g).connect(dst);
    voice(I, L, src, g, t, t + h + rel * 1.2, ex);
  },
  /** Bass: ein Oszillator (Suboktave steckt in der Wellenform), kurzer Anschlag, dann gehalten. */
  bass(I, L, t, m, d, v, dst = L.in) {
    const a = I.a, f = mtof(m), o = a.createOscillator(), g = a.createGain(), rel = L.rel || 0.12, sub = L.sub && f > 80;
    setW(a, o, sub ? (L.w === 'sawtooth' ? 'subsaw' : 'subtri') : L.w || 'sawtooth'); o.frequency.value = sub ? f / 2 : f;
    env(g.gain, t, 0.006, v * L.v, d, rel, L.sus ?? 0.7, L.dk || 0.15);
    o.connect(g).connect(dst);
    voice(I, L, [o], g, t, t + d + rel * 1.2);
  },
  /** Blech: zwei verstimmte Sägezähne (einer bei one), Filter öffnet beim Anblasen (Stöße, Fanfaren). */
  brass(I, L, t, m, d, v, dst = L.in) {
    const a = I.a, f = mtof(m), o = a.createOscillator(), o2 = L.one ? null : a.createOscillator(), fl = a.createBiquadFilter(), g = a.createGain();
    const at = L.atk || 0.06, rel = L.rel || 0.35, h = Math.max(d, at);
    o.type = 'sawtooth'; o.frequency.value = f;
    if (o2) { o2.type = 'sawtooth'; o2.frequency.value = f; o2.detune.value = 9; }
    kr(fl.frequency).setValueAtTime(f * 1.2, t); fl.frequency.linearRampToValueAtTime(Math.min(12000, f * (L.br || 5) * (0.5 + 0.5 * v)), t + at * 1.5);
    fl.frequency.setTargetAtTime(Math.min(9000, f * 2.5), t + at * 1.5, 0.4);
    env(g.gain, t, at, v * L.v, h, rel, 0.75, 0.3);
    o.connect(fl); if (o2) o2.connect(fl);
    fl.connect(g).connect(dst);
    voice(I, L, o2 ? [o, o2] : [o], g, t, t + h + rel * 1.2, [fl]);
  },
};

// Schlagwerk und Geräusche: tonaler Schlag mit Tonhöhenfall, gefiltertes Rauschen, metallischer FM-Schlag
function tn(I, L, t, f0, tau, vol, w = 'sine', f1 = 0) {
  const a = I.a, o = a.createOscillator(), g = a.createGain();
  o.type = w; o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + tau * 1.5);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.002); g.gain.setTargetAtTime(0, t + 0.002, tau);
  o.connect(g).connect(L.in);
  voice(I, L, [o], g, t, t + tau * 5 + 0.01);
}
function nz(I, L, t, vol, tau, ft, ff, q = 0.8, at = 0.001) {
  const a = I.a, n = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  n.buffer = NB(a); n.loop = true; n._o = I.r() * 0.9; f.type = ft; f.frequency.value = ff; f.Q.value = q;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + at); g.gain.setTargetAtTime(0, t + at, tau);
  n.connect(f).connect(g).connect(L.in);
  voice(I, L, [n], g, t, t + at + tau * 5, [f]);
}
function metal(I, L, t, f, vol, tau, r = 1.41) {
  const a = I.a, c = a.createOscillator(), md = a.createOscillator(), mg = a.createGain(), g = a.createGain();
  c.frequency.value = f; md.frequency.value = f * r;
  mg.gain.setValueAtTime(f * 2.5, t); mg.gain.setTargetAtTime(f * 0.3, t, tau * 0.5);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.001); g.gain.setTargetAtTime(0, t + 0.001, tau);
  md.connect(mg).connect(c.frequency); c.connect(g).connect(L.in);
  voice(I, L, [c, md], g, t, t + tau * 5, [mg]);
}
const DR = {
  kick: (I, L, t, v) => tn(I, L, t, 200, 0.09, v * 0.5, 'sine', 48), // schneller Tonhöhenfall = hörbarer Anschlag auch auf Handys
  snare: (I, L, t, v) => { nz(I, L, t, v * 0.2, 0.05, 'bandpass', 1900, 0.7); tn(I, L, t, 190, 0.035, v * 0.12, 'triangle', 160); },
  hat: (I, L, t, v) => nz(I, L, t, v * 0.06, 0.014, 'highpass', 7500),
  shaker: (I, L, t, v) => nz(I, L, t, v * 0.055, 0.025, 'bandpass', 5500, 1.4, 0.012),
  tom: (I, L, t, v) => tn(I, L, t, 140, 0.12, v * 0.3, 'triangle', 82),
  taiko: (I, L, t, v) => { tn(I, L, t, 96, 0.28, v * 0.42, 'sine', 56); nz(I, L, t, v * 0.12, 0.05, 'lowpass', 700); },
  frame: (I, L, t, v) => { nz(I, L, t, v * 0.16, 0.06, 'lowpass', 420); tn(I, L, t, 88, 0.1, v * 0.2, 'sine', 62); },
  boom: (I, L, t, v) => { tn(I, L, t, 62, 0.45, v * 0.48, 'sine', 30); nz(I, L, t, v * 0.1, 0.35, 'lowpass', 180, 0.7, 0.08); },
  anvil: (I, L, t, v) => metal(I, L, t, 1150 + I.r() * 60, v * 0.07, 0.08),
  gong: (I, L, t, v) => metal(I, L, t, 98, v * 0.12, 0.9, 1.41),
  tick: (I, L, t, v) => tn(I, L, t, 1500, 0.012, v * 0.08, 'triangle', 1000),
  glass: (I, L, t, v) => tn(I, L, t, 5200 + I.r() * 2000, 0.02, v * 0.03),
  clack: (I, L, t, v) => { tn(I, L, t, 820, 0.018, v * 0.1, 'triangle', 600); nz(I, L, t, v * 0.05, 0.008, 'bandpass', 2500, 2); },
  crash: (I, L, t, v) => nz(I, L, t, v * 0.07, 0.45, 'highpass', 5000),
};
// Umgebungsgeräusche (zufällig verstreut): Sterne, Blasen, Glut, Kristalle, Flüstern, Wellen, Donner
const AMB = {
  twinkle: (I, L, t) => tn(I, L, t, mtof(I.lkey + 24 + d2s(I.sc, Math.floor(I.r() * 7))), 0.3, 0.035),
  bubble: (I, L, t) => { const f = 180 + I.r() * 260; tn(I, L, t, f, 0.03, 0.07, 'sine', f * 2.3); },
  crackle: (I, L, t) => nz(I, L, t, 0.15 + I.r() * 0.15, 0.002 + I.r() * 0.004, 'bandpass', 2000 + I.r() * 4000, 1.5),
  chime: (I, L, t) => tn(I, L, t, mtof(I.lkey + 24 + d2s(I.sc, Math.floor(I.r() * 7))), 0.35, 0.05),
  whisper: (I, L, t) => nz(I, L, t, 0.13, 0.6, 'bandpass', 500 + I.r() * 700, 3, 1.4),
  wave: (I, L, t) => nz(I, L, t, 0.08, 0.9, 'lowpass', 450 + I.r() * 300, 0.6, 1.8),
  thunder: (I, L, t) => { nz(I, L, t, 0.12, 0.7, 'lowpass', 160, 0.7, 0.04); tn(I, L, t, 50, 0.6, 0.18, 'sine', 32); },
};

// ---------------------------------------------------------------- Schichten
const DEF_ON = { pad: 0, drone: 0, bass: 0, lead: 0.15, canon: 0.15, arp: 0.45, stab: 0.5, drums: 0.7, amb: 0 };
const DEF_MAX = { pad: 8, drone: 6, bass: 2, lead: 2, canon: 2, arp: 3, stab: 6, drums: 10, amb: 2 };
function gainN(I, v, to) { const n = I.a.createGain(); n.gain.value = v; if (to) n.connect(to); I.nodes.push(n); return n; }
function mkLayer(I, type, S) {
  const a = I.a, L = { ...S, type, vs: [], on: S.on ?? DEF_ON[type], max: S.max || DEF_MAX[type], lv: -1, fc: S.cut };
  if (S.kit) L.on = Math.min(...S.kit.map((k) => k[2])); // Schlagwerk öffnet mit der niedrigsten Stimme
  L.g = gainN(I, 0);
  L.in = L.g;
  if (S.cut) { // Schicht-Tiefpass (Helligkeit folgt der Intensität)
    L.f = a.createBiquadFilter(); L.f.type = 'lowpass'; L.f.Q.value = S.q ?? 0.7; kr(L.f.frequency).value = S.cut;
    L.f.connect(L.g); L.in = L.f; I.nodes.push(L.f);
    if (S.lfo) { const lf = a.createOscillator(); lf.frequency.value = S.lfo; lf.connect(gainN(I, S.lfoD || 100, L.f.frequency)); lf.start(); I.per.push(lf); }
  }
  if (S.fmt) { // Formanten („Aah“) für Chor und Stimme
    const i = gainN(I, 1);
    for (const [f, q, v] of [[650, 5, 2.4], [1080, 6, 1.7], [2600, 8, 0.7]]) { const b = a.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; i.connect(b).connect(gainN(I, v, L.in)); I.nodes.push(b); }
    L.in = i;
  }
  if (S.pp) { L.inL = pan(a, -0.6); L.inR = pan(a, 0.6); L.inL.connect(L.in); L.inR.connect(L.in); I.nodes.push(L.inL, L.inR); }
  let o = L.g;
  if (S.swell) { // langsames An- und Abschwellen (Wellen)
    o = gainN(I, 0.78); L.g.connect(o);
    const lf = a.createOscillator(); lf.frequency.value = S.swell; lf.connect(gainN(I, 0.22, o.gain)); lf.start(); I.per.push(lf);
  }
  if (S.cho) { // Stereo-Chorus: zwei modulierte Verzögerungen links/rechts neben dem trockenen Signal
    o.connect(I.out);
    const lf = a.createOscillator(); lf.frequency.value = 0.33; lf.start(); I.per.push(lf);
    for (const s of [-1, 1]) {
      const d = a.createDelay(0.06), p = pan(a, s * 0.75);
      d.delayTime.value = 0.017 + s * 0.004; lf.connect(gainN(I, 0.0035 * S.cho * s, d.delayTime));
      o.connect(d).connect(gainN(I, 0.7, p)); p.connect(I.out); I.nodes.push(d, p);
    }
  } else if (S.pan) { const p = pan(a, S.pan); o.connect(p).connect(I.out); I.nodes.push(p); } else o.connect(I.out);
  if (S.rev) o.connect(gainN(I, S.rev, I.rev));
  if (S.dly && I.dly) o.connect(gainN(I, S.dly, I.dly));
  if (S.wind) { // Dauerwind: Rauschen durch wandernden Bandpass
    const n = a.createBufferSource(), f = a.createBiquadFilter(), lf = a.createOscillator();
    n.buffer = NB(a); n.loop = true; f.type = 'bandpass'; f.Q.value = 3; kr(f.frequency).value = 700;
    lf.frequency.value = 0.09; lf.connect(gainN(I, 380, f.frequency));
    n.connect(f).connect(gainN(I, S.wind, L.in)); n.start(); lf.start(); I.per.push(n, lf); I.nodes.push(f);
  }
  I.ls.push(L);
  return L;
}
/** Ping-Pong-Echo der Instanz (Rückkopplung über einen Tiefpass, wird mit jeder Wiederholung dunkler). */
function mkDelay(I, fx) {
  const a = I.a, l = a.createDelay(2), r = a.createDelay(2), lp = a.createBiquadFilter();
  l.delayTime.value = r.delayTime.value = Math.min(1.9, fx.d * I.sd);
  lp.frequency.value = fx.cut || 2600;
  I.dly = gainN(I, 1, lp);
  lp.connect(l); l.connect(r); r.connect(gainN(I, fx.fb || 0.35, lp));
  const pl = pan(a, -0.6), pr = pan(a, 0.6);
  l.connect(pl).connect(I.out); r.connect(pr).connect(I.out);
  I.nodes.push(l, r, lp, pl, pr);
}

// ---------------------------------------------------------------- Ablauf je Sechzehntel
const STEP = {
  pad(I, L, s, t) {
    if (s || I.bs % I.T.cb) return;
    L.pv = voicing(I.chord, I.T.key, L.lo, L.hi, L.n || 3, L.pv);
    for (const m of L.pv) INS[L.ins || 'pad'](I, L, t, m, I.T.cb * I.barDur, 1);
  },
  drone(I, L, s, t) {
    if (s || I.bs) return; // ein langer Bordunton je Abschnitt
    for (const m of L.m) INS.pad(I, L, t, m, I.secBars * I.barDur, 1);
  },
  bass(I, L, s, t) {
    const p = L.p2 && I.x >= (L.on2 ?? 0.6) ? L.p2 : L.p, at = I.bs * I.T.bar + s, c = p[at % p.length];
    if ('RFOTN'.indexOf(c) < 0) return;
    let len = 1;
    while (len < p.length && p[(at + len) % p.length] === '_') len++;
    const root = L.lo + mod(I.T.key + I.chord.r - L.lo, 12);
    const m = c === 'O' ? root + 12 : c === 'F' ? root + 7 - (root + 7 > L.lo + 14 ? 12 : 0) : c === 'T' ? root + mod(I.chord.pcs[1] - I.chord.r, 12)
      : c === 'N' ? L.lo + mod(I.T.key + I.next.r - L.lo, 12) : root;
    INS[L.ins || 'bass'](I, L, t, m, len * I.sd * 0.92, s === 0 ? 1 : 0.85);
  },
  arp(I, L, s, t) {
    if (s % (L.r || 2)) return;
    if (L.nch !== I.chord) { L.nch = I.chord; L.ns = arpNotes(I, L); }
    const i = I.ai++, pat = I.ap || L.pat[0];
    if (L.p && I.r() > L.p) return;
    const m = L.ns[pat[i % pat.length] % L.ns.length], acc = L.acc ? L.acc.includes(i % 8) : s % I.T.beat === 0;
    INS[L.ins || 'pluck'](I, L, t + (I.r() - 0.5) * 0.006, m, (L.r || 2) * I.sd, acc ? 1 : 0.72, L.pp ? (i % 2 ? L.inR : L.inL) : L.in);
  },
  stab(I, L, s, t) {
    const c = L.p[(I.bs * I.T.bar + s) % L.p.length];
    if (c !== 'X' && c !== 'x') return;
    L.pv = voicing(I.chord, I.T.key, L.lo, L.hi, L.n || 3, L.pv);
    for (const m of L.pv) INS[L.ins || 'brass'](I, L, t, m, 1.6 * I.sd, c === 'X' ? 1 : 0.75);
  },
  lead(I, L, s, t) {
    const n = I.mel && I.mel.get(I.bs * I.T.bar + s);
    if (!n) return;
    const sc = scaleFor(L.scale, I.chord), hum = (I.r() - 0.5) * 0.01;
    INS[L.ins || 'lead'](I, L, t + hum, I.lkey + d2s(sc, n.deg), n.d * I.sd * (L.gate || 0.95), n.v);
    const C = I.L.canon; // Kanon: Echo-Stimme spielt die Melodie versetzt und transponiert
    if (C && C.lv > 0.02) INS[C.ins || 'bell'](I, C, t + C.lag * I.sd, I.lkey + d2s(sc, n.deg + C.tr), n.d * I.sd, n.v * 0.9);
  },
  drums(I, L, s, t) {
    const at = I.bs * I.T.bar + s;
    for (const k of L.kit) {
      if (I.x < k[2]) continue;
      const p = I.fill && k[3] ? k[3] : k[1], c = p[at % p.length];
      const v = c === 'X' ? 1 : c === 'x' ? 0.72 : c === 'g' ? 0.38 : c === '?' && I.r() < 0.5 ? 0.55 : 0;
      if (v) DR[k[0]](I, L, t + (I.r() - 0.5) * 0.006, v * (0.85 + 0.3 * I.r()) * clamp((I.x - k[2]) / 0.15 + 0.35, 0.35, 1));
    }
  },
  amb(I, L, s, t) { if (L.ev && I.r() < L.rate * I.sd) AMB[L.ev](I, L, t + I.r() * I.sd); },
};
STEP.canon = () => {};
/** Arpeggio-Töne: Akkordtöne (+ Farbtöne aus der Tonleiter) ab lo über span Oktaven. */
function arpNotes(I, L) {
  const ch = I.chord, pcs = ch.pcs.slice(0, L.n || 3);
  for (const c of L.col || []) { const pc = mod(ch.r + c, 12); if (I.sc.includes(pc) && !pcs.includes(pc)) pcs.push(pc); }
  const out = [];
  for (let o = 0; o < (L.span || 1); o++) for (const pc of pcs) out.push(L.lo + mod(I.T.key + pc - L.lo, 12) + 12 * o);
  return out.sort((x, y) => x - y);
}

// ---------------------------------------------------------------- Melodie (Ruf + Antwort, Wiederholung mit Variation)
/** Nächster passender Ton (Stufe) nahe c, bevorzugt kleine Schritte und die aktuelle Richtung. */
function nearest(c, L, ok, r, dir = 0) {
  let best = c, bw = -1;
  for (let x = Math.max(L.lo, c - 5); x <= Math.min(L.hi, c + 5); x++) {
    if (!ok(x)) continue;
    const w = [0.35, 1, 0.9, 0.55, 0.35, 0.2][Math.abs(x - c)] * (dir && Math.sign(x - c) === dir ? 1.4 : 1) * (0.6 + r() * 0.8);
    if (w > bw) { bw = w; best = x; }
  }
  return best;
}
function phrase(I, L, b0, nb, cad, st, out, rec, reuse) {
  const T = I.T, r = I.r;
  for (let b = 0; b < nb; b++) {
    const bar = b0 + b, last = b === nb - 1, rh = last ? pick(r, L.end) : (reuse && reuse[b]) || pick(r, L.rh);
    if (rec) rec.push(rh);
    const ch = I.prog[Math.floor(bar / T.cb) % I.prog.length], sc = scaleFor(L.scale, ch), n = sc.length;
    const isCT = (x) => ch.pcs.includes(sc[mod(x, n)]);
    let s = 0, li = -1;
    rh.forEach((d, i) => { if (d > 0) li = i; });
    rh.forEach((d, i) => {
      if (d < 0) { s -= d; return; }
      const strong = s % (2 * T.beat) === 0 || d >= T.beat;
      let c = st.cur;
      if (last && i === li) c = nearest(c, L, cad ? (x) => sc[mod(x, n)] === ch.r : isCT, r); // Phrasenende: Grundton bzw. Akkordton
      else if (strong) c = nearest(c, L, isCT, r, st.dir); // betonte Zeit → Akkordton
      else { if (r() < 0.15) st.dir = -st.dir; c += st.dir * (r() < 0.8 ? 1 : 2); } // sonst Durchgangs-/Nebenton
      if (c >= L.hi) { c = L.hi; st.dir = -1; } else if (c <= L.lo) { c = L.lo; st.dir = 1; }
      if (Math.abs(c - st.cur) >= 3) st.dir = -Math.sign(c - st.cur); // nach einem Sprung Gegenbewegung
      st.cur = c;
      out.push({ at: bar * T.bar + s, d, deg: c, v: s === 0 ? 1 : strong ? 0.9 : 0.75 });
      s += d;
    });
  }
}
function genMel(I, L) {
  const r = I.r, nb = I.secBars, half = nb >> 1, out = [], rhs = [];
  const st = { cur: 2 + Math.floor(r() * 3), dir: r() < 0.5 ? 1 : -1 };
  phrase(I, L, 0, half, false, st, out, rhs, null);
  phrase(I, L, half, nb - half, true, st, out, null, r() < 0.6 ? rhs : null); // Antwort greift oft den Rhythmus des Rufs auf
  return out;
}
function vary(I, mel) {
  const out = mel.map((n) => ({ ...n })), weak = out.filter((n, i) => n.v < 0.8 && i < out.length - 1);
  for (let k = 0; k < 2 && weak.length; k++) pick(I.r, weak).deg += I.r() < 0.5 ? 1 : -1;
  return out;
}
function newSection(I) {
  const T = I.T, r = I.r, f = T.form[++I.sec % T.form.length]; // n = neue Melodie, v = Variation, r = Pause
  if (f !== 'v' || !I.prog) I.prog = I.progs[I.sec ? Math.floor(r() * I.progs.length) : 0];
  I.secBars = I.prog.length * T.cb;
  const L = I.L.lead;
  I.mel0 = L && f !== 'r' ? (f === 'v' && I.mel0 ? I.mel0 : genMel(I, L)) : I.mel0;
  I.mel = L && f !== 'r' ? new Map((f === 'v' ? vary(I, I.mel0) : I.mel0).map((n) => [n.at, n])) : null;
  if (I.L.arp) I.ap = pick(r, I.L.arp.pat);
  I.ai = 0;
}
function stepAt(I, t, skip) {
  const T = I.T, s = I.step++ % T.bar;
  if (s === 0) {
    if (++I.bs >= (I.secBars || 0)) { I.bs = 0; newSection(I); }
    const ci = Math.floor(I.bs / T.cb);
    I.chord = I.prog[ci % I.prog.length]; I.next = I.prog[(ci + 1) % I.prog.length];
    I.sc = scaleFor(SC[T.sc], I.chord);
    I.fill = I.bs === I.secBars - 1;
  }
  if (!skip) for (const L of I.ls) if (L.lv > 0.02) STEP[L.type](I, L, s, t);
}

// ---------------------------------------------------------------- Themen
// Rhythmen in Sechzehnteln (negativ = Pause); E… = Phrasenenden
const R44 = [[8, 4, 4], [6, 2, 8], [4, 4, 8], [12, 4], [4, 2, 2, 8], [-4, 4, 8], [8, 8], [2, 2, 4, 8], [6, 2, 4, 4], [-2, 2, 4, 8]];
const E44 = [[8, -8], [12, -4], [4, 8, -4], [6, 6, -4]];
const RSL = [[16], [12, 4], [8, 8], [8, 4, 4], [6, 2, 8], [-4, 12], [-8, 8]];
const ESL = [[16], [12, -4], [8, -8]];
const RF = [[2, 2, 2, 2, 4, 4], [3, 3, 2, 4, 4], [4, 2, 2, 4, 4], [2, 2, 4, 2, 2, 4], [4, 4, 2, 2, 4], [3, 3, 4, 2, 2, 2], [-2, 2, 2, 2, 4, 4]];
const EF = [[4, 4, 4, -4], [2, 2, 4, 4, -4], [4, 8, -4], [3, 3, 6, -4]];
const R34 = [[4, 4, 4], [8, 4], [6, 2, 4], [4, 8], [-4, 4, 4], [2, 2, 8], [4, 2, 2, 4]];
const E34 = [[8, -4], [4, 4, -4], [6, 2, -4], [12]];
const R68 = [[6, 6], [4, 2, 6], [6, 4, 2], [2, 2, 2, 6], [12], [6, 2, 2, 2], [-6, 4, 2]];
const E68 = [[6, -6], [8, -4], [12]];

const TH = {
  // Sternwarte (Hauptmenü): warm, erhaben, D-Dorisch
  menu: {
    key: 2, sc: 'dor', bpm: 70, gain: 1,
    progs: ['i9 IV bIIIM7 bVII', 'i7 bVI bVII i', 'iv7 bVII i9 v7'],
    pad: { w: 'warm', lo: 50, hi: 69, n: 4, atk: 1.8, rel: 3, v: 0.05, cut: 1200, cutI: 2, cho: 1, rev: 0.6 },
    bass: { p: 'R_______F_______', w: 'triangle', lo: 38, v: 0.19, sub: 1, cut: 700, rel: 0.4 },
    arp: { ins: 'bell', pat: [[0, 1, 2, 3, 4, 3, 2, 1], [0, 2, 1, 3, 2, 4, 3, 1]], r: 2, lo: 62, span: 2, n: 4, v: 0.1, dec: 1.4, ratio: 2, idx: 1.2, rev: 0.5, dly: 0.25, on: 0.4 },
    lead: { w: 'soft', oct: 4, lo: -1, hi: 9, rh: R44, end: E44, v: 0.12, atk: 0.08, rel: 0.5, vib: 12, vr: 5, rev: 0.5, dly: 0.3 },
    drums: { kit: [['kick', 'X.......x.......', 0.7], ['shaker', '..x...x...x...x.', 0.75], ['tom', '................', 0.8, '........x...x.x.']], vol: 1.5, rev: 0.2 },
    fx: { d: 3, fb: 0.35, cut: 2500 },
  },
  // Sternengrab: mystisch, langsam, 3/4, glockenartige Zupfer (A-Moll mit dorischer IV)
  sternengrab: {
    key: 9, sc: 'aeol', bpm: 66, bar: 12, gain: 1,
    progs: ['i9 bVI bIII bVII', 'i IV9 bVI v', 'bVIM7 bVII i9 i'],
    pad: { w: 'warm', lo: 52, hi: 71, n: 3, atk: 2.2, rel: 3.5, v: 0.055, cut: 850, cutI: 2, cho: 1, rev: 0.7 },
    bass: { p: 'R___________', w: 'triangle', lo: 40, v: 0.16, sub: 1, cut: 500, rel: 0.8 },
    arp: { ins: 'bell', pat: [[0, 2, 1, 3, 2, 4], [0, 1, 2, 3, 4, 2]], r: 2, lo: 57, span: 2, n: 3, p: 0.8, v: 0.095, dec: 2.2, ratio: 3.5, idx: 1.4, rev: 0.7, dly: 0.3, on: 0.35 },
    lead: { ins: 'bell', oct: 5, lo: -2, hi: 7, rh: R34, end: E34, v: 0.2, dec: 2.6, ratio: 2, idx: 0.8, rev: 0.6, dly: 0.25 },
    drums: { kit: [['tom', 'X...........', 0.65], ['shaker', '..g...x...g.', 0.7], ['glass', '........x...', 0.85]], vol: 1.8, rev: 0.35 },
    amb: { ev: 'twinkle', rate: 0.6, rev: 0.9 },
    fx: { d: 6, fb: 0.4, cut: 3000 },
  },
  // Nebelmoor: trüb, Bordun, tiefe Flöte mit Vibrato (E-Dorisch)
  nebelmoor: {
    key: 4, sc: 'dor', bpm: 56, gain: 1.08,
    progs: ['i9 IV i bVII', 'i7 v7 bVII i', 'i bIII IV i'],
    drone: { m: [40, 47], w: 'sawtooth', cut: 320, cutI: 1.6, v: 0.055, atk: 3, rel: 3, lfo: 0.07, lfoD: 120, rev: 0.4 },
    pad: { w: 'triangle', lo: 52, hi: 71, n: 3, atk: 3, rel: 4, v: 0.05, cut: 700, cutI: 1.8, cho: 1.5, rev: 0.8 },
    bass: { p: 'R_______________', w: 'sine', lo: 40, v: 0.11, rel: 1 },
    lead: { w: 'soft', oct: 4, lo: -2, hi: 7, rh: RSL, end: ESL, v: 0.11, atk: 0.12, rel: 0.6, vib: 16, vr: 4.6, br: 0.5, port: 0.09, rev: 0.55, dly: 0.35, on: 0.1 },
    arp: { ins: 'pluck', w: 'triangle', pat: [[0, 1, 2, 1], [0, 2, 1, 2]], r: 2, lo: 52, span: 1, n: 3, p: 0.5, v: 0.2, dec: 0.5, br: 3, rev: 0.4, on: 0.5 },
    drums: { kit: [['frame', 'X.......x.....x.', 0.65], ['tick', '....g.......g...', 0.8]], vol: 2.2, rev: 0.3 },
    amb: { ev: 'bubble', rate: 0.45, rev: 0.4 },
    fx: { d: 6, fb: 0.45, cut: 1200 },
  },
  // Aschewald: glimmend, archaische Trommeln, Rohrblatt-Melodie pentatonisch (C-Moll, phrygische bII)
  aschewald: {
    key: 0, sc: 'aeol', bpm: 86, gain: 1.1,
    progs: ['i i bVII i', 'i bVI bVII i', 'iv i bII i'],
    drone: { m: [36, 43], w: 'sawtooth', cut: 220, v: 0.05, atk: 3, rel: 3, rev: 0.3 },
    pad: { w: 'warm', lo: 48, hi: 67, n: 3, atk: 1.5, rel: 2.5, v: 0.045, cut: 600, cutI: 2.2, cho: 1, rev: 0.5 },
    bass: { p: 'R_____R_R_______', w: 'triangle', lo: 36, v: 0.15, sub: 1, cut: 500, rel: 0.2 },
    lead: { w: 'hollow', sc: 'pent', oct: 4, lo: 0, hi: 8, rh: R44, end: E44, v: 0.1, atk: 0.06, rel: 0.35, vib: 14, vr: 5.5, port: 0.05, cut: 1800, rev: 0.45, dly: 0.2, on: 0.2 },
    arp: { ins: 'bell', pat: [[0, 2, 1, 2, 0, 3, 1, 2]], r: 2, lo: 60, span: 1, n: 3, p: 0.85, v: 0.12, dec: 0.6, ratio: 4, idx: 0.9, rev: 0.3, on: 0.5, max: 2 },
    drums: {
      kit: [['taiko', 'X.....x.X.......', 0.3, 'X.x.X.x.X.X.XXXX'], ['tom', '..x....x..x...x.', 0.55], ['shaker', 'x.g.x.g.x.g.x.g.', 0.6], ['clack', '....x.......x..x', 0.8]],
      vol: 0.5, rev: 0.3,
    },
    amb: { ev: 'crackle', rate: 4, rev: 0.1 },
    fx: { d: 4, fb: 0.25, cut: 1800 },
  },
  // Kristallschlund: gläserne Arpeggien, F-Lydisch
  kristall: {
    key: 5, sc: 'lyd', bpm: 100, gain: 1,
    progs: ['IM7 II I9 II', 'vi9 II IM7 V', 'IM7 iii7 II I9'],
    pad: { w: 'soft', lo: 53, hi: 72, n: 4, atk: 1.2, rel: 2.2, v: 0.05, cut: 2200, cutI: 1.8, cho: 1, rev: 0.6 },
    bass: { p: 'R_______R___F___', w: 'triangle', lo: 41, v: 0.16, sub: 1, cut: 900, rel: 0.25 },
    arp: { ins: 'bell', pat: [[0, 1, 2, 3, 4, 3, 2, 1], [0, 2, 4, 1, 3, 5, 2, 4], [4, 3, 2, 1, 0, 1, 2, 3]], r: 1, lo: 65, span: 2, n: 4, col: [6], v: 0.11, dec: 0.6, ratio: 3.5, idx: 1.1, md: 0.06, rev: 0.55, dly: 0.35, on: 0.35 },
    lead: { ins: 'bell', oct: 5, lo: -2, hi: 7, rh: R44, end: E44, v: 0.18, dec: 2, ratio: 2, idx: 0.7, rev: 0.6, dly: 0.3, on: 0.25 },
    drums: { kit: [['kick', 'X.......X.......', 0.7], ['glass', '..x...x...x.x.x.', 0.7], ['snare', '....x.......x...', 0.85], ['shaker', 'x.x.x.x.x.x.x.x.', 0.9]], rev: 0.35 },
    amb: { ev: 'chime', rate: 0.4, rev: 0.9 },
    fx: { d: 3, fb: 0.4, cut: 5000 },
  },
  // Glutschmiede: treibend, Amboss-Schläge, Ostinato-Bass, G-Phrygisch
  glutschmiede: {
    key: 7, sc: 'phr', bpm: 116, gain: 1.3,
    progs: ['i bII i bVII', 'i bII bIII bII', 'iv bII i i'],
    pad: { w: 'sawtooth', lo: 50, hi: 67, n: 3, atk: 0.5, rel: 1.4, v: 0.055, cut: 650, cutI: 2.4, cho: 0.7, rev: 0.35 },
    bass: { p: 'R_R_O_R_R_F_O_R_', w: 'sawtooth', lo: 36, v: 0.15, sub: 1, cut: 600, cutI: 2.2, q: 2, rel: 0.08, sus: 0.6, dk: 0.1 },
    lead: { w: 'sawtooth', cut: 1600, cutI: 1.8, oct: 4, lo: 0, hi: 9, rh: RF, end: EF, v: 0.12, atk: 0.03, rel: 0.2, vib: 10, vr: 6, port: 0.04, rev: 0.3, dly: 0.25, on: 0.3 },
    drums: {
      kit: [['anvil', 'x.......x.......', 0.15, 'x...x...x.x.x.xx'], ['kick', 'X.....X.X.......', 0.45], ['snare', '....X.......X...', 0.65, '....X...X.X.XXXX'], ['hat', 'x.x.x.x.x.x.x.x.', 0.8], ['anvil', '..........x.....', 0.9]],
      vol: 0.55, rev: 0.25,
    },
    amb: { ev: 'crackle', rate: 2.5, rev: 0.1 },
    fx: { d: 2, fb: 0.2, cut: 2000 },
  },
  // Spiegellabyrinth: hallend, Kanon über Echos, übermäßige Akkorde (Ganzton-Anklänge), G#-Dorisch
  spiegel: {
    key: 8, sc: 'dor', bpm: 84, gain: 1,
    progs: ['i bIII+ IV i', 'i7 bVII bIII+ IV', 'iv7 bIII+ i bVII'],
    pad: { w: 'warm', lo: 51, hi: 70, n: 3, atk: 1.6, rel: 3, v: 0.05, cut: 1100, cutI: 2, cho: 2, rev: 0.7 },
    bass: { p: 'R_______________', p2: 'R_______R___N___', w: 'triangle', lo: 40, v: 0.17, sub: 1, cut: 700 },
    lead: { w: 'triangle', oct: 4, lo: 0, hi: 9, rh: R44, end: E44, v: 0.1, atk: 0.04, rel: 0.4, vib: 8, rev: 0.5, dly: 0.6, pan: -0.25 },
    canon: { ins: 'bell', lag: 8, tr: 2, v: 0.1, dec: 1.5, ratio: 2, idx: 0.8, rev: 0.6, dly: 0.4, pan: 0.4 },
    arp: { ins: 'pluck', w: 'triangle', pat: [[0, 1, 2, 3, 2, 1], [0, 2, 1, 3]], r: 2, lo: 56, span: 2, n: 3, p: 0.9, v: 0.17, dec: 0.45, br: 4, pp: 1, rev: 0.5, dly: 0.5, on: 0.45 },
    drums: { kit: [['kick', 'X.........x.....', 0.7], ['tick', '..x.......x..x..', 0.7], ['snare', '........X.......', 0.8]], vol: 1.1, rev: 0.6 },
    amb: { ev: 'whisper', rate: 0.25, rev: 0.8 },
    fx: { d: 3, fb: 0.55, cut: 2800 },
  },
  // Thron der Leere: dunkel, dissonant, langsame Herzschlag-Pulse, H-Lokrisch
  leere: {
    key: 11, sc: 'loc', bpm: 52, gain: 1,
    progs: ['i° bII iv bII', 'i bII bV i', 'iv bV i° bII'],
    drone: { m: [35, 41], w: 'sawtooth', cut: 200, cutI: 1.5, v: 0.06, atk: 4, rel: 4, lfo: 0.05, lfoD: 80, rev: 0.4 },
    pad: { w: 'warm', lo: 50, hi: 69, n: 3, atk: 3, rel: 4, v: 0.05, cut: 550, cutI: 2, cho: 1.5, rev: 0.8 },
    bass: { p: 'RR......RR......', w: 'triangle', lo: 35, v: 0.3, sub: 1, cut: 400, rel: 0.5, sus: 0.3, dk: 0.25 },
    lead: { w: 'sine', oct: 4, lo: 0, hi: 7, rh: RSL, end: ESL, v: 0.1, atk: 0.3, rel: 0.8, vib: 25, vr: 4.2, port: 0.25, rev: 0.7, dly: 0.4, on: 0.25 },
    arp: { ins: 'bell', pat: [[0, 2, 1, 3]], r: 4, lo: 59, span: 2, n: 3, p: 0.4, v: 0.12, dec: 2.2, ratio: 1.41, idx: 1.6, rev: 0.8, on: 0.5 },
    drums: { kit: [['boom', 'X...............................', 0.7], ['tom', '........x.......', 0.75], ['tick', '......g.......g.', 0.85]], rev: 0.5 },
    amb: { ev: 'whisper', rate: 0.3, rev: 0.8 },
    fx: { d: 8, fb: 0.45, cut: 900 },
  },
  // Sturmgipfel: schnell, angespanntes Ostinato (3+3+2), D-harmonisch-Moll, Wind und Donner
  sturmgipfel: {
    key: 2, sc: 'hmin', bpm: 138, gain: 1.3,
    progs: ['i bVI iv V', 'i bVII bVI V', 'iv V i bVI'],
    pad: { w: 'sawtooth', lo: 50, hi: 69, n: 3, atk: 0.8, rel: 1.6, v: 0.055, cut: 900, cutI: 2.6, cho: 1, rev: 0.45 },
    bass: { p: 'R_R_O_R_R_F_R_O_', w: 'sawtooth', lo: 38, v: 0.15, sub: 1, cut: 700, cutI: 2, q: 1.5, rel: 0.06, sus: 0.6, dk: 0.08 },
    arp: { ins: 'pluck', w: 'sawtooth', pat: [[0, 1, 2, 0, 1, 2, 0, 3], [0, 2, 1, 0, 2, 1, 3, 2]], r: 1, lo: 62, span: 1, n: 4, v: 0.22, dec: 0.16, br: 6, q: 2, rev: 0.25, dly: 0.2, on: 0.3, acc: [0, 3, 6] },
    lead: { w: 'sawtooth', cut: 2200, cutI: 1.6, oct: 4, lo: 0, hi: 10, rh: RF, end: EF, v: 0.11, atk: 0.03, rel: 0.2, vib: 10, vr: 6, port: 0.05, rev: 0.35, dly: 0.25, on: 0.4 },
    drums: {
      kit: [['tom', '..x..x..x..x.x.x', 0.45, 'x.x.x.x.xxxxxxxx'], ['kick', 'X..X..X.X..X..X.', 0.6], ['snare', '....X.......X..x', 0.7, '....X...X.X.XXXX'], ['hat', 'xgxgxgxgxgxgxgxg', 0.85]],
      vol: 0.4, rev: 0.25,
    },
    amb: { wind: 0.1, ev: 'thunder', rate: 0.04, rev: 0.6 },
    fx: { d: 3, fb: 0.3, cut: 2400 },
  },
  // Seelenmeer: wogende Flächen, langsames Anschwellen, 6/8, Cis-Moll
  seelenmeer: {
    key: 1, sc: 'aeol', bpm: 72, bar: 12, beat: 6, gain: 1.12,
    progs: ['i bVI bIII bVII', 'i iv bVI v', 'bVI bVII i i'],
    pad: { w: 'warm', lo: 49, hi: 68, n: 4, atk: 2.5, rel: 3.5, v: 0.07, cut: 900, cutI: 1.8, cho: 2, swell: 0.1, rev: 0.8 },
    bass: { p: 'R_____F_____', w: 'triangle', lo: 37, v: 0.14, sub: 1, cut: 600, rel: 0.6 },
    arp: { ins: 'pluck', w: 'triangle', pat: [[0, 1, 2, 3, 2, 1], [0, 2, 3, 1, 2, 3]], r: 2, lo: 56, span: 2, n: 4, v: 0.12, dec: 1.1, br: 3, rev: 0.6, on: 0.4 },
    lead: { w: 'sawtooth', fmt: 1, oct: 4, lo: -1, hi: 8, rh: R68, end: E68, v: 0.13, atk: 0.2, rel: 0.7, vib: 14, vr: 4.8, port: 0.08, rev: 0.6, dly: 0.3, on: 0.2 },
    drums: { kit: [['frame', 'X.....x.....', 0.7], ['shaker', 'g.x.g.g.x.g.', 0.75]], vol: 2, rev: 0.4 },
    amb: { ev: 'wave', rate: 0.2, rev: 0.6 },
    fx: { d: 3, fb: 0.4, cut: 2000 },
  },
  // Bosskampf: schwer, E-harmonisch-Moll, Blechstöße, Ostinato
  boss: {
    key: 4, sc: 'hmin', bpm: 126, cb: 1, gain: 1.35,
    progs: ['i bII i V', 'i bVI bII V', 'i bVII bVI V'],
    pad: { w: 'sawtooth', lo: 52, hi: 71, n: 3, atk: 0.6, rel: 1.2, v: 0.05, cut: 800, cutI: 2.5, cho: 1, rev: 0.4 },
    bass: { p: 'R_R_R_R_O_R_R_F_', w: 'sawtooth', lo: 40, v: 0.16, sub: 1, cut: 700, cutI: 2, q: 1.5, rel: 0.06, sus: 0.6, dk: 0.08 },
    stab: { p: 'X.....X.....X.x.', lo: 59, hi: 76, n: 3, v: 0.07, atk: 0.02, rel: 0.25, br: 6, one: 1, rev: 0.4 },
    lead: { w: 'sawtooth', cut: 2400, oct: 4, lo: 0, hi: 9, rh: RF, end: EF, v: 0.12, atk: 0.02, rel: 0.2, vib: 12, vr: 6, port: 0.04, rev: 0.35, dly: 0.2, on: 0.35 },
    drums: {
      kit: [['kick', 'X...X...X...X...', 0.2], ['snare', '....X.......X...', 0.35, '....X...X.X.XXXX'], ['hat', '..x...x...x...x.', 0.5], ['tom', '..........x..x.x', 0.6],
        ['crash', 'X' + '.'.repeat(63), 0.7], ['hat', 'x.x.x.x.x.x.x.x.', 0.85]],
      vol: 0.5, rev: 0.25,
    },
    fx: { d: 3, fb: 0.25, cut: 2400 },
  },
  // Endbosse: episch, Chor, neapolitanische bII, C-harmonisch-Moll, halbes Tempo
  pinnacle: {
    key: 0, sc: 'hmin', bpm: 104, gain: 1.15,
    progs: ['i bVI bII V', 'i iv bVI V', 'i bVII bVI V'],
    pad: { w: 'sawtooth', fmt: 1, lo: 52, hi: 72, n: 4, atk: 1, rel: 2, v: 0.08, cho: 1.5, rev: 0.7 }, // Chor
    bass: { p: 'R_______R___O___', w: 'sawtooth', lo: 36, v: 0.17, sub: 1, cut: 600, cutI: 2, rel: 0.15 },
    arp: { ins: 'pluck', w: 'sawtooth', pat: [[0, 1, 2, 1, 0, 1, 2, 3]], r: 1, lo: 55, span: 1, n: 3, v: 0.22, dec: 0.18, br: 5, rev: 0.3, on: 0.4 },
    lead: { ins: 'brass', oct: 4, lo: 0, hi: 9, rh: R44, end: E44, v: 0.1, atk: 0.1, rel: 0.4, br: 5, rev: 0.5, dly: 0.2, on: 0.3 },
    drums: {
      kit: [['taiko', 'X.......X..x....', 0.25, 'X.x.X.x.XxXxXXXX'], ['kick', 'X.......X.......', 0.4], ['snare', '........X.......', 0.5], ['tom', '....x.........x.', 0.6],
        ['crash', 'X' + '.'.repeat(63), 0.6], ['hat', '..x...x...x...x.', 0.8]],
      vol: 0.45, rev: 0.35,
    },
    fx: { d: 4, fb: 0.3, cut: 2400 },
  },
  // Abgrund: endloser Abstieg, dunkler Puls, Fis-Phrygisch mit lokrischer bV
  abyss: {
    key: 6, sc: 'phr', bpm: 92, gain: 1.15,
    progs: ['i bII bVII i', 'i bVII bVI bII', 'iv bII i bV'],
    drone: { m: [30, 37], w: 'sawtooth', cut: 180, v: 0.05, atk: 3, rel: 3, lfo: 0.06, lfoD: 60, rev: 0.3 },
    pad: { w: 'warm', lo: 49, hi: 68, n: 3, atk: 1.6, rel: 2.5, v: 0.045, cut: 600, cutI: 2, cho: 1, rev: 0.6 },
    bass: { p: 'R_R_R_R_R_R_R_R_', w: 'triangle', lo: 37, v: 0.17, sub: 1, cut: 500, cutI: 1.8, rel: 0.08, sus: 0.4, dk: 0.1 },
    arp: { ins: 'bell', pat: [[0, 2, 1, 3]], r: 4, lo: 61, span: 2, n: 3, p: 0.5, v: 0.11, dec: 1.8, ratio: 1.41, idx: 1.4, rev: 0.7, on: 0.45, max: 2 },
    lead: { w: 'hollow', oct: 4, lo: -2, hi: 7, rh: R44, end: E44, v: 0.09, atk: 0.08, rel: 0.4, vib: 12, vr: 5, cut: 1400, rev: 0.5, dly: 0.3, on: 0.3 },
    drums: { kit: [['kick', 'X.......X.......', 0.55], ['tick', '....x.......x..x', 0.6], ['tom', '..........x.....', 0.7], ['hat', 'x.x.x.x.x.x.x.x.', 0.85]], vol: 0.8, rev: 0.3 },
    amb: { ev: 'whisper', rate: 0.15, rev: 0.8 },
    fx: { d: 6, fb: 0.45, cut: 1400 },
  },
  // Sieg: kurze Fanfare in B-Dur, danach Stille
  victory: {
    key: 10, sc: 'ion', bpm: 104, once: 7, gain: 1,
    lead: { ins: 'brass', v: 0.07, atk: 0.04, rel: 0.5, br: 7, rev: 0.5, dly: 0.15 },
    pad: { ins: 'brass', v: 0.045, atk: 0.1, rel: 0.9, br: 4, rev: 0.6, cho: 1, max: 12 },
    arp: { ins: 'bell', v: 0.04, dec: 2, ratio: 2, idx: 1, rev: 0.8, max: 6 },
    drums: { rev: 0.4 },
    fx: { d: 3, fb: 0.3, cut: 3000 },
    seq: [ // [Schlag, Schicht, Töne bzw. Trommel, Dauer (Schläge), Stärke, Versatz je Ton]
      [0, 'drums', 'taiko', 0, 1], [0, 'pad', [58, 62, 65], 2, 0.9], [0, 'lead', [65], 0.5, 0.9], [0.5, 'lead', [70], 0.5, 0.95], [1, 'lead', [74], 1, 1],
      [2, 'drums', 'taiko', 0, 0.8], [2, 'pad', [58, 63, 67], 1, 0.9], [2, 'lead', [72], 0.5, 0.9], [2.5, 'lead', [74], 0.5, 0.95],
      [3, 'drums', 'tom', 0, 0.7], [3.25, 'drums', 'tom', 0, 0.75], [3.5, 'drums', 'tom', 0, 0.85], [3.75, 'drums', 'tom', 0, 0.95],
      [3, 'pad', [60, 65, 69], 1, 0.95], [3, 'lead', [77], 1, 1],
      [4, 'drums', 'taiko', 0, 1], [4, 'drums', 'crash', 0, 1], [4, 'pad', [46, 58, 62, 65, 70], 3, 1], [4, 'lead', [82], 3, 1],
      [4.25, 'arp', [82, 86, 89, 94], 1, 0.9, 0.25],
    ],
  },
  // Niederlage: absteigende Mollphrase in D, danach Stille
  defeat: {
    key: 2, sc: 'aeol', bpm: 66, once: 8.5, gain: 1,
    lead: { w: 'soft', v: 0.09, atk: 0.1, rel: 0.8, vib: 14, vr: 4.5, rev: 0.6, dly: 0.25 },
    pad: { w: 'warm', v: 0.05, atk: 0.8, rel: 2.5, cut: 900, cho: 1, rev: 0.8, max: 12 },
    drums: { rev: 0.6 },
    fx: { d: 3, fb: 0.35, cut: 1500 },
    seq: [
      [0, 'drums', 'boom', 0, 1], [0, 'drums', 'gong', 0, 0.8], [0, 'pad', [50, 53, 57], 2, 1], [0.5, 'lead', [69], 1, 0.9], [1.5, 'lead', [67], 1, 0.85],
      [2, 'pad', [46, 50, 53], 2, 1], [2.5, 'lead', [65], 1, 0.85], [3.5, 'lead', [64], 1, 0.8],
      [4, 'pad', [45, 49, 52, 55], 1.5, 1], [4, 'drums', 'frame', 0, 0.6], [4.5, 'lead', [61], 1, 0.8],
      [5.5, 'pad', [38, 50, 53, 57], 3, 1], [5.5, 'drums', 'frame', 0, 0.5], [5.5, 'lead', [62], 3, 0.85],
    ],
  },
};
for (const T of Object.values(TH)) { // Standardwerte ergänzen, Akkordfolgen einmalig vorbereiten
  T.bar = T.bar || 16; T.beat = T.beat || 4; T.cb = T.cb || 2; T.form = T.form || ['n', 'v', 'r'];
  T.progs = (T.progs || []).map((p) => p.split(' ').map(chord));
}

// ---------------------------------------------------------------- Instanzen, Überblenden, Planer
let want = null, cur = null, insts = [], target = 0.3, timer = null, manual = false, plays = 0, lastT = 0, S = null, solo = null;
let tb = null, tbR = null, tbCtx = null; // Themen-Bus (wird unter Stingern abgesenkt)
function themeBus(a) {
  if (tbCtx !== a) { tbCtx = a; tb = a.createGain(); tb.gain.value = MIX; tb.connect(musicOut()); tbR = a.createGain(); tbR.gain.value = MIX; tbR.connect(musicSend()); }
  return tb;
}
function mkInst(a, name) {
  const T = TH[name], t0 = a.currentTime;
  const I = { a, name, T, r: rng(hash(name) + 7919 * ++plays), per: [], nodes: [], ls: [], L: {}, x: target, step: 0, bs: -1, sec: -1, sd: 15 / T.bpm };
  I.barDur = T.bar * I.sd; I.t = t0 + 0.06; I.progs = T.progs;
  themeBus(a);
  I.out = gainN(I, 0, tb); I.rev = gainN(I, 0, tbR);
  if (T.fx) mkDelay(I, T.fx);
  for (const k of ['drone', 'pad', 'bass', 'stab', 'arp', 'lead', 'canon', 'drums', 'amb']) if (T[k]) I.L[k] = mkLayer(I, k, T[k]);
  const lead = I.L.lead;
  if (lead) { lead.scale = SC[lead.sc || T.sc]; I.lkey = 60 + 12 * ((lead.oct ?? 4) - 4) + (T.key > 5 ? T.key - 12 : T.key); }
  else I.lkey = 60 + T.key;
  I.sc = SC[T.sc];
  if (T.once) { // Einmal-Thema (Sieg/Niederlage): alles sofort planen
    const spb = 60 / T.bpm, t = t0 + 0.05;
    for (const L of I.ls) { L.g.gain.value = 1; L.lv = 1; }
    for (const [b, k, ns, d, v, sp] of T.seq) {
      const L = I.L[k], tt = t + b * spb;
      if (k === 'drums') DR[ns](I, L, tt, v);
      else ns.forEach((m, i) => INS[L.ins || k](I, L, tt + i * (sp || 0) * spb, m, d * spb, v));
    }
    I.end = t + T.once * spb + 2.5;
  }
  return I;
}
function fade(I, to, dur) {
  const t = I.a.currentTime;
  for (const p of [I.out.gain, I.rev.gain]) { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(to, t + dur); }
}
function kill(I) {
  const t = I.a.currentTime;
  for (const L of I.ls) for (const v of L.vs) if (v.e > t) for (const s of v.s) { try { s.stop(t); } catch (e) { /* egal */ } }
  for (const s of I.per) { try { s.stop(t); } catch (e) { /* egal */ } }
  for (const n of [I.out, I.rev, ...I.nodes]) { try { n.disconnect(); } catch (e) { /* egal */ } }
  I.dead = true;
}
function start(a, name) {
  const T = TH[name], now = a.currentTime;
  if (T.once && S && S.a === a) { // Sieg/Niederlage ersetzen laufende Stinger (z. B. 'death' direkt vor 'defeat')
    for (const L of S.ls) for (const v of L.vs) {
      if (v.t0 > now) { for (const s of v.s) { try { s.stop(now); } catch (e) { /* egal */ } } v.e = now; } else steal(v, now);
    }
    if (tbCtx === a) for (const p of [tb.gain, tbR.gain]) { p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); p.linearRampToValueAtTime(MIX, now + 0.2); } // Absenkung aufheben
  }
  for (const I of insts) if (!I.fadeEnd) { fade(I, 0, T.once ? 0.8 : XF); I.fadeEnd = a.currentTime + (T.once ? 0.8 : XF) + 0.05; }
  cur = mkInst(a, name);
  insts.push(cur);
  fade(cur, T.gain, T.once ? 0.02 : XF);
  lastT = a.currentTime;
  run();
}
/** Intensität → Lautstärke der Schichten und Filterhelligkeit (nur bei merklicher Änderung neu setzen). */
function levels(I, now) {
  for (const L of I.ls) {
    const lv = solo && L.type !== solo ? 0 : (L.on <= 0 ? 1 : clamp((I.x - L.on) / 0.1 + 0.5, 0, 1)) * (L.vol ?? 1);
    if (Math.abs(lv - L.lv) > 0.02 || (lv === 0 && L.lv !== 0) || (lv === 1 && L.lv !== 1)) {
      if (L.lv < 0) L.g.gain.setValueAtTime(lv, now); else L.g.gain.setTargetAtTime(lv, now, 0.4);
      L.lv = lv;
    }
    if (L.f && L.cutI) {
      const c = L.cut * Math.pow(L.cutI, I.x);
      if (Math.abs(c / L.fc - 1) > 0.04) { L.f.frequency.setTargetAtTime(c, now, 0.5); L.fc = c; }
    }
  }
}
function tick() {
  const a = audioCtx();
  if (!a || !musicOut()) { // Ton aus / kein Web Audio: sofort still, Wunsch bleibt gemerkt
    for (const I of insts) kill(I);
    insts = []; cur = null;
    if (want && TH[want].once) want = null;
    if (!want) halt();
    return;
  }
  if (want && !cur && !TH[want].once) start(a, want);
  const now = a.currentTime, dt = clamp(now - lastT, 0, 0.5), mute = !(musicVol() > 0.001);
  lastT = now;
  for (const I of insts) {
    if (I.fadeEnd) { if (now >= I.fadeEnd) kill(I); continue; }
    if (I.T.once) { if (now >= I.end) { kill(I); if (cur === I) { cur = null; if (want === I.name) want = null; } } continue; }
    I.x += (target - I.x) * Math.min(1, dt / 1.5);
    levels(I, now);
    while (I.t < now + LOOK) { stepAt(I, I.t, mute || I.t < now - 0.02); I.t += I.sd; }
    for (const L of I.ls) if (L.vs.length && L.vs[0].e < now) L.vs = L.vs.filter((v) => v.e > now);
  }
  insts = insts.filter((I) => !I.dead);
  if (!insts.length && !want) halt();
}
function run() { if (!manual && !timer && !isHidden()) timer = setInterval(tick, TICK); }
function halt() { if (timer) { clearInterval(timer); timer = null; } }
onAudio(() => { if (isHidden()) halt(); else if (want || insts.length) { run(); tick(); } });

// ---------------------------------------------------------------- Stinger (kurze Phrasen in der aktuellen Tonart)
function stingInst(a) {
  if (S && S.a === a) return S;
  S = { a, r: rng(4242), per: [], nodes: [], ls: [], L: {}, x: 1, sd: 0.12 };
  S.out = gainN(S, MIX, musicOut()); S.rev = gainN(S, MIX, musicSend());
  S.L.bell = mkLayer(S, 'arp', { v: 0.06, dec: 1.4, ratio: 2, idx: 1.2, rev: 0.7, max: 10 });
  S.L.brass = mkLayer(S, 'stab', { v: 0.08, atk: 0.05, rel: 0.6, br: 5, one: 1, rev: 0.5, max: 6 });
  S.L.pad = mkLayer(S, 'pad', { w: 'warm', v: 0.06, atk: 0.4, rel: 1.5, rev: 0.9, max: 6 }); // ohne Chorus: keine Dauer-Oszillatoren
  S.L.lead = mkLayer(S, 'lead', { w: 'soft', v: 0.09, atk: 0.04, rel: 0.4, vib: 12, rev: 0.5, max: 3 });
  S.L.drums = mkLayer(S, 'drums', { rev: 0.4, max: 10 });
  for (const L of S.ls) { L.g.gain.value = 1; L.lv = 1; }
  return S;
}
const reg = (base, pc) => base + mod(pc - base, 12); // erste Taste ≥ base mit Tonhöhenklasse pc
const STING = {
  levelup(S, t, k, ch) { // Arpeggio des aktuellen Akkords aufwärts, heller Schlusston
    const ns = [];
    for (let o = 0; o < 2; o++) for (const pc of ch.pcs.slice(0, 3)) ns.push(reg(72, k + pc) + 12 * o);
    ns.sort((x, y) => x - y).slice(0, 5).forEach((m, i) => INS.bell(S, S.L.bell, t + i * 0.08, m, 0.3, 0.75 + i * 0.05));
    INS.bell(S, S.L.bell, t + 0.42, reg(84, k + ch.r), 1, 1);
    return 1.4;
  },
  elite(S, t, k) { // bedrohlicher Blechstoß (Grundton, kleine Sekunde, Quinte) + Trommeln
    const r = reg(43, k);
    for (const iv of [0, 1, 7]) INS.brass(S, S.L.brass, t, r + iv, 0.8, 1);
    DR.taiko(S, S.L.drums, t, 1); DR.taiko(S, S.L.drums, t + 0.22, 0.7);
    return 1.5;
  },
  bossdown(S, t, k) { // Triumph: Dur-Akkord auf der Tonika, Fanfare und Glocken
    const r = reg(48, k);
    for (const iv of [0, 7, 12, 16]) INS.brass(S, S.L.brass, t + 0.05, r + iv, 2.2, 1);
    [7, 12, 16].forEach((iv, i) => INS.lead(S, S.L.lead, t + i * 0.22, r + 12 + iv, i < 2 ? 0.2 : 1.6, 1));
    [0, 4, 7, 12, 16].forEach((iv, i) => INS.bell(S, S.L.bell, t + 0.7 + i * 0.09, r + 24 + iv, 1, 0.8));
    for (let i = 0; i < 4; i++) DR.tom(S, S.L.drums, t + i * 0.08, 0.6 + i * 0.1);
    DR.taiko(S, S.L.drums, t + 0.35, 1); DR.crash(S, S.L.drums, t + 0.35, 1);
    return 3;
  },
  evolve(S, t, k) { // lydischer Lauf aufwärts, dann schimmernder Maj7-Akkord
    const r = reg(60, k);
    [0, 2, 4, 6, 7, 9, 11, 12, 14, 16].forEach((iv, i) => INS.bell(S, S.L.bell, t + i * 0.06, r + iv, 0.3, 0.7));
    for (const iv of [0, 4, 7, 11]) INS.pad(S, S.L.pad, t + 0.6, r + 12 + iv, 1.2, 1);
    return 2.2;
  },
  nemesis(S, t, k) { // dissonant: Tritonus und kleine Sekunde, tiefer Schlag
    const r = reg(43, k);
    for (const iv of [0, 1, 6]) INS.brass(S, S.L.brass, t, r + iv, 1.4, 1);
    DR.boom(S, S.L.drums, t, 1); DR.gong(S, S.L.drums, t + 0.05, 0.7);
    INS.bell(S, S.L.bell, t + 0.15, r + 30, 1.5, 0.8); INS.bell(S, S.L.bell, t + 0.15, r + 36, 1.5, 0.6);
    return 2.4;
  },
  death(S, t, k) { // fallende Mollphrase über tiefem Akkord
    const r = reg(55, k);
    [7, 5, 3, 2, 0].forEach((iv, i) => INS.lead(S, S.L.lead, t + i * 0.42, r + iv, i < 4 ? 0.38 : 1.4, 0.9));
    for (const iv of [0, 3, 7]) INS.pad(S, S.L.pad, t, r - 12 + iv, 2.2, 1);
    DR.boom(S, S.L.drums, t, 0.8);
    return 3;
  },
};

export const music = {
  /** Zu einem Thema überblenden ('menu', 'boss', 'pinnacle', 'abyss', 'victory', 'defeat' oder eine Biom-ID). */
  play(theme) {
    const name = TH[theme] ? theme : 'sternengrab';
    if (name === want && (cur || TH[name].once)) return;
    want = name;
    const a = audioCtx();
    if (!a || !musicOut()) { if (TH[name].once) want = null; return; }
    start(a, name);
    tick();
  },
  /** Musik ausblenden (Sekunden). */
  stop(fade_ = 1.5) {
    want = null; cur = null;
    const f = Math.max(0.02, +fade_ || 0);
    for (const I of insts) if (!I.fadeEnd) { fade(I, 0, f); I.fadeEnd = I.a.currentTime + f + 0.05; }
    if (insts.length) run();
  },
  /** 0 = nur Fläche + Bass, ~0.5 = + Arpeggio, 1 = + Schlagwerk und hellerer Klang (wird weich nachgeführt). */
  setIntensity(x) { target = clamp(+x || 0, 0, 1); },
  /** Kurze musikalische Einwürfe: 'levelup', 'elite', 'bossdown', 'evolve', 'nemesis', 'death'. */
  stinger(kind) {
    const f = STING[kind];
    if (!f || !(musicVol() > 0.001)) return;
    const a = audioCtx();
    if (!a || !musicOut()) return;
    const s = stingInst(a), t = a.currentTime + 0.03;
    for (const L of s.ls) if (L.vs.length) L.vs = L.vs.filter((v) => v.e > t);
    const k = cur ? cur.T.key : 2, ch = (cur && cur.chord) || TH.menu.progs[0][0];
    const len = f(s, t, k, kind === 'levelup' ? ch : null);
    if (tbCtx === a) for (const p of [tb.gain, tbR.gain]) { // Thema kurz zurücknehmen
      p.cancelScheduledValues(t); p.setValueAtTime(p.value, t);
      p.linearRampToValueAtTime(0.45 * MIX, t + 0.12); p.setValueAtTime(0.45 * MIX, t + len * 0.6); p.linearRampToValueAtTime(MIX, t + len + 1);
    }
  },
  /** Aktuelles (gewünschtes) Thema oder null. */
  get current() { return want; },
  // nur für Tests: Planer von Hand takten, Zustand auslesen
  _tick: tick,
  _manual(on) { manual = !!on; if (manual) halt(); else if (want || insts.length) run(); },
  _reset() { for (const I of insts) kill(I); insts = []; want = null; cur = null; S = null; tbCtx = null; target = 0.3; halt(); },
  _stats() {
    const c = insts[0] || S, now = c ? c.a.currentTime : 0;
    let src = 0, voices = 0;
    const ly = {};
    for (const I of S ? [...insts, S] : insts) {
      src += I.per.length;
      for (const L of I.ls) for (const v of L.vs) if (v.e > now) { voices++; src += v.s.length; if (I === cur) ly[L.type] = (ly[L.type] || 0) + v.s.length; }
    }
    return { insts: insts.length, voices, src, ly, cur: want, x: cur ? cur.x : target };
  },
  _solo(type) { solo = type || null; },
  _inst: () => cur,
  _themes: Object.keys(TH),
};
