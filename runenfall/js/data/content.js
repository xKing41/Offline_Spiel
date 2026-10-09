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
};

export const ACTS = [
  {
    name: 'Sternengrab', sub: 'Akt I', tint: '#1a1033', floor: '#221642',
    pool: [['shade', 10], ['runner', 6], ['brute', 2], ['bomber', 3], ['seer', 2]],
    boss: 'shepherd', power: 1,
  },
  {
    name: 'Kristallschlund', sub: 'Akt II', tint: '#0c1a33', floor: '#132a4a',
    pool: [['shade', 6], ['runner', 5], ['brute', 3], ['seer', 4], ['splitter', 4], ['charger', 3], ['golem', 1]],
    boss: 'queen', power: 2.7,
  },
  {
    name: 'Thron der Leere', sub: 'Akt III', tint: '#1d0a24', floor: '#2b0f33',
    pool: [['shade', 5], ['runner', 5], ['brute', 3], ['bomber', 3], ['charger', 4], ['wraith', 4], ['splitter', 3], ['golem', 2]],
    boss: 'voidlord', power: 6.5,
  },
];
export const ABYSS = {
  name: 'Der Abgrund', sub: 'Endlos', tint: '#05050c', floor: '#120c1c',
  pool: [['shade', 4], ['runner', 4], ['brute', 3], ['bomber', 3], ['seer', 3], ['splitter', 3], ['charger', 3], ['wraith', 3], ['golem', 2]],
};

// ---------- Bosse ----------
// patterns: ring (Projektilring), spiral, barrage (gezielte Salve), charge, slam (Bodenzeichen), summon
export const BOSSES = {
  shepherd: {
    name: 'Der Aschenhirte', hp: 1500, dmg: 16, speed: 52, r: 34, color: '#ff7a2a', elem: 'fire',
    patterns: [['ring', 3.2], ['charge', 5], ['summon', 7], ['slam', 4.4]], summon: 'bomber',
  },
  queen: {
    name: 'Die Kristallkönigin', hp: 2000, dmg: 20, speed: 46, r: 36, color: '#62d6ff', elem: 'cold',
    patterns: [['spiral', 6], ['barrage', 3], ['slam', 3.6], ['summon', 8]], summon: 'seer',
  },
  voidlord: {
    name: 'Der Leere Fürst', hp: 2600, dmg: 24, speed: 58, r: 38, color: '#c58bff', elem: 'chaos',
    patterns: [['ring', 2.6], ['spiral', 5], ['charge', 4.4], ['barrage', 3.2], ['summon', 7.5]], summon: 'wraith',
  },
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
  { id: 'start', name: 'Vorbereitung', desc: 'Starte jeden Run mit einer zusätzlichen Glyphe', max: 1, base: 700, g: 1 },
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
];
