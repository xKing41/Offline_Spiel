// Speicherstand: Konto (Meta-Fortschritt) + laufender Run.
// Alles liegt lokal (localStorage). Export/Import als Text für Backups.
import { SKILLS, SUPPORTS } from './data/skills.js';
import { CLASSES, ACHIEVEMENTS, ALTAR } from './data/content.js';
import { UNIQUES } from './data/items.js';
import { ENEMIES } from './data/content.js';
import { getAtlas, PET_IDS, SET_PIECES, paragonPoints } from './data/endgame.js';
import { TREE_VERSION, getTree } from './data/tree.js';

const KEY = 'runenfall.save.v1';

function defaults() {
  return {
    v: 1,
    treeV: TREE_VERSION,
    created: Date.now(),
    dust: 0,
    axp: 0,
    alloc: {},
    unlockedCls: Object.keys(CLASSES).filter((c) => CLASSES[c].unlock === 0),
    lastCls: 'pyro',
    codex: {
      skills: Object.keys(SKILLS).filter((k) => !SKILLS[k].cost),
      supports: Object.keys(SUPPORTS).filter((k) => !SUPPORTS[k].cost),
      uniques: [],
      sets: [],
      evos: [],
    },
    altar: {},
    ascend: {},
    pets: {},
    jewels: [],
    jewelSock: {},
    mastery: {},
    loadouts: {},
    atlas: { done: {}, points: 0, passives: {}, target: null },
    paragon: {},
    quests: [],
    base: { lvl: {}, res: { ore: 0, crystal: 0, essence: 0 }, last: Date.now(), potions: {}, eggT: 0, dustT: 0 },
    cards: {},
    deck: [],
    nemesis: [],
    runeArchive: [],
    season: null,
    dailyDone: null,
    relics: [],
    relicEq: [],
    ach: {},
    ascUnlocked: 0,
    stats: {
      runs: 0, wins: {}, kills: 0, bossKills: { shepherd: 0, queen: 0, voidlord: 0 },
      maxAscWin: -1, maxAbyss: 0, maxHit: 0, maxRunLvl: 0, mythic: 0, keystone: 0,
      playTime: 0, bestRun: null, enemyKills: {}, dailies: 0, quests: 0, maxProphWin: 0, flawless: 0,
      fastestWin: 1e9, lastCls: null, nemesisSlain: 0, nemesisMax: 0, beasts: 0, leagueRuns: 0, potionsBrewed: 0, buildingUps: 0, packsOpened: 0,
    },
    settings: { sound: true, vibrate: true, dmgNums: true, shake: true, gfx: 'auto' },
    run: null,
  };
}

/** Fehlende Felder aus den Standardwerten ergänzen (für ältere Speicherstände). */
function fill(target, def) {
  for (const k in def) {
    if (target[k] === undefined) target[k] = def[k];
    else if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k]) && typeof target[k] === 'object') fill(target[k], def[k]);
  }
  return target;
}

export let save = load();

function load() {
  let s;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
  s = fill(s || {}, defaults());
  if (s.treeV !== TREE_VERSION) { s.alloc = {}; s.jewelSock = {}; s.mastery = {}; s.treeV = TREE_VERSION; s.treeReset = true; }
  // Startknoten sicherstellen
  const tree = getTree();
  for (const cls of Object.keys(CLASSES)) {
    const st = tree.starts[cls];
    if (!Array.isArray(s.alloc[cls])) s.alloc[cls] = [st];
    s.alloc[cls] = s.alloc[cls].filter((id) => tree.nodes.has(id));
    if (!s.alloc[cls].includes(st)) s.alloc[cls].unshift(st);
  }
  return s;
}

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); return true; } catch (e) { return false; }
}

export function exportSave() {
  const json = JSON.stringify(save);
  return btoa(unescape(encodeURIComponent(json)));
}
export function importSave(text) {
  const json = decodeURIComponent(escape(atob(text.trim())));
  const s = JSON.parse(json);
  if (!s || typeof s !== 'object' || s.alloc === undefined) throw new Error('Ungültiger Spielstand');
  localStorage.setItem(KEY, JSON.stringify(s));
  save = load();
  return save;
}
export function resetSave() {
  localStorage.removeItem(KEY);
  save = load();
}

// ---------- Kontostufe ----------
export const xpForLevel = (l) => Math.round(110 + 45 * l + 2.2 * l * l);
export function accountLevel(axp = save.axp) {
  let l = 1, need = xpForLevel(1), rest = axp;
  while (rest >= need) { rest -= need; l++; need = xpForLevel(l); }
  return { level: l, cur: rest, need };
}

export function achievementPoints() {
  let p = 0;
  for (const a of ACHIEVEMENTS) if (save.ach[a.id] && a.reward.points) p += a.reward.points;
  return p;
}
/** Verfügbare Sternpunkte gesamt (jede Klasse kann alle Punkte verteilen). */
export const START_POINTS = 6;
/** Pro Kontostufe 1 Punkt, alle 4 Stufen 1 Bonuspunkt – die Karte ist riesig. */
export const totalPoints = () => { const l = accountLevel().level; return l - 1 + Math.floor(l / 4) + START_POINTS + achievementPoints(); };
export const spentPoints = (cls) => save.alloc[cls].length - 1;

export const altarLvl = (id) => save.altar[id] || 0;
export const paragonFree = () => paragonPoints(accountLevel().level) - Object.values(save.paragon || {}).reduce((a, b) => a + b, 0);
export const relicSlots = () => 3 + altarLvl('relic');

export function checkAchievements() {
  const newly = [];
  const ctx = {
    level: accountLevel().level, uniques: Object.keys(UNIQUES).length,
    skills: Object.keys(SKILLS).length, supports: Object.keys(SUPPORTS).length,
    altarMaxed: ALTAR.filter((a) => (save.altar[a.id] || 0) >= a.max).length,
    bestiary: Object.keys(ENEMIES).filter((k) => (save.stats.enemyKills || {})[k] > 0).length,
    enemyTypes: Object.keys(ENEMIES).length,
    atlasRegions: Object.keys(getAtlas().regions).length, pets: PET_IDS.length, setPieces: SET_PIECES.length,
  };
  for (const a of ACHIEVEMENTS) {
    if (save.ach[a.id]) continue;
    let ok = false;
    try { ok = a.check(save, ctx); } catch (e) { ok = false; }
    if (ok) {
      save.ach[a.id] = Date.now();
      if (a.reward.dust) save.dust += a.reward.dust;
      newly.push(a);
    }
  }
  return newly;
}

export { ALTAR };
