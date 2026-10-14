// Kampf-Engine: Arena, Spieler, Gegner, Fertigkeiten, Zustände, Bosse, Rendering.
import { TAU, clamp, rand, randi, pick, weighted, rgba, fmt } from './util.js';
import { ENEMIES, BOSSES, ELITE_AFFIXES, ELITE_IDS, ascHas } from './data/content.js';
import { ELEM } from './data/stats.js';
import { sfx, buzz } from './audio.js';
import { save } from './save.js';

const ARENA_R = 1000;
const CELL = 80;
const MAX_ENEMIES = 260;
const MAX_PROJ = 450;
const VIEW = 440; // sichtbare Welt-Einheiten auf der kurzen Bildschirmseite

/** Abstand eines Punktes zu einer Strecke. */
const segDist = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay;
  const t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
};

const typeColor = (dmg) => {
  let best = 'phys', bv = -1;
  for (const t in dmg) { const v = dmg[t][1]; if (v > bv) { bv = v; best = t; } }
  return ELEM[best].color;
};

export class Combat {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.glowCache = new Map();
    this.input = { x: 0, y: 0, key: { x: 0, y: 0 }, stick: null };
    this.stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), s: rand(0.5, 1.8), a: rand(0.2, 0.8) }));
    this.running = false;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.attachInput();
  }

  resize() {
    this.DPR = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.cv.width = Math.round(this.W * this.DPR);
    this.cv.height = Math.round(this.H * this.DPR);
    this.scale = Math.min(this.W, this.H) / VIEW;
    this.glowCache.clear();
  }

  // ---------------------------------------------------------------- Eingabe
  attachInput() {
    const cv = this.cv;
    cv.addEventListener('pointerdown', (e) => {
      if (!this.running) return;
      this.input.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
    });
    cv.addEventListener('pointermove', (e) => {
      const s = this.input.stick;
      if (!s || s.id !== e.pointerId) return;
      s.x = e.clientX; s.y = e.clientY;
      // Ursprung folgt dem Finger, wenn er zu weit wegzieht (schwebender Joystick)
      const R = 60, dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy);
      if (d > R) { s.ox = s.x - (dx / d) * R; s.oy = s.y - (dy / d) * R; }
    });
    const end = (e) => { if (this.input.stick && this.input.stick.id === e.pointerId) this.input.stick = null; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    const keys = new Set();
    const upd = () => {
      this.input.key.x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      this.input.key.y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    };
    window.addEventListener('keydown', (e) => { keys.add(e.key.toLowerCase()); upd(); });
    window.addEventListener('keyup', (e) => { keys.delete(e.key.toLowerCase()); upd(); });
    window.addEventListener('blur', () => { keys.clear(); upd(); this.input.stick = null; });
  }

  moveVector() {
    let x = this.input.key.x, y = this.input.key.y;
    const s = this.input.stick;
    if (s) {
      const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy);
      if (d > 6) { x = dx / 60; y = dy / 60; }
    }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y, m: Math.min(1, m) };
  }

  // ---------------------------------------------------------------- Start
  /**
   * cfg: { kind: 'fight'|'elite'|'boss', act, power, pool, bossId, duration, hpMult, dmgMult, asc,
   *        density, eliteAffixes, label, floorColor, tint, xpMult }
   * cb:  { onXp(v), onGold(v), onEliteKill(e), onBoss(e), onWin(), onDeath() -> bool (wiederbelebt?), onLose() }
   */
  start(cfg, P, snaps, hp, cb) {
    this.cfg = cfg;
    this.P = P;
    this.cb = cb;
    this.t = 0;
    this.over = false;
    this.endT = 0;
    this.result = null;
    this.paused = false;
    this.player = { x: 0, y: 0, r: 13, hp: Math.min(hp, P.maxLife), barrier: P.maxBarrier, bdelay: 0, inv: 0, moveAcc: 0, leechAcc: 0, face: -Math.PI / 2, hurt: 0 };
    this.enemies = [];
    this.projs = [];
    this.eprojs = [];
    this.zones = [];
    this.traps = [];
    this.minions = [];
    this.orbs = [];
    this.fx = [];
    this.parts = [];
    this.texts = [];
    this.teles = [];
    this.delayed = [];
    this.spawnAcc = 0;
    this.boss = null;
    this.bossSpawned = false;
    this.shake = 0;
    this.stats = { kills: 0, maxHit: 0, elites: 0, dmgDone: 0, byType: {}, hitsTaken: 0 };
    this.hazards = [];
    this.rebirthUsed = false;
    this.frenzy = 0;
    this.frenzyT = 0;
    this.hazardT = 3;
    this.sk = [];
    this.objective = '';
    this.eliteTimes = cfg.kind === 'elite' || cfg.allElite ? [4, 18, 32].slice(0, 2 + (cfg.extraElite ? 1 : 0)) : cfg.kind === 'fight' && Math.random() < cfg.champChance ? [cfg.duration * 0.55] : [];
    this.setSkills(snaps);
    this.grid = new Map();
    this.running = true;
  }

  setSkills(snaps) {
    const old = this.sk || [];
    this.sk = snaps.map((S) => {
      const prev = old.find((o) => o.S.id === S.id);
      return { S, t: prev ? Math.min(prev.t, S.interval) : rand(0.15, 0.5) * S.interval, orbitA: prev ? prev.orbitA : 0, hitCd: prev ? prev.hitCd : new Map() };
    });
    this.syncMinions();
  }

  setPlayerStats(P) {
    this.P = P;
    const p = this.player;
    p.hp = Math.min(p.hp, P.maxLife);
    p.barrier = Math.min(p.barrier, P.maxBarrier);
  }

  syncMinions() {
    const keep = [];
    this.sk.forEach((sk, i) => {
      if (sk.S.def.beh !== 'minion') return;
      const mine = this.minions.filter((m) => m.skId === sk.S.id);
      for (let k = 0; k < sk.S.minions; k++) {
        const d = sk.S.def;
        const m = mine[k] || { skId: sk.S.id, x: this.player.x + rand(-30, 30), y: this.player.y + rand(-30, 30), atk: rand(0, 0.5), kind: d.kind, bob: Math.random() * 6, ranged: !!d.petRanged, petColor: d.color, glyph: d.glyph };
        keep.push(m);
      }
    });
    this.minions = keep;
  }

  skOf(id) { return this.sk.find((s) => s.S.id === id); }

  // ---------------------------------------------------------------- Schleife
  update(dt) {
    if (!this.running || this.paused) return;
    if (this.over) {
      this.updateFx(dt);
      this.updateOrbs(dt);
      this.endT -= dt;
      if (this.endT <= 0 && !this.result.done) {
        this.result.done = true;
        this.running = false;
        if (this.result.win) this.cb.onWin(this.stats);
        else this.cb.onLose(this.stats);
      }
      return;
    }
    this.t += dt;
    this.buildGrid();
    this.updatePlayer(dt);
    this.spawnLogic(dt);
    this.updateSkills(dt);
    this.updateDelayed(dt);
    this.updateProjs(dt);
    this.updateEnemies(dt);
    this.updateEProjs(dt);
    this.updateZones(dt);
    this.updateTraps(dt);
    this.updateMinions(dt);
    this.updateTeles(dt);
    this.updateHazards(dt);
    this.updateOrbs(dt);
    this.updateFx(dt);
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.checkEnd();
  }

  // ---------------------------------------------------------------- Raster
  key(cx, cy) { return (cx + 512) * 1024 + (cy + 512); }
  buildGrid() {
    this.grid.clear();
    for (const e of this.enemies) {
      if (e.dead) continue;
      const k = this.key(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
      let a = this.grid.get(k);
      if (!a) { a = []; this.grid.set(k, a); }
      a.push(e);
    }
  }
  query(x, y, r, fn) {
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const y0 = Math.floor((y - r) / CELL), y1 = Math.floor((y + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const a = this.grid.get(this.key(cx, cy));
        if (a) for (const e of a) if (!e.dead) fn(e);
      }
    }
  }
  nearest(x, y, maxR, exclude) {
    let best = null, bd = maxR * maxR;
    for (const e of this.enemies) {
      if (e.dead || e.phased || (exclude && exclude.has(e))) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ---------------------------------------------------------------- Spieler
  updatePlayer(dt) {
    const p = this.player, P = this.P;
    const mv = this.moveVector();
    p.moving = mv.m > 0.05;
    p.slowT -= dt;
    if (this.frenzyT > 0) { this.frenzyT -= dt; if (this.frenzyT <= 0) this.frenzy = 0; }
    if (mv.m > 0.05) {
      const mspd = P.move * (p.slowT > 0 ? 0.65 : 1);
      p.x += mv.x * mspd * dt;
      p.y += mv.y * mspd * dt;
      p.face = Math.atan2(mv.y, mv.x);
      p.moveAcc += dt * mv.m;
      if (P.spec.spec_moveStrike && p.moveAcc >= 1) {
        p.moveAcc = 0;
        const t = this.nearest(p.x, p.y, 320);
        if (t) {
          this.aoeFlat(t.x, t.y, 45, P.moveStrikeDmg, 'light');
          this.fx.push({ type: 'bolt', pts: [[t.x, t.y - 160], [t.x + rand(-15, 15), t.y - 80], [t.x, t.y]], t: 0.2, max: 0.2, color: ELEM.light.color });
          sfx.zap();
        }
      }
    }
    const d = Math.hypot(p.x, p.y);
    if (d > ARENA_R - p.r) { p.x *= (ARENA_R - p.r) / d; p.y *= (ARENA_R - p.r) / d; }
    p.hp = Math.min(P.maxLife, p.hp + P.regen * dt);
    p.bdelay -= dt;
    if (p.bdelay <= 0 && p.barrier < P.maxBarrier) p.barrier = Math.min(P.maxBarrier, p.barrier + P.maxBarrier * P.barrierRate * dt);
    p.inv -= dt;
    p.hurt -= dt;
    p.leechAcc = Math.max(0, p.leechAcc - P.maxLife * 0.12 * dt);
  }

  heal(amount) {
    const p = this.player;
    if (amount <= 0 || this.P.ci || p.hp <= 0 || (this.over && !this.result.win)) return;
    p.hp = Math.min(this.P.maxLife, p.hp + amount);
  }

  damagePlayer(amount, elem = 'phys', isHit = true, src = null) {
    const p = this.player, P = this.P;
    if (this.over) return;
    if (isHit) {
      if (p.inv > 0) return;
      const evade = P.evasion / (P.evasion + 600);
      if (Math.random() * 100 < P.dodge || Math.random() < Math.min(0.75, evade)) {
        p.inv = 0.18;
        this.text(p.x, p.y - 20, 'Ausgewichen', '#9fe7ff', 0.8);
        sfx.dodge();
        return;
      }
    }
    let dmg = amount;
    if (elem === 'phys') dmg *= 1 - Math.min(0.9, P.armor / (P.armor + 8 * amount));
    else dmg *= 1 - (P.res[elem] || 0) / 100;
    dmg *= P.dmgTaken;
    if (p.barrier > 0) {
      const ab = Math.min(p.barrier, dmg);
      p.barrier -= ab;
      dmg -= ab;
    }
    p.hp -= dmg;
    p.bdelay = 2;
    if (isHit) {
      this.stats.hitsTaken++;
      if (src && P.spec.spec_thorns && !src.dead) {
        const th = (P.armor * P.spec.spec_thorns) / 100;
        if (th > 0) { this.dealDamage(src, th * src.takenMult, false, null); if (src.hp <= 0) this.kill(src, null); }
      }
      p.inv = 0.35;
      p.hurt = 0.2;
      if (save.settings.shake) this.shake = Math.max(this.shake, 5);
      sfx.hurt();
      buzz(25);
      if (src && (src.vamp || (src.d && src.d.vampHit))) src.hp = Math.min(src.maxHp, src.hp + src.maxHp * 0.08);
    }
    if (p.hp <= 0 && P.spec.spec_rebirth && !this.rebirthUsed) {
      this.rebirthUsed = true;
      p.hp = P.maxLife * 0.3;
      p.inv = 1.5;
      this.text(p.x, p.y - 30, 'PHÖNIX', '#ff9a2a', 1.4);
      this.ring(p.x, p.y, 160, '#ff9a2a', 0.6);
      return;
    }
    if (p.hp <= 0) {
      if (this.cb.onDeath()) {
        p.inv = 2;
        this.text(p.x, p.y - 30, 'WIEDERBELEBT', '#ffe066', 1.4);
        this.ring(p.x, p.y, 220, '#ffe066', 0.6);
        for (const e of this.enemies) if (Math.hypot(e.x - p.x, e.y - p.y) < 220 && !e.boss) this.kill(e, null, true);
      } else {
        p.hp = 0;
        this.over = true;
        this.endT = 1.6;
        this.result = { win: false };
        sfx.death();
        buzz([80, 60, 200]);
        this.burst(p.x, p.y, '#ffffff', 60, 260);
      }
    }
  }

  // ---------------------------------------------------------------- Gegner
  spawnPos() {
    const p = this.player;
    const vr = Math.hypot(this.W, this.H) / 2 / this.scale + 40;
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * TAU;
      const x = p.x + Math.cos(a) * vr, y = p.y + Math.sin(a) * vr;
      if (Math.hypot(x, y) < ARENA_R - 30) return { x, y };
    }
    const a = Math.random() * TAU;
    return { x: Math.cos(a) * (ARENA_R - 40), y: Math.sin(a) * (ARENA_R - 40) };
  }

  makeEnemy(id, x, y) {
    const d = ENEMIES[id], c = this.cfg;
    const hp = d.hp * c.power * c.hpMult;
    const e = {
      id, d, x, y, r: d.r, hp, maxHp: hp, dmg: d.dmg * Math.pow(c.power, 0.72) * c.dmgMult,
      speed: d.speed * (ascHas(c.asc, 'fast') ? 1.1 : 1) * rand(0.9, 1.1), xp: d.xp, color: d.color,
      res: { ...(d.res || {}) }, takenMult: 1, burns: [], poisons: [], bleed: null,
      chill: 0, chillEff: 0, frozen: 0, shock: 0, shockEff: 0, flash: 0,
      atk: d.ranged ? rand(0.6, d.ranged.cd) : 0, elite: false, affixes: [], cs: null, ct: rand(1, 3), dotAcc: 0, dotShow: 0.5,
      blinkT: d.blink ? rand(1, d.blink) : 0, spawnT: d.spawn ? rand(1, d.spawn.cd) : 0, leapT: d.leap ? rand(1.5, d.leap) : 0,
      mineT: d.mines ? rand(1, d.mines) : 0, phaseT: d.phase ? rand(1, 3) : 0, phased: false, aimT: 0, shielded: false,
    };
    if (c.enemySpeed) e.speed *= c.enemySpeed;
    if (ascHas(c.asc, 'res')) for (const el of ['fire', 'cold', 'light']) e.res[el] = (e.res[el] || 0) + 20;
    return e;
  }

  spawn(id, x, y) {
    if (this.enemies.length >= MAX_ENEMIES) return null;
    const e = this.makeEnemy(id, x, y);
    this.enemies.push(e);
    return e;
  }

  spawnGroup() {
    const c = this.cfg;
    const id = weighted(c.pool, (x) => x[1])[0];
    const pos = this.spawnPos();
    const n = ENEMIES[id].group || (Math.random() < 0.18 ? randi(3, 5) : 1);
    for (let i = 0; i < n; i++) this.spawn(id, pos.x + rand(-30, 30), pos.y + rand(-30, 30));
  }

  spawnElite() {
    const c = this.cfg;
    const id = weighted(c.pool.filter((x) => !['mite', 'swarm', 'slimelet', 'nest', 'turret'].includes(x[0])), (x) => x[1])[0];
    const pos = this.spawnPos();
    const e = this.spawn(id, pos.x, pos.y);
    if (!e) return;
    e.elite = true;
    e.hp = e.maxHp = e.maxHp * 4.5;
    e.r *= 1.35;
    e.xp *= 8;
    e.dmg *= 1.25;
    const ids = [...ELITE_IDS];
    for (let i = 0; i < c.eliteAffixes && ids.length; i++) {
      const a = ids.splice(Math.floor(Math.random() * ids.length), 1)[0];
      e.affixes.push(a);
      if (a === 'fast') e.speed *= 1.4;
      if (a === 'armored') e.takenMult *= 0.6;
      if (a === 'fireres') e.res.fire = 75;
      if (a === 'coldres') e.res.cold = 75;
      if (a === 'lightres') e.res.light = 75;
      if (a === 'vampiric') e.vamp = true;
      if (a === 'summoner') e.sumT = 4;
      if (a === 'shielding') e.shieldAura = 150;
      if (a === 'blinking') e.blinkCd = 3;
      if (a === 'splitting') e.splitElite = true;
    }
    e.name = e.affixes.map((a) => ELITE_AFFIXES[a].name).join(' · ') + ' ' + e.d.name;
    this.text(e.x, e.y - 30, e.name, '#ffd84d', 1);
  }

  spawnBoss() {
    const c = this.cfg, b = BOSSES[c.bossId];
    const pos = { x: this.player.x, y: this.player.y - 330 };
    if (Math.hypot(pos.x, pos.y) > ARENA_R - 60) { pos.x = 0; pos.y = 0; }
    const hp = b.hp * c.power * c.hpMult * (ascHas(c.asc, 'bossHp') ? 1.3 : 1) * (c.bossHpMult || 1);
    const e = {
      id: c.bossId, d: { name: b.name, shape: 'boss' }, b, boss: true, x: pos.x, y: pos.y, r: b.r, hp, maxHp: hp,
      dmg: b.dmg * Math.pow(c.power, 0.72) * c.dmgMult, speed: b.speed, xp: 60, color: b.color, res: {}, takenMult: 1,
      burns: [], poisons: [], bleed: null, chill: 0, chillEff: 0, frozen: 0, shock: 0, shockEff: 0, flash: 0, affixes: [],
      pat: b.patterns.map(([n, cd]) => ({ n, cd, t: cd * rand(0.5, 1) })), rage: ascHas(c.asc, 'bossRage') || !!c.bossRage, dotAcc: 0, dotShow: 0.5,
      name: b.name,
    };
    this.enemies.push(e);
    this.boss = e;
    this.bossSpawned = true;
    this.ring(e.x, e.y, 160, b.color, 0.8);
    sfx.boss();
    buzz(120);
    this.cb.onBoss(e);
  }

  spawnLogic(dt) {
    const c = this.cfg;
    const alive = this.enemies.length;
    if (c.kind !== 'boss') {
      if (this.t < c.duration) {
        const prog = this.t / c.duration;
        const rate = (0.8 + 2.6 * prog) * c.density;
        this.spawnAcc += rate * dt;
        while (this.spawnAcc >= 1) {
          this.spawnAcc -= 1;
          if (alive < MAX_ENEMIES) this.spawnGroup();
        }
      }
      while (this.eliteTimes.length && this.t >= this.eliteTimes[0]) { this.eliteTimes.shift(); this.spawnElite(); }
    } else {
      this.hazardT = Math.max(this.hazardT, 0);
      if (!this.bossSpawned && this.t > 1.2) this.spawnBoss();
      if (this.bossSpawned && !this.boss.dead) {
        this.spawnAcc += 0.7 * c.density * dt;
        while (this.spawnAcc >= 1) { this.spawnAcc -= 1; if (alive < 120) this.spawnGroup(); }
      }
    }
  }

  /** Umgebungsgefahren des Gebiets (Lava, Gift, Blitze, Meteore). */
  updateEnvHazards(dt) {
    const c = this.cfg, p = this.player;
    const kinds = [c.kind === 'boss' ? null : c.hazard, c.meteors ? 'meteor' : null].filter(Boolean);
    if (!kinds.length) return;
    this.hazardT -= dt;
    if (this.hazardT > 0) return;
    this.hazardT = rand(1.8, 3.2);
    const dmg = 9 * Math.pow(c.power, 0.72) * c.dmgMult;
    for (const k of kinds) {
      const x = p.x + rand(-160, 160), y = p.y + rand(-160, 160);
      if (k === 'fire') this.teles.push({ x, y, r: 60, t: 1.2, max: 1.2, dmg: dmg * 1.3, elem: 'fire' });
      else if (k === 'lightning') this.teles.push({ x: p.x + rand(-90, 90), y: p.y + rand(-90, 90), r: 38, t: 0.9, max: 0.9, dmg: dmg * 1.2, elem: 'light', bolt: true });
      else if (k === 'poison') this.hazards.push({ x, y, r: 55, t: 6, max: 6, dps: dmg * 0.5, elem: 'chaos' });
      else if (k === 'meteor') this.teles.push({ x, y, r: 75, t: 1.4, max: 1.4, dmg: dmg * 1.6, elem: 'fire' });
    }
  }

  updateHazards(dt) {
    const p = this.player;
    for (const h of this.hazards) {
      h.t -= dt;
      if (Math.hypot(p.x - h.x, p.y - h.y) < h.r + p.r * 0.5) this.damagePlayer(h.dps * dt, h.elem, false);
    }
    this.hazards = this.hazards.filter((h) => h.t > 0);
  }

  updateEnemies(dt) {
    const p = this.player, P = this.P, c = this.cfg;
    const chillAura = P.spec.spec_chillAura;
    this.updateEnvHazards(dt);
    // Unterstützer: Schilde und Heilung für Verbündete
    const supports = this.enemies.filter((e) => !e.dead && (e.d.shield || e.shieldAura || e.d.heal || e.d.hasteAura));
    for (const e of this.enemies) { e.shielded = false; e.hasted = false; }
    for (const s of supports) {
      const sr = s.d.shield || s.shieldAura || 0, hr = s.d.heal || 0, ar = s.d.hasteAura || 0;
      this.query(s.x, s.y, Math.max(sr, hr, ar), (o) => {
        if (o === s || o.boss) return;
        const dd = Math.hypot(o.x - s.x, o.y - s.y);
        if (sr && dd < sr) o.shielded = true;
        if (ar && dd < ar) o.hasted = true;
        if (hr && dd < hr && o.hp < o.maxHp && !o.hunt) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * (o.elite ? 0.015 : 0.05) * dt);
      });
    }
    const overtime = c.kind !== 'boss' && this.t > c.duration;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (overtime && e.elite) {
        e.hunt = true;
        if (this.t > c.duration + 20) { e.hp -= e.maxHp * 0.04 * dt; if (e.hp <= 0) { this.kill(e, null); continue; } }
      }
      if (e.d.phase && !e.hunt) {
        e.phaseT -= dt;
        if (e.phaseT <= 0) { e.phased = !e.phased; e.phaseT = e.phased ? 1.4 : rand(2.5, 3.5); }
      }
      e.flash -= dt; e.chill -= dt; e.frozen -= dt; e.shock -= dt;
      let dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      if (chillAura && d < 170) { e.chill = Math.max(e.chill, 0.3); e.chillEff = Math.max(e.chillEff, 0.3); }

      // Schaden über Zeit
      let dot = 0;
      if (e.burns.length) {
        let sum = 0, mx = 0;
        for (const b of e.burns) { b.t -= dt; sum += b.dps; mx = Math.max(mx, b.dps); }
        e.burns = e.burns.filter((b) => b.t > 0);
        dot += (e.burnStack ? sum : mx) * (1 - this.resOf(e, 'fire') / 100);
      }
      if (e.poisons.length) {
        let sum = 0;
        for (const ps of e.poisons) { ps.t -= dt; sum += ps.dps; }
        e.poisons = e.poisons.filter((ps) => ps.t > 0);
        dot += sum * (1 - this.resOf(e, 'chaos') / 100);
      }
      if (e.bleed) {
        e.bleed.t -= dt;
        dot += e.bleed.dps * (1 - this.resOf(e, 'phys') / 100) * (d > 0 ? 1 : 1);
        if (e.bleed.t <= 0) e.bleed = null;
      }
      if (dot > 0) {
        let m = e.takenMult;
        if (e.shock > 0) m *= 1 + e.shockEff;
        if (e.poisons.length && P.spec.spec_poisonVuln) m *= 1 + P.spec.spec_poisonVuln / 100;
        const v = dot * m * dt;
        e.hp -= v;
        this.stats.dmgDone += v;
        e.dotAcc += v;
        e.dotShow -= dt;
        if (e.dotShow <= 0) {
          e.dotShow = 0.6;
          if (e.dotAcc >= 1) this.dmgText(e, e.dotAcc, false, '#b6ff7a', true);
          e.dotAcc = 0;
        }
        if (e.hp <= 0) { this.kill(e, e.lastS); continue; }
      }
      if (e.affixes.includes('regen')) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.03 * dt);

      let spd = e.speed * (e.chill > 0 ? 1 - e.chillEff : 1);
      if (e.frozen > 0) spd = 0;

      if (e.boss) { this.updateBoss(e, dt, dx, dy, d, spd); continue; }

      let mx = dx, my = dy;
      if (e.affixes.includes('enraged') && e.hp < e.maxHp * 0.5) spd *= 1.6;
      if (e.hasted) spd *= 1.35;
      if (e.affixes.includes('chilling') && d < 170) p.slowT = 0.2;
      const R = e.d.ranged;
      if (R) {
        if (e.d.keep && !e.hunt) {
          if (d < e.d.keep - 30) { mx = -dx; my = -dy; spd *= 0.7; }
          else if (d < e.d.keep + 40) { mx = -dy * 0.6; my = dx * 0.6; spd *= 0.6; }
        }
        if (e.aimT > 0) {
          spd = 0;
          e.aimT -= dt;
          if (e.aimT <= 0) this.shootE(e.x, e.y, e.aimA, R.speed, e.dmg, R.elem, 9);
        } else {
          e.atk -= dt;
          if (e.atk <= 0 && d < 600 && e.frozen <= 0) {
            e.atk = R.cd * rand(0.8, 1.2);
            const a = Math.atan2(dy, dx);
            if (R.aim) {
              e.aimT = R.aim; e.aimA = a;
              this.fx.push({ type: 'line', x: e.x, y: e.y, a, len: 700, w: 6, t: R.aim, max: R.aim, color: ELEM[R.elem].color });
            } else if (R.ring) {
              const off = Math.random() * TAU;
              for (let i = 0; i < R.ring; i++) this.shootE(e.x, e.y, off + (i * TAU) / R.ring, R.speed, e.dmg, R.elem);
            } else {
              const n = R.burst || 1;
              for (let i = 0; i < n; i++) this.shootE(e.x, e.y, a + (i - (n - 1) / 2) * 0.22, R.speed, e.dmg, R.elem);
            }
          }
        }
      }
      if (e.d.heal && d < e.d.keep && !e.hunt) { mx = -dx; my = -dy; spd *= 0.8; }
      if (e.hunt) { e.phased = false; spd = Math.max(spd, 70); }
      const blinkCd = e.hunt ? 0 : e.d.blink || e.blinkCd;
      if (blinkCd && e.frozen <= 0) {
        e.blinkT -= dt;
        if (e.blinkT <= 0) {
          e.blinkT = blinkCd * rand(0.8, 1.2);
          const a = Math.random() * TAU, r = rand(90, 150);
          this.burst(e.x, e.y, e.color, 8, 100);
          e.x = p.x + Math.cos(a) * r; e.y = p.y + Math.sin(a) * r;
          this.ring(e.x, e.y, 30, e.color, 0.3);
        }
      }
      if (e.d.spawn) {
        e.spawnT -= dt;
        if (e.spawnT <= 0) {
          e.spawnT = e.d.spawn.cd;
          for (let i = 0; i < e.d.spawn.n; i++) this.spawn(e.d.spawn.id, e.x + rand(-30, 30), e.y + rand(-30, 30));
        }
      }
      if (e.d.leap) {
        e.leapT -= dt;
        if (e.leapT <= 0 && d < 400 && !e.leap) {
          e.leap = { x: p.x, y: p.y, t: 0.8 };
          this.teles.push({ x: p.x, y: p.y, r: 55, t: 0.8, max: 0.8, dmg: e.dmg, elem: 'phys' });
        }
        if (e.leap) {
          e.leap.t -= dt; spd = 0;
          if (e.leap.t <= 0) { e.x = e.leap.x; e.y = e.leap.y; e.leap = null; e.leapT = e.d.leap * rand(0.8, 1.2); }
        }
      }
      if (e.d.mines) {
        e.mineT -= dt;
        if (e.mineT <= 0) { e.mineT = e.d.mines * rand(0.8, 1.2); this.teles.push({ x: e.x, y: e.y, r: 48, t: 1.8, max: 1.8, dmg: e.dmg, elem: 'fire' }); }
        if (d < 260) { mx = -dy; my = dx; }
      }
      if (e.d.charge) {
        e.ct -= dt;
        if (!e.cs && e.ct <= 0 && d < 380) { e.cs = 'wind'; e.ct = 0.55; e.cdx = dx; e.cdy = dy; }
        else if (e.cs === 'wind') { spd = 0; if (e.ct <= 0) { e.cs = 'dash'; e.ct = 0.5; } }
        else if (e.cs === 'dash') { mx = e.cdx; my = e.cdy; spd = e.d.charge.speed; if (e.ct <= 0) { e.cs = null; e.ct = e.d.charge.cd * rand(0.8, 1.2); } }
      }
      if (e.d.explode) {
        if (!e.fuse && d < 48) e.fuse = 0.4;
        if (e.fuse) {
          e.fuse -= dt; spd *= 0.3;
          if (e.fuse <= 0) {
            const ex = e.d.explode;
            if (Math.hypot(p.x - e.x, p.y - e.y) < ex.r + p.r) this.damagePlayer(e.dmg, ex.elem, true);
            this.ring(e.x, e.y, ex.r, ELEM[ex.elem].color, 0.3);
            this.burst(e.x, e.y, ELEM[ex.elem].color, 14, 160);
            sfx.boom();
            e.dead = true;
            continue;
          }
        }
      }
      if (e.affixes.includes('burning') && d < 80) this.damagePlayer(e.dmg * 0.6 * dt, 'fire', false);
      if (e.sumT !== undefined) {
        e.sumT -= dt;
        if (e.sumT <= 0) { e.sumT = 6; for (let i = 0; i < 2; i++) this.spawn('shade', e.x + rand(-40, 40), e.y + rand(-40, 40)); }
      }

      e.x += mx * spd * dt;
      e.y += my * spd * dt;
      // Abstoßung von Nachbarn (verhindert Klumpen)
      const k = this.grid.get(this.key(Math.floor(e.x / CELL), Math.floor(e.y / CELL)));
      if (k && k.length > 1) {
        for (let i = 0; i < k.length && i < 8; i++) {
          const o = k[i];
          if (o === e || o.dead) continue;
          const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy), min = e.r + o.r;
          if (od > 0 && od < min) { const push = ((min - od) / od) * 0.5; e.x += ox * push; e.y += oy * push; }
        }
      }
      const ad = Math.hypot(e.x, e.y);
      if (ad > ARENA_R - e.r) { e.x *= (ARENA_R - e.r) / ad; e.y *= (ARENA_R - e.r) / ad; }
      if (d < e.r + p.r && e.dmg > 0 && !e.phased) this.damagePlayer(e.dmg, 'phys', true, e);
    }
  }

  resOf(e, t) { return clamp(e.res[t] || 0, -100, 90); }

  // ---------------------------------------------------------------- Boss
  updateBoss(e, dt, dx, dy, d, spd) {
    const p = this.player, b = e.b;
    if (b.phases) {
      const ratio = e.hp / e.maxHp;
      let ph = 0;
      b.phases.forEach((x, i) => { if (ratio <= x.at) ph = i; });
      if (ph !== (e.phase || 0)) {
        e.phase = ph;
        e.pat = b.phases[ph].patterns.map(([n, cd]) => ({ n, cd, t: cd * rand(0.3, 0.6) }));
        this.text(e.x, e.y - 60, `PHASE ${ph + 1}`, b.color, 1.8);
        this.ring(e.x, e.y, 260, b.color, 0.8);
        this.eprojs = [];
        if (save.settings.shake) this.shake = 10;
        sfx.boss();
      }
    }
    if (e.hp < e.maxHp * 0.5 && !e.rage) { e.rage = true; this.text(e.x, e.y - 50, 'WUT!', '#ff4d4d', 1.5); }
    // Laufende Muster
    if (e.charge) {
      const ch = e.charge;
      ch.t -= dt;
      if (ch.phase === 'wind') { if (ch.t <= 0) { ch.phase = 'dash'; ch.t = 0.6; } }
      else {
        e.x += ch.dx * 560 * dt; e.y += ch.dy * 560 * dt;
        if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r) this.damagePlayer(e.dmg * 1.5, 'phys', true);
        if (ch.t <= 0) e.charge = null;
      }
    } else if (e.frozen <= 0) {
      e.x += dx * spd * 0.8 * dt;
      e.y += dy * spd * 0.8 * dt;
    }
    if (e.spiral) {
      e.spiral.t -= dt; e.spiral.acc += dt;
      while (e.spiral.acc > 0.075) {
        e.spiral.acc -= 0.075;
        e.spiral.a += 0.33;
        for (let k = 0; k < 3; k++) this.shootE(e.x, e.y, e.spiral.a + (k * TAU) / 3, 150, e.dmg * 0.55, b.elem);
      }
      if (e.spiral.t <= 0) e.spiral = null;
    }
    if (e.barr) {
      e.barr.t -= dt;
      if (e.barr.t <= 0) {
        e.barr.t = 0.24; e.barr.n--;
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        for (let k = -2; k <= 2; k++) this.shootE(e.x, e.y, a + k * 0.16, 260, e.dmg * 0.6, b.elem);
        if (e.barr.n <= 0) e.barr = null;
      }
    }
    const ad = Math.hypot(e.x, e.y);
    if (ad > ARENA_R - e.r) { e.x *= (ARENA_R - e.r) / ad; e.y *= (ARENA_R - e.r) / ad; }
    if (!e.charge && d < e.r + p.r) this.damagePlayer(e.dmg, 'phys', true);
    if (e.frozen > 0) return;
    if (e.lasers) {
      e.lasers.t -= dt;
      if (e.lasers.t <= 0) {
        for (const a of e.lasers.angs) {
          const ex = e.x + Math.cos(a) * 900, ey = e.y + Math.sin(a) * 900;
          if (segDist(p.x, p.y, e.x, e.y, ex, ey) < 22 + p.r) this.damagePlayer(e.dmg * 1.4, b.elem, true);
          this.fx.push({ type: 'beam', x: e.x, y: e.y, a, len: 900, t: 0.25, max: 0.25, color: b.color });
        }
        if (save.settings.shake) this.shake = Math.max(this.shake, 4);
        e.lasers = null;
      }
    }
    const busy = e.charge || e.spiral || e.barr || e.lasers;
    for (const pt of e.pat) {
      pt.t -= dt * (e.rage ? 1.45 : 1);
      if (pt.t > 0 || busy) continue;
      pt.t = pt.cd * rand(0.85, 1.15);
      const act = this.cfg.act || 3;
      switch (pt.n) {
        case 'ring': {
          const n = 14 + act * 3, off = Math.random() * TAU;
          for (let i = 0; i < n; i++) this.shootE(e.x, e.y, off + (i * TAU) / n, 165, e.dmg * 0.6, b.elem);
          break;
        }
        case 'spiral': e.spiral = { t: 2.6, acc: 0, a: Math.random() * TAU }; break;
        case 'barrage': e.barr = { n: 3, t: 0 }; break;
        case 'charge': {
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          e.charge = { phase: 'wind', t: 0.75, dx: Math.cos(a), dy: Math.sin(a) };
          this.fx.push({ type: 'line', x: e.x, y: e.y, a, len: 420, w: e.r * 2, t: 0.75, max: 0.75, color: '#ff4d4d' });
          break;
        }
        case 'slam': {
          const spots = [[p.x, p.y], [p.x + rand(-140, 140), p.y + rand(-140, 140)], [p.x + rand(-140, 140), p.y + rand(-140, 140)]];
          for (const [x, y] of spots) this.teles.push({ x, y, r: 90, t: 1.15, max: 1.15, dmg: e.dmg * 1.3, elem: b.elem });
          break;
        }
        case 'laser': {
          const base = Math.atan2(p.y - e.y, p.x - e.x), n = e.rage ? 5 : 3;
          const angs = Array.from({ length: n }, (_, i) => base + (i - (n - 1) / 2) * (TAU / (n * 2.2)));
          e.lasers = { t: 1.0, angs };
          for (const a of angs) this.fx.push({ type: 'line', x: e.x, y: e.y, a, len: 900, w: 44, t: 1.0, max: 1.0, color: b.color });
          break;
        }
        case 'blink': {
          const a = Math.random() * TAU, r = rand(220, 300);
          this.burst(e.x, e.y, b.color, 20, 160);
          e.x = clamp(p.x + Math.cos(a) * r, -ARENA_R + 80, ARENA_R - 80);
          e.y = clamp(p.y + Math.sin(a) * r, -ARENA_R + 80, ARENA_R - 80);
          this.ring(e.x, e.y, 80, b.color, 0.4);
          const off = Math.random() * TAU;
          for (let i = 0; i < 10; i++) this.shootE(e.x, e.y, off + (i * TAU) / 10, 140, e.dmg * 0.5, b.elem);
          break;
        }
        case 'pools':
          for (let i = 0; i < 3 + (e.rage ? 2 : 0); i++) {
            const x = p.x + rand(-120, 120), y = p.y + rand(-120, 120);
            this.teles.push({ x, y, r: 60, t: 1.0, max: 1.0, dmg: e.dmg * 0.5, elem: b.elem, pool: { dps: e.dmg * 0.4, t: 4.5 } });
          }
          break;
        case 'firewall': {
          const a = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2;
          const gap = randi(-2, 2);
          for (let i = -4; i <= 4; i++) {
            if (i === gap) continue;
            this.teles.push({ x: p.x + Math.cos(a) * i * 70, y: p.y + Math.sin(a) * i * 70, r: 42, t: 1.1, max: 1.1, dmg: e.dmg * 1.2, elem: b.elem });
          }
          break;
        }
        case 'summon':
          for (let i = 0; i < 3 + act; i++) {
            const a = Math.random() * TAU;
            this.spawn(b.summon, e.x + Math.cos(a) * 80, e.y + Math.sin(a) * 80);
          }
          break;
      }
      break;
    }
  }

  shootE(x, y, a, spd, dmg, elem, r = 7) {
    if (this.eprojs.length > 600) return;
    const m = ascHas(this.cfg.asc, 'projSpeed') ? 1.25 : 1;
    this.eprojs.push({ x, y, vx: Math.cos(a) * spd * m, vy: Math.sin(a) * spd * m, r, dmg, elem, life: 6 });
  }

  updateEProjs(dt) {
    const p = this.player;
    for (const b of this.eprojs) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r - 2) {
        b.life = 0;
        this.damagePlayer(b.dmg, b.elem, true);
      }
      if (Math.hypot(b.x, b.y) > ARENA_R + 40) b.life = 0;
    }
    this.eprojs = this.eprojs.filter((b) => b.life > 0);
  }

  updateTeles(dt) {
    const p = this.player;
    for (const t of this.teles) {
      t.t -= dt;
      if (t.t <= 0) {
        if (Math.hypot(p.x - t.x, p.y - t.y) < t.r + p.r * 0.5) this.damagePlayer(t.dmg, t.elem, true);
        if (t.pool) this.hazards.push({ x: t.x, y: t.y, r: t.r, t: t.pool.t, max: t.pool.t, dps: t.pool.dps, elem: t.elem });
        if (t.bolt) { this.fx.push({ type: 'bolt', pts: [[t.x, t.y - 200], [t.x + rand(-20, 20), t.y - 100], [t.x, t.y]], t: 0.2, max: 0.2, color: ELEM[t.elem].color }); sfx.zap(); }
        this.ring(t.x, t.y, t.r, ELEM[t.elem].color, 0.35);
        this.burst(t.x, t.y, ELEM[t.elem].color, 12, 150);
      }
    }
    this.teles = this.teles.filter((t) => t.t > 0);
  }

  // ---------------------------------------------------------------- Treffer
  hitEnemy(e, S, mult = 1, chained = false) {
    if (e.dead || e.phased) return 0;
    const P = this.P, p = this.player;
    if (e.shielded) mult *= 0.5;
    if (P.spec.spec_berserk) mult *= 1 + 0.4 * (1 - Math.max(0, p.hp) / P.maxLife);
    if (P.spec.spec_stillness && !p.moving) mult *= 1.3;
    let crit = false;
    if (S.nthCrit) { S._n = (S._n || 0) + 1; crit = S._n % S.nthCrit === 0; }
    else if (S.crit > 0) crit = Math.random() * 100 < S.crit;
    if (crit) mult *= S.critMulti / 100;
    if (e.hp < e.maxHp * 0.35) mult *= S.vsLow;
    if (e.elite || e.boss) mult *= S.vsBoss;
    if (e.burns.length || e.poisons.length || e.bleed || e.chill > 0 || e.shock > 0 || e.frozen > 0) mult *= S.vsAil;
    if (e.shock > 0) mult *= 1 + e.shockEff;
    if (e.poisons.length && this.P.spec.spec_poisonVuln) mult *= 1 + this.P.spec.spec_poisonVuln / 100;
    if (S.ruthless) { S._r = (S._r || 0) + 1; if (S._r % 3 === 0) mult *= 1 + S.ruthless / 100; }
    let total = 0;
    const raw = {};
    for (const t in S.dmg) {
      const [a, b] = S.dmg[t];
      const v = (a + Math.random() * (b - a)) * mult;
      raw[t] = v;
      total += v * (1 - (this.resOf(e, t) - S.pen[t]) / 100);
    }
    total *= e.takenMult;
    e.lastS = S;
    this.dealDamage(e, total, crit, S);

    // Zustände (aus dem Schaden vor Widerständen)
    const ad = S.ailDur;
    if (raw.cold && S.chill) { e.chill = Math.max(e.chill, 2 * ad); e.chillEff = Math.max(e.chillEff, Math.min(0.5, 0.3 * S.chillEff)); }
    if (raw.cold && S.frz && Math.random() * 100 < S.frz) e.frozen = (e.boss ? 0.3 : 1.1) * ad;
    if (raw.fire && S.ign && Math.random() * 100 < S.ign) {
      const b = { dps: raw.fire * 0.5 * S.burnMult, t: 4 * ad };
      e.burnStack = S.burnStack;
      if (S.burnStack) { e.burns.push(b); if (e.burns.length > 10) e.burns.shift(); }
      else e.burns = [e.burns.length && e.burns[0].dps > b.dps ? e.burns[0] : b];
    }
    if (raw.light && S.shk && Math.random() * 100 < S.shk) { e.shock = 3 * ad; e.shockEff = Math.max(e.shockEff, Math.min(0.5, 0.2 * S.shockEff)); }
    const pc = (raw.phys || 0) + (raw.chaos || 0);
    if (pc && S.psn && Math.random() * 100 < S.psn) {
      e.poisons.push({ dps: pc * 0.3 * S.poisonMult, t: 3 * ad });
      if (e.poisons.length > 40) e.poisons.shift();
    }
    if (raw.phys && S.bld && Math.random() * 100 < S.bld) {
      const dps = raw.phys * 0.6 * S.bleedMult;
      if (!e.bleed || e.bleed.dps < dps) e.bleed = { dps, t: 4 * ad };
    }
    // Lebensraub (max. 12% des Lebens pro Sekunde)
    if (S.leech > 0) {
      const p = this.player;
      const want = (total * S.leech * this.P.leechMult) / 100;
      const room = this.P.maxLife * 0.12 - p.leechAcc;
      const got = Math.max(0, Math.min(want, room));
      if (got > 0) { p.leechAcc += got; this.heal(got); }
    }
    if (crit && this.P.critExplodePct && !S.noExplode) this.aoeFlat(e.x, e.y, 60, (total * this.P.critExplodePct) / 100, 'fire');
    if (S.def.tags.includes('minion') && P.spec.spec_minionLeech) this.heal((total * P.spec.spec_minionLeech) / 100);
    if (crit && P.spec.spec_critChain && !chained) {
      const ex = new Set([e]);
      const n = this.nearest(e.x, e.y, 220, ex);
      if (n) { this.fx.push({ type: 'bolt', pts: [[e.x, e.y], [n.x, n.y]], t: 0.15, max: 0.15, color: '#ffe066' }); this.hitEnemy(n, S, 1, true); }
    }
    if (e.hp <= 0) {
      if (P.spec.spec_overkill && e.hp < 0) {
        const over = -e.hp;
        const n = this.nearest(e.x, e.y, 180, new Set([e]));
        if (n) { this.dealDamage(n, over, false, S); if (n.hp <= 0) this.kill(n, S); }
      }
      this.kill(e, S);
    }
    return total;
  }

  dealDamage(e, amount, crit, S) {
    e.hp -= amount;
    e.flash = 0.08;
    this.stats.dmgDone += amount;
    if (amount > this.stats.maxHit) this.stats.maxHit = amount;
    if (crit) sfx.crit(); else sfx.hit();
    this.dmgText(e, amount, crit, S ? typeColor(S.dmg) : '#fff');
  }

  dmgText(e, amount, crit, color, dot = false) {
    if (!save.settings.dmgNums || this.texts.length > 70) return;
    this.texts.push({ x: e.x + rand(-8, 8), y: e.y - e.r - 6, txt: fmt(amount), color: crit ? '#ffe066' : color, t: 0.7, max: 0.7, size: crit ? 1.35 : dot ? 0.8 : 1, vy: -40 });
  }

  /** Flacher Flächenschaden ohne Krit/Zustände (Explosionen, Sturmläufer). */
  aoeFlat(x, y, r, amount, type) {
    this.query(x, y, r + 30, (e) => {
      if (Math.hypot(e.x - x, e.y - y) > r + e.r) return;
      const v = amount * (1 - this.resOf(e, type) / 100) * e.takenMult;
      this.dealDamage(e, v, false, null);
      if (e.hp <= 0) this.kill(e, null);
    });
    this.ring(x, y, r, ELEM[type].color, 0.25);
  }

  areaHit(S, x, y, r, mult = 1) {
    this.query(x, y, r + 30, (e) => {
      if (Math.hypot(e.x - x, e.y - y) <= r + e.r * 0.6) this.hitEnemy(e, S, mult);
    });
  }

  /** Flächentreffer inklusive Nachbeben (Glyphe/Effekt). */
  blast(S, x, y, r, color) {
    this.areaHit(S, x, y, r);
    this.ring(x, y, r, color, 0.3, true);
    if (S.aftershock) {
      this.delayed.push({ t: 0.4, fn: () => { this.areaHit(S, x, y, r * 1.1, 0.5); this.ring(x, y, r * 1.1, color, 0.3); } });
    }
  }

  areaDot(S, x, y, r, secs) {
    this.query(x, y, r + 30, (e) => {
      if (Math.hypot(e.x - x, e.y - y) > r + e.r * 0.5) return;
      let total = 0;
      for (const t in S.dmg) {
        const avg = (S.dmg[t][0] + S.dmg[t][1]) / 2;
        total += avg * secs * (1 - (this.resOf(e, t) - S.pen[t]) / 100);
      }
      let m = e.takenMult;
      if (e.shock > 0) m *= 1 + e.shockEff;
      if (e.elite || e.boss) m *= S.vsBoss;
      total *= m;
      e.hp -= total;
      e.lastS = S;
      this.stats.dmgDone += total;
      e.dotAcc += total;
      if (e.hp <= 0) this.kill(e, S);
    });
  }

  kill(e, S, silent = false) {
    if (!e.dead) this.stats.byType[e.id] = (this.stats.byType[e.id] || 0) + 1;
    if (e.dead) return;
    e.dead = true;
    const c = this.cfg, P = this.P;
    this.stats.kills++;
    if (!silent) {
      this.burst(e.x, e.y, e.color, e.boss ? 80 : e.elite ? 24 : 7, e.boss ? 300 : 120);
      sfx.kill();
    }
    // Belohnungen
    const eliteLoot = e.elite && c.eliteLoot ? 1.5 : 1;
    const xpv = e.xp * c.xpMult * eliteLoot;
    if (e.d.deathPool) { const dp = e.d.deathPool; this.hazards.push({ x: e.x, y: e.y, r: dp.r, t: dp.t, max: dp.t, dps: e.dmg * 0.6, elem: dp.elem }); }
    if (xpv > 0) this.dropOrb(e.x, e.y, 'xp', xpv);
    if (Math.random() < 0.06 + (e.elite ? 0.9 : 0)) this.dropOrb(e.x + rand(-10, 10), e.y + rand(-10, 10), 'gold', randi(1, 3) * (c.act || 3) * (e.elite ? 5 * eliteLoot : 1));
    if (Math.random() < (e.elite ? 0.3 : 0.007)) this.dropOrb(e.x, e.y, 'heart', 0.12);
    if (P.lifeOnKill) this.heal(P.lifeOnKill);
    if (e.elite) { this.stats.elites++; this.cb.onEliteKill(e); }
    // Besondere Effekte
    if (S && S.killExplode) this.aoeFlat(e.x, e.y, 75, (e.maxHp * S.killExplode) / 100, 'fire');
    if (P.spec.spec_burnSpread && e.burns.length) {
      const b = e.burns.reduce((a, x) => (x.dps > a.dps ? x : a));
      this.query(e.x, e.y, 110, (o) => { if (o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 110) o.burns.push({ dps: b.dps, t: 3 }); });
      this.ring(e.x, e.y, 110, ELEM.fire.color, 0.25);
    }
    if (P.spec.spec_shockSpread && e.shock > 0) {
      this.query(e.x, e.y, 120, (o) => { if (o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 120) { o.shock = 3; o.shockEff = Math.max(o.shockEff, e.shockEff); } });
      this.ring(e.x, e.y, 120, ELEM.light.color, 0.25);
    }
    if (e.d.split) for (let i = 0; i < (e.d.splitN || 2); i++) this.spawn(e.d.split, e.x + rand(-12, 12), e.y + rand(-12, 12));
    if (e.splitElite) for (let i = 0; i < 3; i++) this.spawn(e.id, e.x + rand(-25, 25), e.y + rand(-25, 25));
    if (S && S.shatter && e.frozen > 0) {
      this.query(e.x, e.y, 90, (o) => { if (o !== e) { o.chill = Math.max(o.chill, 2); o.chillEff = Math.max(o.chillEff, 0.35); } });
      this.aoeFlat(e.x, e.y, 70, e.maxHp * 0.1, 'cold');
      this.burst(e.x, e.y, '#bff3ff', 16, 200);
    }
    if (P.spec.spec_frenzy) { this.frenzy = Math.min(30, this.frenzy + 1); this.frenzyT = 3; }
    if (c.volatileCorpses && !e.boss && Math.random() < 0.4) this.teles.push({ x: e.x, y: e.y, r: 45, t: 0.8, max: 0.8, dmg: e.dmg * 0.7, elem: 'fire' });
    if (e.affixes.includes('volatile')) this.teles.push({ x: e.x, y: e.y, r: 85, t: 0.8, max: 0.8, dmg: e.dmg * 1.5, elem: 'fire' });
    if (!e.boss && !e.elite && ascHas(c.asc, 'explode') && Math.random() < 0.35) this.teles.push({ x: e.x, y: e.y, r: 40, t: 0.7, max: 0.7, dmg: e.dmg * 0.6, elem: 'fire' });
  }

  // ---------------------------------------------------------------- Fertigkeiten
  updateSkills(dt) {
    const p = this.player;
    if (this.frenzy) dt *= 1 + this.frenzy / 100;
    for (const sk of this.sk) {
      const S = sk.S, def = S.def;
      if (def.beh === 'orbit') { this.updateOrbit(sk, dt); continue; }
      if (def.beh === 'minion') continue;
      sk.t -= dt;
      if (sk.t > 0) continue;
      if (this.cast(sk)) {
        sk.t += S.interval;
        if (sk.t < 0) sk.t = 0;
        if (S.echo) this.delayed.push({ t: 0.2, fn: () => this.cast(sk, true) });
      } else sk.t = 0;
    }
  }

  updateDelayed(dt) {
    for (const d of this.delayed) { d.t -= dt; if (d.t <= 0) d.fn(); }
    this.delayed = this.delayed.filter((d) => d.t > 0);
  }

  cast(sk, echo = false) {
    const S = sk.S, def = S.def, p = this.player;
    const color = typeColor(S.dmg);
    switch (def.beh) {
      case 'proj': {
        const tgt = this.nearest(p.x, p.y, def.range || 550);
        if (!tgt) return false;
        this.fireProj(S, p.x, p.y, Math.atan2(tgt.y - p.y, tgt.x - p.x), color);
        return true;
      }
      case 'nova': {
        if (!this.nearest(p.x, p.y, S.area * 1.1)) return false;
        this.blast(S, p.x, p.y, S.area, color);
        return true;
      }
      case 'line': {
        const t = this.nearest(p.x, p.y, 420);
        if (!t) return false;
        const a = Math.atan2(t.y - p.y, t.x - p.x);
        const step = S.area * 1.25;
        for (let i = 0; i < S.steps; i++) {
          const x = p.x + Math.cos(a) * (40 + i * step), y = p.y + Math.sin(a) * (40 + i * step);
          this.delayed.push({ t: i * 0.08, fn: () => { this.blast(S, x, y, S.area, color); this.burst(x, y, color, 6, 120); } });
        }
        sfx.boom();
        return true;
      }
      case 'strikes': {
        const near = this.enemies.filter((e) => !e.dead && !e.phased && Math.hypot(e.x - p.x, e.y - p.y) < 400);
        if (!near.length) return false;
        for (let i = 0; i < S.count; i++) {
          const tg = pick(near);
          this.delayed.push({ t: i * 0.07, fn: () => {
            this.blast(S, tg.x, tg.y, S.area, color);
            this.fx.push({ type: 'bolt', pts: [[tg.x + rand(-30, 30), tg.y - 220], [tg.x + rand(-15, 15), tg.y - 100], [tg.x, tg.y]], t: 0.2, max: 0.2, color });
          } });
        }
        sfx.zap();
        return true;
      }
      case 'chain': {
        let t = this.nearest(p.x, p.y, def.range || 320);
        if (!t) return false;
        const hit = new Set();
        const pts = [[p.x, p.y]];
        let jumps = S.chain;
        while (t) {
          hit.add(t);
          pts.push([t.x, t.y]);
          this.hitEnemy(t, S);
          if (jumps-- <= 0) break;
          t = this.nearest(t.x, t.y, 230, hit);
        }
        this.fx.push({ type: 'bolt', pts, t: 0.2, max: 0.2, color });
        sfx.zap();
        return true;
      }
      case 'zone': {
        const t = this.nearest(p.x, p.y, 430);
        if (!t) return false;
        const n = S.def.count ? S.count : 1;
        for (let i = 0; i < n; i++) {
          const x = t.x + (i ? rand(-90, 90) : 0), y = t.y + (i ? rand(-90, 90) : 0);
          this.zones.push({ x, y, r: S.area, t: S.dur, max: S.dur, tick: 0, S, color });
        }
        if (this.zones.length > 40) this.zones.splice(0, this.zones.length - 40);
        return true;
      }
      case 'melee': {
        const reach = def.reach || 80;
        const t = this.nearest(p.x, p.y, reach + S.area);
        if (!t) return false;
        const d = Math.hypot(t.x - p.x, t.y - p.y) || 1;
        const r = Math.min(d, reach);
        const cx = p.x + ((t.x - p.x) / d) * r, cy = p.y + ((t.y - p.y) / d) * r;
        this.blast(S, cx, cy, S.area, color);
        this.burst(cx, cy, color, 8, 120);
        if (save.settings.shake) this.shake = Math.max(this.shake, 2);
        return true;
      }
      case 'meteor': {
        const near = this.enemies.filter((e) => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 480);
        if (!near.length) return false;
        for (let i = 0; i < S.count; i++) {
          const tg = pick(near);
          const x = tg.x + rand(-20, 20), y = tg.y + rand(-20, 20);
          const delay = (def.delay || 0.7) + i * 0.15;
          this.fx.push({ type: 'tele', x, y, r: S.area, t: delay, max: delay, color });
          this.delayed.push({ t: delay, fn: () => {
            this.blast(S, x, y, S.area, color);
            this.burst(x, y, color, 26, 260);
            sfx.boom();
            if (save.settings.shake) this.shake = Math.max(this.shake, 4);
          } });
        }
        return true;
      }
      case 'aura':
        this.areaDot(S, p.x, p.y, S.area, S.interval);
        if (S.chillAura) {
          this.query(p.x, p.y, S.area + 20, (e) => {
            if (Math.hypot(e.x - p.x, e.y - p.y) < S.area) { e.chill = Math.max(e.chill, 0.6); e.chillEff = Math.max(e.chillEff, Math.min(0.55, 0.35 * S.chillEff)); }
          });
        }
        return true;
      case 'trap': {
        const mine = this.traps.filter((t) => t.S.id === S.id);
        if (mine.length >= S.trapMax) { const old = mine[0]; old.life = 0; }
        const tg = this.nearest(p.x, p.y, 300);
        const x = tg ? tg.x + rand(-30, 30) : p.x + rand(-80, 80);
        const y = tg ? tg.y + rand(-30, 30) : p.y + rand(-80, 80);
        this.traps.push({ x, y, sx: p.x, sy: p.y, fly: 0.25, arm: 0.45, life: 10, S, color });
        return true;
      }
    }
    return false;
  }

  fireProj(S, x, y, ang, color) {
    const n = S.count, spread = S.def.spread || 0.15;
    const total = Math.min(spread * (n - 1), TAU * 0.92);
    for (let i = 0; i < n; i++) {
      if (this.projs.length >= MAX_PROJ) return;
      const a = n === 1 ? ang : ang - total / 2 + (total * i) / (n - 1);
      this.projs.push({
        x, y, vx: Math.cos(a) * S.projSpeed, vy: Math.sin(a) * S.projSpeed, r: S.def.size || 6,
        life: ((S.def.range || 550) / S.projSpeed) * 1.2 + 0.1, S, pierce: S.pierce, chain: S.chain,
        hit: new Set(), homing: S.def.homing || 0, tgt: null, tgtT: 0, color,
        ox: x, oy: y, ret: S.ret, back: false, fork: S.fork, pulseT: S.pulse ? S.pulse.rate * 0.5 : 0,
      });
    }
  }

  updateProjs(dt) {
    for (const pr of this.projs) {
      if (pr.homing) {
        pr.tgtT -= dt;
        if (pr.tgtT <= 0 || !pr.tgt || pr.tgt.dead) { pr.tgt = this.nearest(pr.x, pr.y, 320, pr.hit); pr.tgtT = 0.15; }
        if (pr.tgt) {
          const sp = Math.hypot(pr.vx, pr.vy);
          const cur = Math.atan2(pr.vy, pr.vx);
          const want = Math.atan2(pr.tgt.y - pr.y, pr.tgt.x - pr.x);
          let da = want - cur;
          while (da > Math.PI) da -= TAU;
          while (da < -Math.PI) da += TAU;
          const na = cur + clamp(da, -pr.homing * dt, pr.homing * dt);
          pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
        }
      }
      if (pr.ret) {
        const p = this.player;
        if (!pr.back && (Math.hypot(pr.x - pr.ox, pr.y - pr.oy) > (pr.S.def.range || 450) * 0.75 || pr.life < 0.15)) {
          pr.back = true; pr.hit.clear(); pr.pierce = Math.max(pr.pierce, 99); pr.life = 3;
        }
        if (pr.back) {
          const sp = Math.hypot(pr.vx, pr.vy), a = Math.atan2(p.y - pr.y, p.x - pr.x);
          pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
          if (Math.hypot(p.x - pr.x, p.y - pr.y) < p.r + 10) { pr.dead = true; continue; }
        }
      }
      if (pr.S.pulse) {
        pr.pulseT -= dt;
        if (pr.pulseT <= 0) {
          pr.pulseT = pr.S.pulse.rate;
          const ex = new Set();
          for (let k = 0; k < 2; k++) {
            const t = this.nearest(pr.x, pr.y, pr.S.pulse.r, ex);
            if (!t) break;
            ex.add(t);
            this.hitEnemy(t, pr.S);
            this.fx.push({ type: 'bolt', pts: [[pr.x, pr.y], [t.x, t.y]], t: 0.12, max: 0.12, color: pr.color });
          }
        }
      }
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.life <= 0 || Math.hypot(pr.x, pr.y) > ARENA_R + 50) { pr.dead = true; continue; }
      if (pr.S.pulse && !pr.ret) continue; // Kugelblitz trifft nur über Entladungen
      this.query(pr.x, pr.y, pr.r + 30, (e) => {
        if (pr.dead || pr.hit.has(e)) return;
        if (Math.hypot(e.x - pr.x, e.y - pr.y) < pr.r + e.r) this.projHit(pr, e);
      });
    }
    this.projs = this.projs.filter((p) => !p.dead);
  }

  projHit(pr, e) {
    const S = pr.S;
    pr.hit.add(e);
    if (S.explode > 0) {
      this.areaHit(S, e.x, e.y, S.explode);
      this.ring(e.x, e.y, S.explode, pr.color, 0.25, true);
      this.burst(e.x, e.y, pr.color, 8, 140);
    } else this.hitEnemy(e, S);
    if (pr.fork) {
      pr.fork = false;
      const a = Math.atan2(pr.vy, pr.vx), sp = Math.hypot(pr.vx, pr.vy);
      for (const da of [-0.55, 0.55]) {
        if (this.projs.length >= MAX_PROJ) break;
        this.projs.push({ ...pr, x: e.x, y: e.y, vx: Math.cos(a + da) * sp, vy: Math.sin(a + da) * sp, hit: new Set([e]), fork: false, life: Math.max(0.6, pr.life), dead: false });
      }
    }
    if (pr.pierce > 0) { pr.pierce--; return; }
    if (pr.chain > 0) {
      const n = this.nearest(e.x, e.y, 260, pr.hit);
      if (n) {
        pr.chain--;
        const a = Math.atan2(n.y - e.y, n.x - e.x), sp = Math.hypot(pr.vx, pr.vy);
        pr.x = e.x; pr.y = e.y;
        pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
        pr.life = Math.max(pr.life, 0.8);
        return;
      }
    }
    pr.dead = true;
  }

  updateOrbit(sk, dt) {
    const S = sk.S, p = this.player;
    sk.orbitA += S.orbitSpeed * dt;
    const n = S.count, R = S.area, br = 13 * Math.sqrt(Math.max(1, S.area / 78));
    const now = this.t;
    if (Math.random() < 0.02) for (const [e, t] of sk.hitCd) if (e.dead || t < now - 2) sk.hitCd.delete(e);
    for (let i = 0; i < n; i++) {
      const a = sk.orbitA + (i * TAU) / n;
      const x = p.x + Math.cos(a) * R, y = p.y + Math.sin(a) * R;
      this.query(x, y, br + 30, (e) => {
        if (Math.hypot(e.x - x, e.y - y) > br + e.r) return;
        const last = sk.hitCd.get(e);
        if (last !== undefined && now - last < S.interval) return;
        sk.hitCd.set(e, now);
        this.hitEnemy(e, S);
      });
    }
  }

  updateZones(dt) {
    for (const z of this.zones) {
      z.t -= dt; z.tick -= dt;
      if (z.S.def.pull) {
        this.query(z.x, z.y, z.r + 30, (e) => {
          if (e.boss) return;
          const dx = z.x - e.x, dy = z.y - e.y, d = Math.hypot(dx, dy);
          if (d < z.r && d > 4) { const f = Math.min(d, 70 * dt) / d; e.x += dx * f; e.y += dy * f; }
        });
      }
      if (z.tick <= 0) { z.tick += 0.5; this.areaDot(z.S, z.x, z.y, z.r, 0.5); }
    }
    this.zones = this.zones.filter((z) => z.t > 0);
  }

  updateTraps(dt) {
    for (const t of this.traps) {
      t.life -= dt;
      if (t.fly > 0) { t.fly -= dt; continue; }
      t.arm -= dt;
      if (t.arm > 0 || t.life <= 0) continue;
      let trig = false;
      this.query(t.x, t.y, 70, (e) => { if (!trig && Math.hypot(e.x - t.x, e.y - t.y) < 38 + e.r) trig = true; });
      if (trig) {
        t.life = 0;
        this.blast(t.S, t.x, t.y, t.S.area, t.color);
        this.burst(t.x, t.y, t.color, 14, 180);
        sfx.zap();
      }
    }
    this.traps = this.traps.filter((t) => t.life > 0);
  }

  updateMinions(dt) {
    const p = this.player;
    for (const m of this.minions) {
      const sk = this.skOf(m.skId);
      if (!sk) continue;
      const S = sk.S;
      m.bob += dt * 4;
      const ranged = m.kind === 'wisp' || m.kind === 'spirit' || m.ranged;
      const range = ranged ? 230 : m.kind === 'golem' ? 50 : 30;
      const tgt = this.nearest(m.x, m.y, 460);
      let tx, ty;
      if (tgt && Math.hypot(tgt.x - p.x, tgt.y - p.y) < 520) { tx = tgt.x; ty = tgt.y; }
      else { const a = m.bob * 0.3 + this.minions.indexOf(m); tx = p.x + Math.cos(a) * 50; ty = p.y + Math.sin(a) * 50; }
      const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy) || 1;
      const spd = (m.kind === 'wisp' ? 210 : m.kind === 'spirit' ? 240 : m.kind === 'golem' ? 130 : m.kind === 'pet' ? 230 : m.kind === 'wolf' ? 235 : m.kind === 'locust' ? 270 : 190) * (S.minionSpeed || 1);
      const stop = tgt && tx === tgt.x ? range * 0.8 : 10;
      if (d > stop) { m.x += (dx / d) * spd * dt; m.y += (dy / d) * spd * dt; m.face = Math.atan2(dy, dx); }
      if (Math.hypot(m.x - p.x, m.y - p.y) > 600) { m.x = p.x; m.y = p.y; }
      m.atk -= dt;
      if (m.atk <= 0 && tgt && Math.hypot(tgt.x - m.x, tgt.y - m.y) < range + tgt.r) {
        m.atk = S.interval;
        if (ranged) {
          const extra = Math.max(1, S.count - (S.def.count || 1) + 1);
          const col = m.kind === 'pet' ? m.petColor : m.kind === 'spirit' ? ELEM.fire.color : ELEM.light.color;
          this.fireProj({ ...S, count: extra, def: { ...S.def, range: 300, size: 5, spread: 0.2 }, projSpeed: 420 }, m.x, m.y, Math.atan2(tgt.y - m.y, tgt.x - m.x), col);
        } else if (m.kind === 'golem') {
          this.blast(S, tgt.x, tgt.y, 62, ELEM.cold.color);
          if (save.settings.shake) this.shake = Math.max(this.shake, 2);
        } else {
          this.areaHit(S, tgt.x, tgt.y, 26);
          this.fx.push({ type: 'slash', x: tgt.x, y: tgt.y, a: Math.atan2(dy, dx), t: 0.15, max: 0.15, color: '#e6dccb' });
        }
      }
    }
  }

  // ---------------------------------------------------------------- Beute
  dropOrb(x, y, type, v) {
    if (this.orbs.length > 260 && type === 'xp') {
      const o = this.orbs[Math.floor(Math.random() * this.orbs.length)];
      if (o.type === 'xp') { o.v += v; return; }
    }
    this.orbs.push({ x, y, type, v, pull: false, sp: 0 });
  }

  updateOrbs(dt) {
    const p = this.player, P = this.P;
    const vacuum = this.over;
    for (const o of this.orbs) {
      const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 1;
      if (vacuum || d < P.magnet) o.pull = true;
      if (o.pull) {
        o.sp = Math.min(900, o.sp + 1400 * dt);
        o.x += (dx / d) * o.sp * dt; o.y += (dy / d) * o.sp * dt;
      }
      if (d < p.r + 8) {
        o.dead = true;
        if (o.type === 'xp') { this.cb.onXp(o.v); sfx.xp(); }
        else if (o.type === 'gold') { this.cb.onGold(o.v); sfx.gold(); }
        else { this.heal(P.maxLife * o.v * P.heal); this.text(p.x, p.y - 22, '+Leben', '#7dff9a', 0.9); }
      }
    }
    this.orbs = this.orbs.filter((o) => !o.dead);
  }

  // ---------------------------------------------------------------- Ende
  checkEnd() {
    if (this.over) return;
    const c = this.cfg;
    if (c.kind === 'boss') {
      this.objective = this.bossSpawned ? '' : 'Etwas nähert sich …';
      if (this.bossSpawned && this.boss.dead) this.win();
    } else if (this.t >= c.duration) {
      const elites = this.enemies.some((e) => e.elite && !e.dead) || this.eliteTimes.length;
      if (c.kind === 'elite' && elites) this.objective = 'Besiege die Elite!';
      else this.win();
    } else this.objective = '';
  }

  win() {
    this.over = true;
    this.endT = 1.4;
    this.result = { win: true };
    for (const e of this.enemies) if (!e.dead) { e.dead = true; this.burst(e.x, e.y, e.color, 4, 80); }
    this.eprojs = [];
    this.teles = [];
    this.text(this.player.x, this.player.y - 60, 'GEBIET GESÄUBERT', '#ffe066', 1.6);
    sfx.win();
  }

  // ---------------------------------------------------------------- Effekte
  ring(x, y, r, color, t = 0.3, fill = false) {
    if (this.fx.length > 160) return;
    this.fx.push({ type: 'ring', x, y, r, t, max: t, color, fill });
  }
  burst(x, y, color, n, spd) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 500) this.parts.shift();
      const a = Math.random() * TAU, v = rand(0.3, 1) * spd, life = rand(0.3, 0.7);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: life, max: life, color, s: rand(1.5, 3.5) });
    }
  }
  text(x, y, txt, color, size = 1) {
    this.texts.push({ x, y, txt, color, t: 1.2, max: 1.2, size, vy: -25 });
  }
  updateFx(dt) {
    for (const f of this.fx) f.t -= dt;
    this.fx = this.fx.filter((f) => f.t > 0);
    const damp = Math.pow(0.06, dt);
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= damp; p.vy *= damp; p.t -= dt; }
    this.parts = this.parts.filter((p) => p.t > 0);
    for (const t of this.texts) { t.y += t.vy * dt; t.t -= dt; }
    this.texts = this.texts.filter((t) => t.t > 0);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 25);
  }

  // ---------------------------------------------------------------- Rendering
  glow(color, r) {
    const key = color + '|' + Math.round(r);
    let c = this.glowCache.get(key);
    if (!c) {
      const s = Math.max(2, Math.ceil(r * 2 * this.DPR));
      c = document.createElement('canvas');
      c.width = c.height = s;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, rgba(color, 0.9));
      gr.addColorStop(0.35, rgba(color, 0.35));
      gr.addColorStop(1, rgba(color, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, s, s);
      this.glowCache.set(key, c);
    }
    return c;
  }

  render() {
    const ctx = this.ctx, W = this.W, H = this.H, sc = this.scale;
    ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    ctx.fillStyle = this.cfg ? this.cfg.tint : '#0a0716';
    ctx.fillRect(0, 0, W, H);
    // Sterne (Bildschirmraum, leichte Parallaxe)
    const p = this.player || { x: 0, y: 0 };
    ctx.fillStyle = '#fff';
    for (const s of this.stars) {
      const x = ((s.x * W - p.x * 0.05) % W + W) % W, y = ((s.y * H - p.y * 0.05) % H + H) % H;
      ctx.globalAlpha = s.a * 0.6;
      ctx.fillRect(x, y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
    if (!this.cfg) return;

    let sx = 0, sy = 0;
    if (this.shake > 0) { sx = rand(-1, 1) * this.shake; sy = rand(-1, 1) * this.shake; }
    const ox = W / 2 - p.x * sc + sx, oy = H / 2 - p.y * sc + sy;
    const X = (x) => ox + x * sc, Y = (y) => oy + y * sc;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(sc, sc);

    // Arena-Boden
    ctx.fillStyle = this.cfg.floorColor;
    ctx.beginPath(); ctx.arc(0, 0, ARENA_R, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(180,140,255,0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let r = 150; r < ARENA_R; r += 150) { ctx.moveTo(r, 0); ctx.arc(0, 0, r, 0, TAU); }
    for (let i = 0; i < 12; i++) { const a = (i * TAU) / 12; ctx.moveTo(Math.cos(a) * 150, Math.sin(a) * 150); ctx.lineTo(Math.cos(a) * ARENA_R, Math.sin(a) * ARENA_R); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,216,77,0.45)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, ARENA_R, 0, TAU); ctx.stroke();

    // Auren
    for (const sk of this.sk) {
      if (sk.S.def.beh !== 'aura') continue;
      const col = typeColor(sk.S.dmg);
      ctx.fillStyle = rgba(col, 0.07 + 0.03 * Math.sin(this.t * 4));
      ctx.beginPath(); ctx.arc(p.x, p.y, sk.S.area, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(col, 0.35); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, sk.S.area, 0, TAU); ctx.stroke();
    }
    // Giftpfützen / Gefahren
    for (const h of this.hazards) {
      const a = Math.min(1, h.t / 0.6);
      ctx.fillStyle = rgba(ELEM[h.elem].color, 0.18 * a);
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(ELEM[h.elem].color, 0.55 * a); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r * (0.9 + 0.08 * Math.sin(this.t * 4 + h.x)), 0, TAU); ctx.stroke();
    }
    // Zonen
    for (const z of this.zones) {
      const a = Math.min(1, z.t / 0.4) * 0.22;
      ctx.fillStyle = rgba(z.color, a);
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(z.color, a * 2); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r * (0.85 + 0.1 * Math.sin(this.t * 5 + z.x)), 0, TAU); ctx.stroke();
    }
    // Warnzeichen
    for (const t of this.teles) {
      const k = 1 - t.t / t.max;
      ctx.fillStyle = rgba(ELEM[t.elem].color, 0.12 + k * 0.2);
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r * k, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(ELEM[t.elem].color, 0.7); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, TAU); ctx.stroke();
    }
    for (const f of this.fx) {
      if (f.type === 'tele') {
        const k = 1 - f.t / f.max;
        ctx.strokeStyle = rgba(f.color, 0.6); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke();
        ctx.fillStyle = rgba(f.color, 0.15 * k);
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * k, 0, TAU); ctx.fill();
      } else if (f.type === 'beam') {
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a);
        ctx.fillStyle = rgba(f.color, 0.8 * (f.t / f.max));
        ctx.fillRect(0, -16, f.len, 32);
        ctx.fillStyle = rgba('#ffffff', 0.9 * (f.t / f.max));
        ctx.fillRect(0, -5, f.len, 10);
        ctx.restore();
      } else if (f.type === 'line') {
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a);
        ctx.fillStyle = rgba(f.color, 0.12 + 0.2 * (1 - f.t / f.max));
        ctx.fillRect(0, -f.w / 2, f.len, f.w);
        ctx.restore();
      }
    }
    // Beute
    for (const o of this.orbs) {
      if (o.type === 'xp') {
        const r = 3 + Math.min(5, Math.sqrt(o.v));
        ctx.drawImage(this.glow('#62d6ff', r * 3), o.x - r * 3, o.y - r * 3, r * 6, r * 6);
        ctx.fillStyle = '#d6f6ff';
        ctx.beginPath(); ctx.moveTo(o.x, o.y - r); ctx.lineTo(o.x + r * 0.7, o.y); ctx.lineTo(o.x, o.y + r); ctx.lineTo(o.x - r * 0.7, o.y); ctx.fill();
      } else if (o.type === 'gold') {
        ctx.drawImage(this.glow('#ffd84d', 14), o.x - 14, o.y - 14, 28, 28);
        ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(o.x, o.y, 5, 0, TAU); ctx.fill();
      } else {
        ctx.drawImage(this.glow('#ff4d6d', 18), o.x - 18, o.y - 18, 36, 36);
        ctx.fillStyle = '#ff8099'; ctx.beginPath(); ctx.arc(o.x, o.y, 6, 0, TAU); ctx.fill();
      }
    }
    // Fallen
    for (const t of this.traps) {
      let x = t.x, y = t.y;
      if (t.fly > 0) { const k = 1 - t.fly / 0.25; x = t.sx + (t.x - t.sx) * k; y = t.sy + (t.y - t.sy) * k - Math.sin(k * Math.PI) * 40; }
      ctx.strokeStyle = t.arm > 0 ? rgba(t.color, 0.4) : t.color; ctx.lineWidth = 2.5;
      ctx.save(); ctx.translate(x, y); ctx.rotate(this.t * 2);
      ctx.strokeRect(-7, -7, 14, 14);
      ctx.restore();
    }
    // Gegner
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.abs(X(e.x) - W / 2) > W / 2 + 60 || Math.abs(Y(e.y) - H / 2) > H / 2 + 60) continue;
      this.drawEnemy(ctx, e);
    }
    // Begleiter
    for (const m of this.minions) {
      if (m.kind === 'wisp') {
        const y = m.y + Math.sin(m.bob) * 4;
        ctx.drawImage(this.glow('#ffe34d', 22), m.x - 22, y - 22, 44, 44);
        ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(m.x, y, 5, 0, TAU); ctx.fill();
      } else if (m.kind === 'wolf') {
        ctx.drawImage(this.glow('#8affd8', 20), m.x - 20, m.y - 20, 40, 40);
        ctx.fillStyle = '#1a2e2a'; ctx.strokeStyle = '#bfffe8'; ctx.lineWidth = 2;
        const a = m.face || 0;
        ctx.beginPath(); ctx.moveTo(m.x + Math.cos(a) * 12, m.y + Math.sin(a) * 12);
        ctx.lineTo(m.x + Math.cos(a + 2.4) * 9, m.y + Math.sin(a + 2.4) * 9); ctx.lineTo(m.x + Math.cos(a - 2.4) * 9, m.y + Math.sin(a - 2.4) * 9);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (m.kind === 'locust') {
        ctx.fillStyle = '#c8ff5e';
        ctx.beginPath(); ctx.arc(m.x + Math.sin(m.bob * 3) * 2, m.y + Math.cos(m.bob * 3) * 2, 3.5, 0, TAU); ctx.fill();
      } else if (m.kind === 'pet') {
        const y = m.y + Math.sin(m.bob) * 3;
        ctx.drawImage(this.glow(m.petColor || '#ffffff', 26), m.x - 26, y - 26, 52, 52);
        ctx.font = '20px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(m.glyph || '●', m.x, y);
      } else if (m.kind === 'spirit') {
        const y = m.y + Math.sin(m.bob * 1.3) * 5;
        ctx.drawImage(this.glow('#ff7a2a', 20), m.x - 20, y - 20, 40, 40);
        ctx.fillStyle = '#ffd0a0';
        ctx.beginPath(); ctx.moveTo(m.x, y - 8); ctx.quadraticCurveTo(m.x + 6, y, m.x, y + 5); ctx.quadraticCurveTo(m.x - 6, y, m.x, y - 8); ctx.fill();
      } else if (m.kind === 'golem') {
        ctx.drawImage(this.glow('#62d6ff', 34), m.x - 34, m.y - 34, 68, 68);
        ctx.fillStyle = '#1d3a4a'; ctx.strokeStyle = '#bff3ff'; ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6 + 0.3; ctx.lineTo(m.x + Math.cos(a) * 18, m.y + Math.sin(a) * 18); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#9fe7ff'; ctx.fillRect(m.x - 6, m.y - 4, 4, 4); ctx.fillRect(m.x + 2, m.y - 4, 4, 4);
      } else {
        ctx.fillStyle = '#2a2530'; ctx.strokeStyle = '#e6dccb'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(m.x, m.y, 10, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#9fe7ff'; ctx.fillRect(m.x - 4, m.y - 3, 2.5, 2.5); ctx.fillRect(m.x + 1.5, m.y - 3, 2.5, 2.5);
      }
    }
    // Projektile
    ctx.globalCompositeOperation = 'lighter';
    for (const pr of this.projs) {
      const r = pr.r;
      ctx.drawImage(this.glow(pr.color, r * 3), pr.x - r * 3, pr.y - r * 3, r * 6, r * 6);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const pr of this.projs) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 0.45, 0, TAU); ctx.fill();
    }
    for (const b of this.eprojs) {
      const col = ELEM[b.elem].color;
      ctx.drawImage(this.glow(col, 16), b.x - 16, b.y - 16, 32, 32);
      ctx.fillStyle = '#1a0b10'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.7, 0, TAU); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
    }
    // Spieler
    if (!(this.over && this.result && !this.result.win)) this.drawPlayer(ctx);
    // Kreisende Klingen
    for (const sk of this.sk) {
      if (sk.S.def.beh !== 'orbit') continue;
      const n = sk.S.count, R = sk.S.area, col = typeColor(sk.S.dmg);
      for (let i = 0; i < n; i++) {
        const a = sk.orbitA + (i * TAU) / n;
        const x = p.x + Math.cos(a) * R, y = p.y + Math.sin(a) * R;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a + this.t * 12);
        ctx.drawImage(this.glow(col, 16), -16, -16, 32, 32);
        ctx.fillStyle = '#f2eee6';
        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(0, -3.5); ctx.lineTo(12, 0); ctx.lineTo(0, 3.5); ctx.fill();
        ctx.restore();
      }
    }
    // Effekte
    for (const f of this.fx) {
      const k = f.t / f.max;
      if (f.type === 'ring') {
        const rr = f.r * (f.fill ? 1 - k * 0.6 + 0.6 * (1 - k) : 1);
        if (f.fill) { ctx.fillStyle = rgba(f.color, 0.18 * k); ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = rgba(f.color, 0.8 * k); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(1, rr), 0, TAU); ctx.stroke();
      } else if (f.type === 'bolt') {
        ctx.strokeStyle = rgba(f.color, k); ctx.lineWidth = 3;
        ctx.beginPath();
        f.pts.forEach(([x, y], i) => {
          if (!i) { ctx.moveTo(x, y); return; }
          const [px, py] = f.pts[i - 1];
          ctx.lineTo((px + x) / 2 + rand(-10, 10), (py + y) / 2 + rand(-10, 10));
          ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.strokeStyle = rgba('#ffffff', k * 0.8); ctx.lineWidth = 1;
        ctx.stroke();
      } else if (f.type === 'slash') {
        ctx.strokeStyle = rgba(f.color, k); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(f.x, f.y, 18, f.a - 1, f.a + 1); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const pt of this.parts) {
      ctx.globalAlpha = pt.t / pt.max;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.s / 2, pt.y - pt.s / 2, pt.s, pt.s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // Schadenszahlen
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, (t.t / t.max) * 2);
      ctx.font = `800 ${Math.round(13 * t.size)}px system-ui, sans-serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(t.txt, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Joystick
    const s = this.input.stick;
    if (s && this.running) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.ox, s.oy, 60, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.arc(s.x, s.y, 24, 0, TAU); ctx.fill();
    }
    // Schadensblitz bei Treffer
    if (this.player.hurt > 0) {
      ctx.fillStyle = `rgba(255,40,60,${this.player.hurt * 0.6})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  drawPlayer(ctx) {
    const p = this.player, P = this.P;
    const blink = p.inv > 0 && Math.floor(p.inv * 14) % 2 === 0;
    ctx.globalAlpha = blink ? 0.45 : 1;
    ctx.drawImage(this.glow('#a8c8ff', 48), p.x - 48, p.y - 48, 96, 96);
    if (p.barrier > 0 && P.maxBarrier > 0) {
      ctx.strokeStyle = rgba('#9fe7ff', 0.3 + 0.5 * (p.barrier / P.maxBarrier));
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 7, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = '#1b1530';
    ctx.strokeStyle = '#f4f0ff';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe066';
    const fx = p.x + Math.cos(p.face) * 6, fy = p.y + Math.sin(p.face) * 6;
    ctx.beginPath(); ctx.arc(fx, fy, 4.5, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawEnemy(ctx, e) {
    const r = e.r;
    let stroke = e.color;
    if (e.phased) ctx.globalAlpha = 0.25;
    if (e.d.shield || e.shieldAura) {
      ctx.strokeStyle = rgba('#7aa8ff', 0.22); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.d.shield || e.shieldAura, 0, TAU); ctx.stroke();
    }
    if (e.d.heal) {
      ctx.strokeStyle = rgba('#7dffb0', 0.18); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.d.heal, 0, TAU); ctx.stroke();
    }
    if (e.d.hasteAura) {
      ctx.strokeStyle = rgba('#ff8a5c', 0.2); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.d.hasteAura, 0, TAU); ctx.stroke();
    }
    if (e.shielded) {
      ctx.strokeStyle = '#9fc4ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, r + 4, 0, TAU); ctx.stroke();
    }
    if (e.frozen > 0) stroke = '#bff3ff';
    else if (e.shock > 0) stroke = ELEM.light.color;
    else if (e.burns.length) stroke = ELEM.fire.color;
    else if (e.poisons.length) stroke = ELEM.chaos.color;
    else if (e.chill > 0) stroke = ELEM.cold.color;
    if (e.boss || e.elite) ctx.drawImage(this.glow(e.boss ? e.color : '#ffd84d', r * 2.4), e.x - r * 2.4, e.y - r * 2.4, r * 4.8, r * 4.8);
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : e.frozen > 0 ? '#2a5566' : '#130d1c';
    ctx.strokeStyle = stroke;
    ctx.lineWidth = e.boss ? 4 : 2.5;
    ctx.beginPath();
    const sh = e.boss ? 'boss' : e.d.shape;
    if (sh === 'tri') {
      const a = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      for (let i = 0; i < 3; i++) { const b = a + (i * TAU) / 3; ctx.lineTo(e.x + Math.cos(b) * r * 1.2, e.y + Math.sin(b) * r * 1.2); }
      ctx.closePath();
    } else if (sh === 'square') ctx.rect(e.x - r, e.y - r, r * 2, r * 2);
    else if (sh === 'diamond') { ctx.moveTo(e.x, e.y - r * 1.2); ctx.lineTo(e.x + r, e.y); ctx.lineTo(e.x, e.y + r * 1.2); ctx.lineTo(e.x - r, e.y); ctx.closePath(); }
    else if (sh === 'hex' || sh === 'boss') {
      const n = sh === 'boss' ? 8 : 6;
      const rot = sh === 'boss' ? this.t * 0.5 : 0;
      for (let i = 0; i < n; i++) { const b = rot + (i * TAU) / n; const rr = sh === 'boss' && i % 2 ? r * 0.8 : r; ctx.lineTo(e.x + Math.cos(b) * rr, e.y + Math.sin(b) * rr); }
      ctx.closePath();
    } else ctx.arc(e.x, e.y, r, 0, TAU);
    ctx.fill(); ctx.stroke();
    if (e.elite) { ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, r + 5, 0, TAU); ctx.stroke(); }
    if (e.cs === 'wind' || e.fuse) { ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, r + 8, 0, TAU); ctx.stroke(); }
    // Augen
    const a = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    const ex = e.x + Math.cos(a) * r * 0.35, ey = e.y + Math.sin(a) * r * 0.35;
    ctx.fillStyle = e.boss ? '#fff' : e.color;
    const es = Math.max(2, r * 0.18);
    ctx.fillRect(ex - es * 1.6, ey - es / 2, es, es);
    ctx.fillRect(ex + es * 0.6, ey - es / 2, es, es);
    // Lebensbalken für Elite/verletzte Gegner
    if ((e.elite || e.hp < e.maxHp) && !e.boss) {
      const w = r * 2.2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - w / 2, e.y - r - 10, w, 3.5);
      ctx.fillStyle = e.elite ? '#ffd84d' : '#ff4d6d';
      ctx.fillRect(e.x - w / 2, e.y - r - 10, (w * Math.max(0, e.hp)) / e.maxHp, 3.5);
    }
    ctx.globalAlpha = 1;
  }
}
