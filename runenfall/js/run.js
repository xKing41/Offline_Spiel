// Ablauf eines Runs: Karte, Kampf-Konfiguration, Stufenaufstiege, Belohnungen, Shop, Ereignisse,
// Meta-Belohnungen am Ende. Reine Logik ohne DOM.
import { makeRng, pick, rand, randi, weighted, clamp, shuffle } from './util.js';
import { SKILLS, SUPPORTS, supportFits, MAX_SKILLS, SOCKETS, MAX_SKILL_LVL } from './data/skills.js';
import { ACTS, ABYSS, BIOMES, BOSS_IDS, BOONS, BOON_RARITY, EVENTS, ALTAR, CLASSES, ASCENDANCIES, MUTATORS, QUEST_TEMPLATES, ENEMIES, ascHas, ascHpMult, ascDmgMult } from './data/content.js';
import { makeItem, makeRelic, SLOTS, itemMods, UNIQUES, craftReroll, craftAdd, craftUpgrade, canCraft, itemValue } from './data/items.js';
import { getTree, treeMods } from './data/tree.js';
import { ModSet, computePlayer, computeSkill, flatSum } from './calc.js';
import { save, persist, altarLvl, checkAchievements, accountLevel } from './save.js';

export const LAYERS = 8;
const START_WEAPON = { pyro: 'wand', storm: 'scepter', ranger: 'bow', plague: 'dagger', warden: 'axe', binder: 'totem' };
export const xpNeed = (l) => Math.round(12 + 7 * l + 0.55 * l * l);

// ---------------------------------------------------------------- Neuer Run
export function newRun({ cls, asc = 0, mode = 'normal', ascend = null, mutators = [], daily = null, seed = null }) {
  const run = {
    v: 1, cls, asc, mode, seed: seed ?? Math.floor(Math.random() * 1e9), started: Date.now(),
    ascend: ascend && ASCENDANCIES[ascend] && ASCENDANCIES[ascend].cls === cls ? ascend : null,
    mutators: mutators.filter((m) => MUTATORS[m]), daily, shrine: null, bonusDust: 0,
    act: 0, floor: 0, map: null, pos: null, done: [],
    lvl: 1, xp: 0, gold: 0, hp: null,
    skills: [{ id: CLASSES[cls].start, lvl: 1, sup: [null, null, null] }],
    glyphs: [], eq: {}, bag: [], boons: [], runMods: [],
    rerolls: altarLvl('reroll'), banish: altarLvl('banish'), banned: [],
    revive: altarLvl('revive') > 0, pendingLvl: 0,
    stats: { kills: 0, elites: 0, bosses: 0, nodes: 0, maxHit: 0, dmg: 0, relics: [], byType: {}, gold: 0 },
  };
  const brng = makeRng(run.seed + 17);
  run.biomes = ACTS.map((a) => brng.pick(a.biomes));
  if (run.mutators.includes('glass')) run.runMods.push({ s: 'life', t: 'more', v: -30 });
  if (run.mutators.includes('poor')) run.runMods.push({ s: 'gold', t: 'more', v: -50 });
  run.skills[0].lvl += altarLvl('runelvl');
  const sets = buildSets(run);
  run.gold = Math.round(flatSum(sets, 'startGold'));
  for (let i = 0; i < altarLvl('start'); i++) run.glyphs.push(randomGlyph(run));
  const gearSlots = shuffle(['armor', 'helm', 'gloves', 'boots', 'belt', 'amulet', 'ring']);
  for (let i = 0; i < altarLvl('gear'); i++) run.eq[gearSlots[i]] = makeItem({ ilvl: 1, slot: gearSlots[i], rarity: 'magic' });
  // Startausrüstung: eine einfache Waffe
  run.eq.weapon = makeItem({ ilvl: 1, slot: 'weapon', rarity: 'normal' });
  run.eq.weapon.base = START_WEAPON[cls];
  if (mode === 'abyss') { run.floor = 1; run.abyssChoices = genAbyssChoices(run); }
  else run.map = genMap(run, 0);
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
  const def = BOONS.find((x) => x.id === b.id);
  const mult = def.minRarity ? 1 : BOON_RARITY[b.r].mult;
  return def.mods.map((m) => ({ ...m, v: Math.round(m.v * mult * 10) / 10 }));
}

/** Liste von ModSets in fester Reihenfolge (wichtig für Begleiter, siehe calc.js). */
export function buildSets(run, opts = {}) {
  const tree = getTree();
  const alloc = new Set(save.alloc[run ? run.cls : opts.cls]);
  const sets = [new ModSet(treeMods(tree, alloc)), new ModSet(altarMods()), new ModSet(relicMods())];
  if (run) {
    const items = new ModSet();
    for (const s of SLOTS) if (run.eq[s]) items.addAll(itemMods(run.eq[s]));
    sets.push(items);
    const boons = new ModSet();
    for (const b of run.boons) boons.addAll(boonMods(b));
    boons.addAll(run.runMods);
    if (run.shrine && run.shrine.fights > 0) boons.addAll(run.shrine.mods);
    sets.push(boons);
    sets.push(new ModSet(ascendMods(run.ascend)));
  }
  return sets;
}

/** Freigeschaltete Stufen einer Aufstiegsklasse. */
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
    const b = BIOMES[ids[(run.floor - 1) % ids.length]];
    return { ...ABYSS, tint: b.tint, floor: b.floor, hazard: run.floor > 10 ? b.hazard : null, biomeName: b.name, power: abyssPower(run.floor) };
  }
  const A = ACTS[Math.min(run.act, ACTS.length - 1)];
  const b = BIOMES[(run.biomes && run.biomes[run.act]) || A.biomes[0]];
  return { ...b, sub: A.sub, power: A.power };
}

export function snapshot(run) {
  const sets = buildSets(run);
  const P = computePlayer(sets, run.lvl);
  const skills = run.skills.map((s) => computeSkill(s, sets));
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
        { t: 'treasure', w: 5 }, { t: 'shrine', w: 6 }, { t: 'trial', w: l >= 3 ? 5 : 0 },
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
  if (f % 5 === 0) return [{ type: 'boss', boss: BOSS_IDS[(f / 5 - 1) % BOSS_IDS.length] }];
  const opts = [{ type: 'fight' }, { type: Math.random() < 0.5 ? 'elite' : 'fight' }];
  opts.push({ type: pick(['event', 'shop', 'forge', 'rest', 'elite', 'treasure', 'shrine', 'trial']) });
  return opts;
}

// ---------------------------------------------------------------- Kampf-Konfiguration
export function itemLevel(run) {
  if (run.mode === 'abyss') return clamp(4 + run.floor * 3 + run.asc * 2, 1, 100);
  const layer = run.map && run.map.pos ? run.map.pos[0] : 0;
  return clamp(1 + run.act * 26 + layer * 3 + run.asc * 3, 1, 100);
}

export function combatCfg(run, node) {
  const asc = run.asc;
  const A = actInfo(run);
  let power, act;
  if (run.mode === 'abyss') {
    power = A.power; act = 3;
  } else {
    act = run.act + 1;
    const layer = run.map.pos ? run.map.pos[0] : 0;
    power = A.power * (1 + 0.14 * layer);
  }
  const mu = (k) => run.mutators && run.mutators.includes(k);
  const trial = node.type === 'trial' || node.arena;
  const kind = node.type === 'boss' ? 'boss' : node.type === 'elite' || trial ? 'elite' : 'fight';
  return {
    kind, act, power, pool: A.pool, trial,
    bossId: kind === 'boss' ? (node.boss || A.boss) : null,
    duration: kind === 'boss' ? 0 : 34 + act * 4,
    hpMult: ascHpMult(asc) * (mu('titans') ? 1.5 : 1) * (mu('horde') ? 0.75 : 1) * (trial ? 1.25 : 1),
    dmgMult: ascDmgMult(asc) * (mu('brutal') ? 1.4 : 1),
    asc,
    density: (1 + 0.08 * (act - 1)) * (ascHas(asc, 'density') ? 1.25 : 1) * (mu('horde') ? 1.6 : 1),
    eliteAffixes: Math.min(5, act + (ascHas(asc, 'eliteAffix') ? 1 : 0) + (mu('elites') ? 1 : 0) + (trial ? 1 : 0)),
    champChance: ascHas(asc, 'elites') ? 0.6 : 0.3,
    extraElite: ascHas(asc, 'elites') || trial,
    allElite: mu('elites'),
    enemySpeed: mu('swift') ? 1.25 : 1,
    bossRage: mu('bossrage'), bossHpMult: mu('bossrage') ? 1.5 : 1,
    volatileCorpses: mu('volatile'), meteors: mu('hazards'), hazard: A.hazard || null,
    xpMult: 1 + (act - 1) * 0.35,
    tint: A.tint, floorColor: A.floor,
    label: run.mode === 'abyss' ? `Abgrund · Ebene ${run.floor} · ${A.biomeName}` : `${A.sub} · ${A.name}`,
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

export function rollBoons(run) {
  const tags = skillTags(run);
  const n = 3 + altarLvl('choice') - (run.mutators && run.mutators.includes('blind') ? 1 : 0);
  const pool = BOONS.filter((b) => !run.banned.includes(b.id));
  const out = [];
  const used = new Set();
  for (let i = 0; i < n && used.size < pool.length; i++) {
    const r = weighted(BOON_RARITY.map((x, k) => ({ ...x, k })), (x) => x.w * (x.k ? 1 + run.asc * 0.02 : 1)).k;
    const cands = pool.filter((b) => !used.has(b.id) && (b.minRarity || 0) <= r);
    if (!cands.length) continue;
    const b = weighted(cands, (b) => (!b.tags.length ? 1 : b.tags.some((t) => tags.has(t)) ? 2.6 : 0.25));
    used.add(b.id);
    out.push({ kind: 'boon', id: b.id, r: b.minRarity ? Math.max(r, b.minRarity) : r });
  }
  // Gelegentlich: Fertigkeit verbessern statt Segen
  if (Math.random() < 0.3) {
    const s = run.skills.filter((x) => x.lvl < MAX_SKILL_LVL);
    if (s.length && out.length) out[out.length - 1] = { kind: 'skillLvl', idx: run.skills.indexOf(pick(s)) };
  }
  return out;
}

export function applyChoice(run, c) {
  if (c.kind === 'boon') run.boons.push({ id: c.id, r: c.r });
  else if (c.kind === 'skillLvl') run.skills[c.idx].lvl = Math.min(MAX_SKILL_LVL, run.skills[c.idx].lvl + 1);
  else if (c.kind === 'newSkill') run.skills.push({ id: c.id, lvl: 1, sup: [null, null, null] });
  else if (c.kind === 'glyph') run.glyphs.push(c.id);
  else if (c.kind === 'item') addItem(run, c.item);
  else if (c.kind === 'gold') run.gold += c.v;
}

// ---------------------------------------------------------------- Belohnungen
export function randomGlyph(run) {
  const tags = skillTags(run);
  const pool = save.codex.supports.filter((id) => SUPPORTS[id]);
  return weighted(pool.map((id) => ({ id })), (x) => {
    const s = SUPPORTS[x.id];
    return !s.req.length || s.req.some((t) => tags.has(t)) ? 3 : 0.4;
  }).id;
}

function newSkillChoice(run) {
  const own = new Set(run.skills.map((s) => s.id));
  const pool = save.codex.skills.filter((id) => SKILLS[id] && !own.has(id));
  return pool.length ? pick(pool) : null;
}

export function noteUnique(item) {
  if (item && item.rarity === 'unique' && !save.codex.uniques.includes(item.uq)) {
    save.codex.uniques.push(item.uq);
    return true;
  }
  return false;
}

export function rollRewards(run, kind) {
  const ilvl = itemLevel(run);
  const luck = snapshot(run).P.luck;
  const out = [];
  if (kind === 'arena') {
    out.push({ kind: 'item', item: makeItem({ ilvl, rarity: 'unique', luck }) });
    out.push({ kind: 'item', item: makeItem({ ilvl, rarity: 'rare', luck }) });
  } else if (kind === 'trial') {
    out.push({ kind: 'item', item: makeItem({ ilvl: ilvl + 5, rarity: Math.random() < 0.35 ? 'unique' : 'rare', luck }) });
    out.push({ kind: 'glyph', id: randomGlyph(run) });
  } else if (kind === 'boss') {
    out.push({ kind: 'item', item: makeItem({ ilvl, rarity: Math.random() < 0.45 ? 'unique' : 'rare', luck }) });
    out.push({ kind: 'item', item: makeItem({ ilvl, rarity: 'rare', luck }) });
  } else if (kind === 'elite') {
    out.push({ kind: 'item', item: makeItem({ ilvl, rarity: Math.random() < 0.12 ? 'unique' : 'rare', luck }) });
  } else {
    out.push({ kind: 'item', item: makeItem({ ilvl, luck }) });
  }
  const opts = [];
  if (run.skills.length < MAX_SKILLS) { const id = newSkillChoice(run); if (id) opts.push({ kind: 'newSkill', id }); }
  opts.push({ kind: 'glyph', id: randomGlyph(run) });
  const up = run.skills.filter((s) => s.lvl < MAX_SKILL_LVL);
  if (up.length) opts.push({ kind: 'skillLvl', idx: run.skills.indexOf(pick(up)) });
  opts.push({ kind: 'item', item: makeItem({ ilvl, luck }) });
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
export const priceMult = (run) => (run.mode === 'abyss' ? 1 + run.floor * 0.12 : 1 + run.act * 0.6) * (1 - 0.08 * altarLvl('discount'));
export function genShop(run) {
  const ilvl = itemLevel(run), pm = priceMult(run), luck = snapshot(run).P.luck;
  const offers = [];
  for (let i = 0; i < 4; i++) {
    const item = makeItem({ ilvl, rarity: weighted([{ r: 'magic', w: 50 }, { r: 'rare', w: 45 }, { r: 'unique', w: 5 }]).r, luck });
    offers.push({ kind: 'item', item, price: Math.round(itemValue(item) * 1.6 * pm) });
  }
  for (let i = 0; i < 2; i++) offers.push({ kind: 'glyph', id: randomGlyph(run), price: Math.round(55 * pm) });
  const ns = run.skills.length < MAX_SKILLS ? newSkillChoice(run) : null;
  if (ns) offers.push({ kind: 'newSkill', id: ns, price: Math.round(90 * pm) });
  offers.push({ kind: 'heal', price: Math.round(30 * pm) });
  offers.push({ kind: 'lvlAny', price: Math.round(80 * pm) });
  return offers;
}

export const forgeCost = (run, op, item) => {
  const pm = priceMult(run) * (1 + item.ilvl / 40);
  return Math.round({ reroll: 25, add: 45, upgrade: 60 }[op] * pm);
};
export function forge(run, op, item) {
  if (!canCraft(item)) return false;
  const cost = forgeCost(run, op, item);
  if (run.gold < cost) return false;
  let ok = false;
  if (op === 'reroll') { if (item.rarity === 'normal') return false; craftReroll(item); ok = true; }
  else if (op === 'add') ok = craftAdd(item);
  else if (op === 'upgrade') ok = craftUpgrade(item);
  if (ok) run.gold -= cost;
  return ok;
}
export const sellValue = (run, item) => Math.round(itemValue(item) * 0.4 * priceMult(run));

// ---------------------------------------------------------------- Ereignisse
export function pickEvent(run) {
  return pick(EVENTS.filter((e) => e.id !== run.lastEvent));
}

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
    if (id) { run.skills.push({ id, lvl: 1, sup: [null, null, null] }); msgs.push(`Neue Rune: ${SKILLS[id].name}!`); }
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
  const depth = run.mode === 'abyss' ? run.floor : run.act * LAYERS + (run.map && run.map.pos ? run.map.pos[0] + 1 : 0);
  let axp = (s.kills * 0.6 + s.nodes * 35 + s.elites * 40 + s.bosses * 220 + (win ? 600 : 0)) * ascF;
  let dust = (s.nodes * 5 + s.elites * 12 + s.bosses * 70 + (win ? 200 : 0)) * (1 + run.asc * 0.25);
  if (run.mode === 'abyss') { dust *= 1 + run.floor * 0.04; axp *= 1 + run.floor * 0.03; }
  const prophBonus = (run.mutators || []).reduce((sum, m) => sum + MUTATORS[m].reward, 0);
  dust *= 1 + prophBonus / 100;
  axp *= 1 + prophBonus / 200;
  dust += run.bonusDust || 0;
  let dailyBonus = false;
  if (run.daily && save.dailyDone !== run.daily) { dust *= 2; dailyBonus = true; save.dailyDone = run.daily; if (win) save.stats.dailies = (save.stats.dailies || 0) + 1; }
  axp = Math.round(axp * statMul(sets, 'axp'));
  dust = Math.round(dust * statMul(sets, 'dust'));
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
  if (win) {
    st.wins[run.cls] = (st.wins[run.cls] || 0) + 1;
    st.maxAscWin = Math.max(st.maxAscWin, run.asc);
    save.ascUnlocked = Math.max(save.ascUnlocked, run.asc + 1);
  }
  if (run.mode === 'abyss') st.maxAbyss = Math.max(st.maxAbyss, run.floor - (outcome === 'win' ? 0 : 1));
  if (win) {
    st.maxProphWin = Math.max(st.maxProphWin || 0, (run.mutators || []).length);
    const secs = Math.round((Date.now() - run.started) / 1000);
    st.fastestWin = Math.min(st.fastestWin || 1e9, secs);
  }
  st.enemyKills = st.enemyKills || {};
  for (const [k, v] of Object.entries(run.stats.byType || {})) st.enemyKills[k] = (st.enemyKills[k] || 0) + v;
  const quests = checkQuests(run, outcome);
  st.lastCls = run.cls;
  // Klassen automatisch freischalten, wenn genug Staub gesammelt wurde? Nein: im Kodex kaufen.
  const result = {
    outcome, win, axp, dust, lvlBefore, lvlAfter, depth, relics: s.relics, cls: run.cls, asc: run.asc,
    mode: run.mode, floor: run.floor, lvl: run.lvl, kills: s.kills, maxHit: s.maxHit, bosses: s.bosses,
    time: Math.round((Date.now() - run.started) / 1000),
    quests, prophBonus, dailyBonus, mutators: run.mutators || [], ascend: run.ascend,
  };
  const score = depth * 1000 + run.asc * 5000 + s.kills;
  if (!st.bestRun || score > st.bestRun.score) st.bestRun = { score, ...result, date: Date.now() };
  save.run = null;
  result.achievements = checkAchievements();
  persist();
  return result;
}

// ---------------------------------------------------------------- Aufträge
export function questMetrics(run, outcome) {
  return {
    runKills: run.stats.kills, runElites: run.stats.elites, runBosses: run.stats.bosses, runLvl: run.lvl,
    runMaxHit: run.stats.maxHit, runWin: outcome === 'win' ? 1 : 0, runGold: run.stats.gold || 0,
    runAct: run.mode === 'abyss' ? 0 : outcome === 'win' ? 4 : run.act + 1,
    runAbyss: run.mode === 'abyss' ? run.floor : 0, runProph: (run.mutators || []).length,
    runNewClass: save.stats.lastCls && save.stats.lastCls !== run.cls ? 1 : 0,
  };
}
export function ensureQuests() {
  if (!Array.isArray(save.quests)) save.quests = [];
  const lvl = accountLevel().level;
  while (save.quests.length < 3) {
    const used = new Set(save.quests.map((q) => q.tpl));
    const pool = QUEST_TEMPLATES.filter((t) => !used.has(t.id) && (t.minLvl || 0) <= lvl);
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
  const level = run.mode === 'abyss' ? 10 + run.floor * 3 + run.asc * 4 : 8 + run.act * 12 + run.asc * 5;
  if (Math.random() > chanceMult) return null;
  const r = makeRelic(level, snapshot(run).P.luck);
  save.relics.push(r);
  if (save.relics.length > 60) save.relics.splice(save.relics.findIndex((x) => !save.relicEq.includes(x.uid)), 1);
  if (r.rarity === 'mythic') save.stats.mythic++;
  run.stats.relics.push(r.uid);
  return r;
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
