// Spielmodi neben Feldzug und Abgrund: Sternenturm (Wochenturm mit Bestenliste),
// Boss-Rush (alle Bosse am Stück) und Sternenjagd (Karte selbst erkunden, Bestie aufspüren).
import { makeRng, hashStr, clamp } from '../util.js';
import { BIOMES, BOSSES, MUTATORS } from './content.js';
import { weekKey, beastId, makeBeast } from './systems.js';

export const MODE_INFO = {
  normal: { name: 'Feldzug', icon: '⚔', short: '3 Akte · 3 Bosse', desc: 'Der klassische Run über drei Akte.' },
  abyss: { name: 'Abgrund', icon: '☾', short: 'Endlos', desc: 'Immer tiefer, immer stärker. Jede 5. Ebene ein Boss.' },
  tower: { name: 'Sternenturm', icon: '♜', short: 'Wochenturm · Bestenliste', desc: 'Jede Woche ein neuer Turm mit festen Etagen und Gesetzen. Kletter höher als deine Rivalen.' },
  rush: { name: 'Boss-Rush', icon: '♛', short: '10 Bosse am Stück', desc: 'Alle Bosse hintereinander, dazu ein Endgegner. Jede Sekunde zählt.' },
  hunt: { name: 'Sternenjagd', icon: '✧', short: 'Karte erkunden', desc: 'Erkunde eine verhüllte Karte, folge Spuren und erlege die Sternenbestie, bevor sie dich findet.' },
};
export const MODE_IDS = Object.keys(MODE_INFO);

/** Freischaltung der Modi (bekommt den Spielstand übergeben). */
export function modeLock(id, s) {
  const wins = Object.keys(s.stats.wins || {}).length;
  const bossTypes = Object.values(s.stats.bossKills || {}).filter((v) => v > 0).length;
  if (id === 'abyss' && !wins) return 'Gewinne einen Feldzug';
  if (id === 'rush' && bossTypes < 3) return `Besiege 3 verschiedene Bosse (${bossTypes}/3)`;
  if (id === 'hunt' && !wins) return 'Gewinne einen Feldzug';
  return null;
}

/** Bosse mit zufälligen IDs (Sternenbestien) nach dem Laden wieder anlegen. */
export function ensureBoss(id) {
  if (id && !BOSSES[id] && String(id).startsWith('beast_')) BOSSES[id] = makeBeast(Number(String(id).slice(6)) >>> 0, null);
  return BOSSES[id];
}

// ===================================================================== Sternenturm
export const TOWER_LAWS = ['calm', 'horde', 'titans', 'brutal', 'swift', 'elites', 'volatile', 'hazards'];
export const lawName = (l) => (l === 'calm' ? 'Stille' : MUTATORS[l].name);
export const lawDesc = (l) => (l === 'calm' ? 'Keine Besonderheit' : MUTATORS[l].desc);
export const TOWER_MILES = [10, 20, 30, 40, 50, 60];
export const towerMileReward = (m) => ({ dust: 120 + m * 18, res: { ore: 20 + m * 3, crystal: 4 + Math.round(m * 0.8), essence: 6 + m } });
export const towerPower = (f) => Math.pow(1.17, f - 1);
export const towerAct = (f) => Math.min(3, 1 + Math.floor((f - 1) / 6));

/** Aufbau einer Etage – für alle Spieler einer Woche gleich. */
export function towerFloor(key, f) {
  const h = hashStr('turm' + key);
  const rng = makeRng(h + f * 7919);
  const ids = Object.keys(BIOMES);
  const biome = ids[(h + Math.floor((f - 1) / 3)) % ids.length];
  const type = f % 5 === 0 ? 'boss' : f % 5 === 3 ? 'elite' : 'fight';
  const law = f <= 2 ? 'calm' : rng.pick(TOWER_LAWS);
  const law2 = f >= 18 && rng.chance(45) ? rng.pick(TOWER_LAWS.filter((x) => x !== law && x !== 'calm')) : null;
  const boss = type === 'boss' ? (f >= 30 && f % 10 === 0 ? beastId(h + f) : BIOMES[biome].boss) : null;
  return { f, type, law, law2, biome, boss };
}
/** Nach jeder dritten Etage: Rastplatz (Händler, Schmiede oder Lager). */
export const towerCampAfter = (f) => f % 3 === 0;

const RIVAL_FIRST = ['Aldric', 'Mira', 'Kael', 'Yrsa', 'Thorne', 'Lysa', 'Varek', 'Nyx', 'Bran', 'Selene', 'Orrin', 'Ilka', 'Darian', 'Feyra', 'Joren', 'Tamsin', 'Ulric', 'Wren', 'Zora', 'Edric', 'Maelis', 'Quill'];
const RIVAL_TITLE = ['Sternenklinge', 'der Unbeugsame', 'Funkenherz', 'die Stille', 'Nachtwanderer', 'Aschenfaust', 'die Glühende', 'Turmbrecher',
  'Runenseherin', 'der Letzte', 'Splitterhand', 'Sturmauge', 'Frostkrone', 'die Rastlose', 'Leerenläufer', 'Glutatem'];
const CLS_IDS = ['pyro', 'storm', 'ranger', 'plague', 'warden', 'binder', 'monk', 'hunter', 'chrono'];
export const TOWER_RIVALS = 15;

/** Montag 0 Uhr der aktuellen Woche (lokale Zeit). */
export function weekStart(now = Date.now()) {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day).getTime();
}
/** Wochenfortschritt 0..1 */
export const weekProgress = (now = Date.now()) => clamp((now - weekStart(now)) / (7 * 86400000), 0, 1);

function genRivals(key, anchor) {
  const rng = makeRng(hashStr('rivalen' + key));
  const names = rng.shuffle([...RIVAL_FIRST]);
  const out = [];
  for (let i = 0; i < TOWER_RIVALS; i++) {
    const f = 0.42 + (1.2 * i) / (TOWER_RIVALS - 1) + rng.range(-0.06, 0.06);
    out.push({ name: `${names[i % names.length]} ${rng.pick(RIVAL_TITLE)}`, cls: rng.pick(CLS_IDS), final: Math.max(3, Math.round(anchor * f)), ph: rng.range(-0.12, 0.12) });
  }
  return out;
}
/** Etage, die ein Rivale bis jetzt erreicht hat (die Rivalen klettern im Laufe der Woche). */
export function rivalFloor(r, p = weekProgress()) {
  return Math.max(1, Math.round(r.final * clamp(0.3 + 0.7 * Math.pow(p, 0.75) + r.ph, 0.15, 1)));
}
const towerRank = (best, floors) => 1 + floors.filter((x) => x > best).length;

export function rankReward(rank) {
  if (rank === 1) return { dust: 1600, res: { crystal: 70, essence: 60 }, mythic: 1, pack: 1, label: '✦ 1600 · 70 Kristall · Mythischer Gegenstand · Kartenpack' };
  if (rank <= 3) return { dust: 1000, res: { crystal: 45, essence: 40 }, pack: 1, label: '✦ 1000 · 45 Kristall · Kartenpack' };
  if (rank <= 8) return { dust: 600, res: { crystal: 25, essence: 20 }, label: '✦ 600 · 25 Kristall' };
  return { dust: 250, res: { essence: 10 }, label: '✦ 250 · 10 Essenz' };
}

/**
 * Wochenstand des Turms holen (legt bei neuer Woche alles neu an und wertet die alte Woche aus).
 * anchor = erwartete Kletterhöhe des Spielers (für passende Rivalen).
 */
export function towerState(s, anchor, now = Date.now()) {
  const key = weekKey(new Date(now));
  let T = s.tower;
  if (!T || T.key !== key) {
    let last = T && T.last && !T.last.claimed ? T.last : null;
    if (T && T.key && T.best > 0) {
      const rank = towerRank(T.best, T.rivals.map((r) => r.final));
      last = { key: T.key, best: T.best, rank, of: T.rivals.length + 1, claimed: false };
    }
    T = s.tower = { key, best: 0, bestTime: 0, bestCls: null, tries: 0, miles: [], rivals: genRivals(key, anchor), last };
  }
  return T;
}
/** Aktuelle Bestenliste (Rivalen + Spieler), sortiert. */
export function towerBoard(T, p = weekProgress()) {
  const rows = T.rivals.map((r) => ({ name: r.name, cls: r.cls, floor: rivalFloor(r, p), me: false }));
  rows.push({ name: 'Du', cls: T.bestCls, floor: T.best, me: true, time: T.bestTime });
  rows.sort((a, b) => b.floor - a.floor || (a.me ? -1 : b.me ? 1 : 0));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

// ===================================================================== Boss-Rush
const RUSH_TIERS = [['shepherd', 'colossus', 'hain'], ['queen', 'wyrm', 'mirror'], ['voidlord', 'witch', 'leviathan']];
const RUSH_FINAL = ['fallenstar', 'weaver', 'eternal'];
export const RUSH_POWER = [1.25, 1.6, 2.0, 3.0, 3.8, 4.8, 7.0, 8.8, 10.8, 13.5];
export const RUSH_LEN = RUSH_POWER.length;
export function rushOrder(seed) {
  const rng = makeRng(seed + 4711);
  return [...RUSH_TIERS.flatMap((t) => rng.shuffle([...t])), rng.pick(RUSH_FINAL)];
}
/** Biom, in dem ein Boss kämpft (Endgegner: Abgrundfarben des letzten Gebiets). */
export function bossBiome(id) {
  for (const [bid, b] of Object.entries(BIOMES)) if (b.boss === id) return bid;
  return { fallenstar: 'glutschmiede', weaver: 'leere', eternal: 'spiegel' }[id] || 'leere';
}
export const rushCampAfter = (i) => i % 3 === 2 && i < RUSH_LEN - 1;

// ===================================================================== Sternenjagd
export const HUNT_W = 7, HUNT_H = 9;
export const HUNT_TILES = {
  start: { name: 'Lager', icon: '⌂', col: '#9fb4ff' },
  fight: { name: 'Kampf', icon: '⚔', col: '#e6dccb' },
  elite: { name: 'Elite', icon: '☠', col: '#ff8a5c' },
  trial: { name: 'Prüfung', icon: '⚑', col: '#ffb04d' },
  event: { name: 'Ereignis', icon: '?', col: '#c58bff' },
  treasure: { name: 'Schatz', icon: '◆', col: '#ffd84d' },
  shrine: { name: 'Schrein', icon: '✧', col: '#7dffb0' },
  shop: { name: 'Händler', icon: '⚖', col: '#ffe066' },
  forge: { name: 'Schmiede', icon: '⚒', col: '#ff9a5c' },
  rest: { name: 'Quelle', icon: '☾', col: '#7ad7ff' },
  track: { name: 'Spur', icon: '⋯', col: '#d8b88a' },
  shard: { name: 'Sternsplitter', icon: '✦', col: '#bfe8ff' },
  empty: { name: 'Ödnis', icon: '·', col: '#6a6080' },
  lair: { name: 'Hort der Bestie', icon: '♛', col: '#ff5d5d' },
};
export const HUNT_SHARDS = 3;
export const huntSteps = (tier) => 30 + Math.min(10, tier);
export const huntPower = (tier, dist) => 0.85 * Math.pow(1.45, tier - 1) * (1 + 0.1 * dist);
export const huntAct = (tier) => Math.min(3, 1 + Math.floor((tier - 1) / 2));
export const huntDist = (h, x, y) => Math.abs(x - h.sx) + Math.abs(y - h.sy);

/** Neue Jagdkarte. Tiles: { t, seen, done } – Zeilen von oben (y=0) nach unten. */
export function genHunt(seed, tier) {
  const rng = makeRng(seed + 911);
  const ids = Object.keys(BIOMES);
  const sx = Math.floor(HUNT_W / 2), sy = HUNT_H - 1;
  const tiles = [];
  for (let y = 0; y < HUNT_H; y++) for (let x = 0; x < HUNT_W; x++) {
    const t = rng.weighted([
      { t: 'fight', w: 34 }, { t: 'elite', w: 9 }, { t: 'event', w: 10 }, { t: 'treasure', w: 6 }, { t: 'shrine', w: 5 },
      { t: 'empty', w: 14 }, { t: 'track', w: 8 }, { t: 'shop', w: 3 }, { t: 'forge', w: 3 }, { t: 'rest', w: 4 }, { t: 'trial', w: 3 },
    ]).t;
    tiles.push({ t, seen: false, done: false });
  }
  const at = (x, y) => tiles[y * HUNT_W + x];
  // Hort weit weg vom Lager, in der oberen Hälfte
  let lx, ly;
  do { lx = rng.int(0, HUNT_W - 1); ly = rng.int(0, 3); } while (Math.abs(lx - sx) + Math.abs(ly - sy) < 8);
  at(lx, ly).t = 'lair';
  // Sternsplitter verteilt über die Karte
  let placed = 0, guard = 0;
  while (placed < HUNT_SHARDS && guard++ < 500) {
    const x = rng.int(0, HUNT_W - 1), y = rng.int(0, HUNT_H - 2);
    const tl = at(x, y);
    if (tl.t === 'lair' || tl.t === 'shard' || Math.abs(x - sx) + Math.abs(y - sy) < 3) continue;
    tl.t = 'shard'; placed++;
  }
  // Lager und direkte Nachbarn: harmlos
  at(sx, sy).t = 'start'; at(sx, sy).done = true;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]) { const tl = at(sx + dx, sy + dy); if (tl && ['elite', 'trial', 'shard'].includes(tl.t)) tl.t = 'fight'; }
  const h = { w: HUNT_W, h: HUNT_H, tiles, sx, sy, x: sx, y: sy, lx, ly, tier, steps: huntSteps(tier), shards: 0, moves: 0,
    biome: rng.pick(ids), beast: beastId(seed + 31337), found: false };
  huntReveal(h, sx, sy, 1);
  return h;
}
export const huntTile = (h, x, y) => (x < 0 || y < 0 || x >= h.w || y >= h.h ? null : h.tiles[y * h.w + x]);
export function huntReveal(h, x, y, r = 1) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const t = huntTile(h, x + dx, y + dy); if (t) t.seen = true; }
  if (Math.abs(h.lx - x) <= r && Math.abs(h.ly - y) <= r) h.found = true;
}
/** Felder, auf die man ziehen kann (waagrecht/senkrecht, schon aufgedeckt). */
export function huntMoves(h) {
  const out = [];
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const t = huntTile(h, h.x + dx, h.y + dy);
    if (t && t.seen) out.push([h.x + dx, h.y + dy]);
  }
  return out;
}
const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
/** Richtungspfeil vom Feld zum Hort der Bestie. */
export function huntArrow(h, x, y) {
  const a = Math.atan2(h.ly - y, h.lx - x);
  return ARROWS[(Math.round(a / (Math.PI / 4)) + 8) % 8];
}
/** Spur aufnehmen: deckt Felder in Richtung des Horts auf. */
export function followTrack(h, x, y) {
  let cx = x, cy = y;
  for (let i = 0; i < 3; i++) {
    const dx = Math.sign(h.lx - cx), dy = Math.sign(h.ly - cy);
    if (Math.abs(h.lx - cx) >= Math.abs(h.ly - cy)) cx += dx; else cy += dy;
    huntReveal(h, cx, cy, 0);
    if (cx === h.lx && cy === h.ly) { h.found = true; break; }
  }
}
