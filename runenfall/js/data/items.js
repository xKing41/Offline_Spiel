// Gegenstände: Basen, Affixe mit Stufen, Unikate, Relikte (dauerhafte Meta-Beute).
import { pick, weighted, uid, clamp } from '../util.js';
import { modText } from './stats.js';
import { SETS, JEWEL_AFFIX, jewelMods } from './endgame.js';
import { MYTHIC_EFFECTS, mythicTitle } from './systems.js';

export const SLOTS = ['weapon', 'armor', 'helm', 'gloves', 'boots', 'belt', 'amulet', 'ring'];
export const SLOT_NAME = {
  weapon: 'Waffe', armor: 'Rüstung', helm: 'Helm', gloves: 'Handschuhe', belt: 'Gürtel', boots: 'Stiefel', jewel: 'Juwel', amulet: 'Amulett', ring: 'Ring', relic: 'Relikt',
};
export const RARITY = {
  normal: { name: 'Normal', color: '#c9c3b5' },
  magic: { name: 'Magisch', color: '#7aa8ff' },
  rare: { name: 'Selten', color: '#ffd84d' },
  unique: { name: 'Einzigartig', color: '#ff8a3d' },
  set: { name: 'Set', color: '#5cff8a' },
  legend: { name: 'Legendär', color: '#d77bff' },
  mythic: { name: 'Mythisch', color: '#ff4d7e' },
};

// g = grammatisches Geschlecht (für "Lodernder Zauberstab" / "Lodernde Robe" / "Lodernes Amulett")
export const BASES = {
  wand: { slot: 'weapon', name: 'Zauberstab', g: 'm', imp: [{ s: 'dmg_spell', t: 'inc', v: 20 }] },
  bow: { slot: 'weapon', name: 'Kriegsbogen', g: 'm', imp: [{ s: 'dmg_proj', t: 'inc', v: 18 }] },
  axe: { slot: 'weapon', name: 'Streitaxt', g: 'f', imp: [{ s: 'dmg_melee', t: 'inc', v: 15 }, { s: 'add_phys', v: 3 }] },
  dagger: { slot: 'weapon', name: 'Ritualdolch', g: 'm', imp: [{ s: 'crit', t: 'inc', v: 30 }] },
  totem: { slot: 'weapon', name: 'Totemstab', g: 'm', imp: [{ s: 'dmg_minion', t: 'inc', v: 22 }] },
  scepter: { slot: 'weapon', name: 'Runenszepter', g: 'n', imp: [{ s: 'dmg_elem', t: 'inc', v: 16 }] },
  plate: { slot: 'armor', name: 'Plattenpanzer', g: 'm', imp: [{ s: 'armor', v: 40 }] },
  leather: { slot: 'armor', name: 'Lederwams', g: 'n', imp: [{ s: 'evasion', v: 40 }] },
  robe: { slot: 'armor', name: 'Seidenrobe', g: 'f', imp: [{ s: 'barrier', v: 22 }] },
  chain: { slot: 'armor', name: 'Kettenhemd', g: 'n', imp: [{ s: 'armor', v: 20 }, { s: 'life', v: 15 }] },
  ironhelm: { slot: 'helm', name: 'Eisenhelm', g: 'm', imp: [{ s: 'life', v: 15 }] },
  hood: { slot: 'helm', name: 'Kapuze', g: 'f', imp: [{ s: 'evasion', v: 25 }] },
  diadem: { slot: 'helm', name: 'Diadem', g: 'n', imp: [{ s: 'barrier', v: 15 }] },
  walkers: { slot: 'boots', name: 'Wanderstiefel', g: 'p', imp: [{ s: 'move', t: 'inc', v: 10 }] },
  greaves: { slot: 'boots', name: 'Panzerstiefel', g: 'p', imp: [{ s: 'move', t: 'inc', v: 6 }, { s: 'armor', v: 20 }] },
  slippers: { slot: 'boots', name: 'Schleichschuhe', g: 'p', imp: [{ s: 'move', t: 'inc', v: 8 }, { s: 'evasion', v: 15 }] },
  amber: { slot: 'amulet', name: 'Bernsteinamulett', g: 'n', imp: [{ s: 'life', v: 15 }] },
  jade: { slot: 'amulet', name: 'Jadeamulett', g: 'n', imp: [{ s: 'dmg', t: 'inc', v: 10 }] },
  lapis: { slot: 'amulet', name: 'Lapisamulett', g: 'n', imp: [{ s: 'speed', t: 'inc', v: 8 }] },
  ruby: { slot: 'ring', name: 'Rubinring', g: 'm', imp: [{ s: 'res_fire', v: 12 }] },
  sapphire: { slot: 'ring', name: 'Saphirring', g: 'm', imp: [{ s: 'res_cold', v: 12 }] },
  topaz: { slot: 'ring', name: 'Topasring', g: 'm', imp: [{ s: 'res_light', v: 12 }] },
  goldring: { slot: 'ring', name: 'Goldring', g: 'm', imp: [{ s: 'luck', t: 'inc', v: 15 }] },
  ironring: { slot: 'ring', name: 'Eisenring', g: 'm', imp: [{ s: 'add_phys', v: 2 }] },
  gauntlets: { slot: 'gloves', name: 'Panzerhandschuhe', g: 'p', imp: [{ s: 'armor', v: 15 }, { s: 'dmg_attack', t: 'inc', v: 8 }] },
  wraps: { slot: 'gloves', name: 'Lederwickel', g: 'p', imp: [{ s: 'speed_attack', t: 'inc', v: 8 }] },
  silkgloves: { slot: 'gloves', name: 'Seidenhandschuhe', g: 'p', imp: [{ s: 'speed_spell', t: 'inc', v: 8 }] },
  runegloves: { slot: 'gloves', name: 'Runenhandschuhe', g: 'p', imp: [{ s: 'crit', t: 'inc', v: 15 }] },
  leatherbelt: { slot: 'belt', name: 'Ledergürtel', g: 'm', imp: [{ s: 'life', v: 20 }] },
  heavybelt: { slot: 'belt', name: 'Schwerer Gurt', g: 'm', imp: [{ s: 'armor', v: 25 }, { s: 'life', v: 10 }] },
  chainbelt: { slot: 'belt', name: 'Kettengürtel', g: 'm', imp: [{ s: 'barrier', v: 15 }] },
  sash: { slot: 'belt', name: 'Seidenschärpe', g: 'f', imp: [{ s: 'dur', t: 'inc', v: 10 }] },
  shard: { slot: 'relic', name: 'Sternensplitter', g: 'm', imp: [] },
  jewel: { slot: 'jewel', name: 'Juwel', g: 'n', imp: [] },
};

// Ab welcher Gegenstandsstufe welche Affix-Stufe (Tier) möglich ist.
export const TIER_ILVL = [1, 8, 18, 30, 44, 58, 72, 86];

function tiers(lo, hi, n, g) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = Math.pow(g, i);
    const r = (x) => (x * f >= 10 ? Math.round(x * f) : Math.round(x * f * 10) / 10);
    out.push([r(lo), r(hi)]);
  }
  return out;
}

const W = ['weapon'];
const WA = ['weapon', 'amulet', 'gloves'];
const WAR = ['weapon', 'amulet', 'ring', 'gloves'];
const DEF = ['armor', 'helm', 'boots', 'gloves', 'belt'];
const DEFJ = ['armor', 'helm', 'boots', 'gloves', 'belt', 'amulet', 'ring'];

// pn = Adjektiv-Stamm für Präfixe, sn = Namenszusatz für Suffixe
export const AFFIXES = [
  // ---------- Präfixe ----------
  { id: 'life', k: 'pre', s: 'life', tiers: tiers(8, 14, 8, 1.38), slots: DEFJ, pn: 'Robust' },
  { id: 'lifeInc', k: 'pre', s: 'life', t: 'inc', tiers: tiers(4, 7, 6, 1.25), slots: ['armor', 'helm', 'amulet'], pn: 'Vital' },
  { id: 'dmg', k: 'pre', s: 'dmg', t: 'inc', tiers: tiers(5, 9, 7, 1.3), slots: WAR, pn: 'Wütend' },
  { id: 'dmgFire', k: 'pre', s: 'dmg_fire', t: 'inc', tiers: tiers(8, 14, 7, 1.3), slots: WAR, pn: 'Lodernd' },
  { id: 'dmgCold', k: 'pre', s: 'dmg_cold', t: 'inc', tiers: tiers(8, 14, 7, 1.3), slots: WAR, pn: 'Eisig' },
  { id: 'dmgLight', k: 'pre', s: 'dmg_light', t: 'inc', tiers: tiers(8, 14, 7, 1.3), slots: WAR, pn: 'Knisternd' },
  { id: 'dmgPhys', k: 'pre', s: 'dmg_phys', t: 'inc', tiers: tiers(8, 14, 7, 1.3), slots: WAR, pn: 'Grausam' },
  { id: 'dmgChaos', k: 'pre', s: 'dmg_chaos', t: 'inc', tiers: tiers(8, 14, 7, 1.3), slots: WAR, pn: 'Verderbt' },
  { id: 'dmgSpell', k: 'pre', s: 'dmg_spell', t: 'inc', tiers: tiers(9, 15, 7, 1.3), slots: WA, pn: 'Arkan' },
  { id: 'dmgAttack', k: 'pre', s: 'dmg_attack', t: 'inc', tiers: tiers(9, 15, 7, 1.3), slots: WA, pn: 'Kriegerisch' },
  { id: 'dmgProj', k: 'pre', s: 'dmg_proj', t: 'inc', tiers: tiers(9, 15, 7, 1.3), slots: [...WA, 'helm'], pn: 'Zielend' },
  { id: 'dmgArea', k: 'pre', s: 'dmg_area', t: 'inc', tiers: tiers(9, 15, 7, 1.3), slots: [...WA, 'helm'], pn: 'Bebend' },
  { id: 'dmgMelee', k: 'pre', s: 'dmg_melee', t: 'inc', tiers: tiers(9, 15, 7, 1.3), slots: WA, pn: 'Wuchtig' },
  { id: 'dmgMinion', k: 'pre', s: 'dmg_minion', t: 'inc', tiers: tiers(10, 16, 7, 1.3), slots: [...WA, 'helm'], pn: 'Gebietend' },
  { id: 'dmgDot', k: 'pre', s: 'dmg_dot', t: 'inc', tiers: tiers(10, 16, 7, 1.3), slots: WA, pn: 'Zersetzend' },
  { id: 'addFire', k: 'pre', s: 'add_fire', tiers: tiers(2, 4, 8, 1.48), slots: ['weapon', 'ring', 'amulet'], pn: 'Glühend' },
  { id: 'addCold', k: 'pre', s: 'add_cold', tiers: tiers(2, 4, 8, 1.48), slots: ['weapon', 'ring', 'amulet'], pn: 'Frostig' },
  { id: 'addLight', k: 'pre', s: 'add_light', tiers: tiers(1, 5, 8, 1.48), slots: ['weapon', 'ring', 'amulet'], pn: 'Funkelnd' },
  { id: 'addPhys', k: 'pre', s: 'add_phys', tiers: tiers(2, 4, 8, 1.45), slots: ['weapon', 'ring'], pn: 'Scharf' },
  { id: 'addChaos', k: 'pre', s: 'add_chaos', tiers: tiers(2, 3, 8, 1.45), slots: ['weapon', 'ring'], pn: 'Giftig' },
  { id: 'armor', k: 'pre', s: 'armor', tiers: tiers(12, 22, 8, 1.4), slots: DEF, pn: 'Gepanzert' },
  { id: 'armorInc', k: 'pre', s: 'armor', t: 'inc', tiers: tiers(10, 18, 6, 1.3), slots: DEF, pn: 'Stählern' },
  { id: 'evasion', k: 'pre', s: 'evasion', tiers: tiers(12, 22, 8, 1.4), slots: DEF, pn: 'Flink' },
  { id: 'evasionInc', k: 'pre', s: 'evasion', t: 'inc', tiers: tiers(10, 18, 6, 1.3), slots: DEF, pn: 'Schattenhaft' },
  { id: 'barrier', k: 'pre', s: 'barrier', tiers: tiers(8, 14, 8, 1.38), slots: ['armor', 'helm', 'amulet'], pn: 'Schimmernd' },
  { id: 'barrierInc', k: 'pre', s: 'barrier', t: 'inc', tiers: tiers(10, 18, 6, 1.3), slots: ['armor', 'helm'], pn: 'Strahlend' },
  { id: 'speed', k: 'pre', s: 'speed', t: 'inc', tiers: tiers(3, 5, 6, 1.25), slots: ['weapon', 'amulet', 'ring', 'helm'], pn: 'Hastig' },
  // ---------- Suffixe ----------
  { id: 'resFire', k: 'suf', s: 'res_fire', tiers: tiers(6, 10, 7, 1.2), slots: DEFJ, sn: 'der Glut' },
  { id: 'resCold', k: 'suf', s: 'res_cold', tiers: tiers(6, 10, 7, 1.2), slots: DEFJ, sn: 'des Winters' },
  { id: 'resLight', k: 'suf', s: 'res_light', tiers: tiers(6, 10, 7, 1.2), slots: DEFJ, sn: 'des Sturms' },
  { id: 'resChaos', k: 'suf', s: 'res_chaos', tiers: tiers(5, 8, 5, 1.25), slots: DEFJ, sn: 'der Leere' },
  { id: 'resElem', k: 'suf', s: 'res_elem', tiers: tiers(3, 5, 5, 1.25), slots: ['ring', 'amulet'], sn: 'des Prismas' },
  { id: 'crit', k: 'suf', s: 'crit', t: 'inc', tiers: tiers(10, 16, 6, 1.25), slots: ['weapon', 'amulet', 'ring', 'helm'], sn: 'der Präzision' },
  { id: 'critMulti', k: 'suf', s: 'critMulti', tiers: tiers(8, 12, 6, 1.25), slots: WA, sn: 'des Henkers' },
  { id: 'area', k: 'suf', s: 'area', t: 'inc', tiers: tiers(6, 10, 6, 1.22), slots: ['weapon', 'amulet', 'helm'], sn: 'der Weite' },
  { id: 'dur', k: 'suf', s: 'dur', t: 'inc', tiers: tiers(6, 10, 6, 1.22), slots: ['weapon', 'amulet', 'helm'], sn: 'der Ewigkeit' },
  { id: 'projSpeed', k: 'suf', s: 'projSpeed', t: 'inc', tiers: tiers(8, 14, 5, 1.25), slots: ['weapon', 'boots'], sn: 'des Windes' },
  { id: 'move', k: 'suf', s: 'move', t: 'inc', tiers: tiers(4, 6, 5, 1.25), slots: ['boots'], sn: 'des Wanderers' },
  { id: 'regen', k: 'suf', s: 'lifeRegen', tiers: tiers(0.5, 1, 6, 1.55), slots: ['armor', 'helm', 'ring', 'amulet'], sn: 'der Erneuerung' },
  { id: 'leech', k: 'suf', s: 'leech', tiers: tiers(0.2, 0.4, 5, 1.3), slots: ['weapon', 'ring'], sn: 'des Vampirs' },
  { id: 'lifeOnKill', k: 'suf', s: 'lifeOnKill', tiers: tiers(1, 3, 6, 1.4), slots: ['weapon', 'ring'], sn: 'des Schlachters' },
  { id: 'magnet', k: 'suf', s: 'magnet', t: 'inc', tiers: tiers(10, 20, 4, 1.3), slots: ['boots', 'ring'], sn: 'des Sammlers' },
  { id: 'xp', k: 'suf', s: 'xp', t: 'inc', tiers: tiers(3, 6, 4, 1.3), slots: ['helm', 'amulet'], sn: 'der Weisheit' },
  { id: 'luck', k: 'suf', s: 'luck', t: 'inc', tiers: tiers(6, 12, 5, 1.3), slots: ['helm', 'amulet', 'ring', 'boots'], sn: 'des Glücks' },
  { id: 'ignC', k: 'suf', s: 'igniteChance', tiers: tiers(5, 10, 4, 1.3), slots: ['weapon', 'ring'], sn: 'der Flammen' },
  { id: 'frzC', k: 'suf', s: 'freezeChance', tiers: tiers(3, 6, 4, 1.3), slots: ['weapon', 'ring'], sn: 'des Frostes' },
  { id: 'shkC', k: 'suf', s: 'shockChance', tiers: tiers(5, 10, 4, 1.3), slots: ['weapon', 'ring'], sn: 'der Spannung' },
  { id: 'psnC', k: 'suf', s: 'poisonChance', tiers: tiers(6, 12, 4, 1.3), slots: ['weapon', 'ring'], sn: 'der Natter' },
  { id: 'bldC', k: 'suf', s: 'bleedChance', tiers: tiers(6, 12, 4, 1.3), slots: ['weapon', 'ring'], sn: 'der Klinge' },
  { id: 'burn', k: 'suf', s: 'burn', t: 'inc', tiers: tiers(10, 18, 5, 1.3), slots: WA, sn: 'des Brandes' },
  { id: 'poison', k: 'suf', s: 'poison', t: 'inc', tiers: tiers(10, 18, 5, 1.3), slots: WA, sn: 'der Fäulnis' },
  { id: 'bleed', k: 'suf', s: 'bleed', t: 'inc', tiers: tiers(10, 18, 5, 1.3), slots: WA, sn: 'des Blutes' },
  { id: 'pen', k: 'suf', s: 'pen', tiers: tiers(2, 4, 5, 1.3), slots: W, sn: 'der Durchdringung', min: 15 },
  { id: 'pierce', k: 'suf', s: 'pierce', tiers: [[1, 1]], slots: W, sn: 'der Durchbohrung', min: 25, w: 30 },
  { id: 'chain', k: 'suf', s: 'chain', tiers: [[1, 1]], slots: W, sn: 'der Verkettung', min: 35, w: 25 },
  { id: 'proj', k: 'suf', s: 'proj', tiers: [[1, 1]], slots: ['weapon', 'helm'], sn: 'der Vielfalt', min: 40, w: 15 },
  { id: 'minions', k: 'suf', s: 'minionCount', tiers: [[1, 1]], slots: ['weapon', 'amulet'], sn: 'des Gebieters', min: 40, w: 20 },
  { id: 'lvlFire', k: 'suf', s: 'lvl_fire', tiers: [[1, 1]], slots: WA, sn: 'des Feuerfürsten', min: 50, w: 12 },
  { id: 'lvlCold', k: 'suf', s: 'lvl_cold', tiers: [[1, 1]], slots: WA, sn: 'der Eiskönigin', min: 50, w: 12 },
  { id: 'lvlLight', k: 'suf', s: 'lvl_light', tiers: [[1, 1]], slots: WA, sn: 'des Donnerers', min: 50, w: 12 },
  { id: 'lvlPhys', k: 'suf', s: 'lvl_phys', tiers: [[1, 1]], slots: WA, sn: 'des Schlächters', min: 50, w: 12 },
  { id: 'lvlChaos', k: 'suf', s: 'lvl_chaos', tiers: [[1, 1]], slots: WA, sn: 'der Seuche', min: 50, w: 12 },
  { id: 'lvlAll', k: 'suf', s: 'lvl', tiers: [[1, 1]], slots: ['amulet'], sn: 'des Erzmagiers', min: 70, w: 8 },
  { id: 'atkSpd', k: 'pre', s: 'speed_attack', t: 'inc', tiers: tiers(4, 7, 6, 1.25), slots: ['gloves', 'weapon', 'ring'], pn: 'Flink' },
  { id: 'castSpd', k: 'pre', s: 'speed_spell', t: 'inc', tiers: tiers(4, 7, 6, 1.25), slots: ['gloves', 'weapon', 'amulet'], pn: 'Beredt' },
  { id: 'dmgTrap', k: 'pre', s: 'dmg_trap', t: 'inc', tiers: tiers(10, 16, 7, 1.3), slots: [...WA, 'belt'], pn: 'Tückisch' },
  { id: 'dmgAura', k: 'pre', s: 'dmg_aura', t: 'inc', tiers: tiers(10, 16, 7, 1.3), slots: [...WA, 'belt'], pn: 'Strahlend' },
  { id: 'dmgOrbit', k: 'pre', s: 'dmg_orbit', t: 'inc', tiers: tiers(10, 16, 7, 1.3), slots: [...WA, 'belt'], pn: 'Wirbelnd' },
  { id: 'dmgElem', k: 'pre', s: 'dmg_elem', t: 'inc', tiers: tiers(7, 12, 7, 1.3), slots: [...WAR, 'belt'], pn: 'Prismatisch' },
  { id: 'lifeBelt', k: 'pre', s: 'life', t: 'inc', tiers: tiers(5, 8, 6, 1.25), slots: ['belt'], pn: 'Kräftig' },
  { id: 'vsBoss', k: 'suf', s: 'dmgVsBoss', t: 'inc', tiers: tiers(8, 14, 6, 1.25), slots: ['gloves', 'weapon', 'belt'], sn: 'des Jägers' },
  { id: 'vsLow', k: 'suf', s: 'dmgVsLow', t: 'inc', tiers: tiers(10, 18, 6, 1.25), slots: ['gloves', 'weapon'], sn: 'des Henkers' },
  { id: 'ailDur', k: 'suf', s: 'ailDur', t: 'inc', tiers: tiers(6, 12, 5, 1.25), slots: ['gloves', 'belt', 'amulet'], sn: 'der Qual' },
  { id: 'minSpd', k: 'suf', s: 'speed_minion', t: 'inc', tiers: tiers(5, 9, 5, 1.25), slots: ['gloves', 'helm', 'amulet'], sn: 'des Befehls' },
  { id: 'dodge', k: 'suf', s: 'dodge', tiers: tiers(2, 3, 4, 1.25), slots: ['boots', 'belt'], sn: 'des Phantoms', min: 30, w: 30 },
  { id: 'resMax', k: 'suf', s: 'resMax', tiers: [[1, 1], [2, 2], [3, 3]], slots: ['armor', 'belt'], sn: 'der Festung', min: 55, w: 15 },
  { id: 'lvlMinion', k: 'suf', s: 'lvl_minion', tiers: [[1, 1]], slots: ['helm', 'weapon'], sn: 'des Totenbeschwörers', min: 50, w: 12 },
  { id: 'lvlTrap', k: 'suf', s: 'lvl_trap', tiers: [[1, 1]], slots: ['gloves', 'weapon'], sn: 'des Fallenmeisters', min: 50, w: 12 },
];
export const AFFIX = Object.fromEntries(AFFIXES.map((a) => [a.id, a]));

// ---------- Relikte: dauerhafte Ausrüstung über alle Runs ----------
// Bis zu 10 Stufen je Affix; höhere Stufen gibt es durch höhere Sternenhöhe und Veredeln.
export const RELIC_TIERS = 10;
export const RELIC_AFFIXES = [
  { id: 'r_dmg', s: 'dmg', t: 'inc', base: [2, 4] },
  { id: 'r_life', s: 'life', t: 'inc', base: [2, 4] },
  { id: 'r_speed', s: 'speed', t: 'inc', base: [1, 2] },
  { id: 'r_crit', s: 'crit', t: 'inc', base: [4, 7] },
  { id: 'r_critMulti', s: 'critMulti', base: [3, 5] },
  { id: 'r_area', s: 'area', t: 'inc', base: [2, 4] },
  { id: 'r_dur', s: 'dur', t: 'inc', base: [3, 5] },
  { id: 'r_res', s: 'res_elem', base: [2, 3] },
  { id: 'r_move', s: 'move', t: 'inc', base: [1, 2] },
  { id: 'r_armor', s: 'armor', t: 'inc', base: [4, 7] },
  { id: 'r_eva', s: 'evasion', t: 'inc', base: [4, 7] },
  { id: 'r_barrier', s: 'barrier', t: 'inc', base: [4, 7] },
  { id: 'r_regen', s: 'lifeRegen', base: [0.3, 0.6] },
  { id: 'r_fire', s: 'dmg_fire', t: 'inc', base: [3, 6] },
  { id: 'r_cold', s: 'dmg_cold', t: 'inc', base: [3, 6] },
  { id: 'r_light', s: 'dmg_light', t: 'inc', base: [3, 6] },
  { id: 'r_phys', s: 'dmg_phys', t: 'inc', base: [3, 6] },
  { id: 'r_chaos', s: 'dmg_chaos', t: 'inc', base: [3, 6] },
  { id: 'r_spell', s: 'dmg_spell', t: 'inc', base: [3, 6] },
  { id: 'r_attack', s: 'dmg_attack', t: 'inc', base: [3, 6] },
  { id: 'r_minion', s: 'dmg_minion', t: 'inc', base: [3, 6] },
  { id: 'r_dot', s: 'dmg_dot', t: 'inc', base: [3, 6] },
  { id: 'r_dust', s: 'dust', t: 'inc', base: [3, 6] },
  { id: 'r_axp', s: 'axp', t: 'inc', base: [3, 6] },
  { id: 'r_luck', s: 'luck', t: 'inc', base: [4, 8] },
  { id: 'r_gold', s: 'startGold', base: [8, 15] },
  { id: 'r_xp', s: 'xp', t: 'inc', base: [2, 4] },
];
export const RELIC_AFFIX = Object.fromEntries(RELIC_AFFIXES.map((a) => [a.id, a]));
export const relicTierRange = (a, tier) => {
  const f = 1 + 0.42 * tier;
  const r = (x) => (x * f >= 10 ? Math.round(x * f) : Math.round(x * f * 10) / 10);
  return [r(a.base[0]), r(a.base[1])];
};

// ---------- Unikate ----------
export const UNIQUES = {
  vulcan: {
    base: 'jade', name: 'Herz des Vulkans',
    mods: [{ s: 'dmg_fire', t: 'inc', v: 30 }, { s: 'igniteChance', v: 15 }, { s: 'spec_burnSpread', v: 1 }],
    flavor: 'Es schlägt noch immer – heiß und ungeduldig.',
  },
  shardcrown: {
    base: 'diadem', name: 'Krone der tausend Splitter',
    mods: [{ s: 'proj', v: 2 }, { s: 'projSpeed', t: 'inc', v: -20 }, { s: 'life', v: 30 }],
    flavor: 'Jeder Splitter ein gefallener Stern.',
  },
  stormwalk: {
    base: 'walkers', name: 'Sturmläufer',
    mods: [{ s: 'move', t: 'inc', v: 20 }, { s: 'spec_moveStrike', v: 1 }, { s: 'dmg_light', t: 'inc', v: 20 }],
    flavor: 'Wo du gehst, folgt der Donner.',
  },
  bloodpact: {
    base: 'ironring', name: 'Blutschwur',
    mods: [{ s: 'leech', v: 3 }, { s: 'spec_noRegen', v: 1 }, { s: 'dmg_phys', t: 'inc', v: 25 }],
    flavor: 'Nimm, was du brauchst. Gib nichts zurück.',
  },
  winter: {
    base: 'plate', name: 'Ewiger Winter',
    mods: [{ s: 'spec_chillAura', v: 1 }, { s: 'armor', v: 80 }, { s: 'res_cold', v: 30 }],
    flavor: 'Der Frost kennt keinen Frühling.',
  },
  starbreaker: {
    base: 'scepter', name: 'Sternenbrecher',
    mods: [{ s: 'spec_critExplode', v: 40 }, { s: 'critBase', v: 3 }, { s: 'critMulti', v: 40 }],
    flavor: 'Was einmal bricht, bricht für immer.',
  },
  soulcatcher: {
    base: 'totem', name: 'Seelenfänger',
    mods: [{ s: 'minionCount', v: 2 }, { s: 'dmg_minion', t: 'inc', v: 40 }, { s: 'life', t: 'inc', v: -20 }],
    flavor: 'Sie folgen dir – ob sie wollen oder nicht.',
  },
  glassblade: {
    base: 'dagger', name: 'Glasklinge',
    mods: [{ s: 'add_phys', v: 18 }, { s: 'crit', t: 'inc', v: 60 }, { s: 'dmgTaken', t: 'more', v: 25 }],
    flavor: 'Schön, scharf und zerbrechlich – wie du.',
  },
  plaguebringer: {
    base: 'amber', name: 'Pestbringer',
    mods: [{ s: 'poisonChance', v: 30 }, { s: 'poison', t: 'inc', v: 40 }, { s: 'spec_poisonVuln', v: 12 }],
    flavor: 'Die Seuche ist geduldig.',
  },
  stormeye: {
    base: 'topaz', name: 'Auge des Sturms',
    mods: [{ s: 'shockChance', v: 25 }, { s: 'spec_shockSpread', v: 1 }, { s: 'res_light', v: 25 }],
    flavor: 'In seiner Mitte herrscht Stille.',
  },
  wastecloak: {
    base: 'robe', name: 'Mantel der Ödnis',
    mods: [{ s: 'barrier', t: 'inc', v: 100 }, { s: 'barrierRecharge', t: 'inc', v: 50 }, { s: 'life', t: 'inc', v: -30 }],
    flavor: 'Nichts dringt hindurch. Auch keine Wärme.',
  },
  eternity: {
    base: 'hood', name: 'Fluch der Ewigkeit',
    mods: [{ s: 'dur', t: 'inc', v: 60 }, { s: 'dmg_dot', t: 'inc', v: 30 }, { s: 'speed', t: 'more', v: -15 }],
    flavor: 'Die Zeit vergeht. Nur nicht für sie.',
  },
  voidecho: {
    base: 'lapis', name: 'Echos der Leere',
    mods: [{ s: 'spec_echoAll', v: 1 }, { s: 'dmg', t: 'more', v: -15 }],
    flavor: 'Jedes Wort wird zweimal gesprochen.',
  },
  wanderer: {
    base: 'slippers', name: 'Wandernde Sterne',
    mods: [{ s: 'move', t: 'inc', v: 15 }, { s: 'magnet', t: 'inc', v: 60 }, { s: 'luck', t: 'inc', v: 30 }],
    flavor: 'Wer sucht, der findet.',
  },
  chainbreaker: {
    base: 'goldring', name: 'Kettenbrecher',
    mods: [{ s: 'chain', v: 1 }, { s: 'pierce', v: 1 }, { s: 'dmg_proj', t: 'inc', v: 15 }],
    flavor: 'Keine Fessel hält ewig.',
  },
  titanhide: {
    base: 'chain', name: 'Titanenhaut',
    mods: [{ s: 'life', v: 100 }, { s: 'armor', t: 'inc', v: 50 }, { s: 'move', t: 'inc', v: -10 }],
    flavor: 'Schwer wie ein Berg, so unerschütterlich auch.',
  },
  emberstaff: {
    base: 'wand', name: 'Aschenrufer',
    mods: [{ s: 'conv_phys_fire', v: 100 }, { s: 'conv_cold_fire', v: 50 }, { s: 'conv_light_fire', v: 50 }, { s: 'dmg_fire', t: 'inc', v: 40 }],
    flavor: 'Am Ende wird alles zu Asche.',
  },
  frosthand: {
    base: 'runegloves', name: 'Frostfaust',
    mods: [{ s: 'add_cold', v: 10 }, { s: 'spec_shatter', v: 1 }, { s: 'freezeChance', v: 10 }],
    flavor: 'Was sie berührt, zerbricht.',
  },
  titanbelt: {
    base: 'heavybelt', name: 'Gurt des Titanen',
    mods: [{ s: 'life', v: 80 }, { s: 'armor', t: 'inc', v: 40 }, { s: 'dmg_melee', t: 'inc', v: 30 }],
    flavor: 'Für Schultern, die Berge tragen.',
  },
  soulchain: {
    base: 'chainbelt', name: 'Seelenkette',
    mods: [{ s: 'minionCount', v: 1 }, { s: 'spec_minionLeech', v: 2 }, { s: 'dmg_minion', t: 'inc', v: 25 }],
    flavor: 'Jedes Glied ein gebundener Geist.',
  },
  emberfingers: {
    base: 'silkgloves', name: 'Glutfinger',
    mods: [{ s: 'igniteChance', v: 20 }, { s: 'spec_burnStack', v: 1 }, { s: 'burn', t: 'inc', v: 30 }],
    flavor: 'Sie lodern seit tausend Jahren.',
  },
  prismfists: {
    base: 'gauntlets', name: 'Prismafäuste',
    mods: [{ s: 'conv_phys_light', v: 50 }, { s: 'conv_light_cold', v: 50 }, { s: 'dmg_elem', t: 'inc', v: 30 }],
    flavor: 'Licht bricht sich, Gegner auch.',
  },
  timewalker: {
    base: 'greaves', name: 'Zeitwanderer',
    mods: [{ s: 'speed', t: 'inc', v: 15 }, { s: 'move', t: 'inc', v: 12 }, { s: 'dur', t: 'inc', v: -20 }],
    flavor: 'Gestern ist schon morgen.',
  },
  stormcrown: {
    base: 'ironhelm', name: 'Krone des Sturms',
    mods: [{ s: 'lvl_light', v: 1 }, { s: 'shockChance', v: 20 }, { s: 'life', v: 40 }],
    flavor: 'Gekrönt vom Donner.',
  },
  voideye: {
    base: 'hood', name: 'Leerenauge',
    mods: [{ s: 'dmg_chaos', t: 'inc', v: 40 }, { s: 'pen_chaos', v: 20 }, { s: 'spec_poisonVuln', v: 10 }],
    flavor: 'Es starrt zurück.',
  },
  bloodmoon: {
    base: 'amber', name: 'Blutmond',
    mods: [{ s: 'bleedChance', v: 30 }, { s: 'bleed', t: 'more', v: 30 }, { s: 'leech', v: 1 }],
    flavor: 'Wenn er aufgeht, fließt Blut.',
  },
  starfall: {
    base: 'lapis', name: 'Sternenfall',
    mods: [{ s: 'lvl', v: 1 }, { s: 'dmg', t: 'inc', v: 20 }, { s: 'life', t: 'inc', v: -15 }],
    flavor: 'Ein Stück vom Himmel, um den Hals getragen.',
  },
  chainward: {
    base: 'robe', name: 'Kettenwächter',
    mods: [{ s: 'chain', v: 1 }, { s: 'barrier', v: 80 }, { s: 'dmg_chain', t: 'inc', v: 30 }],
    flavor: 'Ein Netz aus Licht.',
  },
  thornmail: {
    base: 'plate', name: 'Dornenpanzer',
    mods: [{ s: 'armor', v: 150 }, { s: 'spec_thorns', v: 80 }, { s: 'life', v: 30 }],
    flavor: 'Wer schlägt, blutet.',
  },
  splitbow: {
    base: 'bow', name: 'Gespaltener Himmel',
    mods: [{ s: 'proj', v: 2 }, { s: 'spec_fork', v: 1 }, { s: 'dmg_proj', t: 'inc', v: 20 }],
    flavor: 'Ein Pfeil wird viele.',
  },
  boomaxe: {
    base: 'axe', name: 'Heimkehrer',
    mods: [{ s: 'spec_return', v: 1 }, { s: 'dmg_attack', t: 'inc', v: 40 }, { s: 'add_phys', v: 8 }],
    flavor: 'Er kommt immer zurück.',
  },
  coldheart: {
    base: 'sapphire', name: 'Herz der Kälte',
    mods: [{ s: 'dmg_cold', t: 'inc', v: 35 }, { s: 'freezeChance', v: 12 }, { s: 'res_cold', v: 30 }],
    flavor: 'Es schlägt einmal pro Winter.',
  },
  eternring: {
    base: 'goldring', name: 'Ring der Ewigkeit',
    mods: [{ s: 'dur', t: 'inc', v: 40 }, { s: 'ailDur', t: 'inc', v: 40 }, { s: 'dmg_dot', t: 'inc', v: 20 }],
    flavor: 'Ohne Anfang, ohne Ende.',
  },
  execring: {
    base: 'ironring', name: 'Henkersring',
    mods: [{ s: 'dmgVsLow', t: 'more', v: 40 }, { s: 'critMulti', v: 30 }, { s: 'spec_overkill', v: 1 }],
    flavor: 'Das letzte, was sie sehen.',
  },
  stardust: {
    base: 'goldring', name: 'Staubfänger',
    mods: [{ s: 'dust', t: 'inc', v: 30 }, { s: 'luck', t: 'inc', v: 25 }, { s: 'xp', t: 'inc', v: 10 }],
    flavor: 'Jedes Körnchen zählt.',
  },
  necronomicon: {
    base: 'totem', name: 'Totenbuch',
    mods: [{ s: 'dmg_minion', t: 'inc', v: 50 }, { s: 'spec_killExplode', v: 5 }, { s: 'lvl_minion', v: 1 }],
    flavor: 'Seine Seiten flüstern Namen.',
  },
  arcanestorm: {
    base: 'wand', name: 'Arkaner Sturm',
    mods: [{ s: 'speed_spell', t: 'more', v: 20 }, { s: 'crit_spell', t: 'inc', v: 60 }, { s: 'dmg_spell', t: 'inc', v: 30 }],
    flavor: 'Zauber wie Regen.',
  },
  lifethief: {
    base: 'dagger', name: 'Lebensdieb',
    mods: [{ s: 'leech', v: 2.5 }, { s: 'lifeOnKill', v: 6 }, { s: 'add_phys', v: 6 }],
    flavor: 'Was dir fehlt, nimm dir.',
  },
  peakbreaker: {
    base: 'scepter', name: 'Gipfelstürmer',
    mods: [{ s: 'dmg_elem', t: 'inc', v: 50 }, { s: 'pen', v: 12 }, { s: 'res_elem', v: -15 }],
    flavor: 'Höher. Immer höher.',
  },
  phoenix: {
    base: 'amber', name: 'Phönixfeder',
    mods: [{ s: 'spec_rebirth', v: 1 }, { s: 'res_fire', v: 25 }, { s: 'lifeRegen', v: 4 }],
    flavor: 'Aus der Asche.',
  },
  voidboots: {
    base: 'slippers', name: 'Schritte der Leere',
    mods: [{ s: 'dodge', v: 15 }, { s: 'move', t: 'inc', v: 10 }, { s: 'evasion', t: 'inc', v: 30 }],
    flavor: 'Du bist hier. Und nicht.',
  },
  ragewraps: {
    base: 'wraps', name: 'Fäuste des Zorns',
    mods: [{ s: 'spec_berserk', v: 1 }, { s: 'speed_attack', t: 'inc', v: 20 }, { s: 'lifeOnKill', v: 3 }],
    flavor: 'Je tiefer die Wunde, desto härter der Schlag.',
  },
  stillsash: {
    base: 'sash', name: 'Schärpe der Stille',
    mods: [{ s: 'spec_stillness', v: 1 }, { s: 'barrier', v: 40 }, { s: 'dmg_aura', t: 'inc', v: 30 }],
    flavor: 'Bewegungslos wie ein Stern.',
  },
  mirrorshield: {
    base: 'plate', name: 'Spiegelpanzer',
    mods: [{ s: 'armor', v: 120 }, { s: 'spec_thorns', v: 50 }, { s: 'res_elem', v: 15 }],
    flavor: 'Was du austeilst, kommt zurück.',
  },
  frostfang: {
    base: 'dagger', name: 'Frostzahn',
    mods: [{ s: 'add_cold', v: 14 }, { s: 'conv_phys_cold', v: 50 }, { s: 'freezeChance', v: 15 }],
    flavor: 'Ein Biss, der niemals taut.',
  },
  thunderhammer: {
    base: 'axe', name: 'Donnerhammer',
    mods: [{ s: 'add_light', v: 16 }, { s: 'shockChance', v: 30 }, { s: 'area_melee', t: 'inc', v: 30 }],
    flavor: 'Jeder Schlag ein Gewitter.',
  },
  beastmaw: {
    base: 'totem', name: 'Bestienrachen',
    mods: [{ s: 'dmg_minion', t: 'inc', v: 45 }, { s: 'bleedChance', v: 20 }, { s: 'speed_minion', t: 'inc', v: 20 }],
    flavor: 'Er knurrt im Schlaf.',
  },
  soulharvest: {
    base: 'scepter', name: 'Seelenernte',
    mods: [{ s: 'lifeOnKill', v: 8 }, { s: 'spec_killExplode', v: 6 }, { s: 'dmg_chaos', t: 'inc', v: 30 }],
    flavor: 'Jede Seele nährt die nächste Ernte.',
  },
  quiver: {
    base: 'bow', name: 'Unendlicher Köcher',
    mods: [{ s: 'proj', v: 3 }, { s: 'dmg_proj', t: 'more', v: -15 }, { s: 'speed_attack', t: 'inc', v: 15 }],
    flavor: 'Er wird nie leer.',
  },
  runecrown: {
    base: 'diadem', name: 'Runenkrone',
    mods: [{ s: 'lvl_spell', v: 1 }, { s: 'barrier', v: 60 }, { s: 'speed_spell', t: 'inc', v: 10 }],
    flavor: 'Gekrönt von uraltem Wissen.',
  },
  hunterhood: {
    base: 'hood', name: 'Kapuze des Jägers',
    mods: [{ s: 'dmgVsBoss', t: 'inc', v: 40 }, { s: 'crit', t: 'inc', v: 40 }, { s: 'evasion', v: 60 }],
    flavor: 'Sie sieht nur das Ziel.',
  },
  stormboots: {
    base: 'walkers', name: 'Blitzsohlen',
    mods: [{ s: 'move', t: 'inc', v: 25 }, { s: 'spec_moveStrike', v: 1 }, { s: 'life', v: -20 }],
    flavor: 'Schneller als der Donner.',
  },
  anchorboots: {
    base: 'greaves', name: 'Ankerstiefel',
    mods: [{ s: 'spec_stillness', v: 1 }, { s: 'armor', v: 80 }, { s: 'move', t: 'inc', v: -15 }],
    flavor: 'Hier stehe ich.',
  },
  ironfist: {
    base: 'gauntlets', name: 'Eiserne Faust',
    mods: [{ s: 'add_phys', v: 12 }, { s: 'spec_ruthless', v: 100 }, { s: 'armor', v: 40 }],
    flavor: 'Jeder dritte Schlag bricht Knochen.',
  },
  spellweave: {
    base: 'silkgloves', name: 'Zauberweber',
    mods: [{ s: 'spec_echoAll', v: 1 }, { s: 'speed_spell', t: 'more', v: -10 }, { s: 'dmg_spell', t: 'inc', v: 20 }],
    flavor: 'Zwei Hände, zwei Zauber.',
  },
  trapper: {
    base: 'runegloves', name: 'Fallenstellerhände',
    mods: [{ s: 'spec_trapMax', v: 4 }, { s: 'dmg_trap', t: 'inc', v: 50 }, { s: 'speed_trap', t: 'inc', v: 20 }],
    flavor: 'Geduld ist eine Waffe.',
  },
  vampbelt: {
    base: 'leatherbelt', name: 'Gurt des Vampirs',
    mods: [{ s: 'leech', v: 2 }, { s: 'life', v: 50 }, { s: 'spec_leechMult', v: 2 }],
    flavor: 'Er dürstet für dich.',
  },
  mageband: {
    base: 'sash', name: 'Band des Erzmagiers',
    mods: [{ s: 'lvl', v: 1 }, { s: 'barrier', v: 40 }, { s: 'life', t: 'inc', v: -10 }],
    flavor: 'Macht hat ihren Preis.',
  },
  everflame: {
    base: 'chainbelt', name: 'Ewige Flamme',
    mods: [{ s: 'burn', t: 'more', v: 30 }, { s: 'ailDur', t: 'inc', v: 40 }, { s: 'res_fire', v: 30 }],
    flavor: 'Sie brennt seit dem ersten Stern.',
  },
  chaosheart: {
    base: 'jade', name: 'Herz des Chaos',
    mods: [{ s: 'conv_fire_chaos', v: 50 }, { s: 'conv_cold_chaos', v: 50 }, { s: 'conv_light_chaos', v: 50 }, { s: 'dmg_chaos', t: 'inc', v: 40 }],
    flavor: 'Ordnung ist eine Illusion.',
  },
  balanceamulet: {
    base: 'amber', name: 'Amulett des Gleichgewichts',
    mods: [{ s: 'res_elem', v: 20 }, { s: 'res_chaos', v: 20 }, { s: 'resMax', v: 3 }],
    flavor: 'Weder heiß noch kalt.',
  },
  critring: {
    base: 'ruby', name: 'Ring der Schärfe',
    mods: [{ s: 'critBase', v: 2 }, { s: 'critMulti', v: 35 }, { s: 'crit', t: 'inc', v: 30 }],
    flavor: 'Ein Funke, und alles ist vorbei.',
  },
  stormring: {
    base: 'topaz', name: 'Ring des Sturms',
    mods: [{ s: 'chain', v: 2 }, { s: 'dmg_light', t: 'inc', v: 30 }, { s: 'shockEffect', t: 'inc', v: 30 }],
    flavor: 'Er knistert an deinem Finger.',
  },
  frostring: {
    base: 'sapphire', name: 'Ring des ewigen Eises',
    mods: [{ s: 'spec_chillAura', v: 1 }, { s: 'chillEffect', t: 'inc', v: 50 }, { s: 'dmg_cold', t: 'inc', v: 20 }],
    flavor: 'Dein Atem gefriert.',
  },
  gamblering: {
    base: 'goldring', name: 'Glücksspielerring',
    mods: [{ s: 'luck', t: 'inc', v: 60 }, { s: 'gold', t: 'inc', v: 60 }, { s: 'dmg', t: 'inc', v: -10 }],
    flavor: 'Alles oder nichts.',
  },
  bloodtitan: {
    base: 'chain', name: 'Blut des Titanen',
    mods: [{ s: 'life', t: 'inc', v: 30 }, { s: 'lifeRegenPct', v: 1.5 }, { s: 'spec_berserk', v: 1 }],
    flavor: 'Sein Herz schlägt wie eine Trommel.',
  },
  shadowcloak: {
    base: 'leather', name: 'Schattenmantel',
    mods: [{ s: 'dodge', v: 18 }, { s: 'evasion', t: 'inc', v: 50 }, { s: 'dmgVsLow', t: 'inc', v: 30 }],
    flavor: 'Wer dich sieht, ist schon zu spät.',
  },
  orbitcrown: {
    base: 'ironhelm', name: 'Krone der Kreise',
    mods: [{ s: 'dmg_orbit', t: 'inc', v: 50 }, { s: 'proj', v: 1 }, { s: 'speed_orbit', t: 'inc', v: 25 }],
    flavor: 'Alles dreht sich um dich.',
  },
  meteorstaff: {
    base: 'wand', name: 'Himmelssturz',
    mods: [{ s: 'area', t: 'inc', v: 40 }, { s: 'dmg_area', t: 'more', v: 25 }, { s: 'speed', t: 'more', v: -15 }],
    flavor: 'Langsam, aber gewaltig.',
  },
  poisonblade: {
    base: 'dagger', name: 'Natternzahn',
    mods: [{ s: 'poisonChance', v: 50 }, { s: 'poison', t: 'more', v: 30 }, { s: 'add_chaos', v: 8 }],
    flavor: 'Ein Kratzer genügt.',
  },
  echoaxe: {
    base: 'axe', name: 'Echo der Klinge',
    mods: [{ s: 'spec_echo', v: 1 }, { s: 'dmg_melee', t: 'inc', v: 30 }, { s: 'speed_attack', t: 'more', v: -15 }],
    flavor: 'Jeder Schlag hallt nach.',
  },
  runebelt: {
    base: 'heavybelt', name: 'Runengürtel',
    mods: [{ s: 'dmg_aura', t: 'inc', v: 40 }, { s: 'area_aura', t: 'inc', v: 30 }, { s: 'life', v: 40 }],
    flavor: 'Die Runen glühen bei jedem Schritt.',
  },
  starheart: {
    base: 'lapis', name: 'Sternenherz',
    mods: [{ s: 'dmg', t: 'more', v: 15 }, { s: 'speed', t: 'inc', v: 10 }, { s: 'life', t: 'inc', v: 10 }],
    flavor: 'Das Herz eines gefallenen Sterns.',
  },

  hunterbow: {
    base: 'bow', name: 'Jägermond',
    mods: [{ s: 'proj', v: 1 }, { s: 'critMulti', v: 50 }, { s: 'dmgVsBoss', t: 'inc', v: 40 }],
    flavor: 'Er jagt nur, was sich lohnt.',
  },
};

// ---------- Erzeugung ----------
const ENDINGS = { m: 'er', f: 'e', n: 'es', p: 'e' };
const RARE_A = ['Sternen', 'Schatten', 'Asche', 'Runen', 'Blut', 'Sturm', 'Leeren', 'Frost', 'Dämmer', 'Glut', 'Seelen', 'Nebel', 'Donner', 'Grab', 'Kristall', 'Wahn', 'Eisen', 'Mond'];
const RARE_B = ['biss', 'ruf', 'zorn', 'schrei', 'wacht', 'fall', 'dorn', 'kuss', 'glanz', 'fluch', 'hauch', 'schwur', 'klaue', 'herz', 'schwinge', 'gesang', 'mal', 'bann'];

function maxTierIndex(affix, ilvl) {
  let idx = 0;
  for (let i = 0; i < affix.tiers.length; i++) if (TIER_ILVL[i] <= ilvl) idx = i;
  return idx;
}

function rollTierValue(range) {
  const [a, b] = range;
  if (a === b) return a;
  const v = a + Math.random() * (b - a);
  return b - a >= 3 || a >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
}

function rollAffix(slot, ilvl, existing) {
  const used = new Set(existing.map((x) => x.id));
  const pre = existing.filter((x) => AFFIX[x.id].k === 'pre').length;
  const suf = existing.length - pre;
  const pool = AFFIXES.filter((a) => a.slots.includes(slot) && !used.has(a.id) && (a.min || 0) <= ilvl &&
    ((a.k === 'pre' && pre < 3) || (a.k === 'suf' && suf < 3)));
  if (!pool.length) return null;
  const a = weighted(pool, (x) => x.w || 100);
  const top = maxTierIndex(a, ilvl);
  // Höchste Stufen sind seltener
  const span = Math.min(3, top + 1);
  const tier = top - Math.floor(Math.pow(Math.random(), 1.6) * span);
  return { id: a.id, tier, v: rollTierValue(a.tiers[tier]) };
}

export function itemMods(item) {
  if (item.rarity === 'unique') return UNIQUES[item.uq].mods;
  if (item.rarity === 'set') return SETS[item.set].pieces[item.piece].mods;
  if (item.rarity === 'mythic' && item.slot !== 'relic' && item.slot !== 'jewel') {
    const out = [...(BASES[item.base].imp || [])];
    for (const af of item.affixes) { const d = AFFIX[af.id]; if (d) out.push({ s: d.s, t: d.t, v: af.v }); }
    for (const e of item.effects || []) out.push(...MYTHIC_EFFECTS[e].mods);
    return out;
  }
  if (item.slot === 'jewel') return jewelMods(item);
  const out = [...(BASES[item.base].imp || [])];
  for (const af of item.affixes) {
    const d = item.slot === 'relic' ? RELIC_AFFIX[af.id] : AFFIX[af.id];
    if (d) out.push({ s: d.s, t: d.t, v: af.v });
  }
  return out;
}

export function itemName(item) {
  const base = BASES[item.base];
  if (item.rarity === 'unique') return UNIQUES[item.uq].name;
  if (item.rarity === 'set') return SETS[item.set].pieces[item.piece].name;
  if (item.slot === 'jewel') return item.title || 'Juwel';
  if (item.rarity === 'rare' || item.rarity === 'mythic' || item.slot === 'relic') return item.title || base.name;
  if (item.rarity === 'magic') {
    const p = item.affixes.map((x) => AFFIX[x.id]).find((a) => a && a.k === 'pre');
    const s = item.affixes.map((x) => AFFIX[x.id]).find((a) => a && a.k === 'suf');
    return `${p ? p.pn + ENDINGS[base.g] + ' ' : ''}${base.name}${s ? ' ' + s.sn : ''}`;
  }
  return base.name;
}

export function rareTitle() { return pick(RARE_A) + pick(RARE_B); }

/** Mythischer Gegenstand: vier Affixe auf höchster Stufe plus ein bis zwei Spezialeffekte. */
export function makeMythic(ilvl = 60, slot) {
  slot = slot || pick(SLOTS);
  const bases = Object.keys(BASES).filter((k) => BASES[k].slot === slot);
  const item = { uid: uid(), slot, base: pick(bases), rarity: 'mythic', ilvl: Math.max(ilvl, 40), affixes: [], effects: [], title: mythicTitle() };
  for (let i = 0; i < 4; i++) {
    const af = rollAffix(slot, item.ilvl + 25, item.affixes);
    if (af) item.affixes.push(af);
  }
  const n = Math.random() < 0.3 ? 2 : 1;
  const pool = MYTHIC_EFFECTS.map((_, i) => i);
  for (let i = 0; i < n; i++) item.effects.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return item;
}

/** Set-Teil erzeugen (bevorzugt für den gewünschten Platz). */
export function makeSetItem(slot) {
  const all = [];
  for (const [sid, st] of Object.entries(SETS)) st.pieces.forEach((p, i) => all.push({ sid, i, slot: BASES[p.base].slot }));
  const fit = all.filter((x) => x.slot === slot);
  const c = pick(fit.length ? fit : all);
  const piece = SETS[c.sid].pieces[c.i];
  return { uid: uid(), slot: BASES[piece.base].slot, base: piece.base, rarity: 'set', set: c.sid, piece: c.i, ilvl: 1, affixes: [] };
}

export function makeItem({ ilvl = 1, slot, rarity, luck = 0, allowUnique = true, uniquePool, uniqueMult = 1, setMult = 1 }) {
  slot = slot || pick(SLOTS);
  if (!rarity) {
    const l = 1 + luck / 100;
    rarity = weighted([
      { r: 'normal', w: 28 }, { r: 'magic', w: 52 }, { r: 'rare', w: 18 * l },
      { r: 'unique', w: allowUnique ? 1.6 * l * (uniqueMult || 1) : 0 },
      { r: 'set', w: allowUnique ? 0.9 * l * (setMult || 1) : 0 },
    ]).r;
  }
  if (rarity === 'set') return makeSetItem(slot);
  if (rarity === 'unique') {
    const all = uniquePool || Object.keys(UNIQUES);
    const bySlot = all.filter((k) => BASES[UNIQUES[k].base].slot === slot);
    const uq = pick(bySlot.length ? bySlot : all);
    const b = UNIQUES[uq].base;
    return { uid: uid(), slot: BASES[b].slot, base: b, rarity: 'unique', uq, ilvl, affixes: [] };
  }
  const bases = Object.keys(BASES).filter((k) => BASES[k].slot === slot);
  const item = { uid: uid(), slot, base: pick(bases), rarity, ilvl, affixes: [] };
  const n = rarity === 'magic' ? (Math.random() < 0.5 ? 1 : 2) : rarity === 'rare' ? 3 + Math.floor(Math.random() * 3) : 0;
  for (let i = 0; i < n; i++) {
    const af = rollAffix(slot, ilvl, item.affixes);
    if (af) item.affixes.push(af);
  }
  if (rarity === 'rare') item.title = rareTitle();
  return item;
}

// ---------- Schmiede-Aktionen (im Run) ----------
export function craftReroll(item) {
  const n = item.affixes.length;
  item.affixes = [];
  for (let i = 0; i < n; i++) {
    const af = rollAffix(item.slot, item.ilvl, item.affixes);
    if (af) item.affixes.push(af);
  }
  return item;
}
export function craftAdd(item) {
  if (item.affixes.length >= 6) return false;
  const af = rollAffix(item.slot, item.ilvl, item.affixes);
  if (!af) return false;
  item.affixes.push(af);
  if (item.rarity === 'normal') item.rarity = 'magic';
  if (item.rarity === 'magic' && item.affixes.length > 2) { item.rarity = 'rare'; item.title = rareTitle(); }
  return true;
}
export function craftUpgrade(item) {
  const cands = item.affixes.filter((af) => af.tier < AFFIX[af.id].tiers.length - 1);
  if (!cands.length) return false;
  const af = pick(cands);
  af.tier++;
  af.v = rollTierValue(AFFIX[af.id].tiers[af.tier]);
  return true;
}
export function canCraft(item) {
  return item.rarity !== 'unique' && item.rarity !== 'set' && item.rarity !== 'mythic' && item.slot !== 'relic' && item.slot !== 'jewel';
}

// ---------- Relikte ----------
export function makeRelic(level, luck = 0) {
  const l = 1 + luck / 100;
  const rarity = weighted([
    { r: 'magic', w: 55 }, { r: 'rare', w: 32 * l }, { r: 'legend', w: 10 * l }, { r: 'mythic', w: 3 * l },
  ]).r;
  const n = { magic: 2, rare: 3, legend: 4, mythic: 5 }[rarity];
  const maxTier = clamp(Math.floor(level / 10), 0, RELIC_TIERS - 1);
  const relic = { uid: uid(), slot: 'relic', base: 'shard', rarity, ilvl: level, affixes: [], title: rareTitle() };
  const pool = [...RELIC_AFFIXES];
  for (let i = 0; i < n && pool.length; i++) {
    const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const tier = Math.max(0, maxTier - Math.floor(Math.pow(Math.random(), 1.4) * Math.min(4, maxTier + 1)));
    relic.affixes.push({ id: a.id, tier, v: rollTierValue(relicTierRange(a, tier)) });
  }
  return relic;
}
export const relicRefineCost = (af) => Math.round(40 * Math.pow(1.55, af.tier + 1));
export function relicRefine(relic, idx) {
  const af = relic.affixes[idx];
  if (!af || af.tier >= RELIC_TIERS - 1) return false;
  af.tier++;
  af.v = rollTierValue(relicTierRange(RELIC_AFFIX[af.id], af.tier));
  return true;
}
export const relicSalvage = (relic) => Math.round(12 * relic.affixes.reduce((s, a) => s + a.tier + 1, 0) *
  ({ magic: 1, rare: 1.4, legend: 2, mythic: 3 }[relic.rarity] || 1));

export function affixLine(item, af) {
  const d = item.slot === 'relic' ? RELIC_AFFIX[af.id] : item.slot === 'jewel' ? JEWEL_AFFIX[af.id] : AFFIX[af.id];
  return { text: modText({ s: d.s, t: d.t, v: af.v }), tier: af.tier + 1 };
}

export const itemValue = (item) => Math.round((item.rarity === 'mythic' ? 150 : item.rarity === 'unique' || item.rarity === 'set' ? 60 : item.rarity === 'rare' ? 30 : item.rarity === 'magic' ? 14 : 6) * (1 + item.ilvl / 20));
