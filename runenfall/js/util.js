// Kleine Helfer, die überall gebraucht werden.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
/** Chance in Prozent (0–100). */
export const chance = (p) => Math.random() * 100 < p;

export function weighted(list, w = (x) => x.w) {
  let total = 0;
  for (const x of list) total += Math.max(0, w(x));
  if (total <= 0) return list[Math.floor(Math.random() * list.length)];
  let r = Math.random() * total;
  for (const x of list) {
    r -= Math.max(0, w(x));
    if (r <= 0) return x;
  }
  return list[list.length - 1];
}

export function shuffle(arr, rnd = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Deterministischer Zufall (für Karten, Sternenkarte, tägliche Seeds). */
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (x, y) => x + next() * (y - x),
    int: (x, y) => Math.floor(x + next() * (y - x + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() * 100 < p,
    weighted(list, w = (x) => x.w) {
      let total = 0;
      for (const x of list) total += Math.max(0, w(x));
      let r = next() * total;
      for (const x of list) {
        r -= Math.max(0, w(x));
        if (r <= 0) return x;
      }
      return list[list.length - 1];
    },
    shuffle: (arr) => shuffle(arr, next),
  };
}

/** Zahlen kompakt und deutsch formatieren: 1,25k · 3,4M. */
export function fmt(n) {
  if (!isFinite(n)) return '∞';
  const a = Math.abs(n);
  let s;
  if (a >= 1e12) s = (n / 1e12).toFixed(2) + 'B';
  else if (a >= 1e9) s = (n / 1e9).toFixed(2) + 'Mrd';
  else if (a >= 1e6) s = (n / 1e6).toFixed(2) + 'M';
  else if (a >= 1e4) s = (n / 1e3).toFixed(1) + 'k';
  else if (a >= 100) s = Math.round(n).toString();
  else if (a >= 10) s = n.toFixed(1).replace(/\.0$/, '');
  else s = n.toFixed(2).replace(/\.?0+$/, '');
  return s.replace('.', ',');
}

/** Zahl für Modifikator-Texte: höchstens eine Nachkommastelle. */
export function fmtV(v) {
  const r = Math.round(v * 10) / 10;
  return String(r).replace('.', ',');
}

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Sekunden als m:ss (bzw. h:mm:ss). */
export const clock = (t) => { t = Math.max(0, Math.round(t)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = String(t % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`; };

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
