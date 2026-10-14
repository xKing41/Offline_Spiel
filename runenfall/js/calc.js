// Werte-Engine: sammelt Modifikatoren und berechnet Spieler- und Fertigkeitswerte.
//
// Grundformel wie in Path of Exile:
//   Wert = (Basis + flach) × (1 + Σ erhöht) × Π (1 + mehr)
// Gescopte Werte (z. B. dmg_fire) zählen nur, wenn der Schaden bzw. die Fertigkeit den Tag trägt.
import { SKILLS, SUPPORTS, supportFits, catTags } from './data/skills.js';
import { RUNE_TRAITS, traitFits } from './data/systems.js';

/** Anzeigename einer Rune inklusive Merkmalen (z. B. „Glühender Zwillings-Feuerball“). */
export function runeName(inst) {
  const def = inst.def || SKILLS[inst.id];
  const tr = (inst.traits || []).filter((t) => RUNE_TRAITS[t]).map((t) => RUNE_TRAITS[t].name);
  return tr.length ? `${tr.join('-')}-${def.name}` : def.name;
}
import { DMG_TYPES, ELEMENTAL } from './data/stats.js';
import { clamp } from './util.js';

export class ModSet {
  constructor(mods) {
    this.m = new Map();
    if (mods) this.addAll(mods);
  }
  add(mod, mult = 1) {
    let e = this.m.get(mod.s);
    if (!e) { e = { flat: 0, inc: 0, more: 1 }; this.m.set(mod.s, e); }
    const v = mod.v * mult;
    if (mod.t === 'inc') e.inc += v;
    else if (mod.t === 'more') e.more *= Math.max(0, 1 + v / 100);
    else e.flat += v;
    return this;
  }
  addAll(mods, mult = 1) {
    for (const m of mods) this.add(m, mult);
    return this;
  }
}

/**
 * Summiert über mehrere ModSets. keys: Liste von Schlüsseln; skipGlobal: Anzahl Sets (von vorne),
 * in denen der erste Schlüssel ignoriert wird (Begleiter profitieren nicht von allgemeinem "Schaden").
 */
function aggKeys(sets, keys, skipGlobal = 0) {
  let flat = 0, inc = 0, more = 1;
  for (let i = 0; i < sets.length; i++) {
    const m = sets[i].m;
    for (let k = 0; k < keys.length; k++) {
      if (k === 0 && i < skipGlobal) continue;
      const e = m.get(keys[k]);
      if (e) { flat += e.flat; inc += e.inc; more *= e.more; }
    }
  }
  return { flat, inc, more };
}
const scopedKeys = (base, tags) => {
  const keys = [base];
  if (tags) for (const t of tags) keys.push(base + '_' + t);
  return keys;
};
export const statVal = (sets, base, tags, baseVal = 0, skip = 0) => {
  const a = aggKeys(sets, scopedKeys(base, tags), skip);
  return (baseVal + a.flat) * Math.max(0, 1 + a.inc / 100) * a.more;
};
export const mul = (sets, base, tags, skip = 0) => {
  const a = aggKeys(sets, scopedKeys(base, tags), skip);
  return Math.max(0, 1 + a.inc / 100) * a.more;
};
const mulKeys = (sets, keys) => {
  const a = aggKeys(sets, keys);
  return Math.max(0, 1 + a.inc / 100) * a.more;
};
export const flatSum = (sets, key) => {
  let f = 0;
  for (const s of sets) { const e = s.m.get(key); if (e) f += e.flat; }
  return f;
};

// ---------------------------------------------------------------------------
export const BASE_LIFE = 90;
export const LIFE_PER_LVL = 4;

export function computePlayer(sets, runLvl = 1) {
  const has = (k) => flatSum(sets, k) > 0;
  const p = {};
  let life = statVal(sets, 'life', null, BASE_LIFE + runLvl * LIFE_PER_LVL);
  let barrier = statVal(sets, 'barrier', null, 0);
  p.ci = has('spec_ci');
  if (p.ci) { barrier += life * 1.5 * mul(sets, 'barrier'); life = 1; }
  p.maxLife = Math.max(1, Math.round(life));
  p.maxBarrier = Math.max(0, Math.round(barrier));
  p.barrierRate = 0.25 * mul(sets, 'barrierRecharge'); // Anteil der max. Barriere pro Sekunde
  p.armor = Math.max(0, statVal(sets, 'armor', null, 0));
  p.evasion = Math.max(0, statVal(sets, 'evasion', null, 0));
  p.dodge = clamp(flatSum(sets, 'dodge'), 0, 60);
  const resMax = 75 + flatSum(sets, 'resMax');
  p.res = { phys: 0 };
  for (const el of ELEMENTAL) p.res[el] = Math.min(resMax, flatSum(sets, 'res_' + el) + flatSum(sets, 'res_elem'));
  p.res.chaos = Math.min(resMax, flatSum(sets, 'res_chaos'));
  p.regen = has('spec_noRegen') ? 0 : flatSum(sets, 'lifeRegen') + (p.maxLife * flatSum(sets, 'lifeRegenPct')) / 100;
  p.move = 155 * mul(sets, 'move');
  p.magnet = 75 * mul(sets, 'magnet');
  p.xpMult = mul(sets, 'xp');
  p.goldMult = mul(sets, 'gold');
  p.luck = (mul(sets, 'luck') - 1) * 100;
  p.lifeOnKill = flatSum(sets, 'lifeOnKill');
  p.leechMult = has('spec_leechMult') ? flatSum(sets, 'spec_leechMult') : 1;
  p.dmgTaken = mul(sets, 'dmgTaken');
  p.heal = mul(sets, 'heal');
  p.spec = {};
  for (const s of sets) for (const [k, e] of s.m) if (k.startsWith('spec_')) p.spec[k] = (p.spec[k] || 0) + e.flat;
  // Sturmläufer: Blitzschlag skaliert mit deinen Blitz-/Elementar-/Zauber-Boni
  p.moveStrikeDmg = 22 * (1 + 0.12 * (runLvl - 1)) * mul(sets, 'dmg', ['light', 'elem', 'spell']);
  p.critExplodePct = flatSum(sets, 'spec_critExplode');
  return p;
}

// ---------------------------------------------------------------------------
export function skillLevel(inst, sets) {
  const def = inst.def || SKILLS[inst.id];
  let lvl = inst.lvl + flatSum(sets, 'lvl');
  for (const t of def.tags) lvl += flatSum(sets, 'lvl_' + t);
  return Math.max(1, Math.round(lvl));
}

export function computeSkill(inst, gsets) {
  const def = inst.def || SKILLS[inst.id];
  const local = new ModSet();
  for (const sid of inst.sup || []) {
    if (!sid) continue;
    const sd = SUPPORTS[sid];
    if (sd && supportFits(sd, def)) local.addAll(sd.mods);
  }
  for (const tid of inst.traits || []) {
    const t = RUNE_TRAITS[tid];
    if (t && traitFits(t, def)) local.addAll(t.mods);
  }
  const lvl = skillLevel(inst, [...gsets, local]);
  if (lvl >= 3 && def.lvl3) local.addAll(def.lvl3);
  if (lvl >= 5 && def.lvl5) local.addAll(def.lvl5);
  const sets = [...gsets, local];
  const skip = def.tags.includes('minion') ? gsets.length : 0;
  const has = (k) => flatSum(sets, k) > 0;
  const cat = catTags(def);
  const isDot = !def.dmg && !!def.dps;
  const lvlMult = 1 + 0.22 * (lvl - 1);
  const S = { id: inst.id, def, lvl, cat, isDot };

  // --- Grundschaden je Art (inkl. hinzugefügtem Schaden) ---
  const base = {};
  for (const t of DMG_TYPES) {
    let lo = 0, hi = 0;
    if (def.dmg && def.dmg[t]) { lo = def.dmg[t][0] * lvlMult; hi = def.dmg[t][1] * lvlMult; }
    if (def.dps && def.dps[t]) { lo = hi = def.dps[t] * lvlMult; }
    const add = isDot ? 0 : flatSum(sets, 'add_' + t) * (def.eff || 1);
    if (add) { lo += add * 0.8; hi += add * 1.2; }
    if (hi > 0) base[t] = [lo, hi];
  }

  // --- Umwandlung (phys → blitz → kälte → feuer → chaos) ---
  let portions = Object.entries(base).map(([type, [min, max]]) => ({ type, origin: new Set([type]), min, max }));
  for (let i = 0; i < DMG_TYPES.length - 1; i++) {
    const from = DMG_TYPES[i];
    const targets = DMG_TYPES.slice(i + 1).map((to) => [to, flatSum(sets, `conv_${from}_${to}`)]).filter((x) => x[1] > 0);
    const total = targets.reduce((s, x) => s + x[1], 0);
    if (!total) continue;
    const scale = total > 100 ? 100 / total : 1;
    const next = [];
    for (const p of portions) {
      if (p.type !== from) { next.push(p); continue; }
      let keep = 1;
      for (const [to, pct] of targets) {
        const f = (pct * scale) / 100;
        keep -= f;
        next.push({ type: to, origin: new Set([...p.origin, to]), min: p.min * f, max: p.max * f });
      }
      if (keep > 1e-4) next.push({ type: p.type, origin: p.origin, min: p.min * keep, max: p.max * keep });
    }
    portions = next;
  }

  // --- Skalierung je Anteil ---
  const dmg = {};
  for (const p of portions) {
    const tags = [...cat, ...p.origin];
    if ([...p.origin].some((t) => ELEMENTAL.includes(t))) tags.push('elem');
    if (isDot) tags.push('dot');
    const m = mul(sets, 'dmg', tags, skip);
    if (!dmg[p.type]) dmg[p.type] = [0, 0];
    dmg[p.type][0] += p.min * m;
    dmg[p.type][1] += p.max * m;
  }
  for (const t in dmg) if (dmg[t][1] <= 0.001) delete dmg[t];
  S.dmg = dmg;
  S.avgHit = Object.values(dmg).reduce((s, [a, b]) => s + (a + b) / 2, 0);

  // --- Krit ---
  S.noCrit = isDot || has('spec_noCrit');
  S.nthCrit = isDot ? 0 : Math.round(flatSum(sets, 'spec_nthCrit'));
  S.crit = S.noCrit ? 0 : clamp(((def.crit || 5) + flatSum(sets, 'critBase')) * mul(sets, 'crit', cat, skip), 0, 100);
  S.critMulti = 150 + flatSum(sets, 'critMulti');

  // --- Tempo, Fläche, Projektile, Dauer ---
  S.interval = Math.max(0.06, def.cd / mul(sets, 'speed', cat, skip));
  const areaMul = mul(sets, 'area', cat, skip);
  S.area = (def.area || 0) * Math.sqrt(areaMul);
  S.explode = (def.explode || 0) * Math.sqrt(areaMul);
  const usesProj = def.tags.includes('proj') || def.tags.includes('orbit') || ['meteor', 'zone', 'strikes'].includes(def.beh);
  S.count = Math.max(1, (def.count || 1) + (usesProj ? Math.round(flatSum(sets, 'proj')) : 0));
  S.pierce = (def.pierce || 0) + Math.round(flatSum(sets, 'pierce'));
  S.chain = (def.chain || 0) + Math.round(flatSum(sets, 'chain'));
  S.projSpeed = (def.speed || 400) * mul(sets, 'projSpeed', cat, skip);
  S.dur = (def.dur || 0) * mul(sets, 'dur', cat, skip);
  S.minions = def.beh === 'minion' ? Math.max(1, (def.count || 1) + Math.round(flatSum(sets, 'minionCount'))) : 0;
  S.trapMax = def.beh === 'trap' ? (def.max || 5) + Math.round(flatSum(sets, 'spec_trapMax')) : 0;
  S.orbitSpeed = def.beh === 'orbit' ? 2.6 * mul(sets, 'speed', [...cat], skip) : 0;

  // --- Zustände ---
  const noAil = has('spec_noAil') || isDot;
  const onlyPoison = has('spec_onlyPoison');
  const ch = (base, key) => (noAil ? 0 : clamp((base || 0) + flatSum(sets, key), 0, 100));
  S.ign = onlyPoison ? 0 : ch(def.ign, 'igniteChance');
  S.frz = onlyPoison ? 0 : ch(def.frz, 'freezeChance');
  S.shk = onlyPoison ? 0 : ch(def.shk, 'shockChance');
  S.psn = ch(def.psn, 'poisonChance');
  S.bld = onlyPoison ? 0 : ch(def.bld, 'bleedChance');
  S.chill = !noAil && !onlyPoison;
  S.burnMult = mulKeys(sets, ['burn', 'dmg_dot']);
  S.poisonMult = mulKeys(sets, ['poison', 'dmg_dot']);
  S.bleedMult = mulKeys(sets, ['bleed', 'dmg_dot']);
  S.ailDur = mul(sets, 'ailDur');
  S.chillEff = mul(sets, 'chillEffect');
  S.shockEff = mul(sets, 'shockEffect');
  S.burnStack = has('spec_burnStack');

  // --- Bedingter Schaden, Durchdringung, Lebensraub ---
  S.vsLow = mul(sets, 'dmgVsLow');
  S.vsBoss = mul(sets, 'dmgVsBoss');
  S.vsAil = mul(sets, 'dmgVsAilment');
  S.pen = {};
  for (const t of DMG_TYPES) S.pen[t] = flatSum(sets, 'pen') + flatSum(sets, 'pen_' + t);
  S.leech = flatSum(sets, 'leech');
  S.echo = has('spec_echo') || (has('spec_echoAll') && def.tags.includes('spell') && def.beh !== 'aura' && def.beh !== 'minion');
  S.killExplode = flatSum(sets, 'spec_killExplode');
  S.ruthless = flatSum(sets, 'spec_ruthless');
  S.ret = !!def.ret || has('spec_return');
  S.fork = has('spec_fork');
  S.aftershock = has('spec_aftershock');
  S.shatter = has('spec_shatter');
  S.steps = (def.steps || 0) + Math.round(flatSum(sets, 'spec_steps'));
  S.pulse = def.pulse ? { r: def.pulse.r * Math.sqrt(areaMul), rate: def.pulse.rate } : null;
  S.chillAura = !!def.chillAura;

  // --- Schätzung: Schaden pro Sekunde gegen ein Ziel ---
  const critF = S.nthCrit ? 1 + (S.critMulti / 100 - 1) / S.nthCrit : 1 + (S.crit / 100) * (S.critMulti / 100 - 1);
  let perSec = 1 / S.interval;
  if (S.echo) perSec *= 2;
  let mult = 1;
  if (def.beh === 'minion') mult = S.minions;
  if (def.beh === 'meteor' || def.beh === 'strikes') mult = S.count;
  if (def.beh === 'line') mult = 1 + (S.steps - 1) * 0.35;
  if (S.pulse) mult = (S.interval / S.pulse.rate) * 0.5 * S.count;
  if (S.aftershock) mult *= 1.5;
  if (S.ret) mult *= 1.5;
  if (isDot) S.dps = S.avgHit * (def.beh === 'zone' ? Math.min(S.count, S.dur / S.interval) : 1); // dps-Werte sind bereits pro Sekunde
  else S.dps = S.avgHit * critF * perSec * mult;
  return S;
}
