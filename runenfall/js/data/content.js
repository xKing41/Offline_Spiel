// Spielinhalte: Klassen, Gegner, Bosse, Akte, Elite-Affixe, Segen, Ereignisse, Altar, Erfolge.

const inc = (s, v) => ({ s, t: 'inc', v });
const more = (s, v) => ({ s, t: 'more', v });
const flat = (s, v) => ({ s, v });

export const CLASSES = {
  pyro: { name: 'Funkenmagier', color: '#ff7a2a', start: 'fireball', unlock: 0, glyph: '✹', desc: 'Feuer, Zauber und Flächen. Brennt alles nieder.' },
  storm: { name: 'Sturmruferin', color: '#ffe34d', start: 'chainlight', unlock: 600, glyph: 'ϟ', desc: 'Blitz, Schock und Tempo. Schnell und unberechenbar.' },
  ranger: { name: 'Klingentänzerin', color: '#7dffb0', start: 'arrows', unlock: 0, glyph: '➶', desc: 'Projektile, kritische Treffer und Ausweichen.' },
  plague: { name: 'Seuchenweber', color: '#9cff5e', start: 'plague', unlock: 1500, glyph: '☣', desc: 'Gift, Chaos und Schaden über Zeit.' },
  warden: { name: 'Eisenhüter', color: '#e6dccb', start: 'slam', unlock: 0, glyph: '⛨', desc: 'Nahkampf, Rüstung und unerschütterliches Leben.' },
  binder: { name: 'Gebieterin', color: '#c58bff', start: 'wisps', unlock: 3000, glyph: '❖', desc: 'Begleiter, Fallen und Auren. Lässt andere kämpfen.' },
};

// ---------- Gegner ----------
// hp/dmg sind Grundwerte für Akt 1; die Skalierung passiert in combat.js
export const ENEMIES = {
  shade: { name: 'Schatten', hp: 10, dmg: 7, speed: 72, r: 12, xp: 1, color: '#7b5cff', shape: 'circle' },
  runner: { name: 'Irrläufer', hp: 5, dmg: 6, speed: 125, r: 10, xp: 1, color: '#ff5c8a', shape: 'tri' },
  brute: { name: 'Koloss', hp: 48, dmg: 15, speed: 46, r: 21, xp: 4, color: '#c9783a', shape: 'square' },
  seer: { name: 'Seher', hp: 12, dmg: 8, speed: 58, r: 12, xp: 2, color: '#5fd4ff', shape: 'diamond', ranged: { cd: 2.6, speed: 190, elem: 'cold' }, keep: 190 },
  bomber: { name: 'Glutbrut', hp: 8, dmg: 20, speed: 92, r: 11, xp: 1, color: '#ff8a2a', shape: 'circle', explode: { r: 55, elem: 'fire' } },
  splitter: { name: 'Teiler', hp: 20, dmg: 9, speed: 60, r: 15, xp: 2, color: '#9cff5e', shape: 'hex', split: 'mite' },
  mite: { name: 'Splitterling', hp: 4, dmg: 5, speed: 112, r: 8, xp: 0.5, color: '#bfff8a', shape: 'tri' },
  charger: { name: 'Stürmer', hp: 23, dmg: 13, speed: 64, r: 14, xp: 2, color: '#ff4d4d', shape: 'tri', charge: { cd: 3.2, speed: 400 } },
  wraith: { name: 'Leerengeist', hp: 16, dmg: 10, speed: 84, r: 13, xp: 2, color: '#c58bff', shape: 'diamond', ranged: { cd: 3.2, speed: 160, elem: 'chaos', burst: 3 }, keep: 150 },
  golem: { name: 'Kristallgolem', hp: 90, dmg: 22, speed: 40, r: 25, xp: 6, color: '#62d6ff', shape: 'hex', res: { cold: 50, phys: 20 } },
  shielder: { name: 'Schildwächter', hp: 40, dmg: 9, speed: 50, r: 16, xp: 3, color: '#7aa8ff', shape: 'square', shield: 150 },
  healer: { name: 'Mondpriester', hp: 24, dmg: 6, speed: 55, r: 13, xp: 3, color: '#7dffb0', shape: 'diamond', heal: 160, keep: 220 },
  blinker: { name: 'Phasenläufer', hp: 22, dmg: 11, speed: 70, r: 12, xp: 2, color: '#e070ff', shape: 'tri', blink: 3.5 },
  nest: { name: 'Brutnest', hp: 110, dmg: 0, speed: 0, r: 26, xp: 6, color: '#bfff8a', shape: 'hex', spawn: { id: 'mite', cd: 2.6, n: 2 } },
  sniper: { name: 'Sternschütze', hp: 18, dmg: 18, speed: 50, r: 12, xp: 3, color: '#ffe34d', shape: 'diamond', ranged: { cd: 3.6, speed: 520, elem: 'light', aim: 0.7 }, keep: 340 },
  slime: { name: 'Sternenschleim', hp: 36, dmg: 10, speed: 48, r: 18, xp: 2, color: '#62ffd0', shape: 'circle', split: 'slimelet', splitN: 3 },
  slimelet: { name: 'Schleimling', hp: 9, dmg: 5, speed: 80, r: 9, xp: 0.5, color: '#9cffe3', shape: 'circle' },
  phantom: { name: 'Phantom', hp: 30, dmg: 12, speed: 90, r: 13, xp: 3, color: '#c9c3ff', shape: 'diamond', phase: true },
  turret: { name: 'Runenturm', hp: 70, dmg: 10, speed: 0, r: 20, xp: 4, color: '#ff9a5c', shape: 'square', ranged: { cd: 3, speed: 170, elem: 'fire', ring: 8 }, keep: 0 },
  leaper: { name: 'Springer', hp: 32, dmg: 16, speed: 60, r: 14, xp: 3, color: '#ff6b81', shape: 'tri', leap: 3.4 },
  minelayer: { name: 'Minenleger', hp: 28, dmg: 18, speed: 75, r: 13, xp: 3, color: '#ffb04d', shape: 'hex', mines: 2.2 },
  swarm: { name: 'Sternenschwarm', hp: 3, dmg: 4, speed: 150, r: 7, xp: 0.4, color: '#ffd84d', shape: 'tri', group: 6 },
};

export const BIOMES = {
  sternengrab: {
    name: 'Sternengrab', tint: '#1a1033', floor: '#221642', boss: 'shepherd',
    pool: [['shade', 10], ['runner', 6], ['brute', 2], ['bomber', 3], ['seer', 2], ['swarm', 2]],
  },
  nebelmoor: {
    name: 'Nebelmoor', tint: '#0f1a14', floor: '#16291f', boss: 'colossus', hazard: 'poison',
    pool: [['shade', 7], ['runner', 4], ['slime', 3], ['bomber', 2], ['healer', 1], ['nest', 1]],
  },
  kristall: {
    name: 'Kristallschlund', tint: '#0c1a33', floor: '#132a4a', boss: 'queen',
    pool: [['shade', 6], ['runner', 5], ['brute', 3], ['seer', 4], ['splitter', 4], ['charger', 3], ['golem', 1], ['shielder', 2], ['sniper', 2]],
  },
  glutschmiede: {
    name: 'Glutschmiede', tint: '#22100a', floor: '#341a10', boss: 'wyrm', hazard: 'fire',
    pool: [['bomber', 5], ['runner', 5], ['brute', 3], ['charger', 3], ['turret', 2], ['minelayer', 3], ['leaper', 2], ['shade', 4]],
  },
  leere: {
    name: 'Thron der Leere', tint: '#1d0a24', floor: '#2b0f33', boss: 'voidlord',
    pool: [['shade', 5], ['runner', 5], ['brute', 3], ['bomber', 3], ['charger', 4], ['wraith', 4], ['splitter', 3], ['golem', 2], ['phantom', 3], ['blinker', 3]],
  },
  sturmgipfel: {
    name: 'Sturmgipfel', tint: '#0e1424', floor: '#1a2238', boss: 'witch', hazard: 'lightning',
    pool: [['runner', 5], ['seer', 4], ['sniper', 3], ['blinker', 3], ['shielder', 3], ['charger', 4], ['swarm', 3], ['golem', 2], ['leaper', 3]],
  },
};
export const ACTS = [
  { sub: 'Akt I', power: 1, biomes: ['sternengrab', 'nebelmoor'] },
  { sub: 'Akt II', power: 2.7, biomes: ['kristall', 'glutschmiede'] },
  { sub: 'Akt III', power: 6.5, biomes: ['leere', 'sturmgipfel'] },
];
export const ABYSS = {
  name: 'Der Abgrund', sub: 'Endlos', tint: '#05050c', floor: '#120c1c',
  pool: Object.keys({ shade: 1, runner: 1, brute: 1, bomber: 1, seer: 1, splitter: 1, charger: 1, wraith: 1, golem: 1, shielder: 1, healer: 1, blinker: 1, nest: 1, sniper: 1, slime: 1, phantom: 1, turret: 1, leaper: 1, minelayer: 1, swarm: 1 }).map((k) => [k, 3]),
};

// ---------- Bosse ----------
// patterns: ring (Projektilring), spiral, barrage (gezielte Salve), charge, slam (Bodenzeichen), summon
export const BOSSES = {
  shepherd: {
    name: 'Der Aschenhirte', hp: 1500, dmg: 16, speed: 52, r: 34, color: '#ff7a2a', elem: 'fire',
    patterns: [['ring', 3.2], ['charge', 5], ['summon', 7], ['slam', 4.4]], summon: 'bomber',
  },
  queen: {
    name: 'Die Kristallkönigin', hp: 1600, dmg: 20, speed: 46, r: 36, color: '#62d6ff', elem: 'cold',
    patterns: [['spiral', 6], ['barrage', 3], ['slam', 3.6], ['summon', 8]], summon: 'seer',
  },
  voidlord: {
    name: 'Der Leere Fürst', hp: 2600, dmg: 24, speed: 58, r: 38, color: '#c58bff', elem: 'chaos',
    patterns: [['ring', 2.6], ['spiral', 5], ['charge', 4.4], ['barrage', 3.2], ['summon', 7.5]], summon: 'wraith',
  },
};
BOSSES.colossus = {
  name: 'Der Moorkoloss', hp: 1600, dmg: 16, speed: 40, r: 40, color: '#7dffb0', elem: 'chaos',
  patterns: [['pools', 5.5], ['slam', 4.4], ['charge', 6], ['summon', 8]], summon: 'slimelet',
};
BOSSES.wyrm = {
  name: 'Der Glutwyrm', hp: 2200, dmg: 21, speed: 62, r: 36, color: '#ff9a2a', elem: 'fire',
  patterns: [['firewall', 4], ['spiral', 6], ['ring', 3.4], ['charge', 4.8]], summon: 'bomber',
};
BOSSES.witch = {
  name: 'Die Sturmhexe', hp: 2500, dmg: 23, speed: 70, r: 32, color: '#ffe34d', elem: 'light',
  patterns: [['laser', 4.2], ['blink', 3.5], ['barrage', 3], ['summon', 8], ['ring', 4]], summon: 'swarm',
};
export const BOSS_IDS = Object.keys(BOSSES);

// ---------- Elite-Affixe ----------
export const ELITE_AFFIXES = {
  fast: { name: 'Schnell' },
  armored: { name: 'Gepanzert' },
  burning: { name: 'Brennend' },
  regen: { name: 'Regenerierend' },
  fireres: { name: 'Feuerfest' },
  coldres: { name: 'Frostfest' },
  lightres: { name: 'Geerdet' },
  volatile: { name: 'Explosiv' },
  summoner: { name: 'Beschwörer' },
  vampiric: { name: 'Vampirisch' },
  shielding: { name: 'Schützend' },
  blinking: { name: 'Flackernd' },
  enraged: { name: 'Rasend' },
  chilling: { name: 'Eisig' },
  splitting: { name: 'Gespalten' },
};
export const ELITE_IDS = Object.keys(ELITE_AFFIXES);

// ---------- Sternenhöhe (unendliche Schwierigkeit) ----------
export const ASC_MODS = [
  { lvl: 1, text: 'Elite-Gegner haben einen zusätzlichen Affix', key: 'eliteAffix' },
  { lvl: 2, text: 'Gegner sind 10% schneller', key: 'fast' },
  { lvl: 3, text: 'Gegner haben 20% Elementarwiderstand', key: 'res' },
  { lvl: 4, text: '30% weniger Heilung zwischen Kämpfen', key: 'heal' },
  { lvl: 5, text: 'Bosse starten wütend', key: 'bossRage' },
  { lvl: 6, text: '25% mehr Gegner', key: 'density' },
  { lvl: 7, text: 'Gegner explodieren beim Tod', key: 'explode' },
  { lvl: 8, text: 'Elite-Gegner erscheinen häufiger', key: 'elites' },
  { lvl: 10, text: 'Gegnerische Geschosse sind 25% schneller', key: 'projSpeed' },
  { lvl: 12, text: 'Bosse haben 30% mehr Leben', key: 'bossHp' },
];
export const ascHas = (asc, key) => ASC_MODS.some((m) => m.key === key && asc >= m.lvl);
export const ascHpMult = (asc) => Math.pow(1.12, asc);
export const ascDmgMult = (asc) => Math.pow(1.07, asc);

// ---------- Segen (Level-up-Karten) ----------
// tags: passen zu Fertigkeiten mit diesen Tags (werden dann häufiger angeboten)
export const BOONS = [
  { id: 'b_dmg', mods: [inc('dmg', 8)], tags: [] },
  { id: 'b_fire', mods: [inc('dmg_fire', 14)], tags: ['fire'] },
  { id: 'b_cold', mods: [inc('dmg_cold', 14)], tags: ['cold'] },
  { id: 'b_light', mods: [inc('dmg_light', 14)], tags: ['light'] },
  { id: 'b_phys', mods: [inc('dmg_phys', 14)], tags: ['phys'] },
  { id: 'b_chaos', mods: [inc('dmg_chaos', 14)], tags: ['chaos'] },
  { id: 'b_spell', mods: [inc('dmg_spell', 12)], tags: ['spell'] },
  { id: 'b_attack', mods: [inc('dmg_attack', 12)], tags: ['attack'] },
  { id: 'b_proj', mods: [inc('dmg_proj', 12)], tags: ['proj'] },
  { id: 'b_area', mods: [inc('area', 10)], tags: ['area', 'aura'] },
  { id: 'b_minion', mods: [inc('dmg_minion', 15)], tags: ['minion'] },
  { id: 'b_dot', mods: [inc('dmg_dot', 14)], tags: ['dot'] },
  { id: 'b_speed', mods: [inc('speed', 6)], tags: [] },
  { id: 'b_crit', mods: [inc('crit', 20)], tags: ['hit'] },
  { id: 'b_critm', mods: [flat('critMulti', 15)], tags: ['hit'] },
  { id: 'b_life', mods: [inc('life', 8)], tags: [] },
  { id: 'b_armor', mods: [flat('armor', 40)], tags: [] },
  { id: 'b_eva', mods: [flat('evasion', 40)], tags: [] },
  { id: 'b_barrier', mods: [flat('barrier', 15)], tags: [] },
  { id: 'b_regen', mods: [flat('lifeRegen', 1.5)], tags: [] },
  { id: 'b_res', mods: [flat('res_elem', 8)], tags: [] },
  { id: 'b_move', mods: [inc('move', 6)], tags: [] },
  { id: 'b_magnet', mods: [inc('magnet', 30)], tags: [] },
  { id: 'b_dur', mods: [inc('dur', 12)], tags: ['dur', 'minion', 'trap'] },
  { id: 'b_ign', mods: [flat('igniteChance', 10), inc('burn', 10)], tags: ['fire'] },
  { id: 'b_psn', mods: [flat('poisonChance', 12), inc('poison', 10)], tags: ['chaos', 'phys'] },
  { id: 'b_bld', mods: [flat('bleedChance', 12), inc('bleed', 10)], tags: ['phys', 'attack'] },
  { id: 'b_shk', mods: [flat('shockChance', 10), inc('shockEffect', 15)], tags: ['light'] },
  { id: 'b_frz', mods: [flat('freezeChance', 6), inc('chillEffect', 15)], tags: ['cold'] },
  { id: 'b_leech', mods: [flat('leech', 0.6)], tags: ['hit'] },
  { id: 'b_proj1', mods: [flat('proj', 1)], tags: ['proj', 'orbit'], minRarity: 2 },
  { id: 'b_pierce', mods: [flat('pierce', 1)], tags: ['proj'], minRarity: 1 },
  { id: 'b_chain', mods: [flat('chain', 1)], tags: ['chain'], minRarity: 1 },
  { id: 'b_minc', mods: [flat('minionCount', 1)], tags: ['minion'], minRarity: 2 },
  { id: 'b_pen', mods: [flat('pen', 4)], tags: ['fire', 'cold', 'light', 'chaos'] },
  { id: 'b_trap', mods: [inc('dmg_trap', 15)], tags: ['trap'] },
  { id: 'b_aura', mods: [inc('dmg_aura', 15), inc('area_aura', 6)], tags: ['aura'] },
  { id: 'b_orbit', mods: [inc('dmg_orbit', 15)], tags: ['orbit'] },
  { id: 'b_melee', mods: [inc('dmg_melee', 14)], tags: ['melee'] },
  { id: 'b_chainD', mods: [inc('dmg_chain', 15)], tags: ['chain'] },
  { id: 'b_projS', mods: [inc('projSpeed', 15), inc('dmg_proj', 5)], tags: ['proj'] },
  { id: 'b_boss', mods: [inc('dmgVsBoss', 15)], tags: [] },
  { id: 'b_low', mods: [inc('dmgVsLow', 18)], tags: ['hit'] },
  { id: 'b_ail', mods: [inc('dmgVsAilment', 15)], tags: [] },
  { id: 'b_xp', mods: [inc('xp', 10)], tags: [] },
  { id: 'b_luck', mods: [inc('luck', 15), inc('gold', 10)], tags: [] },
  { id: 'b_lok', mods: [flat('lifeOnKill', 2)], tags: [] },
  { id: 'b_minspd', mods: [inc('speed_minion', 10)], tags: ['minion'] },
  { id: 'b_ailDur', mods: [inc('ailDur', 15)], tags: ['dot'] },
  { id: 'b_resC', mods: [flat('res_chaos', 10)], tags: [] },
  { id: 'b_critB', mods: [flat('critBase', 0.5)], tags: ['hit'], minRarity: 1 },
  { id: 'b_lvl', mods: [flat('lvl', 1)], tags: [], minRarity: 2 },
];
export const BOON_RARITY = [
  { name: 'Gewöhnlich', mult: 1, w: 62, color: '#c9c3b5' },
  { name: 'Selten', mult: 1.8, w: 28, color: '#7aa8ff' },
  { name: 'Episch', mult: 3, w: 10, color: '#d77bff' },
];

// ---------- Ereignisse ----------
// Effekte werden in run.js ausgewertet (siehe applyEventEffect)
export const EVENTS = [
  {
    id: 'shrine', title: 'Verfluchter Schrein',
    text: 'Ein Schrein aus schwarzem Glas pulsiert. Eine Stimme flüstert von Macht – zu einem Preis.',
    options: [
      { label: 'Macht annehmen', desc: '+25% mehr Schaden, −20% max. Leben (für diesen Run)', fx: { boon: [more('dmg', 25), more('life', -20)] } },
      { label: 'Weitergehen', desc: 'Nichts passiert.', fx: {} },
    ],
  },
  {
    id: 'bloodwell', title: 'Blutbrunnen',
    text: 'Der Brunnen verlangt Blut. Am Grund glitzert etwas.',
    options: [
      { label: 'Blut opfern', desc: 'Verliere 30% Leben, erhalte einen seltenen Gegenstand', fx: { hpPct: -30, item: 'rare' } },
      { label: 'Ablehnen', desc: 'Nichts passiert.', fx: {} },
    ],
  },
  {
    id: 'starfall', title: 'Sternschnuppe',
    text: 'Ein Splitter fällt glühend vor deine Füße.',
    options: [
      { label: 'Wissen aufnehmen', desc: '+1 Stufe für eine zufällige Fertigkeit', fx: { skillLvl: 1 } },
      { label: 'Verkaufen', desc: '+60 Gold (skaliert mit Akt)', fx: { gold: 60 } },
    ],
  },
  {
    id: 'mentor', title: 'Geist eines Lehrmeisters',
    text: '„Ich kann dir eine Lektion erteilen. Wähle weise.“',
    options: [
      { label: 'Tempo', desc: '+12% Fertigkeitstempo (Run)', fx: { boon: [inc('speed', 12)] } },
      { label: 'Fläche', desc: '+20% Wirkungsbereich (Run)', fx: { boon: [inc('area', 20)] } },
      { label: 'Zähigkeit', desc: '+15% max. Leben (Run)', fx: { boon: [inc('life', 15)] } },
    ],
  },
  {
    id: 'gamble', title: 'Der Glücksspieler',
    text: 'Ein Schatten mit Würfeln grinst: „Doppelt oder nichts?“',
    options: [
      { label: 'Die Hälfte setzen', desc: '50%: Gold verdoppelt sich, 50%: Einsatz verloren', fx: { gamble: 0.5 } },
      { label: 'Ablehnen', desc: 'Nichts passiert.', fx: {} },
    ],
  },
  {
    id: 'spring', title: 'Heilquelle',
    text: 'Klares Wasser, das nach Sternenlicht schmeckt.',
    options: [
      { label: 'Trinken', desc: 'Volle Heilung', fx: { hpPct: 100 } },
      { label: 'Segnen lassen', desc: '+12% max. Leben (Run)', fx: { boon: [inc('life', 12)] } },
    ],
  },
  {
    id: 'runesmith', title: 'Runenschmied-Geist',
    text: 'Ein flackernder Schmied bietet an, deine Ausrüstung zu verbessern.',
    options: [
      { label: 'Ausrüstung verbessern', desc: 'Ein zufälliger Affix eines ausgerüsteten Gegenstands steigt eine Stufe', fx: { upgrade: 1 } },
      { label: 'Glyphe verlangen', desc: 'Erhalte eine zufällige Glyphe', fx: { glyph: 1 } },
    ],
  },
  {
    id: 'tomb', title: 'Altes Grab',
    text: 'Ein versiegeltes Grab. Etwas kratzt von innen.',
    options: [
      { label: 'Öffnen', desc: '60%: einzigartiger oder seltener Fund · 40%: −25% Leben', fx: { tomb: 1 } },
      { label: 'Versiegelt lassen', desc: 'Nichts passiert.', fx: {} },
    ],
  },
  {
    id: 'pact', title: 'Pakt der Sterne',
    text: 'Die Sterne bieten dir Glück – wenn du ihnen Gold gibst.',
    options: [
      { label: '80 Gold zahlen', desc: '+40% Gegenstandsseltenheit und +2 Neu würfeln', fx: { pay: 80, boon: [inc('luck', 40)], rerolls: 2 } },
      { label: 'Ablehnen', desc: 'Nichts passiert.', fx: {} },
    ],
  },
  {
    id: 'oracle', title: 'Das Orakel',
    text: 'Eine blinde Seherin hebt den Kopf: „Ich sehe deinen Weg. Willst du ihn ändern?“',
    options: [
      { label: 'Vision empfangen', desc: '+3 Neu würfeln und +1 Verbannen', fx: { rerolls: 3, banish: 1 } },
      { label: 'Zukunft opfern', desc: '+2 Stufen sofort, aber −10% max. Leben (Run)', fx: { lvls: 2, boon: [more('life', -10)] } },
    ],
  },
  {
    id: 'forgegod', title: 'Amboss der Götter',
    text: 'Ein Amboss, der vor Hitze glüht. Wer hier schmiedet, schmiedet für die Ewigkeit.',
    options: [
      { label: 'Ausrüstung schmieden', desc: 'Zwei zufällige Affixe deiner Ausrüstung steigen eine Stufe', fx: { upgrade: 2 } },
      { label: 'Gegenstand opfern', desc: 'Ein zufälliger angelegter Gegenstand wird zu zwei seltenen', fx: { sacrifice: 1 } },
    ],
  },
  {
    id: 'library', title: 'Verlorene Bibliothek',
    text: 'Staubige Folianten voller Runenwissen. Du hast Zeit für ein Buch.',
    options: [
      { label: '„Die Kunst der Runen“', desc: 'Lerne eine neue Rune (falls Platz frei)', fx: { newSkill: 1 } },
      { label: '„Glyphenkunde“', desc: 'Erhalte zwei Glyphen', fx: { glyph: 2 } },
    ],
  },
  {
    id: 'starwell', title: 'Sternenbrunnen',
    text: 'Gefallener Sternenstaub sammelt sich in einem leuchtenden Becken.',
    options: [
      { label: 'Staub schöpfen', desc: '+60 Sternenstaub am Ende des Runs', fx: { dust: 60 } },
      { label: 'Im Staub baden', desc: '+15% Erfahrung (Run)', fx: { boon: [inc('xp', 15)] } },
    ],
  },
  {
    id: 'relicaltar', title: 'Reliquienaltar',
    text: 'Auf einem Altar liegt ein schimmernder Splitter. Er gehört niemandem – noch.',
    options: [
      { label: 'Mit Blut bezahlen', desc: '−40% Leben, erhalte ein Relikt', fx: { hpPct: -40, relic: 1 } },
      { label: 'Ehrfürchtig gehen', desc: 'Heilt 30% Leben', fx: { hpPct: 30 } },
    ],
  },
  {
    id: 'twins', title: 'Die Zwillingsgeister',
    text: 'Zwei Geister streiten: „Stärke!“ – „Nein, Geschick!“ Sie lassen dich entscheiden.',
    options: [
      { label: 'Stärke', desc: '+20% physischer Schaden, +40 Rüstung (Run)', fx: { boon: [inc('dmg_phys', 20), flat('armor', 40)] } },
      { label: 'Geschick', desc: '+8% Tempo, +8% Bewegungstempo (Run)', fx: { boon: [inc('speed', 8), inc('move', 8)] } },
      { label: 'Magie', desc: '+20% Elementarschaden, +10% Widerstände (Run)', fx: { boon: [inc('dmg_elem', 20), flat('res_elem', 10)] } },
    ],
  },
  {
    id: 'cursedgold', title: 'Verfluchtes Gold',
    text: 'Ein Haufen Goldmünzen, umgeben von schwarzem Nebel.',
    options: [
      { label: 'Nehmen', desc: '+150 Gold, aber Gegner verursachen 10% mehr Schaden (Run)', fx: { gold: 150, boon: [more('dmgTaken', 10)] } },
      { label: 'Liegen lassen', desc: 'Nichts passiert.', fx: {} },
    ],
  },
  {
    id: 'hermit', title: 'Der Einsiedler',
    text: '„Du trägst zu viel mit dir herum“, sagt der Alte und zeigt auf deinen Beutel.',
    options: [
      { label: 'Ballast abwerfen', desc: 'Verkaufe alle Gegenstände im Beutel zum doppelten Preis', fx: { sellAll: 2 } },
      { label: 'Rat annehmen', desc: '+10% Gegenstandsseltenheit und +10% Goldfund (Run)', fx: { boon: [inc('luck', 10), inc('gold', 10)] } },
    ],
  },
  {
    id: 'arena', title: 'Die Schattenarena',
    text: 'Zuschauer aus Rauch johlen. Ein Champion wartet. Gewinnst du, ist der Preis dein.',
    options: [
      { label: 'Herausforderung annehmen', desc: 'Kämpfe gegen eine Elite – Belohnung: einzigartiger Gegenstand', fx: { arena: 1 } },
      { label: 'Ablehnen', desc: 'Nichts passiert.', fx: {} },
    ],
  },
  {
    id: 'mirror', title: 'Spiegel der Seelen',
    text: 'Dein Spiegelbild grinst zurück. Es bietet dir einen Tausch an.',
    options: [
      { label: 'Tauschen', desc: 'Deine niedrigste Rune steigt um 2 Stufen, deine höchste sinkt um 1', fx: { mirror: 1 } },
      { label: 'Zerschlagen', desc: '+1 Verbannen, +1 Neu würfeln', fx: { banish: 1, rerolls: 1 } },
    ],
  },
  {
    id: 'comet', title: 'Kometeneinschlag',
    text: 'Der Boden ist noch heiß. Im Krater glüht ein Kern aus purem Sternenlicht.',
    options: [
      { label: 'Kern berühren', desc: '+15% mehr Feuerschaden, aber −15% Feuerwiderstand (Run)', fx: { boon: [more('dmg_fire', 15), flat('res_fire', -15)] } },
      { label: 'Kern zerschlagen', desc: 'Erhalte einen seltenen Gegenstand', fx: { item: 'rare' } },
    ],
  },
  {
    id: 'frozen', title: 'Eingefrorener Krieger',
    text: 'Im Eis steckt ein Krieger mit einer prächtigen Waffe.',
    options: [
      { label: 'Eis aufbrechen', desc: '70%: seltene Waffe · 30%: der Krieger erwacht (−20% Leben)', fx: { frozen: 1 } },
      { label: 'Wärme spenden', desc: '+15% Kältewiderstand und +10% Kälteschaden (Run)', fx: { boon: [flat('res_cold', 15), inc('dmg_cold', 10)] } },
    ],
  },
  {
    id: 'stormaltar', title: 'Sturmaltar',
    text: 'Blitze zucken um einen steinernen Altar.',
    options: [
      { label: 'Blitz fangen', desc: '+12% mehr Blitzschaden, +15% Schockchance (Run)', fx: { boon: [more('dmg_light', 12), flat('shockChance', 15)] } },
      { label: 'Erden', desc: '+20% Blitzwiderstand (Run)', fx: { boon: [flat('res_light', 20)] } },
    ],
  },
  {
    id: 'plaguewell', title: 'Pestbrunnen',
    text: 'Das Wasser ist grün und blubbert.',
    options: [
      { label: 'Trinken', desc: '+20% Chaoswiderstand, +15% Giftschaden (Run)', fx: { boon: [flat('res_chaos', 20), inc('poison', 15)] } },
      { label: 'Klingen eintauchen', desc: '+15% Giftchance (Run)', fx: { boon: [flat('poisonChance', 15)] } },
    ],
  },
  {
    id: 'merchantghost', title: 'Geisterhändler',
    text: '„Psst! Beste Ware, kaum gebraucht. Nur heute!“',
    options: [
      { label: 'Glyphe kaufen (60 Gold)', desc: 'Zwei Glyphen zur Auswahl', fx: { pay: 60, glyph: 2 } },
      { label: 'Wundertüte (100 Gold)', desc: 'Ein zufälliger Gegenstand – vielleicht einzigartig', fx: { pay: 100, item: 'gamble' } },
    ],
  },
  {
    id: 'timeloop', title: 'Zeitschleife',
    text: 'Alles wiederholt sich. Alles wiederholt sich. Alles …',
    options: [
      { label: 'Schleife nutzen', desc: '+20% mehr Fertigkeitsdauer, +10% Tempo (Run)', fx: { boon: [more('dur', 20), inc('speed', 10)] } },
      { label: 'Schleife brechen', desc: 'Volle Heilung', fx: { hpPct: 100 } },
    ],
  },
];

// ---------- Altar: dauerhafte Verbesserungen für Sternenstaub ----------
export const ALTAR = [
  { id: 'dmg', name: 'Zorn', desc: '+4% Schaden je Stufe', max: 15, base: 60, g: 1.45, mods: (l) => [inc('dmg', 4 * l)] },
  { id: 'life', name: 'Lebenskraft', desc: '+5% maximales Leben je Stufe', max: 15, base: 60, g: 1.45, mods: (l) => [inc('life', 5 * l)] },
  { id: 'gold', name: 'Wohlstand', desc: '+20 Startgold je Stufe', max: 5, base: 50, g: 1.6, mods: (l) => [flat('startGold', 20 * l)] },
  { id: 'reroll', name: 'Schicksalsfaden', desc: '+1 Neu würfeln pro Run', max: 5, base: 100, g: 1.8 },
  { id: 'banish', name: 'Verbannung', desc: '+1 Verbannen pro Run (Karte für den Run entfernen)', max: 3, base: 150, g: 1.9 },
  { id: 'choice', name: 'Weitsicht', desc: '+1 Kartenauswahl beim Stufenaufstieg', max: 1, base: 1200, g: 1 },
  { id: 'revive', name: 'Zweites Leben', desc: 'Einmal pro Run mit 50% Leben wiederbeleben', max: 1, base: 1800, g: 1 },
  { id: 'axp', name: 'Weisheit', desc: '+10% Konto-Erfahrung je Stufe', max: 10, base: 80, g: 1.5, mods: (l) => [inc('axp', 10 * l)] },
  { id: 'dust', name: 'Sternenfänger', desc: '+10% Sternenstaub je Stufe', max: 10, base: 80, g: 1.5, mods: (l) => [inc('dust', 10 * l)] },
  { id: 'luck', name: 'Glücksstern', desc: '+10% Gegenstandsseltenheit je Stufe', max: 10, base: 70, g: 1.45, mods: (l) => [inc('luck', 10 * l)] },
  { id: 'heal', name: 'Rastplatz', desc: '+10% Heilung nach jedem Kampf', max: 3, base: 150, g: 1.8 },
  { id: 'relic', name: 'Reliquienschrein', desc: '+1 Relikt-Platz', max: 2, base: 900, g: 3.5 },
  { id: 'start', name: 'Vorbereitung', desc: 'Starte jeden Run mit zusätzlichen Glyphen (+1 je Stufe)', max: 3, base: 700, g: 2.2 },
  { id: 'runelvl', name: 'Runenwissen', desc: 'Deine Startrune beginnt eine Stufe höher', max: 3, base: 400, g: 2.4 },
  { id: 'gear', name: 'Ausrüster', desc: 'Starte mit einem magischen Gegenstand je Stufe', max: 3, base: 250, g: 2 },
  { id: 'discount', name: 'Feilschen', desc: '−8% Händler- und Schmiedepreise je Stufe', max: 5, base: 120, g: 1.6 },
  { id: 'relicfind', name: 'Reliquienjäger', desc: '+4% Relikt-Chance bei Eliten je Stufe', max: 5, base: 200, g: 1.7 },
  { id: 'magnet', name: 'Anziehung', desc: '+15% Aufsammelradius je Stufe', max: 5, base: 60, g: 1.5, mods: (l) => [inc('magnet', 15 * l)] },
  { id: 'res', name: 'Sternenschild', desc: '+3% alle Elementarwiderstände je Stufe', max: 10, base: 90, g: 1.45, mods: (l) => [flat('res_elem', 3 * l)] },
  { id: 'speed', name: 'Eile', desc: '+2% Fertigkeitstempo je Stufe', max: 10, base: 100, g: 1.5, mods: (l) => [inc('speed', 2 * l)] },
  { id: 'crit', name: 'Sternenauge', desc: '+5% kritische Trefferchance je Stufe', max: 10, base: 90, g: 1.45, mods: (l) => [inc('crit', 5 * l)] },
];
export const altarCost = (a, lvl) => Math.round(a.base * Math.pow(a.g, lvl));

// ---------- Erfolge ----------
// Belohnung: points = zusätzliche Sternpunkte, dust = Sternenstaub
export const ACHIEVEMENTS = [
  { id: 'firstrun', name: 'Erster Abstieg', desc: 'Beende einen Run', reward: { points: 1 }, check: (s) => s.stats.runs >= 1 },
  { id: 'boss1', name: 'Hirtenlos', desc: 'Besiege den Aschenhirten', reward: { points: 1 }, check: (s) => s.stats.bossKills.shepherd >= 1 },
  { id: 'boss2', name: 'Königsmord', desc: 'Besiege die Kristallkönigin', reward: { points: 1 }, check: (s) => s.stats.bossKills.queen >= 1 },
  { id: 'boss3', name: 'Leerer Thron', desc: 'Besiege den Leeren Fürsten', reward: { points: 2 }, check: (s) => s.stats.bossKills.voidlord >= 1 },
  { id: 'asc1', name: 'Höher hinaus', desc: 'Gewinne auf Sternenhöhe 1', reward: { points: 1 }, check: (s) => s.stats.maxAscWin >= 1 },
  { id: 'asc3', name: 'Sternenwanderer', desc: 'Gewinne auf Sternenhöhe 3', reward: { points: 1 }, check: (s) => s.stats.maxAscWin >= 3 },
  { id: 'asc5', name: 'Himmelsstürmer', desc: 'Gewinne auf Sternenhöhe 5', reward: { points: 1 }, check: (s) => s.stats.maxAscWin >= 5 },
  { id: 'asc10', name: 'Sternenbezwinger', desc: 'Gewinne auf Sternenhöhe 10', reward: { points: 2 }, check: (s) => s.stats.maxAscWin >= 10 },
  { id: 'asc15', name: 'Kosmische Macht', desc: 'Gewinne auf Sternenhöhe 15', reward: { points: 2 }, check: (s) => s.stats.maxAscWin >= 15 },
  { id: 'asc20', name: 'Unsterblich', desc: 'Gewinne auf Sternenhöhe 20', reward: { points: 3 }, check: (s) => s.stats.maxAscWin >= 20 },
  { id: 'abyss5', name: 'In die Tiefe', desc: 'Erreiche Ebene 5 im Abgrund', reward: { points: 1 }, check: (s) => s.stats.maxAbyss >= 5 },
  { id: 'abyss15', name: 'Tiefseetaucher', desc: 'Erreiche Ebene 15 im Abgrund', reward: { points: 1 }, check: (s) => s.stats.maxAbyss >= 15 },
  { id: 'abyss30', name: 'Bodenlos', desc: 'Erreiche Ebene 30 im Abgrund', reward: { points: 2 }, check: (s) => s.stats.maxAbyss >= 30 },
  { id: 'abyss50', name: 'Herz des Abgrunds', desc: 'Erreiche Ebene 50 im Abgrund', reward: { points: 3 }, check: (s) => s.stats.maxAbyss >= 50 },
  { id: 'kills1k', name: 'Schattenjäger', desc: 'Besiege 1.000 Gegner', reward: { points: 1 }, check: (s) => s.stats.kills >= 1000 },
  { id: 'kills10k', name: 'Schattenschlächter', desc: 'Besiege 10.000 Gegner', reward: { points: 1 }, check: (s) => s.stats.kills >= 10000 },
  { id: 'kills100k', name: 'Weltenbrand', desc: 'Besiege 100.000 Gegner', reward: { points: 2 }, check: (s) => s.stats.kills >= 100000 },
  { id: 'hit10k', name: 'Wuchtig', desc: 'Verursache einen Treffer über 10.000', reward: { points: 1 }, check: (s) => s.stats.maxHit >= 1e4 },
  { id: 'hit1m', name: 'Sternenbrecher', desc: 'Verursache einen Treffer über 1 Million', reward: { points: 2 }, check: (s) => s.stats.maxHit >= 1e6 },
  { id: 'lvl30', name: 'Erleuchtet', desc: 'Erreiche Stufe 30 in einem Run', reward: { points: 1 }, check: (s) => s.stats.maxRunLvl >= 30 },
  { id: 'unique1', name: 'Einzigartig', desc: 'Finde einen einzigartigen Gegenstand', reward: { dust: 200 }, check: (s) => s.codex.uniques.length >= 1 },
  { id: 'unique10', name: 'Sammler', desc: 'Entdecke 10 einzigartige Gegenstände', reward: { points: 1 }, check: (s) => s.codex.uniques.length >= 10 },
  { id: 'uniqueAll', name: 'Kurator', desc: 'Entdecke alle einzigartigen Gegenstände', reward: { points: 2 }, check: (s, n) => s.codex.uniques.length >= n.uniques },
  { id: 'classes3', name: 'Vielseitig', desc: 'Gewinne mit 3 verschiedenen Klassen', reward: { points: 1 }, check: (s) => Object.keys(s.stats.wins).length >= 3 },
  { id: 'classes6', name: 'Meister aller Wege', desc: 'Gewinne mit allen 6 Klassen', reward: { points: 2 }, check: (s) => Object.keys(s.stats.wins).length >= 6 },
  { id: 'relicMythic', name: 'Mythos', desc: 'Finde ein mythisches Relikt', reward: { dust: 500 }, check: (s) => s.stats.mythic >= 1 },
  { id: 'keystone', name: 'Regelbrecher', desc: 'Weise einen Keystone zu', reward: { dust: 150 }, check: (s) => s.stats.keystone >= 1 },
  { id: 'acc25', name: 'Erfahren', desc: 'Erreiche Kontostufe 25', reward: { dust: 300 }, check: (s, n) => n.level >= 25 },
  { id: 'acc50', name: 'Veteran', desc: 'Erreiche Kontostufe 50', reward: { dust: 800 }, check: (s, n) => n.level >= 50 },
  { id: 'acc100', name: 'Legende', desc: 'Erreiche Kontostufe 100', reward: { points: 3 }, check: (s, n) => n.level >= 100 },
  { id: 'acc200', name: 'Mythos', desc: 'Erreiche Kontostufe 200', reward: { points: 5 }, check: (s, n) => n.level >= 200 },
  { id: 'bossColossus', name: 'Moorbezwinger', desc: 'Besiege den Moorkoloss', reward: { points: 1 }, check: (s) => (s.stats.bossKills.colossus || 0) >= 1 },
  { id: 'bossWyrm', name: 'Drachentöter', desc: 'Besiege den Glutwyrm', reward: { points: 1 }, check: (s) => (s.stats.bossKills.wyrm || 0) >= 1 },
  { id: 'bossWitch', name: 'Hexenjäger', desc: 'Besiege die Sturmhexe', reward: { points: 2 }, check: (s) => (s.stats.bossKills.witch || 0) >= 1 },
  { id: 'bossAll', name: 'Bezwinger aller Bosse', desc: 'Besiege jeden Boss mindestens einmal', reward: { points: 2 }, check: (s) => ['shepherd', 'queen', 'voidlord', 'colossus', 'wyrm', 'witch'].every((b) => (s.stats.bossKills[b] || 0) >= 1) },
  { id: 'boss100', name: 'Bosskiller', desc: 'Besiege 100 Bosse', reward: { points: 2 }, check: (s) => Object.values(s.stats.bossKills).reduce((a, b) => a + b, 0) >= 100 },
  { id: 'asc25', name: 'Jenseits der Sterne', desc: 'Gewinne auf Sternenhöhe 25', reward: { points: 3 }, check: (s) => s.stats.maxAscWin >= 25 },
  { id: 'asc30', name: 'Göttlich', desc: 'Gewinne auf Sternenhöhe 30', reward: { points: 5 }, check: (s) => s.stats.maxAscWin >= 30 },
  { id: 'abyss75', name: 'Ewige Tiefe', desc: 'Erreiche Ebene 75 im Abgrund', reward: { points: 3 }, check: (s) => s.stats.maxAbyss >= 75 },
  { id: 'abyss100', name: 'Das Ende der Welt', desc: 'Erreiche Ebene 100 im Abgrund', reward: { points: 5 }, check: (s) => s.stats.maxAbyss >= 100 },
  { id: 'kills1m', name: 'Apokalypse', desc: 'Besiege 1.000.000 Gegner', reward: { points: 3 }, check: (s) => s.stats.kills >= 1e6 },
  { id: 'hit100k', name: 'Vernichtend', desc: 'Verursache einen Treffer über 100.000', reward: { points: 1 }, check: (s) => s.stats.maxHit >= 1e5 },
  { id: 'hit100m', name: 'Sternenexplosion', desc: 'Verursache einen Treffer über 100 Millionen', reward: { points: 3 }, check: (s) => s.stats.maxHit >= 1e8 },
  { id: 'lvl50', name: 'Überirdisch', desc: 'Erreiche Stufe 50 in einem Run', reward: { points: 1 }, check: (s) => s.stats.maxRunLvl >= 50 },
  { id: 'lvl80', name: 'Aufgestiegen', desc: 'Erreiche Stufe 80 in einem Run', reward: { points: 2 }, check: (s) => s.stats.maxRunLvl >= 80 },
  { id: 'unique25', name: 'Schatzjäger', desc: 'Entdecke 25 einzigartige Gegenstände', reward: { points: 1 }, check: (s) => s.codex.uniques.length >= 25 },
  { id: 'codexSkills', name: 'Runenmeister', desc: 'Schalte alle Runen frei', reward: { points: 2 }, check: (s, n) => s.codex.skills.length >= n.skills },
  { id: 'codexSup', name: 'Glyphenmeister', desc: 'Schalte alle Glyphen frei', reward: { points: 2 }, check: (s, n) => s.codex.supports.length >= n.supports },
  { id: 'altarMax', name: 'Hohepriester', desc: 'Bringe 5 Altar-Segen auf die Höchststufe', reward: { points: 2 }, check: (s, n) => n.altarMaxed >= 5 },
  { id: 'ascend1', name: 'Aufstieg', desc: 'Schalte eine Aufstiegsstufe frei', reward: { dust: 300 }, check: (s) => Object.values(s.ascend || {}).some((x) => x > 0) },
  { id: 'ascendAll', name: 'Vollendet', desc: 'Schalte eine Aufstiegsklasse vollständig frei', reward: { points: 2 }, check: (s) => Object.values(s.ascend || {}).some((x) => x >= 5) },
  { id: 'daily1', name: 'Tagwerk', desc: 'Schließe eine tägliche Herausforderung ab', reward: { dust: 300 }, check: (s) => (s.stats.dailies || 0) >= 1 },
  { id: 'daily30', name: 'Unermüdlich', desc: 'Schließe 30 tägliche Herausforderungen ab', reward: { points: 3 }, check: (s) => (s.stats.dailies || 0) >= 30 },
  { id: 'quest10', name: 'Auftragnehmer', desc: 'Erfülle 10 Aufträge', reward: { points: 1 }, check: (s) => (s.stats.quests || 0) >= 10 },
  { id: 'quest100', name: 'Söldnerkönig', desc: 'Erfülle 100 Aufträge', reward: { points: 3 }, check: (s) => (s.stats.quests || 0) >= 100 },
  { id: 'proph3', name: 'Prophet', desc: 'Gewinne mit 3 aktiven Prophezeiungen', reward: { points: 2 }, check: (s) => (s.stats.maxProphWin || 0) >= 3 },
  { id: 'proph6', name: 'Weltenseher', desc: 'Gewinne mit 6 aktiven Prophezeiungen', reward: { points: 3 }, check: (s) => (s.stats.maxProphWin || 0) >= 6 },
  { id: 'bestiary', name: 'Naturforscher', desc: 'Besiege jede Gegnerart mindestens einmal', reward: { points: 1 }, check: (s, n) => n.bestiary >= n.enemyTypes },
  { id: 'nohit', name: 'Unberührbar', desc: 'Besiege einen Boss, ohne getroffen zu werden', reward: { points: 2 }, check: (s) => (s.stats.flawless || 0) >= 1 },
  { id: 'speedrun', name: 'Sternschnuppe', desc: 'Gewinne einen Feldzug in unter 15 Minuten', reward: { points: 2 }, check: (s) => (s.stats.fastestWin || 1e9) <= 900 },
];

// ---------- Aufstiegsklassen ----------
// Je Klasse zwei Wege mit fünf Stufen. Stufen werden im Kodex mit Sternenstaub freigeschaltet;
// im Run wirkt die gewählte Aufstiegsklasse mit allen freigeschalteten Stufen.
export const ASCEND_COST = [250, 500, 900, 1500, 2500];
export const ASCENDANCIES = {
  infernal: { cls: 'pyro', name: 'Infernalist', desc: 'Brände, die niemals erlöschen.', nodes: [
    { name: 'Glutseele', mods: [more('burn', 25), flat('igniteChance', 15)] },
    { name: 'Lauffeuer', mods: [flat('spec_burnSpread', 1), inc('area', 15)] },
    { name: 'Ewiges Feuer', mods: [flat('spec_burnStack', 1)] },
    { name: 'Aschenkrone', mods: [flat('pen_fire', 15), inc('dmg_fire', 30)] },
    { name: 'Sonnenherz', mods: [more('dmg_fire', 25), flat('lvl_fire', 1)] },
  ] },
  elementalist: { cls: 'pyro', name: 'Elementarist', desc: 'Meister aller Elemente.', nodes: [
    { name: 'Gleichgewicht', mods: [inc('dmg_elem', 25), flat('res_elem', 10)] },
    { name: 'Elementarschild', mods: [flat('resMax', 5), flat('barrier', 40)] },
    { name: 'Prismatische Haut', mods: [flat('pen', 8), inc('chillEffect', 30), inc('shockEffect', 30)] },
    { name: 'Sturmrufer', mods: [flat('spec_echoAll', 1)] },
    { name: 'Elementarherrschaft', mods: [more('dmg_elem', 25), flat('lvl', 1)] },
  ] },
  prophet: { cls: 'storm', name: 'Donnerprophetin', desc: 'Der Himmel gehorcht ihrem Ruf.', nodes: [
    { name: 'Spannung', mods: [inc('shockEffect', 50), flat('shockChance', 15)] },
    { name: 'Ableiter', mods: [flat('spec_shockSpread', 1), flat('chain', 1)] },
    { name: 'Donnerschritt', mods: [flat('spec_moveStrike', 1), inc('move', 10)] },
    { name: 'Gewitterfront', mods: [flat('lvl_light', 1), flat('pen_light', 15)] },
    { name: 'Zorn des Himmels', mods: [more('dmg_light', 30)] },
  ] },
  chrono: { cls: 'storm', name: 'Zeitweberin', desc: 'Sie biegt die Zeit selbst.', nodes: [
    { name: 'Schneller Puls', mods: [more('speed', 10), inc('move', 10)] },
    { name: 'Zeitlupe', mods: [inc('chillEffect', 40), flat('spec_chillAura', 1)] },
    { name: 'Ewigkeit', mods: [inc('dur', 40), inc('ailDur', 30)] },
    { name: 'Raserei', mods: [flat('spec_frenzy', 1)] },
    { name: 'Zeitsprung', mods: [more('speed', 15), flat('dodge', 10)] },
  ] },
  marksman: { cls: 'ranger', name: 'Scharfschützin', desc: 'Jeder Schuss ein Treffer.', nodes: [
    { name: 'Ruhige Hand', mods: [flat('critMulti', 40), inc('crit', 30)] },
    { name: 'Durchschlag', mods: [flat('pierce', 2), inc('projSpeed', 30)] },
    { name: 'Großwild', mods: [more('dmgVsBoss', 25), flat('critMulti', 20)] },
    { name: 'Kettenschuss', mods: [flat('spec_critChain', 1)] },
    { name: 'Meisterschütze', mods: [flat('proj', 1), more('dmg_proj', 20)] },
  ] },
  shadow: { cls: 'ranger', name: 'Schattenläuferin', desc: 'Ungesehen, unberührt, tödlich.', nodes: [
    { name: 'Schatten', mods: [inc('evasion', 60), flat('dodge', 8)] },
    { name: 'Giftklingen', mods: [flat('poisonChance', 25), inc('poison', 30)] },
    { name: 'Tanz der Klingen', mods: [inc('move', 15), inc('speed', 10)] },
    { name: 'Hinterhalt', mods: [more('dmgVsLow', 40), flat('spec_overkill', 1)] },
    { name: 'Nachtfalter', mods: [flat('dodge', 12), more('dmg', 15)] },
  ] },
  pestlord: { cls: 'plague', name: 'Pestfürst', desc: 'Seuchen sind seine Sprache.', nodes: [
    { name: 'Virulenz', mods: [more('poison', 25), flat('poisonChance', 20)] },
    { name: 'Siechtum', mods: [flat('spec_poisonVuln', 15)] },
    { name: 'Endloses Leid', mods: [inc('dur', 30), inc('ailDur', 40)] },
    { name: 'Pestwolke', mods: [inc('area', 25), more('dmg_dot', 15)] },
    { name: 'Vernichtung', mods: [more('dmg_chaos', 30), flat('pen_chaos', 15)] },
  ] },
  bloodmage: { cls: 'plague', name: 'Blutschamane', desc: 'Leben ist eine Ressource.', nodes: [
    { name: 'Blutdurst', mods: [flat('leech', 2), inc('life', 15)] },
    { name: 'Aderlass', mods: [flat('bleedChance', 25), more('bleed', 25)] },
    { name: 'Lebensfluss', mods: [flat('lifeOnKill', 6), flat('lifeRegenPct', 1)] },
    { name: 'Blutrausch', mods: [flat('spec_berserk', 1)] },
    { name: 'Opferkraft', mods: [more('dmg', 20), flat('spec_leechMult', 2)] },
  ] },
  juggernaut: { cls: 'warden', name: 'Koloss', desc: 'Nichts hält ihn auf.', nodes: [
    { name: 'Granitwille', mods: [more('armor', 30), inc('life', 15)] },
    { name: 'Dornenhaut', mods: [flat('spec_thorns', 60)] },
    { name: 'Unbeugsam', mods: [more('dmgTaken', -10), flat('res_elem', 10)] },
    { name: 'Unsterblich', mods: [flat('spec_rebirth', 1)] },
    { name: 'Lebende Festung', mods: [more('life', 20), flat('resMax', 5)] },
  ] },
  berserker: { cls: 'warden', name: 'Berserker', desc: 'Wut ist seine Rüstung.', nodes: [
    { name: 'Kriegsschrei', mods: [more('dmg_melee', 25), inc('speed_attack', 15)] },
    { name: 'Blutrache', mods: [flat('leech', 1.5), flat('lifeOnKill', 5)] },
    { name: 'Wuchthieb', mods: [flat('spec_ruthless', 80), inc('area_melee', 20)] },
    { name: 'Raserei', mods: [flat('spec_berserk', 1)] },
    { name: 'Schlächter', mods: [more('dmg_attack', 25), flat('spec_overkill', 1)] },
  ] },
  necro: { cls: 'binder', name: 'Nekromantin', desc: 'Der Tod ist nur der Anfang.', nodes: [
    { name: 'Totenbeschwörung', mods: [flat('minionCount', 1), inc('dmg_minion', 25)] },
    { name: 'Seelenband', mods: [flat('spec_minionLeech', 2), inc('speed_minion', 15)] },
    { name: 'Leichenfeuer', mods: [flat('spec_killExplode', 6)] },
    { name: 'Armee der Toten', mods: [flat('minionCount', 1), more('dmg_minion', 15)] },
    { name: 'Herrin des Todes', mods: [more('dmg_minion', 30), flat('lvl_minion', 1)] },
  ] },
  runesmith: { cls: 'binder', name: 'Runenschmiedin', desc: 'Fallen, Auren und Runen.', nodes: [
    { name: 'Fallenstellerin', mods: [flat('spec_trapMax', 3), more('dmg_trap', 20)] },
    { name: 'Strahlende Aura', mods: [inc('area_aura', 30), more('dmg_aura', 20)] },
    { name: 'Runenbeben', mods: [flat('spec_aftershock', 1)] },
    { name: 'Gravur', mods: [flat('lvl_trap', 1), flat('lvl_aura', 1)] },
    { name: 'Meisterrune', mods: [more('dmg', 20), inc('area', 20)] },
  ] },
};

// ---------- Prophezeiungen (frei wählbare Erschwernisse für mehr Belohnung) ----------
export const MUTATORS = {
  horde: { name: 'Horde', desc: '+60% mehr Gegner, die aber 25% weniger Leben haben', reward: 15 },
  titans: { name: 'Titanen', desc: 'Gegner haben 50% mehr Leben', reward: 25 },
  brutal: { name: 'Brutalität', desc: 'Gegner verursachen 40% mehr Schaden', reward: 25 },
  swift: { name: 'Hast', desc: 'Gegner sind 25% schneller', reward: 20 },
  elites: { name: 'Elitenparade', desc: 'Jeder Kampf enthält Eliten mit +1 Affix', reward: 25 },
  famine: { name: 'Hungersnot', desc: 'Keine Heilung nach Kämpfen', reward: 30 },
  poor: { name: 'Armut', desc: '50% weniger Gold', reward: 15 },
  blind: { name: 'Blindheit', desc: 'Nur 2 Kartenauswahlen beim Stufenaufstieg', reward: 20 },
  bossrage: { name: 'Wütende Bosse', desc: 'Bosse haben 50% mehr Leben und sind dauerhaft wütend', reward: 30 },
  glass: { name: 'Zerbrechlich', desc: 'Du hast 30% weniger maximales Leben', reward: 30 },
  volatile: { name: 'Explosive Leichen', desc: 'Getötete Gegner hinterlassen Explosionen', reward: 25 },
  hazards: { name: 'Sternenregen', desc: 'In jedem Kampf fallen Meteore vom Himmel', reward: 20 },
};

// ---------- Aufträge ----------
// Werden aus diesen Vorlagen erzeugt; Ziele skalieren mit der Kontostufe.
export const QUEST_TEMPLATES = [
  { id: 'kills', text: (n) => `Besiege ${n} Gegner in einem Run`, target: (l) => 400 + l * 25, key: 'runKills' },
  { id: 'elites', text: (n) => `Besiege ${n} Eliten in einem Run`, target: (l) => 3 + Math.floor(l / 6), key: 'runElites' },
  { id: 'act', text: (n) => `Erreiche Akt ${n}`, target: (l) => Math.min(3, 2 + Math.floor(l / 15)), key: 'runAct' },
  { id: 'boss', text: (n) => (n === 1 ? 'Besiege einen Boss' : `Besiege ${n} Bosse in einem Run`), target: (l) => Math.min(3, 1 + Math.floor(l / 10)), key: 'runBosses' },
  { id: 'level', text: (n) => `Erreiche Stufe ${n} in einem Run`, target: (l) => 12 + Math.floor(l * 0.8), key: 'runLvl' },
  { id: 'hit', text: (n) => `Verursache einen Treffer über ${n}`, target: (l) => Math.round(200 * Math.pow(1.12, l)), key: 'runMaxHit' },
  { id: 'win', text: () => 'Gewinne einen Feldzug', target: () => 1, key: 'runWin', minLvl: 8 },
  { id: 'abyss', text: (n) => `Erreiche Ebene ${n} im Abgrund`, target: (l) => 5 + Math.floor(l / 3), key: 'runAbyss', minLvl: 12 },
  { id: 'gold', text: (n) => `Sammle ${n} Gold in einem Run`, target: (l) => 300 + l * 20, key: 'runGold' },
  { id: 'proph', text: (n) => (n === 1 ? 'Beende einen Run mit einer Prophezeiung' : `Beende einen Run mit ${n} Prophezeiungen`), target: (l) => Math.min(4, 1 + Math.floor(l / 20)), key: 'runProph', minLvl: 6 },
  { id: 'class', text: () => 'Spiele einen Run mit einer anderen Klasse als zuletzt', target: () => 1, key: 'runNewClass' },
];
