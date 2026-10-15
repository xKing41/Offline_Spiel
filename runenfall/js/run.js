// Ablauf eines Runs: Karte, Kampf-Konfiguration, Stufenaufstiege, Belohnungen, Shop, Ereignisse,
// Meta-Belohnungen am Ende. Reine Logik ohne DOM.
import { makeRng, pick, rand, randi, weighted, clamp, shuffle } from './util.js';
import { SKILLS, SUPPORTS, supportFits, MAX_SKILLS, SOCKETS, MAX_SKILL_LVL } from './data/skills.js';
import { BOONS, PATHS, PATH_IDS, MAX_PATHS, TIER_LVL, boonDef, pathTiers, LEGACY_BOONS, LEGACY_FIXED } from './data/boons.js';
import { ACTS, ABYSS, BIOMES, BOSS_IDS, BOON_RARITY, EVENTS, ALTAR, CLASSES, ASCENDANCIES, MUTATORS, QUEST_TEMPLATES, ENEMIES, ascHas, ascHpMult, ascDmgMult } from './data/content.js';
import { makeItem, makeRelic, SLOTS, itemMods, UNIQUES, craftReroll, craftAdd, craftUpgrade, canCraft, itemValue, craftLockReroll, craftFuse, craftCorrupt, craftUniqueUp, UQ_MAX } from './data/items.js';
import { getTree, treeMods } from './data/tree.js';
import { PETS, PET_IDS, PET_MAX, petSkillDef, SETS, getAtlas, atlasPower, ATLAS_PASSIVES, PARAGON, makeJewel, jewelMods } from './data/endgame.js';
import {
  rollTraits, RUNE_TRAITS, MYTHIC_EFFECTS, makeNemesis, NEMESIS_MAX, NEMESIS_IDS, NEMESIS_TAUNTS, beastId, BUILDINGS, POTIONS, CARDS, CARD_IDS, cardMods,
  deckSize, openPack, currentLeague, seasonKey, SEASON_TIERS, seasonXpFor,
} from './data/systems.js';
import { makeMythic } from './data/items.js';
import { EVOLUTIONS } from './data/evolutions.js';
import {
  towerFloor, towerPower, towerAct, towerState, towerBoard, TOWER_MILES, towerMileReward, rushOrder, RUSH_POWER, RUSH_LEN, bossBiome,
  genHunt, huntPower, huntAct, huntDist, ensureBoss,
} from './data/modes.js';
import { weekKey } from './data/systems.js';
import { FACTIONS, FACTION_IDS, repRank, factionBonus, CONTRACTS, contractReward, OFFERS, FACTION_EVENTS, STORY } from './data/factions.js';
import { clock } from './util.js';

// ---------------------------------------------------------------- Sternwarte-Helfer
export const baseLvl = (id) => (save.base && save.base.lvl && save.base.lvl[id]) || 0;
export function addRes(res) {
  save.base = save.base || { lvl: {}, res: {}, last: Date.now(), potions: {}, eggT: 0 };
  for (const [k, v] of Object.entries(res)) save.base.res[k] = Math.round(((save.base.res[k] || 0) + v) * 10) / 10;
}
/** Runen-Archiv: jede Kombination aus Rune und Merkmal wird gesammelt. */
export function archiveRune(inst) {
  save.runeArchive = save.runeArchive || [];
  for (const t of inst.traits || []) {
    const k = `${inst.id}:${t}`;
    if (!save.runeArchive.includes(k)) save.runeArchive.push(k);
  }
}
function rollRuneTraits(run, id) {
  const r = Math.random();
  const bonus = run.asc * 0.01 + (effAct(run) >= 3 ? 0.1 : 0);
  const n = r < 0.08 + bonus ? 2 : r < 0.38 + bonus ? 1 : 0;
  return rollTraits(SKILLS[id], n);
}
function drawCards(run, n) {
  const deck = (save.deck || []).filter((id) => CARDS[id] && save.cards && save.cards[id] && !(run.cards || []).includes(id));
  run.cards = run.cards || [];
  for (let i = 0; i < n && deck.length; i++) run.cards.push(deck.splice(Math.floor(Math.random() * deck.length), 1)[0]);
}
import { ModSet, computePlayer, computeSkill, flatSum, runeName } from './calc.js';
import { save, persist, altarLvl, checkAchievements, accountLevel } from './save.js';

export const LAYERS = 8;
const START_WEAPON = { pyro: 'wand', storm: 'scepter', ranger: 'bow', plague: 'dagger', warden: 'axe', binder: 'totem', monk: 'axe', hunter: 'bow', chrono: 'scepter' };
export const atlasHas = (id) => !!(save.atlas && save.atlas.passives && save.atlas.passives[id]);
export const xpNeed = (l) => Math.round(12 + 7 * l + 0.55 * l * l);

// ---------------------------------------------------------------- Neuer Run
/** Index der ersten Rune, die bereit zur Evolution ist (oder -1). */
export function pendingEvolution(run) {
  return run.skills.findIndex((s) => s.lvl >= MAX_SKILL_LVL && !s.evo && EVOLUTIONS[s.id]);
}
export function evolveRune(run, idx, evo) {
  const s = run.skills[idx];
  if (!s || s.evo || !EVOLUTIONS[s.id]) return false;
  s.evo = evo === 'b' ? 'b' : 'a';
  save.stats.evolutions = (save.stats.evolutions || 0) + 1;
  save.codex.evos = save.codex.evos || [];
  const k = `${s.id}:${s.evo}`;
  if (!save.codex.evos.includes(k)) save.codex.evos.push(k);
  return true;
}
export function newRun({ cls, asc = 0, mode = 'normal', ascend = null, mutators = [], daily = null, seed = null, pet = null, atlas = null, potion = null, league = false, tier = 1 }) {
  if (mode !== 'normal') league = false;
  if (mode === 'tower') mutators = [];
  if (league) { const L = currentLeague(); mutators = [...new Set([...mutators, ...L.muts])]; }
  const run = {
    v: 1, cls, asc, mode, seed: seed ?? Math.floor(Math.random() * 1e9), started: Date.now(),
    ascend: ascend && ASCENDANCIES[ascend] && ASCENDANCIES[ascend].cls === cls ? ascend : null,
    mutators: mutators.filter((m) => MUTATORS[m]), daily, shrine: null, bonusDust: 0,
    pet: pet && save.pets && save.pets[pet] ? pet : null,
    atlas: mode === 'normal' && !daily && atlas && atlasUnlocked(atlas) ? atlas : null,
    eggs: 0, atlasBonus: 0,
    act: 0, floor: 0, map: null, pos: null, done: [],
    lvl: 1, xp: 0, gold: 0, hp: null,
    skills: [{ id: CLASSES[cls].start, lvl: 1, sup: [null, null, null] }],
    glyphs: [], eq: {}, bag: [], boons: [], runMods: [],
    rerolls: altarLvl('reroll'), banish: altarLvl('banish'), banned: [],
    revive: altarLvl('revive') > 0, pendingLvl: 0,
    stats: { kills: 0, elites: 0, bosses: 0, nodes: 0, maxHit: 0, dmg: 0, relics: [], byType: {}, gold: 0 },
  };
  run.league = league ? currentLeague().key : null;
  run.leagueBonus = league ? currentLeague().bonus : 0;
  if (potion && save.base && save.base.potions && save.base.potions[potion] > 0) {
    save.base.potions[potion]--;
    run.potion = potion;
  }
  if (save.pendingMythic > 0) { save.pendingMythic--; run.bag.push(makeMythic(40)); run.gotMythic = true; }
  drawCards(run, 2);
  const tl = Math.floor(baseLvl('training') / 2);
  if (tl) { run.lvl += tl; run.pendingLvl += tl; }
  const brng = makeRng(run.seed + 17);
  run.biomes = ACTS.map((a) => brng.pick(a.biomes));
  if (run.mutators.includes('glass')) run.runMods.push({ s: 'life', t: 'more', v: -30 });
  if (run.mutators.includes('poor')) run.runMods.push({ s: 'gold', t: 'more', v: -50 });
  run.skills[0].lvl += altarLvl('runelvl');
  if (atlasHas('aReroll')) run.rerolls += 2;
  if (atlasHas('aStart')) { run.lvl += 2; run.pendingLvl += 2; }
  const sets = buildSets(run);
  run.gold = Math.round(flatSum(sets, 'startGold'));
  for (let i = 0; i < altarLvl('start'); i++) run.glyphs.push(randomGlyph(run));
  const gearSlots = shuffle(['armor', 'helm', 'gloves', 'boots', 'belt', 'amulet', 'ring']);
  for (let i = 0; i < altarLvl('gear'); i++) run.eq[gearSlots[i]] = makeItem({ ilvl: 1, slot: gearSlots[i], rarity: 'magic' });
  // Startausrüstung: eine einfache Waffe
  run.eq.weapon = makeItem({ ilvl: 1, slot: 'weapon', rarity: 'normal' });
  run.eq.weapon.base = START_WEAPON[cls];
  if (mode === 'abyss') { run.floor = 1; run.abyssChoices = genAbyssChoices(run); }
  else if (mode === 'tower') { run.floor = 1; run.towerKey = weekKey(); }
  else if (mode === 'rush') { run.rush = { order: rushOrder(run.seed), idx: 0, time: 0 }; rushKit(run); }
  else if (mode === 'hunt') { run.hunt = genHunt(run.seed, Math.max(1, Math.min(tier, (save.hunt && save.hunt.tier) || 1))); }
  else run.map = genMap(run, 0);
  applyGifts(run);
  run.hp = snapshot(run).P.maxLife;
  return run;
}

// ---------------------------------------------------------------- Werte
export function relicMods() {
  const out = [];
  for (const uid of save.relicEq) {
    const r = save.relics.find((x) => x.uid === uid);
    if (r) out.push(...itemMods(r));
  }
  return out;
}
export function altarMods() {
  const out = [];
  for (const a of ALTAR) if (a.mods && altarLvl(a.id)) out.push(...a.mods(altarLvl(a.id)));
  return out;
}
export function boonMods(b) {
  const def = boonDef(b.id);
  if (!def) {
    // Segen aus der Zeit vor den Pfaden: Werte bleiben im laufenden Run erhalten
    const old = LEGACY_BOONS[b.id];
    if (!old) return [];
    const m0 = LEGACY_FIXED.has(b.id) ? 1 : BOON_RARITY[b.r || 0].mult;
    return old.map((m) => ({ ...m, v: Math.round(m.v * m0 * 10) / 10 }));
  }
  const mult = def.fixed ? 1 : BOON_RARITY[b.r || 0].mult;
  return def.mods.map((m) => ({ ...m, v: Math.round(m.v * mult * 10) / 10 }));
}

/** Liste von ModSets in fester Reihenfolge (wichtig für Begleiter, siehe calc.js). */
export function buildSets(run, opts = {}) {
  const tree = getTree();
  const alloc = new Set(save.alloc[run ? run.cls : opts.cls]);
  const lab = (set, label) => { set.label = label; return set; };
  const sets = [lab(new ModSet(treeMods(tree, alloc, (save.mastery || {})[run ? run.cls : opts.cls] || {})), 'Sternenkarte'), lab(new ModSet(altarMods()), 'Altar'), lab(new ModSet(relicMods()), 'Relikte')];
  if (run) {
    const items = lab(new ModSet(), 'Ausrüstung');
    for (const s of SLOTS) if (run.eq[s]) items.addAll(itemMods(run.eq[s]));
    sets.push(items);
    const boons = lab(new ModSet(), 'Segen & Run-Effekte');
    for (const b of run.boons) boons.addAll(boonMods(b));
    boons.addAll(run.runMods);
    if (run.shrine && run.shrine.fights > 0) boons.addAll(run.shrine.mods);
    if (run.mode === 'normal' && run.act >= 3) {
      if (atlasHas('aPower')) boons.add({ s: 'dmg', t: 'more', v: 8 });
      if (atlasHas('aGuard')) boons.add({ s: 'life', t: 'more', v: 8 });
    }
    // Set-Boni
    const setCount = {};
    for (const s of SLOTS) { const it = run.eq[s]; if (it && it.rarity === 'set') setCount[it.set] = (setCount[it.set] || 0) + 1; }
    for (const [sid, n] of Object.entries(setCount)) for (const [k, mods] of Object.entries(SETS[sid].bonus)) if (n >= Number(k)) boons.addAll(mods);
    sets.push(boons);
    sets.push(lab(new ModSet(ascendMods(run.ascend)), 'Aufstiegsklasse'));
    if (run.pet && save.pets[run.pet]) sets.push(lab(new ModSet(PETS[run.pet].passive(save.pets[run.pet].lvl)), 'Gefährte'));
    const extra = lab(new ModSet(), 'Schicksalskarten & Trank');
    if (run.potion && POTIONS[run.potion]) extra.addAll(POTIONS[run.potion].mods);
    for (const c of run.cards || []) if (CARDS[c] && save.cards && save.cards[c]) extra.addAll(cardMods(c, save.cards[c]));
    sets.push(extra);
  }
  sets.push(lab(new ModSet([...jewelSocketMods(run ? run.cls : opts.cls), ...paragonMods(), ...factionBonus(save.factions)]), 'Juwelen, Sternenmacht & Häuser'));
  return sets;
}

/** Juwelen, die in zugewiesene Sockel der Klasse eingesetzt sind. */
export function jewelSocketMods(cls) {
  const sock = (save.jewelSock || {})[cls] || {};
  const alloc = new Set(save.alloc[cls] || []);
  const out = [];
  for (const [node, juid] of Object.entries(sock)) {
    if (!alloc.has(node)) continue;
    const j = (save.jewels || []).find((x) => x.uid === juid);
    if (j) out.push(...jewelMods(j));
  }
  return out;
}
export function paragonMods() {
  const out = [];
  for (const p of PARAGON) { const n = (save.paragon || {})[p.id] || 0; if (n) out.push(...p.per(n)); }
  return out;
}
export function setCountMax(run) {
  const c = {};
  for (const s of SLOTS) { const it = run.eq[s]; if (it && it.rarity === 'set') c[it.set] = (c[it.set] || 0) + 1; }
  return Math.max(0, ...Object.values(c));
}

// ---------------------------------------------------------------- Atlas
export function atlasUnlocked(id) {
  const reg = getAtlas().regions[id];
  if (!reg) return false;
  const done = (save.atlas && save.atlas.done) || {};
  if (done[id] !== undefined) return true;
  if (reg.c === 0) return true;
  return reg.adj.some((k) => done[k] !== undefined);
}
export const atlasRegion = (run) => (run && run.atlas ? getAtlas().regions[run.atlas] : null);

/** Freigeschaltete Stufen einer Aufstiegsklasse. */
/** Gaben der Häuser (im Händler gekauft) gelten für genau einen Run. */
function applyGifts(run) {
  const gifts = save.gifts || [];
  for (const g of gifts) {
    if (g.weapon) run.eq.weapon = makeItem({ ilvl: 8, slot: 'weapon', rarity: 'rare', luck: 50 });
    if (g.runeLvl) run.skills[0].lvl = Math.min(MAX_SKILL_LVL, run.skills[0].lvl + g.runeLvl);
    if (g.mods) run.runMods.push(...g.mods);
    if (g.forge) run.forgeDisc = Math.min(run.forgeDisc || 1, g.forge);
    if (g.glyphs) for (let i = 0; i < g.glyphs; i++) run.glyphs.push(randomGlyph(run));
    if (g.rune && run.skills.length < MAX_SKILLS) { const id = newSkillChoice(run); if (id) applyChoice(run, { kind: 'newSkill', id, traits: rollRuneTraits(run, id) }); }
    if (g.lvls) { run.lvl += g.lvls; run.pendingLvl += g.lvls; }
    if (g.gold) run.gold += g.gold;
    if (g.pact) { if (!run.mutators.includes('brutal')) run.mutators.push('brutal'); run.leagueBonus = (run.leagueBonus || 0) + 30; }
  }
  run.gifts = gifts.map((g) => g.name);
  save.gifts = [];
}

// ---------------------------------------------------------------- Fraktionen
export function factionState(id) {
  save.factions = save.factions || {};
  if (!save.factions[id]) save.factions[id] = { rep: 0, favor: 0, contract: null, bought: {} };
  return save.factions[id];
}
/** Ruf ändern. Gunst (Währung) gibt es nur für Zuwachs. Gibt die neue Stufe zurück, falls aufgestiegen. */
export function addRep(id, v) {
  const F = factionState(id);
  const before = repRank(F.rep);
  F.rep = Math.max(0, F.rep + v);
  if (v > 0) F.favor += v;
  const after = repRank(F.rep);
  return after > before ? after : null;
}
export function ensureContracts() {
  const lvl = accountLevel().level;
  for (const id of FACTION_IDS) {
    const F = factionState(id);
    if (F.contract && CONTRACTS[id].some((t) => t.id === F.contract.tpl)) continue;
    const pool = CONTRACTS[id].filter((t) => (t.minLvl || 0) <= lvl && (!t.need || t.need(save)) && (!F.contract || t.id !== F.contract.tpl));
    const t = pick(pool.length ? pool : CONTRACTS[id]);
    F.contract = { tpl: t.id, target: t.target(lvl), rep: contractReward(lvl) };
  }
}
export const contractText = (id, c) => CONTRACTS[id].find((t) => t.id === c.tpl).text(c.target);
/** Einen Auftrag gegen einen neuen tauschen (einmal täglich für alle Häuser zusammen). */
export function rerollContract(id) {
  const today = new Date().toDateString();
  if (save.contractReroll === today) return false;
  save.contractReroll = today;
  const F = factionState(id);
  const old = F.contract;
  F.contract = null;
  ensureContracts();
  if (old && F.contract.tpl === old.tpl) ensureContracts();
  return true;
}
/** Kauf beim Händler eines Hauses. Gibt Text zurück oder null. */
export function buyOffer(fid, oid) {
  const F = factionState(fid), o = OFFERS[fid].find((x) => x.id === oid);
  if (!o || repRank(F.rep) < o.rank || F.favor < o.cost) return null;
  if (o.gift && (save.gifts || []).length >= 4) return 'Du kannst höchstens 4 Gaben für den nächsten Run vorbereiten.';
  F.favor -= o.cost;
  F.bought[oid] = (F.bought[oid] || 0) + 1;
  save.stats.favorSpent = (save.stats.favorSpent || 0) + o.cost;
  if (o.gift) { save.gifts = save.gifts || []; save.gifts.push({ ...o.gift, name: o.name, fid }); return `${o.name} liegt für deinen nächsten Run bereit.`; }
  const n = o.now;
  if (n.relic) { const r = makeRelic(20 + 10 * repRank(F.rep) + accountLevel().level, 80); save.relics.push(r); return `Relikt erhalten: ${r.title}`; }
  if (n.mythic) { save.pendingMythic = (save.pendingMythic || 0) + 1; return 'Ein mythischer Gegenstand wartet in deinem nächsten Run.'; }
  if (n.jewel) { const j = makeJewel(20 + accountLevel().level * 2, 60); save.jewels = save.jewels || []; save.jewels.push(j); return `Juwel erhalten: ${j.title}`; }
  if (n.atlas) { save.atlas.points = (save.atlas.points || 0) + 1; return '+1 Atlaspunkt.'; }
  if (n.pack) { const got = openPack(4); save.cards = save.cards || {}; for (const c of got) save.cards[c] = Math.min(5, (save.cards[c] || 0) + 1); save.stats.packsOpened = (save.stats.packsOpened || 0) + 1; return `Kartenpack geöffnet: ${got.map((c) => CARDS[c].name).join(', ')}`; }
  if (n.egg) { const h = hatchEgg(); return `Ein Gefährte schlüpft: ${PETS[h.id].name}${h.isNew ? ' (neu!)' : ` (Stufe ${h.lvl})`}`; }
  if (n.learn) {
    const pool = [...Object.keys(SKILLS).filter((k) => !save.codex.skills.includes(k) && !k.startsWith('pet_')).map((k) => ['skills', k]), ...Object.keys(SUPPORTS).filter((k) => !save.codex.supports.includes(k)).map((k) => ['supports', k])];
    if (!pool.length) { save.dust += 300; return 'Du kennst bereits alles – der Zirkel schenkt dir ✦ 300.'; }
    const [kind, k] = pick(pool);
    save.codex[kind].push(k);
    return `${kind === 'skills' ? 'Rune' : 'Glyphe'} „${(kind === 'skills' ? SKILLS : SUPPORTS)[k].name}“ ist jetzt im Kodex.`;
  }
  return o.name;
}
/** Neu freigeschaltete Kapitel der Sage (noch nicht gesehen). */
export function newChapters() {
  save.story = save.story || { seen: [] };
  return STORY.filter((c) => c.when(save) && !save.story.seen.includes(c.id));
}
/** Ruf am Ende eines Runs: Aufträge und Gesinnung. */
function factionEnd(run, outcome) {
  if (!save.stats.runs) return { lines: [], done: [] };
  const m = questMetrics(run, outcome);
  const gain = {};
  const done = [];
  for (const id of FACTION_IDS) {
    const F = factionState(id), c = F.contract;
    const t = c && CONTRACTS[id].find((x) => x.id === c.tpl);
    if (t && (m[t.key] || 0) >= c.target) {
      gain[id] = (gain[id] || 0) + c.rep;
      done.push({ fid: id, text: contractText(id, c), rep: c.rep });
      save.stats.contracts = (save.stats.contracts || 0) + 1;
      F.contract = null;
    }
  }
  // Gesinnung: jedes Haus achtet auf andere Taten
  const s = run.stats;
  gain.glut = (gain.glut || 0) + Math.min(30, s.elites + s.bosses * 5);
  gain.seher = (gain.seher || 0) + Math.min(30, run.skills.length * 2 + m.runGlyphs + m.runEvo * 8);
  gain.leere = (gain.leere || 0) + Math.min(30, (run.mutators || []).length * 6 + m.runNemesis * 10 + (run.mode === 'abyss' ? run.floor : 0));
  const lines = [];
  for (const id of FACTION_IDS) {
    if (!gain[id]) continue;
    const up = addRep(id, gain[id]);
    lines.push({ fid: id, v: gain[id], up });
  }
  ensureContracts();
  return { lines, done };
}

/** Boss-Rush: Startausrüstung, damit es direkt mit Bossen losgehen kann. */
function rushKit(run) {
  run.lvl += 7; run.pendingLvl += 7;
  const id = newSkillChoice(run);
  if (id) applyChoice(run, { kind: 'newSkill', id, traits: rollRuneTraits(run, id) });
  for (let i = 0; i < 2; i++) run.glyphs.push(randomGlyph(run));
  for (const sl of ['armor', 'helm', 'gloves', 'boots', 'ring']) if (!run.eq[sl]) run.eq[sl] = makeItem({ ilvl: 10, slot: sl, rarity: 'magic' });
  run.gold += 120;
}
/** Fortschritt eines Runs in „Akten“ gemessen (für Preise, Beute-Stufen, Materialien). */
export function effAct(run) {
  if (run.mode === 'abyss') return run.floor / 6;
  if (run.mode === 'tower') return (run.floor - 1) / 6;
  if (run.mode === 'rush') return run.rush.idx / 3;
  if (run.mode === 'hunt') return (run.hunt.tier - 1) * 0.7 + huntDist(run.hunt, run.hunt.x, run.hunt.y) / 10;
  return run.act;
}
/** Erwartete Turmhöhe des Spielers (für passende Rivalen). */
export const towerAnchor = () => clamp(save.stats.maxTower ? save.stats.maxTower * 1.08 + 3 : 7 + accountLevel().level * 0.5, 8, 150);

export function ascendMods(id) {
  const A = ASCENDANCIES[id];
  if (!A) return [];
  const lvl = (save.ascend && save.ascend[id]) || 0;
  return A.nodes.slice(0, lvl).flatMap((n) => n.mods);
}

/** Aktuelles Gebiet (Biom) des Runs. */
export function actInfo(run) {
  if (run.mode === 'abyss') {
    const ids = Object.keys(BIOMES);
    const bid = ids[(run.floor - 1) % ids.length], b = BIOMES[bid];
    return { ...ABYSS, biomeId: bid, tint: b.tint, floor: b.floor, hazard: run.floor > 10 ? b.hazard : null, biomeName: b.name, power: abyssPower(run.floor) };
  }
  if (run.mode === 'tower') {
    const F = towerFloor(run.towerKey, run.floor), b = BIOMES[F.biome];
    return { ...b, biomeId: F.biome, biomeName: b.name, sub: 'Sternenturm', name: `Etage ${run.floor}`, power: towerPower(run.floor), boss: F.boss || b.boss, regionMods: [F.law, F.law2].filter((l) => l && l !== 'calm') };
  }
  if (run.mode === 'rush') {
    const i = Math.min(run.rush.idx, RUSH_LEN - 1), id = run.rush.order[i], bid = bossBiome(id), b = BIOMES[bid];
    return { ...b, biomeId: bid, biomeName: b.name, sub: 'Boss-Rush', name: `Boss ${i + 1}/${RUSH_LEN}`, power: RUSH_POWER[i], boss: id };
  }
  if (run.mode === 'hunt') {
    const h = run.hunt, b = BIOMES[h.biome];
    return { ...b, biomeId: h.biome, biomeName: b.name, sub: 'Sternenjagd', name: `${b.name} · Jagdstufe ${h.tier}`, power: huntPower(h.tier, huntDist(h, h.x, h.y)), boss: h.beast };
  }
  if (run.act >= ACTS.length && run.atlas) {
    const reg = getAtlas().regions[run.atlas];
    const b = BIOMES[reg.biome];
    return { ...b, biomeId: reg.biome, name: reg.name, sub: 'Akt IV', power: atlasPower(reg.tier) * (1 + 0.08 * run.asc), boss: reg.boss, regionMods: reg.mods, tier: reg.tier };
  }
  const A = ACTS[Math.min(run.act, ACTS.length - 1)];
  const bid = (run.biomes && run.biomes[run.act]) || A.biomes[0], b = BIOMES[bid];
  return { ...b, biomeId: bid, sub: A.sub, power: A.power };
}

export function snapshot(run) {
  const sets = buildSets(run);
  const P = computePlayer(sets, run.lvl);
  const skills = run.skills.map((s) => computeSkill(s, sets));
  if (run.pet && save.pets && save.pets[run.pet]) {
    const S = computeSkill({ id: 'pet_' + run.pet, def: petSkillDef(run.pet), lvl: save.pets[run.pet].lvl, sup: [] }, sets);
    if (atlasHas('aPet')) { for (const t in S.dmg) S.dmg[t] = S.dmg[t].map((v) => v * 1.4); S.dps *= 1.4; }
    S.isPet = true;
    skills.push(S);
  }
  return { P, skills, sets };
}

// ---------------------------------------------------------------- Karte
const NODE_TYPES = {
  fight: { name: 'Kampf', icon: '⚔' },
  elite: { name: 'Elite', icon: '☠' },
  shop: { name: 'Händler', icon: '⚖' },
  event: { name: 'Ereignis', icon: '?' },
  forge: { name: 'Schmiede', icon: '⚒' },
  rest: { name: 'Lager', icon: '☾' },
  treasure: { name: 'Schatz', icon: '◆' },
  shrine: { name: 'Schrein', icon: '✧' },
  trial: { name: 'Prüfung', icon: '⚑' },
  boss: { name: 'Boss', icon: '♛' },
};
export { NODE_TYPES };

export function genMap(run, act) {
  const rng = makeRng(run.seed + act * 7919);
  const layers = [];
  for (let l = 0; l < LAYERS; l++) {
    const row = [];
    const n = l === 0 ? 3 : l === LAYERS - 1 ? 1 : 3;
    for (let i = 0; i < n; i++) {
      let type;
      if (l === LAYERS - 1) type = 'boss';
      else if (l === 0) type = 'fight';
      else if (l === LAYERS - 2) type = rng.pick(['rest', 'shop', 'forge']);
      else type = rng.weighted([
        { t: 'fight', w: 46 }, { t: 'elite', w: l >= 2 ? 16 : 0 }, { t: 'event', w: 16 },
        { t: 'shop', w: l >= 2 ? 9 : 0 }, { t: 'forge', w: l >= 2 ? 7 : 0 }, { t: 'rest', w: l >= 3 ? 6 : 0 },
        { t: 'treasure', w: atlasHas('aTreasure') ? 10 : 5 }, { t: 'shrine', w: 6 }, { t: 'trial', w: l >= 3 ? 5 : 0 },
      ]).t;
      row.push({ type, lane: n === 1 ? 1 : i });
    }
    // Mindestens ein Kampf pro Reihe 1–5, damit es genug Erfahrung gibt
    if (l > 0 && l < LAYERS - 2 && !row.some((x) => x.type === 'fight' || x.type === 'elite')) row[rng.int(0, row.length - 1)].type = 'fight';
    layers.push(row);
  }
  return { act, layers, pos: null };
}

export function reachable(run) {
  const m = run.map;
  if (!m.pos) return m.layers[0].map((_, i) => [0, i]);
  const [l, i] = m.pos;
  if (l + 1 >= m.layers.length) return [];
  const lane = m.layers[l][i].lane;
  const next = m.layers[l + 1];
  const out = [];
  next.forEach((n, j) => { if (next.length === 1 || Math.abs(n.lane - lane) <= 1) out.push([l + 1, j]); });
  return out;
}

// ---------------------------------------------------------------- Abgrund
export const abyssPower = (floor) => Math.pow(1.24, floor);
export function genAbyssChoices(run) {
  const f = run.floor;
  if (f % 5 === 0) return [{ type: 'boss', boss: f >= 25 ? beastId(run.seed + f * 7919) : BOSS_IDS[(f / 5 - 1) % BOSS_IDS.length] }];
  const opts = [{ type: 'fight' }, { type: Math.random() < 0.5 ? 'elite' : 'fight' }];
  opts.push({ type: pick(['event', 'shop', 'forge', 'rest', 'elite', 'treasure', 'shrine', 'trial']) });
  return opts;
}

// ---------------------------------------------------------------- Kampf-Konfiguration
export function itemLevel(run) {
  if (run.mode === 'abyss' || run.mode === 'tower') return clamp(4 + run.floor * 3 + run.asc * 2, 1, 100);
  if (run.mode === 'rush') return clamp(8 + run.rush.idx * 9 + run.asc * 3, 1, 100);
  if (run.mode === 'hunt') return clamp(6 + run.hunt.tier * 10 + huntDist(run.hunt, run.hunt.x, run.hunt.y) * 2 + run.asc * 3, 1, 100);
  const layer = run.map && run.map.pos ? run.map.pos[0] : 0;
  return clamp(1 + run.act * 26 + layer * 3 + run.asc * 3, 1, 100);
}

export function combatCfg(run, node) {
  const asc = run.asc;
  const A = actInfo(run);
  let power, act;
  if (run.mode === 'abyss') {
    power = A.power; act = 3;
  } else if (run.mode === 'tower') {
    power = A.power; act = towerAct(run.floor);
  } else if (run.mode === 'rush') {
    power = A.power; act = Math.min(3, 1 + Math.floor(run.rush.idx / 3));
  } else if (run.mode === 'hunt') {
    // Die Bestie ist immer so stark wie an ihrem Hort – auch im Hinterhalt
    power = node.lair ? huntPower(run.hunt.tier, huntDist(run.hunt, run.hunt.lx, run.hunt.ly)) : A.power; act = huntAct(run.hunt.tier);
  } else {
    act = run.act + 1;
    const layer = run.map.pos ? run.map.pos[0] : 0;
    power = A.power * (1 + 0.14 * layer);
  }
  const mu = (k) => (run.mutators && run.mutators.includes(k)) || (A.regionMods && A.regionMods.includes(k));
  const trial = node.type === 'trial' || node.arena;
  const kind = node.type === 'boss' ? 'boss' : node.type === 'elite' || trial ? 'elite' : 'fight';
  // Allererster Run: die ersten Kämpfe und der erste Boss sind sanfter
  const tut = save.stats.runs === 0 && run.mode === 'normal' && run.act === 0 && (kind === 'boss' || (run.map.pos ? run.map.pos[0] : 0) <= 1) ? 0.7 : 1;
  const bossId = kind === 'boss' ? (node.boss || A.boss) : null;
  if (bossId) ensureBoss(bossId);
  // Sternenjagd: Splitter schwächen die Bestie, ein Hinterhalt stärkt sie
  const lair = run.mode === 'hunt' && node.lair ? { hp: (1 - 0.12 * run.hunt.shards) * (node.ambush ? 1.25 : 1), dmg: 1 - 0.06 * run.hunt.shards } : null;
  return {
    kind, act, power, pool: A.pool, trial, nemesis: pickNemesis(run, kind),
    bossId,
    duration: kind === 'boss' ? 0 : run.mode === 'tower' ? 26 + act * 3 : 34 + act * 4,
    hpMult: ascHpMult(asc) * (mu('titans') ? 1.5 : 1) * (mu('horde') ? 0.75 : 1) * (trial ? 1.25 : 1) * tut,
    dmgMult: ascDmgMult(asc) * (mu('brutal') ? 1.4 : 1),
    asc,
    density: (1 + 0.08 * (act - 1)) * (ascHas(asc, 'density') ? 1.25 : 1) * (mu('horde') ? 1.6 : 1) * (tut < 1 ? 0.75 : 1),
    eliteAffixes: Math.min(5, act + (ascHas(asc, 'eliteAffix') ? 1 : 0) + (mu('elites') ? 1 : 0) + (trial ? 1 : 0)),
    champChance: ascHas(asc, 'elites') ? 0.6 : 0.3,
    extraElite: ascHas(asc, 'elites') || trial,
    allElite: mu('elites'),
    enemySpeed: mu('swift') ? 1.25 : 1,
    bossRage: mu('bossrage'), bossHpMult: (mu('bossrage') ? 1.5 : 1) * (lair ? lair.hp : 1), bossDmgMult: lair ? lair.dmg : 1,
    volatileCorpses: mu('volatile'), meteors: mu('hazards'), hazard: A.hazard || null, eliteLoot: atlasHas('aElite'),
    xpMult: 1 + (act - 1) * 0.35,
    tint: A.tint, floorColor: A.floor, biome: A.biomeId, clsColor: CLASSES[run.cls].color,
    label: run.mode === 'abyss' ? `Abgrund · Ebene ${run.floor} · ${A.biomeName}`
      : run.mode === 'tower' ? `Sternenturm · Etage ${run.floor} · ${A.biomeName}`
      : run.mode === 'rush' ? `Boss-Rush · ${A.name}`
      : run.mode === 'hunt' ? `Sternenjagd · ${A.name}`
      : `${A.sub} · ${A.name}${A.tier ? ` · Stufe ${A.tier}` : ''}`,
  };
}

// ---------------------------------------------------------------- Stufenaufstieg
export function gainXp(run, v) {
  run.xp += v;
  let ups = 0;
  while (run.xp >= xpNeed(run.lvl)) { run.xp -= xpNeed(run.lvl); run.lvl++; ups++; }
  run.pendingLvl += ups;
  return ups;
}

function skillTags(run) {
  const t = new Set();
  for (const s of run.skills) for (const tag of SKILLS[s.id].tags) t.add(tag);
  return t;
}

/** Passt ein Pfad zu den Runen des Runs? (Bollwerk passt immer) */
export const pathFits = (run, pid, tags = skillTags(run)) => !PATHS[pid].tags.length || PATHS[pid].tags.some((t) => tags.has(t));

/**
 * Segen-Auswahl beim Stufenaufstieg: begonnene Pfade fortsetzen, neue Pfade (max. 3) beginnen,
 * Bund-Segen für Pfad-Paare ab Stufe II, Vertiefungen und wenige Grundsegen.
 */
export function rollBoons(run) {
  const tags = skillTags(run);
  const n = 3 + altarLvl('choice') - (run.mutators && run.mutators.includes('blind') ? 1 : 0);
  const owned = new Set(run.boons.map((b) => b.id));
  const tiers = pathTiers(run);
  const started = Object.keys(tiers);
  const free = started.length < MAX_PATHS;
  const ok = (d) => !run.banned.includes(d.id);
  const cands = [];
  for (const d of BOONS) {
    if (!ok(d)) continue;
    if (d.tier) {
      const cur = tiers[d.path] || 0;
      if (d.tier !== cur + 1 || run.lvl < TIER_LVL[d.tier]) continue;
      if (cur === 0) { if (!free) continue; cands.push({ d, w: d.path === 'bollwerk' ? 1.6 : pathFits(run, d.path, tags) ? 3 : 0.5, cont: false }); }
      else cands.push({ d, w: 6, cont: true });
    } else if (d.bund) {
      if (owned.has(d.id) || (tiers[d.bund[0]] || 0) < 2 || (tiers[d.bund[1]] || 0) < 2) continue;
      cands.push({ d, w: 8, cont: true });
    } else if (d.deep) {
      if (!tiers[d.path]) continue;
      cands.push({ d, w: 1.6, cont: false });
    } else if (d.generic) {
      if (d.minRarity && run.lvl < 6) continue;
      cands.push({ d, w: d.rare ? 0.25 : 0.5, cont: false });
    }
  }
  const out = [];
  const take = (c) => {
    const d = c.d;
    let r = 0;
    if (!d.fixed) r = weighted(BOON_RARITY.map((x, k) => ({ ...x, k })), (x) => x.w * (x.k ? 1 + run.asc * 0.02 : 1)).k;
    else if (d.minRarity) r = d.minRarity;
    out.push({ kind: 'boon', id: d.id, r });
  };
  const pool = [...cands];
  while (out.length < n && pool.length) {
    const c = weighted(pool, (x) => x.w);
    pool.splice(pool.indexOf(c), 1);
    take(c);
  }
  // Mindestens eine Fortsetzung anbieten, wenn es eine gibt
  const contLeft = pool.filter((c) => c.cont);
  if (contLeft.length && !out.some((o) => cands.find((c) => c.d.id === o.id).cont)) {
    out.pop();
    take(weighted(contLeft, (x) => x.w));
  }
  // Gelegentlich: Rune verbessern statt eines Grundsegens/einer Vertiefung
  if (Math.random() < 0.3) {
    const s = run.skills.filter((x) => x.lvl < MAX_SKILL_LVL);
    const k = out.map((o, i) => [o, i]).reverse().find(([o]) => { const d = boonDef(o.id); return d && (d.generic || d.deep); });
    if (s.length && k) out[k[1]] = { kind: 'skillLvl', idx: run.skills.indexOf(pick(s)) };
  }
  return out;
}

export function applyChoice(run, c) {
  if (c.kind === 'boon') run.boons.push({ id: c.id, r: c.r });
  else if (c.kind === 'skillLvl') run.skills[c.idx].lvl = Math.min(MAX_SKILL_LVL, run.skills[c.idx].lvl + 1);
  else if (c.kind === 'newSkill') {
    if (run.skills.length >= MAX_SKILLS) { if (c.replace == null) return false; replaceRune(run, c.replace, c); }
    else { const inst = { id: c.id, lvl: 1, sup: [null, null, null], traits: c.traits || [] }; run.skills.push(inst); archiveRune(inst); }
  }
  else if (c.kind === 'glyph') run.glyphs.push(c.id);
  else if (c.kind === 'item') addItem(run, c.item);
  else if (c.kind === 'gold') run.gold += c.v;
  return true;
}

/** Rune ersetzen: Die neue Rune übernimmt die halbe Stufe, Glyphen kommen zurück in den Beutel. */
export function replaceRune(run, idx, c) {
  const old = run.skills[idx];
  if (!old) return;
  for (const g of old.sup || []) if (g) run.glyphs.push(g);
  const inst = { id: c.id, lvl: Math.max(1, Math.floor(old.lvl / 2)), sup: [null, null, null], traits: c.traits || [] };
  run.skills[idx] = inst;
  archiveRune(inst);
}
export const replaceLvl = (inst) => Math.max(1, Math.floor(inst.lvl / 2));

// ---------------------------------------------------------------- Belohnungen
export function randomGlyph(run) {
  const tags = skillTags(run);
  const pool = save.codex.supports.filter((id) => SUPPORTS[id]);
  return weighted(pool.map((id) => ({ id })), (x) => {
    const s = SUPPORTS[x.id];
    return !s.req.length || s.req.some((t) => tags.has(t)) ? 3 : 0.4;
  }).id;
}

/** Neue Rune anbieten – bevorzugt solche, die zu deinen Pfaden und Runen passen. */
function newSkillChoice(run) {
  const own = new Set(run.skills.map((s) => s.id));
  const pool = save.codex.skills.filter((id) => SKILLS[id] && !own.has(id));
  if (!pool.length) return null;
  const paths = Object.keys(pathTiers(run)).filter((p) => PATHS[p].tags.length);
  const tags = skillTags(run);
  const weak = new Set(['hit', 'spell', 'attack']);
  return weighted(pool.map((id) => ({ id })), ({ id }) => {
    const t = SKILLS[id].tags;
    const ph = paths.filter((p) => PATHS[p].tags.some((x) => t.includes(x))).length;
    const share = t.filter((x) => tags.has(x) && !weak.has(x)).length;
    return 0.6 + 2.5 * ph + 0.5 * share;
  }).id;
}

export function noteUnique(item) {
  if (item && item.rarity === 'unique' && !save.codex.uniques.includes(item.uq)) {
    save.codex.uniques.push(item.uq);
    return true;
  }
  if (item && item.rarity === 'set') {
    save.codex.sets = save.codex.sets || [];
    const k = `${item.set}:${item.piece}`;
    if (!save.codex.sets.includes(k)) { save.codex.sets.push(k); return true; }
  }
  return false;
}

export function rollRewards(run, kind) {
  const ilvl = itemLevel(run);
  const luck = snapshot(run).P.luck;
  const out = [];
  const um = atlasHas('aUnique') ? 1.5 : 1, sm = atlasHas('aSet') ? 2 : 1;
  const mk = (o) => makeItem({ uniqueMult: um, setMult: sm, ...o });
  if (kind === 'arena') {
    out.push({ kind: 'item', item: mk({ ilvl, rarity: 'unique', luck }) });
    out.push({ kind: 'item', item: mk({ ilvl, rarity: 'rare', luck }) });
  } else if (kind === 'trial') {
    out.push({ kind: 'item', item: mk({ ilvl: ilvl + 5, rarity: Math.random() < 0.35 ? 'unique' : 'rare', luck }) });
    out.push({ kind: 'glyph', id: randomGlyph(run) });
  } else if (kind === 'boss') {
    out.push({ kind: 'item', item: mk({ ilvl, rarity: Math.random() < 0.45 ? 'unique' : 'rare', luck }) });
    if (run.act >= ACTS.length && atlasHas('aBoss')) out.push({ kind: 'item', item: mk({ ilvl, rarity: 'unique', luck }) });
    out.push({ kind: 'item', item: mk({ ilvl, rarity: 'rare', luck }) });
  } else if (kind === 'elite') {
    out.push({ kind: 'item', item: mk({ ilvl, rarity: Math.random() < 0.12 ? 'unique' : 'rare', luck }) });
  } else {
    out.push({ kind: 'item', item: mk({ ilvl, luck }) });
  }
  const opts = [];
  if (run.skills.length < MAX_SKILLS || Math.random() < 0.35) { const id = newSkillChoice(run); if (id) opts.push({ kind: 'newSkill', id, traits: rollRuneTraits(run, id) }); }
  opts.push({ kind: 'glyph', id: randomGlyph(run) });
  const up = run.skills.filter((s) => s.lvl < MAX_SKILL_LVL);
  if (up.length) opts.push({ kind: 'skillLvl', idx: run.skills.indexOf(pick(up)) });
  opts.push({ kind: 'item', item: mk({ ilvl, luck }) });
  shuffle(opts);
  while (out.length < 3 && opts.length) out.push(opts.shift());
  return out;
}

export function addItem(run, item) {
  noteUnique(item);
  run.bag.push(item);
  if (run.bag.length > 24) run.bag.shift();
}

// ---------------------------------------------------------------- Händler & Schmiede
export const priceMult = (run) => (run.mode === 'abyss' ? 1 + run.floor * 0.12 : 1 + effAct(run) * 0.6) * (1 - 0.08 * altarLvl('discount'));
export function genShop(run) {
  const ilvl = itemLevel(run), pm = priceMult(run), luck = snapshot(run).P.luck;
  const offers = [];
  for (let i = 0; i < 4 + (atlasHas('aShop') ? 2 : 0); i++) {
    const item = makeItem({ ilvl, rarity: weighted([{ r: 'magic', w: 50 }, { r: 'rare', w: 45 }, { r: 'unique', w: 5 }]).r, luck });
    offers.push({ kind: 'item', item, price: Math.round(itemValue(item) * 1.6 * pm) });
  }
  for (let i = 0; i < 2; i++) offers.push({ kind: 'glyph', id: randomGlyph(run), price: Math.round(55 * pm) });
  const ns = newSkillChoice(run);
  if (ns) offers.push({ kind: 'newSkill', id: ns, traits: rollRuneTraits(run, ns), price: Math.round(90 * pm) });
  offers.push({ kind: 'heal', price: Math.round(30 * pm) });
  offers.push({ kind: 'lvlAny', price: Math.round(80 * pm) });
  return offers;
}

export const forgeCost = (run, op, item) => {
  const pm = priceMult(run) * (1 + item.ilvl / 40) * (atlasHas('aForge') ? 0.75 : 1) * (1 - 0.05 * baseLvl('forge')) * (run.forgeDisc || 1);
  const base = { reroll: 25, add: 45, upgrade: 60, lock: 70, fuse: 80, corrupt: 90, unique: 140 * ((item.uqLvl || 0) + 1) }[op];
  return Math.round(base * pm);
};
export function forge(run, op, item, arg) {
  const cost = forgeCost(run, op, item);
  if (run.gold < cost) return false;
  let ok = false, res = null;
  if (op === 'corrupt') { res = craftCorrupt(item); ok = !!res; if (ok) save.stats.corrupts = (save.stats.corrupts || 0) + 1; }
  else if (op === 'unique') { ok = craftUniqueUp(item); if (ok) save.stats.uqUps = (save.stats.uqUps || 0) + 1; }
  else {
    if (!canCraft(item)) return false;
    if (op === 'reroll') { if (item.rarity === 'normal') return false; craftReroll(item); ok = true; }
    else if (op === 'add') ok = craftAdd(item);
    else if (op === 'upgrade') ok = craftUpgrade(item);
    else if (op === 'lock') ok = craftLockReroll(item, arg);
    else if (op === 'fuse') {
      const other = arg;
      ok = craftFuse(item, other);
      if (ok) {
        run.bag = run.bag.filter((x) => x !== other);
        for (const s of SLOTS) if (run.eq[s] === other) delete run.eq[s];
        save.stats.fuses = (save.stats.fuses || 0) + 1;
      }
    }
  }
  if (ok) run.gold -= cost;
  return res || ok;
}
export { UQ_MAX };
/** Runenschliff: Merkmale einer Rune neu würfeln (Anzahl bleibt, mindestens 1). */
export const grindCost = (run) => Math.round(70 * priceMult(run) * (1 + effAct(run) * 0.5) * (1 - 0.05 * baseLvl('forge')));
export function grindRune(run, inst) {
  const cost = grindCost(run);
  if (run.gold < cost || !SKILLS[inst.id]) return false;
  run.gold -= cost;
  const n = Math.max(1, (inst.traits || []).length);
  inst.traits = rollTraits(SKILLS[inst.id], n);
  archiveRune(inst);
  save.stats.grinds = (save.stats.grinds || 0) + 1;
  return true;
}
/** Mythisches Umschmieden (Meisterschmiede Stufe 5+): einen Spezialeffekt neu würfeln. */
export const mythForgeCost = (run) => Math.round(150 * priceMult(run) * (1 + effAct(run) * 0.4));
export function mythForge(run, item) {
  if (item.rarity !== 'mythic' || baseLvl('forge') < 5) return false;
  const cost = mythForgeCost(run);
  if (run.gold < cost) return false;
  const i = Math.floor(Math.random() * item.effects.length);
  const pool = MYTHIC_EFFECTS.map((_, k) => k).filter((k) => !item.effects.includes(k));
  item.effects[i] = pool[Math.floor(Math.random() * pool.length)];
  run.gold -= cost;
  return true;
}
export const sellValue = (run, item) => Math.round(itemValue(item) * 0.4 * priceMult(run));

// ---------------------------------------------------------------- Ereignisse
export function pickEvent(run) {
  const pool = save.stats.runs >= 1 && Math.random() < 0.35 ? FACTION_EVENTS : EVENTS;
  return pick(pool.filter((e) => e.id !== run.lastEvent));
}
export const eventById = (id) => EVENTS.find((e) => e.id === id) || FACTION_EVENTS.find((e) => e.id === id);

/** Wendet ein Ereignis an. Gibt Text für die Anzeige zurück. */
export function applyEvent(run, fx) {
  const P = snapshot(run).P;
  const msgs = [];
  if (fx.pay) {
    const cost = Math.round(fx.pay * priceMult(run));
    if (run.gold < cost) return ['Nicht genug Gold.'];
    run.gold -= cost;
  }
  if (fx.boon) { run.runMods.push(...fx.boon); msgs.push('Du spürst eine Veränderung.'); }
  if (fx.rep) {
    for (const [id, v] of Object.entries(fx.rep)) {
      const up = addRep(id, v);
      msgs.push(`Ruf ${FACTIONS[id].dat}: ${v > 0 ? '+' : '−'}${Math.abs(v)}${up !== null ? ' – neue Stufe!' : ''}`);
    }
  }
  if (fx.hpPct) {
    run.hp = clamp(run.hp + (P.maxLife * fx.hpPct) / 100, 1, P.maxLife);
    msgs.push(fx.hpPct > 0 ? 'Du fühlst dich erfrischt.' : 'Es schmerzt.');
  }
  if (fx.item) {
    const rarity = fx.item === 'gamble' ? weighted([{ r: 'magic', w: 40 }, { r: 'rare', w: 45 }, { r: 'unique', w: 15 }]).r : fx.item;
    const it = makeItem({ ilvl: itemLevel(run), rarity, luck: P.luck });
    addItem(run, it);
    msgs.push(it.rarity === 'unique' ? 'Ein einzigartiger Gegenstand!' : 'Gegenstand erhalten (im Beutel).');
  }
  if (fx.skillLvl) {
    const up = run.skills.filter((s) => s.lvl < MAX_SKILL_LVL);
    if (up.length) { const s = pick(up); s.lvl++; msgs.push(`${SKILLS[s.id].name} steigt auf Stufe ${s.lvl}.`); }
  }
  if (fx.gold) { const g = Math.round(fx.gold * priceMult(run)); run.gold += g; msgs.push(`+${g} Gold.`); }
  if (fx.gamble) {
    const bet = Math.floor(run.gold * fx.gamble);
    if (Math.random() < 0.5) { run.gold += bet; msgs.push(`Gewonnen! +${bet} Gold.`); }
    else { run.gold -= bet; msgs.push(`Verloren. −${bet} Gold.`); }
  }
  for (let k = 0; k < (fx.upgrade || 0); k++) {
    const items = SLOTS.map((s) => run.eq[s]).filter((x) => x && canCraft(x) && x.affixes.length);
    const it = items.length ? pick(items) : null;
    if (it && craftUpgrade(it)) msgs.push('Ein Affix wurde verstärkt.');
    else msgs.push('Es gibt nichts zu verbessern.');
  }
  for (let k = 0; k < (fx.glyph || 0); k++) { const g = randomGlyph(run); run.glyphs.push(g); msgs.push(`Glyphe „${SUPPORTS[g].name}“ erhalten.`); }
  if (fx.banish) { run.banish += fx.banish; msgs.push(`+${fx.banish} Verbannen.`); }
  if (fx.lvls) { run.pendingLvl += fx.lvls; run.lvl += fx.lvls; msgs.push(`Du steigst ${fx.lvls} Stufen auf!`); }
  if (fx.dust) { run.bonusDust += fx.dust; msgs.push(`+${fx.dust} Sternenstaub am Ende des Runs.`); }
  if (fx.relic) { const r = dropRelic(run, 1); if (r) msgs.push(`Relikt „${r.title}“ erhalten!`); }
  if (fx.newSkill) {
    const id = run.skills.length < MAX_SKILLS ? newSkillChoice(run) : null;
    if (id) { const inst = { id, lvl: 1, sup: [null, null, null], traits: rollRuneTraits(run, id) }; run.skills.push(inst); archiveRune(inst); msgs.push(`Neue Rune: ${runeName(inst)}!`); }
    else { const g = randomGlyph(run); run.glyphs.push(g); msgs.push(`Kein Platz für eine Rune – stattdessen Glyphe „${SUPPORTS[g].name}“.`); }
  }
  if (fx.sacrifice) {
    const slots = SLOTS.filter((s) => run.eq[s]);
    if (slots.length) {
      const sl = pick(slots);
      delete run.eq[sl];
      for (let k = 0; k < 2; k++) addItem(run, makeItem({ ilvl: itemLevel(run) + 4, rarity: 'rare', luck: P.luck }));
      msgs.push('Dein Gegenstand zerfällt – zwei seltene Gegenstände liegen im Beutel.');
    } else msgs.push('Du trägst nichts, was du opfern könntest.');
  }
  if (fx.sellAll) {
    let g = 0;
    for (const it of run.bag) g += sellValue(run, it) * fx.sellAll;
    run.bag = [];
    run.gold += g;
    msgs.push(`+${g} Gold.`);
  }
  if (fx.mirror) {
    const sorted = [...run.skills].sort((a, b) => a.lvl - b.lvl);
    if (sorted.length >= 2) {
      sorted[0].lvl = Math.min(MAX_SKILL_LVL, sorted[0].lvl + 2);
      sorted[sorted.length - 1].lvl = Math.max(1, sorted[sorted.length - 1].lvl - 1);
      msgs.push(`${SKILLS[sorted[0].id].name} wird stärker, ${SKILLS[sorted.at(-1).id].name} schwächer.`);
    } else msgs.push('Dein Spiegelbild zuckt mit den Schultern. Du brauchst mehr Runen.');
  }
  if (fx.frozen) {
    if (Math.random() < 0.7) { addItem(run, makeItem({ ilvl: itemLevel(run) + 3, slot: 'weapon', rarity: 'rare', luck: P.luck })); msgs.push('Eine prächtige Waffe!'); }
    else { run.hp = Math.max(1, run.hp - P.maxLife * 0.2); msgs.push('Der Krieger erwacht und schlägt zu!'); }
  }
  if (fx.arena) { run.arenaPending = true; msgs.push('Der Champion tritt vor …'); }
  if (fx.item2) { addItem(run, makeItem({ ilvl: itemLevel(run), rarity: fx.item2, luck: P.luck })); msgs.push('Noch ein Gegenstand.'); }
  if (fx.egg) {
    if (Math.random() < fx.egg) { run.eggs = (run.eggs || 0) + 1; msgs.push('Das Ei bewegt sich! Es schlüpft am Ende des Runs.'); }
    else msgs.push('Das Ei ist leider leer.');
  }
  if (fx.jewel) {
    if (Math.random() < fx.jewel) { const j = dropJewel(run, 1); msgs.push(`Juwel gefunden: ${j.title}!`); }
    else { run.hp = Math.max(1, run.hp - P.maxLife * 0.2); msgs.push('Steinschlag! Du wirst getroffen.'); }
  }
  if (fx.atlasPoint) { run.atlasBonus = (run.atlasBonus || 0) + fx.atlasPoint; msgs.push(`+${fx.atlasPoint} Atlaspunkt am Ende des Runs.`); }
  if (fx.gambleLife) {
    if (Math.random() < 0.6) { run.runMods.push({ s: 'life', t: 'inc', v: 20 }); msgs.push('Neue Kraft durchströmt dich! +20% Leben.'); }
    else { run.runMods.push({ s: 'life', t: 'inc', v: -10 }); msgs.push('Dir wird schwindelig. −10% Leben.'); }
  }
  if (fx.setItem) { const it = makeItem({ ilvl: itemLevel(run), rarity: 'set' }); addItem(run, it); msgs.push('Ein Set-Teil liegt im Beutel!'); }
  if (fx.rerolls) { run.rerolls += fx.rerolls; msgs.push(`+${fx.rerolls} Neu würfeln.`); }
  if (fx.tomb) {
    if (Math.random() < 0.6) {
      const it = makeItem({ ilvl: itemLevel(run), rarity: Math.random() < 0.35 ? 'unique' : 'rare', luck: P.luck });
      addItem(run, it);
      msgs.push('Im Grab liegt ein Schatz!');
    } else {
      run.hp = Math.max(1, run.hp - P.maxLife * 0.25);
      msgs.push('Ein Untoter springt heraus und verletzt dich!');
    }
  }
  return msgs.length ? msgs : ['Du gehst weiter.'];
}

// ---------------------------------------------------------------- Fortschritt
export function healAfterFight(run) {
  const P = snapshot(run).P;
  if (run.mutators && run.mutators.includes('famine')) return;
  let pct = 0.2 + 0.1 * altarLvl('heal');
  if (ascHas(run.asc, 'heal')) pct *= 0.7;
  run.hp = Math.min(P.maxLife, run.hp + P.maxLife * pct * P.heal);
}

/** Nach einem gewonnenen Boss: nächster Akt oder Sieg. */
export function advanceAct(run) {
  run.act++;
  drawCards(run, 2);
  if (run.act === ACTS.length && run.atlas && !run.atlasDone) {
    run.map = genMap(run, run.act);
    run.hp = snapshot(run).P.maxLife;
    return false;
  }
  if (run.act >= ACTS.length) return true;
  run.map = genMap(run, run.act);
  run.hp = snapshot(run).P.maxLife;
  return false;
}

// ---------------------------------------------------------------- Ende
export function endRun(run, outcome) {
  const P = snapshot(run);
  const sets = P.sets;
  const s = run.stats;
  const win = outcome === 'win';
  const ascF = 1 + run.asc * 0.15;
  const depth = run.mode === 'abyss' ? run.floor : run.mode === 'tower' ? run.floor - 1 : run.mode === 'rush' ? run.rush.idx : run.mode === 'hunt' ? run.hunt.moves
    : run.act * LAYERS + (run.map && run.map.pos ? run.map.pos[0] + 1 : 0);
  const campaignWin = win && run.mode === 'normal';
  let axp = (s.kills * 0.6 + s.nodes * 35 + s.elites * 40 + s.bosses * 220 + (win ? 600 : 0)) * ascF * (1 + 0.05 * baseLvl('library'));
  let dust = (s.nodes * 5 + s.elites * 12 + s.bosses * 70 + (win ? 200 : 0)) * (1 + run.asc * 0.25);
  if (run.mode === 'abyss') { dust *= 1 + run.floor * 0.04; axp *= 1 + run.floor * 0.03; }
  if (run.mode === 'tower') { dust *= 1 + depth * 0.05; axp *= 1 + depth * 0.035; }
  if (run.mode === 'rush') { dust *= 1 + depth * 0.12; axp *= 1 + depth * 0.08; }
  if (run.mode === 'hunt') { dust *= (1 + run.hunt.tier * 0.25) * (win ? 1.5 : 1); axp *= 1 + run.hunt.tier * 0.15; }
  const prophBonus = Math.round((run.mutators || []).reduce((sum, m) => sum + MUTATORS[m].reward, 0) * (atlasHas('aProph') ? 1.25 : 1));
  dust *= 1 + (prophBonus + (run.leagueBonus || 0)) / 100;
  axp *= 1 + prophBonus / 200;
  dust += run.bonusDust || 0;
  let dailyBonus = false;
  if (run.daily && save.dailyDone !== run.daily) { dust *= 2; dailyBonus = true; save.dailyDone = run.daily; if (win) save.stats.dailies = (save.stats.dailies || 0) + 1; }
  axp = Math.round(axp * statMul(sets, 'axp') * (atlasHas('aXp') ? 1.2 : 1));
  dust = Math.round(dust * statMul(sets, 'dust') * (atlasHas('aDust') ? 1.2 : 1));
  save.stats.dustTotal = (save.stats.dustTotal || 0) + dust;
  const lvlBefore = accountLevel().level;
  save.axp += axp;
  save.dust += dust;
  const lvlAfter = accountLevel().level;
  // Statistik
  const st = save.stats;
  st.runs++;
  st.kills += s.kills;
  st.maxHit = Math.max(st.maxHit, s.maxHit);
  st.maxRunLvl = Math.max(st.maxRunLvl, run.lvl);
  st.playTime += Math.round((Date.now() - run.started) / 1000);
  if (campaignWin) {
    st.wins[run.cls] = (st.wins[run.cls] || 0) + 1;
    st.maxAscWin = Math.max(st.maxAscWin, run.asc);
    save.ascUnlocked = Math.max(save.ascUnlocked, run.asc + 1);
  }
  if (run.mode === 'abyss') st.maxAbyss = Math.max(st.maxAbyss, run.floor - (outcome === 'win' ? 0 : 1));
  if (campaignWin) {
    st.maxProphWin = Math.max(st.maxProphWin || 0, (run.mutators || []).length);
    const secs = Math.round((Date.now() - run.started) / 1000);
    st.fastestWin = Math.min(st.fastestWin || 1e9, secs);
  }
  st.enemyKills = st.enemyKills || {};
  for (const [k, v] of Object.entries(run.stats.byType || {})) st.enemyKills[k] = (st.enemyKills[k] || 0) + v;
  const quests = checkQuests(run, outcome);
  const fac = factionEnd(run, outcome);
  st.lastCls = run.cls;
  st.maxSet = Math.max(st.maxSet || 0, run.stats.maxSet || 0);
  if (campaignWin && !run.usedRevive) st.cleanAscWin = Math.max(st.cleanAscWin ?? -1, run.asc);
  const modeRes = modeRecord(run, win);
  // Gefährten-Eier schlüpfen
  // Erzfeind
  let nemesis = null;
  if (outcome === 'death' && run.killer) nemesis = recordNemesis(run.killer);
  // Materialien für die Sternwarte
  const depthF = 1 + (run.mode === 'normal' ? run.act : effAct(run)) * 0.6 + run.asc * 0.1 + (run.mode === 'abyss' ? run.floor * 0.08 : 0);
  const mats = {
    ore: Math.round((s.kills * 0.04 + s.elites * 3 + s.bosses * 15) * depthF),
    crystal: Math.round((s.elites * 0.6 + s.bosses * 6 + (win ? 10 : 0)) * depthF),
    essence: Math.round((s.nodes * 1.2 + s.bosses * 5) * depthF),
  };
  addRes(mats);
  // Saison-Erfahrung
  save.season = save.season && save.season.key === seasonKey() ? save.season : { key: seasonKey(), xp: 0, claimed: [] };
  const sxp = Math.round((s.nodes * 20 + s.bosses * 120 + (win ? 400 : 0) + (['abyss', 'tower'].includes(run.mode) ? run.floor * 30 : 0)) * (run.league ? 1.5 : 1));
  save.season.xp += sxp;
  // Kartenpacks aus dem Run
  const packs = [];
  for (let i = 0; i < (run.packs || 0); i++) packs.push(...openPack(3));
  save.stats.packsOpened = (save.stats.packsOpened || 0) + (run.packs || 0);
  for (const c of packs) { save.cards = save.cards || {}; save.cards[c] = Math.min(5, (save.cards[c] || 0) + 1); }
  if (run.league) {
    save.stats.leagueRuns = (save.stats.leagueRuns || 0) + 1;
    if (!save.leagueBest || save.leagueBest.key !== run.league) save.leagueBest = { key: run.league, depth: 0 };
    save.leagueBest.depth = Math.max(save.leagueBest.depth, depth + (win ? 1 : 0));
  }
  const hatched = [];
  for (let i = 0; i < (run.eggs || 0); i++) hatched.push(hatchEgg());
  // Atlaspunkte aus Ereignissen
  if (run.atlasBonus) { save.atlas.points = (save.atlas.points || 0) + run.atlasBonus; }
  // Klassen automatisch freischalten, wenn genug Staub gesammelt wurde? Nein: im Kodex kaufen.
  const result = {
    outcome, win, axp, dust, lvlBefore, lvlAfter, depth, relics: s.relics, cls: run.cls, asc: run.asc,
    mode: run.mode, floor: run.floor, lvl: run.lvl, kills: s.kills, maxHit: s.maxHit, bosses: s.bosses,
    time: Math.round((Date.now() - run.started) / 1000),
    quests, prophBonus, dailyBonus, mutators: run.mutators || [], ascend: run.ascend, hatched, atlasDone: run.atlasDone || null,
    nemesis, mats, sxp, packs, nemesisSlain: run.nemesisSlain || [], cards: run.cards || [], league: run.league,
    tier: run.hunt ? run.hunt.tier : null, modeLines: modeRes.lines, towerRank: modeRes.rank || null, faction: fac, gifts: run.gifts || [],
    an: s.an || null, runSkills: run.skills.map((x) => ({ id: x.id, evo: x.evo, traits: x.traits })),
  };
  const score = depth * 1000 + run.asc * 5000 + s.kills;
  if (['normal', 'abyss', 'tower'].includes(run.mode) && (!st.bestRun || score > st.bestRun.score)) {
    const { an, runSkills, faction, ...keep } = result;
    st.bestRun = { score, ...keep, date: Date.now() };
  }
  save.run = null;
  result.achievements = checkAchievements();
  persist();
  return result;
}

/** Bestleistungen der Modi festhalten. Gibt Zeilen für die Zusammenfassung zurück. */
function modeRecord(run, win) {
  const st = save.stats, out = { lines: [] };
  if (run.mode === 'tower') {
    const cleared = run.floor - 1;
    st.maxTower = Math.max(st.maxTower || 0, cleared);
    const T = towerState(save, towerAnchor());
    if (run.towerKey === T.key) {
      T.tries++;
      const secs = Math.round((Date.now() - run.started) / 1000);
      if (cleared > T.best || (cleared === T.best && cleared > 0 && secs < T.bestTime)) {
        T.best = cleared; T.bestTime = secs; T.bestCls = run.cls;
        out.lines.push(['Neuer Wochenrekord', `Etage ${cleared}`]);
      }
      for (const m of TOWER_MILES) {
        if (cleared < m || T.miles.includes(m)) continue;
        T.miles.push(m);
        const r = towerMileReward(m);
        save.dust += r.dust; addRes(r.res);
        out.lines.push([`Turmtruhe (Etage ${m})`, `+✦ ${r.dust}`]);
      }
      out.rank = towerBoard(T).find((r) => r.me).rank;
      out.lines.push(['Wochenplatz', `${out.rank} von ${T.rivals.length + 1}`]);
    }
  } else if (run.mode === 'rush') {
    const n = run.rush.idx, time = Math.round(run.rush.time);
    save.rush = save.rush || {};
    const b = save.rush.best;
    if (!b || n > b.n || (n === b.n && time < b.time)) { save.rush.best = { n, time, cls: run.cls, asc: run.asc, date: Date.now() }; if (n) out.lines.push(['Neue Bestleistung', `${n}/${RUSH_LEN} · ${clock(time)}`]); }
    st.rushBest = Math.max(st.rushBest || 0, n);
    if (win) { st.rushClears = (st.rushClears || 0) + 1; st.rushFastest = Math.min(st.rushFastest || 1e9, time); }
    out.lines.push(['Kampfzeit', clock(time)]);
  } else if (run.mode === 'hunt') {
    save.hunt = save.hunt || { tier: 1 };
    if (win) {
      save.hunt.tier = Math.max(save.hunt.tier || 1, run.hunt.tier + 1);
      st.huntWins = (st.huntWins || 0) + 1;
      st.maxHunt = Math.max(st.maxHunt || 0, run.hunt.tier);
      out.lines.push(['Bestie erlegt', `Jagdstufe ${run.hunt.tier + 1} frei`]);
    }
    out.lines.push(['Erkundet', `${run.hunt.tiles.filter((t) => t.seen).length}/${run.hunt.tiles.length} Felder`]);
  }
  return out;
}

// ---------------------------------------------------------------- Aufträge
export function questMetrics(run, outcome) {
  return {
    runKills: run.stats.kills, runElites: run.stats.elites, runBosses: run.stats.bosses, runLvl: run.lvl,
    runMaxHit: run.stats.maxHit, runWin: outcome === 'win' && run.mode === 'normal' ? 1 : 0, runGold: run.stats.gold || 0,
    runAct: run.mode !== 'normal' ? 0 : outcome === 'win' ? 4 : run.act + 1,
    runTower: run.mode === 'tower' ? run.floor - 1 : 0, runRush: run.mode === 'rush' ? run.rush.idx : 0, runHunt: run.mode === 'hunt' && outcome === 'win' ? 1 : 0,
    runSkills: run.skills.length, runGlyphs: run.skills.reduce((a, s) => a + s.sup.filter(Boolean).length, 0), runEvo: run.skills.filter((s) => s.evo).length,
    runNemesis: (run.nemesisSlain || []).length, runFlawless: run.stats.flawless || 0,
    runAbyss: run.mode === 'abyss' ? run.floor : 0, runProph: (run.mutators || []).length,
    runNewClass: save.stats.lastCls && save.stats.lastCls !== run.cls ? 1 : 0,
  };
}
export function ensureQuests() {
  if (!Array.isArray(save.quests)) save.quests = [];
  const lvl = accountLevel().level;
  while (save.quests.length < 3) {
    const used = new Set(save.quests.map((q) => q.tpl));
    const pool = QUEST_TEMPLATES.filter((t) => !used.has(t.id) && (t.minLvl || 0) <= lvl && (!t.need || t.need(save)));
    const t = pick(pool.length ? pool : QUEST_TEMPLATES);
    const target = t.target(lvl);
    save.quests.push({ tpl: t.id, target, dust: Math.round(80 + lvl * 12), relic: Math.random() < 0.3 });
  }
}
export const questText = (q) => QUEST_TEMPLATES.find((t) => t.id === q.tpl).text(q.target);
function checkQuests(run, outcome) {
  const m = questMetrics(run, outcome);
  const done = [];
  save.quests = (save.quests || []).filter((q) => {
    const t = QUEST_TEMPLATES.find((x) => x.id === q.tpl);
    if (!t || (m[t.key] || 0) < q.target) return true;
    save.dust += q.dust;
    save.stats.quests = (save.stats.quests || 0) + 1;
    let relic = null;
    if (q.relic) relic = dropRelic(run, 1);
    done.push({ text: questText(q), dust: q.dust, relic });
    return false;
  });
  ensureQuests();
  return done;
}

// ---------------------------------------------------------------- Tägliche Herausforderung
export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export function dailyConfig() {
  const key = todayKey();
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rng = makeRng(h);
  const cls = rng.pick(save.unlockedCls);
  const muts = rng.shuffle(Object.keys(MUTATORS)).slice(0, 3);
  return { key, cls, asc: Math.min(save.ascUnlocked, 2), mutators: muts, seed: h, done: save.dailyDone === key };
}

const statMul = (sets, key) => {
  let inc = 0;
  for (const s of sets) { const e = s.m.get(key); if (e) inc += e.inc; }
  return 1 + inc / 100;
};

/** Relikt-Drop (dauerhaft). Stufe richtet sich nach Fortschritt. */
export function dropRelic(run, chanceMult = 1) {
  const level = run.mode === 'abyss' ? 10 + run.floor * 3 + run.asc * 4 : 8 + effAct(run) * 12 + run.asc * 5;
  if (Math.random() > chanceMult) return null;
  const r = makeRelic(level, snapshot(run).P.luck);
  save.relics.push(r);
  if (save.relics.length > 60) save.relics.splice(save.relics.findIndex((x) => !save.relicEq.includes(x.uid)), 1);
  if (r.rarity === 'mythic') save.stats.mythic++;
  run.stats.relics.push(r.uid);
  return r;
}

// ---------------------------------------------------------------- Erzfeinde
function pickNemesis(run, kind) {
  const list = (save.nemesis || []).filter((n) => !(run.nemesisSeen || []).includes(n.uid));
  if (!list.length || kind === 'boss' || run.daily) return null;
  if (Math.random() > 0.05 + 0.01 * list.length) return null;
  const n = list[Math.floor(Math.random() * list.length)];
  run.nemesisSeen = [...(run.nemesisSeen || []), n.uid];
  return n;
}
export function recordNemesis(killer) {
  save.nemesis = save.nemesis || [];
  let n = killer.nemesisUid ? save.nemesis.find((x) => x.uid === killer.nemesisUid) : null;
  if (n) {
    n.rank++; n.kills++;
    if (n.traits.length < 5) { const pool = NEMESIS_IDS.filter((t) => !n.traits.includes(t)); n.traits.push(pool[Math.floor(Math.random() * pool.length)]); }
  } else {
    n = makeNemesis(killer);
    if (save.nemesis.length >= NEMESIS_MAX) save.nemesis.splice(save.nemesis.reduce((mi, x, i, a) => (x.rank < a[mi].rank ? i : mi), 0), 1);
    save.nemesis.push(n);
  }
  save.stats.nemesisMax = Math.max(save.stats.nemesisMax || 0, n.rank);
  return { ...n, taunt: NEMESIS_TAUNTS[Math.floor(Math.random() * NEMESIS_TAUNTS.length)], promoted: !!killer.nemesisUid };
}
export function nemesisSlain(run, uid) {
  save.nemesis = save.nemesis || [];
  const n = save.nemesis.find((x) => x.uid === uid);
  if (!n) return null;
  save.nemesis = save.nemesis.filter((x) => x.uid !== uid);
  save.stats.nemesisSlain = (save.stats.nemesisSlain || 0) + 1;
  run.bonusDust += 120 * n.rank;
  const it = makeMythic(itemLevel(run) + 10);
  addItem(run, it);
  if (n.rank >= 3) dropRelic(run, 1);
  run.nemesisSlain = [...(run.nemesisSlain || []), { name: n.name, rank: n.rank }];
  return { n, item: it };
}

/** Juwel-Drop (dauerhaft). */
export function dropJewel(run, chance = 1) {
  if (Math.random() > chance) return null;
  const level = run.mode === 'abyss' ? 10 + run.floor * 3 : 8 + effAct(run) * 14 + run.asc * 5 + (run.mode === 'normal' && run.act >= 3 && run.atlas ? getAtlas().regions[run.atlas].tier * 4 : 0);
  const j = makeJewel(level, snapshot(run).P.luck);
  save.jewels = save.jewels || [];
  save.jewels.push(j);
  if (save.jewels.length > 60) {
    const used = new Set(Object.values(save.jewelSock || {}).flatMap((m) => Object.values(m)));
    const i = save.jewels.findIndex((x) => !used.has(x.uid));
    if (i >= 0) save.jewels.splice(i, 1);
  }
  if (j.rarity === 'mythic') save.stats.mythicJewel = (save.stats.mythicJewel || 0) + 1;
  run.stats.jewels = run.stats.jewels || [];
  run.stats.jewels.push(j.uid);
  return j;
}

/** Ein Gefährten-Ei schlüpfen lassen: neuer Gefährte oder Stufenaufstieg eines vorhandenen. */
export function hatchEgg() {
  save.pets = save.pets || {};
  const id = PET_IDS[Math.floor(Math.random() * PET_IDS.length)];
  if (!save.pets[id]) { save.pets[id] = { lvl: 1 }; return { id, lvl: 1, isNew: true }; }
  save.pets[id].lvl = Math.min(PET_MAX, save.pets[id].lvl + 1);
  return { id, lvl: save.pets[id].lvl, isNew: false };
}

/** Akt IV im Atlas abgeschlossen. */
export function completeAtlas(run) {
  const reg = getAtlas().regions[run.atlas];
  save.atlas = save.atlas || { done: {}, points: 0, passives: {} };
  const prev = save.atlas.done[reg.id];
  save.atlas.done[reg.id] = Math.max(prev || 0, reg.tier + run.asc);
  const pts = (prev === undefined ? 1 : 0) + (atlasHas('aPoint') && prev === undefined ? 1 : 0);
  save.atlas.points = (save.atlas.points || 0) + pts;
  run.bonusDust += 150 + reg.tier * 60;
  const relic = dropRelic(run, 1);
  const jewel = dropJewel(run, 1);
  if (Math.random() < 0.25 + (atlasHas('aEgg') ? 0.1 : 0)) run.eggs = (run.eggs || 0) + 1;
  run.atlasDone = { name: reg.name, tier: reg.tier, points: pts, relic, jewel };
  return run.atlasDone;
}

// ---------------------------------------------------------------- Glyphen & Ausrüstung
export function socket(run, skillIdx, slot, glyphIdx) {
  const sk = run.skills[skillIdx];
  const gid = run.glyphs[glyphIdx];
  if (!sk || !gid) return false;
  if (!supportFits(SUPPORTS[gid], SKILLS[sk.id])) return false;
  if (sk.sup.includes(gid)) return false;
  const old = sk.sup[slot];
  sk.sup[slot] = gid;
  run.glyphs.splice(glyphIdx, 1);
  if (old) run.glyphs.push(old);
  return true;
}
export function unsocket(run, skillIdx, slot) {
  const sk = run.skills[skillIdx];
  if (!sk || !sk.sup[slot]) return;
  run.glyphs.push(sk.sup[slot]);
  sk.sup[slot] = null;
}
export function equip(run, bagIdx) {
  const it = run.bag[bagIdx];
  if (!it) return;
  const old = run.eq[it.slot];
  run.eq[it.slot] = it;
  run.bag.splice(bagIdx, 1);
  if (old) run.bag.push(old);
  const P = snapshot(run).P;
  run.hp = Math.min(run.hp, P.maxLife);
}
export function sell(run, bagIdx) {
  const it = run.bag[bagIdx];
  if (!it) return 0;
  const v = sellValue(run, it);
  run.gold += v;
  run.bag.splice(bagIdx, 1);
  return v;
}

export { SOCKETS, MAX_SKILLS };
