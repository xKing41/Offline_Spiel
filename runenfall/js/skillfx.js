// Optik der Fertigkeiten: jede Rune hat ein eigenes Aussehen (Geschosse, Einschläge, Novas, Meteore,
// Zonen, Auren, Fallen, Klingen). Wird von combat.js aufgerufen; ändert keine Spielwerte.
import { soft, rgba, shade, SPR } from './gfx.js';

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const mk = (w, h = w) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

/** Optik-Profil je Rune (id → Stil). Unbekannte Runen nutzen die allgemeinen Effekte. */
export const VIS = {
  starbolt: { proj: 'star' }, spectral: { proj: 'ghost' }, fireball: { proj: 'fireball' }, frostshard: { proj: 'shard' },
  icelance: { proj: 'icelance' }, arrows: { proj: 'arrow' }, lightningarrow: { proj: 'arrowLight' }, bloodlance: { proj: 'bloodlance' },
  bonespear: { proj: 'bone' }, glaive: { proj: 'glaive' }, balllight: { proj: 'orbLight' }, venomfan: { proj: 'venom' },
  wisps: { proj: 'wisp' }, firespirits: { proj: 'ember' },
  frostnova: { blast: 'iceNova' }, soulreap: { blast: 'soulNova' }, bloodnova: { blast: 'bloodNova' }, bladestorm: { blast: 'bladeNova' },
  shockwave: { blast: 'quake' }, flamewave: { blast: 'pillar' }, arcticbreath: { blast: 'iceSpikes' },
  thunderstorm: { blast: 'lightning' }, starfall: { blast: 'starImpact', fall: 'star' }, firestorm: { blast: 'fireImpact', fall: 'fire' },
  meteor: { blast: 'craterFire', fall: 'meteor' }, comet: { blast: 'craterIce', fall: 'comet' },
  slam: { blast: 'smash' }, thunderclap: { blast: 'thunder' }, icegolem: { blast: 'iceSmash' },
  plague: { zone: 'cloud' }, acidpool: { zone: 'acid' }, voidrift: { zone: 'vortex' },
  emberaura: { aura: 'embers' }, frostaura: { aura: 'snow' }, bloodrite: { aura: 'blood' },
  runetrap: { trap: 'rune', blast: 'runeBurst' }, poisontrap: { trap: 'canister', blast: 'poisonBurst' }, spiketrap: { trap: 'caltrop', blast: 'spikes' },
  blades: { orbit: 'knife' }, frostorb: { orbit: 'iceorb' }, shadowblades: { orbit: 'shadow' }, stormblades: { orbit: 'storm' },
};
export function visOf(S) {
  if (!S) return {};
  if (S._vis) return S._vis;
  S._vis = S.evoVis ? { ...(VIS[S.id] || {}), ...S.evoVis } : VIS[S.id] || {};
  return S._vis;
}

// Hauptelement einer Schadensverteilung
export function elemOf(dmg) {
  let best = 'phys', bv = -1;
  for (const t in dmg || {}) { const v = dmg[t][0] + dmg[t][1]; if (v > bv) { bv = v; best = t; } }
  return best;
}
const ECOL = { phys: '#e6dccb', fire: '#ff7a2a', cold: '#8fe4ff', light: '#ffe34d', chaos: '#9cff5e' };

// ---------------------------------------------------------------- Geschoss-Sprites (vorgerendert, Blick nach +x)
const projCache = new Map();
function projSprite(style, color, r) {
  const rr = Math.max(3, Math.round(r));
  const key = `${style}|${color}|${rr}|${SPR}`;
  let s = projCache.get(key);
  if (s) return s;
  const L = 7; // halbe Ausdehnung in Radien
  const px = Math.ceil(rr * L * 2 * SPR);
  const c = mk(px);
  const g = c.getContext('2d');
  g.translate(px / 2, px / 2); g.scale(rr * SPR, rr * SPR);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const glow = (col, b) => { g.shadowColor = col; g.shadowBlur = b * SPR; };
  switch (style) {
    case 'star': {
      glow(color, 8);
      g.fillStyle = '#ffffff';
      g.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, q = i % 2 ? 0.45 : 1.6; g.lineTo(Math.cos(a) * q, Math.sin(a) * q); }
      g.closePath(); g.fill();
      break;
    }
    case 'ghost': {
      glow(color, 6);
      const gr = g.createLinearGradient(-2.5, 0, 2.5, 0); gr.addColorStop(0, rgba(color, 0.1)); gr.addColorStop(1, '#ffffff');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(2.8, 0); g.lineTo(0.4, -0.55); g.lineTo(-2.2, -0.35); g.lineTo(-2.2, 0.35); g.lineTo(0.4, 0.55); g.closePath(); g.fill();
      g.fillStyle = rgba(color, 0.9); g.fillRect(-2.6, -0.9, 0.4, 1.8);
      break;
    }
    case 'shard': case 'icelance': {
      const len = style === 'icelance' ? 3.4 : 2.4;
      glow('#8fe4ff', 7);
      const gr = g.createLinearGradient(-len, -0.6, len, 0.6); gr.addColorStop(0, '#2a7ab0'); gr.addColorStop(0.5, '#bff3ff'); gr.addColorStop(1, '#ffffff');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(len, 0); g.lineTo(0, -0.6); g.lineTo(-len * 0.8, 0); g.lineTo(0, 0.6); g.closePath(); g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 0.12; g.beginPath(); g.moveTo(len, 0); g.lineTo(-len * 0.8, 0); g.stroke();
      break;
    }
    case 'arrow': case 'arrowLight': {
      g.strokeStyle = '#7a5530'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(-2.6, 0); g.lineTo(1.6, 0); g.stroke();
      if (style === 'arrowLight') glow('#ffe34d', 8);
      g.fillStyle = style === 'arrowLight' ? '#fff6b0' : '#d8dde8';
      g.beginPath(); g.moveTo(2.8, 0); g.lineTo(1.4, -0.7); g.lineTo(1.7, 0); g.lineTo(1.4, 0.7); g.closePath(); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = style === 'arrowLight' ? '#ffe34d' : '#e85a5a';
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(-1.8, 0); g.lineTo(-2.8, s * 0.75); g.lineTo(-2.3, 0); g.closePath(); g.fill(); }
      break;
    }
    case 'bloodlance': case 'bone': {
      const blood = style === 'bloodlance';
      glow(blood ? '#ff2a4a' : '#e6dccb', 6);
      const gr = g.createLinearGradient(-3, 0, 3, 0);
      gr.addColorStop(0, blood ? '#5a0010' : '#8a7a60'); gr.addColorStop(0.7, blood ? '#ff3050' : '#f4ecd8'); gr.addColorStop(1, '#ffffff');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(3.4, 0); g.lineTo(1.4, -0.55); g.lineTo(-2.8, -0.28); g.lineTo(-2.8, 0.28); g.lineTo(1.4, 0.55); g.closePath(); g.fill();
      if (!blood) { g.shadowBlur = 0; g.fillStyle = '#f4ecd8'; g.beginPath(); g.arc(-2.8, -0.35, 0.4, 0, TAU); g.arc(-2.8, 0.35, 0.4, 0, TAU); g.fill(); }
      break;
    }
    case 'glaive': {
      glow(color, 6);
      g.fillStyle = '#e8ecf4';
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6;
        g.lineTo(Math.cos(a) * 1.7, Math.sin(a) * 1.7);
        g.lineTo(Math.cos(a + 0.5) * 0.7, Math.sin(a + 0.5) * 0.7);
      }
      g.closePath(); g.fill();
      g.shadowBlur = 0; g.fillStyle = '#3a3040'; g.beginPath(); g.arc(0, 0, 0.45, 0, TAU); g.fill();
      break;
    }
    case 'venom': {
      glow('#9cff5e', 6);
      const gr = g.createRadialGradient(0.3, -0.2, 0.1, 0, 0, 1.3); gr.addColorStop(0, '#f0ffd0'); gr.addColorStop(0.5, '#9cff5e'); gr.addColorStop(1, '#2a6a10');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(1.4, 0); g.quadraticCurveTo(0.4, -1, -1.6, 0); g.quadraticCurveTo(0.4, 1, 1.4, 0); g.fill();
      break;
    }
    default: {
      glow(color, 8);
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, 0.8, 0, TAU); g.fill();
    }
  }
  s = { c, h: L * rr };
  projCache.set(key, s);
  return s;
}

/** Zeichnet alle Spieler-Geschosse (im Weltkoordinatensystem). */
export function drawProjectiles(ctx, c, vis) {
  const t = c.t;
  for (const pr of c.projs) {
    if (!vis(pr.x, pr.y, 60)) continue;
    const style = visOf(pr.S).proj || 'glow';
    const a = Math.atan2(pr.vy, pr.vx);
    const r = pr.r, col = pr.color;
    ctx.globalCompositeOperation = 'lighter';
    switch (style) {
      case 'fireball': case 'ember': {
        // flackernde Flammenzungen hinter dem Ball
        for (let i = 6; i >= 1; i--) {
          const k = i * 0.016, w = r * (2.6 - i * 0.28) * (0.85 + 0.3 * Math.sin(t * 40 + i * 1.7 + pr.x));
          const ox = Math.sin(t * 30 + i) * r * 0.25;
          ctx.globalAlpha = 0.55 - i * 0.07;
          ctx.drawImage(soft(i > 3 ? '#ff4a10' : '#ff9a2a'), pr.x - pr.vx * k - w + ox, pr.y - pr.vy * k - w + ox, w * 2, w * 2);
        }
        ctx.globalAlpha = 0.95; ctx.drawImage(soft('#ffcf6a'), pr.x - r * 2.2, pr.y - r * 2.2, r * 4.4, r * 4.4);
        ctx.globalAlpha = 1; ctx.drawImage(soft('#ffffff', 1), pr.x - r * 0.9, pr.y - r * 0.9, r * 1.8, r * 1.8);
        break;
      }
      case 'orbLight': {
        ctx.globalAlpha = 0.8; ctx.drawImage(soft('#ffe34d'), pr.x - r * 3.2, pr.y - r * 3.2, r * 6.4, r * 6.4);
        ctx.globalAlpha = 1; ctx.drawImage(soft('#ffffff', 1), pr.x - r, pr.y - r, r * 2, r * 2);
        ctx.strokeStyle = 'rgba(255,250,200,0.9)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          const b = Math.random() * TAU, l = r * rnd(1.6, 2.8);
          ctx.beginPath(); ctx.moveTo(pr.x, pr.y);
          ctx.lineTo(pr.x + Math.cos(b + 0.4) * l * 0.5, pr.y + Math.sin(b + 0.4) * l * 0.5);
          ctx.lineTo(pr.x + Math.cos(b) * l, pr.y + Math.sin(b) * l); ctx.stroke();
        }
        break;
      }
      case 'wisp': {
        for (let i = 3; i >= 1; i--) { ctx.globalAlpha = 0.4 - i * 0.1; ctx.drawImage(soft(col), pr.x - pr.vx * i * 0.02 - r * 2, pr.y - pr.vy * i * 0.02 - r * 2, r * 4, r * 4); }
        ctx.globalAlpha = 1; ctx.drawImage(soft('#fff6c0', 1), pr.x - r, pr.y - r, r * 2, r * 2);
        break;
      }
      case 'glow': {
        const s = soft(col);
        for (let i = 4; i >= 1; i--) { const k = i * 0.018, w = r * (3.2 - i * 0.5); ctx.globalAlpha = 0.5 - i * 0.09; ctx.drawImage(s, pr.x - pr.vx * k - w, pr.y - pr.vy * k - w, w * 2, w * 2); }
        ctx.globalAlpha = 0.9; ctx.drawImage(s, pr.x - r * 3, pr.y - r * 3, r * 6, r * 6);
        ctx.globalAlpha = 1; ctx.drawImage(soft('#ffffff', 1), pr.x - r * 0.9, pr.y - r * 0.9, r * 1.8, r * 1.8);
        break;
      }
      default: {
        // Schweif je nach Stil
        const tc = style === 'shard' || style === 'icelance' ? '#8fe4ff' : style === 'venom' ? '#9cff5e' : style === 'bloodlance' ? '#ff2a4a' : style === 'ghost' ? col : style === 'arrowLight' ? '#ffe34d' : '#ffffff';
        const n = style === 'arrow' || style === 'bone' ? 2 : 4;
        for (let i = n; i >= 1; i--) {
          const k = i * 0.02, w = r * (2.2 - i * 0.3);
          ctx.globalAlpha = (style === 'arrow' ? 0.18 : 0.32) - i * 0.04;
          ctx.drawImage(soft(tc), pr.x - pr.vx * k - w, pr.y - pr.vy * k - w, w * 2, w * 2);
        }
        if (style === 'ghost') {
          // Nachbilder
          const sp = projSprite('ghost', col, r);
          for (let i = 3; i >= 1; i--) {
            ctx.globalAlpha = 0.18 * (4 - i) / 3;
            ctx.save(); ctx.translate(pr.x - pr.vx * i * 0.025, pr.y - pr.vy * i * 0.025); ctx.rotate(a);
            ctx.drawImage(sp.c, -sp.h, -sp.h, sp.h * 2, sp.h * 2); ctx.restore();
          }
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        const sp = projSprite(style, col, r);
        ctx.save(); ctx.translate(pr.x, pr.y);
        ctx.rotate(style === 'glaive' ? t * 22 : a);
        ctx.drawImage(sp.c, -sp.h, -sp.h, sp.h * 2, sp.h * 2);
        ctx.restore();
        if (style === 'arrowLight' && Math.random() < 0.5) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = 'rgba(255,240,150,0.9)'; ctx.lineWidth = 1.2;
          const b = a + Math.PI + rnd(-0.8, 0.8);
          ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x + Math.cos(b) * r * 2 + rnd(-3, 3), pr.y + Math.sin(b) * r * 2 + rnd(-3, 3)); ctx.lineTo(pr.x + Math.cos(b) * r * 3.5, pr.y + Math.sin(b) * r * 3.5); ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** Partikel, die Geschosse im Flug hinterlassen (pro Frame aufgerufen). */
export function projTrail(c, pr, dt) {
  const style = visOf(pr.S).proj;
  if (!style) return;
  pr.trailAcc = (pr.trailAcc || 0) + dt;
  const rate = style === 'fireball' ? 0.03 : style === 'venom' || style === 'shard' || style === 'icelance' || style === 'bloodlance' ? 0.05 : 0.08;
  if (pr.trailAcc < rate) return;
  pr.trailAcc = 0;
  if (style === 'fireball' || style === 'ember') c.part({ x: pr.x, y: pr.y, vx: rnd(-20, 20), vy: rnd(-20, 20), t: 0.5, color: Math.random() < 0.5 ? '#ffb040' : '#ff5a10', s: rnd(1.5, 3), k: 2 });
  else if (style === 'shard' || style === 'icelance') c.part({ x: pr.x, y: pr.y, vx: rnd(-15, 15), vy: rnd(-15, 15), t: 0.45, color: '#cff6ff', s: rnd(1.2, 2.2), k: 3 });
  else if (style === 'venom') c.part({ x: pr.x, y: pr.y, vx: 0, vy: 0, t: 0.6, color: '#7adf3a', s: 2, k: 5, z: 4, vz: 0 });
  else if (style === 'bloodlance') c.part({ x: pr.x, y: pr.y, vx: 0, vy: 0, t: 0.6, color: '#d0102a', s: 2, k: 5, z: 4, vz: 0 });
  else if (style === 'star' || style === 'ghost') c.part({ x: pr.x, y: pr.y, vx: rnd(-10, 10), vy: rnd(-10, 10), t: 0.35, color: pr.color, s: 1.6, k: 0 });
}

// ---------------------------------------------------------------- Treffer-Einschläge
let impactBudget = 0, budgetT = 0;
/** Kleiner Einschlag je Element beim Treffer. */
export function impact(c, S, x, y) {
  if (c.t !== budgetT) { budgetT = c.t; impactBudget = 14; }
  if (impactBudget-- <= 0) return;
  const el = elemOf(S && S.dmg);
  const col = ECOL[el];
  if (el === 'fire') { for (let i = 0; i < 3; i++) c.part({ x, y, vx: rnd(-90, 90), vy: rnd(-110, 30), t: rnd(0.3, 0.6), color: Math.random() < 0.5 ? '#ffb040' : '#ff6a1a', s: rnd(1.5, 3), k: 2 }); }
  else if (el === 'cold') { for (let i = 0; i < 3; i++) c.part({ x, y, vx: rnd(-140, 140), vy: rnd(-140, 140), t: rnd(0.25, 0.45), color: '#dff8ff', s: rnd(2, 3.5), k: 3 }); }
  else if (el === 'light') { for (let i = 0; i < 3; i++) c.part({ x, y, vx: rnd(-220, 220), vy: rnd(-220, 220), t: rnd(0.12, 0.25), color: '#fff3a0', s: rnd(1.5, 2.5), k: 1 }); }
  else if (el === 'chaos') { for (let i = 0; i < 2; i++) c.part({ x, y, vx: rnd(-30, 30), vy: rnd(-30, 30), t: rnd(0.5, 0.8), color: '#5aa83a', s: rnd(4, 7), k: 4 }); }
  else { for (let i = 0; i < 3; i++) c.part({ x, y, vx: rnd(-180, 180), vy: rnd(-180, 180), t: rnd(0.15, 0.3), color: '#ffffff', s: rnd(1.2, 2), k: 1 }); }
  c.fx.push({ type: 'flash', x, y, r: 14, color: col, t: 0.1, max: 0.1 });
}

// ---------------------------------------------------------------- Flächen-Explosionen je Rune
/** Gibt true zurück, wenn ein eigener Effekt gezeichnet wurde (sonst Standard-Ring). */
export function blastFx(c, S, x, y, r, color) {
  const st = visOf(S).blast;
  const ring = (col, tt = 0.3, fill = true) => c.ring(x, y, r, col, tt, fill);
  const burst = (n, spd, col, k = 1, tt = [0.3, 0.6], s = [1.5, 3.5], extra = {}) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = rnd(0.35, 1) * spd;
      c.part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: rnd(tt[0], tt[1]), color: col, s: rnd(s[0], s[1]), k, ...extra });
    }
  };
  const rocks = (n, col = '#5a4a40') => { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = rnd(60, 220); c.part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: rnd(0.6, 1.1), color: col, s: rnd(2.5, 5), k: 6, z: 2, vz: rnd(150, 360) }); } };
  const sfx = c.sfx || {};
  switch (st) {
    case 'iceNova': case 'iceSmash':
      ring('#8fe4ff', 0.35);
      c.fx.push({ type: 'spikes', x, y, r, n: Math.round(10 + r / 12), color: '#cff6ff', t: 0.55, max: 0.55, a0: Math.random() });
      burst(14, r * 2.4, '#e8fbff', 3, [0.3, 0.6], [2, 4]);
      c.decal({ x, y, r: r * 0.9, kind: 'frost', t: 4 });
      sfx.shatter?.();
      return true;
    case 'soulNova':
      ring('#b06bff', 0.4);
      c.fx.push({ type: 'swirl', x, y, r, color: '#c58bff', t: 0.5, max: 0.5 });
      for (let i = 0; i < 12; i++) { const a = Math.random() * TAU; c.part({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: -Math.cos(a) * r * 2.2, vy: -Math.sin(a) * r * 2.2, t: 0.42, color: '#e0c8ff', s: rnd(2.5, 4), k: 0 }); }
      return true;
    case 'bloodNova':
      ring('#ff2a4a', 0.35);
      burst(22, r * 2.2, '#d0102a', 5, [0.5, 0.9], [2, 3.5], { z: 4, vz: 0 });
      c.decal({ x, y, r: r * 0.7, kind: 'blood', t: 6 });
      return true;
    case 'bladeNova':
      ring('#e6dccb', 0.3, false);
      c.fx.push({ type: 'bladefly', x, y, r, n: 8, color: '#f2eee6', t: 0.35, max: 0.35, a0: Math.random() * TAU });
      burst(10, r * 2.5, '#ffffff', 1, [0.15, 0.3]);
      return true;
    case 'quake': case 'smash':
      ring(st === 'quake' ? '#ffe34d' : '#e6dccb', 0.35);
      c.decal({ x, y, r: r * 0.95, kind: 'crack', t: 6, seed: Math.random() });
      burst(10, r * 0.9, '#9a8a7a', 4, [0.6, 1.0], [6, 10]);
      rocks(st === 'smash' ? 8 : 5);
      if (st === 'quake') c.fx.push({ type: 'bolts', x, y, r, n: 6, color: '#ffe34d', t: 0.2, max: 0.2 });
      return true;
    case 'pillar':
      c.fx.push({ type: 'pillar', x, y, r, color: '#ff7a2a', t: 0.5, max: 0.5 });
      burst(8, 80, '#ffb040', 2, [0.4, 0.8], [1.5, 3]);
      c.decal({ x, y, r: r * 0.8, kind: 'scorch', t: 5 });
      return true;
    case 'iceSpikes':
      c.fx.push({ type: 'spikes', x, y, r: r * 0.8, n: 7, color: '#cff6ff', t: 0.5, max: 0.5, a0: Math.random() });
      burst(8, r * 1.8, '#e8fbff', 3, [0.25, 0.5], [2, 3]);
      c.decal({ x, y, r: r * 0.7, kind: 'frost', t: 4 });
      return true;
    case 'lightning': case 'runeBurst': case 'thunder':
      ring('#ffe34d', 0.25);
      c.fx.push({ type: 'flash', x, y, r: r * 1.4, color: '#fff6c0', t: 0.15, max: 0.15 });
      if (st !== 'lightning') c.fx.push({ type: 'bolts', x, y, r: r * 1.1, n: st === 'thunder' ? 8 : 5, color: '#ffe34d', t: 0.2, max: 0.2 });
      burst(8, r * 2.5, '#fff3a0', 1, [0.12, 0.25]);
      c.decal({ x, y, r: r * 0.5, kind: 'scorch', t: 3 });
      return true;
    case 'starImpact': case 'fireImpact':
      ring(st === 'starImpact' ? '#ffe9a0' : '#ff7a2a', 0.3);
      c.fx.push({ type: 'flash', x, y, r: r * 1.3, color: st === 'starImpact' ? '#ffffff' : '#ffb040', t: 0.15, max: 0.15 });
      burst(12, r * 2.2, st === 'starImpact' ? '#fff6d0' : '#ff9a2a', st === 'starImpact' ? 1 : 2, [0.25, 0.5]);
      c.decal({ x, y, r: r * 0.6, kind: 'scorch', t: 4 });
      return true;
    case 'craterFire': case 'craterIce': {
      const fire = st === 'craterFire';
      ring(fire ? '#ff7a2a' : '#8fe4ff', 0.45);
      c.fx.push({ type: 'flash', x, y, r: r * 1.8, color: fire ? '#ffd080' : '#e8fbff', t: 0.22, max: 0.22 });
      c.fx.push({ type: 'shock', x, y, r: r * 1.6, color: '#ffffff', t: 0.35, max: 0.35 });
      burst(18, r * 2.4, fire ? '#ff9a2a' : '#dff8ff', fire ? 2 : 3, [0.4, 0.9], [2, 4]);
      burst(6, r * 0.6, fire ? '#3a2a20' : '#a0c8d8', 4, [0.8, 1.3], [8, 14]);
      rocks(10, fire ? '#4a3020' : '#7ab0c8');
      c.decal({ x, y, r: r * 1.05, kind: fire ? 'crater' : 'frost', t: 9 });
      sfx.explode?.(fire ? 'fire' : 'cold');
      return true;
    }
    case 'poisonBurst':
      ring('#9cff5e', 0.3);
      burst(10, r * 0.8, '#4a9a2a', 4, [0.8, 1.3], [7, 12]);
      burst(10, r * 2, '#9cff5e', 5, [0.4, 0.8], [1.5, 3], { z: 4, vz: 0 });
      return true;
    case 'spikes':
      c.fx.push({ type: 'spikes', x, y, r: r * 0.9, n: 9, color: '#c8ccd8', t: 0.45, max: 0.45, a0: Math.random() });
      burst(8, r * 2, '#ffffff', 1, [0.15, 0.3]);
      c.decal({ x, y, r: r * 0.5, kind: 'blood', t: 3 });
      return true;
    default:
      return false;
  }
}

/** Fallende Objekte (Meteor, Komet, Sternschnuppe, Feuerregen) während der Vorwarnzeit. */
export function fallFx(c, S, x, y, delay) {
  const st = visOf(S).fall;
  if (!st) return;
  c.fx.push({ type: 'fall', kind: st, x, y, sx: x - 150, sy: y - 330, t: delay, max: delay });
}

// ---------------------------------------------------------------- Zeichnen besonderer Effekte
const projBlade = (col) => projSprite('ghost', col, 6);
/** Zeichnet Spezial-Effekte; gibt true zurück, wenn der Typ behandelt wurde. */
export function drawFx(ctx, f, c) {
  const k = f.t / f.max, p = 1 - k;
  switch (f.type) {
    case 'flash': {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.drawImage(soft(f.color), f.x - f.r * 1.5, f.y - f.r * 1.5, f.r * 3, f.r * 3);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      return true;
    }
    case 'shock': {
      const rr = f.r * (0.2 + 0.8 * p);
      ctx.strokeStyle = rgba(f.color, 0.55 * k); ctx.lineWidth = 10 * k + 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, TAU); ctx.stroke();
      ctx.strokeStyle = rgba(f.color, 0.25 * k); ctx.lineWidth = 24 * k + 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, rr * 0.92, 0, TAU); ctx.stroke();
      return true;
    }
    case 'spikes': {
      const grow = Math.min(1, p * 3.5), fade = Math.min(1, k * 2.5);
      ctx.globalAlpha = fade;
      for (let i = 0; i < f.n; i++) {
        const a = f.a0 * TAU + (i * TAU) / f.n + Math.sin(i * 7.1) * 0.15;
        const d = f.r * (0.55 + 0.4 * ((i * 37) % 10) / 10);
        const len = (14 + (i % 3) * 6) * grow, w = 5 + (i % 2) * 2;
        const bx = f.x + Math.cos(a) * d, by = f.y + Math.sin(a) * d;
        const tx = bx + Math.cos(a) * len, ty = by + Math.sin(a) * len - len * 0.6;
        const nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
        ctx.beginPath(); ctx.moveTo(bx + nx, by + ny); ctx.lineTo(tx, ty); ctx.lineTo(bx - nx, by - ny); ctx.closePath();
        const gr = ctx.createLinearGradient(bx, by, tx, ty); gr.addColorStop(0, shade(f.color, -0.25)); gr.addColorStop(1, '#ffffff');
        ctx.fillStyle = gr; ctx.fill();
        ctx.strokeStyle = rgba('#ffffff', 0.8); ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade * 0.35;
      ctx.drawImage(soft(f.color), f.x - f.r * 1.3, f.y - f.r * 1.3, f.r * 2.6, f.r * 2.6);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      return true;
    }
    case 'swirl': {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(f.color, 0.6 * k); ctx.lineWidth = 3;
      for (let j = 0; j < 4; j++) {
        ctx.beginPath();
        for (let i = 0; i <= 20; i++) {
          const q = i / 20, a = j * (TAU / 4) + q * 3 + p * 6, rr = f.r * (1 - q) * (1 - p * 0.5);
          const X = f.x + Math.cos(a) * rr, Y = f.y + Math.sin(a) * rr;
          i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      return true;
    }
    case 'bladefly': {
      const sp = projBlade(f.color);
      for (let i = 0; i < f.n; i++) {
        const a = f.a0 + (i * TAU) / f.n + p * 2;
        const rr = f.r * (0.2 + 0.9 * p);
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.save(); ctx.translate(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr); ctx.rotate(a + Math.PI / 2 + p * 10);
        ctx.drawImage(sp.c, -sp.h, -sp.h, sp.h * 2, sp.h * 2); ctx.restore();
      }
      ctx.globalAlpha = 1;
      return true;
    }
    case 'bolts': {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < f.n; i++) {
        const a = (i * TAU) / f.n + Math.random() * 0.4;
        let x = f.x, y = f.y;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let s = 1; s <= 4; s++) { const d = (f.r * s) / 4; x = f.x + Math.cos(a) * d + rnd(-10, 10); y = f.y + Math.sin(a) * d + rnd(-10, 10); ctx.lineTo(x, y); }
        ctx.strokeStyle = rgba(f.color, 0.4 * k); ctx.lineWidth = 7; ctx.stroke();
        ctx.strokeStyle = rgba('#ffffff', k); ctx.lineWidth = 1.8; ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      return true;
    }
    case 'pillar': {
      ctx.globalCompositeOperation = 'lighter';
      const h = f.r * 2.2 * Math.min(1, p * 4), fade = Math.min(1, k * 2);
      for (let i = 0; i < 7; i++) {
        const q = i / 6, w = f.r * (1 - q * 0.6) * (0.9 + 0.2 * Math.sin(c.t * 30 + i));
        ctx.globalAlpha = fade * (0.55 - q * 0.3);
        ctx.drawImage(soft(i < 2 ? '#ffd080' : i < 5 ? '#ff8a2a' : '#ff3a10'), f.x - w, f.y - h * q - w, w * 2, w * 2);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      return true;
    }
    case 'fall': {
      const q = Math.pow(p, 1.5); // beschleunigt
      const x = f.sx + (f.x - f.sx) * q, y = f.sy + (f.y - f.sy) * q;
      // wachsender Schatten am Ziel
      ctx.globalAlpha = 0.25 + 0.45 * q;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath(); ctx.ellipse(f.x, f.y, 10 + 22 * q, 5 + 11 * q, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      const fire = f.kind === 'meteor' || f.kind === 'fire';
      const col = f.kind === 'comet' ? '#8fe4ff' : f.kind === 'star' ? '#fff2b0' : '#ff7a2a';
      ctx.globalCompositeOperation = 'lighter';
      const dx = f.x - f.sx, dy = f.y - f.sy, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      const size = f.kind === 'meteor' || f.kind === 'comet' ? 26 : 11;
      for (let i = 7; i >= 1; i--) {
        const w = size * (1.6 - i * 0.15);
        ctx.globalAlpha = 0.5 - i * 0.055;
        ctx.drawImage(soft(i > 4 ? shade(col, -0.3) : col), x - ux * i * 9 - w, y - uy * i * 9 - w, w * 2, w * 2);
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(soft(fire ? '#ffd080' : '#ffffff'), x - size * 1.5, y - size * 1.5, size * 3, size * 3);
      ctx.globalCompositeOperation = 'source-over';
      if (f.kind === 'meteor' || f.kind === 'comet') {
        ctx.fillStyle = f.kind === 'meteor' ? '#3a2418' : '#b8e0f0';
        ctx.strokeStyle = f.kind === 'meteor' ? '#ff8a3a' : '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 7; i++) { const a = (i * TAU) / 7 + c.t * 3, rr = size * 0.55 * (0.8 + 0.25 * Math.sin(i * 3.7)); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      return true;
    }
    default:
      return false;
  }
}

// ---------------------------------------------------------------- Zonen, Auren, Fallen, Klingenkreise
export function drawZone(ctx, z, c, runeCircle) {
  const st = visOf(z.S).zone;
  const a = Math.min(1, z.t / 0.4) * Math.min(1, (z.max - z.t) / 0.25 + 0.2);
  if (st === 'cloud' || st === 'acid') {
    const green = st === 'cloud' ? '#7adf3a' : '#c8ff3a';
    if (st === 'acid') {
      ctx.fillStyle = rgba('#2a4a08', 0.5 * a); ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(green, 0.7 * a); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r * (0.95 + 0.03 * Math.sin(c.t * 3 + z.x)), 0, TAU); ctx.stroke();
      ctx.fillStyle = rgba('#e8ff9a', 0.7 * a);
      for (let i = 0; i < 6; i++) {
        const q = (c.t * 0.9 + i / 6 + z.x * 0.013) % 1;
        const bx = z.x + Math.cos(i * 2.4 + z.y) * z.r * 0.6 * ((i % 3) / 3 + 0.3), by = z.y + Math.sin(i * 2.4 + z.x) * z.r * 0.6 * ((i % 3) / 3 + 0.3);
        ctx.globalAlpha = (1 - q) * a; ctx.beginPath(); ctx.arc(bx, by, 2 + q * 6, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'lighter';
    const puffs = st === 'cloud' ? 9 : 4;
    for (let i = 0; i < puffs; i++) {
      const ang = i * 2.399 + c.t * (0.25 + (i % 3) * 0.1) + z.x * 0.01;
      const d = z.r * (0.25 + 0.55 * ((i * 13) % 7) / 7);
      const w = z.r * (0.45 + 0.15 * Math.sin(c.t * 1.3 + i));
      ctx.globalAlpha = (st === 'cloud' ? 0.22 : 0.12) * a;
      ctx.drawImage(soft(green), z.x + Math.cos(ang) * d - w, z.y + Math.sin(ang) * d - w, w * 2, w * 2);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    return true;
  }
  if (st === 'vortex') {
    ctx.fillStyle = rgba('#0a0412', 0.6 * a); ctx.beginPath(); ctx.arc(z.x, z.y, z.r * 0.95, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    for (let j = 0; j < 3; j++) {
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const q = i / 24, ang = j * (TAU / 3) + q * 4.2 - c.t * 2.2, rr = z.r * q;
        const X = z.x + Math.cos(ang) * rr, Y = z.y + Math.sin(ang) * rr;
        i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      }
      ctx.strokeStyle = rgba('#b06bff', 0.55 * a); ctx.lineWidth = 6; ctx.stroke();
      ctx.strokeStyle = rgba('#f0d8ff', 0.6 * a); ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.globalAlpha = 0.6 * a; ctx.drawImage(soft('#9a4dff'), z.x - z.r * 0.5, z.y - z.r * 0.5, z.r, z.r);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    return true;
  }
  return false;
}

/** Partikel für Auren (pro Frame). */
export function auraTick(c, sk, dt) {
  const st = visOf(sk.S).aura;
  if (!st) return;
  sk.fxAcc = (sk.fxAcc || 0) + dt;
  if (sk.fxAcc < 0.06) return;
  sk.fxAcc = 0;
  const p = c.player, R = sk.S.area;
  const a = Math.random() * TAU, d = R * Math.sqrt(Math.random());
  const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
  if (st === 'embers') c.part({ x, y, vx: rnd(-10, 10), vy: rnd(-40, -10), t: rnd(0.6, 1.1), color: Math.random() < 0.5 ? '#ffb040' : '#ff6a1a', s: rnd(1.5, 3), k: 2 });
  else if (st === 'snow') c.part({ x, y, vx: Math.cos(a + 1.6) * 40, vy: Math.sin(a + 1.6) * 40, t: rnd(0.8, 1.4), color: '#ffffff', s: rnd(2, 3.5), k: 7 });
  else if (st === 'blood') c.part({ x: p.x + Math.cos(a) * R * 0.9, y: p.y + Math.sin(a) * R * 0.9, vx: -Math.cos(a) * 50, vy: -Math.sin(a) * 50, t: rnd(0.5, 0.9), color: '#d0102a', s: rnd(2, 3), k: 5, z: 3, vz: 30 });
}
export function drawAura(ctx, sk, c, runeCircle) {
  const st = visOf(sk.S).aura;
  const p = c.player, R = sk.S.area;
  const col = st === 'snow' ? '#8fe4ff' : st === 'blood' ? '#ff2a4a' : st === 'embers' ? '#ff7a2a' : null;
  if (!col) return false;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.16 + 0.05 * Math.sin(c.t * 4);
  ctx.drawImage(soft(col), p.x - R * 1.1, p.y - R * 1.1, R * 2.2, R * 2.2);
  ctx.globalAlpha = 0.45;
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((st === 'snow' ? -1 : 1) * c.t * 0.5);
  ctx.drawImage(runeCircle(col, 256, 16, st === 'snow' ? 3 : st === 'blood' ? 8 : 7), -R, -R, R * 2, R * 2);
  ctx.restore();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  return true;
}

const trapCache = new Map();
function trapSprite(st, color) {
  const key = st + color + SPR;
  let s = trapCache.get(key);
  if (s) return s;
  const px = Math.ceil(30 * SPR);
  const cv = mk(px); const g = cv.getContext('2d');
  g.translate(px / 2, px / 2); g.scale(SPR, SPR);
  if (st === 'canister') {
    g.fillStyle = '#2a3a20'; g.strokeStyle = '#0a1008'; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(0, 0, 9, 9, 0, 0, TAU); g.fill(); g.stroke();
    g.shadowColor = '#9cff5e'; g.shadowBlur = 8 * SPR;
    g.fillStyle = '#9cff5e'; g.beginPath(); g.arc(0, 0, 4.5, 0, TAU); g.fill();
    g.shadowBlur = 0; g.strokeStyle = '#5a7a40'; g.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) { const a = (i * TAU) / 3; g.beginPath(); g.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); g.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); g.stroke(); }
  } else {
    g.fillStyle = '#9aa0ae'; g.strokeStyle = '#2a2a34'; g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, q = i % 2 ? 3 : 11; g.lineTo(Math.cos(a) * q, Math.sin(a) * q); }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#d8dce8'; g.beginPath(); g.arc(0, 0, 2.5, 0, TAU); g.fill();
  }
  s = { c: cv, h: 15 };
  trapCache.set(key, s);
  return s;
}
export function drawTrap(ctx, tr, c, runeCircle) {
  const st = visOf(tr.S).trap;
  let x = tr.x, y = tr.y;
  if (tr.fly > 0) { const k = 1 - tr.fly / 0.25; x = tr.sx + (tr.x - tr.sx) * k; y = tr.sy + (tr.y - tr.sy) * k - Math.sin(k * Math.PI) * 40; }
  const armed = tr.arm <= 0;
  if (st === 'canister' || st === 'caltrop') {
    const sp = trapSprite(st, tr.color);
    ctx.globalAlpha = armed ? 1 : 0.6;
    ctx.save(); ctx.translate(x, y); ctx.rotate(st === 'caltrop' ? c.t * 0.5 : 0);
    ctx.drawImage(sp.c, -sp.h, -sp.h, sp.h * 2, sp.h * 2);
    ctx.restore();
    if (armed) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(c.t * 6 + tr.x);
      ctx.drawImage(soft(tr.color), x - 22, y - 22, 44, 44);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    return true;
  }
  ctx.save(); ctx.translate(x, y); ctx.rotate(c.t * 2);
  ctx.globalAlpha = armed ? 1 : 0.5;
  ctx.drawImage(runeCircle(tr.color, 64, 6, 9), -14, -14, 28, 28);
  ctx.restore();
  if (armed) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.4 + 0.3 * Math.sin(c.t * 8 + tr.x);
    ctx.drawImage(soft(tr.color), x - 18, y - 18, 36, 36);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
  return true;
}

/** Ein Element des Klingenkreises zeichnen. */
export function drawOrbitItem(ctx, sk, x, y, a, c) {
  const st = visOf(sk.S).orbit || 'knife';
  ctx.globalCompositeOperation = 'lighter';
  const col = st === 'iceorb' ? '#8fe4ff' : st === 'shadow' ? '#9a4dff' : st === 'storm' ? '#ffe34d' : '#e6dccb';
  const R = sk.S.area, p = c.player;
  for (let j = 1; j <= 3; j++) {
    const b = a - j * 0.12;
    ctx.globalAlpha = 0.32 - j * 0.08;
    ctx.drawImage(soft(col), p.x + Math.cos(b) * R - 14, p.y + Math.sin(b) * R - 14, 28, 28);
  }
  ctx.globalAlpha = 0.85; ctx.drawImage(soft(col), x - 16, y - 16, 32, 32);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (st === 'iceorb') {
    const gr = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 9);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#8fe4ff'); gr.addColorStop(1, '#2a7ab0');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill();
    return;
  }
  ctx.save(); ctx.translate(x, y); ctx.rotate(a + c.t * 12);
  ctx.fillStyle = st === 'shadow' ? '#2a1040' : st === 'storm' ? '#fff6b0' : '#f2eee6';
  ctx.strokeStyle = st === 'shadow' ? '#c58bff' : shade(col, -0.5); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(0, -4); ctx.lineTo(13, 0); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  if (st === 'storm' && Math.random() < 0.4) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,240,150,0.9)'; ctx.lineWidth = 1.2;
    const b = Math.random() * TAU;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(b) * 10 + rnd(-3, 3), y + Math.sin(b) * 10 + rnd(-3, 3)); ctx.lineTo(x + Math.cos(b) * 18, y + Math.sin(b) * 18); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ---------------------------------------------------------------- Bodenspuren
export function drawDecal(ctx, d, alpha, shadowSprite) {
  switch (d.kind) {
    case 'crater': {
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = '#0a0604'; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * 0.75, d.r * 0.6, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba('#3a2a20', alpha); ctx.lineWidth = 6; ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * Math.min(1, d.t / 6) * 0.8;
      ctx.strokeStyle = '#ff6a1a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * 0.72, d.r * 0.57, 0, 0, TAU); ctx.stroke();
      ctx.drawImage(soft('#ff5a10'), d.x - d.r * 0.5, d.y - d.r * 0.4, d.r, d.r * 0.8);
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'crack': {
      ctx.globalAlpha = alpha * 0.45;
      ctx.strokeStyle = '#140c08'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      const n = 6, sd = d.seed || 0.5, R0 = d.r * 0.65;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = (i * TAU) / n + sd * 3;
        let x = d.x, y = d.y;
        ctx.moveTo(x, y);
        for (let s = 1; s <= 3; s++) { const rr = (R0 * s) / 3; x = d.x + Math.cos(a + Math.sin(i * 5 + s) * 0.3) * rr; y = d.y + Math.sin(a + Math.sin(i * 5 + s) * 0.3) * rr; ctx.lineTo(x, y); }
      }
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.35;
      ctx.drawImage(shadowSprite, d.x - d.r * 0.6, d.y - d.r * 0.35, d.r * 1.2, d.r * 0.7);
      break;
    }
    case 'frost': {
      ctx.globalAlpha = alpha * 0.4;
      ctx.drawImage(soft('#cff6ff'), d.x - d.r, d.y - d.r * 0.8, d.r * 2, d.r * 1.6);
      break;
    }
    case 'blood': {
      ctx.globalAlpha = alpha * 0.55;
      ctx.fillStyle = '#5a0010';
      for (let i = 0; i < 5; i++) { const a = i * 1.7 + d.x, rr = d.r * (0.2 + (i % 3) * 0.2); ctx.beginPath(); ctx.ellipse(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr * 0.6, 4 + (i % 2) * 3, 3 + (i % 2) * 2, 0, 0, TAU); ctx.fill(); }
      break;
    }
    default: {
      ctx.globalAlpha = alpha * 0.5;
      ctx.drawImage(shadowSprite, d.x - d.r, d.y - d.r * 0.6, d.r * 2, d.r * 1.2);
      ctx.globalAlpha = alpha * 0.22;
      ctx.drawImage(soft(d.col || '#ff7a2a'), d.x - d.r * 0.7, d.y - d.r * 0.5, d.r * 1.4, d.r);
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- Partikel zeichnen (alle Arten)
export function drawParticles(ctx, parts, lowGfx, t) {
  // normale Mischung zuerst (Rauch, Brocken, Tropfen), dann leuchtende
  for (const pt of parts) {
    if (pt.k !== 4 && pt.k !== 5 && pt.k !== 6) continue;
    const k = pt.t / pt.max;
    if (pt.k === 4) {
      const s = pt.s * (1 + (1 - k) * 1.5) * 2.4;
      ctx.globalAlpha = k * 0.45;
      ctx.drawImage(soft(pt.color), pt.x - s / 2, pt.y - s / 2, s, s);
    } else {
      const z = pt.z || 0;
      if (z > 1) { ctx.globalAlpha = 0.3 * k; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(pt.x, pt.y, pt.s * 0.8, pt.s * 0.4, 0, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.fillStyle = pt.color;
      if (pt.k === 6) { ctx.save(); ctx.translate(pt.x, pt.y - z); ctx.rotate(pt.rot || 0); ctx.fillRect(-pt.s / 2, -pt.s / 2, pt.s, pt.s * 0.8); ctx.restore(); }
      else { ctx.beginPath(); ctx.ellipse(pt.x, pt.y - z, pt.s * 0.6, pt.s * (z > 1 ? 0.9 : 0.5), 0, 0, TAU); ctx.fill(); }
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  for (const pt of parts) {
    if (pt.k === 4 || pt.k === 5 || pt.k === 6) continue;
    const k = pt.t / pt.max;
    if (pt.k === 1 || lowGfx) {
      ctx.strokeStyle = rgba(pt.color, k); ctx.lineWidth = pt.s * 0.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x - pt.vx * 0.04, pt.y - pt.vy * 0.04); ctx.stroke();
    } else if (pt.k === 3) {
      ctx.globalAlpha = k;
      ctx.fillStyle = pt.color;
      ctx.save(); ctx.translate(pt.x, pt.y); ctx.rotate(pt.rot || 0);
      ctx.beginPath(); ctx.moveTo(pt.s * 1.4, 0); ctx.lineTo(0, -pt.s * 0.5); ctx.lineTo(-pt.s * 1.4, 0); ctx.lineTo(0, pt.s * 0.5); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (pt.k === 7) {
      ctx.globalAlpha = Math.min(1, k * 2) * 0.9;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      ctx.save(); ctx.translate(pt.x, pt.y); ctx.rotate(pt.rot || 0);
      ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = (i * Math.PI) / 3; ctx.moveTo(Math.cos(a) * pt.s, Math.sin(a) * pt.s); ctx.lineTo(-Math.cos(a) * pt.s, -Math.sin(a) * pt.s); } ctx.stroke();
      ctx.restore();
    } else {
      const flick = pt.k === 2 ? 0.6 + 0.4 * Math.sin(t * 40 + pt.x) : 1;
      ctx.globalAlpha = k * flick;
      const s = pt.s * 3.2;
      ctx.drawImage(soft(pt.color), pt.x - s / 2, pt.y - s / 2, s, s);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/** Partikel-Physik (Aufsteigen, Schwerkraft mit Höhe, Rotation). */
export function updateParticles(parts, dt) {
  const damp = Math.pow(0.06, dt);
  for (const p of parts) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt;
    if (p.k === 5 || p.k === 6) {
      p.vz = (p.vz || 0) - 700 * dt; p.z = (p.z || 0) + p.vz * dt;
      if (p.z < 0) { p.z = 0; p.vz = -p.vz * 0.3; p.vx *= 0.5; p.vy *= 0.5; }
      p.rot = (p.rot || 0) + dt * 6;
      p.vx *= Math.pow(0.5, dt); p.vy *= Math.pow(0.5, dt);
    } else if (p.k === 2) { p.vy -= 60 * dt; p.vx *= damp; }
    else if (p.k === 4) { p.vx *= damp; p.vy *= damp; p.vy -= 8 * dt; }
    else if (p.k === 7) { p.rot = (p.rot || 0) + dt * 2; }
    else { p.vx *= damp; p.vy *= damp; if (p.k === 3) p.rot = (p.rot || 0) + dt * 10; }
  }
}
