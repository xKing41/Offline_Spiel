// Generative und Langzeit-Systeme: Erzfeinde, Mythische Gegenstände, Runenmerkmale, Sternenbestien,
// Sternwarte (Gebäude, Ressourcen, Alchemie), Schicksalskarten, Ligen und Saison-Pass.
import { pick, makeRng, clamp, uid, weighted } from '../util.js';
import { ENEMIES, BOSSES, MUTATORS } from './content.js';

const inc = (s, v) => ({ s, t: 'inc', v });
const more = (s, v) => ({ s, t: 'more', v });
const flat = (s, v) => ({ s, v });

// ===================================================================== Namen
const SYL_A = ['Kar', 'Mor', 'Vel', 'Thra', 'Zor', 'Ul', 'Gra', 'Syl', 'Dra', 'Ny', 'Bal', 'Kre', 'Ish', 'Vor', 'Esk', 'Rhu', 'Ozz', 'Fen'];
const SYL_B = ['ak', 'oth', 'iel', 'gar', 'mund', 'ix', 'ra', 'zul', 'eth', 'ok', 'ion', 'ash', 'ur', 'yn', 'em', 'is'];
const EPI = ['der Schlächter', 'die Unerbittliche', 'der Seelenfresser', 'die Sternenklinge', 'der Unsterbliche', 'die Zornige',
  'der Knochenbrecher', 'die Flüsternde', 'der Grausame', 'die Rachsüchtige', 'der Aschenbringer', 'die Eiskalte', 'der Verdammte',
  'die Lauernde', 'der Gnadenlose', 'die Leerenbraut', 'der Sturmgeborene', 'die Giftzunge'];
export const genName = (rng = Math) => {
  const r = rng.next ? rng.next.bind(rng) : Math.random;
  const p = (a) => a[Math.floor(r() * a.length)];
  return p(SYL_A) + p(SYL_B) + (r() < 0.4 ? p(SYL_B) : '');
};

// ===================================================================== Erzfeinde (Nemesis)
export const NEMESIS_MAX = 12;
export const NEMESIS_TRAITS = {
  tough: { name: 'Unverwüstlich', desc: '+60% Leben' },
  swift: { name: 'Rasend', desc: '+40% Tempo' },
  fireborn: { name: 'Feuergeboren', desc: 'Brennt, 75% Feuerwiderstand' },
  frostheart: { name: 'Frostherz', desc: 'Verlangsamt dich, 75% Kältewiderstand' },
  stormsoul: { name: 'Sturmseele', desc: '75% Blitzwiderstand, verschießt Blitze' },
  blinker: { name: 'Phasenwandler', desc: 'Teleportiert sich zu dir' },
  summoner: { name: 'Totenrufer', desc: 'Ruft Diener herbei' },
  vampire: { name: 'Blutsauger', desc: 'Heilt sich bei Treffern' },
  splitter: { name: 'Hydra', desc: 'Spaltet sich beim Tod' },
  shield: { name: 'Bollwerk', desc: 'Schützt Verbündete (50% weniger Schaden)' },
  regen: { name: 'Regeneration', desc: 'Heilt 3% Leben pro Sekunde' },
  sniper: { name: 'Scharfschütze', desc: 'Schießt gezielte Salven' },
  wrath: { name: 'Rache', desc: 'Rast vor Wut, wenn verletzt' },
  armored: { name: 'Gepanzert', desc: '40% weniger erlittener Schaden' },
  bomber: { name: 'Explosiv', desc: 'Hinterlässt explodierende Felder' },
  hunter: { name: 'Jäger', desc: 'Springt dich an' },
};
export const NEMESIS_IDS = Object.keys(NEMESIS_TRAITS);
export const NEMESIS_TAUNTS = [
  '„Wir sehen uns wieder.“', '„Du bist schwach.“', '„Ich werde stärker. Du nicht.“', '„Lauf, solange du kannst.“',
  '„Dein Staub gehört mir.“', '„Ich erinnere mich an dich.“', '„Das war erst der Anfang.“', '„Komm zurück, wenn du dich traust.“',
];
export function makeNemesis(killer) {
  const base = killer.boss || !ENEMIES[killer.id] || ['mite', 'swarm', 'slimelet', 'nest', 'turret', 'wartotem', 'bosscrystal', 'soulanchor', 'ashtree', 'forgeheart', 'moth'].includes(killer.id) ? 'moloch' : killer.id;
  const traits = [pick(NEMESIS_IDS)];
  return {
    uid: uid(), base, color: killer.color || ENEMIES[base].color, rank: 1, kills: 1, traits,
    name: `${genName()} ${pick(EPI)}`, from: killer.name || ENEMIES[base].name, born: Date.now(),
  };
}

// ===================================================================== Mythische Gegenstände
// Prozedural: Name + maximale Affixe + 1–2 Spezialeffekte aus diesem Pool.
export const MYTHIC_EFFECTS = [
  { name: 'Feuerseele', mods: [flat('conv_phys_fire', 50), more('dmg_fire', 25)] },
  { name: 'Frostseele', mods: [flat('conv_phys_cold', 50), more('dmg_cold', 25)] },
  { name: 'Sturmseele', mods: [flat('conv_phys_light', 50), more('dmg_light', 25)] },
  { name: 'Leerenseele', mods: [flat('conv_phys_chaos', 50), more('dmg_chaos', 25)] },
  { name: 'Titanenkraft', mods: [more('dmg_phys', 35), flat('add_phys', 15)] },
  { name: 'Phönixgabe', mods: [flat('spec_rebirth', 1), flat('res_fire', 30)] },
  { name: 'Vielfalt', mods: [flat('proj', 2), more('dmg_proj', 10)] },
  { name: 'Durchschlag', mods: [flat('pierce', 3), flat('chain', 1)] },
  { name: 'Allmacht', mods: [flat('lvl', 1), more('dmg', 10)] },
  { name: 'Heerschar', mods: [flat('minionCount', 2), more('dmg_minion', 20)] },
  { name: 'Fallenmeister', mods: [flat('spec_trapMax', 4), more('dmg_trap', 30)] },
  { name: 'Strahlenkranz', mods: [more('dmg_aura', 40), inc('area_aura', 40)] },
  { name: 'Wirbelsturm', mods: [more('dmg_orbit', 35), flat('proj', 1)] },
  { name: 'Henker', mods: [more('dmgVsLow', 50), flat('spec_overkill', 1)] },
  { name: 'Großwildjagd', mods: [more('dmgVsBoss', 40)] },
  { name: 'Zeitbruch', mods: [more('speed', 20), more('dur', -20)] },
  { name: 'Riesenwuchs', mods: [more('area', 40), more('speed', -10)] },
  { name: 'Blutrausch', mods: [flat('spec_berserk', 1), flat('leech', 2)] },
  { name: 'Stille', mods: [flat('spec_stillness', 1), more('dmg', 10)] },
  { name: 'Donnerschritt', mods: [flat('spec_moveStrike', 1), inc('move', 15)] },
  { name: 'Raserei', mods: [flat('spec_frenzy', 1), inc('speed', 10)] },
  { name: 'Kettenreaktion', mods: [flat('spec_critChain', 1), flat('critMulti', 40)] },
  { name: 'Sternenbruch', mods: [flat('spec_critExplode', 50), flat('critBase', 2)] },
  { name: 'Ewiger Brand', mods: [flat('spec_burnStack', 1), more('burn', 30)] },
  { name: 'Pestilenz', mods: [flat('spec_poisonVuln', 15), flat('poisonChance', 40)] },
  { name: 'Aderlass', mods: [flat('bleedChance', 50), more('bleed', 40)] },
  { name: 'Lauffeuer', mods: [flat('spec_burnSpread', 1), flat('igniteChance', 25)] },
  { name: 'Kurzschluss', mods: [flat('spec_shockSpread', 1), flat('shockChance', 30)] },
  { name: 'Splitterfrost', mods: [flat('spec_shatter', 1), flat('freezeChance', 15)] },
  { name: 'Eishauch', mods: [flat('spec_chillAura', 1), inc('chillEffect', 50)] },
  { name: 'Leichenfeuer', mods: [flat('spec_killExplode', 10)] },
  { name: 'Echo', mods: [flat('spec_echoAll', 1)] },
  { name: 'Rückkehr', mods: [flat('spec_return', 1), more('dmg_proj', 15)] },
  { name: 'Gabelung', mods: [flat('spec_fork', 1), more('dmg_proj', 10)] },
  { name: 'Nachbeben', mods: [flat('spec_aftershock', 1)] },
  { name: 'Dornenhaut', mods: [flat('spec_thorns', 120), flat('armor', 100)] },
  { name: 'Phantom', mods: [flat('dodge', 15), inc('evasion', 60)] },
  { name: 'Festung', mods: [flat('resMax', 4), flat('res_elem', 20)] },
  { name: 'Lebensstrom', mods: [flat('lifeRegenPct', 2), more('life', 15)] },
  { name: 'Sternenschild', mods: [more('barrier', 50), inc('barrierRecharge', 60)] },
  { name: 'Seelenband', mods: [flat('spec_minionLeech', 4), more('dmg_minion', 15)] },
  { name: 'Wucht', mods: [flat('spec_ruthless', 150)] },
  { name: 'Durchdringung', mods: [flat('pen', 15)] },
  { name: 'Glücksstern', mods: [inc('luck', 80), inc('dust', 25)] },
  { name: 'Weisheit', mods: [inc('xp', 30), inc('axp', 20)] },
  { name: 'Prisma', mods: [more('dmg_elem', 30)] },
  { name: 'Sternengift', mods: [more('poison', 40), more('dmg_chaos', 15)] },
  { name: 'Präzision', mods: [flat('critBase', 4), inc('crit', 60)] },
];
const MY_PRE = ['Zorn', 'Herz', 'Fluch', 'Atem', 'Krone', 'Zahn', 'Auge', 'Seele', 'Klinge', 'Schwur', 'Ruf', 'Schrei', 'Wille', 'Hand', 'Traum', 'Lied'];
const MY_SUF = ['des Ewigen Sterns', 'der Gefallenen Götter', 'der Ersten Nacht', 'des Weltenbrandes', 'der Leere', 'des Sternenkönigs',
  'der Vergessenen', 'des Untergangs', 'der Morgenröte', 'des Abgrunds', 'der Unendlichkeit', 'des Himmelssturzes', 'der Ahnen', 'des Chaos'];
export const mythicTitle = () => `${pick(MY_PRE)} ${pick(MY_SUF)}`;

// ===================================================================== Runenmerkmale
// Eigenschaften, die direkt auf einer Rune liegen. Eine Rune kann bis zu zwei Merkmale tragen.
export const RUNE_TRAITS = {
  twin: { name: 'Zwillings', req: ['proj', 'orbit'], mods: [flat('proj', 1)] },
  swarm: { name: 'Schwarm', req: ['proj'], mods: [flat('proj', 3), more('dmg', -20)] },
  glowing: { name: 'Glühend', req: ['hit', 'dot'], mods: [flat('conv_phys_fire', 30), flat('conv_cold_fire', 30), flat('conv_light_fire', 30)] },
  frozen: { name: 'Gefroren', req: ['hit', 'dot'], mods: [flat('conv_phys_cold', 30), flat('conv_light_cold', 30), flat('freezeChance', 8)] },
  charged: { name: 'Geladen', req: ['hit', 'dot'], mods: [flat('conv_phys_light', 30), flat('shockChance', 15)] },
  void: { name: 'Leeren', req: ['hit', 'dot'], mods: [flat('conv_phys_chaos', 30), flat('conv_fire_chaos', 30), flat('conv_cold_chaos', 30), flat('conv_light_chaos', 30)] },
  ancient: { name: 'Uralt', req: [], mods: [flat('lvl', 2)] },
  frenzied: { name: 'Rasend', req: [], mods: [more('speed', 20)] },
  devastating: { name: 'Verheerend', req: [], mods: [more('dmg', 30), more('speed', -15)] },
  vampiric: { name: 'Vampir', req: ['hit'], mods: [flat('leech', 2)] },
  explosive: { name: 'Explosiv', req: ['hit'], mods: [flat('spec_killExplode', 8)] },
  chaining: { name: 'Ketten', req: ['proj', 'chain'], mods: [flat('chain', 2)] },
  forking: { name: 'Gabel', req: ['proj'], mods: [flat('spec_fork', 1)] },
  echoing: { name: 'Echo', req: ['spell', 'melee'], mods: [flat('spec_echo', 1), more('dmg', -20)] },
  huge: { name: 'Riesen', req: ['area', 'aura', 'orbit'], mods: [more('area', 40)] },
  piercing: { name: 'Bohr', req: ['proj'], mods: [flat('pierce', 3)] },
  deadly: { name: 'Tödlich', req: ['hit'], mods: [flat('critBase', 3), flat('critMulti', 40)] },
  lasting: { name: 'Ewig', req: ['dur', 'dot', 'minion', 'trap'], mods: [more('dur', 40), more('dmg_dot', 15)] },
  horde: { name: 'Horden', req: ['minion'], mods: [flat('minionCount', 2)] },
  burning: { name: 'Brand', req: ['fire'], mods: [flat('igniteChance', 30), more('burn', 30)] },
  venom: { name: 'Gift', req: ['hit'], mods: [flat('poisonChance', 40), more('poison', 20)] },
  bleeding: { name: 'Blut', req: ['phys'], mods: [flat('bleedChance', 40), more('bleed', 25)] },
  shattering: { name: 'Splitter', req: ['cold'], mods: [flat('spec_shatter', 1)] },
  returning: { name: 'Bumerang', req: ['proj'], mods: [flat('spec_return', 1)] },
  quaking: { name: 'Beben', req: ['area', 'melee', 'trap'], mods: [flat('spec_aftershock', 1)] },
  precise: { name: 'Präzisions', req: ['hit'], mods: [inc('crit', 80)] },
  hunting: { name: 'Jäger', req: ['hit'], mods: [more('dmgVsBoss', 35)] },
  executing: { name: 'Henker', req: ['hit'], mods: [more('dmgVsLow', 50)] },
  swift: { name: 'Flink', req: ['proj'], mods: [inc('projSpeed', 50), more('dmg_proj', 10)] },
  prismatic: { name: 'Prisma', req: ['fire', 'cold', 'light'], mods: [more('dmg_elem', 25), flat('pen', 5)] },
  brutal: { name: 'Brutal', req: ['phys'], mods: [more('dmg_phys', 35)] },
  cursed: { name: 'Verflucht', req: ['chaos'], mods: [more('dmg_chaos', 30), flat('pen_chaos', 10)] },
  blessed: { name: 'Gesegnet', req: [], mods: [more('dmg', 15), flat('lifeOnKill', 3)] },
  mighty: { name: 'Mächtig', req: [], mods: [flat('lvl', 1), more('dmg', 10)] },
  storm: { name: 'Sturm', req: ['light'], mods: [more('dmg_light', 30), flat('chain', 1)] },
  ember: { name: 'Glut', req: ['fire'], mods: [more('dmg_fire', 30)] },
  rime: { name: 'Raureif', req: ['cold'], mods: [more('dmg_cold', 30), inc('chillEffect', 30)] },
  pestilent: { name: 'Seuchen', req: ['dot'], mods: [more('dmg_dot', 35)] },
  rapid: { name: 'Schnell', req: ['attack'], mods: [more('speed_attack', 25)] },
  arcane: { name: 'Arkan', req: ['spell'], mods: [more('dmg_spell', 25), inc('crit_spell', 40)] },
};
export const RUNE_TRAIT_IDS = Object.keys(RUNE_TRAITS);
export const traitFits = (t, def) => !t.req.length || t.req.some((x) => def.tags.includes(x));
export function rollTraits(def, n) {
  const pool = RUNE_TRAIT_IDS.filter((id) => traitFits(RUNE_TRAITS[id], def));
  const out = [];
  for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

// ===================================================================== Sternenbestien (prozedurale Bosse)
const BEAST_PRE = ['Gor', 'Xal', 'Mor', 'Vex', 'Ka', 'Thul', 'Zar', 'Uth', 'Ny', 'Bra', 'Skal', 'Ix', 'Orm', 'Vy'];
const BEAST_MID = ['gath', 'thor', 'nax', 'ruul', 'meth', 'zor', 'ka', 'thys', 'gol', 'vash', 'dra', 'kor'];
const BEAST_TITLE = ['der Weltenfresser', 'die Sternenmutter', 'der Leerenwurm', 'das Ungeborene', 'der Kometenreiter', 'die Ewige Flamme',
  'der Frostkönig', 'die Gewitterbestie', 'der Knochenthron', 'das Auge im Nichts', 'der Splitterlord', 'die Seuchenkönigin'];
const ELEM_COLORS = { fire: '#ff7a2a', cold: '#62d6ff', light: '#ffe34d', chaos: '#9cff5e', phys: '#e6dccb' };
export const BEAST_PATTERNS = ['ring', 'spiral', 'barrage', 'charge', 'slam', 'summon', 'laser', 'blink', 'pools', 'firewall', 'cross', 'rain', 'vortex', 'clones'];
export function makeBeast(seed, idx = null) {
  const rng = makeRng(seed);
  const elem = rng.pick(Object.keys(ELEM_COLORS));
  const pats = rng.shuffle([...BEAST_PATTERNS]);
  const phaseN = rng.int(2, 3);
  const phases = [];
  for (let i = 0; i < phaseN; i++) {
    const k = 3 + i;
    phases.push({ at: i === 0 ? 1 : 1 - i / phaseN, patterns: pats.slice(0, k).map((p) => [p, rng.range(2.6, 4.6) - i * 0.4]) });
    rng.shuffle(pats);
  }
  const summons = Object.keys(ENEMIES).filter((k) => !['nest', 'turret', 'wartotem', 'mite', 'slimelet'].includes(k));
  return {
    name: `${rng.pick(BEAST_PRE)}${rng.pick(BEAST_MID)} ${idx === null ? rng.pick(BEAST_TITLE) : BEAST_TITLE[idx % BEAST_TITLE.length]}`,
    hp: Math.round(rng.range(2400, 3600)), dmg: Math.round(rng.range(20, 28)), speed: Math.round(rng.range(40, 72)),
    r: Math.round(rng.range(34, 50)), color: ELEM_COLORS[elem], elem, summon: rng.pick(summons),
    phases, patterns: phases[0].patterns, beast: true,
  };
}
/** Registriert eine Sternenbestie als Boss und gibt die Boss-ID zurück. */
export function beastId(seed, idx = null) {
  const id = `beast_${seed >>> 0}`;
  if (!BOSSES[id]) BOSSES[id] = makeBeast(seed >>> 0, idx);
  return id;
}

// ===================================================================== Sternwarte: Ressourcen & Gebäude
export const RES = {
  ore: { name: 'Sternenerz', icon: '⛏', color: '#c9a27a' },
  crystal: { name: 'Kristall', icon: '💎', color: '#62d6ff' },
  essence: { name: 'Essenz', icon: '⚗', color: '#c58bff' },
};
export const BUILDINGS = {
  vault: { name: 'Schatzkammer', icon: '🏛', desc: 'Erzeugt Sternenstaub, auch wenn du nicht spielst.', max: 10,
    cost: (l) => ({ ore: 40 * (l + 1) ** 1.6, crystal: 10 * l ** 1.5 }), prod: (l) => ({ dust: 18 * l }) },
  mine: { name: 'Sternenmine', icon: '⛏', desc: 'Fördert Sternenerz.', max: 10,
    cost: (l) => ({ ore: 25 * (l + 1) ** 1.5, essence: 5 * l ** 1.4 }), prod: (l) => ({ ore: 6 * l }) },
  observatory: { name: 'Observatorium', icon: '🔭', desc: 'Sammelt Kristalle aus dem Sternenlicht. +1 Kartenplatz je 2 Stufen.', max: 10,
    cost: (l) => ({ ore: 50 * (l + 1) ** 1.5, crystal: 15 * l ** 1.5 }), prod: (l) => ({ crystal: 2.5 * l }) },
  lab: { name: 'Alchemielabor', icon: '⚗', desc: 'Destilliert Essenz und schaltet Tränke frei.', max: 10,
    cost: (l) => ({ ore: 45 * (l + 1) ** 1.5, crystal: 12 * (l + 1) ** 1.4 }), prod: (l) => ({ essence: 2 * l }) },
  hatchery: { name: 'Brutstätte', icon: '🥚', desc: 'Brütet Gefährten-Eier aus (eines pro 24 h ÷ Stufe).', max: 6,
    cost: (l) => ({ ore: 80 * (l + 1) ** 1.6, essence: 25 * (l + 1) ** 1.4, crystal: 20 * l ** 1.5 }), prod: (l) => ({ egg: l / 24 }) },
  library: { name: 'Bibliothek', icon: '📚', desc: '+5% Konto-Erfahrung je Stufe.', max: 10,
    cost: (l) => ({ ore: 60 * (l + 1) ** 1.5, essence: 15 * (l + 1) ** 1.4 }), prod: () => ({}) },
  forge: { name: 'Meisterschmiede', icon: '⚒', desc: 'Schmieden und Runenschliff im Run −5% Kosten je Stufe; ab Stufe 5 auch mythische Effekte umschmieden.', max: 10,
    cost: (l) => ({ ore: 70 * (l + 1) ** 1.6, crystal: 10 * (l + 1) ** 1.4 }), prod: () => ({}) },
  training: { name: 'Übungsplatz', icon: '🎯', desc: 'Starte Runs mit +1 Stufe je 2 Gebäudestufen.', max: 10,
    cost: (l) => ({ ore: 55 * (l + 1) ** 1.6, essence: 10 * (l + 1) ** 1.4 }), prod: () => ({}) },
};
export const PROD_CAP_HOURS = 16;

// ===================================================================== Alchemie: Tränke für den nächsten Run
export const POTIONS = {
  strength: { name: 'Trank der Stärke', desc: '+25% mehr Schaden für einen Run', cost: { essence: 20, crystal: 5 }, lab: 1, mods: [more('dmg', 25)] },
  iron: { name: 'Eisenhaut-Elixier', desc: '+30% mehr Leben für einen Run', cost: { essence: 20, ore: 30 }, lab: 1, mods: [more('life', 30)] },
  swift: { name: 'Quecksilbertrank', desc: '+15% Tempo und +10% Bewegung', cost: { essence: 25, crystal: 8 }, lab: 2, mods: [inc('speed', 15), inc('move', 10)] },
  luck: { name: 'Glückselixier', desc: '+60% Gegenstandsseltenheit', cost: { essence: 30, crystal: 10 }, lab: 3, mods: [inc('luck', 60)] },
  wisdom: { name: 'Trank der Weisheit', desc: '+30% Erfahrung im Run', cost: { essence: 30, ore: 40 }, lab: 3, mods: [inc('xp', 30)] },
  elements: { name: 'Prismatrank', desc: '+20% Widerstände', cost: { essence: 35, crystal: 12 }, lab: 4, mods: [flat('res_elem', 20), flat('res_chaos', 15)] },
  greed: { name: 'Trank der Gier', desc: '+50% Sternenstaub aus dem Run', cost: { essence: 50, crystal: 20 }, lab: 5, mods: [inc('dust', 50)] },
  titan: { name: 'Titanenblut', desc: '+1 Stufe aller Fertigkeiten', cost: { essence: 70, crystal: 30, ore: 80 }, lab: 7, mods: [flat('lvl', 1)] },
  star: { name: 'Sternenessenz', desc: '+40% mehr Schaden, +20% mehr Leben', cost: { essence: 120, crystal: 50 }, lab: 10, mods: [more('dmg', 40), more('life', 20)] },
};

// ===================================================================== Schicksalskarten
// Werden aus Vorlagen erzeugt: jede Vorlage gibt es in mehreren Seltenheiten.
const CARD_TEMPLATES = [
  ['Der Krieger', (k) => [inc('dmg_attack', 10 * k)]], ['Die Magierin', (k) => [inc('dmg_spell', 10 * k)]],
  ['Der Schütze', (k) => [inc('dmg_proj', 10 * k)]], ['Der Beschwörer', (k) => [inc('dmg_minion', 12 * k)]],
  ['Die Flamme', (k) => [inc('dmg_fire', 12 * k)]], ['Der Frost', (k) => [inc('dmg_cold', 12 * k)]],
  ['Der Blitz', (k) => [inc('dmg_light', 12 * k)]], ['Die Seuche', (k) => [inc('dmg_chaos', 12 * k)]],
  ['Der Fels', (k) => [inc('dmg_phys', 12 * k)]], ['Die Festung', (k) => [inc('life', 6 * k)]],
  ['Der Schild', (k) => [flat('barrier', 20 * k)]], ['Der Wind', (k) => [inc('move', 4 * k)]],
  ['Die Uhr', (k) => [inc('speed', 3 * k)]], ['Das Auge', (k) => [inc('crit', 15 * k)]],
  ['Die Klinge', (k) => [flat('critMulti', 10 * k)]], ['Der Kreis', (k) => [inc('area', 6 * k)]],
  ['Der Händler', (k) => [flat('startGold', 30 * k)]], ['Das Glück', (k) => [inc('luck', 12 * k)]],
  ['Der Weise', (k) => [inc('xp', 6 * k)]], ['Der Vampir', (k) => [flat('leech', 0.5 * k)]],
  ['Der Arzt', (k) => [flat('lifeRegen', 1 * k)]], ['Die Mauer', (k) => [flat('armor', 40 * k)]],
  ['Der Schatten', (k) => [flat('evasion', 40 * k)]], ['Das Prisma', (k) => [flat('res_elem', 5 * k)]],
  ['Der Henker', (k) => [inc('dmgVsLow', 15 * k)]], ['Der Jäger', (k) => [inc('dmgVsBoss', 12 * k)]],
  ['Die Fäulnis', (k) => [inc('dmg_dot', 12 * k)]], ['Die Falle', (k) => [inc('dmg_trap', 14 * k)]],
  ['Die Aura', (k) => [inc('dmg_aura', 14 * k)]], ['Der Wirbel', (k) => [inc('dmg_orbit', 14 * k)]],
  ['Die Asche', (k) => [flat('igniteChance', 5 * k)]], ['Die Natter', (k) => [flat('poisonChance', 6 * k)]],
  ['Der Dorn', (k) => [flat('bleedChance', 6 * k)]], ['Der Sturm', (k) => [flat('shockChance', 5 * k)]],
  ['Der Winter', (k) => [flat('freezeChance', 3 * k)]], ['Die Ewigkeit', (k) => [inc('dur', 8 * k)]],
  ['Der Staub', (k) => [inc('dust', 6 * k)]], ['Der Stern', (k) => [inc('dmg', 5 * k)]],
  ['Der Narr', (k) => [more('dmg', 6 * k), more('life', -4 * k)]], ['Die Welt', (k) => [inc('dmg', 3 * k), inc('life', 3 * k), inc('speed', 1.5 * k)]],
];
export const CARD_RARITY = [
  { id: 'common', name: 'Gewöhnlich', mult: 1, color: '#c9c3b5', w: 60 },
  { id: 'rare', name: 'Selten', mult: 1.8, color: '#7aa8ff', w: 28 },
  { id: 'epic', name: 'Episch', mult: 3, color: '#d77bff', w: 10 },
  { id: 'legend', name: 'Legendär', mult: 5, color: '#ffb33d', w: 2 },
];
export const CARDS = {};
CARD_TEMPLATES.forEach(([name, fn], i) => {
  // Jede Vorlage gibt es als gewöhnliche + eine höhere Seltenheit (80 Karten)
  const hi = i % 10 < 6 ? 1 : i % 10 < 9 ? 2 : 3;
  for (const r of [0, hi]) CARDS[`c${i}_${r}`] = { name: r ? `${name} (${CARD_RARITY[r].name})` : name, rarity: r, fn };
});
export const CARD_IDS = Object.keys(CARDS);
export const CARD_MAX_LVL = 5;
export const cardMods = (id, lvl) => {
  const c = CARDS[id];
  const k = CARD_RARITY[c.rarity].mult * (1 + 0.35 * (lvl - 1));
  return c.fn(k).map((m) => ({ ...m, v: Math.round(m.v * 10) / 10 }));
};
export const PACK_COST = { crystal: 30 };
export function openPack(n = 4) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = weighted(CARD_RARITY.map((x, k) => ({ ...x, k })), (x) => x.w).k;
    const pool = CARD_IDS.filter((id) => CARDS[id].rarity === r);
    out.push(pick(pool.length ? pool : CARD_IDS));
  }
  return out;
}
export const deckSize = (obsLvl) => 4 + Math.floor(obsLvl / 2);

// ===================================================================== Ligen & Saison
export const LEAGUES = [
  { id: 'bloodmoon', name: 'Liga des Blutmonds', desc: 'Jeder Kampf hat Eliten, Gegner explodieren beim Tod.', muts: ['elites', 'volatile'], bonus: 60 },
  { id: 'starfall', name: 'Liga des Sternenregens', desc: 'Meteore fallen in jedem Kampf, Gegner sind zahlreicher.', muts: ['hazards', 'horde'], bonus: 50 },
  { id: 'titans', name: 'Liga der Titanen', desc: 'Gegner haben mehr Leben und Bosse sind wütend.', muts: ['titans', 'bossrage'], bonus: 70 },
  { id: 'famine', name: 'Liga des Hungers', desc: 'Keine Heilung nach Kämpfen, weniger Gold.', muts: ['famine', 'poor'], bonus: 60 },
  { id: 'haste', name: 'Liga der Hast', desc: 'Alles ist schneller und brutaler.', muts: ['swift', 'brutal'], bonus: 60 },
  { id: 'glass', name: 'Liga des Glases', desc: 'Weniger Leben, mehr Wagnis.', muts: ['glass', 'blind'], bonus: 60 },
];
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}
export const currentLeague = () => {
  const k = weekKey();
  let h = 0;
  for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { ...LEAGUES[h % LEAGUES.length], key: k };
};
export const seasonKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const SEASON_TIERS = 40;
export const seasonXpFor = (tier) => 300 + tier * 60;
export function seasonReward(tier) {
  if (tier % 10 === 9) return { mythic: 1, label: 'Mythischer Gegenstand (im nächsten Run)' };
  if (tier % 5 === 4) return { egg: 1, label: 'Gefährten-Ei' };
  if (tier % 3 === 2) return { pack: 1, label: 'Kartenpack' };
  if (tier % 2 === 1) return { res: { ore: 60 + tier * 6, crystal: 15 + tier * 2, essence: 15 + tier * 2 }, label: 'Ressourcen' };
  return { dust: 200 + tier * 40, label: `✦ ${200 + tier * 40} Sternenstaub` };
}
