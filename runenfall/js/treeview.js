// Darstellung der Sternenkarte: Verschieben, Zoomen (Pinch/Mausrad), Antippen von Knoten.
// Die Karte ist riesig: Weit herausgezoomt wird ein vorgerendertes Gesamtbild gezeigt,
// nah dran werden nur sichtbare Sterne gezeichnet (gebündelt nach Farbe).
import { getTree, findPath } from './data/tree.js';
import { CLASSES } from './data/content.js';
import { TAU, clamp, rgba } from './util.js';
import { modText } from './data/stats.js';
import { soft } from './gfx.js';

const THEME_COLOR = {
  fire: '#ff7a2a', burn: '#ff7a2a', cold: '#62d6ff', chill: '#62d6ff', light: '#ffe34d', shock: '#ffe34d',
  phys: '#e6dccb', bleed: '#ff4d6d', chaos: '#9cff5e', poison: '#9cff5e', dot: '#b6ff7a',
  life: '#ff6b81', regen: '#ff6b81', leech: '#ff4d6d', armor: '#c9a27a', evasion: '#7dffb0', barrier: '#9fe7ff',
  crit: '#ffd84d', critmulti: '#ffd84d', speed: '#7aa8ff', move: '#7aa8ff', minion: '#c58bff', trap: '#c58bff',
  aura: '#ff9a5c', orbit: '#e6dccb', chain: '#ffe34d', spell: '#a98bff', attack: '#ff9a5c', proj: '#7dffb0',
  area: '#ff9a5c', melee: '#e6dccb', elem: '#ffb0ff', res: '#c9c3b5', fortune: '#ffd84d', dmg: '#ff8a8a',
  execute: '#ff4d6d', pen: '#ffb0ff', dur: '#b6ff7a', conv: '#ffb0ff', dodge: '#7dffb0', thorns: '#c9a27a', gold: '#ffd84d',
  heal: '#ff6b81', spellcrit: '#a98bff', attackcrit: '#ff9a5c', projcrit: '#7dffb0', areaspell: '#a98bff', firepen: '#ff7a2a',
  coldpen: '#62d6ff', lightpen: '#ffe34d', chaospen: '#9cff5e', addfire: '#ff7a2a', addcold: '#62d6ff', addlight: '#ffe34d',
  addchaos: '#9cff5e', boss: '#ff4d6d', ailment: '#b6ff7a', resall: '#c9c3b5', barrierfast: '#9fe7ff', minionspeed: '#c58bff',
  traparea: '#c58bff', aurarea: '#ff9a5c', orbitspeed: '#e6dccb', meleearea: '#e6dccb',
};
const RADIUS = { key: 28, notable: 17, start: 22, small: 9, travel: 6, hub: 9, jewel: 16, mastery: 21, const: 11, legend: 25, portal: 19, myth: 21 };
const BIG = new Set(['key', 'notable', 'start', 'jewel', 'mastery', 'legend', 'portal', 'myth']);
const LABELED = new Set(['notable', 'key', 'mastery', 'legend', 'myth', 'portal', 'jewel']);
const LOD_Z = 0.2;

function starPath(ctx, x, y, r, n, inner, rot = 0) {
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n, rr = i % 2 ? r * inner : r;
    if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

export class TreeView {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.tree = null;
    this.cam = { x: 0, y: 0, z: 0.45 };
    this.alloc = new Set();
    this.cls = 'pyro';
    this.sel = null;
    this.preview = [];
    this.search = '';
    this.matches = new Set();
    this.matchList = [];
    this.matchIdx = -1;
    this.onSelect = () => {};
    this.jewelColor = () => null;
    this.active = false;
    this.pointers = new Map();
    this.t = 0;
    this.attach();
  }

  ensureTree() {
    if (this.tree) return;
    this.tree = getTree();
    // Sternbild-Gruppen (für Beschriftung)
    const groups = new Map();
    for (const n of this.tree.nodes.values()) {
      if (n.type !== 'const' && n.type !== 'legend') continue;
      const g = n.id.split('_')[0];
      if (!groups.has(g)) groups.set(g, { name: n.constName, x: 0, y: 0, n: 0, ids: [] });
      const e = groups.get(g); e.x += n.x; e.y += n.y; e.n++; e.ids.push(n.id);
    }
    this.consts = [...groups.values()].map((g) => ({ ...g, x: g.x / g.n, y: g.y / g.n }));
    // Raster für schnelles Antippen
    this.grid = new Map();
    for (const n of this.tree.nodes.values()) {
      const k = `${Math.floor(n.x / 200)},${Math.floor(n.y / 200)}`;
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(n);
    }
  }

  open(cls, alloc) {
    this.ensureTree();
    this.cls = cls;
    this.alloc = new Set(alloc);
    this.active = true;
    this.cv.style.display = 'block';
    this.resize();
    const st = this.tree.nodes.get(this.tree.starts[cls]);
    this.cam.x = st.x * 0.6; this.cam.y = st.y * 0.6;
    this.cam.z = Math.min(this.W, this.H) / 1000;
    this.select(null);
  }
  close() { this.active = false; this.cv.style.display = 'none'; }
  setAlloc(alloc) { this.alloc = new Set(alloc); if (this.sel) this.select(this.sel.id); }

  resize() {
    this.DPR = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.cv.width = Math.round(this.W * this.DPR); this.cv.height = Math.round(this.H * this.DPR);
  }

  setSearch(q) {
    this.ensureTree();
    this.search = q.trim().toLowerCase();
    this.matches.clear();
    this.matchList = [];
    this.matchIdx = -1;
    if (!this.search) return 0;
    for (const n of this.tree.nodes.values()) {
      if (n.type === 'travel' || n.type === 'hub') continue;
      const txt = (n.name + ' ' + n.mods.map(modText).join(' ') + ' ' + (n.options ? n.options.map((o) => o.mods.map(modText).join(' ')).join(' ') : '')).toLowerCase();
      if (txt.includes(this.search)) this.matches.add(n.id);
    }
    // Nach Nähe zum Ursprung sortieren – die nächsten Treffer zuerst
    const st = this.tree.nodes.get(this.tree.starts[this.cls]);
    const big = [...this.matches].map((id) => this.tree.nodes.get(id)).filter((n) => BIG.has(n.type));
    this.matchList = (big.length ? big : [...this.matches].map((id) => this.tree.nodes.get(id)))
      .sort((a, b) => Math.hypot(a.x - st.x, a.y - st.y) - Math.hypot(b.x - st.x, b.y - st.y));
    return this.matches.size;
  }
  nextMatch() {
    if (!this.matchList.length) return null;
    this.matchIdx = (this.matchIdx + 1) % this.matchList.length;
    const n = this.matchList[this.matchIdx];
    this.focus(n);
    return n;
  }
  focus(n, z = 0.9) {
    this.cam.x = n.x; this.cam.y = n.y;
    this.cam.z = Math.max(this.cam.z, z);
    this.select(n.id);
  }

  select(id) {
    this.sel = id ? this.tree.nodes.get(id) : null;
    this.preview = this.sel && !this.alloc.has(id) ? findPath(this.tree, this.alloc, id, this.cls) || [] : [];
    this.onSelect(this.sel, this.preview);
  }

  toWorld(sx, sy) { return { x: (sx - this.W / 2) / this.cam.z + this.cam.x, y: (sy - this.H / 2) / this.cam.z + this.cam.y }; }

  attach() {
    const cv = this.cv;
    let moved = 0, pinch = null;
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.cam.z };
      }
    });
    cv.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (this.pointers.size === 2 && pinch) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        this.zoomAt(mx, my, this.clampZ((pinch.z * d) / pinch.d) / this.cam.z);
        moved += 10;
      } else if (this.pointers.size === 1) {
        this.cam.x -= dx / this.cam.z; this.cam.y -= dy / this.cam.z;
        moved += Math.abs(dx) + Math.abs(dy);
        this.clampCam();
      }
    });
    const up = (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) pinch = null;
      if (moved < 8 && this.pointers.size === 0) this.tap(e.clientX, e.clientY);
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', (e) => { this.pointers.delete(e.pointerId); pinch = null; });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
    window.addEventListener('resize', () => { if (this.active) this.resize(); });
  }

  minZ() { return Math.min(this.W, this.H) / ((this.tree ? this.tree.radius : 6000) * 2.1); }
  clampZ(z) { return clamp(z, this.minZ(), 2.5); }
  clampCam() { const R = this.tree ? this.tree.radius : 6000; this.cam.x = clamp(this.cam.x, -R, R); this.cam.y = clamp(this.cam.y, -R, R); }
  zoomAt(sx, sy, f) {
    const before = this.toWorld(sx, sy);
    this.cam.z = this.clampZ(this.cam.z * f);
    const after = this.toWorld(sx, sy);
    this.cam.x += before.x - after.x; this.cam.y += before.y - after.y;
    this.clampCam();
  }
  zoom(f) { this.zoomAt(this.W / 2, this.H / 2, f); }
  overview() { this.cam.x = 0; this.cam.y = 0; this.cam.z = this.minZ() * 1.05; }
  home() { const st = this.tree.nodes.get(this.tree.starts[this.cls]); this.cam.x = st.x; this.cam.y = st.y; this.cam.z = Math.min(this.W, this.H) / 900; }

  tap(sx, sy) {
    const w = this.toWorld(sx, sy);
    const reach = Math.max(26 / this.cam.z, 20);
    let best = null, bd = Infinity;
    const gx = Math.floor(w.x / 200), gy = Math.floor(w.y / 200), span = Math.ceil(reach / 200);
    for (let dx = -span; dx <= span; dx++) for (let dy = -span; dy <= span; dy++) {
      for (const n of this.grid.get(`${gx + dx},${gy + dy}`) || []) {
        const r = RADIUS[n.type] + reach;
        const d = Math.hypot(n.x - w.x, n.y - w.y) - (BIG.has(n.type) && this.cam.z < 0.3 ? 30 : 0);
        if (d < r && d < bd) { bd = d; best = n; }
      }
    }
    this.select(best ? best.id : null);
  }

  radius(n) { return RADIUS[n.type]; }
  color(n) {
    if (n.type === 'key') return '#ffd84d';
    if (n.type === 'start') return CLASSES[n.cls].color;
    if (n.type === 'jewel') return this.jewelColor(n.id) || '#62ffd0';
    if (n.type === 'travel' || n.type === 'hub') return '#a49cc9';
    if (n.type === 'portal') return '#c58bff';
    if (n.type === 'myth') return '#ff7ad9';
    if (n.type === 'legend') return '#fff2b0';
    return THEME_COLOR[n.theme] || '#c9c3b5';
  }

  // ---------------------------------------------------------------- Hintergrund & Gesamtbild
  regionColor(k) {
    const cls = this.tree.regions[k].cls;
    return CLASSES[cls] ? CLASSES[cls].color : '#7a5cff';
  }
  buildBackdrop() {
    if (this.backdrop) return;
    const R = this.tree.radius, S = 1024, sc = S / (2 * R);
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = '#05040c'; g.fillRect(0, 0, S, S);
    g.translate(S / 2, S / 2); g.scale(sc, sc);
    g.globalCompositeOperation = 'lighter';
    const reg = this.tree.regions;
    reg.forEach((r, k) => {
      const col = this.regionColor(k);
      for (const [rad, size, a] of [[1100, 1300, 0.13], [2700, 1700, 0.1], [4400, 2100, 0.08]]) {
        const ang = (r.ang * Math.PI) / 180;
        const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
        const gr = g.createRadialGradient(x, y, 0, x, y, size);
        gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
        g.fillStyle = gr; g.fillRect(x - size, y - size, size * 2, size * 2);
      }
    });
    g.globalCompositeOperation = 'source-over';
    // Zonenringe
    g.strokeStyle = 'rgba(255,216,77,0.12)'; g.lineWidth = 14; g.setLineDash([60, 50]);
    for (const r of [1900, 3700]) { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); }
    g.setLineDash([]);
    g.strokeStyle = 'rgba(255,216,77,0.25)'; g.lineWidth = 20; g.beginPath(); g.arc(0, 0, R - 60, 0, TAU); g.stroke();
    // Sternenstaub
    for (let i = 0; i < 2600; i++) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * R;
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.5})`;
      g.fillRect(Math.cos(a) * d, Math.sin(a) * d, 14, 14);
    }
    this.backdrop = { c, sc };
  }
  /** Vorgerendertes Gesamtbild aller Sterne und Kanten (für weite Zoomstufen). */
  buildBase() {
    if (this.base) return;
    const R = this.tree.radius, S = 2600, sc = S / (2 * R);
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    g.translate(S / 2, S / 2); g.scale(sc, sc);
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(160,140,220,0.35)'; g.lineWidth = 7;
    g.beginPath();
    for (const [a, b, kind] of this.tree.edges) {
      if (kind) continue;
      const A = this.tree.nodes.get(a), B = this.tree.nodes.get(b);
      g.moveTo(A.x, A.y); g.lineTo(B.x, B.y);
    }
    g.stroke();
    g.strokeStyle = 'rgba(160,230,255,0.75)'; g.lineWidth = 9;
    g.beginPath();
    for (const [a, b, kind] of this.tree.edges) {
      if (kind !== 'const') continue;
      const A = this.tree.nodes.get(a), B = this.tree.nodes.get(b);
      g.moveTo(A.x, A.y); g.lineTo(B.x, B.y);
    }
    g.stroke();
    for (const n of this.tree.nodes.values()) {
      const col = this.color(n), r = RADIUS[n.type] * (BIG.has(n.type) ? 2.4 : 1.6);
      if (BIG.has(n.type) || n.type === 'const') { g.globalAlpha = 0.5; g.drawImage(soft(col), n.x - r * 2, n.y - r * 2, r * 4, r * 4); g.globalAlpha = 1; }
      g.fillStyle = n.type === 'travel' ? 'rgba(164,156,201,0.6)' : col;
      g.beginPath();
      if (n.type === 'key' || n.type === 'legend') starPath(g, n.x, n.y, r * 1.3, n.type === 'key' ? 4 : 5, 0.45);
      else g.arc(n.x, n.y, r, 0, TAU);
      g.fill();
    }
    this.base = { c, sc };
  }

  // ---------------------------------------------------------------- Zeichnen
  render() {
    if (!this.active) return;
    this.ensureTree();
    this.t += 1 / 60;
    const ctx = this.ctx, z = this.cam.z, W = this.W, H = this.H;
    ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    this.buildBackdrop();
    const R = this.tree.radius;
    // Hintergrund (bewegt sich langsamer: Parallaxe)
    ctx.fillStyle = '#05040c'; ctx.fillRect(0, 0, W, H);
    const bz = z * 0.9 + 0.0, bs = this.backdrop.sc;
    ctx.save();
    ctx.translate(W / 2 - this.cam.x * bz, H / 2 - this.cam.y * bz);
    ctx.scale(bz / bs, bz / bs);
    ctx.drawImage(this.backdrop.c, -this.backdrop.c.width / 2, -this.backdrop.c.height / 2);
    ctx.restore();

    ctx.save();
    ctx.translate(W / 2 - this.cam.x * z, H / 2 - this.cam.y * z);
    ctx.scale(z, z);
    const prev = new Set(this.preview);
    const x0 = this.cam.x - W / 2 / z - 60, x1 = this.cam.x + W / 2 / z + 60, y0 = this.cam.y - H / 2 / z - 60, y1 = this.cam.y + H / 2 / z + 60;
    const vis = (n) => n.x > x0 && n.x < x1 && n.y > y0 && n.y < y1;

    if (z < LOD_Z) {
      // ---- Weit weg: Gesamtbild + Hervorhebungen
      this.buildBase();
      const b = this.base;
      ctx.drawImage(b.c, -R, -R, 2 * R, 2 * R);
      this.drawHighlights(ctx, prev, vis, z);
      // Regionsnamen
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(10.5 / z)}px Cinzel, Georgia, serif`;
      this.tree.regions.forEach((r, k) => {
        const a = (r.ang * Math.PI) / 180;
        ctx.fillStyle = rgba(this.regionColor(k), 0.85);
        ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 4 / z;
        const x = Math.cos(a) * 3000, y = Math.sin(a) * 3000;
        ctx.strokeText(r.name, x, y); ctx.fillText(r.name, x, y);
      });
      if (z > 0.075) {
        ctx.font = `600 ${Math.round(11 / z)}px Cinzel, Georgia, serif`;
        ctx.fillStyle = 'rgba(200,230,255,0.75)';
        for (const g of this.consts) ctx.fillText(g.name, g.x, g.y - 260);
      }
      ctx.restore();
      return;
    }

    // ---- Nah dran: Kanten
    ctx.lineCap = 'round';
    const edgeVis = (A, B) => !(Math.max(A.x, B.x) < x0 || Math.min(A.x, B.x) > x1 || Math.max(A.y, B.y) < y0 || Math.min(A.y, B.y) > y1);
    const passes = [[], [], [], []]; // 0 normal, 1 Vorschau, 2 zugewiesen, 3 Sternbild
    for (const e of this.tree.edges) {
      const [a, b, kind] = e;
      if (kind === 'portal') continue;
      const A = this.tree.nodes.get(a), B = this.tree.nodes.get(b);
      if (!edgeVis(A, B)) continue;
      const both = this.alloc.has(a) && this.alloc.has(b);
      const pv = (prev.has(a) || this.alloc.has(a)) && (prev.has(b) || this.alloc.has(b)) && (prev.has(a) || prev.has(b));
      passes[both ? 2 : pv ? 1 : kind === 'const' ? 3 : 0].push(A, B);
    }
    const strokeAll = (list, style, w) => {
      if (!list.length) return;
      ctx.beginPath();
      for (let i = 0; i < list.length; i += 2) { ctx.moveTo(list[i].x, list[i].y); ctx.lineTo(list[i + 1].x, list[i + 1].y); }
      ctx.strokeStyle = style; ctx.lineWidth = w; ctx.stroke();
    };
    strokeAll(passes[0], 'rgba(150,130,210,0.3)', 3);
    strokeAll(passes[3], 'rgba(150,220,255,0.55)', 4);
    if (passes[3].length) { ctx.globalCompositeOperation = 'lighter'; strokeAll(passes[3], 'rgba(150,220,255,0.18)', 12); ctx.globalCompositeOperation = 'source-over'; }
    strokeAll(passes[1], '#7dffb0', 5);
    if (passes[2].length) {
      ctx.globalCompositeOperation = 'lighter';
      strokeAll(passes[2], 'rgba(255,200,80,0.35)', 14);
      ctx.globalCompositeOperation = 'source-over';
      strokeAll(passes[2], '#ffd84d', 5);
    }

    // ---- Knoten: kleine gebündelt nach Farbe, große einzeln
    const smallBuckets = new Map();
    const big = [];
    for (const n of this.tree.nodes.values()) {
      if (!vis(n)) continue;
      const on = this.alloc.has(n.id), pv = prev.has(n.id), mt = this.matches.has(n.id);
      if (BIG.has(n.type) || on || pv || mt || (this.sel && this.sel.id === n.id)) { big.push(n); continue; }
      const key = n.type + '|' + this.color(n);
      if (!smallBuckets.has(key)) smallBuckets.set(key, []);
      smallBuckets.get(key).push(n);
    }
    for (const [key, list] of smallBuckets) {
      const [type, col] = key.split('|');
      ctx.beginPath();
      for (const n of list) {
        const r = RADIUS[type];
        if (type !== 'const') ctx.moveTo(n.x + r, n.y);
        if (type === 'const') starPath(ctx, n.x, n.y, r * 1.2, 4, 0.45, -Math.PI / 2);
        else ctx.arc(n.x, n.y, r, 0, TAU);
      }
      ctx.fillStyle = type === 'const' ? rgba(col, 0.55) : '#151026';
      ctx.fill();
      ctx.strokeStyle = rgba(col, type === 'travel' ? 0.55 : 0.8); ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    // Glühen der hervorgehobenen
    ctx.globalCompositeOperation = 'lighter';
    for (const n of big) {
      const on = this.alloc.has(n.id), pv = prev.has(n.id), mt = this.matches.has(n.id);
      const r = RADIUS[n.type];
      let gc = null, a = 0.5;
      if (mt && !on) gc = '#ffffff';
      else if (pv) gc = '#7dffb0';
      else if (on) gc = this.color(n);
      else if (n.type === 'legend' || n.type === 'myth' || n.type === 'key' || n.type === 'portal') { gc = this.color(n); a = 0.25 + 0.1 * Math.sin(this.t * 2 + n.x); }
      if (!gc) continue;
      const gr = r * (n.type === 'key' || n.type === 'legend' ? 3.6 : 3);
      ctx.globalAlpha = a;
      ctx.drawImage(soft(gc), n.x - gr, n.y - gr, gr * 2, gr * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (const n of big) this.drawNode(ctx, n, prev);

    // ---- Beschriftungen
    if (z > 0.42) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.font = '600 13px system-ui';
      for (const n of big) {
        if (!LABELED.has(n.type)) continue;
        const on = this.alloc.has(n.id);
        ctx.fillStyle = on ? '#fff6d0' : n.type === 'myth' ? 'rgba(255,170,230,0.9)' : n.type === 'legend' ? 'rgba(255,240,190,0.9)' : 'rgba(220,210,255,0.72)';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,3,12,0.8)';
        ctx.strokeText(n.name, n.x, n.y + RADIUS[n.type] + 6);
        ctx.fillText(n.name, n.x, n.y + RADIUS[n.type] + 6);
      }
    } else {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `600 ${Math.round(14 / z / 1.5)}px Cinzel, Georgia, serif`;
      ctx.fillStyle = 'rgba(200,230,255,0.7)';
      for (const g of this.consts) if (g.x > x0 - 400 && g.x < x1 + 400 && g.y > y0 - 400 && g.y < y1 + 400) ctx.fillText(g.name, g.x, g.y - 250);
    }
    ctx.restore();
  }

  drawHighlights(ctx, prev, vis, z) {
    const w = Math.max(6, 3 / z);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [a, b] of this.tree.edges) {
      if (!(this.alloc.has(a) && this.alloc.has(b))) continue;
      const A = this.tree.nodes.get(a), B = this.tree.nodes.get(b);
      ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
    }
    ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = w; ctx.stroke();
    if (prev.size) {
      ctx.beginPath();
      for (const id of prev) { const n = this.tree.nodes.get(id); ctx.moveTo(n.x + w, n.y); ctx.arc(n.x, n.y, w, 0, TAU); }
      ctx.fillStyle = '#7dffb0'; ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    const s = Math.max(30, 12 / z);
    for (const id of this.matches) { const n = this.tree.nodes.get(id); if (!BIG.has(n.type)) continue; ctx.globalAlpha = 0.8; ctx.drawImage(soft('#ffffff'), n.x - s, n.y - s, s * 2, s * 2); }
    const st = this.tree.nodes.get(this.tree.starts[this.cls]);
    ctx.globalAlpha = 0.9; ctx.drawImage(soft(CLASSES[this.cls].color), st.x - s * 2, st.y - s * 2, s * 4, s * 4);
    if (this.sel) { ctx.globalAlpha = 1; ctx.drawImage(soft('#ffffff'), this.sel.x - s * 1.5, this.sel.y - s * 1.5, s * 3, s * 3); }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  drawNode(ctx, n, prev) {
    const r = RADIUS[n.type], col = this.color(n), on = this.alloc.has(n.id), pv = prev.has(n.id);
    ctx.fillStyle = on ? col : '#151026';
    ctx.strokeStyle = on ? '#ffffff' : pv ? '#7dffb0' : rgba(col, 0.85);
    ctx.lineWidth = BIG.has(n.type) ? 3.5 : 2.5;
    ctx.beginPath();
    if (n.type === 'key') starPath(ctx, n.x, n.y, r, 8, 0.62, this.t * 0.1);
    else if (n.type === 'legend') starPath(ctx, n.x, n.y, r, 5, 0.45, -Math.PI / 2);
    else if (n.type === 'const') starPath(ctx, n.x, n.y, r * 1.2, 4, 0.45, -Math.PI / 2);
    else if (n.type === 'jewel') { for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6 + Math.PI / 6; ctx.lineTo(n.x + Math.cos(a) * r, n.y + Math.sin(a) * r); } ctx.closePath(); }
    else if (n.type === 'notable' || n.type === 'myth') { ctx.moveTo(n.x, n.y - r); ctx.lineTo(n.x + r, n.y); ctx.lineTo(n.x, n.y + r); ctx.lineTo(n.x - r, n.y); ctx.closePath(); }
    else ctx.arc(n.x, n.y, r, 0, TAU);
    if (n.type === 'myth' && !on) {
      const g = ctx.createLinearGradient(n.x - r, n.y - r, n.x + r, n.y + r);
      g.addColorStop(0, '#3a0a3a'); g.addColorStop(1, '#14082a');
      ctx.fillStyle = g;
    }
    ctx.fill(); ctx.stroke();
    if (n.type === 'mastery') {
      ctx.strokeStyle = on ? '#130d1c' : rgba(col, 0.7); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(n.x, n.y, r * 0.62, 0, TAU); ctx.stroke();
      ctx.fillStyle = on ? '#130d1c' : col;
      ctx.beginPath(); starPath(ctx, n.x, n.y, r * 0.42, 4, 0.4, -Math.PI / 2); ctx.fill();
    } else if (n.type === 'portal') {
      ctx.strokeStyle = on ? '#ffffff' : '#e8c8ff'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const a0 = this.t * 1.5 + (i * TAU) / 3;
        ctx.beginPath(); ctx.arc(n.x, n.y, r * 0.6, a0, a0 + 1.4); ctx.stroke();
      }
    } else if (n.type === 'start') {
      ctx.fillStyle = on ? '#130d1c' : CLASSES[n.cls].color;
      ctx.font = '700 22px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(CLASSES[n.cls].glyph, n.x, n.y + 1);
    }
    if (this.sel && this.sel.id === n.id) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.arc(n.x, n.y, r + 9, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
  }
}
