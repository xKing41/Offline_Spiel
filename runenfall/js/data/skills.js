// Aktive Fertigkeiten ("Runen") und Glyphen (Unterstützungen, die in Fertigkeiten gesockelt werden).
//
// Fertigkeit:
//   tags  – Kategorien (spell/attack/proj/area/...) plus Schadensarten (phys/fire/...).
//   beh   – Verhalten im Kampf: proj, nova, chain, orbit, zone, melee, minion, meteor, aura, trap
//   cd    – Grund-Intervall in Sekunden (wird durch Tempo verkürzt)
//   dmg   – Trefferschaden je Art [min, max]  ·  dps – Schaden pro Sekunde (für Flächen ohne Treffer)
//   eff   – Wirksamkeit von hinzugefügtem Schaden
//   lvl3 / lvl5 – Zusatz-Modifikatoren ab Stufe 3 bzw. 5
//   cost  – Sternenstaub zum Freischalten im Kodex (0 = von Anfang an verfügbar)

export const SKILLS = {
  starbolt: {
    name: 'Sternenpfeil', tags: ['spell', 'proj', 'hit', 'phys'], beh: 'proj',
    cd: 0.75, dmg: { phys: [5, 9] }, crit: 6, eff: 1,
    count: 1, speed: 470, spread: 0.18, homing: 3, size: 6, range: 560,
    lvl3: [{ s: 'proj', v: 1 }], lvl5: [{ s: 'pierce', v: 1 }],
    desc: 'Ein suchender Splitter aus Sternenlicht, der sich ins Ziel lenkt.', cost: 0,
  },
  fireball: {
    name: 'Feuerball', tags: ['spell', 'proj', 'area', 'hit', 'fire'], beh: 'proj',
    cd: 1.2, dmg: { fire: [10, 16] }, crit: 6, eff: 1.1,
    count: 1, speed: 400, spread: 0.2, size: 8, explode: 42, range: 560, ign: 25,
    lvl3: [{ s: 'area', t: 'inc', v: 20 }], lvl5: [{ s: 'proj', v: 1 }],
    desc: 'Explodiert beim Aufprall und kann Gegner entzünden.', cost: 0,
  },
  frostshard: {
    name: 'Frostsplitter', tags: ['spell', 'proj', 'hit', 'cold'], beh: 'proj',
    cd: 1.0, dmg: { cold: [5, 8] }, crit: 6, eff: 0.8,
    count: 3, speed: 520, spread: 0.3, pierce: 1, size: 6, range: 520, frz: 5,
    lvl3: [{ s: 'proj', v: 1 }], lvl5: [{ s: 'pierce', v: 1 }],
    desc: 'Ein Fächer aus Eissplittern, der Gegner durchbohrt und unterkühlt.', cost: 0,
  },
  arrows: {
    name: 'Pfeilhagel', tags: ['attack', 'proj', 'hit', 'phys'], beh: 'proj',
    cd: 0.7, dmg: { phys: [6, 10] }, crit: 7, eff: 1,
    count: 2, speed: 620, spread: 0.18, size: 5, range: 600,
    lvl3: [{ s: 'proj', v: 1 }], lvl5: [{ s: 'crit', t: 'inc', v: 40 }],
    desc: 'Schnelle Pfeilsalven – ideal für kritische Treffer.', cost: 0,
  },
  bloodlance: {
    name: 'Blutlanze', tags: ['attack', 'proj', 'hit', 'phys'], beh: 'proj',
    cd: 1.3, dmg: { phys: [14, 24] }, crit: 6, eff: 1.3,
    count: 1, speed: 680, spread: 0.15, pierce: 3, size: 9, range: 640, bld: 35,
    lvl3: [{ s: 'pierce', v: 1 }], lvl5: [{ s: 'bleed', t: 'inc', v: 40 }],
    desc: 'Eine durchbohrende Lanze, die tiefe Wunden reißt.', cost: 200,
  },
  frostnova: {
    name: 'Frostnova', tags: ['spell', 'area', 'hit', 'cold'], beh: 'nova',
    cd: 2.4, dmg: { cold: [11, 17] }, crit: 5, eff: 1.2, area: 115, frz: 12,
    lvl3: [{ s: 'area', t: 'inc', v: 15 }], lvl5: [{ s: 'speed', t: 'inc', v: 15 }],
    desc: 'Eine eisige Welle rund um dich, die Gegner einfrieren kann.', cost: 0,
  },
  chainlight: {
    name: 'Kettenblitz', tags: ['spell', 'chain', 'hit', 'light'], beh: 'chain',
    cd: 0.95, dmg: { light: [3, 19] }, crit: 6, eff: 0.9, chain: 3, range: 320, shk: 20,
    lvl3: [{ s: 'chain', v: 1 }], lvl5: [{ s: 'chain', v: 1 }],
    desc: 'Ein Blitz, der von Gegner zu Gegner springt.', cost: 0,
  },
  blades: {
    name: 'Klingenwirbel', tags: ['attack', 'melee', 'orbit', 'hit', 'phys'], beh: 'orbit',
    cd: 0.45, dmg: { phys: [6, 10] }, crit: 6, eff: 0.7, count: 2, area: 78,
    lvl3: [{ s: 'proj', v: 1 }], lvl5: [{ s: 'proj', v: 1 }],
    desc: 'Klingen kreisen dauerhaft um dich. Tempo erhöht die Trefferrate.', cost: 0,
  },
  plague: {
    name: 'Seuchenwolke', tags: ['spell', 'area', 'dot', 'dur', 'chaos'], beh: 'zone',
    cd: 2.1, dps: { chaos: 10 }, eff: 0.6, area: 66, dur: 4,
    lvl3: [{ s: 'dur', t: 'inc', v: 25 }], lvl5: [{ s: 'area', t: 'inc', v: 25 }],
    desc: 'Eine giftige Wolke, die Schaden über Zeit verursacht.', cost: 150,
  },
  slam: {
    name: 'Schmetterschlag', tags: ['attack', 'melee', 'area', 'hit', 'phys'], beh: 'melee',
    cd: 1.05, dmg: { phys: [16, 26] }, crit: 5, eff: 1.4, area: 70, reach: 80,
    lvl3: [{ s: 'area', t: 'inc', v: 20 }], lvl5: [{ s: 'speed', t: 'inc', v: 15 }],
    desc: 'Ein wuchtiger Schlag, der alle Gegner im Umkreis trifft.', cost: 0,
  },
  wisps: {
    name: 'Irrlichter', tags: ['minion', 'spell', 'proj', 'hit', 'light'], beh: 'minion', kind: 'wisp',
    cd: 0.9, dmg: { light: [5, 9] }, crit: 5, eff: 0.8, count: 2,
    lvl3: [{ s: 'minionCount', v: 1 }], lvl5: [{ s: 'minionCount', v: 1 }],
    desc: 'Beschwört Irrlichter, die Gegner mit Blitzen beschießen.', cost: 200,
  },
  skeletons: {
    name: 'Knochenwächter', tags: ['minion', 'melee', 'hit', 'phys'], beh: 'minion', kind: 'skeleton',
    cd: 1.0, dmg: { phys: [9, 14] }, crit: 5, eff: 1, count: 2,
    lvl3: [{ s: 'minionCount', v: 1 }], lvl5: [{ s: 'minionCount', v: 1 }],
    desc: 'Untote Krieger, die für dich in den Nahkampf stürmen.', cost: 250,
  },
  meteor: {
    name: 'Meteor', tags: ['spell', 'area', 'hit', 'fire'], beh: 'meteor',
    cd: 3.0, dmg: { fire: [38, 58] }, crit: 6, eff: 1.8, area: 95, delay: 0.7, ign: 35, count: 1,
    lvl3: [{ s: 'area', t: 'inc', v: 15 }], lvl5: [{ s: 'proj', v: 1 }],
    desc: 'Ruft einen Meteor herab – langsam, aber verheerend.', cost: 300,
  },
  emberaura: {
    name: 'Glutaura', tags: ['spell', 'aura', 'area', 'dot', 'fire'], beh: 'aura',
    cd: 0.5, dps: { fire: 8 }, eff: 0.5, area: 95,
    lvl3: [{ s: 'area', t: 'inc', v: 15 }], lvl5: [{ s: 'dmg', t: 'more', v: 20 }],
    desc: 'Verbrennt ständig alle Gegner in deiner Nähe.', cost: 250,
  },
  runetrap: {
    name: 'Runenfalle', tags: ['trap', 'area', 'hit', 'light'], beh: 'trap',
    cd: 1.4, dmg: { light: [12, 26] }, crit: 6, eff: 1.3, area: 72, max: 5, shk: 15,
    lvl3: [{ s: 'area', t: 'inc', v: 15 }], lvl5: [{ s: 'spec_trapMax', v: 2 }],
    desc: 'Wirft Runen, die explodieren, sobald ein Gegner sie berührt.', cost: 200,
  },
  venomfan: {
    name: 'Giftfächer', tags: ['attack', 'proj', 'hit', 'phys', 'chaos'], beh: 'proj',
    cd: 0.9, dmg: { phys: [3, 5], chaos: [2, 4] }, crit: 6, eff: 0.6,
    count: 5, speed: 540, spread: 0.26, size: 5, range: 460, psn: 50,
    lvl3: [{ s: 'proj', v: 2 }], lvl5: [{ s: 'poison', t: 'inc', v: 30 }],
    desc: 'Ein Fächer vergifteter Dolche.', cost: 200,
  },
};

export const DMG_TYPE_TAGS = new Set(['phys', 'fire', 'cold', 'light', 'chaos']);
export const catTags = (def) => def.tags.filter((t) => !DMG_TYPE_TAGS.has(t));

// ---------------------------------------------------------------------------
// Glyphen. req = mindestens einer dieser Tags muss passen (leer = passt überall).
export const SUPPORTS = {
  multi: {
    name: 'Mehrfachgeschoss', req: ['proj', 'orbit'],
    mods: [{ s: 'proj', v: 2 }, { s: 'dmg', t: 'more', v: -25 }], cost: 0,
  },
  pierce: {
    name: 'Durchschlag', req: ['proj'],
    mods: [{ s: 'pierce', v: 2 }, { s: 'dmg_proj', t: 'inc', v: 20 }], cost: 0,
  },
  chainsup: {
    name: 'Kettenreaktion', req: ['proj', 'chain'],
    mods: [{ s: 'chain', v: 2 }, { s: 'dmg', t: 'more', v: -15 }], cost: 150,
  },
  conc: {
    name: 'Konzentrierter Effekt', req: ['area'],
    mods: [{ s: 'area', t: 'more', v: -30 }, { s: 'dmg_area', t: 'more', v: 45 }], cost: 0,
  },
  wide: {
    name: 'Weite Fläche', req: ['area', 'aura', 'orbit'],
    mods: [{ s: 'area', t: 'inc', v: 45 }], cost: 0,
  },
  brutal: {
    name: 'Brutalität', req: ['phys'],
    mods: [{ s: 'dmg_phys', t: 'more', v: 40 }, { s: 'dmg_elem', t: 'more', v: -100 }, { s: 'dmg_chaos', t: 'more', v: -100 }], cost: 150,
  },
  elemfocus: {
    name: 'Elementarfokus', req: ['fire', 'cold', 'light'],
    mods: [{ s: 'dmg_elem', t: 'more', v: 35 }, { s: 'spec_noAil', v: 1 }], cost: 150,
  },
  fireinf: {
    name: 'Glut-Infusion', req: ['hit', 'dot'],
    mods: [{ s: 'conv_phys_fire', v: 60 }, { s: 'conv_cold_fire', v: 60 }, { s: 'conv_light_fire', v: 60 }, { s: 'dmg_fire', t: 'more', v: 10 }], cost: 200,
  },
  coldinf: {
    name: 'Frost-Infusion', req: ['hit', 'dot'],
    mods: [{ s: 'conv_phys_cold', v: 60 }, { s: 'conv_light_cold', v: 60 }, { s: 'dmg_cold', t: 'more', v: 10 }], cost: 200,
  },
  lightinf: {
    name: 'Sturm-Infusion', req: ['hit', 'dot'],
    mods: [{ s: 'conv_phys_light', v: 60 }, { s: 'dmg_light', t: 'more', v: 10 }], cost: 200,
  },
  voidinf: {
    name: 'Leeren-Infusion', req: ['hit', 'dot'],
    mods: [{ s: 'conv_phys_chaos', v: 40 }, { s: 'conv_fire_chaos', v: 40 }, { s: 'conv_cold_chaos', v: 40 }, { s: 'conv_light_chaos', v: 40 }, { s: 'poisonChance', v: 20 }], cost: 250,
  },
  haste: {
    name: 'Beschleunigung', req: [],
    mods: [{ s: 'speed', t: 'more', v: 30 }, { s: 'dmg', t: 'more', v: -10 }], cost: 0,
  },
  precision: {
    name: 'Präzision', req: ['hit'],
    mods: [{ s: 'critBase', v: 3 }, { s: 'crit', t: 'inc', v: 60 }, { s: 'critMulti', v: 40 }], cost: 0,
  },
  ignite: {
    name: 'Entzünden', req: ['hit'],
    mods: [{ s: 'igniteChance', v: 40 }, { s: 'burn', t: 'inc', v: 30 }], cost: 100,
  },
  venom: {
    name: 'Giftklinge', req: ['hit'],
    mods: [{ s: 'poisonChance', v: 50 }, { s: 'poison', t: 'inc', v: 25 }], cost: 100,
  },
  hemo: {
    name: 'Aderlass', req: ['hit'],
    mods: [{ s: 'bleedChance', v: 50 }, { s: 'bleed', t: 'inc', v: 30 }], cost: 150,
  },
  hypo: {
    name: 'Unterkühlung', req: ['cold'],
    mods: [{ s: 'freezeChance', v: 20 }, { s: 'chillEffect', t: 'inc', v: 50 }, { s: 'dmgVsAilment', t: 'inc', v: 25 }], cost: 150,
  },
  overload: {
    name: 'Überladung', req: ['light'],
    mods: [{ s: 'shockChance', v: 30 }, { s: 'shockEffect', t: 'inc', v: 50 }], cost: 150,
  },
  leechsup: {
    name: 'Lebensraub', req: ['hit'],
    mods: [{ s: 'leech', v: 2.5 }], cost: 100,
  },
  lasting: {
    name: 'Beständigkeit', req: ['dur', 'dot', 'minion', 'trap'],
    mods: [{ s: 'dur', t: 'inc', v: 50 }, { s: 'dmg_dot', t: 'more', v: 20 }], cost: 150,
  },
  echo: {
    name: 'Zauberecho', req: ['spell'],
    mods: [{ s: 'spec_echo', v: 1 }, { s: 'dmg', t: 'more', v: -10 }], cost: 300,
  },
  controlled: {
    name: 'Kontrollierte Zerstörung', req: ['spell'],
    mods: [{ s: 'dmg_spell', t: 'more', v: 35 }, { s: 'crit', t: 'inc', v: -100 }], cost: 200,
  },
  execute: {
    name: 'Henker', req: ['hit'],
    mods: [{ s: 'dmgVsLow', t: 'more', v: 60 }], cost: 150,
  },
  horde: {
    name: 'Horde', req: ['minion'],
    mods: [{ s: 'minionCount', v: 1 }, { s: 'dmg_minion', t: 'more', v: 20 }], cost: 200,
  },
  corpse: {
    name: 'Leichenexplosion', req: ['hit'],
    mods: [{ s: 'spec_killExplode', v: 8 }], cost: 250,
  },
  swift: {
    name: 'Geschossflug', req: ['proj'],
    mods: [{ s: 'projSpeed', t: 'inc', v: 50 }, { s: 'dmg_proj', t: 'more', v: 15 }], cost: 100,
  },
  ruthless: {
    name: 'Rücksichtslos', req: ['melee'],
    mods: [{ s: 'spec_ruthless', v: 120 }], cost: 150,
  },
  trapper: {
    name: 'Fallenkunde', req: ['trap'],
    mods: [{ s: 'spec_trapMax', v: 3 }, { s: 'speed_trap', t: 'more', v: 25 }], cost: 150,
  },
};

export const supportFits = (sup, def) => !sup.req.length || sup.req.some((t) => def.tags.includes(t));

export const MAX_SKILLS = 4;
export const SOCKETS = 3;
export const MAX_SKILL_LVL = 7;
