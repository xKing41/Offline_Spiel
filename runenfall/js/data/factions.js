// Geschichte und Fraktionen: drei Häuser mit Ruf-Stufen, Boni, Händlern, Aufträgen und Begegnungen im Run,
// dazu die Sage (freischaltbare Kapitel) und Sprüche der Bosse.
import { fmt } from '../util.js';

const inc = (s, v) => ({ s, t: 'inc', v });
const more = (s, v) => ({ s, t: 'more', v });
const flat = (s, v) => ({ s, v });

// ===================================================================== Fraktionen
export const FACTIONS = {
  glut: {
    name: 'Orden der Glut', short: 'Glut', icon: '♨', color: '#ff8a3a', leader: 'Großmeisterin Ysolde', dat: 'beim Orden der Glut',
    motto: 'Wer brennt, fällt nicht.',
    desc: 'Krieger und Flammenhüter, die die gefallenen Sterne mit Feuer und Stahl bewachen. Sie achten Mut: Eliten, Bosse und Kämpfe ohne Rückzug.',
    bonus: [inc('dmgVsBoss', 12), inc('life', 8), inc('dmg', 10), inc('armor', 30), more('life', 8)],
  },
  seher: {
    name: 'Zirkel der Sternseher', short: 'Seher', icon: '☉', color: '#62d6ff', leader: 'Archivar Thelion', dat: 'beim Zirkel der Sternseher',
    motto: 'Jeder Stern trägt eine Geschichte.',
    desc: 'Gelehrte, die das Wissen der gefallenen Sterne sammeln. Sie schätzen Runen, Glyphen, Evolutionen und alles, was man lernen kann.',
    bonus: [inc('xp', 12), inc('area', 10), inc('crit', 25), inc('speed', 7), flat('critMulti', 25)],
  },
  leere: {
    name: 'Die Leerenwandler', short: 'Leere', icon: '◐', color: '#b06bff', leader: 'Die Namenlose', dat: 'bei den Leerenwandlern',
    motto: 'Im Nichts liegt jede Möglichkeit.',
    desc: 'Ausgestoßene, die mit der Leere paktieren. Sie lieben das Risiko: Prophezeiungen, den Abgrund, Erzfeinde und verbotene Ware.',
    bonus: [inc('luck', 20), inc('dmg_chaos', 20), inc('dust', 12), inc('dmgVsAilment', 20), more('dmg', 7)],
  },
};
export const FACTION_IDS = Object.keys(FACTIONS);
// Wappen als Vektorgrafik (Schriftzeichen sehen auf jedem Gerät anders aus)
const EMBLEM = {
  glut: '<path d="M12 1.8c.9 3.6 5.6 6 5.6 11.4a5.6 5.6 0 0 1-11.2 0c0-2.6 1.3-4.2 2.6-5.4-.1 2 .8 3.4 2.1 4-.9-3.7.1-7.2.9-10z"/><path d="M12 13.2c.5 1.5 2.2 2.4 2.2 4.3a2.2 2.2 0 0 1-4.4 0c0-1.3.9-2 1.4-2.6 0 .7.3 1.1.8 1.4z" fill="#fff6" />',
  seher: '<path d="M1.6 12S5.6 4.8 12 4.8 22.4 12 22.4 12 18.4 19.2 12 19.2 1.6 12 1.6 12z" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 7.6l1.25 3.15 3.15 1.25-3.15 1.25L12 16.4l-1.25-3.15L7.6 12l3.15-1.25z"/>',
  leere: '<path d="M14.6 2.2a10 10 0 1 0 7.2 16.6A8.6 8.6 0 0 1 14.6 2.2z"/><circle cx="16.4" cy="8.4" r="2.1" fill="none" stroke="currentColor" stroke-width="1.5"/>',
};
/** Wappen eines Hauses als Inline-SVG in seiner Farbe. */
export const facIcon = (id, cls = '') => `<svg class="ficon ${cls}" viewBox="0 0 24 24" fill="currentColor" style="color:${FACTIONS[id].color}" aria-hidden="true">${EMBLEM[id]}</svg>`;

export const REP_RANKS = [
  { name: 'Fremd', need: 0 },
  { name: 'Bekannt', need: 100 },
  { name: 'Geschätzt', need: 300 },
  { name: 'Verbündet', need: 700 },
  { name: 'Geehrt', need: 1400 },
  { name: 'Erhaben', need: 2500 },
];
export const repRank = (rep) => { let r = 0; REP_RANKS.forEach((x, i) => { if (rep >= x.need) r = i; }); return r; };
/** Fortschritt innerhalb der aktuellen Stufe. */
export function repProgress(rep) {
  const r = repRank(rep);
  if (r >= REP_RANKS.length - 1) return { r, cur: 1, need: 1, max: true };
  return { r, cur: rep - REP_RANKS[r].need, need: REP_RANKS[r + 1].need - REP_RANKS[r].need, max: false };
}
/** Dauerhafte Boni aller Fraktionen nach Ruf. */
export function factionBonus(state) {
  const out = [];
  for (const id of FACTION_IDS) {
    const r = repRank((state && state[id] && state[id].rep) || 0);
    out.push(...FACTIONS[id].bonus.slice(0, r));
  }
  return out;
}

// ===================================================================== Aufträge der Häuser
export const CONTRACTS = {
  glut: [
    { id: 'g_elites', text: (n) => `Besiege ${n} Eliten in einem Run`, key: 'runElites', target: (l) => 4 + Math.floor(l / 8) },
    { id: 'g_bosses', text: (n) => (n === 1 ? 'Besiege einen Boss' : `Besiege ${n} Bosse in einem Run`), key: 'runBosses', target: (l) => Math.min(4, 1 + Math.floor(l / 12)) },
    { id: 'g_hit', text: (n) => `Verursache einen Treffer über ${fmt(n)}`, key: 'runMaxHit', target: (l) => Math.round(260 * Math.pow(1.12, l)) },
    { id: 'g_flawless', text: () => 'Besiege einen Boss, ohne getroffen zu werden', key: 'runFlawless', target: () => 1, minLvl: 6 },
    { id: 'g_tower', text: (n) => `Erklimme ${n} Etagen im Sternenturm`, key: 'runTower', target: (l) => 6 + Math.floor(l / 4) },
  ],
  seher: [
    { id: 's_lvl', text: (n) => `Erreiche Stufe ${n} in einem Run`, key: 'runLvl', target: (l) => 14 + Math.floor(l * 0.7) },
    { id: 's_runes', text: (n) => `Beende einen Run mit ${n} Runen`, key: 'runSkills', target: (l) => Math.min(5, 3 + Math.floor(l / 15)) },
    { id: 's_glyphs', text: (n) => `Beende einen Run mit ${n} gesockelten Glyphen`, key: 'runGlyphs', target: (l) => Math.min(12, 4 + Math.floor(l / 5)) },
    { id: 's_evo', text: () => 'Entwickle in einem Run eine Rune weiter', key: 'runEvo', target: () => 1, minLvl: 8 },
    { id: 's_act', text: (n) => `Erreiche Akt ${n} im Feldzug`, key: 'runAct', target: (l) => Math.min(3, 2 + Math.floor(l / 12)) },
  ],
  leere: [
    { id: 'l_proph', text: (n) => (n === 1 ? 'Beende einen Run mit einer Prophezeiung' : `Beende einen Run mit ${n} Prophezeiungen`), key: 'runProph', target: (l) => Math.min(4, 1 + Math.floor(l / 12)) },
    { id: 'l_kills', text: (n) => `Besiege ${n} Gegner in einem Run`, key: 'runKills', target: (l) => 500 + l * 30 },
    { id: 'l_gold', text: (n) => `Sammle ${n} Gold in einem Run`, key: 'runGold', target: (l) => 350 + l * 25 },
    { id: 'l_nemesis', text: () => 'Besiege einen Erzfeind', key: 'runNemesis', target: () => 1, need: (s) => (s.nemesis || []).length > 0 },
    { id: 'l_abyss', text: (n) => `Erreiche Ebene ${n} im Abgrund`, key: 'runAbyss', target: (l) => 5 + Math.floor(l / 3), need: (s) => Object.keys(s.stats.wins || {}).length > 0 },
  ],
};
export const contractReward = (lvl) => Math.min(170, 70 + lvl * 2);

// ===================================================================== Händler der Häuser (bezahlt mit Gunst)
// kind: Wirkung beim Kauf. „Gaben“ (gift) gelten für den nächsten Run.
export const OFFERS = {
  glut: [
    { id: 'g_seal', rank: 0, cost: 60, name: 'Glutsiegel', desc: 'Nächster Run: Start mit einer seltenen Waffe', gift: { weapon: 1 } },
    { id: 'g_trial', rank: 1, cost: 90, name: 'Feuerprobe', desc: 'Nächster Run: Startrune +2 Stufen', gift: { runeLvl: 2 } },
    { id: 'g_blood', rank: 2, cost: 110, name: 'Heldenblut', desc: 'Nächster Run: +20% maximales Leben', gift: { mods: [inc('life', 20)] } },
    { id: 'g_relic', rank: 3, cost: 160, name: 'Ordensrelikt', desc: 'Sofort: ein Relikt aus der Waffenkammer des Ordens', now: { relic: 1 } },
    { id: 'g_smith', rank: 4, cost: 140, name: 'Meisterschmiede', desc: 'Nächster Run: Schmiede-Arbeiten kosten die Hälfte', gift: { forge: 0.5 } },
    { id: 'g_mythic', rank: 5, cost: 420, name: 'Sternenstahl', desc: 'Nächster Run: Start mit einem mythischen Gegenstand', now: { mythic: 1 } },
  ],
  seher: [
    { id: 's_learn', rank: 0, cost: 70, name: 'Runenkunde', desc: 'Sofort: eine noch unbekannte Rune oder Glyphe wird im Kodex freigeschaltet', now: { learn: 1 } },
    { id: 's_glyphs', rank: 1, cost: 90, name: 'Glyphenbündel', desc: 'Nächster Run: Start mit 3 Glyphen', gift: { glyphs: 3 } },
    { id: 's_rune', rank: 2, cost: 120, name: 'Sternkarte', desc: 'Nächster Run: Start mit einer zweiten Rune', gift: { rune: 1 } },
    { id: 's_wisdom', rank: 3, cost: 120, name: 'Weisheit der Alten', desc: 'Nächster Run: Start auf Stufe 4', gift: { lvls: 3 } },
    { id: 's_jewel', rank: 4, cost: 220, name: 'Juwel des Zirkels', desc: 'Sofort: ein Juwel für die Sternenkarte', now: { jewel: 1 } },
    { id: 's_atlas', rank: 5, cost: 360, name: 'Verbotene Karte', desc: 'Sofort: +1 Atlaspunkt', now: { atlas: 1 } },
  ],
  leere: [
    { id: 'l_coin', rank: 0, cost: 50, name: 'Leerenmünzen', desc: 'Nächster Run: +150 Gold zu Beginn', gift: { gold: 150 } },
    { id: 'l_pact', rank: 1, cost: 80, name: 'Pakt der Gier', desc: 'Nächster Run: Prophezeiung „Brutalität“ und zusätzlich +30% Sternenstaub', gift: { pact: 1 } },
    { id: 'l_pack', rank: 2, cost: 140, name: 'Gezinkte Karten', desc: 'Sofort: ein Schicksalskartenpack', now: { pack: 1 } },
    { id: 'l_egg', rank: 3, cost: 200, name: 'Seelenei', desc: 'Sofort: ein Gefährten-Ei schlüpft', now: { egg: 1 } },
    { id: 'l_curse', rank: 4, cost: 160, name: 'Fluchgold', desc: 'Nächster Run: +60% Goldfund und Seltenheit', gift: { mods: [inc('gold', 60), inc('luck', 60)] } },
    { id: 'l_core', rank: 5, cost: 400, name: 'Leerenkern', desc: 'Nächster Run: Start mit einem mythischen Gegenstand', now: { mythic: 1 } },
  ],
};

// ===================================================================== Begegnungen im Run
export const FACTION_EVENTS = [
  {
    id: 'f_patrol', faction: 'glut', title: 'Patrouille des Ordens',
    text: 'Ein Trupp Glutritter hält eine Brücke gegen eine Übermacht. Ihre Schilde glühen, ihre Reihen wanken.',
    options: [
      { label: 'Beistehen', desc: 'Kampf gegen einen Champion · Ruf Glut +45', fx: { arena: true, rep: { glut: 45 } } },
      { label: 'Ihre Vorräte plündern', desc: '+80 Gold · Ruf Glut −30, Leere +20', fx: { gold: 80, rep: { glut: -30, leere: 20 } } },
      { label: 'Weiterziehen', desc: 'Nichts passiert.', fx: {} },
    ],
  },
  {
    id: 'f_forge', faction: 'glut', title: 'Die Ordensschmiede',
    text: 'Ein Schmied mit Glutaugen bietet an, deinen Stahl im heiligen Feuer zu härten – gegen eine Spende für den Orden.',
    options: [
      { label: 'Ausrüstung härten', desc: 'Zahle 60 Gold: zwei Affixe verstärkt · Ruf Glut +15', fx: { pay: 60, upgrade: 2, rep: { glut: 15 } } },
      { label: 'Großzügig spenden', desc: 'Zahle 50 Gold · Ruf Glut +40', fx: { pay: 50, rep: { glut: 40 } } },
      { label: 'Ablehnen', desc: 'Nichts passiert.', fx: {} },
    ],
  },
  {
    id: 'f_flames', faction: 'glut', title: 'Die Feuerprobe',
    text: '„Nur wer durch die Flammen geht, darf sich Hüter nennen“, sagt Großmeisterin Ysolde und deutet auf eine Wand aus weißer Glut.',
    options: [
      { label: 'Durch die Flammen', desc: '−25% Leben, +12% Schaden (Run) · Ruf Glut +35', fx: { hpPct: -25, boon: [inc('dmg', 12)], rep: { glut: 35 } } },
      { label: 'Ablehnen', desc: 'Ysolde wendet sich ab · Ruf Glut −5', fx: { rep: { glut: -5 } } },
    ],
  },
  {
    id: 'f_library', faction: 'seher', title: 'Die Sternbibliothek',
    text: 'Ein Archivar sortiert zersplitterte Sternkarten. „Hilf mir, Runenträger – deine Augen sind schärfer als meine.“',
    options: [
      { label: 'Helfen', desc: 'Erhalte eine Glyphe · Ruf Seher +25', fx: { glyph: 1, rep: { seher: 25 } } },
      { label: 'Eine Karte stehlen', desc: 'Eine neue Rune · Ruf Seher −30, Leere +15', fx: { newSkill: 1, rep: { seher: -30, leere: 15 } } },
      { label: 'Weitergehen', desc: 'Nichts passiert.', fx: {} },
    ],
  },
  {
    id: 'f_observe', faction: 'seher', title: 'Der Beobachtungsturm',
    text: 'Durch ein gewaltiges Fernrohr siehst du die Bahn eines Sterns, der noch fallen wird. Die Seher notieren jede deiner Beobachtungen.',
    options: [
      { label: 'Die Bahn deuten', desc: '+1 Stufe für eine Rune · Ruf Seher +20', fx: { skillLvl: 1, rep: { seher: 20 } } },
      { label: 'Sternenstaub sammeln', desc: '+40 Sternenstaub am Ende · Ruf Seher +10', fx: { dust: 40, rep: { seher: 10 } } },
    ],
  },
  {
    id: 'f_riddle', faction: 'seher', title: 'Das Rätsel des Zirkels',
    text: 'Eine Seherin mit verbundenen Augen lächelt: „Was wird mehr, wenn man es teilt?“',
    options: [
      { label: '„Wissen.“', desc: 'Die Seherin nickt zufrieden.', fx: { lvls: 1, rep: { seher: 40 } } },
      { label: '„Gold.“', desc: 'Eine gewagte Antwort.', fx: { rep: { seher: 5 } } },
      { label: '„Schmerz.“', desc: 'Eine dunkle Antwort.', fx: { rep: { leere: 15, seher: -5 } } },
    ],
  },
  {
    id: 'f_pact', faction: 'leere', title: 'Ein Pakt im Dunkeln',
    text: 'Eine Gestalt ohne Gesicht reicht dir die Hand. „Die Namenlose bietet dir Macht. Sie verlangt nur ein kleines Stück deiner Seele.“',
    options: [
      { label: 'Pakt schließen', desc: '+20% mehr Schaden, 15% weniger Leben (Run) · Ruf Leere +35, Glut −15', fx: { boon: [more('dmg', 20), more('life', -15)], rep: { leere: 35, glut: -15 } } },
      { label: 'Ablehnen', desc: 'Die Gestalt verblasst · Ruf Leere −5', fx: { rep: { leere: -5 } } },
    ],
  },
  {
    id: 'f_market', faction: 'leere', title: 'Schwarzmarkt der Leere',
    text: 'Zwischen zwei Felsen flackern Laternen ohne Flamme. Händler ohne Gesicht bieten verbotene Ware feil.',
    options: [
      { label: 'Verfluchtes Kleinod kaufen', desc: 'Zahle 70 Gold: zufälliger Gegenstand (oft einzigartig) · Ruf Leere +20', fx: { pay: 70, item: 'gamble', rep: { leere: 20 } } },
      { label: 'Den Markt an den Orden verraten', desc: '+50 Gold · Ruf Leere −40, Glut +25', fx: { gold: 50, rep: { leere: -40, glut: 25 } } },
      { label: 'Weitergehen', desc: 'Nichts passiert.', fx: {} },
    ],
  },
  {
    id: 'f_rift', faction: 'leere', title: 'Ein Riss ins Nichts',
    text: 'Die Luft reißt auf wie Stoff. Aus dem Riss flüstert etwas deinen Namen – und dahinter glänzt ein Schatz.',
    options: [
      { label: 'Hineingreifen', desc: 'Schatz oder Schmerz · Ruf Leere +25', fx: { tomb: 1, rep: { leere: 25 } } },
      { label: 'Den Riss versiegeln', desc: 'Ruf Seher +20, Leere −10', fx: { rep: { seher: 20, leere: -10 } } },
    ],
  },
];

// ===================================================================== Sprüche der Bosse
export const BOSS_LINES = {
  shepherd: 'Noch eine Glut für meine Herde.',
  colossus: 'Das Moor vergisst nichts. Auch dich nicht.',
  hain: 'Wir brennen seit dem Fall. Brenn mit uns.',
  queen: 'Knie nieder – oder zerspringe.',
  wyrm: 'Ich habe Sterne verschlungen. Du bist nur ein Funke.',
  mirror: 'Kämpf gegen dich selbst. Du wirst verlieren.',
  voidlord: 'Alles endet im Nichts. Ich bin das Ende.',
  witch: 'Der Himmel gehorcht mir. Und du?',
  leviathan: 'Das Seelenmeer ist hungrig.',
  fallenstar: 'Ich war das Licht. Jetzt bin ich das Feuer.',
  weaver: 'Jeder Faden führt zu mir.',
  eternal: 'Ich herrschte, bevor der Himmel brach. Ich herrsche danach.',
};
const BEAST_LINES = ['Die Sterne haben mich geboren. Dich werden sie vergessen.', 'Ich rieche deine Runen, Träger.', 'Lauf. Es macht die Jagd schöner.', 'Ich bin älter als dein Himmel.'];
export const bossLine = (id) => BOSS_LINES[id] || (String(id).startsWith('beast_') ? BEAST_LINES[Number(String(id).slice(6)) % BEAST_LINES.length] : null);

// ===================================================================== Die Sage
const killed = (s, ids) => ids.some((k) => (s.stats.bossKills || {})[k] > 0);
const rankOf = (s, f) => repRank((s.factions && s.factions[f] && s.factions[f].rep) || 0);
export const STORY = [
  {
    id: 'fall', title: 'Der Sternenfall', hint: '–', when: () => true,
    text: 'In der Nacht, als der Himmel brach, fielen die Sterne wie glühender Regen. Wo sie aufschlugen, erwachten Dinge, die nie hätten erwachen dürfen – und Runen, die jedem Macht verleihen, der stark genug ist, sie zu tragen. Du bist eine dieser Seelen: ein Runenträger. Die Sternwarte auf dem letzten Gipfel ist deine Zuflucht. Von hier brichst du auf, wieder und wieder. Denn jeder Sturz lehrt dich, höher zu steigen.',
  },
  {
    id: 'houses', title: 'Die drei Häuser', hint: 'Beende deinen ersten Run.', when: (s) => s.stats.runs >= 1,
    text: 'Als du zur Sternwarte zurückkehrst, warten drei Boten am Tor. Der Orden der Glut schwört, die gefallenen Sterne mit Feuer und Stahl zu bewachen. Der Zirkel der Sternseher will ihr Wissen bewahren, bevor es verlischt. Und die Leerenwandler flüstern, der Fall sei kein Unglück gewesen, sondern eine Befreiung. Alle drei wollen deine Runen. Keiner sagt dir die ganze Wahrheit.',
  },
  {
    id: 'act1', title: 'Die Wächter der Asche', hint: 'Besiege einen Boss des ersten Akts.', when: (s) => killed(s, ['shepherd', 'colossus', 'hain']),
    text: 'Der erste Wächter ist gefallen. In seiner Asche glimmt ein Splitter, der nicht verlöschen will. Die Seher sagen, jeder Wächter trage ein Stück des Herzens in sich, aus dem der Himmel einst gewoben war. Der Orden sagt, man solle es verbrennen. Die Leerenwandler sagen gar nichts – sie lächeln nur.',
  },
  {
    id: 'act2', title: 'Kristall, Glut und Spiegel', hint: 'Besiege einen Boss des zweiten Akts.', when: (s) => killed(s, ['queen', 'wyrm', 'mirror']),
    text: 'Tiefer im Land sind die Sterne nicht erloschen, sondern gewachsen: zu Kristallpalästen, zu Schmieden aus lebender Glut, zu Labyrinthen aus Spiegeln, in denen jede Seele sich selbst begegnet. Ihre Herrscher waren einst Menschen. Der Splitter in deiner Tasche wird schwerer – und wärmer.',
  },
  {
    id: 'act3', title: 'Der Thron der Leere', hint: 'Besiege einen Boss des dritten Akts.', when: (s) => killed(s, ['voidlord', 'witch', 'leviathan']),
    text: 'Am Ende der bekannten Welt klafft ein Thron aus Nichts. Wer dort saß, hat den Sternenfall nicht überlebt – er hat ihn gewollt. Als er stürzt, hörst du zum ersten Mal die Stimme, die hinter allem flüstert: „Noch nicht, Träger. Noch nicht.“',
  },
  {
    id: 'triumph', title: 'Der erste Triumph', hint: 'Gewinne einen Feldzug.', when: (s) => Object.keys(s.stats.wins || {}).length > 0,
    text: 'Drei Akte, drei Wächter, ein Weg zurück. In der Sternwarte entzündet jemand eine Kerze für dich. Doch über dem Gipfel flackert ein neuer Stern auf, wo vorher keiner war – und er fällt nicht. Er wartet. Die Höhen rufen: Sternenhöhe um Sternenhöhe, jede härter als die letzte.',
  },
  {
    id: 'atlas', title: 'Der Sternenatlas', hint: 'Bezwinge eine Region des Sternenatlas.', when: (s) => Object.keys((s.atlas && s.atlas.done) || {}).length > 0,
    text: 'Die Seher haben eine Karte gezeichnet, die es nicht geben dürfte: Regionen jenseits des dritten Akts, Orte, an denen die Sterne noch fallen. Jede bezwungene Region schiebt den Rand der Karte ein Stück weiter. Thelion nennt es Forschung. Ysolde nennt es Krieg.',
  },
  {
    id: 'abyss', title: 'Was unten wartet', hint: 'Erreiche Ebene 10 im Abgrund.', when: (s) => (s.stats.maxAbyss || 0) >= 10,
    text: 'Der Abgrund hat keinen Boden. Auf der zehnten Ebene findest du Kreidezeichen an den Wänden – Strichlisten, Namen, Gebete. Andere Runenträger waren hier. Die jüngsten Zeichen sind in deiner eigenen Handschrift.',
  },
  {
    id: 'nemesis', title: 'Feinde mit Namen', hint: 'Besiege einen Erzfeind.', when: (s) => (s.stats.nemesisSlain || 0) >= 1,
    text: 'Manche Kreaturen, die dich töten, vergessen dich nicht. Sie wachsen an deinem Tod, geben sich Namen und Titel und warten auf deine Rückkehr. Heute hast du einen von ihnen zum Schweigen gebracht. Die anderen haben es gehört.',
  },
  {
    id: 'tower', title: 'Der Turm der Ewigen', hint: 'Erklimme 10 Etagen im Sternenturm.', when: (s) => (s.stats.maxTower || 0) >= 10,
    text: 'Jede Woche wächst der Sternenturm neu aus dem Gestein, Etage um Etage, nach Gesetzen, die niemand geschrieben hat. Die Namen an seiner Tafel wechseln, doch einige kehren immer wieder. Man sagt, wer die Spitze erreicht, sieht den Himmel, wie er vor dem Fall war.',
  },
  {
    id: 'hunt', title: 'Die Bestien des Himmels', hint: 'Erlege eine Sternenbestie.', when: (s) => (s.stats.beasts || 0) >= 1 || (s.stats.huntWins || 0) >= 1,
    text: 'Nicht alle Sterne wurden zu Wächtern. Manche wurden zu Tieren – hungrig, alt und klug. Sie verbergen sich in den verhüllten Landen und lassen sich nur von jenen finden, die geduldig ihren Spuren folgen. Ihr Herzschlag klingt wie ferner Donner.',
  },
  {
    id: 'pinnacle', title: 'Die Gefallenen', hint: 'Besiege einen Endgegner des Sternenatlas.', when: (s) => killed(s, ['fallenstar', 'weaver', 'eternal']),
    text: 'Der Gefallene Stern, die Weberin der Leere, der Ewige König: Sie sind keine Wächter, sie sind Ursachen. Als einer von ihnen vor dir zerbricht, siehst du für einen Herzschlag das ganze Gewebe des Himmels – und das Loch in seiner Mitte, wo etwas herausgerissen wurde.',
  },
  {
    id: 'heights', title: 'Jenseits der Höhen', hint: 'Gewinne auf Sternenhöhe 5.', when: (s) => (s.stats.maxAscWin || -1) >= 5,
    text: 'Je höher du steigst, desto dünner wird die Luft zwischen dir und den Sternen. Auf der fünften Höhe hörst du sie singen. Es ist kein Lied. Es ist eine Warnung, immer wieder dieselbe, in einer Sprache, die du langsam zu verstehen beginnst.',
  },
  {
    id: 'glut1', title: 'Die Flamme des Ordens', hint: 'Werde beim Orden der Glut „Geschätzt“.', when: (s) => rankOf(s, 'glut') >= 2,
    text: 'Ysolde führt dich in die Halle der ewigen Flamme. „Jeder Stern, der erlischt, ist eine Seele, die wir verloren haben“, sagt sie. „Wir lassen kein Licht mehr sterben.“ Ihre Rüstung ist voller Narben, und jede davon hat einen Namen.',
  },
  {
    id: 'glut2', title: 'Das letzte Feuer', hint: 'Werde beim Orden der Glut „Erhaben“.', when: (s) => rankOf(s, 'glut') >= 5,
    text: 'In der tiefsten Kammer des Ordens brennt ein Feuer, das älter ist als der Fall. Ysolde gesteht dir, was nur die Großmeister wissen: Der Orden hat den ersten Stern selbst vom Himmel geholt – um ihn zu retten. Es misslang. Seitdem hüten sie seine Glut und warten auf jemanden, der stark genug ist, sie zurückzutragen.',
  },
  {
    id: 'seher1', title: 'Die Archive des Zirkels', hint: 'Werde beim Zirkel der Sternseher „Geschätzt“.', when: (s) => rankOf(s, 'seher') >= 2,
    text: 'Thelions Archiv reicht tiefer in den Berg, als die Sternwarte hoch ist. Regale voller Sternkarten, jede ein wenig anders. „Der Himmel war nie fest“, flüstert er. „Er wurde jede Nacht neu geschrieben. Jemand hat aufgehört zu schreiben.“',
  },
  {
    id: 'seher2', title: 'Die Hand, die schrieb', hint: 'Werde beim Zirkel der Sternseher „Erhaben“.', when: (s) => rankOf(s, 'seher') >= 5,
    text: 'Auf der ältesten Karte des Zirkels steht kein Stern, sondern ein Name. Es ist der Name der Namenlosen. Thelion schweigt lange. Dann sagt er: „Sie hat den Himmel geschrieben. Und sie war es, die die Feder zerbrach.“',
  },
  {
    id: 'leere1', title: 'Das Lächeln im Nichts', hint: 'Werde bei den Leerenwandlern „Geschätzt“.', when: (s) => rankOf(s, 'leere') >= 2,
    text: 'Die Leerenwandler leben dort, wo die Welt dünn ist. Sie lachen über den Orden und bemitleiden den Zirkel. „Ein Himmel, den man schreiben muss, ist ein Käfig“, sagt einer von ihnen. „Wir haben nur die Tür geöffnet.“',
  },
  {
    id: 'leere2', title: 'Die Namenlose', hint: 'Werde bei den Leerenwandlern „Erhaben“.', when: (s) => rankOf(s, 'leere') >= 5,
    text: 'Zum ersten Mal zeigt sie dir ihr Gesicht. Es ist voller Sterne. „Ich habe sie freigelassen“, sagt die Namenlose, „und sie sind gefallen, weil niemand ihnen Flügel gab. Du trägst ihre Runen, Träger. Vielleicht bist du die Antwort, die ich vergessen habe.“',
  },
  {
    id: 'heart', title: 'Das Herz der Sterne', hint: 'Werde bei allen drei Häusern „Verbündet“ und gewinne 3 Feldzüge.',
    when: (s) => FACTION_IDS.every((f) => rankOf(s, f) >= 3) && Object.values(s.stats.wins || {}).reduce((a, b) => a + b, 0) >= 3,
    text: 'Orden, Zirkel und Leere – drei Hälften einer Wahrheit, die keiner allein ertragen kann. Der Splitter aus der Asche des ersten Wächters pulsiert in deiner Hand wie ein Herz. Es ist ein Stück des ersten Sterns. Und zum ersten Mal verstehst du die Warnung der Höhen: Der Himmel fällt nicht. Er wartet darauf, dass jemand ihn neu schreibt. Die Feder liegt bei dir.',
  },
];
