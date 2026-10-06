(() => {
  'use strict';

  // ================= Helpers =================
  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function hslHex(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const to = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
    return '#' + to(f(0)) + to(f(8)) + to(f(4));
  }
  // 24 vorberechnete Regenbogenfarben (hält den Glow-Cache klein)
  const RAINBOW = Array.from({ length: 24 }, (_, i) => hslHex(i * 15, 100, 60));
  const rainbow = (deg) => RAINBOW[Math.floor((((deg % 360) + 360) % 360) / 15)];

  // ================= Speicherstand =================
  const SAVE_KEY = 'neonrush.v1';
  const DEFAULTS = { best: 0, coins: 0, skin: 'cyan', owned: ['cyan'], sound: true, vibrate: true, games: 0 };
  const save = (() => {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); }
    catch (e) { return Object.assign({}, DEFAULTS); }
  })();
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* privater Modus */ }
  }

  const SKINS = [
    { id: 'cyan', name: 'Cyan', color: '#2ef2ff', trail: '#2ef2ff', price: 0 },
    { id: 'pink', name: 'Pink', color: '#ff3df0', trail: '#ff3df0', price: 40 },
    { id: 'lime', name: 'Lime', color: '#9dff3d', trail: '#3dff8b', price: 80 },
    { id: 'gold', name: 'Gold', color: '#ffd23d', trail: '#ff9a2e', price: 150 },
    { id: 'fire', name: 'Inferno', color: '#ff7a2e', trail: '#ff2e4d', price: 250 },
    { id: 'rainbow', name: 'Regenbogen', color: '#ffffff', trail: 'rainbow', price: 500 },
  ];
  const curSkin = () => SKINS.find((s) => s.id === save.skin) || SKINS[0];

  const REVIVE_COST = 30;
  const C = { wall: '#ff2e88', block: '#ff4d6d', mover: '#ff9a2e', spin: '#b44dff', gem: '#ffe066' };
  const PCOL = { shield: '#4dff9a', slow: '#7d8cff', magnet: '#ff5ad1' };
  const PLABEL = { shield: 'SCHILD', slow: 'ZEITLUPE', magnet: 'MAGNET' };
  const PDUR = { slow: 6, magnet: 8 };

  // ================= Sound (synthetisch, keine Dateien nötig) =================
  let actx = null;
  function audio() {
    if (!save.sound) return null;
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, dur, type = 'sine', vol = 0.12, slide = 0, delay = 0) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol) {
    const a = audio(); if (!a) return;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource(), g = a.createGain();
    src.buffer = buf; g.gain.value = vol;
    src.connect(g).connect(a.destination);
    src.start();
  }
  const sfx = {
    click: () => tone(520, 0.05, 'triangle', 0.08),
    start: () => { tone(330, 0.1, 'square', 0.06); tone(660, 0.15, 'square', 0.06, 0, 0.1); },
    gem: (c) => tone(700 * Math.pow(1.045, Math.min(c, 30)), 0.08, 'triangle', 0.1),
    combo: () => { tone(880, 0.1, 'square', 0.06); tone(1320, 0.14, 'square', 0.06, 0, 0.08); },
    power: () => { tone(440, 0.12, 'square', 0.07, 440); tone(880, 0.16, 'square', 0.06, 440, 0.09); },
    near: () => tone(1400, 0.07, 'sine', 0.06, -500),
    shield: () => { noise(0.15, 0.2); tone(300, 0.25, 'square', 0.08, 500); },
    hit: () => { noise(0.45, 0.35); tone(180, 0.5, 'sawtooth', 0.14, -140); },
    deny: () => tone(150, 0.15, 'square', 0.08),
    tick: () => tone(600, 0.06, 'triangle', 0.07),
  };
  function buzz(p) {
    if (save.vibrate && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* egal */ } }
  }

  // ================= Canvas & Layout =================
  // Spielfeld-Koordinaten: x in [0,100], y in "Einheiten" (u Pixel pro Einheit).
  const cv = $('game');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1, FX = 0, FW = 0, u = 1, FH = 100;
  let bgGrad = null;
  const glowCache = new Map();

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    FW = Math.min(W, H * 0.62);
    FX = (W - FW) / 2;
    u = FW / 100;
    FH = H / u;
    bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#07051a');
    bgGrad.addColorStop(0.6, '#120a33');
    bgGrad.addColorStop(1, '#2a0b3d');
    glowCache.clear();
  }
  window.addEventListener('resize', resize);
  resize();

  const playerY = () => FH * 0.78;

  function glowSprite(color, r) {
    const key = color + '|' + Math.round(r);
    let c = glowCache.get(key);
    if (!c) {
      const s = Math.max(2, Math.ceil(r * 2 * DPR));
      c = document.createElement('canvas');
      c.width = c.height = s;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, rgba(color, 0.9));
      gr.addColorStop(0.3, rgba(color, 0.35));
      gr.addColorStop(1, rgba(color, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, s, s);
      glowCache.set(key, c);
    }
    return c;
  }
  function drawGlow(color, x, y, r) {
    ctx.drawImage(glowSprite(color, r), x - r, y - r, r * 2, r * 2);
  }

  const stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), z: rand(0.2, 1), s: rand(0.5, 1.6) }));

  // ================= Spielzustand =================
  let state = 'menu'; // menu | play | paused | dying | over
  let bgDist = 0;
  let clock = 0;
  const P = { x: 50, tx: 50, r: 3.2, trail: [] };
  const G = {};
  const parts = [];

  function resetGame() {
    Object.assign(G, {
      t: 0, d: 0, dist: 0, speed: 55, bonus: 0, score: 0,
      gemsRun: 0, gemsCommitted: 0, combo: 0, mult: 1,
      obs: [], gems: [], pups: [], texts: [],
      nextSpawn: 25, shake: 0, flash: 0,
      slow: 0, magnet: 0, shield: false, inv: 0, freeze: 0,
      revived: false, dieT: 0, lastTick: 0,
    });
    P.x = P.tx = 50; P.trail.length = 0; parts.length = 0;
  }
  resetGame();

  // ================= Hindernis-Muster =================
  function addRect(x, y, w, h, c, extra) {
    const o = { type: 'rect', x, y, w, h, c, g: rgba(c, 0.22), minD: 99, passed: false, dead: false };
    if (extra) Object.assign(o, extra);
    G.obs.push(o);
    return o;
  }
  function addGem(x, y) { G.gems.push({ x: clamp(x, 3, 97), y, r: 1.9, ph: Math.random() * 6, dead: false }); }

  // Jedes Muster startet bei y0 (knapp über dem Bildschirm) und wächst nach oben. Rückgabe: Höhe.
  function patWall(y0, d) {
    const gap = lerp(30, 18, d), h = 4;
    const gx = rand(gap / 2 + 3, 100 - gap / 2 - 3);
    addRect(0, y0 - h, gx - gap / 2, h, C.wall);
    addRect(gx + gap / 2, y0 - h, 100 - (gx + gap / 2), h, C.wall);
    for (let i = 0; i < 3; i++) addGem(gx, y0 - h / 2 - i * 7);
    return h + 16;
  }
  function patBlocks(y0, d) {
    const lanes = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    const n = d > 0.45 ? 3 : 2;
    let top = 0;
    for (let i = 0; i < n; i++) {
      const w = rand(14, 22), h = rand(4, 7);
      const x = lanes[i] * 25 + rand(0, 25 - w);
      const yy = y0 - i * rand(10, 16);
      addRect(x, yy - h, w, h, C.block);
      top = Math.max(top, y0 - (yy - h));
    }
    addGem(lanes[n] * 25 + 12.5, y0 - top / 2); // eine Spur bleibt immer frei
    return top;
  }
  function patMover(y0, d) {
    const n = d > 0.35 ? 2 : 1, h = 4;
    let top = 0;
    for (let i = 0; i < n; i++) {
      const w = rand(24, 32), yy = y0 - i * 24;
      const dir = (i % 2 ? 1 : -1) * (Math.random() < 0.5 ? 1 : -1);
      addRect(rand(0, 100 - w), yy - h, w, h, C.mover, { vx: dir * rand(22, 34) * (1 + d * 0.8) });
      top = y0 - (yy - h);
    }
    addGem(rand(15, 85), y0 - top - 6);
    return top + 8;
  }
  function patSpinner(y0, d) {
    const len = rand(30, 40);
    const cx = rand(len / 2 + 10, 100 - len / 2 - 10);
    const cy = y0 - len / 2;
    G.obs.push({
      type: 'bar', cx, cy, len, th: 3, ang: Math.random() * Math.PI,
      va: pick([-1, 1]) * rand(1.6, 2.4) * (1 + d * 0.6),
      c: C.spin, g: rgba(C.spin, 0.22), minD: 99, passed: false, dead: false,
    });
    addGem(cx < 50 ? cx + len / 2 + 7 : cx - len / 2 - 7, cy);
    return len + 2;
  }
  function patZig(y0, d) {
    const rows = d > 0.5 ? 3 : 2, h = 4, span = lerp(62, 70, d), step = 26;
    let left = Math.random() < 0.5;
    for (let i = 0; i < rows; i++) {
      const yy = y0 - i * step;
      if (left) addRect(0, yy - h, span, h, C.wall);
      else addRect(100 - span, yy - h, span, h, C.wall);
      addGem(left ? span + (100 - span) / 2 : (100 - span) / 2, yy - h / 2);
      left = !left;
    }
    return (rows - 1) * step + h;
  }
  function patGems(y0) {
    const n = 8, cx = rand(25, 75), amp = rand(10, 22);
    for (let i = 0; i < n; i++) addGem(cx + Math.sin(i * 0.7) * amp, y0 - i * 6);
    return n * 6;
  }

  function choosePattern(d) {
    if (G.t < 4) return Math.random() < 0.5 ? patGems : patWall;
    const list = [
      [patWall, 3], [patBlocks, 3], [patGems, 1.4],
      [patMover, d > 0.08 ? 2.5 : 0], [patSpinner, d > 0.18 ? 2 : 0], [patZig, d > 0.3 ? 2 : 0],
    ];
    let total = 0;
    for (const [, w] of list) total += w;
    let r = Math.random() * total;
    for (const [fn, w] of list) { if ((r -= w) <= 0) return fn; }
    return patWall;
  }

  function spawnNext() {
    const d = G.d, y0 = -6;
    const h = choosePattern(d)(y0, d);
    const gap = lerp(55, 28, d);
    if (G.t > 8 && Math.random() < 0.16) {
      G.pups.push({ x: rand(12, 88), y: y0 - h - gap / 2, kind: pick(['shield', 'slow', 'magnet']), ph: 0, dead: false });
    }
    G.nextSpawn = G.dist + h + gap;
  }

  // ================= Kollision =================
  function rectDist(o, px, py) {
    const cx = clamp(px, o.x, o.x + o.w), cy = clamp(py, o.y, o.y + o.h);
    return Math.hypot(px - cx, py - cy);
  }
  function barDist(o, px, py) {
    const dx = Math.cos(o.ang) * o.len / 2, dy = Math.sin(o.ang) * o.len / 2;
    const ax = o.cx - dx, ay = o.cy - dy, bx = o.cx + dx, by = o.cy + dy;
    const vx = bx - ax, vy = by - ay;
    const t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy), 0, 1);
    return Math.hypot(px - (ax + vx * t), py - (ay + vy * t)) - o.th / 2;
  }
  const obsBottom = (o) => (o.type === 'rect' ? o.y : o.cy - o.len / 2);

  // ================= Effekte =================
  function burst(x, y, color, n, spd) {
    for (let i = 0; i < n; i++) {
      if (parts.length > 400) parts.shift();
      const a = Math.random() * Math.PI * 2, v = rand(0.3, 1) * spd, life = rand(0.4, 0.9);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, c: color, s: rand(0.5, 1.2) });
    }
  }
  function addText(x, y, text, c, size = 1) {
    G.texts.push({ x, y, text, c, size, life: 0.9, max: 0.9 });
  }
  function updateParticles(dt) {
    const damp = Math.pow(0.08, dt);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= damp; p.vy *= damp;
      if ((p.life -= dt) <= 0) parts.splice(i, 1);
    }
    for (let i = G.texts.length - 1; i >= 0; i--) {
      const t = G.texts[i];
      t.y -= 14 * dt;
      if ((t.life -= dt) <= 0) G.texts.splice(i, 1);
    }
  }

  // ================= Spiel-Ereignisse =================
  function collectGem(g) {
    G.combo++; G.gemsRun++;
    const m = Math.min(5, 1 + Math.floor(G.combo / 6));
    if (m > G.mult) {
      G.mult = m;
      addText(P.x, playerY() - 12, `x${m} COMBO!`, C.gem, 1.3);
      sfx.combo();
    }
    G.bonus += 10 * G.mult;
    burst(g.x, g.y, C.gem, 8, 30);
    sfx.gem(G.combo);
  }
  function loseCombo() {
    if (G.mult > 1) addText(P.x, playerY() - 12, 'Combo weg', '#ff4d6d', 0.9);
    G.combo = 0; G.mult = 1;
  }
  function collectPower(p) {
    const col = PCOL[p.kind];
    sfx.power(); buzz(20);
    burst(p.x, p.y, col, 18, 45);
    addText(p.x, p.y - 6, PLABEL[p.kind], col, 1.2);
    if (p.kind === 'shield') G.shield = true;
    else G[p.kind] = PDUR[p.kind];
    G.bonus += 15;
  }
  function nearMiss(o) {
    G.bonus += 25;
    sfx.near(); buzz(8);
    addText(P.x, playerY() - 10, 'KNAPP! +25', '#ffffff', 0.9);
    burst(P.x, playerY(), o.c, 6, 25);
  }
  function breakObstacle(o) {
    if (o.type === 'rect') {
      for (let i = 0; i < 4; i++) burst(o.x + rand(0, o.w), o.y + o.h / 2, o.c, 8, 40);
    } else {
      burst(o.cx, o.cy, o.c, 30, 50);
    }
  }
  function hit(o) {
    if (G.shield) {
      G.shield = false; o.dead = true; G.inv = 0.8; G.shake = 8;
      sfx.shield(); buzz(40);
      breakObstacle(o);
      addText(P.x, playerY() - 10, 'SCHILD!', PCOL.shield, 1.1);
      return;
    }
    state = 'dying'; G.dieT = 0; G.shake = 14; G.flash = 0.25;
    sfx.hit(); buzz([60, 40, 120]);
    burst(P.x, playerY(), skinColor(), 50, 70);
    burst(P.x, playerY(), '#ffffff', 20, 40);
    $('hud').classList.add('hidden');
  }

  // ================= Update =================
  const keys = { left: false, right: false };

  function movePlayer(dt) {
    const k = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
    if (k) P.tx += k * 150 * dt;
    P.tx = clamp(P.tx, P.r, 100 - P.r);
    P.x += (P.tx - P.x) * Math.min(1, dt * 20);
  }
  function updateTrail(dy) {
    for (const t of P.trail) t.y += dy;
    P.trail.unshift({ x: P.x, y: playerY() });
    if (P.trail.length > 16) P.trail.pop();
  }

  function update(dt) {
    movePlayer(dt);
    if (G.freeze > 0) {
      const before = Math.ceil(G.freeze / 0.5);
      G.freeze -= dt;
      if (Math.ceil(G.freeze / 0.5) !== before && G.freeze > 0) sfx.tick();
      updateTrail(0); updateParticles(dt);
      return;
    }
    if (G.slow > 0) G.slow -= dt;
    if (G.magnet > 0) G.magnet -= dt;
    if (G.inv > 0) G.inv -= dt;

    const gdt = dt * (G.slow > 0 ? 0.55 : 1);
    G.t += gdt;
    G.d = clamp(G.t / 120, 0, 1);
    G.speed = 55 + 70 * (1 - Math.exp(-G.t / 90));
    const dy = G.speed * gdt;
    G.dist += dy; bgDist += dy;
    const py = playerY();
    updateTrail(dy);

    // Hindernisse
    for (const o of G.obs) {
      if (o.type === 'rect') {
        o.y += dy;
        if (o.vx) {
          o.x += o.vx * gdt;
          if (o.x < 0) { o.x = 0; o.vx = -o.vx; }
          else if (o.x + o.w > 100) { o.x = 100 - o.w; o.vx = -o.vx; }
        }
      } else {
        o.cy += dy; o.ang += o.va * gdt;
      }
      if (o.dead || o.passed) continue;
      const dd = (o.type === 'rect' ? rectDist(o, P.x, py) : barDist(o, P.x, py)) - P.r * 0.82;
      if (dd < o.minD) o.minD = dd;
      if (dd < 0 && G.inv <= 0) {
        hit(o);
        if (state !== 'play') return;
        continue;
      }
      if (obsBottom(o) > py + P.r) {
        o.passed = true;
        if (o.minD >= 0 && o.minD < 2.6) nearMiss(o);
      }
    }
    G.obs = G.obs.filter((o) => !o.dead && obsBottom(o) < FH + 10);

    // Kristalle
    for (const g of G.gems) {
      g.y += dy; g.ph += dt * 4;
      if (G.magnet > 0) {
        const mx = P.x - g.x, my = py - g.y, md = Math.hypot(mx, my);
        if (md < 40 && md > 0.01) {
          const s = Math.min(md, 170 * dt);
          g.x += (mx / md) * s; g.y += (my / md) * s;
        }
      }
      if (Math.hypot(P.x - g.x, py - g.y) < P.r + g.r + 1.2) { g.dead = true; collectGem(g); }
      else if (g.y > FH + 4) { g.dead = true; loseCombo(); }
    }
    G.gems = G.gems.filter((g) => !g.dead);

    // Power-Ups
    for (const p of G.pups) {
      p.y += dy; p.ph += dt * 3;
      if (Math.hypot(P.x - p.x, py - p.y) < P.r + 3.6) { p.dead = true; collectPower(p); }
      else if (p.y > FH + 6) p.dead = true;
    }
    G.pups = G.pups.filter((p) => !p.dead);

    if (G.dist >= G.nextSpawn) spawnNext();

    G.score = Math.floor(G.dist / 3) + G.bonus;
    updateParticles(dt);
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
    updateHud();
  }

  function updateDying(dt) {
    G.dieT += dt;
    updateParticles(dt);
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
    if (G.dieT > 1.1) gameOver();
  }

  // ================= Rendering =================
  function skinColor() {
    const s = curSkin();
    return s.trail === 'rainbow' ? rainbow(clock * 120) : s.color;
  }

  function drawBackground() {
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
    // Sterne (Parallax)
    ctx.fillStyle = '#ffffff';
    for (const s of stars) {
      const y = (s.y * H + bgDist * u * s.z * 0.25) % H;
      ctx.globalAlpha = 0.25 + s.z * 0.5;
      ctx.fillRect(s.x * W, y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
    // Synthwave-Gitter
    const step = 14 * u, off = ((bgDist * u) % step + step) % step;
    ctx.strokeStyle = 'rgba(150, 70, 255, 0.13)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = off - step; y < H; y += step) { ctx.moveTo(FX, y); ctx.lineTo(FX + FW, y); }
    for (let i = 1; i < 8; i++) { const x = FX + i * 12.5 * u; ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    ctx.stroke();
    // Spielfeldrand
    if (FX > 2) {
      ctx.strokeStyle = 'rgba(46, 242, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(FX, 0); ctx.lineTo(FX, H);
      ctx.moveTo(FX + FW, 0); ctx.lineTo(FX + FW, H);
      ctx.stroke();
    }
  }

  function drawObstacles() {
    const pad = u * 0.9;
    for (const o of G.obs) {
      if (o.type === 'rect') {
        const x = FX + o.x * u, y = o.y * u, w = o.w * u, h = o.h * u;
        if (y > H + 10 || y + h < -10) continue;
        ctx.fillStyle = o.g; ctx.fillRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
        ctx.fillStyle = o.c; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x, y, w, Math.max(1, h * 0.22));
      } else {
        const L = o.len * u, T = o.th * u;
        ctx.save();
        ctx.translate(FX + o.cx * u, o.cy * u);
        ctx.rotate(o.ang);
        ctx.fillStyle = o.g; ctx.fillRect(-L / 2 - pad, -T / 2 - pad, L + pad * 2, T + pad * 2);
        ctx.fillStyle = o.c; ctx.fillRect(-L / 2, -T / 2, L, T);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, 0, T * 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawGems() {
    for (const g of G.gems) {
      const x = FX + g.x * u, y = g.y * u, r = g.r * u * (1 + Math.sin(g.ph) * 0.12);
      if (y < -20 || y > H + 20) continue;
      drawGlow(C.gem, x, y, r * 2.8);
      ctx.fillStyle = '#fff6c2';
      ctx.beginPath();
      ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.75, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.75, y);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawPowerIcon(kind, s) {
    ctx.beginPath();
    if (kind === 'shield') {
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.85, -s * 0.5); ctx.lineTo(s * 0.6, s * 0.5);
      ctx.lineTo(0, s); ctx.lineTo(-s * 0.6, s * 0.5); ctx.lineTo(-s * 0.85, -s * 0.5); ctx.closePath();
    } else if (kind === 'slow') {
      ctx.moveTo(-s * 0.6, -s); ctx.lineTo(s * 0.6, -s); ctx.lineTo(-s * 0.6, s); ctx.lineTo(s * 0.6, s); ctx.closePath();
    } else {
      ctx.moveTo(-s * 0.6, -s * 0.8); ctx.lineTo(-s * 0.6, 0);
      ctx.arc(0, 0, s * 0.6, Math.PI, 0, true);
      ctx.lineTo(s * 0.6, -s * 0.8);
    }
    ctx.stroke();
  }

  function drawPowerUps() {
    for (const p of G.pups) {
      const x = FX + p.x * u, y = p.y * u + Math.sin(p.ph) * u * 0.8, col = PCOL[p.kind];
      if (y < -30 || y > H + 30) continue;
      drawGlow(col, x, y, 7 * u);
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, u * 0.5);
      ctx.beginPath(); ctx.arc(x, y, 3.2 * u, 0, Math.PI * 2); ctx.stroke();
      ctx.save(); ctx.translate(x, y);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.5, u * 0.4); ctx.lineJoin = 'round';
      drawPowerIcon(p.kind, 1.5 * u);
      ctx.restore();
    }
  }

  function timerArc(x, y, r, frac, col) {
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, u * 0.45);
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(frac, 0, 1));
    ctx.stroke();
  }

  function drawPlayer() {
    const skin = curSkin(), col = skinColor();
    const px = FX + P.x * u, py = playerY() * u, r = P.r * u;
    // Schweif
    const n = P.trail.length;
    for (let i = n - 1; i >= 1; i--) {
      const t = P.trail[i], k = 1 - i / n;
      const tc = skin.trail === 'rainbow' ? rainbow(clock * 120 + i * 22) : skin.trail;
      ctx.globalAlpha = k * 0.55;
      drawGlow(tc, FX + t.x * u, t.y * u, r * (0.5 + k));
    }
    ctx.globalAlpha = (G.inv > 0 && state === 'play' && Math.floor(G.inv * 12) % 2 === 0) ? 0.35 : 1;
    drawGlow(col, px, py, r * 3.4);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(px, py, r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    if (G.shield) {
      ctx.strokeStyle = PCOL.shield; ctx.lineWidth = Math.max(2, u * 0.5);
      ctx.setLineDash([r * 0.6, r * 0.35]); ctx.lineDashOffset = -clock * 30;
      ctx.beginPath(); ctx.arc(px, py, r * 1.7, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (G.slow > 0) timerArc(px, py, r * 2.15, G.slow / PDUR.slow, PCOL.slow);
    if (G.magnet > 0) timerArc(px, py, r * 2.55, G.magnet / PDUR.magnet, PCOL.magnet);
  }

  function drawParticles() {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      const s = p.s * u * 0.6;
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.c;
      ctx.fillRect(FX + p.x * u - s, p.y * u - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawTexts() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of G.texts) {
      ctx.globalAlpha = clamp(t.life / t.max * 1.5, 0, 1);
      ctx.font = `900 ${Math.round(4 * u * t.size)}px system-ui, sans-serif`;
      ctx.fillStyle = t.c;
      ctx.fillText(t.text, FX + clamp(t.x, 15, 85) * u, t.y * u);
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    if (G.shake > 0) ctx.translate(rand(-1, 1) * G.shake, rand(-1, 1) * G.shake);
    drawBackground();
    if (state !== 'menu') {
      drawGems();
      drawPowerUps();
      drawObstacles();
      if (state === 'play' || state === 'paused') drawPlayer();
    }
    drawParticles();
    drawTexts();

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (G.slow > 0 && state === 'play') { ctx.fillStyle = 'rgba(80,100,255,0.08)'; ctx.fillRect(0, 0, W, H); }
    if (G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.6, G.flash * 2.4)})`; ctx.fillRect(0, 0, W, H); }
    if (state === 'play' && G.freeze > 0) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${Math.round(22 * u)}px system-ui, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#2ef2ff'; ctx.shadowBlur = 20;
      ctx.fillText(String(Math.ceil(G.freeze / 0.5)), W / 2, H * 0.42);
      ctx.shadowBlur = 0;
    }
  }

  // ================= Hauptschleife =================
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    dt = clamp(dt, 0, 0.05);
    clock += dt;
    if (G.flash > 0) G.flash -= dt;
    if (state === 'play') update(dt);
    else if (state === 'dying') updateDying(dt);
    else if (state === 'menu' || state === 'over') { bgDist += 22 * dt; updateParticles(dt); }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ================= UI =================
  const elScore = $('score'), elCombo = $('combo'), elGems = $('gems');
  let hudCache = '';
  function updateHud() {
    const key = G.score + '|' + G.mult + '|' + G.gemsRun;
    if (key === hudCache) return;
    hudCache = key;
    elScore.textContent = G.score;
    elCombo.textContent = G.mult > 1 ? `x${G.mult} Combo` : '';
    elGems.textContent = `◆ ${G.gemsRun}`;
  }

  function show(id) {
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id);
    $('hud').classList.toggle('hidden', id !== null);
  }

  function refreshMenu() {
    $('menuBest').textContent = save.best;
    $('menuCoins').textContent = `◆ ${save.coins}`;
    $('soundBtn').classList.toggle('off', !save.sound);
    $('soundBtn').textContent = save.sound ? '🔊' : '🔇';
    $('vibBtn').classList.toggle('off', !save.vibrate);
  }

  function goMenu() {
    state = 'menu';
    resetGame();
    refreshMenu();
    show('menu');
  }

  function startGame() {
    resetGame();
    save.games++; persist();
    state = 'play';
    hudCache = '';
    updateHud();
    show(null);
    sfx.start();
    last = performance.now();
  }

  function pauseGame() {
    if (state !== 'play') return;
    state = 'paused';
    keys.left = keys.right = false;
    drag = null;
    show('pause');
  }
  function resumeGame() {
    if (state !== 'paused') return;
    state = 'play';
    G.freeze = 1.5;
    show(null);
    last = performance.now();
  }

  function gameOver() {
    state = 'over';
    const fresh = G.gemsRun - G.gemsCommitted;
    G.gemsCommitted = G.gemsRun;
    save.coins += fresh;
    const isBest = G.score > save.best;
    if (isBest) save.best = G.score;
    persist();
    $('overScore').textContent = G.score;
    $('overBest').textContent = save.best;
    $('overGems').textContent = `◆ ${G.gemsRun}`;
    $('newBest').classList.toggle('hidden', !isBest);
    const rb = $('reviveBtn');
    rb.textContent = `Weiterspielen (◆ ${REVIVE_COST})`;
    rb.classList.toggle('hidden', G.revived || save.coins < REVIVE_COST);
    show('over');
  }

  function revive() {
    if (G.revived || save.coins < REVIVE_COST) return;
    save.coins -= REVIVE_COST; persist();
    G.revived = true;
    G.obs = [];
    G.inv = 2; G.freeze = 1.5; G.shake = 0;
    state = 'play';
    hudCache = '';
    show(null);
    last = performance.now();
  }

  function renderShop() {
    $('shopCoins').textContent = `◆ ${save.coins}`;
    const grid = $('skinGrid');
    grid.innerHTML = '';
    for (const s of SKINS) {
      const owned = save.owned.includes(s.id), sel = save.skin === s.id;
      const b = document.createElement('button');
      b.className = 'skin' + (sel ? ' sel' : '') + (owned ? '' : ' locked');
      const bg = s.trail === 'rainbow'
        ? 'conic-gradient(#ff3d3d,#ffd23d,#3dff8b,#2ef2ff,#7d3dff,#ff3df0,#ff3d3d)'
        : `radial-gradient(circle, #fff 0 30%, ${s.color} 32%)`;
      b.innerHTML = `<span class="dot" style="background:${bg};box-shadow:0 0 18px ${s.color}"></span>` +
        `<b>${s.name}</b><small>${sel ? 'Aktiv' : owned ? 'Auswählen' : '◆ ' + s.price}</small>`;
      b.addEventListener('click', () => {
        if (owned) {
          save.skin = s.id; sfx.click();
        } else if (save.coins >= s.price) {
          save.coins -= s.price; save.owned.push(s.id); save.skin = s.id; sfx.power(); buzz(20);
        } else {
          sfx.deny();
          b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
          return;
        }
        persist();
        renderShop();
      });
      grid.appendChild(b);
    }
  }

  const on = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  on('playBtn', startGame);
  on('againBtn', startGame);
  on('restartBtn', startGame);
  on('reviveBtn', revive);
  on('pauseBtn', pauseGame);
  on('resumeBtn', resumeGame);
  on('pauseMenuBtn', goMenu);
  on('overMenuBtn', goMenu);
  on('shopBtn', () => { sfx.click(); renderShop(); show('shop'); });
  on('shopBackBtn', () => { sfx.click(); refreshMenu(); show('menu'); });
  on('helpBtn', () => { sfx.click(); show('help'); });
  on('helpBackBtn', () => { sfx.click(); show('menu'); });
  on('soundBtn', () => { save.sound = !save.sound; persist(); refreshMenu(); sfx.click(); });
  on('vibBtn', () => { save.vibrate = !save.vibrate; persist(); refreshMenu(); buzz(30); sfx.click(); });

  // ================= Eingabe =================
  // Relatives Ziehen: Finger irgendwo hinlegen, Bewegung wird 1:1,35 auf die Kugel übertragen.
  const SENS = 1.35;
  let drag = null;
  cv.addEventListener('pointerdown', (e) => {
    if (state !== 'play') return;
    drag = { id: e.pointerId, sx: e.clientX, px: P.tx };
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || state !== 'play') return;
    const raw = drag.px + ((e.clientX - drag.sx) / u) * SENS;
    P.tx = clamp(raw, P.r, 100 - P.r);
    if (P.tx !== raw) { drag.px = P.tx; drag.sx = e.clientX; } // am Rand sofort wieder zurück
  });
  const endDrag = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') keys.left = true;
    else if (k === 'arrowright' || k === 'd') keys.right = true;
    else if (k === 'escape' || k === 'p') { if (state === 'play') pauseGame(); else if (state === 'paused') resumeGame(); }
    else if (k === ' ' || k === 'enter') {
      if (state === 'menu' || state === 'over') startGame();
      else if (state === 'paused') resumeGame();
      else return;
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') keys.left = false;
    else if (k === 'arrowright' || k === 'd') keys.right = false;
  });

  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
  window.addEventListener('blur', pauseGame);

  // ================= Offline / Installation =================
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    $('installBtn').classList.remove('hidden');
  });
  on('installBtn', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch (e) { /* egal */ }
    installPrompt = null;
    $('installBtn').classList.add('hidden');
  });
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone) {
    $('installHint').textContent = 'Tipp: In Safari auf „Teilen“ ➜ „Zum Home-Bildschirm“ – dann läuft Neon Rush als App, auch offline.';
  }

  // Nur für automatisierte Tests: index.html#debug
  if (location.hash === '#debug') window.__nr = { G, P, playerY, get state() { return state; } };

  refreshMenu();
})();
