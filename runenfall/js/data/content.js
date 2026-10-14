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
  monk: { name: 'Sternenmönch', color: '#7ad7ff', start: 'thunderclap', unlock: 5000, glyph: '☯', desc: 'Nahkampf, Blitz und Tempo. Zwischen Feuer und Sturm.' },
  hunter: { name: 'Bestienjägerin', color: '#ffb36b', start: 'glaive', unlock: 8000, glyph: '❂', desc: 'Wurfwaffen, Blutungen und wilde Begleiter.' },
  chrono: { name: 'Zeitwächter', color: '#9fb4ff', start: 'frostorb', unlock: 12000, glyph: '⌛', desc: 'Kälte, Dauer und Kontrolle über das Schlachtfeld.' },
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
  lurker: { name: 'Lauerer', hp: 34, dmg: 15, speed: 70, r: 14, xp: 3, color: '#a0785a', shape: 'hex', phase: true, blink: 4.5 },
  priest: { name: 'Leerenpriester', hp: 30, dmg: 9, speed: 52, r: 13, xp: 3, color: '#b06bff', shape: 'diamond', ranged: { cd: 3.4, speed: 170, elem: 'chaos', burst: 5 }, keep: 260 },
  moloch: { name: 'Moloch', hp: 200, dmg: 26, speed: 38, r: 28, xp: 8, color: '#9a8a7a', shape: 'square', charge: { cd: 4.5, speed: 340 }, res: { phys: 40 } },
  frostling: { name: 'Frostling', hp: 16, dmg: 8, speed: 88, r: 11, xp: 1, color: '#bff3ff', shape: 'tri', deathPool: { elem: 'cold', r: 50, t: 3.5 } },
  sparkler: { name: 'Funkengeist', hp: 8, dmg: 16, speed: 115, r: 10, xp: 1, color: '#fff27a', shape: 'circle', explode: { r: 50, elem: 'light' } },
  archer: { name: 'Bogenschütze', hp: 20, dmg: 9, speed: 58, r: 12, xp: 2, color: '#d9b38c', shape: 'diamond', ranged: { cd: 2.2, speed: 330, elem: 'phys', burst: 2 }, keep: 250 },
  wartotem: { name: 'Kriegstotem', hp: 90, dmg: 0, speed: 0, r: 22, xp: 5, color: '#ff8a5c', shape: 'square', hasteAura: 170 },
  reaper: { name: 'Seelenschnitter', hp: 44, dmg: 18, speed: 82, r: 15, xp: 4, color: '#8affd8', shape: 'tri', leap: 3, vampHit: true },
  // ---- Biom-Gegner (je drei pro Gebiet, mit eigenen Mechaniken)
  gravewarden: { name: 'Grabwächter', hp: 60, dmg: 14, speed: 44, r: 19, xp: 4, color: '#9a8cff', reflect: { cd: 5, dur: 1.4 } },
  moth: { name: 'Nachtfalter', hp: 4, dmg: 5, speed: 135, r: 8, xp: 0.5, color: '#d8c8ff', group: 5, zigzag: true },
  cometling: { name: 'Kometenkind', hp: 16, dmg: 12, speed: 52, r: 12, xp: 2, color: '#ffe6a0', mortar: { cd: 3.4, r: 50, elem: 'fire', n: 1 }, keep: 260 },
  bogmaw: { name: 'Moorschlund', hp: 40, dmg: 15, speed: 60, r: 18, xp: 3, color: '#6a8a3a', burrow: { cd: 5, dur: 2, elem: 'chaos' }, res: { chaos: 30 } },
  swampwitch: { name: 'Sumpfhexe', hp: 26, dmg: 7, speed: 50, r: 13, xp: 3, color: '#8aff9a', drain: { cd: 4, dur: 2.5, r: 230, elem: 'chaos' }, keep: 200 },
  willowisp: { name: 'Irrwicht', hp: 12, dmg: 9, speed: 95, r: 10, xp: 1, color: '#b8ff6a', phase: true, blink: 4, deathPool: { elem: 'chaos', r: 45, t: 3 } },
  shardspider: { name: 'Splitterspinne', hp: 22, dmg: 11, speed: 80, r: 13, xp: 2, color: '#9fe7ff', leap: 3.5, deathRing: 6, deathElem: 'cold' },
  prismward: { name: 'Prismawächter', hp: 34, dmg: 16, speed: 40, r: 15, xp: 3, color: '#e0c0ff', beam: { cd: 4, aim: 1, w: 16, len: 520, elem: 'light' }, keep: 240 },
  facetcolossus: { name: 'Facettenkoloss', hp: 110, dmg: 20, speed: 36, r: 26, xp: 6, color: '#7ad8ff', reflect: { cd: 6, dur: 1.6 }, split: 'shardspider', splitN: 2, res: { cold: 40 } },
  slagworm: { name: 'Schlackenwurm', hp: 36, dmg: 14, speed: 70, r: 15, xp: 3, color: '#ff7a3a', burrow: { cd: 4.5, dur: 1.6, elem: 'fire' }, trail: { elem: 'fire' }, res: { fire: 40 } },
  forgeheart: { name: 'Glutesse', hp: 70, dmg: 14, speed: 0, r: 20, xp: 4, color: '#ff5a1a', mortar: { cd: 2.6, r: 55, elem: 'fire', n: 2 }, keep: 0, res: { fire: 50 } },
  anvilknight: { name: 'Ambossritter', hp: 70, dmg: 20, speed: 48, r: 18, xp: 5, color: '#c8a080', charge: { cd: 4, speed: 420 }, stomp: 72, res: { phys: 25 } },
  voideye: { name: 'Leerenauge', hp: 30, dmg: 10, speed: 45, r: 14, xp: 3, color: '#c070ff', pull: { cd: 6, dur: 1.8, r: 300 }, ranged: { cd: 2.4, speed: 200, elem: 'chaos' }, keep: 220 },
  twinshade: { name: 'Schattenzwilling', hp: 24, dmg: 10, speed: 70, r: 12, xp: 2, color: '#8050c0', twin: true, group: 2 },
  nullwalker: { name: 'Nichtser', hp: 34, dmg: 13, speed: 80, r: 13, xp: 3, color: '#e0d0ff', phase: true, cloner: 2 },
  stormhawk: { name: 'Sturmfalke', hp: 18, dmg: 13, speed: 110, r: 11, xp: 2, color: '#ffe880', charge: { cd: 2.6, speed: 520 }, group: 2 },
  thundershaman: { name: 'Donnerschamane', hp: 30, dmg: 14, speed: 46, r: 13, xp: 3, color: '#ffd84d', hasteAura: 160, mortar: { cd: 3, r: 40, elem: 'light', n: 1, bolt: true }, keep: 240 },
  avalanche: { name: 'Lawinengolem', hp: 95, dmg: 22, speed: 34, r: 24, xp: 6, color: '#c8d8e8', ranged: { cd: 3.4, speed: 150, elem: 'phys', size: 20 }, res: { phys: 30 } },
  emberwolf: { name: 'Glutwolf', hp: 20, dmg: 11, speed: 105, r: 12, xp: 2, color: '#ff9a5a', group: 3, trail: { elem: 'fire' } },
  ashtree: { name: 'Aschebaum', hp: 90, dmg: 0, speed: 0, r: 24, xp: 5, color: '#8a6a5a', spawn: { id: 'sparkler', cd: 3.2, n: 1 }, slowAura: 170 },
  charred: { name: 'Verkohlter', hp: 28, dmg: 13, speed: 62, r: 13, xp: 2, color: '#5a4a40', enrage: true, deathPool: { elem: 'fire', r: 50, t: 3 } },
  mirrorling: { name: 'Spiegelbild', hp: 24, dmg: 12, speed: 80, r: 12, xp: 2, color: '#d0e0ff', cloner: 2, blink: 4 },
  lightbreaker: { name: 'Lichtbrecher', hp: 32, dmg: 15, speed: 42, r: 14, xp: 3, color: '#fff0a0', beam: { cd: 3.6, aim: 0.9, w: 14, len: 560, elem: 'light' }, keep: 250 },
  shardwarden: { name: 'Scherbenwächter', hp: 60, dmg: 14, speed: 46, r: 18, xp: 4, color: '#b0c8ff', reflect: { cd: 5, dur: 1.4 }, ranged: { cd: 3.2, speed: 180, elem: 'cold', ring: 8 } },
  souljelly: { name: 'Seelenqualle', hp: 34, dmg: 9, speed: 40, r: 16, xp: 3, color: '#8affd8', dmgAura: { r: 85, elem: 'light' }, zigzag: true },
  deepcaller: { name: 'Tiefenrufer', hp: 50, dmg: 12, speed: 38, r: 17, xp: 4, color: '#4ad8c8', pull: { cd: 7, dur: 1.6, r: 320 }, spawn: { id: 'slimelet', cd: 4, n: 2 } },
  drowned: { name: 'Ertrunkener', hp: 36, dmg: 14, speed: 55, r: 14, xp: 3, color: '#7ab8c8', drain: { cd: 4.5, dur: 2, r: 200, elem: 'cold' }, slowAura: 120 },
  // ---- Boss-Mechaniken (nicht im Bestiarium)
  bosscrystal: { name: 'Schildkristall', hp: 1, dmg: 0, speed: 0, r: 18, xp: 0, color: '#bfe8ff', noDex: true },
  soulanchor: { name: 'Seelenanker', hp: 1, dmg: 0, speed: 0, r: 16, xp: 0, color: '#ff8ad8', noDex: true },
};

export const BIOMES = {
  sternengrab: {
    name: 'Sternengrab', tint: '#1a1033', floor: '#221642', boss: 'shepherd',
    pool: [['shade', 10], ['runner', 6], ['brute', 2], ['bomber', 3], ['seer', 2], ['swarm', 2], ['gravewarden', 2], ['moth', 2], ['cometling', 2]],
  },
  nebelmoor: {
    name: 'Nebelmoor', tint: '#0f1a14', floor: '#16291f', boss: 'colossus', hazard: 'poison',
    pool: [['shade', 7], ['runner', 4], ['slime', 3], ['bomber', 2], ['healer', 1], ['nest', 1], ['bogmaw', 2], ['swampwitch', 2], ['willowisp', 3]],
  },
  kristall: {
    name: 'Kristallschlund', tint: '#0c1a33', floor: '#132a4a', boss: 'queen',
    pool: [['shade', 6], ['runner', 5], ['brute', 3], ['seer', 4], ['splitter', 4], ['charger', 3], ['golem', 1], ['shielder', 2], ['sniper', 2], ['shardspider', 3], ['prismward', 2], ['facetcolossus', 1]],
  },
  glutschmiede: {
    name: 'Glutschmiede', tint: '#22100a', floor: '#341a10', boss: 'wyrm', hazard: 'fire',
    pool: [['bomber', 5], ['runner', 5], ['brute', 3], ['charger', 3], ['turret', 2], ['minelayer', 3], ['leaper', 2], ['shade', 4], ['slagworm', 3], ['forgeheart', 1], ['anvilknight', 2]],
  },
  leere: {
    name: 'Thron der Leere', tint: '#1d0a24', floor: '#2b0f33', boss: 'voidlord',
    pool: [['shade', 5], ['runner', 5], ['brute', 3], ['bomber', 3], ['charger', 4], ['wraith', 4], ['splitter', 3], ['golem', 2], ['phantom', 3], ['blinker', 3], ['voideye', 2], ['twinshade', 2], ['nullwalker', 2]],
  },
  sturmgipfel: {
    name: 'Sturmgipfel', tint: '#0e1424', floor: '#1a2238', boss: 'witch', hazard: 'lightning',
    pool: [['runner', 5], ['seer', 4], ['sniper', 3], ['blinker', 3], ['shielder', 3], ['charger', 4], ['swarm', 3], ['golem', 2], ['leaper', 3], ['stormhawk', 3], ['thundershaman', 2], ['avalanche', 1]],
  },
};
BIOMES.aschewald = {
  name: 'Aschewald', tint: '#1c120c', floor: '#2a1a12', boss: 'hain', hazard: 'fire',
  pool: [['shade', 6], ['runner', 5], ['sparkler', 3], ['archer', 3], ['bomber', 2], ['wartotem', 1], ['frostling', 2], ['emberwolf', 3], ['ashtree', 1], ['charred', 3]],
};
BIOMES.spiegel = {
  name: 'Spiegellabyrinth', tint: '#101626', floor: '#1b2440', boss: 'mirror', hazard: 'lightning',
  pool: [['lurker', 3], ['blinker', 4], ['phantom', 3], ['archer', 4], ['shielder', 2], ['sparkler', 3], ['moloch', 1], ['runner', 4], ['mirrorling', 3], ['lightbreaker', 2], ['shardwarden', 2]],
};
BIOMES.seelenmeer = {
  name: 'Seelenmeer', tint: '#0a1418', floor: '#10242a', boss: 'leviathan', hazard: 'poison',
  pool: [['priest', 4], ['reaper', 3], ['wraith', 4], ['frostling', 3], ['moloch', 2], ['wartotem', 2], ['lurker', 3], ['swarm', 3], ['healer', 2], ['souljelly', 2], ['deepcaller', 1], ['drowned', 3]],
};
export const ACTS = [
  { sub: 'Akt I', power: 1, biomes: ['sternengrab', 'nebelmoor', 'aschewald'] },
  { sub: 'Akt II', power: 2.7, biomes: ['kristall', 'glutschmiede', 'spiegel'] },
  { sub: 'Akt III', power: 6.5, biomes: ['leere', 'sturmgipfel', 'seelenmeer'] },
];
export const ABYSS = {
  name: 'Der Abgrund', sub: 'Endlos', tint: '#05050c', floor: '#120c1c',
  pool: ['shade', 'runner', 'brute', 'bomber', 'seer', 'splitter', 'charger', 'wraith', 'golem', 'shielder', 'healer', 'blinker', 'nest', 'sniper', 'slime', 'phantom', 'turret', 'leaper', 'minelayer', 'swarm', 'lurker', 'priest', 'moloch', 'frostling', 'sparkler', 'archer', 'wartotem', 'reaper'].map((k) => [k, 3]),
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
BOSSES.hain = {
  name: 'Der Brennende Hain', hp: 1600, dmg: 17, speed: 34, r: 42, color: '#ff8a3d', elem: 'fire',
  patterns: [['firewall', 4.5], ['summon', 6.5], ['ring', 3.6], ['slam', 4.2]], summon: 'sparkler',
};
BOSSES.mirror = {
  name: 'Der Spiegelfürst', hp: 1700, dmg: 21, speed: 66, r: 32, color: '#9fc4ff', elem: 'light',
  patterns: [['blink', 3], ['laser', 4.6], ['barrage', 3.2], ['summon', 8]], summon: 'phantom',
};
BOSSES.leviathan = {
  name: 'Der Leviathan', hp: 2700, dmg: 24, speed: 48, r: 44, color: '#5ce0c8', elem: 'chaos',
  patterns: [['pools', 5], ['spiral', 5.5], ['charge', 5], ['ring', 3.4], ['summon', 8]], summon: 'priest',
};
// Zweite (und dritte) Phase mit eigener Mechanik für alle regulären Bosse
const BOSS_MECH = {
  shepherd: [['anchors', [['checker', 9]]]], queen: [['shield', [['safezones', 12]]]],
  voidlord: [['shield', [['safezones', 11]]], ['anchors', [['checker', 8]]]], colossus: [['anchors', [['checker', 10]]]],
  wyrm: [['shield', [['checker', 9]]]], witch: [['anchors', [['safezones', 10]]]], hain: [['shield', [['checker', 10]]]],
  mirror: [['anchors', [['safezones', 10]]]], leviathan: [['shield', [['safezones', 11]]], ['anchors', [['checker', 8]]]],
};
for (const [id, steps] of Object.entries(BOSS_MECH)) {
  const b = BOSSES[id];
  const phases = [{ at: 1, patterns: b.patterns }];
  steps.forEach(([enter, extra], i) => {
    const at = steps.length === 1 ? 0.5 : [0.6, 0.3][i];
    phases.push({ at, enter, patterns: [...b.patterns, ...extra] });
  });
  b.phases = phases;
}
export const BOSS_IDS = Object.keys(BOSSES);
// Endbosse des Sternenatlas: mehrere Phasen mit wechselnden Mustern
export const PINNACLES = {
  fallenstar: {
    name: 'Der Gefallene Stern', hp: 3600, dmg: 26, speed: 56, r: 46, color: '#ffe066', elem: 'fire', summon: 'sparkler',
    phases: [
      { at: 1, patterns: [['ring', 2.8], ['slam', 3.6], ['charge', 5]] },
      { at: 0.66, enter: 'shield', patterns: [['laser', 3.6], ['spiral', 5], ['firewall', 4.5], ['summon', 7], ['checker', 10]] },
      { at: 0.33, enter: 'anchors', patterns: [['laser', 2.8], ['ring', 2.4], ['blink', 3.2], ['firewall', 3.8], ['pools', 5], ['safezones', 9]] },
    ],
  },
  weaver: {
    name: 'Die Weberin der Leere', hp: 3400, dmg: 24, speed: 64, r: 38, color: '#c58bff', elem: 'chaos', summon: 'wraith',
    phases: [
      { at: 1, patterns: [['blink', 3.4], ['barrage', 2.8], ['pools', 5]] },
      { at: 0.66, enter: 'anchors', patterns: [['spiral', 4.4], ['summon', 6], ['blink', 2.8], ['laser', 4.8], ['safezones', 10]] },
      { at: 0.33, enter: 'shield', patterns: [['spiral', 3.6], ['pools', 3.6], ['ring', 2.6], ['blink', 2.4], ['barrage', 2.6], ['checker', 8]] },
    ],
  },
  eternal: {
    name: 'Der Ewige König', hp: 4200, dmg: 30, speed: 50, r: 48, color: '#ff5c7a', elem: 'phys', summon: 'moloch',
    phases: [
      { at: 1, patterns: [['charge', 3.8], ['slam', 3.2], ['summon', 8]] },
      { at: 0.66, enter: 'shield', patterns: [['charge', 3.2], ['firewall', 4], ['ring', 3.2], ['slam', 3], ['checker', 9]] },
      { at: 0.33, enter: 'anchors', patterns: [['charge', 2.6], ['laser', 3.4], ['firewall', 3.2], ['ring', 2.6], ['summon', 6], ['safezones', 8]] },
    ],
  },
};
for (const [k, b] of Object.entries(PINNACLES)) BOSSES[k] = { ...b, patterns: b.phases[0].patterns };

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
  {
    id: 'petegg', title: 'Ein seltsames Ei',
    text: 'In einem Nest aus Sternenstaub liegt ein warmes, pulsierendes Ei.',
    options: [
      { label: 'Mitnehmen', desc: '40%: ein Gefährte schlüpft am Ende des Runs', fx: { egg: 0.4 } },
      { label: 'Zerbrechen', desc: '+40 Sternenstaub am Ende des Runs', fx: { dust: 40 } },
    ],
  },
  {
    id: 'jewelvein', title: 'Juwelader',
    text: 'Eine Ader aus funkelndem Kristall zieht sich durch den Fels.',
    options: [
      { label: 'Abbauen', desc: '50%: ein Juwel · 50%: −20% Leben (Steinschlag)', fx: { jewel: 0.5 } },
      { label: 'Vorsichtig abklopfen', desc: '+30 Gold', fx: { gold: 30 } },
    ],
  },
  {
    id: 'duel', title: 'Herausforderung des Schwertmeisters',
    text: '„Zeig mir, was du kannst.“ Ein Geist hebt seine Klinge.',
    options: [
      { label: 'Duell annehmen', desc: 'Elite-Kampf – Belohnung: einzigartiger Gegenstand', fx: { arena: 1 } },
      { label: 'Lernen statt kämpfen', desc: '+10% Angriffsschaden und +10% Angriffstempo (Run)', fx: { boon: [inc('dmg_attack', 10), inc('speed_attack', 10)] } },
    ],
  },
  {
    id: 'astrologer', title: 'Der Astrologe',
    text: '„Die Sterne stehen günstig – für einen Preis.“',
    options: [
      { label: 'Horoskop (50 Gold)', desc: '+1 Stufe aller Fertigkeiten (Run)', fx: { pay: 50, boon: [flat('lvl', 1)] } },
      { label: 'Sternkarte kaufen (40 Gold)', desc: '+25% Erfahrung (Run)', fx: { pay: 40, boon: [inc('xp', 25)] } },
    ],
  },
  {
    id: 'bloodaltar', title: 'Blutaltar',
    text: 'Der Altar dürstet. Je mehr du gibst, desto mehr gibt er zurück.',
    options: [
      { label: 'Wenig opfern', desc: '−15% Leben, +10% Schaden (Run)', fx: { hpPct: -15, boon: [inc('dmg', 10)] } },
      { label: 'Viel opfern', desc: '−45% Leben, +25% mehr Schaden (Run)', fx: { hpPct: -45, boon: [more('dmg', 25)] } },
    ],
  },
  {
    id: 'cartographer', title: 'Kartograph',
    text: 'Ein Wanderer zeichnet Karten der Sterne. Er bietet dir eine an.',
    options: [
      { label: 'Karte studieren', desc: '+1 Atlaspunkt beim Abschluss des Runs', fx: { atlasPoint: 1 } },
      { label: 'Verkaufen', desc: '+70 Gold', fx: { gold: 70 } },
    ],
  },
  {
    id: 'swarmnest', title: 'Schwarmnest',
    text: 'Etwas summt in der Höhle. Sehr viel von etwas.',
    options: [
      { label: 'Ausräuchern', desc: '+3 Stufen sofort, aber −30% Leben', fx: { lvls: 3, hpPct: -30 } },
      { label: 'Leise vorbeischleichen', desc: '+8% Bewegungstempo (Run)', fx: { boon: [inc('move', 8)] } },
    ],
  },
  {
    id: 'glyphmaster', title: 'Glyphenmeister',
    text: 'Ein alter Mann schnitzt Glyphen in Sternensplitter.',
    options: [
      { label: 'Drei Glyphen kaufen (90 Gold)', desc: 'Erhalte drei zufällige Glyphen', fx: { pay: 90, glyph: 3 } },
      { label: 'Eine geschenkt', desc: 'Erhalte eine Glyphe', fx: { glyph: 1 } },
    ],
  },
  {
    id: 'ghostship', title: 'Geisterschiff',
    text: 'Ein Schiff aus Licht treibt durch die Dunkelheit. An Deck: Kisten.',
    options: [
      { label: 'Kisten plündern', desc: 'Zwei Gegenstände – aber die Mannschaft ist noch da (−25% Leben)', fx: { hpPct: -25, item: 'rare', item2: 'magic' } },
      { label: 'Salutieren', desc: '+15% Goldfund (Run)', fx: { boon: [inc('gold', 15)] } },
    ],
  },
  {
    id: 'clockwork', title: 'Uhrwerk der Sterne',
    text: 'Zahnräder so groß wie Häuser drehen sich lautlos.',
    options: [
      { label: 'Ein Rad drehen', desc: '+15% Fertigkeitstempo, −10% Bewegungstempo (Run)', fx: { boon: [inc('speed', 15), inc('move', -10)] } },
      { label: 'Zahnrad mitnehmen', desc: 'Ein zufälliger Affix deiner Ausrüstung steigt eine Stufe', fx: { upgrade: 1 } },
    ],
  },
  {
    id: 'echo', title: 'Echo eines Helden',
    text: 'Der Schatten eines früheren Abenteurers grüßt dich. Er trägt deine Züge.',
    options: [
      { label: 'Erinnerung teilen', desc: 'Eine zufällige Rune +1 Stufe, +10% max. Leben (Run)', fx: { skillLvl: 1, boon: [inc('life', 10)] } },
      { label: 'Ausrüstung tauschen', desc: 'Ein seltener Gegenstand', fx: { item: 'rare' } },
    ],
  },
  {
    id: 'starforge', title: 'Sternenschmiede',
    text: 'Hier wurden die ersten Relikte geschmiedet.',
    options: [
      { label: 'Am Amboss arbeiten (120 Gold)', desc: 'Erhalte ein Relikt', fx: { pay: 120, relic: 1 } },
      { label: 'Funken einfangen', desc: '+15% mehr kritischer Trefferschaden (Run)', fx: { boon: [flat('critMulti', 25)] } },
    ],
  },
  {
    id: 'fountain', title: 'Jungbrunnen',
    text: 'Wer daraus trinkt, wird stärker – oder verliert sich.',
    options: [
      { label: 'Trinken', desc: '60%: +20% max. Leben · 40%: −10% max. Leben (Run)', fx: { gambleLife: 1 } },
      { label: 'Flasche füllen', desc: 'Heilt 50% Leben', fx: { hpPct: 50 } },
    ],
  },
  {
    id: 'setpiece', title: 'Verlassenes Lager',
    text: 'Ein Rucksack, sorgfältig gepackt. Die Ausrüstung trägt ein Wappen.',
    options: [
      { label: 'Durchsuchen', desc: 'Erhalte ein Set-Teil', fx: { setItem: 1 } },
      { label: 'Gold nehmen', desc: '+50 Gold', fx: { gold: 50 } },
    ],
  },
  {
    id: 'voidgate', title: 'Riss in die Leere',
    text: 'Ein Riss im Himmel. Dahinter: Macht und Wahnsinn.',
    options: [
      { label: 'Hindurchgreifen', desc: '+20% mehr Chaosschaden, +10% erlittener Schaden (Run)', fx: { boon: [more('dmg_chaos', 20), more('dmgTaken', 10)] } },
      { label: 'Riss versiegeln', desc: '+15% Chaoswiderstand (Run)', fx: { boon: [flat('res_chaos', 15)] } },
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
  { id: 'classes9', name: 'Allwissend', desc: 'Gewinne mit allen 9 Klassen', reward: { points: 3 }, check: (s) => Object.keys(s.stats.wins).length >= 9 },
  { id: 'unlockMonk', name: 'Der Weg des Mönchs', desc: 'Schalte den Sternenmönch frei', reward: { dust: 500 }, check: (s) => s.unlockedCls.includes('monk') },
  { id: 'unlockHunter', name: 'Ruf der Wildnis', desc: 'Schalte die Bestienjägerin frei', reward: { dust: 800 }, check: (s) => s.unlockedCls.includes('hunter') },
  { id: 'unlockChrono', name: 'Hüter der Zeit', desc: 'Schalte den Zeitwächter frei', reward: { dust: 1200 }, check: (s) => s.unlockedCls.includes('chrono') },
  { id: 'bossHain', name: 'Waldbrand', desc: 'Besiege den Brennenden Hain', reward: { points: 1 }, check: (s) => (s.stats.bossKills.hain || 0) >= 1 },
  { id: 'bossMirror', name: 'Spiegelbruch', desc: 'Besiege den Spiegelfürsten', reward: { points: 1 }, check: (s) => (s.stats.bossKills.mirror || 0) >= 1 },
  { id: 'bossLevi', name: 'Meeresungeheuer', desc: 'Besiege den Leviathan', reward: { points: 2 }, check: (s) => (s.stats.bossKills.leviathan || 0) >= 1 },
  { id: 'pinnacle1', name: 'Sternensturz', desc: 'Besiege den Gefallenen Stern', reward: { points: 3 }, check: (s) => (s.stats.bossKills.fallenstar || 0) >= 1 },
  { id: 'pinnacle2', name: 'Fadenriss', desc: 'Besiege die Weberin der Leere', reward: { points: 3 }, check: (s) => (s.stats.bossKills.weaver || 0) >= 1 },
  { id: 'pinnacle3', name: 'Königsmörder', desc: 'Besiege den Ewigen König', reward: { points: 3 }, check: (s) => (s.stats.bossKills.eternal || 0) >= 1 },
  { id: 'pinnacleAll', name: 'Herr des Atlas', desc: 'Besiege alle drei Endbosse', reward: { points: 5 }, check: (s) => ['fallenstar', 'weaver', 'eternal'].every((b) => (s.stats.bossKills[b] || 0) >= 1) },
  { id: 'atlas1', name: 'Kartograph', desc: 'Schließe eine Atlas-Region ab', reward: { points: 1 }, check: (s) => Object.keys(s.atlas?.done || {}).length >= 1 },
  { id: 'atlas10', name: 'Entdecker', desc: 'Schließe 10 Atlas-Regionen ab', reward: { points: 2 }, check: (s) => Object.keys(s.atlas?.done || {}).length >= 10 },
  { id: 'atlasAll', name: 'Weltenwanderer', desc: 'Schließe alle Atlas-Regionen ab', reward: { points: 5 }, check: (s, n) => Object.keys(s.atlas?.done || {}).length >= n.atlasRegions },
  { id: 'atlasT10', name: 'Hohe Stufe', desc: 'Schließe eine Atlas-Region der Stufe 10+ ab', reward: { points: 2 }, check: (s) => Object.entries(s.atlas?.done || {}).some(([, t]) => t >= 10) },
  { id: 'atlasT16', name: 'Gipfel des Atlas', desc: 'Schließe eine Atlas-Region der Stufe 16 ab', reward: { points: 3 }, check: (s) => Object.entries(s.atlas?.done || {}).some(([, t]) => t >= 16) },
  { id: 'pet1', name: 'Bester Freund', desc: 'Erhalte deinen ersten Gefährten', reward: { dust: 300 }, check: (s) => Object.keys(s.pets || {}).length >= 1 },
  { id: 'pet6', name: 'Tierfreund', desc: 'Sammle 6 Gefährten', reward: { points: 1 }, check: (s) => Object.keys(s.pets || {}).length >= 6 },
  { id: 'petAll', name: 'Arche', desc: 'Sammle alle Gefährten', reward: { points: 3 }, check: (s, n) => Object.keys(s.pets || {}).length >= n.pets },
  { id: 'pet10', name: 'Treue Seele', desc: 'Bringe einen Gefährten auf Stufe 10', reward: { points: 2 }, check: (s) => Object.values(s.pets || {}).some((p) => p.lvl >= 10) },
  { id: 'set2', name: 'Zusammengehörig', desc: 'Trage 2 Teile desselben Sets', reward: { dust: 300 }, check: (s) => (s.stats.maxSet || 0) >= 2 },
  { id: 'set4', name: 'Vollständig', desc: 'Trage ein komplettes Set', reward: { points: 2 }, check: (s) => (s.stats.maxSet || 0) >= 4 },
  { id: 'setAll', name: 'Setsammler', desc: 'Entdecke alle Set-Teile', reward: { points: 3 }, check: (s, n) => (s.codex.sets || []).length >= n.setPieces },
  { id: 'jewel1', name: 'Juwelier', desc: 'Setze ein Juwel in die Sternenkarte ein', reward: { dust: 300 }, check: (s) => (s.stats.jewelsSocketed || 0) >= 1 },
  { id: 'jewel12', name: 'Juwelenkrone', desc: 'Setze 12 Juwele gleichzeitig ein', reward: { points: 2 }, check: (s) => (s.stats.maxJewels || 0) >= 12 },
  { id: 'jewelMythic', name: 'Sternenjuwel', desc: 'Finde ein mythisches Juwel', reward: { points: 1 }, check: (s) => (s.stats.mythicJewel || 0) >= 1 },
  { id: 'paragon10', name: 'Sternenmacht', desc: 'Investiere 10 Punkte in Sternenmacht', reward: { dust: 500 }, check: (s) => Object.values(s.paragon || {}).reduce((a, b) => a + b, 0) >= 10 },
  { id: 'paragon100', name: 'Sternengott', desc: 'Investiere 100 Punkte in Sternenmacht', reward: { points: 3 }, check: (s) => Object.values(s.paragon || {}).reduce((a, b) => a + b, 0) >= 100 },
  { id: 'runs50', name: 'Unermüdlich', desc: 'Spiele 50 Runs', reward: { points: 1 }, check: (s) => s.stats.runs >= 50 },
  { id: 'runs250', name: 'Besessen', desc: 'Spiele 250 Runs', reward: { points: 2 }, check: (s) => s.stats.runs >= 250 },
  { id: 'runs1000', name: 'Ewiger Wanderer', desc: 'Spiele 1.000 Runs', reward: { points: 5 }, check: (s) => s.stats.runs >= 1000 },
  { id: 'play10h', name: 'Zeitvertreib', desc: 'Spiele insgesamt 10 Stunden', reward: { points: 1 }, check: (s) => s.stats.playTime >= 36000 },
  { id: 'play100h', name: 'Lebenswerk', desc: 'Spiele insgesamt 100 Stunden', reward: { points: 3 }, check: (s) => s.stats.playTime >= 360000 },
  { id: 'dust100k', name: 'Sternenschatz', desc: 'Sammle insgesamt 100.000 Sternenstaub', reward: { points: 2 }, check: (s) => (s.stats.dustTotal || 0) >= 1e5 },
  { id: 'relic20', name: 'Reliquiar', desc: 'Besitze 20 Relikte', reward: { points: 1 }, check: (s) => s.relics.length >= 20 },
  { id: 'unique44', name: 'Museumsdirektor', desc: 'Entdecke 40 einzigartige Gegenstände', reward: { points: 2 }, check: (s) => s.codex.uniques.length >= 40 },
  { id: 'nofail', name: 'Makellos', desc: 'Gewinne einen Feldzug auf Sternenhöhe 5+ ohne Wiederbelebung', reward: { points: 2 }, check: (s) => (s.stats.cleanAscWin || -1) >= 5 },
  { id: 'proph9', name: 'Apokalyptiker', desc: 'Gewinne mit 9 aktiven Prophezeiungen', reward: { points: 5 }, check: (s) => (s.stats.maxProphWin || 0) >= 9 },
  { id: 'abyss150', name: 'Jenseits des Abgrunds', desc: 'Erreiche Ebene 150 im Abgrund', reward: { points: 5 }, check: (s) => s.stats.maxAbyss >= 150 },
  { id: 'hit1b', name: 'Supernova', desc: 'Verursache einen Treffer über 1 Milliarde', reward: { points: 5 }, check: (s) => s.stats.maxHit >= 1e9 },
  // ---- Erzfeinde, Zitadelle, Karten, Saison, Ligen, Runenmerkmale, Mythisch, Sternenbestien
  { id: 'nem1', name: 'Rachegelüste', desc: 'Vernichte einen Erzfeind', reward: { dust: 300 }, check: (s) => (s.stats.nemesisSlain || 0) >= 1 },
  { id: 'nem2', name: 'Kopfgeldjäger', desc: 'Vernichte 10 Erzfeinde', reward: { points: 1 }, check: (s) => (s.stats.nemesisSlain || 0) >= 10 },
  { id: 'nem3', name: 'Albtraumbrecher', desc: 'Vernichte 40 Erzfeinde', reward: { points: 2 }, check: (s) => (s.stats.nemesisSlain || 0) >= 40 },
  { id: 'nemR', name: 'Mein Untergang', desc: 'Lass einen Erzfeind Rang 5 erreichen', reward: { dust: 500 }, check: (s) => (s.stats.nemesisMax || 0) >= 5 },
  { id: 'bld1', name: 'Grundstein', desc: 'Errichte ein Gebäude in der Zitadelle', reward: { dust: 150 }, check: (s) => (s.stats.buildingUps || 0) >= 1 },
  { id: 'bld2', name: 'Baumeister', desc: 'Baue 25 Gebäudestufen aus', reward: { points: 1 }, check: (s) => (s.stats.buildingUps || 0) >= 25 },
  { id: 'bld3', name: 'Sternenzitadelle', desc: 'Baue 60 Gebäudestufen aus', reward: { points: 2 }, check: (s) => (s.stats.buildingUps || 0) >= 60 },
  { id: 'bldMax', name: 'Vollendet', desc: 'Baue ein Gebäude auf die Höchststufe aus', reward: { points: 1 }, check: (s) => Object.entries((s.base || {}).lvl || {}).some(([k, v]) => v >= (k === 'hatchery' ? 6 : 10)) },
  { id: 'pot1', name: 'Alchemist', desc: 'Braue einen Trank', reward: { dust: 150 }, check: (s) => (s.stats.potionsBrewed || 0) >= 1 },
  { id: 'pot2', name: 'Meisteralchemist', desc: 'Braue 30 Tränke', reward: { points: 1 }, check: (s) => (s.stats.potionsBrewed || 0) >= 30 },
  { id: 'card1', name: 'Schicksalsleser', desc: 'Sammle 20 verschiedene Schicksalskarten', reward: { dust: 400 }, check: (s) => Object.keys(s.cards || {}).length >= 20 },
  { id: 'card2', name: 'Kartenmeister', desc: 'Sammle 50 verschiedene Schicksalskarten', reward: { points: 1 }, check: (s) => Object.keys(s.cards || {}).length >= 50 },
  { id: 'card3', name: 'Herr des Schicksals', desc: 'Sammle alle 80 Schicksalskarten', reward: { points: 3 }, check: (s) => Object.keys(s.cards || {}).length >= 80 },
  { id: 'cardMax', name: 'Fünf Sterne', desc: 'Bringe eine Karte auf Stufe 5', reward: { dust: 600 }, check: (s) => Object.values(s.cards || {}).some((v) => v >= 5) },
  { id: 'seas1', name: 'Saisonstart', desc: 'Hole eine Saisonbelohnung ab', reward: { dust: 100 }, check: (s) => (s.stats.seasonClaims || 0) >= 1 },
  { id: 'seas2', name: 'Saisonveteran', desc: 'Hole 40 Saisonbelohnungen ab', reward: { points: 1 }, check: (s) => (s.stats.seasonClaims || 0) >= 40 },
  { id: 'seas3', name: 'Ewiger Champion', desc: 'Hole 120 Saisonbelohnungen ab', reward: { points: 2 }, check: (s) => (s.stats.seasonClaims || 0) >= 120 },
  { id: 'lea1', name: 'Ligaspieler', desc: 'Spiele einen Ligarun', reward: { dust: 200 }, check: (s) => (s.stats.leagueRuns || 0) >= 1 },
  { id: 'lea2', name: 'Ligastammgast', desc: 'Spiele 25 Ligaruns', reward: { points: 1 }, check: (s) => (s.stats.leagueRuns || 0) >= 25 },
  { id: 'arch1', name: 'Runensammler', desc: 'Entdecke 25 Runenvarianten', reward: { dust: 300 }, check: (s) => (s.runeArchive || []).length >= 25 },
  { id: 'arch2', name: 'Runenarchivar', desc: 'Entdecke 150 Runenvarianten', reward: { points: 1 }, check: (s) => (s.runeArchive || []).length >= 150 },
  { id: 'arch3', name: 'Lebende Bibliothek', desc: 'Entdecke 400 Runenvarianten', reward: { points: 2 }, check: (s) => (s.runeArchive || []).length >= 400 },
  { id: 'grind', name: 'Schleifer', desc: 'Schleife 20 Runen neu', reward: { dust: 400 }, check: (s) => (s.stats.grinds || 0) >= 20 },
  { id: 'beast1', name: 'Bestienjäger', desc: 'Besiege eine Sternenbestie im Atlas', reward: { points: 1 }, check: (s) => (s.stats.beasts || 0) >= 1 },
  { id: 'beast2', name: 'Bestienbezwinger', desc: 'Besiege 15 Sternenbestien', reward: { points: 2 }, check: (s) => (s.stats.beasts || 0) >= 15 },
  // ---- Spielmodi
  { id: 'tower1', name: 'Turmbesteiger', desc: 'Erklimme 10 Etagen im Sternenturm', reward: { points: 1 }, check: (s) => (s.stats.maxTower || 0) >= 10 },
  { id: 'tower2', name: 'Herr des Turms', desc: 'Erklimme 25 Etagen im Sternenturm', reward: { points: 2 }, check: (s) => (s.stats.maxTower || 0) >= 25 },
  { id: 'tower3', name: 'Himmelsstürmer', desc: 'Erklimme 45 Etagen im Sternenturm', reward: { points: 3 }, check: (s) => (s.stats.maxTower || 0) >= 45 },
  { id: 'towerTop', name: 'Wochensieger', desc: 'Belege Platz 1 in einer Wochenwertung des Sternenturms', reward: { points: 2 }, check: (s) => (s.stats.towerWins || 0) >= 1 },
  { id: 'rush1', name: 'Bosshatz', desc: 'Besiege 5 Bosse in einem Boss-Rush', reward: { points: 1 }, check: (s) => (s.stats.rushBest || 0) >= 5 },
  { id: 'rush2', name: 'Bezwinger aller', desc: 'Schließe einen Boss-Rush ab', reward: { points: 3 }, check: (s) => (s.stats.rushClears || 0) >= 1 },
  { id: 'rush3', name: 'Im Sturmschritt', desc: 'Schließe einen Boss-Rush mit unter 12 Minuten Kampfzeit ab', reward: { points: 3 }, check: (s) => (s.stats.rushFastest || 1e9) < 720 },
  { id: 'hunt1', name: 'Fährtenleserin', desc: 'Erlege eine Bestie in der Sternenjagd', reward: { points: 1 }, check: (s) => (s.stats.huntWins || 0) >= 1 },
  { id: 'hunt2', name: 'Meisterjäger', desc: 'Erlege eine Bestie auf Jagdstufe 5', reward: { points: 2 }, check: (s) => (s.stats.maxHunt || 0) >= 5 },
  { id: 'hunt3', name: 'Legende der Jagd', desc: 'Erlege eine Bestie auf Jagdstufe 10', reward: { points: 3 }, check: (s) => (s.stats.maxHunt || 0) >= 10 },
  // ---- Häuser & Sage
  { id: 'fac1', name: 'Verbündeter', desc: 'Werde bei einem Haus „Verbündet“', reward: { points: 1 }, check: (s) => Object.values(s.factions || {}).some((f) => f.rep >= 700) },
  { id: 'fac2', name: 'Diener dreier Herren', desc: 'Werde bei allen drei Häusern „Verbündet“', reward: { points: 3 }, check: (s) => ['glut', 'seher', 'leere'].every((k) => ((s.factions || {})[k] || { rep: 0 }).rep >= 700) },
  { id: 'fac3', name: 'Erhaben', desc: 'Erreiche bei einem Haus den höchsten Rang', reward: { points: 2 }, check: (s) => Object.values(s.factions || {}).some((f) => f.rep >= 2500) },
  { id: 'fac4', name: 'Auftragsbuch', desc: 'Erfülle 25 Aufträge der Häuser', reward: { points: 1 }, check: (s) => (s.stats.contracts || 0) >= 25 },
  { id: 'story1', name: 'Chronist', desc: 'Schalte 10 Kapitel der Sage frei', reward: { points: 1 }, check: (s) => ((s.story && s.story.seen) || []).length >= 10 },
  { id: 'story2', name: 'Die Feder liegt bei dir', desc: 'Schalte alle Kapitel der Sage frei', reward: { points: 3 }, check: (s) => ((s.story && s.story.seen) || []).length >= 20 },
  { id: 'evo1', name: 'Erwachen', desc: 'Lass eine Rune zur Evolution erwachen', reward: { dust: 300 }, check: (s) => (s.stats.evolutions || 0) >= 1 },
  { id: 'evo2', name: 'Formwandler', desc: 'Entdecke 20 verschiedene Evolutionen', reward: { points: 1 }, check: (s) => (s.codex.evos || []).length >= 20 },
  { id: 'evo3', name: 'Meister der Wandlung', desc: 'Entdecke alle 92 Evolutionen', reward: { points: 3 }, check: (s) => (s.codex.evos || []).length >= 92 },
  { id: 'craft1', name: 'Verderbte Kunst', desc: 'Korrumpiere einen Gegenstand', reward: { dust: 200 }, check: (s) => (s.stats.corrupts || 0) >= 1 },
  { id: 'craft2', name: 'Schmelztiegel', desc: 'Verschmelze 10 Gegenstände', reward: { points: 1 }, check: (s) => (s.stats.fuses || 0) >= 10 },
  { id: 'craft3', name: 'Unikatschmied', desc: 'Werte Unikate 5-mal auf', reward: { dust: 500 }, check: (s) => (s.stats.uqUps || 0) >= 5 },
  { id: 'build1', name: 'Architekt', desc: 'Speichere einen Build', reward: { dust: 100 }, check: (s) => (s.stats.buildsSaved || 0) >= 1 },
  { id: 'tree1', name: 'Sternendeuter', desc: 'Vervollständige ein Sternbild (Krönungsstern)', reward: { points: 1 }, check: (s) => (s.stats.legends || 0) >= 1 },
  { id: 'tree2', name: 'Himmelskartograf', desc: 'Weise 6 Krönungssterne zu', reward: { points: 2 }, check: (s) => (s.stats.legends || 0) >= 6 },
  { id: 'tree3', name: 'Torwächter', desc: 'Durchschreite ein Sternentor', reward: { dust: 400 }, check: (s) => (s.stats.portals || 0) >= 1 },
  { id: 'tree4', name: 'Meister aller Klassen', desc: 'Weise 10 Meisterschaften zu', reward: { points: 1 }, check: (s) => (s.stats.masteries || 0) >= 10 },
  { id: 'tree5', name: 'Mythenjäger', desc: 'Weise einen Mythos-Stern zu', reward: { dust: 500 }, check: (s) => (s.stats.myths || 0) >= 1 },
  { id: 'tree6', name: 'Weltenwanderer', desc: 'Habe 150 Sterne in einer Klasse zugewiesen', reward: { points: 3 }, check: (s) => (s.stats.maxTreeNodes || 0) >= 150 },
  { id: 'pack', name: 'Sammelwut', desc: 'Öffne 25 Kartenpacks', reward: { dust: 500 }, check: (s) => (s.stats.packsOpened || 0) >= 25 },
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

Object.assign(ASCENDANCIES, {
  fist: { cls: 'monk', name: 'Donnerfaust', desc: 'Jeder Schlag ein Gewitter.', nodes: [
    { name: 'Geladene Fäuste', mods: [more('dmg_melee', 20), flat('shockChance', 20)] },
    { name: 'Blitzschritt', mods: [flat('spec_moveStrike', 1), inc('move', 12)] },
    { name: 'Nachhall', mods: [flat('spec_aftershock', 1)] },
    { name: 'Hundert Hiebe', mods: [inc('speed_attack', 30), flat('spec_frenzy', 1)] },
    { name: 'Sturmherz', mods: [more('dmg_light', 25), flat('lvl_melee', 1)] },
  ] },
  ascetic: { cls: 'monk', name: 'Asket', desc: 'Leere den Geist, fülle die Faust.', nodes: [
    { name: 'Innere Ruhe', mods: [flat('spec_stillness', 1), flat('barrier', 50)] },
    { name: 'Sternenleib', mods: [flat('dodge', 10), inc('evasion', 50)] },
    { name: 'Gleichmut', mods: [flat('res_elem', 15), flat('lifeRegenPct', 1)] },
    { name: 'Klarheit', mods: [inc('crit', 50), flat('critMulti', 30)] },
    { name: 'Erleuchtung', mods: [more('dmg', 25), flat('lvl', 1)] },
  ] },
  beastmaster: { cls: 'hunter', name: 'Bestienmeisterin', desc: 'Das Rudel jagt mit ihr.', nodes: [
    { name: 'Rudelführerin', mods: [flat('minionCount', 1), inc('dmg_minion', 30)] },
    { name: 'Wilder Instinkt', mods: [inc('speed_minion', 25), inc('move', 10)] },
    { name: 'Blutgeruch', mods: [flat('bleedChance', 20), more('bleed', 20)] },
    { name: 'Alpha', mods: [more('dmg_minion', 30), flat('spec_minionLeech', 2)] },
    { name: 'Jagdgöttin', mods: [flat('lvl_minion', 1), flat('lvl_attack', 1)] },
  ] },
  bladewind: { cls: 'hunter', name: 'Klingenwind', desc: 'Kein Ziel entkommt der Glefe.', nodes: [
    { name: 'Weiter Wurf', mods: [inc('projSpeed', 30), flat('pierce', 2)] },
    { name: 'Heimkehr', mods: [flat('spec_return', 1)] },
    { name: 'Gabelung', mods: [flat('spec_fork', 1), more('dmg_proj', 10)] },
    { name: 'Klingensturm', mods: [flat('proj', 1), inc('speed_attack', 15)] },
    { name: 'Jagdfieber', mods: [more('dmg_attack', 25), more('dmgVsBoss', 20)] },
  ] },
  frostlord: { cls: 'chrono', name: 'Frostfürst', desc: 'Die Zeit gefriert in seiner Nähe.', nodes: [
    { name: 'Kälteeinbruch', mods: [inc('chillEffect', 50), flat('freezeChance', 10)] },
    { name: 'Eiskern', mods: [flat('spec_shatter', 1), inc('dmg_cold', 30)] },
    { name: 'Frostaura', mods: [flat('spec_chillAura', 1), flat('res_cold', 25)] },
    { name: 'Gletscherherz', mods: [flat('pen_cold', 20), flat('lvl_cold', 1)] },
    { name: 'Absoluter Nullpunkt', mods: [more('dmg_cold', 35)] },
  ] },
  keeper: { cls: 'chrono', name: 'Hüter der Stunden', desc: 'Er dehnt jeden Augenblick.', nodes: [
    { name: 'Gedehnte Zeit', mods: [inc('dur', 40), inc('ailDur', 30)] },
    { name: 'Zeitschleife', mods: [flat('spec_echoAll', 1)] },
    { name: 'Vorahnung', mods: [flat('dodge', 12), more('dmgTaken', -10)] },
    { name: 'Ewiger Moment', mods: [more('dmg_dot', 30), more('dur', 15)] },
    { name: 'Herr der Zeit', mods: [more('speed', 20), flat('lvl', 1)] },
  ] },
});

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
  { id: 'tower', text: (n) => `Erklimme ${n} Etagen im Sternenturm`, target: (l) => 5 + Math.floor(l / 4), key: 'runTower', minLvl: 4 },
  { id: 'rush', text: (n) => `Besiege ${n} Bosse in einem Boss-Rush`, target: (l) => Math.min(10, 3 + Math.floor(l / 10)), key: 'runRush', need: (s) => Object.values(s.stats.bossKills || {}).filter((v) => v > 0).length >= 3 },
  { id: 'hunt', text: () => 'Erlege eine Bestie in der Sternenjagd', target: () => 1, key: 'runHunt', need: (s) => Object.keys(s.stats.wins || {}).length > 0 },
  { id: 'gold', text: (n) => `Sammle ${n} Gold in einem Run`, target: (l) => 300 + l * 20, key: 'runGold' },
  { id: 'proph', text: (n) => (n === 1 ? 'Beende einen Run mit einer Prophezeiung' : `Beende einen Run mit ${n} Prophezeiungen`), target: (l) => Math.min(4, 1 + Math.floor(l / 20)), key: 'runProph', minLvl: 6 },
  { id: 'class', text: () => 'Spiele einen Run mit einer anderen Klasse als zuletzt', target: () => 1, key: 'runNewClass' },
];
