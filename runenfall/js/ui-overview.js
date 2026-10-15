// Übersicht: was du jetzt tun kannst, wie weit du überall bist, nächste Ziele und Rekorde.
import { app } from './app.js';
import { on, screen, topbar, bar } from './ui.js';
import { esc, fmt, clock } from './util.js';
import { save, accountLevel, totalPoints, spentPoints, relicSlots, paragonFree, altarLvl } from './save.js';
import { CLASSES, ACHIEVEMENTS, ALTAR, altarCost, ASCENDANCIES, ASCEND_COST, ENEMIES, BOSS_IDS, PINNACLES } from './data/content.js';
import { SKILLS, SUPPORTS } from './data/skills.js';
import { UNIQUES } from './data/items.js';
import { getTree } from './data/tree.js';
import { EVOLUTIONS } from './data/evolutions.js';
import { CARD_IDS, deckSize, RUNE_TRAITS, traitFits } from './data/systems.js';
import { PET_IDS, PET_EGG_COST, SET_PIECES, getAtlas } from './data/endgame.js';
import { FACTION_IDS, FACTIONS, REP_RANKS, repRank, OFFERS, STORY } from './data/factions.js';
import { MODE_INFO, MODE_IDS, modeLock, towerState, towerBoard, RUSH_LEN } from './data/modes.js';
import { factionState, newChapters, towerAnchor, baseLvl, dailyConfig } from './run.js';
import { seasonState } from './ui-systems.js';

const CLS = () => (save.unlockedCls.includes(save.lastCls) ? save.lastCls : save.unlockedCls[0]);
const pct = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);

/** Alles, was man gerade tun kann – sortiert nach Wichtigkeit. */
export function nowActions() {
  const out = [];
  const add = (prio, icon, text, sub, to, act) => out.push({ prio, icon, text, sub, to, act });
  const pts = totalPoints();
  const free = save.unlockedCls.map((c) => [c, pts - spentPoints(c)]).filter(([, n]) => n > 0);
  if (free.length && !save.run) { const [c, n] = free.find(([k]) => k === CLS()) || free[0]; add(10, '✶', `${n} freie Sternpunkte`, `${CLASSES[c].name}${free.length > 1 ? ` und ${free.length - 1} weitere Klassen` : ''}`, 'tree'); }
  const T = towerState(save, towerAnchor());
  if (T.last && !T.last.claimed) add(9, '♜', 'Wochenbelohnung des Turms abholen', `Platz ${T.last.rank} in Woche ${T.last.key.slice(-3)}`, 'hub');
  const st = seasonState();
  if (st.claimable) add(8, '✧', `${st.claimable} Saison-Belohnung${st.claimable > 1 ? 'en' : ''} abholen`, `Stufe ${st.tier}/40`, 'season');
  const b = save.base;
  if (b && Object.keys(b.lvl || {}).length && (Date.now() - b.last) / 3600000 > 1) add(7, '🏰', 'Zitadelle: Erträge einsammeln', `seit ${Math.floor((Date.now() - b.last) / 3600000)} Std. produziert`, 'base');
  const ch = newChapters();
  if (ch.length) add(6, '📜', `Neues Kapitel der Sage: ${ch[0].title}`, ch.length > 1 ? `und ${ch.length - 1} weitere` : 'Die Geschichte geht weiter', 'story');
  const pf = paragonFree();
  if (pf > 0) add(6, '⛩', `${pf} Punkte Sternenmacht verteilen`, 'im Altar', 'altar');
  if ((save.atlas?.points || 0) > Object.keys(save.atlas?.passives || {}).length) add(6, '✷', 'Atlaspunkte verteilen', 'Atlas-Kenntnisse', 'atlas');
  if (save.stats.runs >= 1) for (const id of FACTION_IDS) {
    const f = factionState(id), r = repRank(f.rep);
    const o = OFFERS[id].filter((x) => x.rank <= r && x.cost <= f.favor).sort((a, c) => c.cost - a.cost)[0];
    if (o) { add(5, '⚜', `${FACTIONS[id].short}: „${o.name}“ leistbar`, `◈ ${f.favor} Gunst`, 'factions'); break; }
  }
  const altar = ALTAR.map((a) => ({ a, l: altarLvl(a.id) })).filter(({ a, l }) => l < a.max).map(({ a, l }) => ({ a, cost: altarCost(a, l) })).sort((x, y) => x.cost - y.cost)[0];
  if (altar && save.dust >= altar.cost) add(4, '⛩', `Altar: „${altar.a.name}“ verbessern`, `✦ ${fmt(altar.cost)}`, 'altar');
  const lockedRune = Object.entries(SKILLS).filter(([k, s]) => s.cost && !save.codex.skills.includes(k)).sort((x, y) => x[1].cost - y[1].cost)[0];
  if (lockedRune && save.dust >= lockedRune[1].cost) add(4, '❖', `Neue Rune freischalten: ${lockedRune[1].name}`, `✦ ${fmt(lockedRune[1].cost)}`, 'codex');
  const lockedGlyph = Object.entries(SUPPORTS).filter(([k, s]) => s.cost && !save.codex.supports.includes(k)).sort((x, y) => x[1].cost - y[1].cost)[0];
  if (lockedGlyph && save.dust >= lockedGlyph[1].cost) add(3, '❖', `Neue Glyphe freischalten: ${lockedGlyph[1].name}`, `✦ ${fmt(lockedGlyph[1].cost)}`, 'codex');
  const cls = Object.entries(CLASSES).filter(([k, c]) => !save.unlockedCls.includes(k)).sort((x, y) => x[1].unlock - y[1].unlock)[0];
  if (cls && save.dust >= cls[1].unlock) add(5, cls[1].glyph, `Neue Klasse freischalten: ${cls[1].name}`, `✦ ${fmt(cls[1].unlock)}`, 'setup');
  if (Object.values(save.stats.bossKills || {}).some((v) => v > 0)) {
    const asc = Object.entries(ASCENDANCIES).filter(([k, a]) => save.unlockedCls.includes(a.cls) && ((save.ascend || {})[k] || 0) < 5)
      .map(([k, a]) => ({ a, cost: ASCEND_COST[(save.ascend || {})[k] || 0] })).sort((x, y) => x.cost - y.cost)[0];
    if (asc && save.dust >= asc.cost) add(3, '❖', `Aufstiegsklasse verbessern: ${asc.a.name}`, `✦ ${fmt(asc.cost)}`, 'codex');
  }
  const unequipped = save.relics.filter((r) => !save.relicEq.includes(r.uid)).length;
  if (save.relicEq.length < relicSlots() && unequipped) add(5, '◈', `${relicSlots() - save.relicEq.length} freie Relikt-Plätze`, `${unequipped} Relikte im Lager`, 'relics');
  const sock = (save.jewelSock || {})[CLS()] || {}, used = new Set(Object.values(save.jewelSock || {}).flatMap((m) => Object.values(m)));
  const looseJewels = (save.jewels || []).filter((j) => !used.has(j.uid)).length;
  if (looseJewels) {
    const tree = getTree(), alloc = save.alloc[CLS()] || [];
    const emptySockets = alloc.filter((id) => tree.nodes.get(id)?.type === 'jewel' && !sock[id]).length;
    if (emptySockets) add(4, '⬢', `${emptySockets} leere Juwelsockel`, `${looseJewels} Juwelen bereit`, 'tree');
  }
  const deck = save.deck || [], owned = Object.keys(save.cards || {}).filter((id) => !deck.includes(id));
  if (deck.length < deckSize(baseLvl('observatory')) && owned.length) add(3, '🂠', `${deckSize(baseLvl('observatory')) - deck.length} freie Plätze im Kartendeck`, `${owned.length} Karten verfügbar`, 'cards');
  if (save.dust >= PET_EGG_COST * 2 && Object.keys(save.pets || {}).length < PET_IDS.length) add(2, '🐾', 'Sternenei ausbrüten', `✦ ${fmt(PET_EGG_COST)}`, 'pets');
  if (!save.run && !dailyConfig().done) add(2, '☀', 'Tägliche Herausforderung', 'Staub ×2 beim ersten Versuch', 'hub');
  if (save.run) add(11, '▶', 'Laufenden Run fortsetzen', `${CLASSES[save.run.cls].name} · Stufe ${save.run.lvl}`, null, 'continue');
  return out.sort((a, c) => c.prio - a.prio);
}
const actBtn = (x) => `<button class="nowrow" ${x.act ? `data-a="${x.act}"` : `data-a="nav" data-to="${x.to}"`}><span class="ni">${x.icon}</span><div><b>${esc(x.text)}</b><small>${esc(x.sub)}</small></div><i>›</i></button>`;

/** Kompakte Leiste für die Sternwarte. */
export function nowPanel() {
  const list = nowActions();
  if (!list.length) return '';
  return `<div class="panel now"><div class="row between"><h3>Jetzt möglich</h3><button class="btn small ghost" data-a="nav" data-to="overview">Übersicht ›</button></div>
    ${list.slice(0, 3).map(actBtn).join('')}${list.length > 3 ? `<small class="muted center">und ${list.length - 3} weitere in der Übersicht</small>` : ''}</div>`;
}

function collections() {
  const sk = Object.keys(SKILLS).filter((k) => !k.startsWith('pet_'));
  const dex = Object.entries(ENEMIES).filter(([, e]) => !e.noDex);
  const kills = save.stats.enemyKills || {};
  const bossIds = [...BOSS_IDS, ...Object.keys(PINNACLES)];
  const archiveTotal = sk.reduce((s, id) => s + Object.values(RUNE_TRAITS).filter((t) => traitFits(t, SKILLS[id])).length, 0);
  const asc = Object.values(save.ascend || {}).reduce((a, b) => a + b, 0);
  return [
    ['Runen im Kodex', sk.filter((k) => save.codex.skills.includes(k)).length, sk.length, 'codex'],
    ['Glyphen im Kodex', save.codex.supports.filter((k) => SUPPORTS[k]).length, Object.keys(SUPPORTS).length, 'codex'],
    ['Evolutionen entdeckt', (save.codex.evos || []).length, Object.values(EVOLUTIONS).reduce((a, v) => a + v.length, 0), 'codex'],
    ['Runen-Archiv', (save.runeArchive || []).length, archiveTotal, 'codex'],
    ['Unikate gefunden', save.codex.uniques.length, Object.keys(UNIQUES).length, 'codex'],
    ['Set-Teile gefunden', (save.codex.sets || []).length, SET_PIECES.length, 'codex'],
    ['Bestiarium', dex.filter(([k]) => kills[k] > 0).length, dex.length, 'codex'],
    ['Bosse besiegt', bossIds.filter((k) => (save.stats.bossKills || {})[k] > 0).length, bossIds.length, 'stats'],
    ['Klassen', save.unlockedCls.length, Object.keys(CLASSES).length, 'setup'],
    ['Aufstiegsstufen', asc, Object.keys(ASCENDANCIES).length * 5, 'codex'],
    ['Schicksalskarten', Object.keys(save.cards || {}).length, CARD_IDS.length, 'cards'],
    ['Gefährten', Object.keys(save.pets || {}).length, PET_IDS.length, 'pets'],
    ['Atlas-Regionen', Object.keys(save.atlas?.done || {}).length, Object.keys(getAtlas().regions).length, 'atlas'],
    ['Kapitel der Sage', STORY.filter((c) => c.when(save)).length, STORY.length, 'story'],
    ['Erfolge', Object.keys(save.ach).length, ACHIEVEMENTS.length, 'ach'],
  ];
}

function goals() {
  const out = [];
  const acc = accountLevel();
  out.push(['Kontostufe ' + (acc.level + 1), `${fmt(acc.need - acc.cur)} Erfahrung fehlen`, bar(acc.cur, acc.need, 'xp')]);
  const cls = Object.entries(CLASSES).filter(([k]) => !save.unlockedCls.includes(k)).sort((x, y) => x[1].unlock - y[1].unlock)[0];
  if (cls) out.push([`Klasse ${cls[1].name}`, `✦ ${fmt(save.dust)} / ${fmt(cls[1].unlock)}`, bar(save.dust, cls[1].unlock, '')]);
  out.push([`Sternenhöhe ${save.ascUnlocked + 1}`, `Gewinne einen Feldzug auf Höhe ${save.ascUnlocked}`, '']);
  for (const id of MODE_IDS) { const l = modeLock(id, save); if (l) out.push([`Modus ${MODE_INFO[id].name}`, l, '']); }
  if (save.stats.runs >= 1) {
    const next = FACTION_IDS.map((id) => { const r = factionState(id).rep, k = repRank(r); return k < REP_RANKS.length - 1 ? { id, k, r, need: REP_RANKS[k + 1].need } : null; }).filter(Boolean).sort((a, b) => (a.need - a.r) - (b.need - b.r))[0];
    if (next) out.push([`${FACTIONS[next.id].short}: ${REP_RANKS[next.k + 1].name}`, `Ruf ${fmt(next.r)} / ${fmt(next.need)}`, bar(next.r - REP_RANKS[next.k].need, next.need - REP_RANKS[next.k].need, 'rep')]);
  }
  return out;
}

function records() {
  const s = save.stats, T = towerState(save, towerAnchor());
  const me = towerBoard(T).find((r) => r.me);
  const rush = save.rush && save.rush.best;
  const h = Math.floor(s.playTime / 3600), m = Math.floor((s.playTime % 3600) / 60);
  return [
    ['Runs / Siege', `${s.runs} / ${Object.values(s.wins).reduce((a, b) => a + b, 0)}`],
    ['Höchste gewonnene Sternenhöhe', s.maxAscWin < 0 ? '–' : s.maxAscWin],
    ['Tiefste Abgrund-Ebene', s.maxAbyss || 0],
    ['Sternenturm diese Woche', `${T.best ? `Etage ${T.best}` : '–'} · Platz ${me.rank}/${T.rivals.length + 1}`],
    ['Höchste Turm-Etage', s.maxTower || 0],
    ['Boss-Rush', rush ? `${rush.n}/${RUSH_LEN} · ${clock(rush.time)}` : '–'],
    ['Höchste Jagdstufe erlegt', s.maxHunt || '–'],
    ['Stärkster Treffer', fmt(s.maxHit)],
    ['Höchste Run-Stufe', s.maxRunLvl],
    ['Schnellster Sieg', s.fastestWin < 1e9 ? clock(s.fastestWin) : '–'],
    ['Besiegte Gegner', fmt(s.kills)],
    ['Spielzeit', `${h} h ${m} min`],
  ];
}

export function showOverview() {
  const acts = nowActions();
  const cols = collections();
  const total = cols.reduce((a, [, h, n]) => a + pct(h, n), 0) / cols.length;
  screen(`${topbar('Übersicht')}<div class="pad">
    <div class="panel"><h3>Jetzt möglich</h3>${acts.length ? acts.map(actBtn).join('') : '<p class="muted small">Gerade nichts offen – Zeit für einen neuen Run!</p>'}</div>
    <div class="panel"><div class="row between"><h3>Sammlung</h3><b class="gold">${Math.round(total)}% gesamt</b></div>
      ${cols.map(([name, have, n, to]) => `<button class="colrow" data-a="nav" data-to="${to}"><span>${esc(name)}</span><b>${fmt(have)}/${fmt(n)}</b><div class="anbar"><i style="width:${pct(have, n)}%"></i></div></button>`).join('')}</div>
    <div class="panel"><h3>Nächste Ziele</h3>${goals().map(([t, s, b]) => `<div class="goal"><b>${esc(t)}</b><small>${esc(s)}</small>${b}</div>`).join('')}</div>
    <div class="panel"><h3>Rekorde</h3>${records().map(([k, v]) => `<div class="srow"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`).join('')}</div>
  </div>`);
}
on('ovGo', (d) => app.nav(d.to));
