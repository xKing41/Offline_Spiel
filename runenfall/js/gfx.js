// Grafik-Bausteine: prozedurale Sprites (Gegner, Bosse, Spieler), Biom-Böden, Licht und Atmosphäre.
// Alles wird einmalig in Offscreen-Canvas vorgerendert und danach nur noch gestempelt.
import { makeRng } from './util.js';

const TAU = Math.PI * 2;
export let SPR = 3; // Sprite-Pixel pro Welteinheit (passend zur Bildschirmauflösung)
/** Sprite-Auflösung an Zoom × Pixeldichte anpassen; leert die Caches bei Änderung. */
export function setSpriteRes(pxPerUnit) {
  const v = Math.max(1.5, Math.min(3.2, Math.round(pxPerUnit * 1.15 * 4) / 4));
  if (v === SPR) return;
  SPR = v;
  sprCache.clear(); playerCache.clear();
}
const mk = (w, h = w) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

// ---------------------------------------------------------------- Farben
const hex2 = (c) => {
  let h = c.replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgba = (c, a) => { const [r, g, b] = hex2(c); return `rgba(${r},${g},${b},${a})`; };
/** f > 0 aufhellen (Richtung Weiß), f < 0 abdunkeln. */
export const shade = (c, f) => {
  const [r, g, b] = hex2(c);
  const m = (v) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f));
  return `#${[m(r), m(g), m(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};
const mix = (a, b, k) => { const A = hex2(a), B = hex2(b); return `#${A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('')}`; };

// ---------------------------------------------------------------- Weiche Lichter & Schatten
const softCache = new Map();
/** Weicher Kreis (weiß oder farbig), 128px – für Licht, Partikel und Glühen. */
export function soft(color = '#ffffff', hard = 0) {
  const key = color + hard;
  let c = softCache.get(key);
  if (c) return c;
  c = mk(128);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, rgba(color, 1));
  gr.addColorStop(hard ? 0.45 : 0.25, rgba(color, hard ? 0.8 : 0.45));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  softCache.set(key, c);
  return c;
}
let shadowSpr = null;
export function shadowSprite() {
  if (shadowSpr) return shadowSpr;
  shadowSpr = mk(128, 64);
  const g = shadowSpr.getContext('2d');
  g.scale(1, 0.5);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return shadowSpr;
}

// ---------------------------------------------------------------- Zeichenhilfen (Einheit = Radius 1)
const P = (g, pts, close = true) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (close) g.closePath(); };
const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); };
const body = (g, C, x = 0, y = 0, r = 1) => {
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r * 1.1);
  gr.addColorStop(0, C.light); gr.addColorStop(0.45, C.col); gr.addColorStop(1, C.dark);
  return gr;
};
const ink = (g, C, w = 0.09) => { g.lineWidth = w; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); };
const fillInk = (g, fill, C, w) => { g.fillStyle = fill; g.fill(); ink(g, C, w); };
function eye(g, x, y, s, col = '#ffffff', glow = '#ffffff') {
  g.save();
  g.shadowColor = glow; g.shadowBlur = s * 6 * SPR;
  g.fillStyle = col; circ(g, x, y, s); g.fill();
  g.shadowBlur = 0;
  g.fillStyle = '#ffffff'; circ(g, x + s * 0.25, y - s * 0.25, s * 0.38); g.fill();
  g.restore();
}
function slit(g, x, y, w, h, col) {
  g.save(); g.shadowColor = col; g.shadowBlur = 10;
  g.fillStyle = col; g.beginPath(); g.ellipse(x, y, w, h, 0, 0, TAU); g.fill(); g.restore();
}
function spikes(g, n, r0, r1, C, rot = 0, w = 0.35) {
  for (let i = 0; i < n; i++) {
    const a = rot + (i * TAU) / n;
    P(g, [[Math.cos(a - w / n * 3) * r0, Math.sin(a - w / n * 3) * r0], [Math.cos(a) * r1, Math.sin(a) * r1], [Math.cos(a + w / n * 3) * r0, Math.sin(a + w / n * 3) * r0]]);
    fillInk(g, C.mid, C, 0.06);
  }
}
function legs(g, n, len, C, spread = 2.2, w = 0.11) {
  g.lineCap = 'round';
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < n; i++) {
      const a = s * (Math.PI / 2 + ((i - (n - 1) / 2) / Math.max(1, n - 1)) * (spread * 0.5));
      const kx = Math.cos(a) * 0.9, ky = Math.sin(a) * 0.9;
      const ex = Math.cos(a - s * 0.4) * len, ey = Math.sin(a - s * 0.4) * len;
      g.beginPath(); g.moveTo(kx * 0.5, ky * 0.5); g.quadraticCurveTo(kx * 1.25, ky * 1.25, ex, ey);
      g.lineWidth = w + 0.06; g.strokeStyle = C.ink; g.stroke();
      g.lineWidth = w; g.strokeStyle = C.mid; g.stroke();
    }
  }
}
function glowFill(g, col, blur) { g.save(); g.shadowColor = col; g.shadowBlur = blur; g.fill(); g.restore(); }

// ---------------------------------------------------------------- Gegner-Designs (Blickrichtung +x)
const DRAW = {
  shade(g, C) {
    const gr = g.createLinearGradient(-1.7, 0, 1, 0);
    gr.addColorStop(0, rgba(C.col, 0)); gr.addColorStop(0.45, rgba(C.col, 0.75)); gr.addColorStop(1, C.light);
    g.beginPath(); g.moveTo(1, 0);
    g.bezierCurveTo(1, -1.05, -0.4, -1, -0.8, -0.55);
    g.quadraticCurveTo(-1.3, -0.45, -1.7, -0.75); g.quadraticCurveTo(-1.25, -0.1, -1.75, 0.05);
    g.quadraticCurveTo(-1.25, 0.25, -1.6, 0.75); g.quadraticCurveTo(-1.1, 0.5, -0.8, 0.55);
    g.bezierCurveTo(-0.4, 1, 1, 1.05, 1, 0);
    g.fillStyle = gr; glowFill(g, C.col, 18);
    g.fillStyle = rgba(C.dark, 0.85); circ(g, 0.25, 0, 0.62); g.fill();
    slit(g, 0.45, -0.25, 0.16, 0.09, '#ffffff'); slit(g, 0.45, 0.25, 0.16, 0.09, '#ffffff');
  },
  runner(g, C) {
    legs(g, 2, 1.1, C, 2.4, 0.13);
    P(g, [[1.25, 0], [0.1, -0.75], [-0.85, -0.55], [-0.6, 0], [-0.85, 0.55], [0.1, 0.75]]);
    fillInk(g, body(g, C, 0.1, 0, 0.9), C);
    P(g, [[0.2, -0.55], [-0.3, -1.15], [-0.05, -0.5]]); fillInk(g, C.dark, C, 0.06);
    P(g, [[0.2, 0.55], [-0.3, 1.15], [-0.05, 0.5]]); fillInk(g, C.dark, C, 0.06);
    eye(g, 0.55, -0.22, 0.13, '#fff3a0', C.light); eye(g, 0.55, 0.22, 0.13, '#fff3a0', C.light);
  },
  brute(g, C) {
    g.fillStyle = C.mid; circ(g, 0.55, -0.95, 0.38); fillInk(g, body(g, C, 0.55, -0.95, 0.38), C);
    circ(g, 0.55, 0.95, 0.38); fillInk(g, body(g, C, 0.55, 0.95, 0.38), C);
    g.beginPath(); g.roundRect(-0.9, -0.85, 1.7, 1.7, 0.45); fillInk(g, body(g, C), C, 0.1);
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-0.65 + i * 0.35, -0.75); g.lineTo(-0.65 + i * 0.35, 0.75); g.lineWidth = 0.05; g.strokeStyle = rgba(C.ink, 0.6); g.stroke(); }
    spikes(g, 3, 0.7, 1.1, C, Math.PI - 0.6, 0.3); spikes(g, 3, 0.7, 1.1, C, Math.PI + 0.6, 0.3);
    eye(g, 0.55, -0.25, 0.1, '#ffb070', '#ff7a2a'); eye(g, 0.55, 0.25, 0.1, '#ffb070', '#ff7a2a');
  },
  seer(g, C) {
    P(g, [[1.15, 0], [0, -1.15], [-1.15, 0], [0, 1.15]]); fillInk(g, body(g, C), C);
    P(g, [[0.8, 0], [0, -0.8], [-0.8, 0], [0, 0.8]]); g.fillStyle = C.dark; g.fill();
    g.fillStyle = '#f4f0ff'; circ(g, 0.1, 0, 0.55); g.fill();
    const ir = g.createRadialGradient(0.25, 0, 0, 0.25, 0, 0.35); ir.addColorStop(0, C.light); ir.addColorStop(1, C.col);
    g.fillStyle = ir; circ(g, 0.25, 0, 0.32); glowFill(g, C.col, 14);
    g.fillStyle = '#05030a'; circ(g, 0.32, 0, 0.14); g.fill();
    g.fillStyle = '#fff'; circ(g, 0.2, -0.12, 0.07); g.fill();
  },
  bomber(g, C) {
    circ(g, 0, 0, 0.95); fillInk(g, body(g, { ...C, light: '#5a4a50', col: '#2a2028', dark: '#0e0a10' }), C, 0.1);
    g.strokeStyle = C.col; g.lineWidth = 0.09; g.shadowColor = C.col; g.shadowBlur = 16;
    P(g, [[-0.6, -0.4], [-0.2, -0.1], [-0.3, 0.3], [0.15, 0.5]], false); g.stroke();
    P(g, [[0.5, -0.6], [0.2, -0.2], [0.55, 0.15]], false); g.stroke(); g.shadowBlur = 0;
    g.beginPath(); g.moveTo(0.85, 0); g.quadraticCurveTo(1.25, -0.2, 1.3, -0.5); g.lineWidth = 0.12; g.strokeStyle = '#8a6a4a'; g.stroke();
    g.fillStyle = '#fff6c0'; circ(g, 1.3, -0.5, 0.17); glowFill(g, '#ffb030', 24);
  },
  splitter(g, C) {
    P(g, Array.from({ length: 6 }, (_, i) => [Math.cos(i * TAU / 6) * 1.05, Math.sin(i * TAU / 6) * 1.05]));
    g.fillStyle = rgba(C.col, 0.35); g.fill(); ink(g, C, 0.08);
    g.strokeStyle = rgba(C.light, 0.7); g.lineWidth = 0.05; g.stroke();
    for (const [x, y] of [[0.35, -0.3], [-0.35, -0.2], [0, 0.4]]) { circ(g, x, y, 0.3); fillInk(g, body(g, C, x, y, 0.3), C, 0.05); g.fillStyle = C.dark; circ(g, x, y, 0.1); g.fill(); }
  },
  mite(g, C) {
    legs(g, 3, 1.05, C, 2, 0.1);
    g.beginPath(); g.ellipse(-0.15, 0, 0.85, 0.65, 0, 0, TAU); fillInk(g, body(g, C, -0.15, 0, 0.8), C);
    g.beginPath(); g.moveTo(0.6, -0.25); g.quadraticCurveTo(1.2, -0.3, 1.15, 0); g.moveTo(0.6, 0.25); g.quadraticCurveTo(1.2, 0.3, 1.15, 0); ink(g, C, 0.1);
    eye(g, 0.45, -0.2, 0.09, '#fff', C.light); eye(g, 0.45, 0.2, 0.09, '#fff', C.light);
  },
  charger(g, C) {
    legs(g, 2, 1, C, 2.2, 0.15);
    g.beginPath(); g.ellipse(-0.1, 0, 1, 0.8, 0, 0, TAU); fillInk(g, body(g, C), C);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0.5, s * 0.45); g.quadraticCurveTo(1.0, s * 1.1, 1.45, s * 0.55); g.quadraticCurveTo(1.05, s * 0.75, 0.75, s * 0.25); g.closePath(); fillInk(g, '#efe2c8', C, 0.06); }
    g.fillStyle = C.dark; g.beginPath(); g.ellipse(0.75, 0, 0.3, 0.35, 0, 0, TAU); g.fill();
    eye(g, 0.55, -0.32, 0.09, '#ff3030', '#ff0000'); eye(g, 0.55, 0.32, 0.09, '#ff3030', '#ff0000');
  },
  wraith(g, C) {
    g.beginPath();
    for (let i = 0; i <= 16; i++) { const a = (i / 16) * TAU; const rr = i % 2 ? 0.85 : 1.15 + (a > 2 && a < 4.3 ? 0.35 : 0); g.lineTo(Math.cos(a) * rr - 0.1, Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = body(g, C); glowFill(g, C.col, 16); ink(g, C, 0.07);
    g.fillStyle = '#07040c'; g.beginPath(); g.ellipse(0.25, 0, 0.5, 0.55, 0, 0, TAU); g.fill();
    slit(g, 0.45, -0.2, 0.1, 0.07, C.light); slit(g, 0.45, 0.2, 0.1, 0.07, C.light);
  },
  golem(g, C) {
    const prism = (x, y, w, h, rot) => {
      g.save(); g.translate(x, y); g.rotate(rot);
      P(g, [[0, -h], [w, -h * 0.5], [w, h * 0.5], [0, h], [-w, h * 0.5], [-w, -h * 0.5]]);
      fillInk(g, body(g, C, 0, 0, Math.max(w, h)), C, 0.06);
      P(g, [[0, -h], [w, -h * 0.5], [0, 0], [-w, -h * 0.5]]); g.fillStyle = rgba('#ffffff', 0.25); g.fill();
      g.restore();
    };
    prism(-0.45, -0.45, 0.4, 0.6, -0.5); prism(-0.45, 0.5, 0.35, 0.55, 0.6); prism(0.5, -0.5, 0.3, 0.5, 0.4);
    prism(0.55, 0.5, 0.33, 0.5, -0.3); prism(0, 0, 0.55, 0.8, 0);
    eye(g, 0.3, -0.18, 0.1, '#e8fbff', C.col); eye(g, 0.3, 0.18, 0.1, '#e8fbff', C.col);
  },
  shielder(g, C) {
    circ(g, -0.15, 0, 0.85); fillInk(g, body(g, C, -0.15), C);
    g.fillStyle = C.dark; circ(g, 0, 0, 0.45); g.fill();
    g.beginPath(); g.arc(-0.2, 0, 1.25, -1.1, 1.1); g.arc(-0.2, 0, 0.85, 1.1, -1.1, true); g.closePath();
    fillInk(g, body(g, { ...C, light: '#e8f0ff', col: '#9ab4e8', dark: '#3a4a78' }, 0.8, 0, 0.6), C, 0.08);
    g.strokeStyle = C.light; g.lineWidth = 0.07; g.beginPath(); g.arc(-0.2, 0, 1.05, -0.8, 0.8); g.stroke();
    eye(g, 0.25, -0.15, 0.07, '#fff', C.light); eye(g, 0.25, 0.15, 0.07, '#fff', C.light);
  },
  healer(g, C) {
    circ(g, 0, 0, 0.9); fillInk(g, body(g, C), C);
    g.strokeStyle = C.light; g.lineWidth = 0.12; g.shadowColor = C.col; g.shadowBlur = 18; circ(g, 0, 0, 1.15); g.stroke(); g.shadowBlur = 0;
    g.fillStyle = '#f4fff8'; g.fillRect(-0.12, -0.45, 0.24, 0.9); g.fillRect(-0.45, -0.12, 0.9, 0.24);
  },
  blinker(g, C) {
    g.save(); g.globalAlpha = 0.35; g.translate(-0.5, 0);
    P(g, [[1.2, 0], [0.25, -0.25], [0, -1.1], [-0.25, -0.25], [-1.1, 0], [-0.25, 0.25], [0, 1.1], [0.25, 0.25]]); g.fillStyle = C.col; g.fill(); g.restore();
    P(g, [[1.2, 0], [0.25, -0.25], [0, -1.1], [-0.25, -0.25], [-1.1, 0], [-0.25, 0.25], [0, 1.1], [0.25, 0.25]]);
    g.fillStyle = body(g, C); glowFill(g, C.col, 18); ink(g, C, 0.06);
    eye(g, 0.15, 0, 0.16, '#fff', C.light);
  },
  nest(g, C) {
    g.beginPath();
    for (let i = 0; i <= 20; i++) { const a = (i / 20) * TAU; const rr = 1 + 0.08 * Math.sin(a * 5) + 0.05 * Math.cos(a * 3); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); fillInk(g, body(g, { ...C, col: mix(C.col, '#5a4030', 0.55), light: mix(C.light, '#8a7050', 0.4) }), C, 0.1);
    g.strokeStyle = rgba(C.col, 0.5); g.lineWidth = 0.05;
    for (let i = 0; i < 6; i++) { const a = i * 1.05; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Math.cos(a + 0.4) * 0.5, Math.sin(a + 0.4) * 0.5, Math.cos(a) * 0.95, Math.sin(a) * 0.95); g.stroke(); }
    for (const [x, y, r] of [[0.4, -0.35, 0.2], [-0.35, -0.4, 0.17], [-0.3, 0.4, 0.2], [0.4, 0.4, 0.15], [0, 0, 0.24]]) {
      g.fillStyle = '#0a0806'; circ(g, x, y, r); g.fill();
      g.strokeStyle = C.col; g.lineWidth = 0.06; g.shadowColor = C.col; g.shadowBlur = 10; g.stroke(); g.shadowBlur = 0;
    }
  },
  sniper(g, C) {
    g.fillStyle = '#3a3040'; g.fillRect(0.2, -0.13, 1.35, 0.26); g.strokeStyle = C.ink; g.lineWidth = 0.06; g.strokeRect(0.2, -0.13, 1.35, 0.26);
    g.fillStyle = C.light; circ(g, 1.55, 0, 0.12); glowFill(g, C.col, 18);
    P(g, [[0.85, 0], [0, -0.9], [-0.9, 0], [0, 0.9]]); fillInk(g, body(g, C), C);
    eye(g, 0.15, 0, 0.18, C.light, C.col);
  },
  slime(g, C) {
    g.beginPath(); g.moveTo(1, 0);
    for (let i = 1; i <= 24; i++) { const a = (i / 24) * TAU; const rr = 1 + 0.06 * Math.sin(a * 4); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.92); }
    g.closePath();
    const gr = g.createRadialGradient(-0.3, -0.35, 0.05, 0, 0, 1.05); gr.addColorStop(0, rgba(C.light, 0.95)); gr.addColorStop(0.6, rgba(C.col, 0.75)); gr.addColorStop(1, rgba(C.dark, 0.9));
    g.fillStyle = gr; glowFill(g, C.col, 12); ink(g, C, 0.07);
    g.fillStyle = rgba('#ffffff', 0.25); for (const [x, y, r] of [[0.3, 0.35, 0.12], [-0.4, 0.2, 0.08], [0.1, -0.1, 0.06]]) { circ(g, x, y, r); g.fill(); }
    g.fillStyle = rgba('#ffffff', 0.7); g.beginPath(); g.ellipse(-0.35, -0.45, 0.28, 0.13, -0.5, 0, TAU); g.fill();
    g.fillStyle = '#0a1a14'; circ(g, 0.45, -0.22, 0.1); g.fill(); circ(g, 0.45, 0.22, 0.1); g.fill();
  },
  phantom(g, C) {
    g.save(); g.globalAlpha = 0.85;
    g.beginPath(); g.ellipse(0, 0, 1, 0.85, 0, 0, TAU);
    const gr = g.createRadialGradient(0.2, 0, 0.1, 0, 0, 1.1); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, rgba(C.col, 0.8)); gr.addColorStop(1, rgba(C.col, 0.05));
    g.fillStyle = gr; glowFill(g, C.col, 20); g.restore();
    g.fillStyle = '#0a0812';
    g.beginPath(); g.ellipse(0.35, -0.3, 0.16, 0.24, 0.3, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(0.35, 0.3, 0.16, 0.24, -0.3, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(-0.25, 0, 0.12, 0.3, 0, 0, TAU); g.fill();
  },
  turret(g, C) {
    g.beginPath(); g.roundRect(-1, -1, 2, 2, 0.25); fillInk(g, body(g, { ...C, col: '#5a4a5a', light: '#8a7a8a', dark: '#241a24' }), C, 0.1);
    for (const [x, y] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) { circ(g, x, y, 0.22); fillInk(g, '#3a2e3a', C, 0.05); }
    for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * TAU / 4); g.fillStyle = C.dark; g.fillRect(0.5, -0.12, 0.55, 0.24); g.restore(); }
    circ(g, 0, 0, 0.5); g.fillStyle = body(g, C, 0, 0, 0.5); glowFill(g, C.col, 18);
    g.strokeStyle = '#fff5e0'; g.lineWidth = 0.06; P(g, [[0, -0.3], [0.26, 0.15], [-0.26, 0.15]]); g.stroke();
  },
  leaper(g, C) {
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(-0.2, s * 0.6); g.lineTo(-0.9, s * 1.15); g.lineTo(-1.25, s * 0.45); g.lineWidth = 0.22; g.strokeStyle = C.ink; g.stroke(); g.lineWidth = 0.14; g.strokeStyle = C.mid; g.stroke(); }
    g.beginPath(); g.ellipse(0, 0, 0.95, 0.85, 0, 0, TAU); fillInk(g, body(g, C), C);
    g.fillStyle = rgba(C.dark, 0.6); for (const [x, y] of [[-0.3, -0.3], [-0.45, 0.2], [0.05, 0.45]]) { circ(g, x, y, 0.12); g.fill(); }
    eye(g, 0.5, -0.45, 0.17, '#fff9c0', C.light); eye(g, 0.5, 0.45, 0.17, '#fff9c0', C.light);
  },
  minelayer(g, C) {
    legs(g, 3, 1.05, C, 2, 0.1);
    g.beginPath(); g.ellipse(-0.05, 0, 1, 0.82, 0, 0, TAU); fillInk(g, body(g, C), C);
    g.beginPath(); g.moveTo(-1, 0); g.lineTo(0.5, 0); g.lineWidth = 0.06; g.strokeStyle = C.ink; g.stroke();
    for (const [x, y] of [[-0.45, -0.38], [-0.45, 0.38], [0.05, -0.4], [0.05, 0.4]]) { circ(g, x, y, 0.17); fillInk(g, '#2a2020', C, 0.04); g.fillStyle = '#ff4030'; circ(g, x, y, 0.06); glowFill(g, '#ff2010', 8); }
    g.beginPath(); g.ellipse(0.75, 0, 0.3, 0.35, 0, 0, TAU); fillInk(g, C.dark, C, 0.06);
  },
  swarm(g, C) {
    g.save(); g.globalAlpha = 0.6; g.fillStyle = '#eef8ff';
    g.beginPath(); g.ellipse(-0.1, -0.7, 0.55, 0.3, -0.4, 0, TAU); g.fill(); g.beginPath(); g.ellipse(-0.1, 0.7, 0.55, 0.3, 0.4, 0, TAU); g.fill(); g.restore();
    g.beginPath(); g.ellipse(0, 0, 1.05, 0.45, 0, 0, TAU); fillInk(g, body(g, C, 0, 0, 0.8), C, 0.08);
    g.fillStyle = '#201808'; g.fillRect(-0.5, -0.4, 0.15, 0.8); g.fillRect(-0.15, -0.42, 0.15, 0.84);
    P(g, [[-1.05, -0.12], [-1.45, 0], [-1.05, 0.12]]); g.fillStyle = '#201808'; g.fill();
    eye(g, 0.65, -0.18, 0.1, '#ff6030', '#ff3000'); eye(g, 0.65, 0.18, 0.1, '#ff6030', '#ff3000');
  },
  lurker(g, C) {
    legs(g, 4, 1.45, C, 2.6, 0.1);
    circ(g, -0.45, 0, 0.75); fillInk(g, body(g, C, -0.45, 0, 0.75), C);
    g.fillStyle = rgba('#ff3030', 0.7); P(g, [[-0.45, -0.35], [-0.25, 0], [-0.45, 0.35], [-0.65, 0]]); g.fill();
    circ(g, 0.45, 0, 0.45); fillInk(g, body(g, C, 0.45, 0, 0.45), C);
    for (const [x, y, s] of [[0.7, -0.15, 0.08], [0.7, 0.15, 0.08], [0.6, -0.3, 0.05], [0.6, 0.3, 0.05], [0.8, 0, 0.05]]) eye(g, x, y, s, '#ff2a2a', '#ff0000');
  },
  priest(g, C) {
    spikes(g, 7, 0.75, 1.25, C, Math.PI, 0.55);
    circ(g, 0, 0, 0.9); fillInk(g, body(g, C), C);
    g.fillStyle = '#08040e'; g.beginPath(); g.ellipse(0.1, 0, 0.42, 0.3, 0, 0, TAU); g.fill();
    const gr = g.createRadialGradient(0.15, 0, 0, 0.15, 0, 0.25); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, C.col);
    g.fillStyle = gr; circ(g, 0.15, 0, 0.2); glowFill(g, C.col, 20);
    g.fillStyle = '#000'; g.beginPath(); g.ellipse(0.17, 0, 0.05, 0.15, 0, 0, TAU); g.fill();
  },
  moloch(g, C) {
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0.6, s * 0.5); g.quadraticCurveTo(1.35, s * 0.55, 1.3, s * 0.05); g.lineTo(0.8, s * 0.3); g.closePath(); fillInk(g, '#f0e4cc', C, 0.06); }
    g.beginPath(); g.ellipse(-0.05, 0, 1.05, 0.95, 0, 0, TAU); fillInk(g, body(g, C), C, 0.1);
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-0.3 - i * 0.18, 0, 0.75 - i * 0.12, -1.2, 1.2); g.lineWidth = 0.07; g.strokeStyle = rgba(C.ink, 0.65); g.stroke(); }
    spikes(g, 5, 0.8, 1.3, C, Math.PI, 0.5);
    eye(g, 0.7, -0.25, 0.09, '#ff9a40', '#ff5000'); eye(g, 0.7, 0.25, 0.09, '#ff9a40', '#ff5000');
  },
  frostling(g, C) {
    for (let i = 0; i < 7; i++) {
      const a = (i * TAU) / 7, l = i % 2 ? 1.1 : 1.35;
      P(g, [[Math.cos(a - 0.3) * 0.4, Math.sin(a - 0.3) * 0.4], [Math.cos(a) * l, Math.sin(a) * l], [Math.cos(a + 0.3) * 0.4, Math.sin(a + 0.3) * 0.4]]);
      fillInk(g, body(g, { ...C, col: '#a8e8ff' }, 0, 0, 1.2), C, 0.05);
    }
    circ(g, 0, 0, 0.55); g.fillStyle = body(g, C, 0, 0, 0.55); glowFill(g, '#bff3ff', 16);
    eye(g, 0.2, -0.15, 0.08, '#204060', '#62d6ff'); eye(g, 0.2, 0.15, 0.08, '#204060', '#62d6ff');
  },
  sparkler(g, C) {
    g.strokeStyle = C.light; g.lineWidth = 0.08; g.shadowColor = C.col; g.shadowBlur = 14;
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.2; g.beginPath(); g.moveTo(Math.cos(a) * 0.5, Math.sin(a) * 0.5); g.lineTo(Math.cos(a + 0.25) * 0.85, Math.sin(a + 0.25) * 0.85); g.lineTo(Math.cos(a - 0.1) * 1.3, Math.sin(a - 0.1) * 1.3); g.stroke(); }
    g.shadowBlur = 0;
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 0.7); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, C.light); gr.addColorStop(1, rgba(C.col, 0.2));
    g.fillStyle = gr; circ(g, 0, 0, 0.7); glowFill(g, C.col, 24);
  },
  archer(g, C) {
    g.beginPath(); g.arc(0.2, 0, 1.15, -1.15, 1.15); g.lineWidth = 0.16; g.strokeStyle = C.ink; g.stroke(); g.lineWidth = 0.1; g.strokeStyle = '#8a5a30'; g.stroke();
    g.beginPath(); g.moveTo(0.2 + Math.cos(-1.15) * 1.15, Math.sin(-1.15) * 1.15); g.lineTo(-0.3, 0); g.lineTo(0.2 + Math.cos(1.15) * 1.15, Math.sin(1.15) * 1.15); g.lineWidth = 0.03; g.strokeStyle = '#e8e0d0'; g.stroke();
    circ(g, -0.15, 0, 0.8); fillInk(g, body(g, C, -0.15), C);
    g.fillStyle = C.dark; g.beginPath(); g.ellipse(0.1, 0, 0.42, 0.45, 0, 0, TAU); g.fill();
    slit(g, 0.3, -0.13, 0.06, 0.05, '#fff2c0'); slit(g, 0.3, 0.13, 0.06, 0.05, '#fff2c0');
  },
  wartotem(g, C) {
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; g.save(); g.rotate(a); g.beginPath(); g.ellipse(1.0, 0, 0.35, 0.12, 0, 0, TAU); g.fillStyle = i % 2 ? '#e84a3a' : '#f0e0b0'; g.fill(); g.restore(); }
    g.beginPath(); g.roundRect(-0.8, -0.8, 1.6, 1.6, 0.3); fillInk(g, body(g, { ...C, col: '#7a4a2a', light: '#a87048', dark: '#3a200e' }), C, 0.1);
    g.fillStyle = '#f0e6d0'; circ(g, 0, 0, 0.5); g.fill(); ink(g, C, 0.05);
    g.fillStyle = '#1a0a04'; circ(g, -0.18, -0.08, 0.13); g.fill(); circ(g, 0.18, -0.08, 0.13); g.fill(); g.fillRect(-0.15, 0.18, 0.3, 0.1);
    g.fillStyle = C.col; circ(g, -0.18, -0.08, 0.05); glowFill(g, C.col, 10); circ(g, 0.18, -0.08, 0.05); glowFill(g, C.col, 10);
  },
  reaper(g, C) {
    g.beginPath(); g.moveTo(-0.6, 0.9); g.lineTo(0.9, -0.9); g.lineWidth = 0.12; g.strokeStyle = '#4a3a30'; g.stroke();
    g.beginPath(); g.moveTo(0.9, -0.9); g.quadraticCurveTo(1.6, -0.2, 1.1, 0.7); g.quadraticCurveTo(1.25, -0.1, 0.75, -0.75); g.closePath();
    g.fillStyle = '#e8f8f4'; glowFill(g, C.col, 14); ink(g, C, 0.04);
    g.beginPath();
    for (let i = 0; i <= 14; i++) { const a = (i / 14) * TAU; const rr = i % 2 ? 0.8 : 1.05; g.lineTo(Math.cos(a) * rr - 0.15, Math.sin(a) * rr); }
    g.closePath(); fillInk(g, body(g, { ...C, col: '#2a3a38', light: '#4a6a64', dark: '#0a1010' }), C, 0.07);
    g.fillStyle = '#020404'; g.beginPath(); g.ellipse(0.1, 0, 0.38, 0.42, 0, 0, TAU); g.fill();
    slit(g, 0.28, -0.13, 0.07, 0.05, C.col); slit(g, 0.28, 0.13, 0.07, 0.05, C.col);
  },
};
DRAW.slimelet = DRAW.slime;
// ---------------------------------------------------------------- Biom-Gegner
Object.assign(DRAW, {
  gravewarden(g, C) {
    g.beginPath(); g.arc(0.1, 0, 1.25, -1.2, 1.2); g.arc(0.1, 0, 0.85, 1.2, -1.2, true); g.closePath();
    fillInk(g, body(g, { ...C, col: '#6a6a8a', light: '#c8c8e8', dark: '#2a2a40' }, 0.9, 0, 0.6), C, 0.08);
    g.beginPath(); g.roundRect(-0.85, -0.8, 1.5, 1.6, 0.35); fillInk(g, body(g, C), C, 0.09);
    g.fillStyle = C.dark; g.fillRect(-0.55, -0.12, 1.0, 0.24); g.fillRect(-0.12, -0.55, 0.24, 1.0);
    slit(g, 0.35, -0.22, 0.09, 0.05, '#e0d8ff'); slit(g, 0.35, 0.22, 0.09, 0.05, '#e0d8ff');
  },
  moth(g, C) {
    g.save(); g.globalAlpha = 0.85;
    for (const sg of [-1, 1]) { g.beginPath(); g.ellipse(-0.1, sg * 0.75, 0.85, 0.55, sg * 0.5, 0, TAU); g.fillStyle = body(g, C, -0.1, sg * 0.75, 0.8); g.fill(); ink(g, C, 0.05); g.fillStyle = rgba('#ffffff', 0.6); circ(g, -0.2, sg * 0.8, 0.18); g.fill(); }
    g.restore();
    g.beginPath(); g.ellipse(0, 0, 0.75, 0.28, 0, 0, TAU); fillInk(g, C.dark, C, 0.06);
    g.strokeStyle = C.light; g.lineWidth = 0.05; g.beginPath(); g.moveTo(0.6, -0.1); g.quadraticCurveTo(1.1, -0.5, 1.2, -0.3); g.moveTo(0.6, 0.1); g.quadraticCurveTo(1.1, 0.5, 1.2, 0.3); g.stroke();
  },
  cometling(g, C) {
    for (let i = 3; i >= 1; i--) { g.fillStyle = rgba(C.col, 0.18 * i); g.beginPath(); g.ellipse(-0.5 * i, 0, 0.9, 0.55 - i * 0.08, 0, 0, TAU); g.fill(); }
    circ(g, 0, 0, 0.8); g.fillStyle = body(g, { ...C, light: '#ffffff' }); glowFill(g, '#ffc860', 18); ink(g, C, 0.06);
    eye(g, 0.35, -0.2, 0.1, '#5a3a10', '#ffb030'); eye(g, 0.35, 0.2, 0.1, '#5a3a10', '#ffb030');
  },
  bogmaw(g, C) {
    g.beginPath(); for (let i = 0; i <= 18; i++) { const a = (i / 18) * TAU; const rr = 1 + 0.1 * Math.sin(a * 6); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.9); }
    g.closePath(); fillInk(g, body(g, C), C, 0.09);
    g.fillStyle = '#1a0a08'; g.beginPath(); g.ellipse(0.35, 0, 0.45, 0.55, 0, 0, TAU); g.fill();
    g.fillStyle = '#f0e8c8'; for (let i = 0; i < 7; i++) { const a = -1.3 + i * 0.43; P(g, [[0.35 + Math.cos(a) * 0.5, Math.sin(a) * 0.6], [0.35 + Math.cos(a) * 0.3, Math.sin(a) * 0.4], [0.35 + Math.cos(a + 0.2) * 0.5, Math.sin(a + 0.2) * 0.6]]); g.fill(); }
    eye(g, -0.25, -0.45, 0.09, '#ffe060', '#c0ff40'); eye(g, -0.25, 0.45, 0.09, '#ffe060', '#c0ff40');
  },
  swampwitch(g, C) {
    g.beginPath(); for (let i = 0; i <= 14; i++) { const a = (i / 14) * TAU; const rr = i % 2 ? 0.82 : 1.05; g.lineTo(Math.cos(a) * rr - 0.1, Math.sin(a) * rr); }
    g.closePath(); fillInk(g, body(g, { ...C, col: '#3a5a3a', light: '#6a9a5a', dark: '#0a1a0a' }), C, 0.07);
    g.fillStyle = '#2a1a10'; P(g, [[-0.9, 0], [-0.1, -0.55], [0.2, 0], [-0.1, 0.55]]); g.fill();
    circ(g, 0.3, 0, 0.4); fillInk(g, '#a8c890', C, 0.05);
    eye(g, 0.48, -0.14, 0.07, '#ffffff', C.col); eye(g, 0.48, 0.14, 0.07, '#ffffff', C.col);
    g.fillStyle = C.col; circ(g, 0.9, 0.55, 0.16); glowFill(g, C.col, 14);
  },
  willowisp(g, C) {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, C.light); gr.addColorStop(1, rgba(C.col, 0));
    g.fillStyle = gr; circ(g, 0, 0, 1.1); glowFill(g, C.col, 22);
    g.fillStyle = '#ffffff'; circ(g, 0.15, 0, 0.32); g.fill();
    g.fillStyle = '#2a4a10'; circ(g, 0.25, -0.1, 0.07); g.fill(); circ(g, 0.25, 0.1, 0.07); g.fill();
  },
  shardspider(g, C) {
    legs(g, 4, 1.35, { ...C, mid: '#bff3ff' }, 2.4, 0.09);
    P(g, [[0.6, 0], [0, -0.7], [-0.9, -0.4], [-1, 0.3], [-0.2, 0.7]]); fillInk(g, body(g, C), C, 0.06);
    g.fillStyle = rgba('#ffffff', 0.4); P(g, [[0.6, 0], [0, -0.7], [-0.3, 0]]); g.fill();
    eye(g, 0.4, -0.15, 0.08, '#ffffff', C.col); eye(g, 0.4, 0.15, 0.08, '#ffffff', C.col);
  },
  prismward(g, C) {
    for (let i = 0; i < 3; i++) { g.save(); g.rotate((i * TAU) / 3); P(g, [[1.15, 0], [0.4, -0.35], [0.4, 0.35]]); fillInk(g, rgba(C.light, 0.8), C, 0.05); g.restore(); }
    P(g, [[0.7, 0], [0, -0.75], [-0.7, 0], [0, 0.75]]); g.fillStyle = body(g, C); glowFill(g, C.col, 16); ink(g, C, 0.06);
    const gr = g.createLinearGradient(-0.4, -0.4, 0.4, 0.4); gr.addColorStop(0, '#ff8af0'); gr.addColorStop(0.5, '#8af0ff'); gr.addColorStop(1, '#fff08a');
    g.fillStyle = gr; circ(g, 0.1, 0, 0.28); g.fill();
  },
  facetcolossus(g, C) {
    const facets = [[0, -1], [0.85, -0.5], [0.85, 0.5], [0, 1], [-0.85, 0.5], [-0.85, -0.5]];
    P(g, facets); fillInk(g, body(g, C), C, 0.08);
    for (let i = 0; i < 6; i++) { const [a, b] = facets[i], [c2, d2] = facets[(i + 1) % 6]; P(g, [[0, 0], [a, b], [c2, d2]]); g.fillStyle = rgba(i % 2 ? '#ffffff' : C.dark, i % 2 ? 0.25 : 0.3); g.fill(); }
    g.strokeStyle = rgba('#ffffff', 0.5); g.lineWidth = 0.04; for (const [a, b] of facets) { g.beginPath(); g.moveTo(0, 0); g.lineTo(a, b); g.stroke(); }
    eye(g, 0.3, -0.18, 0.11, '#e8fbff', C.col); eye(g, 0.3, 0.18, 0.11, '#e8fbff', C.col);
  },
  slagworm(g, C) {
    for (let i = 3; i >= 0; i--) { const x = -i * 0.5; circ(g, x, Math.sin(i * 1.3) * 0.15, 0.62 - i * 0.08); fillInk(g, body(g, { ...C, col: i % 2 ? '#8a3a1a' : C.col }, x, 0, 0.6), C, 0.06); }
    g.strokeStyle = '#ffd080'; g.lineWidth = 0.06; g.shadowColor = '#ff8a2a'; g.shadowBlur = 10;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-i * 0.5, 0, 0.45, 1, 2); g.stroke(); }
    g.shadowBlur = 0;
    g.fillStyle = '#1a0806'; circ(g, 0.45, 0, 0.28); g.fill();
    g.fillStyle = '#ffb040'; circ(g, 0.45, 0, 0.14); glowFill(g, '#ff7a2a', 12);
  },
  forgeheart(g, C) {
    g.beginPath(); g.roundRect(-1, -1, 2, 2, 0.3); fillInk(g, body(g, { ...C, col: '#4a3a3a', light: '#7a6a6a', dark: '#1a1010' }), C, 0.1);
    for (const [x, y] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) { g.fillStyle = '#2a1a1a'; g.fillRect(x - 0.18, y - 0.18, 0.36, 0.36); }
    circ(g, 0, 0, 0.6); g.fillStyle = '#1a0806'; g.fill();
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 0.55); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, '#ffd060'); gr.addColorStop(1, '#ff4a10');
    g.fillStyle = gr; circ(g, 0, 0, 0.5); glowFill(g, '#ff6a1a', 26);
  },
  anvilknight(g, C) {
    g.fillStyle = '#5a5a6a'; g.beginPath(); g.roundRect(0.4, -1.1, 0.9, 0.7, 0.15); g.fill(); ink(g, C, 0.06);
    g.beginPath(); g.moveTo(0.85, -0.4); g.lineTo(0.85, 0.2); g.lineWidth = 0.18; g.strokeStyle = '#4a3020'; g.stroke();
    circ(g, -0.1, 0, 0.85); fillInk(g, body(g, { ...C, col: '#8a8a9a', light: '#d8d8e8', dark: '#3a3a4a' }), C, 0.09);
    g.fillStyle = C.col; g.fillRect(-0.7, -0.15, 1.2, 0.3);
    slit(g, 0.45, -0.14, 0.12, 0.04, '#ff8a3a'); slit(g, 0.45, 0.14, 0.12, 0.04, '#ff8a3a');
  },
  voideye(g, C) {
    g.strokeStyle = rgba(C.col, 0.7); g.lineWidth = 0.1;
    for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6; g.beginPath(); g.moveTo(Math.cos(a) * 0.8, Math.sin(a) * 0.8); g.quadraticCurveTo(Math.cos(a + 0.4) * 1.3, Math.sin(a + 0.4) * 1.3, Math.cos(a + 0.2) * 1.6, Math.sin(a + 0.2) * 1.6); g.stroke(); }
    circ(g, 0, 0, 0.9); fillInk(g, '#1a0a24', C, 0.08);
    g.fillStyle = '#f8f0ff'; g.beginPath(); g.ellipse(0.15, 0, 0.6, 0.45, 0, 0, TAU); g.fill();
    g.fillStyle = C.col; circ(g, 0.3, 0, 0.3); glowFill(g, C.col, 16);
    g.fillStyle = '#000'; g.beginPath(); g.ellipse(0.32, 0, 0.08, 0.26, 0, 0, TAU); g.fill();
  },
  twinshade(g, C) {
    g.beginPath(); g.moveTo(1, 0); g.bezierCurveTo(0.9, -0.9, -0.5, -0.9, -1.2, -0.3); g.lineTo(-0.9, 0); g.lineTo(-1.2, 0.3); g.bezierCurveTo(-0.5, 0.9, 0.9, 0.9, 1, 0);
    g.fillStyle = body(g, C); glowFill(g, C.col, 14); ink(g, C, 0.06);
    g.strokeStyle = '#d0b0ff'; g.lineWidth = 0.08; circ(g, 0.1, 0, 0.42); g.stroke();
    slit(g, 0.45, -0.18, 0.1, 0.06, '#f0e0ff'); slit(g, 0.45, 0.18, 0.1, 0.06, '#f0e0ff');
  },
  nullwalker(g, C) {
    g.save(); g.globalAlpha = 0.5;
    g.fillStyle = C.col; circ(g, -0.35, 0, 0.9); g.fill(); g.restore();
    circ(g, 0.1, 0, 0.85); fillInk(g, body(g, { ...C, col: '#2a2440', light: '#6a5a90', dark: '#05030a' }), C, 0.06);
    g.strokeStyle = C.light; g.lineWidth = 0.06; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0.1, 0, 0.3 + i * 0.18, -0.8, 0.8); g.stroke(); }
    eye(g, 0.5, 0, 0.14, '#ffffff', C.col);
  },
  stormhawk(g, C) {
    for (const sg of [-1, 1]) { P(g, [[0.2, 0], [-0.4, sg * 1.3], [-0.9, sg * 1.1], [-0.4, sg * 0.3]]); fillInk(g, body(g, { ...C, col: '#c8a850' }, -0.4, sg * 0.8, 0.7), C, 0.06); }
    g.beginPath(); g.ellipse(0, 0, 0.9, 0.38, 0, 0, TAU); fillInk(g, body(g, C), C, 0.06);
    P(g, [[0.85, -0.12], [1.3, 0], [0.85, 0.12]]); g.fillStyle = '#f0c040'; g.fill();
    eye(g, 0.55, -0.15, 0.07, '#ffffff', '#ffe34d'); eye(g, 0.55, 0.15, 0.07, '#ffffff', '#ffe34d');
  },
  thundershaman(g, C) {
    for (let i = 0; i < 5; i++) { const a = Math.PI + (i - 2) * 0.35; g.save(); g.rotate(a); g.beginPath(); g.ellipse(0.95, 0, 0.32, 0.1, 0, 0, TAU); g.fillStyle = i % 2 ? '#e84a3a' : '#f0e0b0'; g.fill(); g.restore(); }
    circ(g, 0, 0, 0.85); fillInk(g, body(g, { ...C, col: '#6a5a8a', light: '#a89ac8', dark: '#2a2040' }), C, 0.07);
    g.beginPath(); g.moveTo(-0.2, 0.9); g.lineTo(1.2, -0.6); g.lineWidth = 0.12; g.strokeStyle = '#8a6a40'; g.stroke();
    g.fillStyle = '#fff6b0'; circ(g, 1.2, -0.6, 0.2); glowFill(g, '#ffe34d', 18);
    eye(g, 0.4, -0.18, 0.08, '#ffe34d', '#ffe34d'); eye(g, 0.4, 0.18, 0.08, '#ffe34d', '#ffe34d');
  },
  avalanche(g, C) {
    const pts = []; for (let i = 0; i < 9; i++) { const a = (i * TAU) / 9; const rr = 1 + 0.12 * Math.sin(i * 2.7); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    P(g, pts); fillInk(g, body(g, { ...C, col: '#9aa0a8', light: '#e0e8f0', dark: '#3a4048' }), C, 0.1);
    g.fillStyle = '#ffffff'; P(g, [[-0.6, -0.8], [0, -1.02], [0.5, -0.85], [0.1, -0.55], [-0.4, -0.55]]); g.fill();
    g.strokeStyle = rgba('#2a3038', 0.7); g.lineWidth = 0.06; g.beginPath(); g.moveTo(-0.6, 0.2); g.lineTo(-0.1, 0.4); g.lineTo(0.2, 0.1); g.moveTo(0, 0.6); g.lineTo(0.4, 0.5); g.stroke();
    eye(g, 0.5, -0.2, 0.1, '#bff3ff', '#62d6ff'); eye(g, 0.5, 0.2, 0.1, '#bff3ff', '#62d6ff');
  },
  emberwolf(g, C) {
    legs(g, 2, 0.95, { ...C, mid: '#5a2a1a' }, 2.2, 0.14);
    g.beginPath(); g.ellipse(-0.1, 0, 0.95, 0.55, 0, 0, TAU); fillInk(g, body(g, { ...C, col: '#5a3a2a', light: '#8a5a3a', dark: '#1a0a06' }), C, 0.07);
    g.strokeStyle = '#ffb040'; g.lineWidth = 0.07; g.shadowColor = '#ff7a2a'; g.shadowBlur = 10;
    g.beginPath(); g.moveTo(-0.8, -0.2); g.lineTo(-0.3, -0.1); g.lineTo(0.1, -0.3); g.moveTo(-0.6, 0.25); g.lineTo(-0.1, 0.15); g.stroke(); g.shadowBlur = 0;
    P(g, [[0.6, -0.3], [1.25, 0], [0.6, 0.3]]); fillInk(g, '#4a2a1a', C, 0.05);
    P(g, [[0.55, -0.3], [0.7, -0.7], [0.85, -0.25]]); g.fillStyle = '#3a1a0a'; g.fill();
    eye(g, 0.85, -0.12, 0.07, '#ffd060', '#ff7a2a'); eye(g, 0.85, 0.12, 0.07, '#ffd060', '#ff7a2a');
  },
  ashtree(g, C) {
    g.strokeStyle = '#2a1a10'; g.lineCap = 'round';
    for (let i = 0; i < 7; i++) { const a = (i * TAU) / 7; g.lineWidth = 0.18; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Math.cos(a + 0.4) * 0.8, Math.sin(a + 0.4) * 0.8, Math.cos(a) * 1.3, Math.sin(a) * 1.3); g.stroke(); }
    circ(g, 0, 0, 0.75); fillInk(g, body(g, { ...C, col: '#4a3a30', light: '#7a6a5a', dark: '#1a120c' }), C, 0.08);
    g.strokeStyle = '#ff7a2a'; g.lineWidth = 0.06; g.shadowColor = '#ff7a2a'; g.shadowBlur = 12;
    g.beginPath(); g.arc(0, 0, 0.35, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(-0.5, 0.2); g.lineTo(-0.1, 0); g.lineTo(0.3, 0.35); g.stroke(); g.shadowBlur = 0;
  },
  charred(g, C) {
    circ(g, -0.1, 0, 0.85); fillInk(g, body(g, { ...C, col: '#3a2a24', light: '#6a5048', dark: '#0a0604' }), C, 0.08);
    g.strokeStyle = '#ff8a3a'; g.lineWidth = 0.07; g.shadowColor = '#ff5a10'; g.shadowBlur = 12;
    g.beginPath(); g.moveTo(-0.6, -0.4); g.lineTo(-0.2, -0.1); g.lineTo(-0.4, 0.3); g.moveTo(0.1, -0.5); g.lineTo(0.2, -0.1); g.stroke(); g.shadowBlur = 0;
    eye(g, 0.4, -0.2, 0.1, '#ffd060', '#ff5a10'); eye(g, 0.4, 0.2, 0.1, '#ffd060', '#ff5a10');
  },
  mirrorling(g, C) {
    P(g, [[1, 0], [0.3, -0.8], [-0.8, -0.6], [-1, 0], [-0.8, 0.6], [0.3, 0.8]]);
    const gr = g.createLinearGradient(-1, -1, 1, 1); gr.addColorStop(0, '#8aa0d0'); gr.addColorStop(0.45, '#ffffff'); gr.addColorStop(0.55, '#c8d8f8'); gr.addColorStop(1, '#5a70a0');
    g.fillStyle = gr; glowFill(g, C.col, 10); ink(g, C, 0.06);
    g.strokeStyle = rgba('#ffffff', 0.7); g.lineWidth = 0.04; g.beginPath(); g.moveTo(-0.6, -0.5); g.lineTo(0.5, 0.5); g.stroke();
    slit(g, 0.4, -0.2, 0.09, 0.05, '#2a3a6a'); slit(g, 0.4, 0.2, 0.09, 0.05, '#2a3a6a');
  },
  lightbreaker(g, C) {
    circ(g, 0, 0, 0.8); fillInk(g, body(g, { ...C, col: '#8a7a40', light: '#e8d890', dark: '#3a3010' }), C, 0.07);
    g.fillStyle = '#fffbe0'; P(g, [[0.4, 0], [1.4, -0.25], [1.5, 0], [1.4, 0.25]]); glowFill(g, '#ffe34d', 16);
    g.fillStyle = '#ffffff'; circ(g, 0.15, 0, 0.3); glowFill(g, '#fff6c0', 18);
  },
  shardwarden(g, C) {
    for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; g.save(); g.rotate(a); P(g, [[1.25, 0], [0.75, -0.15], [0.75, 0.15]]); fillInk(g, '#d8e8ff', C, 0.04); g.restore(); }
    circ(g, 0, 0, 0.82); fillInk(g, body(g, C), C, 0.08);
    g.fillStyle = C.dark; circ(g, 0.15, 0, 0.42); g.fill();
    eye(g, 0.2, 0, 0.16, '#ffffff', C.col);
  },
  souljelly(g, C) {
    g.save(); g.globalAlpha = 0.85;
    const gr = g.createRadialGradient(-0.2, -0.2, 0.05, 0, 0, 1.1); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, rgba(C.col, 0.7)); gr.addColorStop(1, rgba(C.dark, 0.5));
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); glowFill(g, C.col, 20); g.restore();
    g.strokeStyle = rgba(C.light, 0.7); g.lineWidth = 0.06;
    for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; g.beginPath(); g.moveTo(Math.cos(a) * 0.95, Math.sin(a) * 0.95); g.quadraticCurveTo(Math.cos(a + 0.3) * 1.3, Math.sin(a + 0.3) * 1.3, Math.cos(a) * 1.55, Math.sin(a) * 1.55); g.stroke(); }
    g.fillStyle = '#ffffff'; circ(g, 0, 0, 0.25); glowFill(g, '#ffffff', 12);
  },
  deepcaller(g, C) {
    g.strokeStyle = C.mid; g.lineWidth = 0.16; g.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const a = Math.PI + (i - 2.5) * 0.35; g.beginPath(); g.moveTo(Math.cos(a) * 0.6, Math.sin(a) * 0.6); g.quadraticCurveTo(Math.cos(a) * 1.1 + Math.sin(i) * 0.2, Math.sin(a) * 1.1, Math.cos(a + 0.3) * 1.5, Math.sin(a + 0.3) * 1.5); g.stroke(); }
    g.beginPath(); g.ellipse(0.1, 0, 0.9, 0.75, 0, 0, TAU); fillInk(g, body(g, C), C, 0.08);
    eye(g, 0.5, -0.25, 0.12, '#f0fff8', C.col); eye(g, 0.5, 0.25, 0.12, '#f0fff8', C.col); eye(g, 0.75, 0, 0.08, '#f0fff8', C.col);
  },
  drowned(g, C) {
    circ(g, -0.1, 0, 0.85); fillInk(g, body(g, { ...C, col: '#4a6a7a', light: '#8ab0c0', dark: '#1a2a34' }), C, 0.07);
    g.strokeStyle = '#2a6a5a'; g.lineWidth = 0.08; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-0.6 + i * 0.25, -0.6); g.quadraticCurveTo(-0.7 + i * 0.25, 0, -0.5 + i * 0.25, 0.7); g.stroke(); }
    g.fillStyle = '#0a1418'; g.beginPath(); g.ellipse(0.35, 0, 0.32, 0.38, 0, 0, TAU); g.fill();
    slit(g, 0.45, -0.13, 0.07, 0.05, '#8fe4ff'); slit(g, 0.45, 0.13, 0.07, 0.05, '#8fe4ff');
  },
  bosscrystal(g, C) {
    P(g, [[0, -1.3], [0.7, -0.3], [0.5, 1], [-0.5, 1], [-0.7, -0.3]]);
    const gr = g.createLinearGradient(-0.7, -1.3, 0.7, 1); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#9fe7ff'); gr.addColorStop(1, '#2a6a9a');
    g.fillStyle = gr; glowFill(g, '#9fe7ff', 24); ink(g, C, 0.05);
    g.fillStyle = rgba('#ffffff', 0.5); P(g, [[0, -1.3], [0.7, -0.3], [0, 0]]); g.fill();
  },
  soulanchor(g, C) {
    g.strokeStyle = '#ff8ad8'; g.lineWidth = 0.12; g.shadowColor = '#ff5ac8'; g.shadowBlur = 16;
    circ(g, 0, 0, 1); g.stroke(); circ(g, 0, 0, 0.6); g.stroke(); g.shadowBlur = 0;
    g.fillStyle = '#ffffff'; circ(g, 0, 0, 0.3); glowFill(g, '#ff8ad8', 20);
    for (let i = 0; i < 4; i++) { const a = (i * TAU) / 4; g.fillStyle = '#ff8ad8'; circ(g, Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0.14); g.fill(); }
  },
});
const DIRECTIONAL = new Set(['runner', 'mite', 'charger', 'brute', 'shielder', 'sniper', 'leaper', 'minelayer', 'swarm', 'lurker', 'moloch', 'archer', 'reaper', 'wraith', 'shade', 'seer', 'priest', 'blinker',
  'gravewarden', 'moth', 'cometling', 'bogmaw', 'swampwitch', 'shardspider', 'prismward', 'slagworm', 'anvilknight', 'voideye', 'twinshade', 'nullwalker', 'stormhawk', 'thundershaman', 'avalanche', 'emberwolf', 'charred', 'mirrorling', 'lightbreaker', 'deepcaller', 'drowned']);
const BLOBBY = new Set(['slime', 'slimelet', 'bomber', 'shade', 'phantom', 'nest', 'splitter', 'willowisp', 'souljelly', 'bogmaw', 'ashtree', 'forgeheart']);
export const isDirectional = (id) => DIRECTIONAL.has(id);
export const isBlobby = (id) => BLOBBY.has(id);

const sprCache = new Map();
const PAD = 1.9; // Sprite-Ausdehnung in Radien (Hälfte)
/** Vorgerendertes Gegner-Sprite. Liefert { c, h } mit h = halbe Größe in Radien. */
export function enemySprite(id, color, r, variant = '') {
  const rr = Math.max(4, Math.round(r));
  const key = `${id}|${color}|${rr}|${variant}`;
  let s = sprCache.get(key);
  if (s) return s;
  const px = Math.ceil(rr * PAD * 2 * SPR);
  const c = mk(px);
  const g = c.getContext('2d');
  g.translate(px / 2, px / 2);
  g.scale(rr * SPR, rr * SPR);
  const C = { col: color, light: shade(color, 0.45), mid: shade(color, -0.2), dark: shade(color, -0.65), ink: '#08050e' };
  (DRAW[id] || DRAW_GENERIC)(g, C);
  s = { c, h: PAD };
  if (!variant) sprCache.set(key, s);
  // Weiße Treffer-Silhouette
  const f = mk(px);
  const fg = f.getContext('2d');
  fg.drawImage(c, 0, 0); fg.globalCompositeOperation = 'source-atop'; fg.fillStyle = '#ffffff'; fg.fillRect(0, 0, px, px);
  s.flash = f;
  sprCache.set(key, s);
  return s;
}
const tintCache = new WeakMap();
export function tinted(spr, color, a = 0.55) {
  const key = spr.c.width + '|' + color + '|' + a;
  let m = tintCache.get(spr);
  if (!m) { m = new Map(); tintCache.set(spr, m); }
  let t = m.get(key);
  if (t) return t;
  t = mk(spr.c.width);
  const g = t.getContext('2d');
  g.drawImage(spr.c, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = rgba(color, a); g.fillRect(0, 0, t.width, t.height);
  m.set(key, t);
  return t;
}
function DRAW_GENERIC(g, C) {
  circ(g, 0, 0, 1); fillInk(g, body(g, C), C);
  eye(g, 0.4, -0.25, 0.12, '#fff', C.light); eye(g, 0.4, 0.25, 0.12, '#fff', C.light);
}

// ---------------------------------------------------------------- Bosse
/** Bossrumpf (ohne die rotierenden Teile), deterministisch aus der ID erzeugt. */
export function bossSprite(id, color, r) {
  const rr = Math.round(r);
  const key = `boss|${id}|${color}|${rr}`;
  let s = sprCache.get(key);
  if (s) return s;
  let seed = 7;
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rng = makeRng(seed);
  const px = Math.ceil(rr * 2.4 * 2 * SPR);
  const c = mk(px);
  const g = c.getContext('2d');
  g.translate(px / 2, px / 2); g.scale(rr * SPR, rr * SPR);
  const C = { col: color, light: shade(color, 0.5), mid: shade(color, -0.25), dark: shade(color, -0.7), ink: '#06030a' };
  // Corona aus Stacheln
  const n = rng.int(9, 15), spk = rng.range(1.35, 1.7);
  g.save(); g.shadowColor = color; g.shadowBlur = 30;
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n, l = i % 2 ? spk : spk * 0.82;
    P(g, [[Math.cos(a - 0.22) * 0.85, Math.sin(a - 0.22) * 0.85], [Math.cos(a) * l, Math.sin(a) * l], [Math.cos(a + 0.22) * 0.85, Math.sin(a + 0.22) * 0.85]]);
    const gr = g.createLinearGradient(0, 0, Math.cos(a) * l, Math.sin(a) * l); gr.addColorStop(0.5, C.mid); gr.addColorStop(1, C.light);
    g.fillStyle = gr; g.fill();
  }
  g.restore();
  for (let i = 0; i < n; i++) { const a = (i * TAU) / n; g.beginPath(); g.moveTo(Math.cos(a) * 0.9, Math.sin(a) * 0.9); g.lineTo(Math.cos(a) * (i % 2 ? spk : spk * 0.82), Math.sin(a) * (i % 2 ? spk : spk * 0.82)); g.lineWidth = 0.03; g.strokeStyle = rgba('#ffffff', 0.35); g.stroke(); }
  // Panzerring
  const plates = rng.int(6, 10);
  for (let i = 0; i < plates; i++) {
    const a0 = (i * TAU) / plates + 0.05, a1 = ((i + 1) * TAU) / plates - 0.05;
    g.beginPath(); g.arc(0, 0, 1.08, a0, a1); g.arc(0, 0, 0.72, a1, a0, true); g.closePath();
    fillInk(g, body(g, { ...C, col: mix(color, '#2a2440', 0.55), light: mix(C.light, '#8a84a0', 0.4) }), C, 0.05);
    g.fillStyle = rgba(C.light, 0.8); circ(g, Math.cos((a0 + a1) / 2) * 0.9, Math.sin((a0 + a1) / 2) * 0.9, 0.045); g.fill();
  }
  // Kern
  circ(g, 0, 0, 0.72); g.fillStyle = body(g, { ...C, dark: '#0a0610' }, 0, 0, 0.72); g.fill(); ink(g, C, 0.06);
  const style = rng.int(0, 2);
  if (style === 0) { // großes Auge
    g.fillStyle = '#f8f0ff'; g.beginPath(); g.ellipse(0, 0, 0.5, 0.32, 0, 0, TAU); g.fill();
    const ir = g.createRadialGradient(0, 0, 0, 0, 0, 0.28); ir.addColorStop(0, C.light); ir.addColorStop(1, color);
    g.fillStyle = ir; circ(g, 0, 0, 0.27); glowFill(g, color, 24);
    g.fillStyle = '#000'; g.beginPath(); g.ellipse(0, 0, 0.07, 0.22, 0, 0, TAU); g.fill();
  } else if (style === 1) { // Krone + zwei Augen
    for (let i = 0; i < 5; i++) { const x = -0.4 + i * 0.2; P(g, [[x - 0.08, -0.25], [x, -0.55 - (i === 2 ? 0.12 : 0)], [x + 0.08, -0.25]]); fillInk(g, '#ffd84d', C, 0.03); }
    eye(g, -0.2, 0.08, 0.11, '#ffffff', color); eye(g, 0.2, 0.08, 0.11, '#ffffff', color);
  } else { // Runenkern
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 0.5); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, C.light); gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr; circ(g, 0, 0, 0.5); glowFill(g, color, 30);
    g.strokeStyle = '#1a0a20'; g.lineWidth = 0.05;
    P(g, [[0, -0.32], [0.28, 0.16], [-0.28, 0.16]]); g.stroke(); circ(g, 0, 0, 0.36); g.stroke();
  }
  s = { c, h: 2.4 };
  const f = mk(px); const fg = f.getContext('2d');
  fg.drawImage(c, 0, 0); fg.globalCompositeOperation = 'source-atop'; fg.fillStyle = '#ffffff'; fg.fillRect(0, 0, px, px);
  s.flash = f;
  sprCache.set(key, s);
  return s;
}

// ---------------------------------------------------------------- Runenkreise
const runeCache = new Map();
/** Kreis mit Runenzeichen – unter dem Spieler, um Elite/Bosse, als Arenarand. */
export function runeCircle(color, size = 128, n = 12, seed = 1) {
  const key = `${color}|${size}|${n}|${seed}`;
  let c = runeCache.get(key);
  if (c) return c;
  c = mk(size);
  const g = c.getContext('2d');
  const R = size / 2, rng = makeRng(seed);
  g.translate(R, R);
  g.strokeStyle = color; g.shadowColor = color; g.shadowBlur = size / 24;
  g.lineWidth = size / 110; circ(g, 0, 0, R * 0.94); g.stroke();
  g.lineWidth = size / 220; circ(g, 0, 0, R * 0.78); g.stroke();
  g.lineWidth = size / 160;
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n;
    g.save(); g.rotate(a); g.translate(R * 0.86, 0); g.rotate(Math.PI / 2);
    const s = R * 0.055;
    g.beginPath();
    const k = rng.int(0, 5);
    g.moveTo(0, -s); g.lineTo(0, s);
    if (k === 0) { g.moveTo(0, -s * 0.4); g.lineTo(s * 0.8, -s); }
    else if (k === 1) { g.moveTo(0, -s); g.lineTo(s * 0.8, 0); g.lineTo(0, s * 0.2); }
    else if (k === 2) { g.moveTo(-s * 0.7, -s * 0.5); g.lineTo(s * 0.7, s * 0.5); }
    else if (k === 3) { g.moveTo(0, -s * 0.2); g.lineTo(s * 0.7, -s * 0.7); g.moveTo(0, s * 0.3); g.lineTo(s * 0.7, -s * 0.2); }
    else if (k === 4) { g.moveTo(-s * 0.7, -s); g.lineTo(s * 0.7, s * 0.2); }
    else { g.moveTo(s * 0.6, -s); g.lineTo(-s * 0.6, 0); g.lineTo(s * 0.6, s); }
    g.stroke(); g.restore();
  }
  // Innere Sternlinien
  g.lineWidth = size / 300; g.globalAlpha = 0.6;
  const m = 5;
  g.beginPath();
  for (let i = 0; i <= m; i++) { const a = (i * 2 * TAU) / m - Math.PI / 2; const x = Math.cos(a) * R * 0.76, y = Math.sin(a) * R * 0.76; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  runeCache.set(key, c);
  return c;
}

// ---------------------------------------------------------------- Spieler
const playerCache = new Map();
export function playerSprite(color, r) {
  const key = color + '|' + r;
  let s = playerCache.get(key);
  if (s) return s;
  const px = Math.ceil(r * 2 * 2 * SPR);
  const c = mk(px); const g = c.getContext('2d');
  g.translate(px / 2, px / 2); g.scale(r * SPR, r * SPR);
  const C = { col: color, light: shade(color, 0.5), mid: shade(color, -0.2), dark: shade(color, -0.7), ink: '#05030a' };
  // Umhang (nach hinten ausgestellt)
  g.beginPath(); g.moveTo(0.4, -0.85);
  g.quadraticCurveTo(-0.6, -1.25, -1.5, -0.65); g.lineTo(-1.25, -0.2); g.lineTo(-1.6, 0); g.lineTo(-1.25, 0.2); g.lineTo(-1.5, 0.65);
  g.quadraticCurveTo(-0.6, 1.25, 0.4, 0.85); g.closePath();
  const cg = g.createLinearGradient(-1.5, 0, 0.5, 0); cg.addColorStop(0, C.dark); cg.addColorStop(1, C.mid);
  fillInk(g, cg, C, 0.09);
  g.strokeStyle = rgba(C.light, 0.6); g.lineWidth = 0.05; g.beginPath(); g.moveTo(0.3, -0.75); g.quadraticCurveTo(-0.6, -1.12, -1.4, -0.6); g.stroke();
  g.beginPath(); g.moveTo(0.3, 0.75); g.quadraticCurveTo(-0.6, 1.12, -1.4, 0.6); g.stroke();
  // Schultern
  for (const s2 of [-1, 1]) { g.beginPath(); g.ellipse(0.05, s2 * 0.62, 0.38, 0.28, 0, 0, TAU); fillInk(g, body(g, { ...C, col: '#c9c0e0', light: '#ffffff', dark: '#5a5070' }, 0.05, s2 * 0.62, 0.35), C, 0.06); }
  // Kapuze
  circ(g, 0.05, 0, 0.6); fillInk(g, body(g, C, 0.05, 0, 0.6), C, 0.08);
  g.fillStyle = '#05030a'; g.beginPath(); g.ellipse(0.32, 0, 0.26, 0.3, 0, 0, TAU); g.fill();
  slit(g, 0.42, -0.1, 0.05, 0.035, '#ffe8a0'); slit(g, 0.42, 0.1, 0.05, 0.035, '#ffe8a0');
  // Stab mit Kristall
  g.beginPath(); g.moveTo(-0.3, 0.75); g.lineTo(1.25, 0.55); g.lineWidth = 0.13; g.strokeStyle = C.ink; g.stroke(); g.lineWidth = 0.08; g.strokeStyle = '#a07850'; g.stroke();
  P(g, [[1.5, 0.52], [1.3, 0.38], [1.12, 0.55], [1.3, 0.7]]); g.fillStyle = '#ffffff'; glowFill(g, color, 20); ink(g, C, 0.04);
  s = { c, h: 2 };
  playerCache.set(key, s);
  return s;
}

// ---------------------------------------------------------------- Biom-Böden
export const BIOME_FX = {
  sternengrab: { deco: 'stone', amb: 'motes', ambCol: '#b9a4ff', dark: 0.42, fog: '#4a2a8a' },
  nebelmoor: { deco: 'moss', amb: 'spores', ambCol: '#9cff5e', dark: 0.5, fog: '#2a5a3a' },
  kristall: { deco: 'crystal', amb: 'glints', ambCol: '#9fe7ff', dark: 0.38, fog: '#1a4a8a' },
  glutschmiede: { deco: 'lava', amb: 'embers', ambCol: '#ff8a3a', dark: 0.5, fog: '#8a2a0a' },
  leere: { deco: 'void', amb: 'motes', ambCol: '#d08bff', dark: 0.55, fog: '#5a1a7a' },
  sturmgipfel: { deco: 'rock', amb: 'snow', ambCol: '#e8f4ff', dark: 0.4, fog: '#2a3a6a' },
  aschewald: { deco: 'ash', amb: 'embers', ambCol: '#ffa050', dark: 0.48, fog: '#5a2a10' },
  spiegel: { deco: 'mirror', amb: 'glints', ambCol: '#c8d8ff', dark: 0.36, fog: '#2a3a7a' },
  seelenmeer: { deco: 'water', amb: 'spores', ambCol: '#8affd8', dark: 0.46, fog: '#0a4a4a' },
};
const TILE = 512;
const floorCache = new Map();
function wrap(fn, x, y, r) {
  for (const dx of [-TILE, 0, TILE]) for (const dy of [-TILE, 0, TILE]) {
    if (x + dx + r < 0 || x + dx - r > TILE || y + dy + r < 0 || y + dy - r > TILE) continue;
    fn(x + dx, y + dy);
  }
}
/** Nahtlos kachelbare Bodentextur pro Biom. */
export function floorTile(biome, base, fog = null) {
  const key = biome + base;
  let c = floorCache.get(key);
  if (c) return c;
  const st = BIOME_FX[biome] || BIOME_FX.sternengrab;
  c = mk(TILE);
  const g = c.getContext('2d');
  let seed = 3;
  for (const ch of key) seed = (seed * 33 + ch.charCodeAt(0)) >>> 0;
  const rng = makeRng(seed);
  g.fillStyle = base; g.fillRect(0, 0, TILE, TILE);
  // Wolkiges Rauschen
  for (let i = 0; i < 260; i++) {
    const x = rng.range(0, TILE), y = rng.range(0, TILE), r = rng.range(20, 110);
    const light = rng.next() < 0.45;
    const a = rng.range(0.03, 0.09);
    wrap((X, Y) => {
      const gr = g.createRadialGradient(X, Y, 0, X, Y, r);
      gr.addColorStop(0, light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 1.6})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(X - r, Y - r, r * 2, r * 2);
    }, x, y, r);
  }
  if (fog) for (let i = 0; i < 5; i++) {
    const x = rng.range(0, TILE), y = rng.range(0, TILE), r = rng.range(110, 190);
    wrap((X, Y) => { const gr = g.createRadialGradient(X, Y, 0, X, Y, r); gr.addColorStop(0, rgba(fog, 0.22)); gr.addColorStop(1, rgba(fog, 0)); g.fillStyle = gr; g.fillRect(X - r, Y - r, r * 2, r * 2); }, x, y, r);
  }
  const lite = shade(base, 0.35), dark = shade(base, -0.55), acc = st.ambCol;
  const line = (pts, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
  const crack = (x, y, len, col, w, glow) => {
    const pts = [[x, y]]; let a = rng.range(0, TAU);
    for (let i = 0; i < 6; i++) { a += rng.range(-0.7, 0.7); const l = len / 6; pts.push([pts[i][0] + Math.cos(a) * l, pts[i][1] + Math.sin(a) * l]); }
    wrap((X, Y) => {
      const off = pts.map(([px, py]) => [px - x + X, py - y + Y]);
      if (glow) { g.save(); g.shadowColor = glow; g.shadowBlur = 12; line(off, col, w); g.restore(); line(off, '#fff2c0', w * 0.35); }
      else line(off, col, w);
    }, x, y, len);
  };
  if (st.deco === 'stone' || st.deco === 'rock' || st.deco === 'mirror') {
    // Steinplatten in einem verschobenen Raster
    const n = st.deco === 'mirror' ? 8 : 4, s = TILE / n;
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
      const ox = (iy % 2) * s * (st.deco === 'mirror' ? 0 : 0.5);
      const x = ix * s + ox, y = iy * s;
      wrap((X, Y) => {
        g.fillStyle = rgba(rng.next() < 0.5 ? lite : dark, rng.range(0.05, 0.16)); g.fillRect(X + 3, Y + 3, s - 6, s - 6);
        g.strokeStyle = rgba(dark, 0.8); g.lineWidth = st.deco === 'mirror' ? 2 : 4; g.strokeRect(X + 2, Y + 2, s - 4, s - 4);
        g.strokeStyle = rgba(lite, st.deco === 'mirror' ? 0.35 : 0.15); g.lineWidth = 1.5; g.beginPath(); g.moveTo(X + 4, Y + s - 4); g.lineTo(X + 4, Y + 4); g.lineTo(X + s - 4, Y + 4); g.stroke();
      }, x + s / 2, y + s / 2, s);
    }
    for (let i = 0; i < 14; i++) crack(rng.range(0, TILE), rng.range(0, TILE), rng.range(30, 90), rgba(dark, 0.9), 2.5);
    if (st.deco === 'rock') for (let i = 0; i < 6; i++) { const x = rng.range(0, TILE), y = rng.range(0, TILE), r = rng.range(20, 50); wrap((X, Y) => { const gr = g.createRadialGradient(X, Y, 0, X, Y, r); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(X - r, Y - r, 2 * r, 2 * r); }, x, y, r); }
  }
  if (st.deco === 'moss' || st.deco === 'water') {
    for (let i = 0; i < 12; i++) {
      const x = rng.range(0, TILE), y = rng.range(0, TILE), r = rng.range(25, 70);
      wrap((X, Y) => {
        g.fillStyle = rgba(st.deco === 'water' ? '#04141a' : '#0a1810', 0.55); g.beginPath(); g.ellipse(X, Y, r, r * 0.7, 0, 0, TAU); g.fill();
        g.strokeStyle = rgba(acc, 0.22); g.lineWidth = 2; g.beginPath(); g.ellipse(X, Y, r * 0.98, r * 0.68, 0, 3.6, 5.6); g.stroke();
        if (st.deco === 'water') { g.strokeStyle = rgba(acc, 0.12); g.beginPath(); g.ellipse(X, Y, r * 0.6, r * 0.4, 0, 0, TAU); g.stroke(); }
      }, x, y, r);
    }
    for (let i = 0; i < 260; i++) { const x = rng.range(0, TILE), y = rng.range(0, TILE); g.fillStyle = rgba(rng.next() < 0.5 ? acc : lite, rng.range(0.08, 0.25)); g.fillRect(x, y, rng.range(1, 3), rng.range(3, 7)); }
  }
  if (st.deco === 'crystal') {
    for (let i = 0; i < 16; i++) {
      const x = rng.range(0, TILE), y = rng.range(0, TILE), k = rng.int(2, 4);
      wrap((X, Y) => {
        for (let j = 0; j < k; j++) {
          const a = rng.range(0, TAU), l = rng.range(10, 26), w = l * 0.35;
          g.save(); g.translate(X, Y); g.rotate(a);
          g.beginPath(); g.moveTo(0, -w); g.lineTo(l, 0); g.lineTo(0, w); g.closePath();
          const gr = g.createLinearGradient(0, -w, l, w); gr.addColorStop(0, rgba(acc, 0.7)); gr.addColorStop(1, rgba(shade(acc, -0.6), 0.8));
          g.fillStyle = gr; g.shadowColor = acc; g.shadowBlur = 10; g.fill(); g.shadowBlur = 0;
          g.strokeStyle = rgba('#ffffff', 0.35); g.lineWidth = 1; g.stroke(); g.restore();
        }
      }, x, y, 30);
    }
  }
  if (st.deco === 'lava' || st.deco === 'ash') {
    for (let i = 0; i < (st.deco === 'lava' ? 16 : 6); i++) crack(rng.range(0, TILE), rng.range(0, TILE), rng.range(50, 140), rgba(acc, 0.9), st.deco === 'lava' ? 4 : 2.5, acc);
    if (st.deco === 'ash') for (let i = 0; i < 10; i++) crack(rng.range(0, TILE), rng.range(0, TILE), rng.range(60, 160), 'rgba(10,6,4,0.75)', 5);
    for (let i = 0; i < 120; i++) { const x = rng.range(0, TILE), y = rng.range(0, TILE); g.fillStyle = rgba(rng.next() < 0.2 ? acc : '#000000', rng.range(0.1, 0.35)); circ(g, x, y, rng.range(0.8, 2.5)); g.fill(); }
  }
  if (st.deco === 'void') {
    for (let i = 0; i < 5; i++) {
      const x = rng.range(0, TILE), y = rng.range(0, TILE), r = rng.range(30, 60);
      wrap((X, Y) => { g.globalAlpha = 0.35; g.drawImage(runeCircle(acc, Math.round(r * 2), 10, i + 1), X - r, Y - r); g.globalAlpha = 1; }, x, y, r);
    }
    for (let i = 0; i < 10; i++) crack(rng.range(0, TILE), rng.range(0, TILE), rng.range(40, 100), rgba(acc, 0.35), 2);
  }
  // Funkelnde Sprenkel
  for (let i = 0; i < 90; i++) { const x = rng.range(0, TILE), y = rng.range(0, TILE); g.fillStyle = rgba(rng.next() < 0.3 ? acc : '#ffffff', rng.range(0.05, 0.3)); g.fillRect(x, y, 1.5, 1.5); }
  floorCache.set(key, c);
  return c;
}

// ---------------------------------------------------------------- Atmosphäre (Bildschirmraum)
export function makeAmbient(kind, n = 46) {
  return Array.from({ length: n }, () => ({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.9, s: Math.random(), ph: Math.random() * TAU, kind }));
}
export function drawAmbient(ctx, list, col, W, H, t, camX, camY) {
  ctx.globalCompositeOperation = 'lighter';
  const sp = soft(col);
  for (const a of list) {
    let vx = 0, vy = 0, size = 3 + a.s * 5, alpha = 0.25 + 0.35 * a.s;
    if (a.kind === 'embers') { vy = -0.035; vx = 0.01 * Math.sin(t + a.ph); alpha *= 0.7 + 0.3 * Math.sin(t * 6 + a.ph); }
    else if (a.kind === 'snow') { vy = 0.03; vx = -0.02 + 0.01 * Math.sin(t * 0.7 + a.ph); size *= 0.8; }
    else if (a.kind === 'spores') { vy = -0.008; vx = 0.01 * Math.sin(t * 0.5 + a.ph); size *= 1.3; alpha *= 0.6; }
    else if (a.kind === 'glints') { alpha *= Math.max(0, Math.sin(t * 2 + a.ph * 3)) ** 3; size *= 1.2; }
    else { vy = -0.01; vx = 0.006 * Math.cos(t * 0.4 + a.ph); }
    a.x += vx * a.z / 60; a.y += vy * a.z / 60;
    let x = (a.x * W - camX * 0.12 * a.z) % W, y = (a.y * H - camY * 0.12 * a.z) % H;
    if (x < 0) x += W; if (y < 0) y += H;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    const sz = size * a.z * 2.2;
    ctx.drawImage(sp, x - sz / 2, y - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// Vignette + Nebelschleier
let vigCache = null;
export function vignette(W, H) {
  const key = W + 'x' + H;
  if (vigCache && vigCache.key === key) return vigCache.c;
  const c = mk(W, H); const g = c.getContext('2d');
  const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.hypot(W, H) * 0.62);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.78)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  vigCache = { key, c };
  return c;
}

// ---------------------------------------------------------------- Menühintergrund (Nebel + Sterne)
let nebula = null;
export function nebulaBg(W, H) {
  const key = W + 'x' + H;
  if (nebula && nebula.key === key) return nebula.c;
  const c = mk(W, H); const g = c.getContext('2d');
  const rng = makeRng(99);
  g.fillStyle = '#07040f'; g.fillRect(0, 0, W, H);
  const cols = ['#4a1a8a', '#1a3a8a', '#8a1a5a', '#2a0a5a', '#0a4a6a'];
  for (let i = 0; i < 28; i++) {
    const x = rng.range(-0.1, 1.1) * W, y = rng.range(-0.1, 1.1) * H, r = rng.range(0.15, 0.5) * Math.max(W, H);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(rng.pick(cols), rng.range(0.08, 0.22))); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  for (let i = 0; i < (W * H) / 1800; i++) {
    const x = rng.range(0, W), y = rng.range(0, H), s = rng.next() ** 3 * 2 + 0.4;
    g.fillStyle = rgba(rng.pick(['#ffffff', '#cfd8ff', '#ffe8c0', '#e0c8ff']), rng.range(0.25, 0.9));
    g.fillRect(x, y, s, s);
  }
  nebula = { key, c };
  return c;
}
