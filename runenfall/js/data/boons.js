// Segen beim Stufenaufstieg: zehn Pfade mit je vier Stufen, Vertiefungen, Bund-Segen für Pfad-Paare und wenige Grundsegen.
// Ab Stufe II verändert ein Pfad, wie dein Build funktioniert. Höchstens drei Pfade pro Run.

const inc = (s, v) => ({ s, t: 'inc', v });
const more = (s, v) => ({ s, t: 'more', v });
const flat = (s, v) => ({ s, v });

export const MAX_PATHS = 3;
/** Mindest-Run-Stufe je Pfadstufe (Index = Stufe). */
export const TIER_LVL = [0, 1, 4, 9, 15];
export const ROMAN = ['', 'I', 'II', 'III', 'IV'];

// Einfache Sinnbilder (24×24), einheitlich auf allen Geräten
const ICON = {
  glut: '<path d="M12 2c.8 3.2-1.6 4.6-1.6 7.2 0 1.4.9 2.3 1.9 2.3 1.3 0 2-1.2 1.5-3.1 2.6 1.7 3.9 4.3 3.9 6.9A5.7 5.7 0 0 1 12 21a5.7 5.7 0 0 1-5.7-5.7C6.3 10.7 9.4 7.5 12 2z"/>',
  frost: '<path d="M11 2h2v4.3l2.6-1.5 1 1.7L13 8.6V11h2.4l2.1-3.6 1.7 1-1.5 2.6H22v2h-4.3l1.5 2.6-1.7 1-2.1-3.6H13v2.4l3.6 2.1-1 1.7-2.6-1.5V22h-2v-4.3l-2.6 1.5-1-1.7L11 15.4V13H8.6l-2.1 3.6-1.7-1L6.3 13H2v-2h4.3L4.8 8.4l1.7-1L8.6 11H11V8.6L7.4 6.5l1-1.7L11 6.3z"/>',
  sturm: '<path d="M13.5 2 4.5 13.5h6L9.5 22l10-12.5h-6.2z"/>',
  seuche: '<path d="M12 2.5s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 9.5 12 2.5 12 2.5zm-2.2 10.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm4.6-2.4a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/>',
  klinge: '<path d="M12 1.5 14 5v9.5h3.2v2h-3.6V21h-3.2v-4.5H6.8v-2H10V5z"/>',
  geschoss: '<path d="M21.5 2.5 13 5l2.4 2.4-11 11L3 21l2.6-1.4 11-11L19 11z"/>',
  erschuetterung: '<path d="M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0-5.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zm0 2a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z"/>',
  legion: '<path d="M12 3.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm-6.5 3a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8zm13 0a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8zM12 11c3.3 0 5 2.2 5 5v4H7v-4c0-2.8 1.7-5 5-5zm-6.5 1.4c.5 0 1 .1 1.4.2-.6.9-.9 2.1-.9 3.4v3H1.5v-2.6c0-2.3 1.6-4 4-4zm13 0c2.4 0 4 1.7 4 4V19H18v-3c0-1.3-.3-2.5-.9-3.4.4-.1.9-.2 1.4-.2z"/>',
  praezision: '<path d="M11 1.5h2v3.1A7.6 7.6 0 0 1 19.4 11h3.1v2h-3.1a7.6 7.6 0 0 1-6.4 6.4v3.1h-2v-3.1A7.6 7.6 0 0 1 4.6 13H1.5v-2h3.1A7.6 7.6 0 0 1 11 4.6zm1 5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zm0 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>',
  bollwerk: '<path d="M12 2 20.5 5.2v6.3c0 5.2-3.6 9.1-8.5 10.9-4.9-1.8-8.5-5.7-8.5-10.9V5.2z"/>',
  bund: '<path d="M8.5 5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zm7 0a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zm-3.5 2.2a4.5 4.5 0 0 0 0 8.6 4.5 4.5 0 0 0 0-8.6z"/>',
};

/** Pfade: Name, Farbe, passende Runen-Tags (leer = passt immer), Kurzbeschreibung. */
export const PATHS = {
  glut: { name: 'Glut', color: '#ff7a2a', tags: ['fire'], desc: 'Brände, die sich stapeln, überspringen und explodieren.' },
  frost: { name: 'Frost', color: '#62d6ff', tags: ['cold'], desc: 'Kälte, die Gegner verwundbar macht und zersplittern lässt.' },
  sturm: { name: 'Sturm', color: '#ffe34d', tags: ['light'], desc: 'Schocks, die überspringen – und Blitze bei jedem Schritt.' },
  seuche: { name: 'Seuche', color: '#9cff5e', tags: ['chaos'], desc: 'Gift, das schwächt, ansteckt und unaufhaltsam wächst.' },
  klinge: { name: 'Klinge', color: '#e6dccb', tags: ['phys'], desc: 'Blutungen, Raserei und vernichtende Schläge.' },
  geschoss: { name: 'Geschosse', color: '#7dffb0', tags: ['proj', 'orbit', 'chain'], desc: 'Geschosse, die sich teilen, zurückkehren und den Himmel füllen.' },
  erschuetterung: { name: 'Erschütterung', color: '#ffb36b', tags: ['area', 'aura', 'trap'], desc: 'Flächen, die nachbeben, Leichen sprengen und die Erde spalten.' },
  legion: { name: 'Legion', color: '#c58bff', tags: ['minion'], desc: 'Mehr Begleiter, die dich heilen und Gegner markieren.' },
  praezision: { name: 'Präzision', color: '#ff6b8a', tags: ['hit'], desc: 'Kritische Treffer, die springen und explodieren.' },
  bollwerk: { name: 'Bollwerk', color: '#b9c3d6', tags: [], desc: 'Leben, Dornen, Barriere – und ein zweites Leben.' },
};
export const PATH_IDS = Object.keys(PATHS);
export const pathIcon = (id, cls = '') => `<svg class="picon ${cls}" viewBox="0 0 24 24" fill="currentColor" style="color:${id === 'bund' ? '#ffd84d' : PATHS[id].color}" aria-hidden="true">${ICON[id]}</svg>`;

const P = (path, tier, id, name, mods) => ({ id, path, tier, name, mods, fixed: true });
const D = (path, name, mods) => ({ id: `${path}_v`, path, deep: true, name, mods });
const B = (a, b, id, name, mods) => ({ id, bund: [a, b], name, mods, fixed: true });
const G = (id, name, mods, extra = {}) => ({ id, generic: true, name, mods, ...extra });

export const BOONS = [
  // ---------------------------------------------------------------- Glut
  P('glut', 1, 'glut1', 'Funkenflug', [inc('dmg_fire', 30), flat('igniteChance', 15)]),
  P('glut', 2, 'glut2', 'Schwelbrand', [flat('spec_burnStack', 1), inc('burn', 15)]),
  P('glut', 3, 'glut3', 'Flächenbrand', [flat('spec_burnSpread', 1), inc('burn', 20)]),
  P('glut', 4, 'glut4', 'Inferno', [flat('spec_burnExplode', 20)]),
  D('glut', 'Glut schüren', [inc('dmg_fire', 12), inc('burn', 8)]),
  // ---------------------------------------------------------------- Frost
  P('frost', 1, 'frost1', 'Raureif', [inc('dmg_cold', 30), inc('chillEffect', 25)]),
  P('frost', 2, 'frost2', 'Zersplittern', [flat('spec_shatter', 1), flat('freezeChance', 6)]),
  P('frost', 3, 'frost3', 'Kältebiss', [flat('spec_chillVuln', 20)]),
  P('frost', 4, 'frost4', 'Ewiger Winter', [flat('spec_chillAura', 1), flat('spec_frozenVuln', 30)]),
  D('frost', 'Eis verdichten', [inc('dmg_cold', 12), flat('freezeChance', 2)]),
  // ---------------------------------------------------------------- Sturm
  P('sturm', 1, 'sturm1', 'Ladung', [inc('dmg_light', 30), flat('shockChance', 15)]),
  P('sturm', 2, 'sturm2', 'Überschlag', [flat('spec_shockSpread', 1), inc('shockEffect', 20)]),
  P('sturm', 3, 'sturm3', 'Sturmläufer', [flat('spec_moveStrike', 1), inc('dmg_light', 10)]),
  P('sturm', 4, 'sturm4', 'Gewitterfront', [flat('spec_stormCall', 20)]),
  D('sturm', 'Spannung erhöhen', [inc('dmg_light', 12), flat('shockChance', 4)]),
  // ---------------------------------------------------------------- Seuche
  P('seuche', 1, 'seuche1', 'Toxin', [inc('dmg_chaos', 30), flat('poisonChance', 20)]),
  P('seuche', 2, 'seuche2', 'Zersetzung', [flat('spec_poisonVuln', 15), inc('poison', 15)]),
  P('seuche', 3, 'seuche3', 'Ansteckung', [flat('spec_poisonSpread', 1), inc('poison', 15)]),
  P('seuche', 4, 'seuche4', 'Virulenz', [flat('spec_virulent', 1), inc('poison', 30)]),
  D('seuche', 'Gift konzentrieren', [inc('dmg_chaos', 12), inc('poison', 8)]),
  // ---------------------------------------------------------------- Klinge
  P('klinge', 1, 'klinge1', 'Schärfe', [inc('dmg_phys', 30), flat('bleedChance', 15)]),
  P('klinge', 2, 'klinge2', 'Blutrausch', [flat('spec_frenzy', 1), inc('bleed', 15)]),
  P('klinge', 3, 'klinge3', 'Berserker', [flat('spec_berserk', 1), inc('bleed', 20)]),
  P('klinge', 4, 'klinge4', 'Gnadenlos', [flat('spec_ruthless', 100)]),
  D('klinge', 'Klingen wetzen', [inc('dmg_phys', 12), inc('bleed', 8)]),
  // ---------------------------------------------------------------- Geschosse
  P('geschoss', 1, 'geschoss1', 'Schützenblick', [inc('dmg_proj', 20), flat('pierce', 1)]),
  P('geschoss', 2, 'geschoss2', 'Gabelung', [flat('spec_fork', 1)]),
  P('geschoss', 3, 'geschoss3', 'Bumerang', [flat('spec_return', 1)]),
  P('geschoss', 4, 'geschoss4', 'Salve', [flat('proj', 1), flat('chain', 1)]),
  D('geschoss', 'Zielübung', [inc('dmg_proj', 12), inc('projSpeed', 10)]),
  // ---------------------------------------------------------------- Erschütterung
  P('erschuetterung', 1, 'erschuetterung1', 'Weite', [inc('area', 25), inc('dmg_area', 15)]),
  P('erschuetterung', 2, 'erschuetterung2', 'Nachbeben', [flat('spec_aftershock', 1)]),
  P('erschuetterung', 3, 'erschuetterung3', 'Kettensprengung', [flat('spec_killExplode', 10)]),
  P('erschuetterung', 4, 'erschuetterung4', 'Großbeben', [flat('spec_quake', 1)]),
  D('erschuetterung', 'Wucht', [inc('dmg_area', 12), inc('area', 6)]),
  // ---------------------------------------------------------------- Legion
  P('legion', 1, 'legion1', 'Heerruf', [inc('dmg_minion', 30), inc('speed_minion', 10)]),
  P('legion', 2, 'legion2', 'Verstärkung', [flat('minionCount', 1)]),
  P('legion', 3, 'legion3', 'Blutband', [flat('spec_minionLeech', 2), inc('dmg_minion', 20)]),
  P('legion', 4, 'legion4', 'Kriegsbanner', [flat('spec_minionMark', 20)]),
  D('legion', 'Drill', [inc('dmg_minion', 12), inc('speed_minion', 5)]),
  // ---------------------------------------------------------------- Präzision
  P('praezision', 1, 'praezision1', 'Fokus', [flat('critBase', 3), inc('crit', 50), flat('critMulti', 50)]),
  P('praezision', 2, 'praezision2', 'Kettenreaktion', [flat('spec_critChain', 1)]),
  P('praezision', 3, 'praezision3', 'Ruhige Hand', [flat('spec_stillness', 1), flat('critBase', 1)]),
  P('praezision', 4, 'praezision4', 'Supernova', [flat('spec_critExplode', 30)]),
  D('praezision', 'Zielsicherheit', [flat('critBase', 1), inc('crit', 15), flat('critMulti', 15)]),
  // ---------------------------------------------------------------- Bollwerk
  P('bollwerk', 1, 'bollwerk1', 'Standhaft', [inc('life', 20), flat('armor', 80)]),
  P('bollwerk', 2, 'bollwerk2', 'Dornen', [flat('spec_thorns', 150), inc('armor', 20)]),
  P('bollwerk', 3, 'bollwerk3', 'Sternenwall', [flat('spec_bulwark', 1), flat('barrier', 40), inc('barrier', 30)]),
  P('bollwerk', 4, 'bollwerk4', 'Phönixschwur', [flat('spec_rebirth', 1), more('dmgTaken', -10)]),
  D('bollwerk', 'Abhärtung', [inc('life', 8), flat('res_elem', 8)]),

  // ---------------------------------------------------------------- Bund-Segen (beide Pfade ab Stufe II)
  B('glut', 'geschoss', 'bund_brandpfeile', 'Brandpfeile', [flat('spec_projBurst', 40)]),
  B('glut', 'erschuetterung', 'bund_feuersturm', 'Feuersturm', [flat('spec_areaIgnite', 1), inc('dmg_area', 15)]),
  B('glut', 'klinge', 'bund_gluehklingen', 'Glühende Klingen', [flat('conv_phys_fire', 40), inc('burn', 20)]),
  B('glut', 'seuche', 'bund_brandgift', 'Brandgift', [flat('spec_toxicFire', 35)]),
  B('glut', 'legion', 'bund_feuerlegion', 'Feuerlegion', [flat('spec_minionBurn', 1)]),
  B('frost', 'sturm', 'bund_supraleiter', 'Supraleiter', [flat('spec_superconduct', 40)]),
  B('frost', 'erschuetterung', 'bund_lawine', 'Lawine', [flat('spec_avalanche', 1), flat('freezeChance', 5)]),
  B('frost', 'geschoss', 'bund_eissplitter', 'Eissplitter', [flat('spec_iceShards', 1), inc('dmgVsChill', 25)]),
  B('frost', 'legion', 'bund_frostlegion', 'Frostlegion', [flat('spec_minionChill', 1), inc('dmgVsChill', 20), inc('dmg_minion', 15)]),
  B('sturm', 'geschoss', 'bund_blitzgeschosse', 'Blitzgeschosse', [flat('spec_projArc', 40)]),
  B('sturm', 'praezision', 'bund_gewitterauge', 'Gewitterauge', [flat('spec_critShock', 1), inc('crit', 30), inc('dmgVsShock', 15)]),
  B('sturm', 'legion', 'bund_sturmlegion', 'Sturmlegion', [flat('spec_minionShock', 1), inc('dmgVsShock', 20), inc('dmg_minion', 15)]),
  B('seuche', 'legion', 'bund_seuchentraeger', 'Seuchenträger', [flat('spec_minionPoison', 30)]),
  B('seuche', 'erschuetterung', 'bund_giftnebel', 'Giftnebel', [flat('spec_areaPoison', 25), inc('poison', 15)]),
  B('klinge', 'praezision', 'bund_halsschlagader', 'Halsschlagader', [flat('spec_critBleed', 1), inc('bleed', 30), inc('dmgVsBleed', 20)]),
  B('klinge', 'bollwerk', 'bund_blutwall', 'Blutwall', [flat('spec_thornsBleed', 1), inc('armor', 30)]),
  B('geschoss', 'praezision', 'bund_kopfschuss', 'Kopfschuss', [flat('spec_firstCrit', 50)]),
  B('legion', 'bollwerk', 'bund_ehrengarde', 'Ehrengarde', [flat('spec_minionBarrier', 3), flat('barrier', 30)]),

  // ---------------------------------------------------------------- Grundsegen (Seltenheit verstärkt sie)
  G('g_dmg', 'Kraft', [inc('dmg', 8)]),
  G('g_life', 'Lebenskraft', [inc('life', 8)]),
  G('g_res', 'Elementarschutz', [flat('res_elem', 8)]),
  G('g_resC', 'Chaosschutz', [flat('res_chaos', 10)]),
  G('g_speed', 'Eile', [inc('speed', 6)]),
  G('g_move', 'Leichtfuß', [inc('move', 6), inc('magnet', 15)]),
  G('g_barrier', 'Schutzschimmer', [flat('barrier', 15)]),
  G('g_regen', 'Erneuerung', [flat('lifeRegen', 1.5)]),
  G('g_xp', 'Wissbegier', [inc('xp', 10)]),
  G('g_luck', 'Fortuna', [inc('luck', 15), inc('gold', 10)]),
  G('g_lvl', 'Runenmacht', [flat('lvl', 1)], { fixed: true, minRarity: 2, rare: true }),
];
export const boonDef = (id) => BOONS.find((b) => b.id === id) || null;
/** Bund-Partner eines Pfads (für Hinweise auf Karten und im Kompendium). */
export const bundPartners = (pid) => BOONS.filter((b) => b.bund && b.bund.includes(pid)).map((b) => b.bund.find((x) => x !== pid));

/** Pfadstufen eines Runs: { glut: 2, … } (nur begonnene Pfade). */
export function pathTiers(run) {
  const t = {};
  for (const b of run.boons || []) {
    const d = boonDef(b.id);
    if (d && d.tier) t[d.path] = Math.max(t[d.path] || 0, d.tier);
  }
  return t;
}

// Alte Segen (vor dem Umbau) – nur, damit laufende Runs ihre Werte behalten. Werden nicht mehr angeboten.
export const LEGACY_BOONS = {
  b_dmg: [inc('dmg', 8)], b_fire: [inc('dmg_fire', 14)], b_cold: [inc('dmg_cold', 14)], b_light: [inc('dmg_light', 14)], b_phys: [inc('dmg_phys', 14)],
  b_chaos: [inc('dmg_chaos', 14)], b_spell: [inc('dmg_spell', 12)], b_attack: [inc('dmg_attack', 12)], b_proj: [inc('dmg_proj', 12)], b_area: [inc('area', 10)],
  b_minion: [inc('dmg_minion', 15)], b_dot: [inc('dmg_dot', 14)], b_speed: [inc('speed', 6)], b_crit: [inc('crit', 20)], b_critm: [flat('critMulti', 15)],
  b_life: [inc('life', 8)], b_armor: [flat('armor', 40)], b_eva: [flat('evasion', 40)], b_barrier: [flat('barrier', 15)], b_regen: [flat('lifeRegen', 1.5)],
  b_res: [flat('res_elem', 8)], b_move: [inc('move', 6)], b_magnet: [inc('magnet', 30)], b_dur: [inc('dur', 12)], b_ign: [flat('igniteChance', 10), inc('burn', 10)],
  b_psn: [flat('poisonChance', 12), inc('poison', 10)], b_bld: [flat('bleedChance', 12), inc('bleed', 10)], b_shk: [flat('shockChance', 10), inc('shockEffect', 15)],
  b_frz: [flat('freezeChance', 6), inc('chillEffect', 15)], b_leech: [flat('leech', 0.6)], b_proj1: [flat('proj', 1)], b_pierce: [flat('pierce', 1)], b_chain: [flat('chain', 1)],
  b_minc: [flat('minionCount', 1)], b_pen: [flat('pen', 4)], b_trap: [inc('dmg_trap', 15)], b_aura: [inc('dmg_aura', 15), inc('area_aura', 6)], b_orbit: [inc('dmg_orbit', 15)],
  b_melee: [inc('dmg_melee', 14)], b_chainD: [inc('dmg_chain', 15)], b_projS: [inc('projSpeed', 15), inc('dmg_proj', 5)], b_boss: [inc('dmgVsBoss', 15)], b_low: [inc('dmgVsLow', 18)],
  b_ail: [inc('dmgVsAilment', 15)], b_xp: [inc('xp', 10)], b_luck: [inc('luck', 15), inc('gold', 10)], b_lok: [flat('lifeOnKill', 2)], b_minspd: [inc('speed_minion', 10)],
  b_ailDur: [inc('ailDur', 15)], b_resC: [flat('res_chaos', 10)], b_critB: [flat('critBase', 0.5)], b_lvl: [flat('lvl', 1)],
};
export const LEGACY_FIXED = new Set(['b_proj1', 'b_pierce', 'b_chain', 'b_minc', 'b_critB', 'b_lvl']);
