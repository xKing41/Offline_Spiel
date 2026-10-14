// Langzeit-Systeme: Gefährten, Set-Gegenstände, Sternenatlas, Sternenmacht (Paragon), Juwelen.
import { pick, weighted, uid, clamp, makeRng } from '../util.js';
import { BIOMES, MUTATORS } from './content.js';

const inc = (s, v) => ({ s, t: 'inc', v });
const more = (s, v) => ({ s, t: 'more', v });
const flat = (s, v) => ({ s, v });
const r1 = (x) => Math.round(x * 10) / 10;

// ===================================================================== Gefährten
// Jeder Gefährte kämpft mit (als Begleiter) und gibt einen passiven Bonus, der mit der Stufe wächst.
export const PET_MAX = 10;
export const PETS = {
  fox: { name: 'Funkenfuchs', glyph: '🦊', color: '#ff7a2a', ranged: true, dmg: { fire: [5, 9] }, cd: 1.1, tags: ['fire', 'proj'], ign: 15,
    passive: (l) => [inc('dmg_fire', r1(4 + 2 * l))] },
  owl: { name: 'Eiseule', glyph: '🦉', color: '#62d6ff', ranged: true, dmg: { cold: [5, 8] }, cd: 1.2, tags: ['cold', 'proj'], frz: 5,
    passive: (l) => [inc('dmg_cold', r1(4 + 2 * l)), inc('chillEffect', r1(3 * l))] },
  falcon: { name: 'Sturmfalke', glyph: '🦅', color: '#ffe34d', ranged: true, dmg: { light: [2, 12] }, cd: 0.9, tags: ['light', 'proj'], shk: 10,
    passive: (l) => [inc('speed', r1(1 + 0.6 * l))] },
  toad: { name: 'Giftkröte', glyph: '🐸', color: '#9cff5e', ranged: false, dmg: { chaos: [6, 10] }, cd: 1.2, tags: ['chaos', 'melee'], psn: 60,
    passive: (l) => [flat('poisonChance', r1(2 + l)), inc('poison', r1(3 * l))] },
  rock: { name: 'Steinbrocken', glyph: '🪨', color: '#c9a27a', ranged: false, dmg: { phys: [9, 15] }, cd: 1.5, tags: ['phys', 'melee'],
    passive: (l) => [flat('armor', 10 + 8 * l), inc('life', r1(l))] },
  cat: { name: 'Schattenkatze', glyph: '🐈', color: '#b48bff', ranged: false, dmg: { phys: [6, 11] }, cd: 0.8, tags: ['phys', 'melee'],
    passive: (l) => [inc('crit', r1(5 + 3 * l)), flat('critMulti', r1(2 * l))] },
  stag: { name: 'Sternhirsch', glyph: '🦌', color: '#fff6c2', ranged: false, dmg: { light: [6, 12] }, cd: 1.3, tags: ['light', 'melee'],
    passive: (l) => [flat('lifeRegen', r1(0.5 + 0.4 * l)), inc('life', r1(l))] },
  beetle: { name: 'Goldkäfer', glyph: '🪲', color: '#ffd84d', ranged: false, dmg: { phys: [3, 6] }, cd: 1.0, tags: ['phys', 'melee'],
    passive: (l) => [inc('luck', 5 + 4 * l), inc('gold', 5 + 3 * l)] },
  wolf: { name: 'Seelenwolf', glyph: '🐺', color: '#8affd8', ranged: false, dmg: { phys: [8, 13] }, cd: 1.0, tags: ['phys', 'melee'], bld: 40,
    passive: (l) => [inc('dmg_minion', r1(5 + 3 * l))] },
  salamander: { name: 'Glutsalamander', glyph: '🦎', color: '#ff9a5c', ranged: false, dmg: { fire: [7, 12] }, cd: 1.1, tags: ['fire', 'melee'], ign: 40,
    passive: (l) => [inc('burn', r1(5 + 3 * l))] },
  moth: { name: 'Mondmotte', glyph: '🦋', color: '#c9c3ff', ranged: true, dmg: { cold: [3, 7] }, cd: 1.0, tags: ['cold', 'proj'],
    passive: (l) => [inc('xp', r1(2 + 1.2 * l)), inc('magnet', 5 + 3 * l)] },
  phoenix: { name: 'Phönixküken', glyph: '🐦', color: '#ff5c3d', ranged: true, dmg: { fire: [8, 14] }, cd: 1.4, tags: ['fire', 'proj'], ign: 30,
    passive: (l) => [flat('res_fire', 3 + l), inc('life', r1(1 + 0.8 * l)), ...(l >= 10 ? [flat('spec_rebirth', 1)] : [])] },
};
export const PET_IDS = Object.keys(PETS);
export const PET_EGG_COST = 900;

/** Fertigkeits-Definition für den Gefährten im Kampf. */
export function petSkillDef(id) {
  const p = PETS[id];
  return {
    name: p.name, pet: true, tags: ['minion', 'hit', ...p.tags], beh: 'minion', kind: 'pet', petId: id,
    petRanged: p.ranged, color: p.color, glyph: p.glyph,
    cd: p.cd, dmg: p.dmg, crit: 6, eff: 0.6, count: 1, ign: p.ign, frz: p.frz, shk: p.shk, psn: p.psn, bld: p.bld,
    desc: 'Dein Gefährte.', cost: 0,
  };
}

// ===================================================================== Set-Gegenstände
export const SETS = {
  phoenix: {
    name: 'Glut des Phönix', color: '#ff8a3d',
    pieces: [
      { base: 'wand', name: 'Phönixstab', mods: [inc('dmg_fire', 40), flat('add_fire', 8)] },
      { base: 'robe', name: 'Phönixgewand', mods: [flat('barrier', 60), flat('res_fire', 30)] },
      { base: 'diadem', name: 'Phönixkrone', mods: [inc('burn', 40), flat('life', 30)] },
      { base: 'ruby', name: 'Phönixauge', mods: [flat('igniteChance', 20), inc('dmg_spell', 25)] },
    ],
    bonus: { 2: [more('dmg_fire', 20)], 4: [flat('spec_rebirth', 1), more('burn', 40), flat('spec_burnSpread', 1)] },
  },
  legion: {
    name: 'Eiserne Legion', color: '#c9a27a',
    pieces: [
      { base: 'axe', name: 'Legionsbeil', mods: [inc('dmg_melee', 40), flat('add_phys', 10)] },
      { base: 'plate', name: 'Legionspanzer', mods: [flat('armor', 160), flat('life', 40)] },
      { base: 'ironhelm', name: 'Legionshelm', mods: [inc('armor', 40), flat('res_elem', 10)] },
      { base: 'greaves', name: 'Legionsstiefel', mods: [inc('move', 10), flat('life', 30)] },
    ],
    bonus: { 2: [more('armor', 30)], 4: [flat('spec_thorns', 100), more('dmg_melee', 30), more('dmgTaken', -10)] },
  },
  storm: {
    name: 'Sturmwanderer', color: '#ffe34d',
    pieces: [
      { base: 'scepter', name: 'Sturmzepter', mods: [inc('dmg_light', 40), flat('add_light', 10)] },
      { base: 'leather', name: 'Sturmwams', mods: [flat('evasion', 120), flat('res_light', 30)] },
      { base: 'hood', name: 'Sturmkapuze', mods: [flat('shockChance', 20), inc('shockEffect', 30)] },
      { base: 'walkers', name: 'Sturmläufer', mods: [inc('move', 15), inc('speed', 8)] },
    ],
    bonus: { 2: [inc('speed', 15)], 4: [flat('spec_moveStrike', 1), more('dmg_light', 30), flat('chain', 1)] },
  },
  plague: {
    name: 'Seuchenbringer', color: '#9cff5e',
    pieces: [
      { base: 'dagger', name: 'Seuchendolch', mods: [inc('dmg_chaos', 40), flat('add_chaos', 8)] },
      { base: 'chain', name: 'Seuchenhemd', mods: [flat('res_chaos', 35), flat('life', 40)] },
      { base: 'wraps', name: 'Seuchenwickel', mods: [flat('poisonChance', 25), inc('speed_attack', 10)] },
      { base: 'jade', name: 'Seuchenamulett', mods: [inc('poison', 40), inc('dur', 20)] },
    ],
    bonus: { 2: [more('poison', 25)], 4: [flat('spec_poisonVuln', 15), flat('poisonChance', 30), more('dmg_dot', 20)] },
  },
  necro: {
    name: 'Herr der Toten', color: '#c58bff',
    pieces: [
      { base: 'totem', name: 'Totenstab', mods: [inc('dmg_minion', 50), inc('speed_minion', 15)] },
      { base: 'silkgloves', name: 'Totenhände', mods: [inc('dmg_minion', 25), flat('life', 25)] },
      { base: 'chainbelt', name: 'Totengürtel', mods: [flat('barrier', 50), inc('dur', 20)] },
      { base: 'lapis', name: 'Totenamulett', mods: [flat('lvl_minion', 1), flat('res_elem', 10)] },
    ],
    bonus: { 2: [flat('minionCount', 1)], 4: [more('dmg_minion', 40), flat('spec_minionLeech', 3), flat('minionCount', 1)] },
  },
  hunter: {
    name: 'Sternenjäger', color: '#7dffb0',
    pieces: [
      { base: 'bow', name: 'Sternenbogen', mods: [inc('dmg_proj', 40), flat('add_phys', 8)] },
      { base: 'runegloves', name: 'Sternenhandschuhe', mods: [inc('crit', 50), inc('speed_attack', 10)] },
      { base: 'slippers', name: 'Sternenschritte', mods: [inc('move', 12), flat('dodge', 6)] },
      { base: 'leatherbelt', name: 'Sternengurt', mods: [flat('life', 40), flat('critMulti', 25)] },
    ],
    bonus: { 2: [flat('critMulti', 40)], 4: [flat('proj', 2), more('dmg_proj', 25), flat('spec_critChain', 1)] },
  },
};
export const SET_PIECES = Object.entries(SETS).flatMap(([sid, s]) => s.pieces.map((p, i) => `${sid}:${i}`));

// ===================================================================== Sternenatlas
// 30 Regionen auf einem Raster. Abgeschlossene Regionen schalten Nachbarn frei.
// Eine gewählte Region wird nach dem Sieg über Akt III zu Akt IV des Runs.
const PLACES = ['Krater', 'Schlucht', 'Hain', 'Ebene', 'Gipfel', 'Tiefen', 'Ruinen', 'Hallen', 'Ufer', 'Feld', 'Pfad', 'Turm'];
const EPITHETS = ['der Stille', 'des Zorns', 'der Ewigkeit', 'der Asche', 'der Tränen', 'des Wahnsinns', 'der Sterne', 'des Verfalls', 'der Echos', 'der Ketten', 'des Lichts', 'der Schatten', 'des Blutes', 'der Träume', 'der Kälte'];
export const ATLAS_COLS = 6, ATLAS_ROWS = 5;
let atlasCache = null;
export function getAtlas() {
  if (atlasCache) return atlasCache;
  const rng = makeRng(424242);
  const biomes = Object.keys(BIOMES);
  const muts = Object.keys(MUTATORS);
  const regions = {};
  for (let c = 0; c < ATLAS_COLS; c++) {
    for (let r = 0; r < ATLAS_ROWS; r++) {
      const id = `r${c}_${r}`;
      const tier = clamp(1 + Math.round((c * 2.6 + Math.abs(r - 2) * 0.9)), 1, 16);
      const biome = biomes[(c * 3 + r * 2) % biomes.length];
      const nMods = tier < 4 ? 1 : tier < 9 ? 2 : 3;
      const mods = rng.shuffle([...muts]).slice(0, nMods);
      regions[id] = {
        id, c, r, tier, biome, mods, boss: BIOMES[biome].boss,
        name: `${rng.pick(PLACES)} ${rng.pick(EPITHETS)}`,
      };
    }
  }
  // Endbosse ganz rechts
  const pin = [['r5_0', 'fallenstar', 'Krater des Gefallenen Sterns'], ['r5_4', 'weaver', 'Netz der Weberin'], ['r5_2', 'eternal', 'Thron des Ewigen Königs']];
  pin.forEach(([id, boss, name], i) => Object.assign(regions[id], { boss, name, pinnacle: true, tier: [14, 15, 16][i], mods: rng.shuffle([...muts]).slice(0, 3) }));
  const nb = (reg) => {
    const out = [];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `r${reg.c + dc}_${reg.r + dr}`;
      if (regions[k]) out.push(k);
    }
    return out;
  };
  for (const reg of Object.values(regions)) reg.adj = nb(reg);
  atlasCache = { regions };
  return atlasCache;
}
export const atlasPower = (tier) => 10.5 * Math.pow(1.2, tier - 1);

export const ATLAS_PASSIVES = [
  { id: 'aDust', name: 'Sternenernte', desc: '+20% Sternenstaub', cost: 1 },
  { id: 'aXp', name: 'Weitblick', desc: '+20% Konto-Erfahrung', cost: 1 },
  { id: 'aRelic', name: 'Reliquienspur', desc: 'Eliten: +5% Relikt-Chance', cost: 1 },
  { id: 'aJewel', name: 'Juwelenader', desc: 'Eliten: +4% Juwel-Chance, Bosse: +20%', cost: 1 },
  { id: 'aEgg', name: 'Nistplätze', desc: 'Bosse: +10% Chance auf ein Gefährten-Ei', cost: 2 },
  { id: 'aSet', name: 'Wappenkunde', desc: 'Set-Gegenstände fallen doppelt so oft', cost: 2 },
  { id: 'aUnique', name: 'Schatzsucher', desc: 'Einzigartige Gegenstände fallen 50% öfter', cost: 2 },
  { id: 'aPower', name: 'Atlasmacht', desc: 'In Akt IV: 15% mehr Schaden', cost: 2 },
  { id: 'aGuard', name: 'Atlaswacht', desc: 'In Akt IV: 15% mehr Leben', cost: 2 },
  { id: 'aShop', name: 'Händlergilde', desc: 'Händler bieten 2 zusätzliche Waren an', cost: 1 },
  { id: 'aForge', name: 'Meisterschmiede', desc: 'Schmieden kostet 25% weniger', cost: 1 },
  { id: 'aShrine', name: 'Schreinkunde', desc: 'Schreine wirken 3 statt 2 Kämpfe', cost: 1 },
  { id: 'aTreasure', name: 'Schatzkarten', desc: 'Schatzkammern erscheinen doppelt so oft', cost: 1 },
  { id: 'aElite', name: 'Elitenjagd', desc: 'Eliten lassen 50% mehr Gold und Erfahrung fallen', cost: 1 },
  { id: 'aBoss', name: 'Trophäenjagd', desc: 'Akt-IV-Bosse lassen ein zusätzliches Unikat fallen', cost: 3 },
  { id: 'aPoint', name: 'Kartographie', desc: 'Abgeschlossene Regionen geben +1 zusätzlichen Atlaspunkt', cost: 3 },
  { id: 'aProph', name: 'Prophetie', desc: 'Prophezeiungen geben 25% mehr Bonus', cost: 2 },
  { id: 'aStart', name: 'Vorsprung', desc: 'Starte jeden Run mit +2 Stufen', cost: 2 },
  { id: 'aReroll', name: 'Schicksalsweber', desc: '+2 Neu würfeln pro Run', cost: 1 },
  { id: 'aPet', name: 'Gefährtenbund', desc: 'Gefährten verursachen 40% mehr Schaden', cost: 1 },
];

// ===================================================================== Sternenmacht (Paragon)
// Unendliche Stufen. Punkte gibt es ab Kontostufe 20 (alle 2 Stufen einer).
export const PARAGON = [
  { id: 'dmg', name: 'Macht', per: (n) => [inc('dmg', n * 1)], desc: '+1% Schaden' },
  { id: 'life', name: 'Ausdauer', per: (n) => [inc('life', n * 1)], desc: '+1% maximales Leben' },
  { id: 'speed', name: 'Schnelligkeit', per: (n) => [inc('speed', r1(n * 0.5))], desc: '+0,5% Fertigkeitstempo' },
  { id: 'crit', name: 'Schärfe', per: (n) => [inc('crit', n * 2), flat('critMulti', n * 1)], desc: '+2% Krit-Chance, +1% Krit-Multiplikator' },
  { id: 'area', name: 'Weite', per: (n) => [inc('area', r1(n * 0.6))], desc: '+0,6% Wirkungsbereich' },
  { id: 'def', name: 'Bollwerk', per: (n) => [inc('armor', n * 2), inc('evasion', n * 2), inc('barrier', n * 2)], desc: '+2% Rüstung, Ausweichen und Barriere' },
  { id: 'res', name: 'Widerstand', per: (n) => [flat('res_elem', r1(Math.min(30, n * 0.3)))], desc: '+0,3% Elementarwiderstände (max. 30%)' },
  { id: 'dust', name: 'Staubgier', per: (n) => [inc('dust', n * 1)], desc: '+1% Sternenstaub' },
  { id: 'luck', name: 'Fortuna', per: (n) => [inc('luck', r1(n * 1.5))], desc: '+1,5% Gegenstandsseltenheit' },
];
export const paragonPoints = (level) => Math.max(0, Math.floor((level - 20) / 2));

// ===================================================================== Juwelen
export const JEWEL_AFFIXES = [
  { id: 'j_dmg', s: 'dmg', t: 'inc', base: [3, 5] },
  { id: 'j_fire', s: 'dmg_fire', t: 'inc', base: [5, 8] }, { id: 'j_cold', s: 'dmg_cold', t: 'inc', base: [5, 8] },
  { id: 'j_light', s: 'dmg_light', t: 'inc', base: [5, 8] }, { id: 'j_phys', s: 'dmg_phys', t: 'inc', base: [5, 8] },
  { id: 'j_chaos', s: 'dmg_chaos', t: 'inc', base: [5, 8] }, { id: 'j_elem', s: 'dmg_elem', t: 'inc', base: [4, 6] },
  { id: 'j_spell', s: 'dmg_spell', t: 'inc', base: [5, 8] }, { id: 'j_attack', s: 'dmg_attack', t: 'inc', base: [5, 8] },
  { id: 'j_proj', s: 'dmg_proj', t: 'inc', base: [5, 8] }, { id: 'j_area', s: 'dmg_area', t: 'inc', base: [5, 8] },
  { id: 'j_melee', s: 'dmg_melee', t: 'inc', base: [5, 8] }, { id: 'j_minion', s: 'dmg_minion', t: 'inc', base: [6, 9] },
  { id: 'j_dot', s: 'dmg_dot', t: 'inc', base: [6, 9] }, { id: 'j_trap', s: 'dmg_trap', t: 'inc', base: [6, 9] },
  { id: 'j_aura', s: 'dmg_aura', t: 'inc', base: [6, 9] }, { id: 'j_orbit', s: 'dmg_orbit', t: 'inc', base: [6, 9] },
  { id: 'j_speed', s: 'speed', t: 'inc', base: [2, 3] }, { id: 'j_crit', s: 'crit', t: 'inc', base: [7, 11] },
  { id: 'j_critm', s: 'critMulti', base: [5, 8] }, { id: 'j_life', s: 'life', t: 'inc', base: [3, 5] },
  { id: 'j_armor', s: 'armor', t: 'inc', base: [6, 10] }, { id: 'j_eva', s: 'evasion', t: 'inc', base: [6, 10] },
  { id: 'j_barrier', s: 'barrier', t: 'inc', base: [6, 10] }, { id: 'j_res', s: 'res_elem', base: [3, 5] },
  { id: 'j_area2', s: 'area', t: 'inc', base: [3, 5] }, { id: 'j_dur', s: 'dur', t: 'inc', base: [4, 7] },
  { id: 'j_burn', s: 'burn', t: 'inc', base: [7, 11] }, { id: 'j_poison', s: 'poison', t: 'inc', base: [7, 11] },
  { id: 'j_bleed', s: 'bleed', t: 'inc', base: [7, 11] }, { id: 'j_boss', s: 'dmgVsBoss', t: 'inc', base: [5, 8] },
  { id: 'j_move', s: 'move', t: 'inc', base: [2, 3] }, { id: 'j_regen', s: 'lifeRegen', base: [0.5, 1] },
];
export const JEWEL_SPECIALS = [
  [flat('lvl', 1)], [flat('proj', 1)], [flat('minionCount', 1)], [flat('pierce', 2)], [flat('chain', 1)],
  [flat('spec_trapMax', 2)], [more('dmg', 10)], [flat('critBase', 1.5)], [flat('dodge', 5)], [flat('resMax', 2)],
];
export const JEWEL_TIERS = 8;
export const JEWEL_AFFIX = Object.fromEntries(JEWEL_AFFIXES.map((a) => [a.id, a]));
export const jewelTierRange = (a, tier) => {
  const f = 1 + 0.38 * tier;
  return [r1(a.base[0] * f), r1(a.base[1] * f)];
};
export function makeJewel(level, luck = 0) {
  const l = 1 + luck / 100;
  const rarity = weighted([{ r: 'magic', w: 55 }, { r: 'rare', w: 32 * l }, { r: 'legend', w: 10 * l }, { r: 'mythic', w: 2.5 * l }]).r;
  const n = { magic: 2, rare: 3, legend: 4, mythic: 4 }[rarity];
  const maxTier = clamp(Math.floor(level / 12), 0, JEWEL_TIERS - 1);
  const pool = [...JEWEL_AFFIXES];
  const jewel = { uid: uid(), slot: 'jewel', base: 'jewel', rarity, ilvl: level, affixes: [], special: null };
  for (let i = 0; i < n && pool.length; i++) {
    const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const tier = Math.max(0, maxTier - Math.floor(Math.pow(Math.random(), 1.4) * Math.min(3, maxTier + 1)));
    const [lo, hi] = jewelTierRange(a, tier);
    jewel.affixes.push({ id: a.id, tier, v: r1(lo + Math.random() * (hi - lo)) });
  }
  if (rarity === 'mythic') jewel.special = Math.floor(Math.random() * JEWEL_SPECIALS.length);
  jewel.title = `${pick(['Funkelndes', 'Uraltes', 'Glühendes', 'Kaltes', 'Leuchtendes', 'Dunkles', 'Prismatisches', 'Flüsterndes'])} ${pick(['Sternjuwel', 'Runenjuwel', 'Nebeljuwel', 'Kristalljuwel'])}`;
  return jewel;
}
export function jewelMods(j) {
  const out = j.affixes.map((af) => { const d = JEWEL_AFFIX[af.id]; return { s: d.s, t: d.t, v: af.v }; });
  if (j.special !== null && j.special !== undefined) out.push(...JEWEL_SPECIALS[j.special]);
  return out;
}
