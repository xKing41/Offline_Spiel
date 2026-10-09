// Darstellung der Sternenkarte: Verschieben, Zoomen (Pinch/Mausrad), Antippen von Knoten.
import { getTree, findPath } from './data/tree.js';
import { CLASSES } from './data/content.js';
import { TAU, clamp, rgba } from './util.js';
import { modText } from './data/stats.js';

const THEME_COLOR = {
  fire: '#ff7a2a', burn: '#ff7a2a', cold: '#62d6ff', chill: '#62d6ff', light: '#ffe34d', shock: '#ffe34d',
  phys: '#e6dccb', bleed: '#ff4d6d', chaos: '#9cff5e', poison: '#9cff5e', dot: '#b6ff7a',
  life: '#ff6b81', regen: '#ff6b81', leech: '#ff4d6d', armor: '#c9a27a', evasion: '#7dffb0', barrier: '#9fe7ff',
  crit: '#ffd84d', critmulti: '#ffd84d', speed: '#7aa8ff', move: '#7aa8ff', minion: '#c58bff', trap: '#c58bff',
  aura: '#ff9a5c', orbit: '#e6dccb', chain: '#ffe34d', spell: '#a98bff', attack: '#ff9a5c', proj: '#7dffb0',
  area: '#ff9a5c', melee: '#e6dccb', elem: '#ffb0ff', res: '#c9c3b5', fortune: '#ffd84d', dmg: '#ff8a8a',
  execute: '#ff4d6d', pen: '#ffb0ff', dur: '#b6ff7a',
};

export class TreeView {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.tree = getTree();
    this.cam = { x: 0, y: 0, z: 0.45 };
    this.alloc = new Set();
    this.cls = 'pyro';
    this.sel = null;
    this.hover = null;
    this.preview = [];
    this.search = '';
    this.matches = new Set();
    this.onSelect = () => {};
    this.active = false;
    this.pointers = new Map();
    this.attach();
  }

  open(cls, alloc) {
    this.cls = cls;
    this.alloc = new Set(alloc);
    this.active = true;
    this.cv.style.display = 'block';
    this.resize();
    const st = this.tree.nodes.get(this.tree.starts[cls]);
    this.cam.x = st.x * 0.75; this.cam.y = st.y * 0.75;
    this.cam.z = Math.min(this.W, this.H) / 900;
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
    this.search = q.trim().toLowerCase();
    this.matches.clear();
    if (!this.search) return;
    for (const n of this.tree.nodes.values()) {
      const txt = (n.name + ' ' + n.mods.map(modText).join(' ')).toLowerCase();
      if (txt.includes(this.search)) this.matches.add(n.id);
    }
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
        this.zoomAt(mx, my, clamp((pinch.z * d) / pinch.d, 0.12, 2.5) / this.cam.z);
        moved += 10;
      } else if (this.pointers.size === 1) {
        this.cam.x -= dx / this.cam.z; this.cam.y -= dy / this.cam.z;
        moved += Math.abs(dx) + Math.abs(dy);
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

  zoomAt(sx, sy, f) {
    const before = this.toWorld(sx, sy);
    this.cam.z = clamp(this.cam.z * f, 0.12, 2.5);
    const after = this.toWorld(sx, sy);
    this.cam.x += before.x - after.x; this.cam.y += before.y - after.y;
  }
  zoom(f) { this.zoomAt(this.W / 2, this.H / 2, f); }

  tap(sx, sy) {
    const w = this.toWorld(sx, sy);
    let best = null, bd = (26 / this.cam.z) ** 2;
    for (const n of this.tree.nodes.values()) {
      const r = this.radius(n) + 10 / this.cam.z;
      const d = (n.x - w.x) ** 2 + (n.y - w.y) ** 2;
      if (d < Math.max(bd, r * r) && d < bd + r * r) { if (!best || d < bd) { bd = d; best = n; } }
    }
    this.select(best ? best.id : null);
  }

  radius(n) { return { key: 26, notable: 17, start: 22, small: 9, travel: 6, hub: 9 }[n.type]; }
  color(n) {
    if (n.type === 'key') return '#ffd84d';
    if (n.type === 'start') return CLASSES[n.cls].color;
    if (n.type === 'travel' || n.type === 'hub') return '#a49cc9';
    return THEME_COLOR[n.theme] || '#c9c3b5';
  }

  render() {
    if (!this.active) return;
    const ctx = this.ctx, z = this.cam.z;
    ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    const g = ctx.createRadialGradient(this.W / 2, this.H / 2, 0, this.W / 2, this.H / 2, Math.max(this.W, this.H));
    g.addColorStop(0, '#120c26'); g.addColorStop(1, '#05040c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.save();
    ctx.translate(this.W / 2 - this.cam.x * z, this.H / 2 - this.cam.y * z);
    ctx.scale(z, z);
    const prev = new Set(this.preview);
    const vis = (n) => {
      const sx = (n.x - this.cam.x) * z + this.W / 2, sy = (n.y - this.cam.y) * z + this.H / 2;
      return sx > -60 && sx < this.W + 60 && sy > -60 && sy < this.H + 60;
    };
    // Kanten
    ctx.lineCap = 'round';
    for (const pass of [0, 1, 2]) {
      ctx.beginPath();
      for (const [a, b] of this.tree.edges) {
        const A = this.tree.nodes.get(a), B = this.tree.nodes.get(b);
        if (!vis(A) && !vis(B)) continue;
        const both = this.alloc.has(a) && this.alloc.has(b);
        const pv = (prev.has(a) || this.alloc.has(a)) && (prev.has(b) || this.alloc.has(b)) && (prev.has(a) || prev.has(b));
        const kind = both ? 2 : pv ? 1 : 0;
        if (kind !== pass) continue;
        ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
      }
      ctx.strokeStyle = pass === 2 ? '#ffd84d' : pass === 1 ? '#7dffb0' : 'rgba(150,130,210,0.28)';
      ctx.lineWidth = (pass ? 5 : 3);
      ctx.stroke();
    }
    // Knoten
    for (const n of this.tree.nodes.values()) {
      if (!vis(n)) continue;
      const r = this.radius(n), col = this.color(n), on = this.alloc.has(n.id), pv = prev.has(n.id);
      if (on || pv || this.matches.has(n.id)) {
        const gr = r * (n.type === 'key' ? 2.6 : 2.2);
        const rg = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, gr);
        const gc = this.matches.has(n.id) && !on ? '#ffffff' : pv ? '#7dffb0' : col;
        rg.addColorStop(0, rgba(gc, 0.55)); rg.addColorStop(1, rgba(gc, 0));
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(n.x, n.y, gr, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = on ? col : '#151026';
      ctx.strokeStyle = on ? '#ffffff' : pv ? '#7dffb0' : rgba(col, 0.75);
      ctx.lineWidth = n.type === 'key' || n.type === 'notable' ? 3.5 : 2.5;
      ctx.beginPath();
      if (n.type === 'key') {
        for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8, rr = i % 2 ? r * 0.72 : r; ctx.lineTo(n.x + Math.cos(a) * rr, n.y + Math.sin(a) * rr); }
        ctx.closePath();
      } else if (n.type === 'notable') {
        ctx.moveTo(n.x, n.y - r); ctx.lineTo(n.x + r, n.y); ctx.lineTo(n.x, n.y + r); ctx.lineTo(n.x - r, n.y); ctx.closePath();
      } else ctx.arc(n.x, n.y, r, 0, TAU);
      ctx.fill(); ctx.stroke();
      if (n.type === 'start') {
        ctx.fillStyle = on ? '#130d1c' : CLASSES[n.cls].color;
        ctx.font = '700 22px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(CLASSES[n.cls].glyph, n.x, n.y + 1);
      }
      if (this.sel && this.sel.id === n.id) {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 9, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    // Namen von Notables/Keystones bei genügend Zoom
    if (z > 0.38) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.font = '600 13px system-ui';
      for (const n of this.tree.nodes.values()) {
        if ((n.type !== 'notable' && n.type !== 'key') || !vis(n)) continue;
        ctx.fillStyle = this.alloc.has(n.id) ? '#fff6d0' : 'rgba(220,210,255,0.7)';
        ctx.fillText(n.name, n.x, n.y + this.radius(n) + 6);
      }
    }
    ctx.restore();
  }
}
