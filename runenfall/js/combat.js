// Kampf-Engine: Arena, Spieler, Gegner, Fertigkeiten, Zustände, Bosse, Rendering.
import { TAU, clamp, rand, randi, pick, weighted, rgba, fmt } from './util.js';
import { ENEMIES, BOSSES, ELITE_AFFIXES, ELITE_IDS, ascHas } from './data/content.js';
import { ELEM } from './data/stats.js';
import { sfx, buzz } from './audio.js';
import { save } from './save.js';
import { bossLine } from './data/factions.js';
import { music } from './music.js';

/** Schadensanalyse eines Kampfes: je Rune, Element, Krit, Schaden über Zeit und erlittener Schaden. */
const newAn = () => ({ sk: {}, el: {}, crit: [0, 0, 0, 0], dot: {}, other: 0, tk: {}, src: {}, dodged: 0 });
const anSkill = (A, S) => {
  const key = S.isPet ? 'pet:' + S.id : S.id;
  return A.sk[key] || (A.sk[key] = { d: 0, h: 0, c: 0, dot: 0, k: 0 });
};
import {
  BIOME_FX, floorTile, soft, shadowSprite, enemySprite, bossSprite, tinted, isDirectional, isBlobby, runeCircle, playerSprite,
  makeAmbient, drawAmbient, vignette, nebulaBg, shade, setSpriteRes,
} from './gfx.js';
import {
  drawProjectiles, projTrail, impact, blastFx, fallFx, drawFx, drawZone, auraTick, drawAura, drawTrap, drawOrbitItem,
  drawDecal, drawParticles, updateParticles, elemOf, visOf,
} from './skillfx.js';

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

// Rückstoß-Stärke je Fertigkeitsverhalten (rein für das Trefferfeedback, Bosse sind immun)
const KB = { proj: 0.5, nova: 1.2, melee: 1.5, meteor: 1.3, strikes: 0.6, chain: 0.25, orbit: 0.45, trap: 1, line: 0.8, minion: 0.4, zone: 0 };
const AIL_TXT = { frozen: ['Eingefroren', '#bff3ff'], burn: ['Entzündet', '#ff9a4a'], shock: ['Geschockt', '#ffe34d'], poison: ['Vergiftet', '#9cff5e'], bleed: ['Blutung', '#ff5c7a'] };
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
    this.sfx = sfx;
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
    setSpriteRes(this.scale * this.DPR);
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
    this.stats = { kills: 0, maxHit: 0, elites: 0, dmgDone: 0, byType: {}, hitsTaken: 0, an: newAn() };
    this.hazards = [];
    this.decals = [];
    this.hitstop = 0; this.slowmo = 0; this.lastStop = -1; this.whiteFlash = 0; this.lastKrit = -1; this.lastAil = -1;
    this.bfx = BIOME_FX[cfg.biome] || BIOME_FX.sternengrab;
    this.floorPat = null;
    this.ambient = typeof document !== 'undefined' ? makeAmbient(this.bfx.amb) : [];
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
        let m = mine[k];
        if (!m) {
          m = { skId: sk.S.id, x: this.player.x + rand(-30, 30), y: this.player.y + rand(-30, 30), atk: rand(0, 0.5), kind: d.kind, bob: Math.random() * 6, ranged: !!d.petRanged, petColor: d.color, glyph: d.glyph };
          // Beschwörungs-Effekt
          if (this.fx) {
            this.fx.push({ type: 'flash', x: m.x, y: m.y, r: 30, color: d.color || '#c58bff', t: 0.3, max: 0.3 });
            for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; this.part({ x: m.x + Math.cos(a) * 26, y: m.y + Math.sin(a) * 26, vx: -Math.cos(a) * 60, vy: -Math.sin(a) * 60 - 20, t: 0.45, color: d.color || '#c58bff', s: 2.2, k: 0 }); }
          }
        }
        keep.push(m);
      }
    });
    if (keep.length > this.minions.length && this.running) sfx.summon?.();
    this.minions = keep;
  }

  skOf(id) { return this.sk.find((s) => s.S.id === id); }

  // ---------------------------------------------------------------- Schleife
  update(dt) {
    if (!this.running || this.paused) return;
    if (this.whiteFlash > 0) this.whiteFlash -= dt;
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    if (this.slowmo > 0) { this.slowmo -= dt; dt *= 0.28; }
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
    if (this.bossLineT > 0) this.bossLineT -= dt;
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
    if (this.killT > 0) this.killT -= dt;
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
    if (p.hp > 0 && p.hp < P.maxLife * 0.3 && !this.over) sfx.heartbeat?.();
  }

  heal(amount) {
    const p = this.player;
    if (amount <= 0 || this.P.ci || p.hp <= 0 || (this.over && !this.result.win)) return;
    p.hp = Math.min(this.P.maxLife, p.hp + amount);
  }

  damagePlayer(amount, elem = 'phys', isHit = true, src = null) {
    const p = this.player, P = this.P;
    if (this.over) return;
    if (src && src.d) this.lastSrc = src;
    if (isHit) {
      if (p.inv > 0) return;
      const evade = P.evasion / (P.evasion + 600);
      if (Math.random() * 100 < P.dodge || Math.random() < Math.min(0.75, evade)) {
        p.inv = 0.18;
        this.text(p.x, p.y - 20, 'Ausgewichen', '#9fe7ff', 0.8);
        sfx.dodge();
        this.stats.an.dodged++;
        return;
      }
    }
    let dmg = amount;
    if (elem === 'phys') dmg *= 1 - Math.min(0.9, P.armor / (P.armor + 8 * amount));
    else dmg *= 1 - (P.res[elem] || 0) / 100;
    dmg *= P.dmgTaken;
    {
      const A = this.stats.an, who = src ? (src.nemesis ? src.nemesis.name : src.name || (src.d && src.d.name)) || 'Unbekannt' : 'Umgebung';
      A.tk[elem] = (A.tk[elem] || 0) + dmg;
      if (A.src[who] !== undefined || Object.keys(A.src).length < 40) A.src[who] = (A.src[who] || 0) + dmg;
    }
    if (p.barrier > 0) {
      const ab = Math.min(p.barrier, dmg);
      p.barrier -= ab;
      dmg -= ab;
    }
    p.hp -= dmg;
    p.bdelay = P.spec.spec_bulwark ? 1 : 2;
    if (isHit) {
      this.stats.hitsTaken++;
      if (src && P.spec.spec_thorns && !src.dead) {
        const th = (P.armor * P.spec.spec_thorns) / 100;
        if (th > 0) {
          this.dealDamage(src, th * src.takenMult, false, null);
          if (P.spec.spec_thornsBleed && (!src.bleed || src.bleed.dps < th * 0.4)) src.bleed = { dps: th * 0.4, t: 4 };
          if (src.hp <= 0) this.kill(src, null);
        }
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
        const k = src && src.d ? src : this.lastSrc;
        this.killer = k ? { id: k.id, name: k.nemesis ? k.nemesis.name : k.name || k.d.name, boss: !!k.boss, color: k.color, nemesisUid: k.nemesis ? k.nemesis.uid : null } : null;
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
      chill: 0, chillEff: 0, frozen: 0, shock: 0, shockEff: 0, flash: 0, mark: 0,
      atk: d.ranged ? rand(0.6, d.ranged.cd) : 0, elite: false, affixes: [], cs: null, ct: rand(1, 3), dotAcc: 0, dotShow: 0.5,
      blinkT: d.blink ? rand(1, d.blink) : 0, spawnT: d.spawn ? rand(1, d.spawn.cd) : 0, leapT: d.leap ? rand(1.5, d.leap) : 0,
      mineT: d.mines ? rand(1, d.mines) : 0, phaseT: d.phase ? rand(1, 3) : 0, phased: false, aimT: 0, shielded: false, ph: Math.random() * TAU,
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
    if (this.t - (this.lastEliteSting || -99) > 12) { this.lastEliteSting = this.t; music.stinger('elite'); }
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

  spawnNemesis(n) {
    if (save.settings.musicVol > 0.01) music.stinger('nemesis'); else sfx.nemesis?.();
    const pos = this.spawnPos();
    const e = this.makeEnemy(n.base, pos.x, pos.y);
    const k = 6 + 2.5 * n.rank;
    e.hp = e.maxHp = e.maxHp * k;
    e.dmg *= 1.3 + 0.12 * n.rank;
    e.r *= 1.6; e.xp *= 15; e.speed *= 1.05;
    e.elite = true; e.nemesis = n; e.color = n.color; e.name = n.name;
    for (const t of n.traits) {
      if (t === 'tough') { e.hp = e.maxHp = e.maxHp * 1.6; }
      if (t === 'swift') e.speed *= 1.4;
      if (t === 'fireborn') { e.res.fire = 75; e.affixes.push('burning'); }
      if (t === 'frostheart') { e.res.cold = 75; e.affixes.push('chilling'); }
      if (t === 'stormsoul') { e.res.light = 75; e.extraRanged = { cd: 2.4, elem: 'light', burst: 3 }; }
      if (t === 'blinker') e.blinkCd = 3;
      if (t === 'summoner') e.sumT = 4;
      if (t === 'vampire') e.vamp = true;
      if (t === 'splitter') e.splitElite = true;
      if (t === 'shield') e.shieldAura = 170;
      if (t === 'regen') e.affixes.push('regen');
      if (t === 'sniper') e.extraRanged = { cd: 2.2, elem: 'phys', burst: 4 };
      if (t === 'wrath') e.affixes.push('enraged');
      if (t === 'armored') e.takenMult *= 0.6;
      if (t === 'bomber') e.nemMines = 2;
      if (t === 'hunter') e.nemLeap = 3;
    }
    this.enemies.push(e);
    this.ring(e.x, e.y, 120, '#ff4d4d', 0.8);
    this.text(this.player.x, this.player.y - 90, `☠ ${n.name} (Rang ${n.rank}) jagt dich!`, '#ff6b6b', 1.3);
    sfx.boss();
    buzz([60, 40, 60]);
  }

  spawnBoss() {
    const c = this.cfg, b = BOSSES[c.bossId];
    const pos = { x: this.player.x, y: this.player.y - 330 };
    if (Math.hypot(pos.x, pos.y) > ARENA_R - 60) { pos.x = 0; pos.y = 0; }
    const hp = b.hp * c.power * c.hpMult * (ascHas(c.asc, 'bossHp') ? 1.3 : 1) * (c.bossHpMult || 1);
    const e = {
      id: c.bossId, d: { name: b.name, shape: 'boss' }, b, boss: true, x: pos.x, y: pos.y, r: b.r, hp, maxHp: hp,
      dmg: b.dmg * Math.pow(c.power, 0.72) * c.dmgMult * (c.bossDmgMult || 1), speed: b.speed, xp: 60, color: b.color, res: {}, takenMult: 1,
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
    this.bossLine = bossLine(c.bossId); this.bossLineT = this.bossLine ? 4.5 : 0;
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
      if (c.nemesis && !this.nemSpawned && this.t > 6) { this.nemSpawned = true; this.spawnNemesis(c.nemesis); }
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
    this._shooter = null;
    const kinds = [c.kind === 'boss' ? null : c.hazard, c.meteors ? 'meteor' : null].filter(Boolean);
    if (!kinds.length) return;
    this.hazardT -= dt;
    if (this.hazardT > 0) return;
    this.hazardT = rand(1.8, 3.2);
    const dmg = 9 * Math.pow(c.power, 0.72) * c.dmgMult;
    for (const k of kinds) {
      const x = p.x + rand(-160, 160), y = p.y + rand(-160, 160);
      if (k === 'fire') this.teles.push({ src: this._shooter, x, y, r: 60, t: 1.2, max: 1.2, dmg: dmg * 1.3, elem: 'fire' });
      else if (k === 'lightning') this.teles.push({ src: this._shooter, x: p.x + rand(-90, 90), y: p.y + rand(-90, 90), r: 38, t: 0.9, max: 0.9, dmg: dmg * 1.2, elem: 'light', bolt: true });
      else if (k === 'poison') this.hazards.push({ x, y, r: 55, t: 6, max: 6, dps: dmg * 0.5, elem: 'chaos' });
      else if (k === 'meteor') this.teles.push({ src: this._shooter, x, y, r: 75, t: 1.4, max: 1.4, dmg: dmg * 1.6, elem: 'fire' });
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
      this._shooter = e;
      if (overtime && e.elite) {
        e.hunt = true;
        if (this.t > c.duration + 20) { e.hp -= e.maxHp * 0.04 * dt; if (e.hp <= 0) { this.kill(e, null); continue; } }
      }
      if (e.d.phase && !e.hunt) {
        e.phaseT -= dt;
        if (e.phaseT <= 0) { e.phased = !e.phased; e.phaseT = e.phased ? 1.4 : rand(2.5, 3.5); }
      }
      e.flash -= dt; e.chill -= dt; e.frozen -= dt; e.shock -= dt; e.mark -= dt;
      let dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      if (chillAura && d < 170) { e.chill = Math.max(e.chill, 0.3); e.chillEff = Math.max(e.chillEff, 0.3); }

      // Schaden über Zeit
      let dot = 0, dB = 0, dP = 0, dL = 0;
      if (e.burns.length) {
        let sum = 0, mx = 0;
        for (const b of e.burns) { b.t -= dt; sum += b.dps; mx = Math.max(mx, b.dps); }
        e.burns = e.burns.filter((b) => b.t > 0);
        dB = (e.burnStack ? sum : mx) * (1 - this.resOf(e, 'fire') / 100);
      }
      if (e.poisons.length) {
        let sum = 0;
        for (const ps of e.poisons) { ps.t -= dt; sum += ps.dps; }
        e.poisons = e.poisons.filter((ps) => ps.t > 0);
        dP = sum * (1 - this.resOf(e, 'chaos') / 100);
      }
      if (e.bleed) {
        e.bleed.t -= dt;
        dL = e.bleed.dps * (1 - this.resOf(e, 'phys') / 100);
        if (e.bleed.t <= 0) e.bleed = null;
      }
      dot = dB + dP + dL;
      if (dot > 0) {
        let m = e.takenMult;
        if (e.shock > 0) m *= 1 + e.shockEff;
        if (e.poisons.length && P.spec.spec_poisonVuln) m *= 1 + P.spec.spec_poisonVuln / 100;
        m *= this.vuln(e);
        const v = dot * m * dt;
        e.hp -= v;
        this.stats.dmgDone += v;
        // Analyse: Schaden über Zeit nach Art, Element und auslösender Rune
        const A = this.stats.an, f = m * dt;
        if (dB) { A.dot.burn = (A.dot.burn || 0) + dB * f; A.el.fire = (A.el.fire || 0) + dB * f; }
        if (dP) { A.dot.poison = (A.dot.poison || 0) + dP * f; A.el.chaos = (A.el.chaos || 0) + dP * f; }
        if (dL) { A.dot.bleed = (A.dot.bleed || 0) + dL * f; A.el.phys = (A.el.phys || 0) + dL * f; }
        if (e.lastS) { const k = anSkill(A, e.lastS); k.d += v; k.dot += v; } else A.other += v;
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
              for (let i = 0; i < n; i++) this.shootE(e.x, e.y, a + (i - (n - 1) / 2) * 0.22, R.speed, e.dmg, R.elem, R.size || 7);
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
      if (e.extraRanged && e.frozen <= 0) {
        e.xr = (e.xr ?? 1.5) - dt;
        if (e.xr <= 0) {
          e.xr = e.extraRanged.cd;
          const a = Math.atan2(dy, dx), n = e.extraRanged.burst;
          for (let i = 0; i < n; i++) this.shootE(e.x, e.y, a + (i - (n - 1) / 2) * 0.18, 300, e.dmg * 0.6, e.extraRanged.elem);
        }
      }
      const leapCd = e.d.leap || e.nemLeap;
      if (leapCd) {
        e.leapT -= dt;
        if (e.leapT <= 0 && d < 400 && !e.leap) {
          e.leap = { x: p.x, y: p.y, t: 0.8 };
          this.teles.push({ src: this._shooter, x: p.x, y: p.y, r: 55, t: 0.8, max: 0.8, dmg: e.dmg, elem: 'phys' });
        }
        if (e.leap) {
          e.leap.t -= dt; spd = 0;
          if (e.leap.t <= 0) { e.x = e.leap.x; e.y = e.leap.y; e.leap = null; e.leapT = leapCd * rand(0.8, 1.2); }
        }
      }
      const minesCd = e.d.mines || e.nemMines;
      if (minesCd) {
        e.mineT -= dt;
        if (e.mineT <= 0) { e.mineT = minesCd * rand(0.8, 1.2); this.teles.push({ src: this._shooter, x: e.x, y: e.y, r: 48, t: 1.8, max: 1.8, dmg: e.dmg, elem: 'fire' }); }
        if (d < 260 && e.d.mines) { mx = -dy; my = dx; }
      }
      if (e.d.charge) {
        e.ct -= dt;
        if (!e.cs && e.ct <= 0 && d < 380) { e.cs = 'wind'; e.ct = 0.55; e.cdx = dx; e.cdy = dy; }
        else if (e.cs === 'wind') { spd = 0; if (e.ct <= 0) { e.cs = 'dash'; e.ct = 0.5; } }
        else if (e.cs === 'dash') { mx = e.cdx; my = e.cdy; spd = e.d.charge.speed; if (e.ct <= 0) { e.cs = null; e.ct = e.d.charge.cd * rand(0.8, 1.2); if (e.d.stomp) this.teles.push({ src: e, x: e.x, y: e.y, r: e.d.stomp, t: 0.35, max: 0.35, dmg: e.dmg * 1.1, elem: 'phys' }); } }
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
      // ---- Biom-Mechaniken
      const D = e.d;
      if (D.reflect) {
        if (e.refOn > 0) { e.refOn -= dt; if (e.refOn <= 0) e.takenMult = e.baseTaken; }
        else {
          e.refT = (e.refT ?? rand(1.5, D.reflect.cd)) - dt;
          if (e.refT <= 0 && e.frozen <= 0) { e.refT = D.reflect.cd * rand(0.9, 1.1); e.refOn = D.reflect.dur; e.baseTaken = e.takenMult; e.takenMult *= 0.08; this.ring(e.x, e.y, e.r + 16, '#e0f0ff', 0.35); }
        }
      }
      if (D.burrow && !e.hunt) {
        if (e.under > 0) {
          e.under -= dt; spd *= 2.2; e.phased = true;
          if (Math.random() < 0.3) this.part({ x: e.x + rand(-8, 8), y: e.y + rand(-8, 8), vx: rand(-40, 40), vy: rand(-40, 40), t: 0.5, color: '#5a4a30', s: rand(2, 4), k: 6, z: 1, vz: rand(60, 140) });
          if (e.under <= 0) { e.phased = false; this.teles.push({ src: e, x: e.x, y: e.y, r: e.r + 42, t: 0.35, max: 0.35, dmg: e.dmg * 1.2, elem: D.burrow.elem || 'phys' }); }
        } else {
          e.burT = (e.burT ?? rand(2, D.burrow.cd)) - dt;
          if (e.burT <= 0 && d < 500 && e.frozen <= 0) { e.burT = D.burrow.cd * rand(0.9, 1.2); e.under = D.burrow.dur; e.phased = true; this.burst(e.x, e.y, '#6a5a40', 10, 90); }
        }
      }
      if (D.beam && e.frozen <= 0) {
        if (e.beamAim > 0) {
          e.beamAim -= dt; spd = 0;
          if (e.beamAim <= 0) {
            const a = e.beamA, ex = e.x + Math.cos(a) * D.beam.len, ey = e.y + Math.sin(a) * D.beam.len;
            if (segDist(p.x, p.y, e.x, e.y, ex, ey) < D.beam.w + p.r) this.damagePlayer(e.dmg * 1.3, D.beam.elem, true, e);
            this.fx.push({ type: 'beam', x: e.x, y: e.y, a, len: D.beam.len, t: 0.22, max: 0.22, color: ELEM[D.beam.elem].color });
          }
        } else {
          e.beamT = (e.beamT ?? rand(1.5, D.beam.cd)) - dt;
          if (e.beamT <= 0 && d < D.beam.len * 0.9) {
            e.beamT = D.beam.cd * rand(0.9, 1.15); e.beamAim = D.beam.aim; e.beamA = Math.atan2(dy, dx);
            this.fx.push({ type: 'line', x: e.x, y: e.y, a: e.beamA, len: D.beam.len, w: D.beam.w * 2, t: D.beam.aim, max: D.beam.aim, color: ELEM[D.beam.elem].color });
          }
        }
      }
      if (D.slowAura && d < D.slowAura) p.slowT = Math.max(p.slowT || 0, 0.2);
      if (D.dmgAura && d < D.dmgAura.r + p.r) this.damagePlayer(e.dmg * 0.4 * dt, D.dmgAura.elem, false, e);
      if (D.mortar && e.frozen <= 0 && !e.hunt) {
        e.morT = (e.morT ?? rand(1, D.mortar.cd)) - dt;
        if (e.morT <= 0 && d < 520) {
          e.morT = D.mortar.cd * rand(0.85, 1.15);
          for (let i = 0; i < D.mortar.n; i++) {
            const tx = p.x + (i ? rand(-90, 90) : 0), ty = p.y + (i ? rand(-90, 90) : 0);
            this.teles.push({ src: e, x: tx, y: ty, r: D.mortar.r, t: 1.1, max: 1.1, dmg: e.dmg * 1.1, elem: D.mortar.elem, bolt: !!D.mortar.bolt });
            if (!D.mortar.bolt) this.fx.push({ type: 'fall', kind: D.mortar.elem === 'fire' ? 'fire' : 'star', x: tx, y: ty, sx: e.x, sy: e.y - 60, t: 1.1, max: 1.1 });
          }
        }
      }
      if (D.pull) {
        if (e.pulling > 0) {
          e.pulling -= dt; spd *= 0.3;
          if (d < D.pull.r && d > e.r + 24) { p.x -= dx * 85 * dt; p.y -= dy * 85 * dt; }
        } else {
          e.pullT = (e.pullT ?? rand(2, D.pull.cd)) - dt;
          if (e.pullT <= 0 && d < D.pull.r && e.frozen <= 0) { e.pullT = D.pull.cd * rand(0.9, 1.1); e.pulling = D.pull.dur; this.fx.push({ type: 'swirl', x: e.x, y: e.y, r: D.pull.r * 0.55, color: e.color, t: D.pull.dur, max: D.pull.dur }); }
        }
      }
      if (D.drain) {
        if (e.draining > 0) {
          e.draining -= dt; spd *= 0.3;
          if (d < D.drain.r) { const v = e.dmg * 0.55 * dt; this.damagePlayer(v, D.drain.elem, false, e); e.hp = Math.min(e.maxHp, e.hp + v * 3); }
          else e.draining = 0;
        } else {
          e.drT = (e.drT ?? rand(1.5, D.drain.cd)) - dt;
          if (e.drT <= 0 && d < D.drain.r && e.frozen <= 0) { e.drT = D.drain.cd * rand(0.9, 1.1); e.draining = D.drain.dur; }
        }
      }
      if (D.trail && spd > 0 && !e.under) {
        e.trailT = (e.trailT || 0) - dt;
        if (e.trailT <= 0 && this.hazards.length < 140) { e.trailT = 0.45; this.hazards.push({ x: e.x, y: e.y, r: 22, t: 2.2, max: 2.2, dps: e.dmg * 0.5, elem: D.trail.elem }); }
      }
      if (D.twin) {
        if (!e.link || e.link.dead) {
          e.link = null;
          for (const o of this.enemies) if (o !== e && !o.dead && o.d.twin && (!o.link || o.link.dead) && Math.hypot(o.x - e.x, o.y - e.y) < 260) { e.link = o; o.link = e; e.linkMain = true; o.linkMain = false; break; }
        }
        if (e.link && e.linkMain && segDist(p.x, p.y, e.x, e.y, e.link.x, e.link.y) < 9 + p.r) this.damagePlayer(e.dmg * 1.4 * dt, 'chaos', false, e);
      }
      if (D.cloner && !e.cloned && !e.illusion && e.hp < e.maxHp * 0.7) {
        e.cloned = true;
        this.fx.push({ type: 'flash', x: e.x, y: e.y, r: 50, color: e.color, t: 0.3, max: 0.3 });
        for (let i = 0; i < D.cloner; i++) {
          const a = Math.random() * TAU;
          const c2 = this.spawn(e.id, e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40);
          if (c2) { c2.illusion = true; c2.cloned = true; c2.hp = c2.maxHp = e.maxHp * 0.25; c2.xp = 0; c2.dmg *= 0.6; }
        }
      }
      if (D.zigzag) {
        const zz = Math.sin(this.t * 6 + e.ph * 3);
        mx += -dy * zz * 0.9; my += dx * zz * 0.9;
        const zl = Math.hypot(mx, my) || 1; mx /= zl; my /= zl;
      }
      if (e.sumT !== undefined) {
        e.sumT -= dt;
        if (e.sumT <= 0) { e.sumT = 6; for (let i = 0; i < 2; i++) this.spawn('shade', e.x + rand(-40, 40), e.y + rand(-40, 40)); }
      }

      e.x += mx * spd * dt;
      e.y += my * spd * dt;
      if (e.kx || e.ky) {
        e.x += e.kx * dt; e.y += e.ky * dt;
        const kd = Math.exp(-11 * dt);
        e.kx *= kd; e.ky *= kd;
        if (Math.abs(e.kx) < 2 && Math.abs(e.ky) < 2) { e.kx = 0; e.ky = 0; }
      }
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
    this._shooter = e;
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
        sfx.boss(); sfx.bossPhase?.();
        if (b.phases[ph].enter) this.bossMech(e, b.phases[ph].enter);
      }
    }
    // Schild durch Kristalle / Heilung durch Anker
    if (e.shieldUp && !this.enemies.some((o) => !o.dead && o.crystalOf === e)) {
      e.shieldUp = false; e.takenMult = e.baseTaken2; e.frozen = 1.6; e.vulnT = 4; e.takenMult *= 1.5;
      this.text(e.x, e.y - 70, 'SCHILD ZERBROCHEN!', '#bfe8ff', 1.6);
      this.fx.push({ type: 'shock', x: e.x, y: e.y, r: 260, color: '#bfe8ff', t: 0.6, max: 0.6 });
      this.burst(e.x, e.y, '#bfe8ff', 40, 260);
      sfx.shatter?.(); if (save.settings.shake) this.shake = Math.max(this.shake, 8);
    }
    if (e.vulnT > 0) { e.vulnT -= dt; if (e.vulnT <= 0) e.takenMult /= 1.5; }
    for (const o of this.enemies) {
      if (o.dead || o.anchorOf !== e) continue;
      o.anchorT = (o.anchorT ?? 22) - dt;
      if (o.anchorT <= 0) { o.dead = true; this.burst(o.x, o.y, o.color, 14, 140); continue; }
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.006 * dt);
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
    } else if (e.frozen <= 0 && !e.shieldUp) {
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
    if (e.vortex) {
      e.vortex.t -= dt;
      const vx = e.x - p.x, vy = e.y - p.y, vd = Math.hypot(vx, vy) || 1;
      if (vd > e.r + 20) { p.x += (vx / vd) * 95 * dt; p.y += (vy / vd) * 95 * dt; }
      e.vortex.acc = (e.vortex.acc || 0) + dt;
      if (e.vortex.acc > 0.5) { e.vortex.acc = 0; const off = Math.random() * TAU; for (let i = 0; i < 6; i++) this.shootE(e.x, e.y, off + (i * TAU) / 6, 130, e.dmg * 0.5, b.elem); }
      if (e.vortex.t <= 0) e.vortex = null;
    }
    const busy = e.charge || e.spiral || e.barr || e.lasers || e.vortex;
    for (const pt of e.pat) {
      pt.t -= dt * (e.rage ? 1.45 : 1) * (e.shieldUp ? 0.55 : 1);
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
          for (const [x, y] of spots) this.teles.push({ src: this._shooter, x, y, r: 90, t: 1.15, max: 1.15, dmg: e.dmg * 1.3, elem: b.elem });
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
            this.teles.push({ src: this._shooter, x, y, r: 60, t: 1.0, max: 1.0, dmg: e.dmg * 0.5, elem: b.elem, pool: { dps: e.dmg * 0.4, t: 4.5 } });
          }
          break;
        case 'firewall': {
          const a = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2;
          const gap = randi(-2, 2);
          for (let i = -4; i <= 4; i++) {
            if (i === gap) continue;
            this.teles.push({ src: this._shooter, x: p.x + Math.cos(a) * i * 70, y: p.y + Math.sin(a) * i * 70, r: 42, t: 1.1, max: 1.1, dmg: e.dmg * 1.2, elem: b.elem });
          }
          break;
        }
        case 'cross': {
          const base = Math.random() * TAU;
          const angs = [0, 1, 2, 3].map((i) => base + (i * Math.PI) / 2);
          e.lasers = { t: 1.1, angs };
          for (const a of angs) this.fx.push({ type: 'line', x: e.x, y: e.y, a, len: 900, w: 44, t: 1.1, max: 1.1, color: b.color });
          break;
        }
        case 'rain':
          for (let i = 0; i < 9 + (e.rage ? 5 : 0); i++) {
            this.teles.push({ src: e, x: p.x + rand(-260, 260), y: p.y + rand(-260, 260), r: 42, t: rand(0.9, 1.6), max: 1.6, dmg: e.dmg * 0.9, elem: b.elem });
          }
          break;
        case 'vortex':
          e.vortex = { t: 2.6 };
          this.ring(e.x, e.y, 300, b.color, 0.6);
          break;
        case 'clones':
          for (let i = 0; i < 2; i++) {
            const a = Math.random() * TAU;
            const c = this.spawn('reaper', e.x + Math.cos(a) * 90, e.y + Math.sin(a) * 90);
            if (c) { c.color = b.color; c.hp = c.maxHp = c.maxHp * 4; c.r *= 1.4; c.name = 'Schatten des Bosses'; }
          }
          break;
        case 'checker': {
          // Schachbrett: zwei versetzte Einschlagswellen
          for (let gx = -4; gx <= 4; gx++) for (let gy = -4; gy <= 4; gy++) {
            if (gx * gx + gy * gy > 17) continue;
            const late = (gx + gy) & 1;
            this.teles.push({ src: e, x: p.x + gx * 96, y: p.y + gy * 96, r: 40, t: late ? 2.05 : 1.1, max: late ? 2.05 : 1.1, dmg: e.dmg * 0.6, elem: b.elem });
          }
          break;
        }
        case 'safezones': {
          // Alles um dich wird getroffen – außer in den sicheren Kreisen
          const cx = p.x, cy = p.y, R0 = 430, base = Math.random() * TAU;
          const safes = [0, 1, 2].map((i) => { const a = base + (i * TAU) / 3 + rand(-0.4, 0.4), r = rand(110, 210); return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, r: 82 }; });
          this.fx.push({ type: 'safezone', x: cx, y: cy, R: R0, safes, t: 2.5, max: 2.5, color: b.color });
          this.delayed.push({ t: 2.5, fn: () => {
            const pl = this.player;
            const inside = Math.hypot(pl.x - cx, pl.y - cy) < R0;
            const safe = safes.some((z) => Math.hypot(pl.x - z.x, pl.y - z.y) < z.r);
            if (inside && !safe) this.damagePlayer(e.dmg * 1.6, b.elem, true, e);
            this.fx.push({ type: 'shock', x: cx, y: cy, r: R0, color: ELEM[b.elem].color, t: 0.5, max: 0.5 });
            for (let i = 0; i < 24; i++) { const a = Math.random() * TAU, rr = Math.random() * R0; this.part({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, vx: 0, vy: -60, t: 0.6, color: ELEM[b.elem].color, s: 3, k: 2 }); }
            if (save.settings.shake) this.shake = Math.max(this.shake, 7);
          } });
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

  /** Einmalige Boss-Mechanik beim Phasenwechsel. */
  bossMech(e, kind) {
    const add = (id, n, dist, hpPct, towardPlayer = false) => {
      const out = [];
      const pa = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      for (let i = 0; i < n; i++) {
        const a = towardPlayer ? pa + (i - (n - 1) / 2) * 1.1 : (i * TAU) / n + Math.random() * 0.5;
        const x = clamp(e.x + Math.cos(a) * dist, -ARENA_R + 60, ARENA_R - 60), y = clamp(e.y + Math.sin(a) * dist, -ARENA_R + 60, ARENA_R - 60);
        const o = this.makeEnemy(id, x, y);
        o.hp = o.maxHp = e.maxHp * hpPct;
        this.enemies.push(o);
        this.fx.push({ type: 'flash', x, y, r: 40, color: o.color, t: 0.35, max: 0.35 });
        out.push(o);
      }
      return out;
    };
    if (kind === 'shield') {
      add('bosscrystal', 3, 210, 0.03).forEach((o) => { o.crystalOf = e; });
      e.shieldUp = true; e.baseTaken2 = e.takenMult; e.takenMult *= 0.03;
      this.text(e.x, e.y + e.r + 46, 'SCHILD! Zerstöre die Kristalle!', '#bfe8ff', 1.3);
    } else if (kind === 'anchors') {
      add('soulanchor', 2, 190, 0.03, true).forEach((o) => { o.anchorOf = e; });
      this.text(e.x, e.y + e.r + 46, 'SEELENANKER heilen den Boss!', '#ff8ad8', 1.3);
    }
  }

  shootE(x, y, a, spd, dmg, elem, r = 7) {
    if (this.eprojs.length > 600) return;
    const m = ascHas(this.cfg.asc, 'projSpeed') ? 1.25 : 1;
    this.eprojs.push({ x, y, vx: Math.cos(a) * spd * m, vy: Math.sin(a) * spd * m, r, dmg, elem, life: 6, src: this._shooter });
  }

  updateEProjs(dt) {
    const p = this.player;
    for (const b of this.eprojs) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r - 2) {
        b.life = 0;
        this.damagePlayer(b.dmg, b.elem, true, b.src);
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
        if (Math.hypot(p.x - t.x, p.y - t.y) < t.r + p.r * 0.5) this.damagePlayer(t.dmg, t.elem, true, t.src);
        if (t.pool) this.hazards.push({ x: t.x, y: t.y, r: t.r, t: t.pool.t, max: t.pool.t, dps: t.pool.dps, elem: t.elem });
        if (t.bolt) { this.fx.push({ type: 'bolt', pts: [[t.x, t.y - 200], [t.x + rand(-20, 20), t.y - 100], [t.x, t.y]], t: 0.2, max: 0.2, color: ELEM[t.elem].color }); sfx.zap(); }
        this.ring(t.x, t.y, t.r, ELEM[t.elem].color, 0.35);
        this.burst(t.x, t.y, ELEM[t.elem].color, 12, 150);
      }
    }
    this.teles = this.teles.filter((t) => t.t > 0);
  }

  // ---------------------------------------------------------------- Treffer
  /** Verwundbarkeiten durch Pfade und Bund-Segen (für Treffer und Schaden über Zeit). */
  vuln(e) {
    const sp = this.P.spec;
    let m = 1;
    if (e.chill > 0 && sp.spec_chillVuln) m *= 1 + sp.spec_chillVuln / 100;
    if (e.frozen > 0 && sp.spec_frozenVuln) m *= 1 + sp.spec_frozenVuln / 100;
    if (e.chill > 0 && e.shock > 0 && sp.spec_superconduct) m *= 1 + sp.spec_superconduct / 100;
    if (e.burns.length && e.poisons.length && sp.spec_toxicFire) m *= 1 + sp.spec_toxicFire / 100;
    if (e.mark > 0 && sp.spec_minionMark) m *= 1 + sp.spec_minionMark / 100;
    return m;
  }

  hitEnemy(e, S, mult = 1, chained = false) {
    if (e.dead || e.phased) return 0;
    const P = this.P, p = this.player;
    const fc = this._first || 0;
    this._first = 0;
    if (e.shielded) mult *= 0.5;
    if (P.spec.spec_berserk) mult *= 1 + 0.4 * (1 - Math.max(0, p.hp) / P.maxLife);
    if (P.spec.spec_stillness && !p.moving) mult *= 1.3;
    let crit = false;
    if (S.nthCrit) { S._n = (S._n || 0) + 1; crit = S._n % S.nthCrit === 0; }
    else if ((S.crit > 0 || fc) && !S.noCrit) crit = Math.random() * 100 < S.crit + fc;
    if (crit) mult *= S.critMulti / 100;
    if (e.hp < e.maxHp * 0.35) mult *= S.vsLow;
    const C = S.cond;
    if (C) {
      if (C.burn && e.burns.length) mult *= C.burn;
      if (C.chill && e.chill > 0) mult *= C.chill;
      if (C.shock && e.shock > 0) mult *= C.shock;
      if (C.poison && e.poisons.length) mult *= C.poison;
      if (C.bleed && e.bleed) mult *= C.bleed;
      if (C.moving && p.moving) mult *= C.moving;
      if (C.full && p.hp >= P.maxLife * 0.99) mult *= C.full;
      if (C.low && p.hp < P.maxLife * 0.5) mult *= C.low;
      if (C.barrier && p.barrier > 0) mult *= C.barrier;
      if (C.kill && this.killT > 0) mult *= C.kill;
      if (C.near || C.far) { const dd = Math.hypot(e.x - p.x, e.y - p.y); if (C.near && dd < 200) mult *= C.near; if (C.far && dd > 320) mult *= C.far; }
    }
    if (e.elite || e.boss) mult *= S.vsBoss;
    if (e.burns.length || e.poisons.length || e.bleed || e.chill > 0 || e.shock > 0 || e.frozen > 0) mult *= S.vsAil;
    if (e.shock > 0) mult *= 1 + e.shockEff;
    if (e.poisons.length && this.P.spec.spec_poisonVuln) mult *= 1 + this.P.spec.spec_poisonVuln / 100;
    mult *= this.vuln(e);
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
    // Analyse: Schaden je Rune, Element und Krit
    {
      const A = this.stats.an, k = anSkill(A, S);
      k.d += total; k.h++;
      A.crit[0]++; A.crit[3] += total;
      if (crit) { k.c++; A.crit[1]++; A.crit[2] += total; }
      let rs = 0;
      for (const t in raw) rs += raw[t];
      if (rs > 0) for (const t in raw) A.el[t] = (A.el[t] || 0) + (total * raw[t]) / rs;
    }
    const hadAil = { frozen: e.frozen > 0, burn: e.burns.length > 0, shock: e.shock > 0, poison: e.poisons.length > 0, bleed: !!e.bleed };
    const wasShocked = e.shock > 0;
    this._inHit = true;
    this.dealDamage(e, total, crit, S);
    this._inHit = false;
    impact(this, S, e.x, e.y);
    // Rückstoß (Bosse und unbewegliche Gegner sind immun)
    if (!e.boss && e.speed > 0) {
      const w = (S.def.kb ?? KB[S.def.beh] ?? 0.5) * (crit ? 1.6 : 1) * (e.elite ? 0.35 : 1);
      if (w > 0) {
        const f = Math.min(1, total / Math.max(1, e.maxHp));
        const imp = w * (35 + 230 * f);
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
        e.kx = clamp((e.kx || 0) + (dx / d) * imp, -420, 420);
        e.ky = clamp((e.ky || 0) + (dy / d) * imp, -420, 420);
      }
    }
    // Kurzes Einfrieren des Bildes bei vernichtenden Krits
    if (crit && total > e.maxHp * 0.3 && this.t - this.lastStop > 0.4) { this.hitstop = 0.045; this.lastStop = this.t; }

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
    const vir = P.spec.spec_virulent && e.poisons.length && !P.spec.spec_noAil ? 100 : 0;
    if (pc && (S.psn || vir) && Math.random() * 100 < S.psn + vir) {
      e.poisons.push({ dps: pc * 0.3 * S.poisonMult, t: 3 * ad });
      if (e.poisons.length > 40) e.poisons.shift();
    }
    if (raw.phys && S.bld && Math.random() * 100 < S.bld) {
      const dps = raw.phys * 0.6 * S.bleedMult;
      if (!e.bleed || e.bleed.dps < dps) e.bleed = { dps, t: 4 * ad };
    }
    // Pfade & Bund-Segen
    {
      const sp = P.spec;
      if (crit && sp.spec_critShock) { e.shock = Math.max(e.shock, 3 * ad); e.shockEff = Math.max(e.shockEff, Math.min(0.5, 0.2 * S.shockEff)); }
      if (crit && sp.spec_critBleed && raw.phys) { const dps = raw.phys * 0.6 * S.bleedMult; if (!e.bleed || e.bleed.dps < dps) e.bleed = { dps, t: 4 * ad }; }
      if (S.def.tags.includes('minion')) {
        if (sp.spec_minionPoison) { e.poisons.push({ dps: ((total * sp.spec_minionPoison) / 100) * S.poisonMult, t: 3 * ad }); if (e.poisons.length > 40) e.poisons.shift(); }
        if (sp.spec_minionBurn) {
          const b = { dps: total * 0.3 * S.burnMult, t: 4 * ad };
          if (S.burnStack) { e.burnStack = true; e.burns.push(b); if (e.burns.length > 10) e.burns.shift(); }
          else if (!e.burns.length || e.burns[0].dps < b.dps) e.burns = [b];
        }
        if (sp.spec_minionChill) { e.chill = Math.max(e.chill, 2 * ad); e.chillEff = Math.max(e.chillEff, Math.min(0.5, 0.3 * S.chillEff)); if (Math.random() < 0.1) e.frozen = Math.max(e.frozen, (e.boss ? 0.3 : 1.1) * ad); }
        if (sp.spec_minionShock) { e.shock = Math.max(e.shock, 3 * ad); e.shockEff = Math.max(e.shockEff, Math.min(0.5, 0.2 * S.shockEff)); }
        if (sp.spec_minionMark) e.mark = 2;
        if (sp.spec_minionBarrier && P.maxBarrier > 0) p.barrier = Math.min(P.maxBarrier, p.barrier + (total * sp.spec_minionBarrier) / 100);
      }
      if (wasShocked && sp.spec_stormCall && !chained && Math.random() * 100 < sp.spec_stormCall) {
        const tx = e.x, ty = e.y, v = total * 0.5;
        this.delayed.push({ t: 0.08, fn: () => {
          this.aoeFlat(tx, ty, 70, v, 'light');
          this.fx.push({ type: 'bolt', pts: [[tx + rand(-20, 20), ty - 200], [tx + rand(-12, 12), ty - 90], [tx, ty]], t: 0.2, max: 0.2, color: ELEM.light.color });
          sfx.zap();
        } });
      }
    }
    // Neu verursachte Zustände kurz anzeigen (sparsam)
    if (!crit && save.settings.dmgNums && this.t - this.lastAil > 0.35 && (e.elite || e.boss || Math.random() < 0.3)) {
      const now = { frozen: e.frozen > 0, burn: e.burns.length > 0, shock: e.shock > 0, poison: e.poisons.length > 0, bleed: !!e.bleed };
      for (const k in now) if (now[k] && !hadAil[k]) { this.label(e.x, e.y - e.r - 22, AIL_TXT[k][0], AIL_TXT[k][1]); this.lastAil = this.t; break; }
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
    if (!S) this.stats.an.other += amount;
    else if (!this._inHit) anSkill(this.stats.an, S).d += amount;
    if (amount > this.stats.maxHit) this.stats.maxHit = amount;
    if (crit) sfx.crit(); else sfx.hit();
    this.dmgText(e, amount, crit, S ? typeColor(S.dmg) : '#fff');
  }

  dmgText(e, amount, crit, color, dot = false) {
    if (!save.settings.dmgNums || this.texts.length > 70) return;
    const big = amount > e.maxHp * 0.25 && !dot;
    this.texts.push({
      x: e.x + rand(-8, 8), y: e.y - e.r - 6, txt: fmt(amount) + (crit ? '!' : ''), color: crit ? '#ffe066' : color,
      t: crit ? 0.85 : 0.7, max: crit ? 0.85 : 0.7, size: crit ? (big ? 1.75 : 1.45) : dot ? 0.75 : big ? 1.2 : 1, vy: crit ? -55 : -40,
      style: crit ? 'crit' : dot ? 'dot' : null, rot: crit ? rand(-0.15, 0.15) : 0,
    });
    if (crit && this.t - this.lastKrit > 0.3) { this.lastKrit = this.t; this.label(e.x, e.y - e.r - 26, 'KRIT', '#ff9a3a'); }
  }
  /** Kleine Beschriftung (Zustände, KRIT) über einem Gegner. */
  label(x, y, txt, color) {
    if (this.texts.length > 70) return;
    this.texts.push({ x, y, txt, color, t: 0.6, max: 0.6, size: 0.7, vy: -30, style: 'label' });
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
    const av = this.P.spec.spec_avalanche, ap = this.P.spec.spec_areaPoison;
    this.query(x, y, r + 30, (e) => {
      if (Math.hypot(e.x - x, e.y - y) > r + e.r * 0.6) return;
      const t = this.hitEnemy(e, S, av && e.frozen > 0 ? mult * 2 : mult);
      if (ap && t > 0 && !e.dead && !this.P.spec.spec_noAil) { e.poisons.push({ dps: ((t * ap) / 100) * S.poisonMult, t: 3 * S.ailDur }); if (e.poisons.length > 40) e.poisons.shift(); }
    });
  }

  /** Flächentreffer inklusive Nachbeben (Glyphe/Effekt). */
  blast(S, x, y, r, color) {
    let m = 1;
    if (this.P.spec.spec_quake) {
      // Großbeben: jeder vierte Flächentreffer einer Rune
      S._q = (S._q || 0) + 1;
      if (S._q % 4 === 0) {
        m = 2; r *= 1.5;
        this.fx.push({ type: 'shock', x, y, r: r * 1.25, color: '#ffb36b', t: 0.45, max: 0.45 });
        this.decal({ x, y, r: r * 0.7, kind: 'crater', t: 6 });
        if (save.settings.shake) this.shake = Math.max(this.shake, 6);
      }
    }
    this.areaHit(S, x, y, r, m);
    if (!blastFx(this, S, x, y, r, color)) this.ring(x, y, r, color, 0.3, true);
    if (S.aftershock) {
      this.delayed.push({ t: 0.4, fn: () => { this.areaHit(S, x, y, r * 1.1, 0.5); this.ring(x, y, r * 1.1, color, 0.3); } });
    }
  }

  areaDot(S, x, y, r, secs) {
    this.query(x, y, r + 30, (e) => {
      if (Math.hypot(e.x - x, e.y - y) > r + e.r * 0.5) return;
      let total = 0;
      const parts = {};
      for (const t in S.dmg) {
        const avg = (S.dmg[t][0] + S.dmg[t][1]) / 2;
        parts[t] = avg * secs * (1 - (this.resOf(e, t) - S.pen[t]) / 100);
        total += parts[t];
      }
      let m = e.takenMult * this.vuln(e);
      if (e.shock > 0) m *= 1 + e.shockEff;
      if (e.elite || e.boss) m *= S.vsBoss;
      total *= m;
      e.hp -= total;
      e.lastS = S;
      this.stats.dmgDone += total;
      const A = this.stats.an, k = anSkill(A, S);
      k.d += total; k.dot += total;
      for (const t in parts) A.el[t] = (A.el[t] || 0) + parts[t] * m;
      e.dotAcc += total;
      if (e.hp <= 0) this.kill(e, S);
    });
  }

  kill(e, S, silent = false) {
    if (!e.dead) this.stats.byType[e.id] = (this.stats.byType[e.id] || 0) + 1;
    if (!e.dead && S) anSkill(this.stats.an, S).k++;
    if (e.dead) return;
    e.dead = true;
    const c = this.cfg, P = this.P;
    this.stats.kills++;
    this.killT = 3;
    if (e.boss && !silent) {
      this.slowmo = 1.5; this.whiteFlash = 0.35;
      this.fx.push({ type: 'shock', x: e.x, y: e.y, r: 520, color: '#ffffff', t: 1.1, max: 1.1 });
      this.fx.push({ type: 'shock', x: e.x, y: e.y, r: 320, color: e.color, t: 0.8, max: 0.8 });
      this.fx.push({ type: 'flash', x: e.x, y: e.y, r: 260, color: '#ffffff', t: 0.5, max: 0.5 });
      for (let i = 0; i < 14; i++) { const a = Math.random() * TAU, v = rand(120, 380); this.part({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: rand(0.9, 1.6), color: '#3a2a30', s: rand(4, 8), k: 6, z: 5, vz: rand(250, 520) }); }
      if (save.settings.shake) this.shake = Math.max(this.shake, 12);
      this.decal({ x: e.x, y: e.y, r: e.r * 2.6, kind: 'crater', t: 40 });
      sfx.bossDie?.();
      this.sfx.setDuck?.(0.25, 2);
    } else if (e.elite && !silent && this.t - this.lastStop > 0.3) { this.hitstop = 0.07; this.lastStop = this.t; this.fx.push({ type: 'shock', x: e.x, y: e.y, r: 140, color: '#ffd84d', t: 0.4, max: 0.4 }); }
    if (!silent) {
      this.burst(e.x, e.y, e.color, e.boss ? 80 : e.elite ? 24 : 9, e.boss ? 300 : 140);
      this.decal({ x: e.x, y: e.y, r: e.r * 1.7, col: e.color, t: e.boss ? 30 : 7 });
      this.ring(e.x, e.y, e.r * 1.6, e.color, 0.22);
      sfx.kill();
    }
    // Belohnungen
    if (e.illusion) { this.burst(e.x, e.y, e.color, 10, 120); return; }
    const eliteLoot = e.elite && c.eliteLoot ? 1.5 : 1;
    const xpv = e.xp * c.xpMult * eliteLoot;
    if (e.d.deathPool) { const dp = e.d.deathPool; this.hazards.push({ x: e.x, y: e.y, r: dp.r, t: dp.t, max: dp.t, dps: e.dmg * 0.6, elem: dp.elem }); }
    if (xpv > 0) this.dropOrb(e.x, e.y, 'xp', xpv);
    if (Math.random() < 0.06 + (e.elite ? 0.9 : 0)) this.dropOrb(e.x + rand(-10, 10), e.y + rand(-10, 10), 'gold', randi(1, 3) * (c.act || 3) * (e.elite ? 5 * eliteLoot : 1));
    if (Math.random() < (e.elite ? 0.3 : 0.007)) this.dropOrb(e.x, e.y, 'heart', 0.12);
    if (P.lifeOnKill) this.heal(P.lifeOnKill);
    if (e.elite) { this.stats.elites++; this.cb.onEliteKill(e); }
    if (e.nemesis) {
      this.text(e.x, e.y - 40, 'RACHE!', '#ffd84d', 1.8);
      this.ring(e.x, e.y, 200, '#ffd84d', 0.8);
      if (this.cb.onNemesisKill) this.cb.onNemesisKill(e.nemesis);
    }
    // Besondere Effekte
    if (S && S.killExplode) this.aoeFlat(e.x, e.y, 75, (e.maxHp * S.killExplode) / 100, 'fire');
    if (P.spec.spec_burnExplode && e.burns.length) {
      const ex = e.x, ey = e.y, v = (e.maxHp * P.spec.spec_burnExplode) / 100;
      this.fx.push({ type: 'flash', x: ex, y: ey, r: 95, color: '#ff8a3a', t: 0.18, max: 0.18 });
      this.delayed.push({ t: 0.06, fn: () => { this.aoeFlat(ex, ey, 85, v, 'fire'); this.burst(ex, ey, '#ffb040', 12, 200); } });
    }
    if (P.spec.spec_poisonSpread && e.poisons.length) {
      const top = [...e.poisons].sort((a, b) => b.dps - a.dps).slice(0, 5);
      this.query(e.x, e.y, 115, (o) => {
        if (o === e || o.dead || Math.hypot(o.x - e.x, o.y - e.y) > 115) return;
        for (const ps of top) o.poisons.push({ dps: ps.dps, t: 3 });
        if (o.poisons.length > 40) o.poisons.splice(0, o.poisons.length - 40);
        if (!o.lastS) o.lastS = e.lastS;
      });
      this.ring(e.x, e.y, 115, ELEM.chaos.color, 0.3);
    }
    if (e.elite && P.spec.spec_bulwark) this.player.barrier = P.maxBarrier;
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
    if (e.d.deathRing) { this._shooter = e; const off = Math.random() * TAU; for (let i = 0; i < e.d.deathRing; i++) this.shootE(e.x, e.y, off + (i * TAU) / e.d.deathRing, 170, e.dmg * 0.6, e.d.deathElem || 'phys'); }
    this.query(e.x, e.y, 230, (o) => {
      if (o === e || !o.d.enrage || (o.rage || 0) >= 3) return;
      o.rage = (o.rage || 0) + 1; o.speed *= 1.12; o.dmg *= 1.1;
      this.label(o.x, o.y - o.r - 14, 'Wut!', '#ff6a3a');
    });
    if (c.volatileCorpses && !e.boss && Math.random() < 0.4) this.teles.push({ src: this._shooter, x: e.x, y: e.y, r: 45, t: 0.8, max: 0.8, dmg: e.dmg * 0.7, elem: 'fire' });
    if (e.affixes.includes('volatile')) this.teles.push({ src: this._shooter, x: e.x, y: e.y, r: 85, t: 0.8, max: 0.8, dmg: e.dmg * 1.5, elem: 'fire' });
    if (!e.boss && !e.elite && ascHas(c.asc, 'explode') && Math.random() < 0.35) this.teles.push({ src: this._shooter, x: e.x, y: e.y, r: 40, t: 0.7, max: 0.7, dmg: e.dmg * 0.6, elem: 'fire' });
  }

  // ---------------------------------------------------------------- Fertigkeiten
  updateSkills(dt) {
    const p = this.player;
    if (this.frenzy) dt *= 1 + this.frenzy / 100;
    for (const sk of this.sk) {
      const S = sk.S, def = S.def;
      if (def.beh === 'aura') auraTick(this, sk, dt);
      if (def.beh === 'orbit') { this.updateOrbit(sk, dt); continue; }
      if (def.beh === 'minion') continue;
      sk.t -= dt;
      if (sk.t > 0) continue;
      if (this.cast(sk)) {
        if (def.beh !== 'aura') sfx.cast?.(elemOf(S.dmg));
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
        const falls = !!visOf(S).fall;
        for (let i = 0; i < S.count; i++) {
          const tg = pick(near);
          const tx = tg.x, ty = tg.y;
          if (falls) {
            const fd = 0.2;
            this.delayed.push({ t: i * 0.07, fn: () => fallFx(this, S, tx, ty, fd) });
            this.delayed.push({ t: i * 0.07 + fd, fn: () => this.blast(S, tx, ty, S.area, color) });
          } else {
            this.delayed.push({ t: i * 0.07, fn: () => {
              this.blast(S, tg.x, tg.y, S.area, color);
              this.fx.push({ type: 'bolt', pts: [[tg.x + rand(-30, 30), tg.y - 220], [tg.x + rand(-15, 15), tg.y - 100], [tg.x, tg.y]], t: 0.2, max: 0.2, color });
            } });
          }
        }
        if (falls) sfx.meteor?.(0.2); else sfx.zap();
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
        if (sfx.chain) sfx.chain(); else sfx.zap();
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
          fallFx(this, S, x, y, delay);
          if (!i) sfx.meteor?.(delay);
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
        sfx.trap?.();
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
          pr.back = true; pr.hit.clear(); pr.pierce = Math.max(pr.pierce, 99); pr.life = 3; pr.m = (pr.m || 1) * 0.6;
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
      projTrail(this, pr, dt);
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
    const S = pr.S, spec = this.P.spec;
    pr.hit.add(e);
    if (spec.spec_firstCrit && pr.hit.size === 1) this._first = spec.spec_firstCrit;
    if (S.explode > 0) {
      this.areaHit(S, e.x, e.y, S.explode, pr.m || 1);
      this.ring(e.x, e.y, S.explode, pr.color, 0.25, true);
      this.fx.push({ type: 'flash', x: e.x, y: e.y, r: S.explode * 1.2, color: pr.color, t: 0.14, max: 0.14 });
      for (let i = 0; i < 10; i++) { const a = Math.random() * TAU, v = rand(60, 220); this.part({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: rand(0.3, 0.6), color: Math.random() < 0.5 ? '#ffb040' : pr.color, s: rand(1.5, 3.2), k: 2 }); }
      this.part({ x: e.x, y: e.y, vx: 0, vy: 0, t: 0.8, color: '#3a2a24', s: S.explode * 0.35, k: 4 });
      this.decal({ x: e.x, y: e.y, r: S.explode * 0.7, kind: 'scorch', col: pr.color, t: 4 });
      sfx.explode?.(elemOf(S.dmg));
    } else {
      this.hitEnemy(e, S, pr.m || 1);
      if (spec.spec_projBurst) {
        this.areaHit(S, e.x, e.y, 48, spec.spec_projBurst / 100);
        this.ring(e.x, e.y, 48, '#ff9a3a', 0.2, true);
        this.fx.push({ type: 'flash', x: e.x, y: e.y, r: 55, color: '#ff9a3a', t: 0.12, max: 0.12 });
      }
    }
    this._first = 0;
    if (spec.spec_projArc) {
      const n = this.nearest(e.x, e.y, 170, pr.hit);
      if (n) { this.hitEnemy(n, S, spec.spec_projArc / 100, true); this.fx.push({ type: 'bolt', pts: [[e.x, e.y], [n.x, n.y]], t: 0.12, max: 0.12, color: ELEM.light.color }); }
    }
    if (pr.fork) {
      pr.fork = false;
      const a = Math.atan2(pr.vy, pr.vx), sp = Math.hypot(pr.vx, pr.vy);
      for (const da of [-0.55, 0.55]) {
        if (this.projs.length >= MAX_PROJ) break;
        this.projs.push({ ...pr, x: e.x, y: e.y, vx: Math.cos(a + da) * sp, vy: Math.sin(a + da) * sp, hit: new Set([e]), fork: false, life: Math.max(0.6, pr.life), dead: false, m: (pr.m || 1) * 0.6 });
      }
    }
    if (spec.spec_iceShards && e.chill > 0 && !e.boss) return;
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
      this.objective = this.bossSpawned ? (this.boss && this.boss.shieldUp ? 'Zerstöre die Schildkristalle!' : this.enemies.some((o) => !o.dead && o.anchorOf) ? 'Vernichte die Seelenanker!' : this.bossLineT > 0 ? `„${this.bossLine}“` : '') : 'Etwas nähert sich …';
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
      const a = Math.random() * TAU, v = rand(0.3, 1) * spd, life = rand(0.3, 0.7);
      this.part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: life, color, s: rand(1.5, 3.5), k: Math.random() < 0.45 ? 1 : 0 });
    }
  }
  /** Einzelnes Partikel (k: 0 Glühen, 1 Funke, 2 Glut, 3 Eissplitter, 4 Rauch, 5 Tropfen, 6 Brocken, 7 Schneeflocke). */
  part(o) {
    if (this.parts.length > 520) this.parts.splice(0, 20);
    o.max = o.t; if (o.k === undefined) o.k = 0;
    this.parts.push(o);
  }
  decal(o) {
    if (!this.decals) return;
    o.max = o.t;
    this.decals.push(o);
    if (this.decals.length > 90) this.decals.shift();
  }
  text(x, y, txt, color, size = 1) {
    this.texts.push({ x, y, txt, color, t: 1.2, max: 1.2, size, vy: -25 });
  }
  updateFx(dt) {
    for (const f of this.fx) f.t -= dt;
    this.fx = this.fx.filter((f) => f.t > 0);
    updateParticles(this.parts, dt);
    this.parts = this.parts.filter((p) => p.t > 0);
    for (const t of this.texts) { t.y += t.vy * dt; t.t -= dt; }
    this.texts = this.texts.filter((t) => t.t > 0);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 25);
    if (this.decals) { for (const d of this.decals) d.t -= dt; if (this.decals.length && this.decals[0].t <= 0) this.decals = this.decals.filter((d) => d.t > 0); }
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
    ctx.imageSmoothingEnabled = true;
    const p = this.player || { x: 0, y: 0 };
    if (!this.cfg) { this.renderMenuBg(ctx, W, H); return; }
    const BF = this.bfx || BIOME_FX.sternengrab;
    this.rt = (this.rt || 0) + 1 / 60;
    ctx.fillStyle = shade(this.cfg.tint || '#0a0716', -0.45);
    ctx.fillRect(0, 0, W, H);

    let sx = 0, sy = 0;
    if (this.shake > 0) { sx = rand(-1, 1) * this.shake; sy = rand(-1, 1) * this.shake; }
    const ox = W / 2 - p.x * sc + sx, oy = H / 2 - p.y * sc + sy;
    const X = (x) => ox + x * sc, Y = (y) => oy + y * sc;
    const vis = (x, y, m) => Math.abs(X(x) - W / 2) < W / 2 + m * sc && Math.abs(Y(y) - H / 2) < H / 2 + m * sc;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(sc, sc);

    // ---- Boden
    if (!this.floorPat) this.floorPat = ctx.createPattern(floorTile(this.cfg.biome || 'sternengrab', this.cfg.floorColor || '#221642', BF.fog), 'repeat');
    ctx.fillStyle = this.floorPat;
    ctx.beginPath(); ctx.arc(0, 0, ARENA_R, 0, TAU); ctx.fill();
    // Arenarand: dunkler Abgrund + leuchtender Runenring
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 70;
    ctx.beginPath(); ctx.arc(0, 0, ARENA_R + 35, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 26;
    ctx.beginPath(); ctx.arc(0, 0, ARENA_R - 13, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.arc(0, 0, ARENA_R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = rgba(BF.ambCol, 0.85); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, ARENA_R - 8, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    const rs = soft(BF.ambCol);
    for (let i = 0; i < 96; i++) {
      const a = (i * TAU) / 96 + this.t * 0.01;
      const x = Math.cos(a) * (ARENA_R - 8), y = Math.sin(a) * (ARENA_R - 8);
      if (!vis(x, y, 60)) continue;
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(this.t * 2 + i);
      ctx.drawImage(rs, x - 22, y - 22, 44, 44);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // Brandspuren
    const shSpr = shadowSprite();
    for (const d of this.decals) {
      if (!vis(d.x, d.y, d.r)) continue;
      drawDecal(ctx, d, Math.min(1, d.t / 2), shSpr);
    }
    ctx.globalAlpha = 1;

    // ---- Auren des Spielers
    for (const sk of this.sk) {
      if (sk.S.def.beh !== 'aura') continue;
      if (drawAura(ctx, sk, this, runeCircle)) continue;
      const col = typeColor(sk.S.dmg), R = sk.S.area;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.18 + 0.05 * Math.sin(this.t * 4);
      ctx.drawImage(soft(col), p.x - R * 1.1, p.y - R * 1.1, R * 2.2, R * 2.2);
      ctx.globalAlpha = 0.5;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(this.t * 0.4);
      ctx.drawImage(runeCircle(col, 256, 16, 7), -R, -R, R * 2, R * 2);
      ctx.restore();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    // ---- Gefahren, Zonen, Warnungen
    for (const h of this.hazards) {
      if (!vis(h.x, h.y, h.r)) continue;
      const a = Math.min(1, h.t / 0.6), col = ELEM[h.elem].color;
      ctx.fillStyle = rgba(shade(col, -0.6), 0.35 * a);
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 * a * (0.8 + 0.2 * Math.sin(this.t * 7 + h.x));
      ctx.drawImage(soft(col), h.x - h.r * 1.15, h.y - h.r * 1.15, h.r * 2.3, h.r * 2.3);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = rgba(col, 0.7 * a); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r * (0.92 + 0.06 * Math.sin(this.t * 4 + h.x)), 0, TAU); ctx.stroke();
      // Blasen
      ctx.fillStyle = rgba(shade(col, 0.4), 0.6 * a);
      for (let i = 0; i < 3; i++) { const k = (this.t * 0.8 + i / 3 + h.x * 0.01) % 1; const bx = h.x + Math.cos(i * 2.3 + h.y) * h.r * 0.5, by = h.y + Math.sin(i * 2.3 + h.x) * h.r * 0.5; ctx.beginPath(); ctx.arc(bx, by, 2 + k * 5, 0, TAU); ctx.globalAlpha = 1 - k; ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    for (const z of this.zones) {
      if (!vis(z.x, z.y, z.r)) continue;
      if (drawZone(ctx, z, this, runeCircle)) continue;
      const a = Math.min(1, z.t / 0.4);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3 * a;
      ctx.drawImage(soft(z.color), z.x - z.r * 1.1, z.y - z.r * 1.1, z.r * 2.2, z.r * 2.2);
      ctx.globalAlpha = 0.55 * a;
      ctx.save(); ctx.translate(z.x, z.y); ctx.rotate(-this.t * 0.8 + z.x);
      ctx.drawImage(runeCircle(z.color, 192, 10, 4), -z.r, -z.r, z.r * 2, z.r * 2);
      ctx.restore();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    for (const t of this.teles) {
      const k = 1 - t.t / t.max, col = ELEM[t.elem].color;
      ctx.fillStyle = rgba(col, 0.1 + k * 0.22);
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r * k, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(col, 0.55 + 0.4 * Math.sin(this.t * 18)); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, TAU); ctx.stroke();
    }
    for (const f of this.fx) {
      if (f.type === 'tele') {
        const k = 1 - f.t / f.max;
        ctx.strokeStyle = rgba(f.color, 0.6 + 0.3 * Math.sin(this.t * 18)); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke();
        ctx.fillStyle = rgba(f.color, 0.18 * k);
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * k, 0, TAU); ctx.fill();
      } else if (f.type === 'safezone') {
        const k = 1 - f.t / f.max, col = '#ff3b3b';
        ctx.beginPath(); ctx.arc(f.x, f.y, f.R, 0, TAU);
        for (const z of f.safes) { ctx.moveTo(z.x + z.r, z.y); ctx.arc(z.x, z.y, z.r, 0, TAU, true); }
        ctx.fillStyle = rgba(col, 0.1 + 0.22 * k); ctx.fill('evenodd');
        ctx.strokeStyle = rgba(col, 0.6 + 0.3 * Math.sin(this.t * 14)); ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.R, 0, TAU); ctx.stroke();
        for (const z of f.safes) {
          ctx.strokeStyle = rgba('#7dffb0', 0.8); ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.stroke();
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + 0.15 * Math.sin(this.t * 6);
          ctx.drawImage(soft('#7dffb0'), z.x - z.r, z.y - z.r, z.r * 2, z.r * 2);
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        }
      } else if (f.type === 'line') {
        const k = 1 - f.t / f.max;
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a);
        ctx.fillStyle = rgba(f.color, 0.1 + 0.22 * k);
        ctx.fillRect(0, -f.w / 2, f.len, f.w);
        ctx.fillStyle = rgba(f.color, 0.5 + 0.4 * k);
        ctx.fillRect(0, -1.5, f.len, 3);
        ctx.restore();
      }
    }
    // ---- Beute
    ctx.globalCompositeOperation = 'lighter';
    for (const o of this.orbs) {
      if (!vis(o.x, o.y, 20)) continue;
      const bob = Math.sin(this.t * 4 + o.x) * 2;
      const col = o.type === 'xp' ? '#62d6ff' : o.type === 'gold' ? '#ffd84d' : '#ff4d6d';
      const r = o.type === 'xp' ? 10 + Math.min(10, Math.sqrt(o.v) * 2) : 16;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(soft(col), o.x - r, o.y - r + bob, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (const o of this.orbs) {
      if (!vis(o.x, o.y, 20)) continue;
      const bob = Math.sin(this.t * 4 + o.x) * 2, y = o.y + bob;
      if (o.type === 'xp') {
        const r = 3 + Math.min(5, Math.sqrt(o.v));
        ctx.fillStyle = '#bff0ff';
        ctx.beginPath(); ctx.moveTo(o.x, y - r * 1.2); ctx.lineTo(o.x + r * 0.7, y); ctx.lineTo(o.x, y + r * 1.2); ctx.lineTo(o.x - r * 0.7, y); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(o.x, y - r * 1.2); ctx.lineTo(o.x + r * 0.7, y); ctx.lineTo(o.x, y); ctx.fill();
      } else if (o.type === 'gold') {
        ctx.fillStyle = '#b8860b'; ctx.beginPath(); ctx.ellipse(o.x, y, 5.5, 5.5 * Math.abs(Math.cos(this.t * 3 + o.x)) + 1, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.ellipse(o.x, y, 4, 4 * Math.abs(Math.cos(this.t * 3 + o.x)) + 0.5, 0, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = '#ff5c7a';
        ctx.beginPath(); ctx.moveTo(o.x, y + 6); ctx.bezierCurveTo(o.x - 9, y - 1, o.x - 4, y - 8, o.x, y - 3); ctx.bezierCurveTo(o.x + 4, y - 8, o.x + 9, y - 1, o.x, y + 6); ctx.fill();
      }
    }
    // ---- Fallen
    for (const t of this.traps) drawTrap(ctx, t, this, runeCircle);
    // ---- Schatten aller Figuren
    const shS = shadowSprite();
    if (!this.lowGfx) for (const e of this.enemies) {
      if (e.dead || e.phased || !vis(e.x, e.y, e.r * 2)) continue;
      ctx.drawImage(shS, e.x - e.r * 1.2, e.y + e.r * 0.2, e.r * 2.4, e.r * 1.1);
    }
    for (const m of this.minions) ctx.drawImage(shS, m.x - 12, m.y + 4, 24, 10);
    ctx.drawImage(shS, p.x - 20, p.y + 4, 40, 16);
    // ---- Fesseln (Kristalle, Anker, Zwillinge, Lebensentzug)
    ctx.lineCap = 'round';
    for (const e of this.enemies) {
      if (e.dead) continue;
      let tx = null, ty = null, col = null, w = 3;
      if (e.crystalOf && !e.crystalOf.dead) { tx = e.crystalOf.x; ty = e.crystalOf.y; col = '#bfe8ff'; }
      else if (e.anchorOf && !e.anchorOf.dead) { tx = e.anchorOf.x; ty = e.anchorOf.y; col = '#ff8ad8'; }
      else if (e.link && e.linkMain && !e.link.dead) { tx = e.link.x; ty = e.link.y; col = '#a070ff'; w = 4; }
      else if (e.draining > 0) { tx = p.x; ty = p.y; col = e.d.drain.elem === 'cold' ? '#8fe4ff' : '#9cff5e'; }
      if (tx === null) continue;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(col, 0.25); ctx.lineWidth = w * 4;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.strokeStyle = rgba(col, 0.85); ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(e.x, e.y);
      const segs = 6;
      for (let i = 1; i < segs; i++) { const q = i / segs; ctx.lineTo(e.x + (tx - e.x) * q + Math.sin(this.t * 12 + i) * 5, e.y + (ty - e.y) * q + Math.cos(this.t * 11 + i) * 5); }
      ctx.lineTo(tx, ty); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    // ---- Gegner
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (!vis(e.x, e.y, e.r * 3)) continue;
      this.drawEnemy(ctx, e);
    }
    // ---- Begleiter
    for (const m of this.minions) this.drawMinion(ctx, m);
    // ---- Projektile (eigene Optik je Rune)
    drawProjectiles(ctx, this, vis);
    for (const b of this.eprojs) {
      if (!vis(b.x, b.y, 30)) continue;
      const col = ELEM[b.elem].color;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.8;
      ctx.drawImage(soft(col), b.x - b.r * 3, b.y - b.r * 3, b.r * 6, b.r * 6);
      ctx.globalAlpha = 0.35;
      ctx.drawImage(soft(col), b.x - b.vx * 0.05 - b.r * 2, b.y - b.vy * 0.05 - b.r * 2, b.r * 4, b.r * 4);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#1a0610'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.75, 0, TAU); ctx.fill();
      ctx.strokeStyle = shade(col, 0.4); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
    }
    // ---- Spieler
    if (!(this.over && this.result && !this.result.win)) this.drawPlayer(ctx);
    // ---- Kreisende Klingen
    for (const sk of this.sk) {
      if (sk.S.def.beh !== 'orbit') continue;
      const n = sk.S.count, R = sk.S.area, col = typeColor(sk.S.dmg);
      void col;
      for (let i = 0; i < n; i++) {
        const a = sk.orbitA + (i * TAU) / n;
        drawOrbitItem(ctx, sk, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, a, this);
      }
    }
    // ---- Effekte
    for (const f of this.fx) {
      const k = f.t / f.max;
      if (drawFx(ctx, f, this)) continue;
      if (f.type === 'ring') {
        const rr = f.r * (f.fill ? 1 : 0.6 + 0.4 * (1 - k));
        if (f.fill) {
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 * k;
          ctx.drawImage(soft(f.color), f.x - f.r * 1.2, f.y - f.r * 1.2, f.r * 2.4, f.r * 2.4);
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        }
        ctx.strokeStyle = rgba(f.color, 0.85 * k); ctx.lineWidth = 2 + 4 * k;
        ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(1, rr), 0, TAU); ctx.stroke();
        ctx.strokeStyle = rgba('#ffffff', 0.5 * k); ctx.lineWidth = 1.2;
        ctx.stroke();
      } else if (f.type === 'bolt') {
        ctx.globalCompositeOperation = 'lighter';
        const path = () => {
          ctx.beginPath();
          f.pts.forEach(([x, y], i) => {
            if (!i) { ctx.moveTo(x, y); return; }
            const [px, py] = f.pts[i - 1];
            ctx.lineTo((px * 2 + x) / 3 + rand(-9, 9), (py * 2 + y) / 3 + rand(-9, 9));
            ctx.lineTo((px + x * 2) / 3 + rand(-9, 9), (py + y * 2) / 3 + rand(-9, 9));
            ctx.lineTo(x, y);
          });
        };
        path(); ctx.strokeStyle = rgba(f.color, 0.35 * k); ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.stroke();
        ctx.strokeStyle = rgba(f.color, k); ctx.lineWidth = 3.5; ctx.stroke();
        ctx.strokeStyle = rgba('#ffffff', k); ctx.lineWidth = 1.4; ctx.stroke();
        // Verästelungen
        ctx.beginPath();
        for (let i = 1; i < f.pts.length; i++) {
          const [ax, ay] = f.pts[i - 1], [bx, by] = f.pts[i];
          const mx = (ax + bx) / 2, my = (ay + by) / 2, ang = Math.atan2(by - ay, bx - ax) + (Math.random() < 0.5 ? 1 : -1) * rand(0.5, 1.1);
          const l = Math.hypot(bx - ax, by - ay) * rand(0.15, 0.3);
          ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(ang) * l * 0.5 + rand(-5, 5), my + Math.sin(ang) * l * 0.5 + rand(-5, 5)); ctx.lineTo(mx + Math.cos(ang) * l, my + Math.sin(ang) * l);
        }
        ctx.strokeStyle = rgba(f.color, 0.7 * k); ctx.lineWidth = 1.5; ctx.stroke();
        const [lx, ly] = f.pts[f.pts.length - 1];
        ctx.globalAlpha = k; ctx.drawImage(soft(f.color), lx - 24, ly - 24, 48, 48); ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      } else if (f.type === 'slash') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(f.color, 0.4 * k); ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(f.x, f.y, 20, f.a - 1.1, f.a + 1.1); ctx.stroke();
        ctx.strokeStyle = rgba('#ffffff', k); ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(f.x, f.y, 20, f.a - 1, f.a + 1); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      } else if (f.type === 'beam') {
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba(f.color, 0.45 * k); ctx.fillRect(0, -26, f.len, 52);
        ctx.fillStyle = rgba(f.color, 0.9 * k); ctx.fillRect(0, -14, f.len, 28);
        ctx.fillStyle = rgba('#ffffff', 0.95 * k); ctx.fillRect(0, -5, f.len, 10);
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
      }
    }
    // ---- Partikel
    drawParticles(ctx, this.parts, this.lowGfx, this.t);
    ctx.restore();

    // ---- Licht: Dunkelheit mit ausgestanzten Lichtquellen
    if (!this.lowGfx) {
      this.renderLight(ctx, W, H, X, Y, sc, BF);
      drawAmbient(ctx, this.ambient, BF.ambCol, W, H, this.t, p.x, p.y);
    }

    // ---- Schadenszahlen über allem
    ctx.save();
    ctx.translate(ox, oy); ctx.scale(sc, sc);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const age = t.max - t.t;
      const popK = t.style === 'crit' ? 1.3 : 0.8;
      const pop = age < 0.12 ? 1 + ((0.12 - age) / 0.12) * popK : 1;
      ctx.globalAlpha = Math.min(1, (t.t / t.max) * 2.2);
      const size = Math.round(14 * t.size * pop);
      ctx.font = t.style === 'dot' ? `italic 700 ${size}px system-ui, sans-serif` : t.style === 'label' ? `800 ${size}px system-ui, sans-serif` : `900 ${size}px Cinzel, Georgia, serif`;
      ctx.save(); ctx.translate(t.x, t.y); if (t.rot) ctx.rotate(t.rot);
      ctx.lineWidth = t.style === 'crit' ? 5 : 4; ctx.lineJoin = 'round'; ctx.strokeStyle = t.style === 'crit' ? 'rgba(60,20,0,0.9)' : 'rgba(10,4,16,0.85)';
      ctx.strokeText(t.txt, 0, 0);
      if (t.style === 'crit') {
        const gr = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
        gr.addColorStop(0, '#fff8d0'); gr.addColorStop(0.5, '#ffd84d'); gr.addColorStop(1, '#ff8a1a');
        ctx.fillStyle = gr;
      } else ctx.fillStyle = t.color;
      ctx.fillText(t.txt, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // ---- Joystick
    const s = this.input.stick;
    if (s && this.running) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25; ctx.drawImage(runeCircle('#c8b8ff', 192, 12, 2), s.ox - 64, s.oy - 64, 128, 128);
      ctx.globalAlpha = 0.5; ctx.drawImage(soft('#c8b8ff'), s.x - 34, s.y - 34, 68, 68);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(s.x, s.y, 18, 0, TAU); ctx.fill();
    }
    if (this.whiteFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.6, this.whiteFlash * 1.8)})`; ctx.fillRect(0, 0, W, H); }
    // ---- Schadensblitz
    if (this.player.hurt > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      g.addColorStop(0, 'rgba(255,0,40,0)'); g.addColorStop(1, `rgba(255,20,50,${this.player.hurt * 2.2})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }

  renderLight(ctx, W, H, X, Y, sc, BF) {
    const q = 4;
    const lw = Math.ceil(W / q), lh = Math.ceil(H / q);
    if (!this.lightCv || this.lightCv.width !== lw || this.lightCv.height !== lh) {
      this.lightCv = document.createElement('canvas');
      this.lightCv.width = lw; this.lightCv.height = lh;
    }
    const g = this.lightCv.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, lw, lh);
    g.fillStyle = `rgba(4,2,10,${BF.dark})`;
    g.fillRect(0, 0, lw, lh);
    g.globalCompositeOperation = 'destination-out';
    const L = soft('#ffffff');
    const light = (x, y, r, a = 1) => {
      const px = X(x) / q, py = Y(y) / q, rr = (r * sc) / q;
      if (px + rr < 0 || py + rr < 0 || px - rr > lw || py - rr > lh) return;
      g.globalAlpha = a;
      g.drawImage(L, px - rr, py - rr, rr * 2, rr * 2);
    };
    const p = this.player;
    light(p.x, p.y, 360 + 20 * Math.sin(this.t * 2), 1);
    light(p.x, p.y, 200, 0.6);
    let n = 0;
    for (const pr of this.projs) { if (n++ > 70) break; light(pr.x, pr.y, 70 + pr.r * 4, 0.55); }
    for (const b of this.eprojs) light(b.x, b.y, 55, 0.45);
    for (const f of this.fx) if (f.type === 'ring') light(f.x, f.y, f.r * 1.4, 0.7 * (f.t / f.max)); else if (f.type === 'bolt') { const [lx, ly] = f.pts[f.pts.length - 1]; light(lx, ly, 160, f.t / f.max); }
    for (const z of this.zones) light(z.x, z.y, z.r * 1.3, 0.5);
    for (const h of this.hazards) light(h.x, h.y, h.r * 1.4, 0.35);
    for (const o of this.orbs) if (o.type !== 'xp' || o.v > 2) light(o.x, o.y, 40, 0.35);
    for (const e of this.enemies) if (!e.dead && (e.elite || e.boss)) light(e.x, e.y, e.r * (e.boss ? 6 : 4), 0.5);
    for (const m of this.minions) light(m.x, m.y, 70, 0.35);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.drawImage(vignette(lw, lh), 0, 0);
    ctx.drawImage(this.lightCv, 0, 0, W, H);
  }

  renderMenuBg(ctx, W, H) {
    ctx.drawImage(nebulaBg(W, H), 0, 0, W, H);
    const t = performance.now() / 1000;
    ctx.globalCompositeOperation = 'lighter';
    const s = soft('#dcd0ff');
    for (const st of this.stars) {
      const tw = 0.45 + 0.55 * Math.sin(t * (0.6 + st.s) + st.x * 40);
      ctx.globalAlpha = st.a * tw;
      const z = st.s * 5;
      ctx.drawImage(s, ((st.x * W + t * 3 * st.s) % W) - z / 2, st.y * H - z / 2, z, z);
    }
    // Sternschnuppe
    const k = (t % 7) / 7;
    if (k < 0.12) {
      const q = k / 0.12, sx0 = W * 0.9, sy0 = H * 0.08;
      const x = sx0 - q * W * 0.6, y = sy0 + q * H * 0.25;
      const gr = ctx.createLinearGradient(x, y, x + 90, y - 38);
      gr.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - q)})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = gr; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 90, y - 38); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  drawPlayer(ctx) {
    const p = this.player, P = this.P;
    const blink = p.inv > 0 && Math.floor(p.inv * 14) % 2 === 0;
    const col = this.cfg.clsColor || '#a8c8ff';
    ctx.globalAlpha = blink ? 0.45 : 1;
    // Runenkreis unter den Füßen
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (blink ? 0.3 : 0.65);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(this.t * 0.6);
    ctx.drawImage(runeCircle(col, 160, 10, 5), -34, -34, 68, 68);
    ctx.restore();
    ctx.globalAlpha = blink ? 0.3 : 0.7;
    ctx.drawImage(soft(col), p.x - 46, p.y - 46, 92, 92);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = blink ? 0.45 : 1;
    const spr = playerSprite(col, p.r);
    const h = spr.h * p.r * 1.25;
    const bob = Math.sin(this.t * 9) * (this.input.stick || this.input.key.x || this.input.key.y ? 1.2 : 0.4);
    ctx.save(); ctx.translate(p.x, p.y + bob); ctx.rotate(p.face);
    ctx.drawImage(spr.c, -h, -h, h * 2, h * 2);
    ctx.restore();
    if (p.barrier > 0 && P.maxBarrier > 0) {
      const k = p.barrier / P.maxBarrier;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + 0.35 * k;
      ctx.drawImage(soft('#9fe7ff'), p.x - 30, p.y - 30, 60, 60);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.strokeStyle = rgba('#bff3ff', 0.35 + 0.5 * k); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 9, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawMinion(ctx, m) {
    const bobT = m.bob || this.t * 3;
    if (m.kind === 'pet') {
      const y = m.y + Math.sin(bobT) * 3;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6;
      ctx.drawImage(soft(m.petColor || '#ffffff'), m.x - 26, y - 26, 52, 52);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.font = '20px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(m.glyph || '●', m.x, y);
      return;
    }
    const look = {
      wisp: ['sparkler', '#ffe34d', 7], wolf: ['charger', '#8affd8', 12], locust: ['swarm', '#c8ff5e', 5],
      spirit: ['shade', '#ff7a2a', 9], golem: ['golem', '#62d6ff', 17], skeleton: ['reaper', '#e6dccb', 10],
    }[m.kind] || ['reaper', '#e6dccb', 10];
    const [id, col, r] = look;
    const spr = enemySprite(id, col, r);
    const h = spr.h * r;
    const y = m.y + (m.kind === 'wisp' || m.kind === 'spirit' ? Math.sin(bobT) * 4 : 0);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45;
    ctx.drawImage(soft(col), m.x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(m.x, y); ctx.rotate(m.face || 0);
    ctx.drawImage(spr.c, -h, -h, h * 2, h * 2);
    ctx.restore();
  }

  drawEnemy(ctx, e) {
    const r = e.r;
    if (e.ph === undefined) e.ph = Math.random() * TAU;
    if (e.under > 0) {
      // Erdhügel des eingegrabenen Gegners
      ctx.fillStyle = '#3a2c1c';
      ctx.beginPath(); ctx.ellipse(e.x, e.y, r * 1.1, r * 0.55, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(e.color, 0.6); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, r * (1.1 + 0.1 * Math.sin(this.t * 10)), r * 0.55, 0, 0, TAU); ctx.stroke();
      return;
    }
    if (e.d.dmgAura) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18 + 0.08 * Math.sin(this.t * 5 + e.ph);
      ctx.drawImage(soft(ELEM[e.d.dmgAura.elem].color), e.x - e.d.dmgAura.r, e.y - e.d.dmgAura.r, e.d.dmgAura.r * 2, e.d.dmgAura.r * 2);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = rgba(ELEM[e.d.dmgAura.elem].color, 0.4); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e.x, e.y, e.d.dmgAura.r, 0, TAU); ctx.stroke();
    }
    if (e.d.slowAura) { ctx.strokeStyle = rgba('#8fb8ff', 0.22); ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.arc(e.x, e.y, e.d.slowAura, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    const ba = e.phased ? 0.25 : e.illusion ? 0.5 + 0.15 * Math.sin(this.t * 9 + e.ph) : 1;
    ctx.globalAlpha = ba;
    // Auren
    const auraRing = (rad, col) => {
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(this.t * 0.5 + e.ph);
      ctx.globalAlpha = (e.phased ? 0.06 : 0.16);
      ctx.drawImage(runeCircle(col, 256, 16, 11), -rad, -rad, rad * 2, rad * 2);
      ctx.restore(); ctx.globalAlpha = ba;
    };
    if (e.d.shield || e.shieldAura) auraRing(e.d.shield || e.shieldAura, '#7aa8ff');
    if (e.d.heal) auraRing(e.d.heal, '#7dffb0');
    if (e.d.hasteAura) auraRing(e.d.hasteAura, '#ff8a5c');
    // Elite / Erzfeind / Boss: leuchtender Runenkreis
    if (e.boss || e.elite) {
      const col = e.nemesis ? '#ff3b3b' : e.boss ? e.color : '#ffd84d';
      const R = r * (e.boss ? 2.1 : 1.9);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45 + 0.15 * Math.sin(this.t * 3 + e.ph);
      ctx.drawImage(soft(col), e.x - R * 1.3, e.y - R * 1.3, R * 2.6, R * 2.6);
      ctx.globalAlpha = 0.85;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(-this.t * (e.boss ? 0.35 : 0.8));
      ctx.drawImage(runeCircle(col, e.boss ? 384 : 160, e.boss ? 20 : 8, e.boss ? 13 : 6), -R, -R, R * 2, R * 2);
      ctx.restore();
      ctx.globalAlpha = ba;
      ctx.globalCompositeOperation = 'source-over';
    }
    // Statusfarbe
    let st = null;
    if (e.frozen > 0) st = '#bff3ff';
    else if (e.shock > 0) st = ELEM.light.color;
    else if (e.burns.length) st = ELEM.fire.color;
    else if (e.poisons.length) st = ELEM.chaos.color;
    else if (e.chill > 0) st = ELEM.cold.color;
    const spr = e.boss ? bossSprite(this.cfg.bossId || 'boss', e.color, r) : enemySprite(e.id, e.color, r);
    let img = spr.c;
    if (st) img = tinted(spr, st, e.frozen > 0 ? 0.6 : 0.3);
    const h = spr.h * r * (e.boss ? 1.05 : 1.18);
    let rot = 0, sx = 1, sy = 1;
    const face = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    if (e.boss) rot = this.t * 0.25;
    else if (isDirectional(e.id)) rot = face;
    if (isBlobby(e.id) || e.boss) { const w = Math.sin(this.t * 6 + e.ph) * 0.06; sx = 1 + w; sy = 1 - w; }
    else { const w = Math.abs(Math.sin(this.t * 10 + e.ph)) * 0.05; sx = 1 + w * 0.5; sy = 1 - w; }
    if (e.flash > 0) { sx *= 1.12; sy *= 0.9; }
    ctx.save(); ctx.translate(e.x, e.y);
    ctx.rotate(rot);
    ctx.scale(sx, sy);
    ctx.drawImage(img, -h, -h, h * 2, h * 2);
    if (e.flash > 0) { const ga = ctx.globalAlpha; ctx.globalAlpha = ga * 0.65; ctx.drawImage(spr.flash, -h, -h, h * 2, h * 2); ctx.globalAlpha = ga; }
    ctx.restore();
    if (st && e.burns.length && !e.frozen) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.4 + 0.2 * Math.sin(this.t * 20 + e.ph);
      ctx.drawImage(soft(ELEM.fire.color), e.x - r * 1.3, e.y - r * 1.6, r * 2.6, r * 2.6);
      ctx.globalAlpha = ba; ctx.globalCompositeOperation = 'source-over';
    }
    if (e.shielded) {
      ctx.strokeStyle = rgba('#bfd8ff', 0.8); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, r + 5, 0, TAU); ctx.stroke();
    }
    if (e.refOn > 0 || e.shieldUp) {
      const R2 = e.shieldUp ? r * 2.2 : r + 12;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(this.t * 8);
      ctx.drawImage(soft('#bfe8ff'), e.x - R2, e.y - R2, R2 * 2, R2 * 2);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = rgba('#e8f8ff', 0.8); ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = this.t * 0.8 + (i * TAU) / 6; i ? ctx.lineTo(e.x + Math.cos(a) * R2, e.y + Math.sin(a) * R2) : ctx.moveTo(e.x + Math.cos(a) * R2, e.y + Math.sin(a) * R2); }
      ctx.closePath(); ctx.stroke();
    }
    if (e.mark > 0) {
      const my = e.y - r * 1.55 - 17, ms = 5;
      ctx.strokeStyle = rgba('#c58bff', 0.9); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(e.x, my - ms); ctx.lineTo(e.x + ms, my); ctx.lineTo(e.x, my + ms); ctx.lineTo(e.x - ms, my); ctx.closePath(); ctx.stroke();
    }
    if (e.cs === 'wind' || e.fuse) {
      ctx.strokeStyle = rgba('#ff3b3b', 0.6 + 0.4 * Math.sin(this.t * 25)); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, r + 9, 0, TAU); ctx.stroke();
    }
    // Lebensbalken
    if ((e.elite || e.hp < e.maxHp) && !e.boss) {
      const w = Math.max(18, r * 2.2), y = e.y - r * 1.55 - 8, hh = e.elite ? 4.5 : 3.5;
      ctx.fillStyle = 'rgba(5,2,10,0.75)';
      ctx.beginPath(); ctx.roundRect(e.x - w / 2 - 1.5, y - 1.5, w + 3, hh + 3, 3); ctx.fill();
      ctx.fillStyle = e.nemesis ? '#ff3b3b' : e.elite ? '#ffd84d' : '#ff4d6d';
      ctx.beginPath(); ctx.roundRect(e.x - w / 2, y, Math.max(0.5, (w * Math.max(0, e.hp)) / e.maxHp), hh, 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
