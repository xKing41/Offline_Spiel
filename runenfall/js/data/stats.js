// Beschreibung aller Werte (Stats) und Erzeugung lesbarer Modifikator-Texte.
// Ein Modifikator ist { s: 'dmg_fire', t: 'inc' | 'more' | undefined (flach), v: Zahl }.
// "inc"  = erhöht (alle "erhöht" addieren sich), "more" = mehr (multipliziert sich).
// Gescopte Werte wie dmg_fire gelten nur, wenn die Fertigkeit/der Schaden den Tag hat.
import { fmtV } from '../util.js';

export const ELEM = {
  phys: { name: 'Physisch', color: '#d9d2c3' },
  fire: { name: 'Feuer', color: '#ff7a2a' },
  cold: { name: 'Kälte', color: '#62d6ff' },
  light: { name: 'Blitz', color: '#ffe34d' },
  chaos: { name: 'Chaos', color: '#9cff5e' },
};
export const DMG_TYPES = ['phys', 'light', 'cold', 'fire', 'chaos']; // Umwandlungsreihenfolge
export const ELEMENTAL = ['fire', 'cold', 'light'];

export const TAG_NAME = {
  phys: 'Physisch', fire: 'Feuer', cold: 'Kälte', light: 'Blitz', chaos: 'Chaos', elem: 'Elementar',
  proj: 'Projektil', area: 'Fläche', melee: 'Nahkampf', spell: 'Zauber', attack: 'Angriff',
  minion: 'Begleiter', dot: 'Schaden über Zeit', aura: 'Aura', trap: 'Falle', orbit: 'Kreisend',
  chain: 'Kette', dur: 'Dauer', hit: 'Treffer',
};

const NOUN = {
  dmg: 'Schaden', dmg_phys: 'physischer Schaden', dmg_fire: 'Feuerschaden', dmg_cold: 'Kälteschaden',
  dmg_light: 'Blitzschaden', dmg_chaos: 'Chaosschaden', dmg_elem: 'Elementarschaden',
  dmg_proj: 'Projektilschaden', dmg_area: 'Flächenschaden', dmg_melee: 'Nahkampfschaden',
  dmg_spell: 'Zauberschaden', dmg_attack: 'Angriffsschaden', dmg_minion: 'Begleiterschaden',
  dmg_dot: 'Schaden über Zeit', dmg_aura: 'Aurenschaden', dmg_trap: 'Fallenschaden',
  dmg_orbit: 'Schaden kreisender Fertigkeiten', dmg_chain: 'Schaden von Kettenfertigkeiten',
  speed: 'Fertigkeitstempo', speed_spell: 'Zaubertempo', speed_attack: 'Angriffstempo',
  speed_minion: 'Begleitertempo', speed_trap: 'Fallen-Wurftempo', speed_orbit: 'Rotationstempo',
  crit: 'kritische Trefferchance', crit_spell: 'kritische Trefferchance für Zauber',
  crit_attack: 'kritische Trefferchance für Angriffe', crit_proj: 'kritische Trefferchance für Projektile',
  area: 'Wirkungsbereich', area_melee: 'Wirkungsbereich (Nahkampf)', area_aura: 'Aurenbereich',
  area_trap: 'Fallenbereich', area_spell: 'Wirkungsbereich (Zauber)',
  projSpeed: 'Projektiltempo', dur: 'Fertigkeitsdauer',
  burn: 'Brandschaden', poison: 'Giftschaden', bleed: 'Blutungsschaden',
  shockEffect: 'Schockwirkung', chillEffect: 'Kältewirkung', ailDur: 'Dauer von Zuständen',
  life: 'maximales Leben', armor: 'Rüstung', evasion: 'Ausweichwert', barrier: 'Barriere',
  barrierRecharge: 'Barriere-Aufladetempo', move: 'Bewegungstempo', magnet: 'Aufsammelradius',
  xp: 'Erfahrung', gold: 'Goldfund', luck: 'Seltenheit gefundener Gegenstände', heal: 'Heilwirkung',
  dmgVsBoss: 'Schaden gegen Elite und Bosse', dmgVsAilment: 'Schaden gegen beeinträchtigte Gegner',
  dmgVsLow: 'Schaden gegen Gegner mit wenig Leben', dmgTaken: 'erlittener Schaden',
  dust: 'Sternenstaub-Fund', axp: 'Konto-Erfahrung',
};

// Flache Werte. {v} = Betrag, {sv} = mit Vorzeichen.
const FLAT = {
  add_phys: 'Fügt {v} physischen Schaden hinzu', add_fire: 'Fügt {v} Feuerschaden hinzu',
  add_cold: 'Fügt {v} Kälteschaden hinzu', add_light: 'Fügt {v} Blitzschaden hinzu',
  add_chaos: 'Fügt {v} Chaosschaden hinzu',
  critBase: '{sv}% Basis-Krit-Chance', critMulti: '{sv}% Krit-Multiplikator',
  proj: '{sv} Projektil(e)', pierce: 'Durchbohrt {v} weitere(n) Gegner', chain: 'Springt {v}× weiter',
  life: '{sv} maximales Leben', lifeRegen: 'Regeneriert {v} Leben pro Sekunde',
  lifeRegenPct: 'Regeneriert {v}% des Lebens pro Sekunde', armor: '{sv} Rüstung',
  evasion: '{sv} Ausweichwert', barrier: '{sv} Barriere',
  res_fire: '{sv}% Feuerwiderstand', res_cold: '{sv}% Kältewiderstand',
  res_light: '{sv}% Blitzwiderstand', res_chaos: '{sv}% Chaoswiderstand',
  res_elem: '{sv}% auf alle Elementarwiderstände',
  igniteChance: '{v}% Chance zu entzünden', freezeChance: '{v}% Chance einzufrieren',
  shockChance: '{v}% Chance zu schocken', poisonChance: '{v}% Chance zu vergiften',
  bleedChance: '{v}% Chance, Blutung zu verursachen',
  leech: '{v}% des Trefferschadens als Leben absaugen', lifeOnKill: '{sv} Leben pro Tötung',
  pen: 'Treffer durchdringen {v}% Widerstände', pen_fire: 'Durchdringt {v}% Feuerwiderstand',
  pen_cold: 'Durchdringt {v}% Kältewiderstand', pen_light: 'Durchdringt {v}% Blitzwiderstand',
  pen_chaos: 'Durchdringt {v}% Chaoswiderstand',
  minionCount: '{sv} maximale Begleiter',
  conv_phys_fire: '{v}% des physischen Schadens werden zu Feuerschaden',
  conv_phys_cold: '{v}% des physischen Schadens werden zu Kälteschaden',
  conv_phys_light: '{v}% des physischen Schadens werden zu Blitzschaden',
  conv_phys_chaos: '{v}% des physischen Schadens werden zu Chaosschaden',
  conv_light_fire: '{v}% des Blitzschadens werden zu Feuerschaden',
  conv_light_cold: '{v}% des Blitzschadens werden zu Kälteschaden',
  conv_cold_fire: '{v}% des Kälteschadens werden zu Feuerschaden',
  conv_fire_chaos: '{v}% des Feuerschadens werden zu Chaosschaden',
  conv_cold_chaos: '{v}% des Kälteschadens werden zu Chaosschaden',
  conv_light_chaos: '{v}% des Blitzschadens werden zu Chaosschaden',
  lvl: '{sv} auf die Stufe aller Fertigkeiten', resMax: '{sv}% auf maximale Widerstände',
  startGold: '{sv} Startgold', dodge: '{v}% Chance, Treffern komplett auszuweichen',
  // Besondere Effekte (Keystones, Unikate, Glyphen)
  spec_echo: 'Zauber werden einmal wiederholt (Echo)',
  spec_echoAll: 'Alle Zauber werden einmal wiederholt (Echo)',
  spec_noAil: 'Kann keine Zustände verursachen',
  spec_killExplode: 'Getötete Gegner explodieren für {v}% ihres max. Lebens als Feuerschaden',
  spec_critExplode: 'Kritische Treffer lösen eine Explosion aus ({v}% des Treffers als Feuerschaden)',
  spec_burnSpread: 'Brennende Gegner entzünden beim Tod Gegner in der Nähe',
  spec_shockSpread: 'Geschockte Gegner schocken beim Tod Gegner in der Nähe',
  spec_poisonVuln: 'Vergiftete Gegner erleiden {v}% mehr Schaden',
  spec_chillAura: 'Gegner in deiner Nähe sind dauerhaft unterkühlt',
  spec_moveStrike: 'Beim Laufen schlägt jede Sekunde ein Blitz für {v}× deinen Blitzschaden-Bonus ein',
  spec_noCrit: 'Kann keine kritischen Treffer erzielen',
  spec_nthCrit: 'Jeder {v}. Treffer einer Fertigkeit ist kritisch, alle anderen nie',
  spec_burnStack: 'Brände stapeln sich (bis zu 10-mal)',
  spec_onlyPoison: 'Kann nur Gift als Zustand verursachen',
  spec_leechMult: 'Lebensraub ist {v}-mal so stark',
  spec_noRegen: 'Keine Lebensregeneration',
  spec_ci: 'Leben ist 1 · Barriere erhält 150% deines Lebens',
  spec_ruthless: 'Jeder 3. Treffer verursacht {v}% mehr Schaden',
  spec_trapMax: '{sv} gleichzeitige Fallen',
  spec_return: 'Projektile kehren zu dir zurück und treffen erneut',
  spec_fork: 'Projektile teilen sich beim ersten Treffer in zwei',
  spec_aftershock: 'Flächentreffer wiederholen sich als Nachbeben (50% Schaden)',
  spec_shatter: 'Eingefrorene Gegner zersplittern beim Tod und unterkühlen ihre Umgebung',
  spec_steps: '{sv} Explosionen pro Welle',
  spec_thorns: 'Gegner, die dich berühren, erleiden {v}% deiner Rüstung als Schaden',
  spec_rebirth: 'Einmal pro Kampf: Tödlicher Schaden lässt dich stattdessen mit 30% Leben weiterleben',
  spec_minionLeech: 'Begleiter heilen dich um {v}% ihres Schadens',
  spec_critChain: 'Kritische Treffer springen auf einen weiteren Gegner über',
  spec_overkill: 'Überschüssiger Schaden beim Töten springt auf den nächsten Gegner über',
  spec_frenzy: 'Jede Tötung gibt 1% mehr Tempo (bis 30%, verfällt nach 3 s)',
  spec_berserk: 'Bis zu 40% mehr Schaden, je weniger Leben du hast',
  spec_stillness: '30% mehr Schaden, solange du stehst',
  spec_bulwark: 'Barriere schützt auch vor Schaden über Zeit und lädt sofort nach Tötungen von Eliten',
  pen_phys: 'Durchdringt {v}% physischen Widerstand',
  dustRun: '{sv}% Sternenstaub aus diesem Run',
};

export function modText(m) {
  const v = m.v;
  if (m.t === 'inc' || m.t === 'more') {
    let n = NOUN[m.s];
    if (!n) {
      const i = m.s.indexOf('_');
      const base = i > 0 ? m.s.slice(0, i) : m.s;
      const tag = i > 0 ? m.s.slice(i + 1) : '';
      n = (NOUN[base] || base) + (tag ? ` (${TAG_NAME[tag] || tag})` : '');
    }
    if (m.t === 'inc') return `${v >= 0 ? '+' : '−'}${fmtV(Math.abs(v))}% ${n}`;
    return `${fmtV(Math.abs(v))}% ${v >= 0 ? 'mehr' : 'weniger'} ${n}`;
  }
  if (m.s.startsWith('lvl_')) {
    const tag = m.s.slice(4);
    return `${v >= 0 ? '+' : '−'}${fmtV(Math.abs(v))} auf die Stufe aller ${TAG_NAME[tag] || tag}-Fertigkeiten`;
  }
  const tpl = FLAT[m.s];
  if (tpl) return tpl.replace('{v}', fmtV(Math.abs(v))).replace('{sv}', (v >= 0 ? '+' : '−') + fmtV(Math.abs(v)));
  return `${v >= 0 ? '+' : ''}${fmtV(v)} ${m.s}`;
}

export const modsText = (mods) => (mods || []).map(modText);
