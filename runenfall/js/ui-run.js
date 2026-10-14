// Bildschirme innerhalb eines Runs.
import { app } from './app.js';
import { $, on, screen, modal, closeModal, toast, confirmBox, itemCard, glyphCard, skillInfo, skillStatsLine, bar, tagChips, itemTitle } from './ui.js';
import { esc, fmt, fmtV } from './util.js';
import { save, persist, accountLevel } from './save.js';
import { CLASSES, BOONS, BOON_RARITY, ACTS, ASC_MODS, ASCENDANCIES, MUTATORS } from './data/content.js';
import { SKILLS, SUPPORTS, supportFits, catTags, MAX_SKILL_LVL } from './data/skills.js';
import { SLOTS, SLOT_NAME, RARITY, canCraft, itemName } from './data/items.js';
import { ELEM, modText } from './data/stats.js';
import {
  snapshot, boonMods, reachable, NODE_TYPES, LAYERS, xpNeed, rollBoons, applyChoice, genShop, forge, forgeCost,
  sellValue, socket, unsocket, equip, sell, applyEvent, pickEvent, priceMult, genAbyssChoices, actInfo, itemLevel, addItem, atlasHas,
} from './run.js';
import { PETS } from './data/endgame.js';
import { makeItem } from './data/items.js';
import { sfx, buzz } from './audio.js';

const R = () => save.run;

// ===================================================================== Kopfzeile
function runHeader() {
  const run = R();
  const { P } = snapshot(run);
  const A = actInfo(run);
  const where = run.mode === 'abyss' ? `Abgrund · Ebene ${run.floor}` : `${A.sub} · ${A.name}`;
  const asc = run.ascend ? ` · ${ASCENDANCIES[run.ascend].name}` : '';
  const proph = run.mutators && run.mutators.length ? ` · ✧${run.mutators.length}` : '';
  return `<div class="rhead">
    <div class="rh1"><b style="color:${CLASSES[run.cls].color}">${CLASSES[run.cls].glyph} ${CLASSES[run.cls].name}</b><small>${where}${run.asc ? ` · Höhe ${run.asc}` : ''}${asc}${proph}${run.shrine ? ` · <span class="up">Schrein (${run.shrine.fights})</span>` : ''}</small></div>
    <div class="rh2">${bar(run.hp, P.maxLife, 'hp')}<div class="rstats"><span>Stufe <b>${run.lvl}</b></span><span class="gold">● ${fmt(run.gold)}</span></div></div>
    <div class="rh3"><button class="btn small" data-a="build">⚒ Build</button><button class="btn small ghost" data-a="nav" data-to="tree">✶ Karte</button><button class="btn small ghost" data-a="runMenu">☰</button></div></div>`;
}
on('runMenu', () => modal(`<h3>Run</h3><div class="col">
  <button class="btn" data-a="nav" data-to="hub">Zur Sternwarte (Run bleibt gespeichert)</button>
  <button class="btn danger" data-a="abandon">Run aufgeben</button>
  <button class="btn ghost" data-a="_close">Zurück</button></div>`));

// ===================================================================== Karte
export function showMap() {
  const run = R();
  if (run.mode === 'abyss') return showAbyss();
  const m = run.map;
  const reach = new Set(reachable(run).map(([l, i]) => `${l}_${i}`));
  const rows = [];
  for (let l = m.layers.length - 1; l >= 0; l--) {
    const cells = [0, 1, 2].map((lane) => {
      const i = m.layers[l].findIndex((n) => n.lane === lane);
      if (i < 0) return '<div class="mcell"></div>';
      const n = m.layers[l][i];
      const key = `${l}_${i}`;
      const cur = m.pos && m.pos[0] === l && m.pos[1] === i;
      const done = m.pos && l <= m.pos[0];
      const can = reach.has(key);
      return `<div class="mcell"><button data-node="${key}" class="mnode t-${n.type} ${cur ? 'cur' : ''} ${can ? 'can' : ''} ${done && !cur ? 'past' : ''}" ${can ? `data-a="enter" data-l="${l}" data-i="${i}"` : 'disabled'}>
        <span>${NODE_TYPES[n.type].icon}</span></button><small>${NODE_TYPES[n.type].name}</small></div>`;
    }).join('');
    rows.push(`<div class="mrow">${cells}</div>`);
  }
  screen(`${runHeader()}<div class="map">${rows.join('')}</div>
    <p class="muted small center">Wähle deinen Weg. Eliten sind gefährlich, lassen aber bessere Beute fallen.</p>`, 'runscreen');
  requestAnimationFrame(() => drawMapLines(run));
  setTimeout(() => { const c = document.querySelector('.mnode.can'); if (c) c.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 50);
}

/** Verbindungslinien zwischen den Orten (SVG hinter den Knoten). */
function drawMapLines(run) {
  const mapEl = document.querySelector('.map');
  if (!mapEl) return;
  const m = run.map;
  const base = mapEl.getBoundingClientRect();
  const center = (l, i) => {
    const el = mapEl.querySelector(`[data-node="${l}_${i}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2 - base.left, r.top + r.height / 2 - base.top];
  };
  const lines = [];
  for (let l = 0; l < m.layers.length - 1; l++) {
    m.layers[l].forEach((a, i) => {
      const next = m.layers[l + 1];
      next.forEach((b, j) => {
        if (next.length !== 1 && Math.abs(a.lane - b.lane) > 1) return;
        const p = center(l, i), q = center(l + 1, j);
        if (!p || !q) return;
        const onPath = m.pos && m.pos[0] === l && m.pos[1] === i;
        const past = m.pos && l + 1 <= m.pos[0];
        lines.push(`<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" class="${onPath ? 'hot' : past ? 'past' : ''}"/>`);
      });
    });
  }
  const svg = `<svg class="mlines" width="${base.width}" height="${base.height}">${lines.join('')}</svg>`;
  mapEl.insertAdjacentHTML('afterbegin', svg);
}
on('enter', (d) => {
  const run = R();
  run.map.pos = [Number(d.l), Number(d.i)];
  const node = run.map.layers[d.l][d.i];
  persist();
  enterNode(node);
});

function showAbyss() {
  const run = R();
  if (!run.abyssChoices) run.abyssChoices = genAbyssChoices(run);
  const cards = run.abyssChoices.map((n, i) => `<button class="abnode t-${n.type}" data-a="abEnter" data-i="${i}"><span>${NODE_TYPES[n.type].icon}</span><b>${NODE_TYPES[n.type].name}</b></button>`).join('');
  screen(`${runHeader()}<div class="pad center"><h2 class="abyss">Ebene ${run.floor}</h2>
    <p class="muted">Gegnerstärke ×${fmt(Math.pow(1.24, run.floor))}. Jede 5. Ebene wartet ein Boss.</p>
    <div class="abchoices">${cards}</div></div>`, 'runscreen');
}
on('abEnter', (d) => {
  const run = R();
  const node = run.abyssChoices[Number(d.i)];
  run.curNode = node;
  persist();
  enterNode(node);
});

function enterNode(node) {
  const run = R();
  run.curNode = node;
  if (['fight', 'elite', 'boss', 'trial'].includes(node.type)) app.startCombat(node);
  else if (node.type === 'treasure') showTreasure();
  else if (node.type === 'shrine') showShrine();
  else if (node.type === 'shop') showShop(true);
  else if (node.type === 'forge') showForge();
  else if (node.type === 'event') showEvent();
  else if (node.type === 'rest') showRest();
}

/** Nicht-Kampf-Knoten abschließen und zur Karte zurück. */
app.finishNode = () => finishNode();
function finishNode() {
  R().curNode = null;
  const run = R();
  run.stats.nodes++;
  run.shop = null;
  run.event = null;
  if (run.mode === 'abyss') { run.floor++; run.abyssChoices = genAbyssChoices(run); }
  persist();
  closeModal();
  showMap();
}

// ===================================================================== Build
let buildTab = 'skills';
let glyphPick = null;
export function showBuild(back = 'map') {
  const run = R();
  const snap = snapshot(run);
  const tabs = [['skills', 'Runen'], ['gear', 'Ausrüstung'], ['sheet', 'Werte'], ['boons', 'Segen']]
    .map(([k, n]) => `<button class="${buildTab === k ? 'on' : ''}" data-a="btab" data-t="${k}">${n}</button>`).join('');
  let body = '';
  if (buildTab === 'skills') body = skillsTab(run, snap);
  else if (buildTab === 'gear') body = gearTab(run);
  else if (buildTab === 'sheet') body = sheetTab(run, snap);
  else body = boonsTab(run);
  screen(`<div class="topbar"><button class="icon" data-a="buildBack">‹</button><h2>Build</h2><div class="tb-extra"><span class="gold">● ${fmt(run.gold)}</span></div></div>
    <div class="pad"><div class="seg">${tabs}</div>${body}</div>`, 'runscreen');
  buildBackTo = back;
}
let buildBackTo = 'map';
on('build', () => showBuild('map'));
on('buildBack', () => { glyphPick = null; if (buildBackTo === 'combat') return app.pauseMenu(); if (buildBackTo === 'shop') showShop(false); else if (buildBackTo === 'forge') showForge(); else showMap(); });
on('btab', (d) => { buildTab = d.t; glyphPick = null; showBuild(buildBackTo); });

function skillsTab(run, snap) {
  const skills = run.skills.map((sk, i) => {
    const S = snap.skills[i];
    const def = SKILLS[sk.id];
    const sockets = sk.sup.map((g, j) => {
      const fits = glyphPick !== null ? supportFits(SUPPORTS[run.glyphs[glyphPick]], def) && !sk.sup.includes(run.glyphs[glyphPick]) : null;
      if (g) return `<button class="sock full" data-a="sockTap" data-s="${i}" data-j="${j}"><span class="gem">◆</span>${esc(SUPPORTS[g].name)}</button>`;
      return `<button class="sock ${fits === true ? 'fit' : fits === false ? 'nofit' : ''}" data-a="sockTap" data-s="${i}" data-j="${j}">+ Glyphe</button>`;
    }).join('');
    const lvlNote = S.lvl !== sk.lvl ? ` <small class="up">(+${S.lvl - sk.lvl})</small>` : '';
    return `<div class="panel skill"><div class="row between"><h3>${esc(def.name)} <small>Stufe ${sk.lvl}${lvlNote}/${MAX_SKILL_LVL}</small></h3>
      <button class="icon small" data-a="skInfo" data-id="${sk.id}">i</button></div>
      <div class="tags">${tagChips(catTags(def))}</div>
      ${skillStatsLine(S)}<div class="socks">${sockets}</div></div>`;
  }).join('');
  const glyphs = run.glyphs.length ? run.glyphs.map((g, i) => `<button class="glyph ${glyphPick === i ? 'sel' : ''}" data-a="gPick" data-i="${i}"><span class="gem">◆</span>${esc(SUPPORTS[g].name)}</button>`).join('')
    : '<p class="muted small">Keine freien Glyphen. Du findest sie als Belohnung und beim Händler.</p>';
  const sel = glyphPick !== null ? glyphCard(run.glyphs[glyphPick], '<span class="small muted">Tippe einen grün markierten Sockel an.</span>') : '';
  return `${skills}<h3>Glyphen-Beutel</h3><div class="glyphs">${glyphs}</div>${sel}`;
}
on('skInfo', (d) => modal(`<h3>${esc(SKILLS[d.id].name)}</h3>${skillInfo(d.id)}<button class="btn" data-a="_close">OK</button>`));
on('gPick', (d) => { glyphPick = glyphPick === Number(d.i) ? null : Number(d.i); showBuild(buildBackTo); });
on('sockTap', (d) => {
  const run = R();
  const s = Number(d.s), j = Number(d.j);
  if (glyphPick !== null) {
    if (socket(run, s, j, glyphPick)) { sfx.loot(); glyphPick = null; persist(); }
    else { sfx.deny(); toast('Diese Glyphe passt nicht zu dieser Rune (oder ist schon gesockelt).'); }
  } else if (run.skills[s].sup[j]) { unsocket(run, s, j); persist(); }
  else toast('Wähle zuerst unten eine Glyphe aus.');
  showBuild(buildBackTo);
});

let gearSel = null;
function gearTab(run) {
  const slots = SLOTS.map((s) => {
    const it = run.eq[s];
    return `<button class="gslot ${it ? 'on' : ''}" style="--rc:${it ? RARITY[it.rarity].color : '#444'}" data-a="gearEq" data-s="${s}">
      <small>${SLOT_NAME[s]}</small><b>${it ? esc(itemName(it)) : '—'}</b></button>`;
  }).join('');
  const bag = run.bag.map((it, i) => `<button class="bagi ${gearSel === i ? 'sel' : ''}" style="--rc:${RARITY[it.rarity].color}" data-a="bagSel" data-i="${i}">
    <small>${SLOT_NAME[it.slot]}</small><b>${esc(itemName(it))}</b></button>`).join('') || '<p class="muted small">Leer.</p>';
  let detail = '';
  if (gearSel !== null && run.bag[gearSel]) {
    const it = run.bag[gearSel];
    detail = itemCard(it, { compare: run.eq[it.slot] || null, actions: `<button class="btn small primary" data-a="doEquip">Anlegen</button><button class="btn small" data-a="doSell">Verkaufen ● ${sellValue(run, it)}</button>` });
  }
  return `<div class="gslots">${slots}</div>${detail}<h3>Beutel (${run.bag.length}/24)</h3><div class="bag">${bag}</div>`;
}
on('gearEq', (d) => {
  const it = R().eq[d.s];
  if (it) modal(`${itemCard(it)}<button class="btn" data-a="_close">OK</button>`);
});
on('bagSel', (d) => { gearSel = gearSel === Number(d.i) ? null : Number(d.i); showBuild(buildBackTo); });
on('doEquip', () => { equip(R(), gearSel); gearSel = null; persist(); sfx.loot(); showBuild(buildBackTo); });
on('doSell', () => { const v = sell(R(), gearSel); gearSel = null; persist(); sfx.gold(); toast(`+${v} Gold`); showBuild(buildBackTo); });

function sheetTab(run, snap) {
  const P = snap.P;
  const row = (k, v) => `<div class="srow"><span>${k}</span><b>${v}</b></div>`;
  const res = ['fire', 'cold', 'light', 'chaos'].map((t) => `<span style="color:${ELEM[t].color}">${ELEM[t].name} ${Math.round(P.res[t])}%</span>`).join(' · ');
  const total = snap.skills.reduce((s, S) => s + S.dps, 0);
  const spec = Object.keys(P.spec).length ? `<div class="panel"><h3>Besondere Effekte</h3><ul class="mods">${Object.entries(P.spec).map(([k, v]) => `<li>${esc(modText({ s: k, v }))}</li>`).join('')}</ul></div>` : '';
  return `<div class="panel"><h3>Angriff</h3>${row('Geschätzter Gesamtschaden/s', `<b class="dps">${fmt(total)}</b>`)}
    ${snap.skills.map((S) => row(esc(S.def.name), fmt(S.dps) + '/s')).join('')}</div>
    <div class="panel"><h3>Verteidigung</h3>${row('Leben', `${fmt(run.hp)} / ${fmt(P.maxLife)}`)}${row('Barriere', fmt(P.maxBarrier))}
    ${row('Rüstung', fmt(P.armor))}${row('Ausweichwert', `${fmt(P.evasion)} (${Math.round(Math.min(75, (P.evasion / (P.evasion + 600)) * 100))}%)`)}
    ${P.dodge ? row('Ausweichchance (Akrobatik)', P.dodge + '%') : ''}
    ${row('Regeneration', fmtV(P.regen) + '/s')}${row('Widerstände', res)}</div>
    <div class="panel"><h3>Sonstiges</h3>${row('Bewegungstempo', Math.round((P.move / 155) * 100) + '%')}${row('Aufsammelradius', Math.round(P.magnet))}
    ${row('Erfahrung', '+' + Math.round((P.xpMult - 1) * 100) + '%')}${row('Gegenstandsseltenheit', '+' + Math.round(P.luck) + '%')}
    ${row('Run-Erfahrung', `${fmt(run.xp)} / ${fmt(xpNeed(run.lvl))}`)}</div>${spec}`;
}

function boonsTab(run) {
  if (!run.boons.length && !run.runMods.length) return '<p class="muted center">Noch keine Segen. Du erhältst sie beim Stufenaufstieg.</p>';
  const list = run.boons.map((b) => `<li style="color:${BOON_RARITY[b.r].color}">${boonMods(b).map(modText).map(esc).join(', ')}</li>`).join('');
  const ev = run.runMods.length ? `<h3>Aus Ereignissen</h3><ul class="mods">${run.runMods.map((m) => `<li>${esc(modText(m))}</li>`).join('')}</ul>` : '';
  return `<div class="panel"><ul class="mods">${list}</ul>${ev}</div>`;
}

// ===================================================================== Stufenaufstieg
let lvlChoices = null;
export function showLevelUp(onDone) {
  const run = R();
  if (!lvlChoices) lvlChoices = rollBoons(run);
  const cards = lvlChoices.map((c, i) => choiceCard(run, c, i, 'lvlPick')).join('');
  modal(`<h2 class="lvlup">STUFE ${run.lvl - run.pendingLvl + 1}</h2><p class="muted center small">Wähle einen Segen</p>
    <div class="choices">${cards}</div>
    <div class="row"><button class="btn small ${run.rerolls ? '' : 'disabled'}" data-a="lvlReroll">↻ Neu würfeln (${run.rerolls})</button>
    <button class="btn small ${run.banish ? '' : 'disabled'}" data-a="lvlBanishMode">✕ Verbannen (${run.banish})</button></div>`, 'levelup');
  lvlDone = onDone;
}
let lvlDone = null;
let banishMode = false;
on('lvlPick', (d) => {
  const run = R();
  const c = lvlChoices[Number(d.i)];
  if (banishMode) {
    if (c.kind !== 'boon') { toast('Nur Segen können verbannt werden.'); return; }
    run.banned.push(c.id); run.banish--; banishMode = false;
    lvlChoices = rollBoons(run);
    persist();
    showLevelUp(lvlDone);
    toast('Dieser Segen erscheint in diesem Run nicht mehr.');
    return;
  }
  applyChoice(run, c);
  run.pendingLvl--;
  lvlChoices = null;
  sfx.levelup();
  if (run.pendingLvl > 0) showLevelUp(lvlDone);
  else { closeModal(); lvlDone && lvlDone(); }
});
on('lvlReroll', () => { const run = R(); if (!run.rerolls) return; run.rerolls--; lvlChoices = rollBoons(run); showLevelUp(lvlDone); });
on('lvlBanishMode', () => { if (!R().banish) return; banishMode = !banishMode; toast(banishMode ? 'Tippe den Segen an, der verbannt werden soll.' : 'Verbannen abgebrochen.'); });

function choiceCard(run, c, i, action) {
  let title = '', body = '', col = '#c9c3b5', label = '';
  if (c.kind === 'boon') {
    const r = BOON_RARITY[c.r];
    col = r.color; label = r.name;
    title = 'Segen';
    body = `<ul class="mods">${boonMods({ id: c.id, r: c.r }).map((m) => `<li>${esc(modText(m))}</li>`).join('')}</ul>`;
  } else if (c.kind === 'skillLvl') {
    const sk = run.skills[c.idx];
    col = '#7dffb0'; label = 'Rune';
    title = `${SKILLS[sk.id].name} +1`;
    body = `<p class="small">Stufe ${sk.lvl} → ${sk.lvl + 1}</p>`;
    if (sk.lvl + 1 === 3 && SKILLS[sk.id].lvl3) body += `<p class="small up">${SKILLS[sk.id].lvl3.map(modText).join(', ')}</p>`;
    if (sk.lvl + 1 === 5 && SKILLS[sk.id].lvl5) body += `<p class="small up">${SKILLS[sk.id].lvl5.map(modText).join(', ')}</p>`;
  } else if (c.kind === 'newSkill') {
    col = '#ffd84d'; label = 'Neue Rune';
    title = SKILLS[c.id].name;
    body = `<div class="tags">${tagChips(catTags(SKILLS[c.id]))}</div><p class="small">${esc(SKILLS[c.id].desc)}</p>`;
  } else if (c.kind === 'glyph') {
    col = '#7aa8ff'; label = 'Glyphe';
    title = SUPPORTS[c.id].name;
    body = `<ul class="mods">${SUPPORTS[c.id].mods.map((m) => `<li>${esc(modText(m))}</li>`).join('')}</ul>`;
  } else if (c.kind === 'item') {
    col = RARITY[c.item.rarity].color; label = SLOT_NAME[c.item.slot];
    return `<button class="choice item" style="--cc:${col}" data-a="${action}" data-i="${i}">${itemCard(c.item, { compare: run.eq[c.item.slot] || null, small: true })}</button>`;
  } else if (c.kind === 'gold') {
    col = '#ffd84d'; label = 'Gold'; title = `● ${c.v}`;
  }
  return `<button class="choice" style="--cc:${col}" data-a="${action}" data-i="${i}"><small>${label}</small><b>${esc(title)}</b>${body}</button>`;
}

// ===================================================================== Belohnung nach Kampf
let rewardState = null;
export function showRewards(choices, info, onDone) {
  rewardState = { choices, onDone, info };
  const run = R();
  const cards = choices.map((c, i) => choiceCard(run, c, i, 'rewPick')).join('');
  modal(`<h2 class="win">SIEG</h2><p class="center small">${info}</p><p class="muted center small">Wähle eine Belohnung</p>
    <div class="choices">${cards}</div><button class="btn small ghost" data-a="rewSkip">Überspringen (+● ${Math.round(15 * priceMult(run))})</button>`, 'rewards');
}
on('rewPick', (d) => {
  const run = R();
  const c = rewardState.choices[Number(d.i)];
  applyChoice(run, c);
  sfx.loot();
  const done = rewardState.onDone;
  rewardState = null;
  closeModal();
  done();
});
on('rewSkip', () => {
  const run = R();
  run.gold += Math.round(15 * priceMult(run));
  const done = rewardState.onDone;
  rewardState = null;
  closeModal();
  done();
});

// ===================================================================== Händler
export function showShop(fresh) {
  const run = R();
  if (fresh || !run.shop) run.shop = genShop(run);
  const { P } = snapshot(run);
  const offers = run.shop.map((o, i) => {
    if (o.sold) return '';
    const afford = run.gold >= o.price;
    const btn = `<button class="btn small ${afford ? 'primary' : 'disabled'}" data-a="buy" data-i="${i}">● ${o.price}</button>`;
    if (o.kind === 'item') return itemCard(o.item, { compare: run.eq[o.item.slot] || null, actions: btn, small: true });
    if (o.kind === 'glyph') return glyphCard(o.id, btn);
    if (o.kind === 'newSkill') return `<div class="panel"><div class="row between"><b>Neue Rune: ${esc(SKILLS[o.id].name)}</b>${btn}</div>${skillInfo(o.id)}</div>`;
    if (o.kind === 'heal') return `<div class="panel row between"><div><b>Heiltrank</b><p class="small muted">Heilt 50% Leben</p></div>${btn}</div>`;
    if (o.kind === 'lvlAny') return `<div class="panel row between"><div><b>Runenstein</b><p class="small muted">+1 Stufe für eine Rune deiner Wahl</p></div>${btn}</div>`;
    return '';
  }).join('');
  screen(`${runHeader()}<div class="pad"><h2>⚖ Händler</h2>${bar(run.hp, P.maxLife, 'hp')}
    <div class="shop">${offers}</div>
    <div class="row"><button class="btn small" data-a="buildFromShop">⚒ Build / Verkaufen</button><button class="btn primary" data-a="leave">Weiterziehen ›</button></div></div>`, 'runscreen');
}
on('buildFromShop', () => showBuild('shop'));
on('buy', (d) => {
  const run = R();
  const o = run.shop[Number(d.i)];
  if (!o || o.sold || run.gold < o.price) { sfx.deny(); return; }
  if (o.kind === 'lvlAny') {
    const opts = run.skills.map((s, i) => s.lvl < MAX_SKILL_LVL ? `<button class="btn" data-a="lvlAnyPick" data-s="${i}" data-o="${d.i}">${esc(SKILLS[s.id].name)} (${s.lvl}→${s.lvl + 1})</button>` : '').join('');
    modal(`<h3>Welche Rune verbessern?</h3><div class="col">${opts || '<p>Alle Runen sind auf Maximalstufe.</p>'}<button class="btn ghost" data-a="_close">Abbrechen</button></div>`);
    return;
  }
  run.gold -= o.price;
  o.sold = true;
  if (o.kind === 'heal') run.hp = Math.min(snapshot(run).P.maxLife, run.hp + snapshot(run).P.maxLife * 0.5);
  else applyChoice(run, o);
  sfx.gold();
  persist();
  showShop(false);
});
on('lvlAnyPick', (d) => {
  const run = R();
  const o = run.shop[Number(d.o)];
  if (run.gold < o.price) return;
  run.gold -= o.price; o.sold = true;
  run.skills[Number(d.s)].lvl++;
  closeModal(); sfx.levelup(); persist(); showShop(false);
});
on('leave', () => finishNode());

// ===================================================================== Schmiede
let forgeSel = null;
export function showForge() {
  const run = R();
  const items = [...SLOTS.map((s) => run.eq[s]).filter(Boolean), ...run.bag].filter(canCraft);
  const list = items.map((it) => `<button class="bagi ${forgeSel === it.uid ? 'sel' : ''}" style="--rc:${RARITY[it.rarity].color}" data-a="fSel" data-u="${it.uid}">
    <small>${SLOT_NAME[it.slot]}${Object.values(run.eq).includes(it) ? ' · angelegt' : ''}</small><b>${esc(itemName(it))}</b></button>`).join('');
  const it = items.find((x) => x.uid === forgeSel);
  let detail = '<p class="muted small center">Wähle einen Gegenstand.</p>';
  if (it) {
    const b = (op, label, desc) => `<button class="btn small ${run.gold >= forgeCost(run, op, it) ? 'primary' : 'disabled'}" data-a="fDo" data-op="${op}">${label} ● ${forgeCost(run, op, it)}<small>${desc}</small></button>`;
    detail = itemCard(it, { actions: `${it.rarity !== 'normal' ? b('reroll', 'Chaos', 'Alle Affixe neu würfeln') : ''}${it.affixes.length < 6 ? b('add', 'Erhebung', 'Neuen Affix hinzufügen') : ''}${it.affixes.length ? b('upgrade', 'Veredelung', 'Ein Affix +1 Stufe') : ''}` });
  }
  screen(`${runHeader()}<div class="pad"><h2>⚒ Schmiede</h2><p class="muted small">Gegenstandsstufe ${it ? it.ilvl : '–'} begrenzt die höchste erreichbare Affix-Stufe.</p>
    <div class="bag">${list || '<p class="muted">Nichts zu schmieden.</p>'}</div>${detail}
    <button class="btn primary" data-a="leave">Weiterziehen ›</button></div>`, 'runscreen');
}
on('fSel', (d) => { forgeSel = d.u; showForge(); });
on('fDo', (d) => {
  const run = R();
  const it = [...SLOTS.map((s) => run.eq[s]).filter(Boolean), ...run.bag].find((x) => x.uid === forgeSel);
  if (!it) return;
  if (forge(run, d.op, it)) { sfx.loot(); buzz(15); persist(); }
  else { sfx.deny(); toast('Nicht möglich (Gold, Affix-Grenze oder Höchststufe).'); }
  showForge();
});

// ===================================================================== Ereignis
export function showEvent() {
  const run = R();
  if (!run.event) { run.event = pickEvent(run).id; run.lastEvent = run.event; persist(); }
  import('./data/content.js').then(({ EVENTS }) => {
    const ev = EVENTS.find((e) => e.id === run.event);
    modal(`<h2 class="evt">${esc(ev.title)}</h2><p class="center">${esc(ev.text)}</p><div class="col">
      ${ev.options.map((o, i) => `<button class="btn opt" data-a="evOpt" data-i="${i}"><b>${esc(o.label)}</b><small>${esc(o.desc)}</small></button>`).join('')}</div>`, 'event');
  });
}
on('evOpt', async (d) => {
  const run = R();
  const { EVENTS } = await import('./data/content.js');
  const ev = EVENTS.find((e) => e.id === run.event);
  const msgs = applyEvent(run, ev.options[Number(d.i)].fx);
  persist();
  const arena = run.arenaPending;
  if (arena) { run.arenaPending = false; persist(); }
  modal(`<h2 class="evt">${esc(ev.title)}</h2>${msgs.map((m) => `<p class="center">${esc(m)}</p>`).join('')}
    ${arena ? '<button class="btn primary" data-a="arenaFight">⚔ Kämpfen</button>' : '<button class="btn primary" data-a="leave">Weiter</button>'}`, 'event');
});
on('arenaFight', () => {
  const run = R();
  run.curNode = { type: 'elite', arena: true };
  persist();
  closeModal();
  app.startCombat(run.curNode);
});

// ===================================================================== Schatzkammer
function showTreasure() {
  const run = R();
  if (!run.treasure) {
    const luck = snapshot(run).P.luck;
    run.treasure = {
      gold: Math.round(60 * priceMult(run) * (0.7 + Math.random() * 0.6)),
      items: [0, 1, 2].map(() => makeItem({ ilvl: itemLevel(run) + 3, rarity: Math.random() < 0.12 ? 'unique' : 'rare', luck })),
    };
    persist();
  }
  const t = run.treasure;
  modal(`<h2 class="evt">◆ Schatzkammer</h2><p class="center">Gold glitzert im Sternenlicht: <b class="gold">+${t.gold} Gold</b>. Dazu darfst du einen Gegenstand mitnehmen.</p>
    <div class="choices">${t.items.map((it, i) => `<button class="choice item" data-a="treasurePick" data-i="${i}">${itemCard(it, { compare: run.eq[it.slot] || null, small: true })}</button>`).join('')}</div>`, 'rewards');
}
on('treasurePick', (d) => {
  const run = R();
  const t = run.treasure;
  run.gold += t.gold;
  addItem(run, t.items[Number(d.i)]);
  run.treasure = null;
  sfx.loot();
  finishNode();
});

// ===================================================================== Schrein
const SHRINES = [
  { name: 'Schrein des Zorns', mods: [{ s: 'dmg', t: 'more', v: 40 }] },
  { name: 'Schrein der Eile', mods: [{ s: 'speed', t: 'more', v: 30 }, { s: 'move', t: 'inc', v: 15 }] },
  { name: 'Schrein der Festung', mods: [{ s: 'life', t: 'more', v: 30 }, { s: 'res_elem', v: 20 }] },
  { name: 'Schrein der Gier', mods: [{ s: 'gold', t: 'more', v: 100 }, { s: 'luck', t: 'inc', v: 60 }] },
  { name: 'Schrein der Weisheit', mods: [{ s: 'xp', t: 'more', v: 50 }] },
  { name: 'Schrein der Präzision', mods: [{ s: 'critBase', v: 5 }, { s: 'critMulti', v: 60 }] },
  { name: 'Schrein des Verfalls', mods: [{ s: 'poisonChance', v: 40 }, { s: 'igniteChance', v: 40 }, { s: 'bleedChance', v: 40 }] },
  { name: 'Schrein der Weite', mods: [{ s: 'area', t: 'more', v: 40 }, { s: 'proj', v: 2 }] },
];
function showShrine() {
  const run = R();
  if (!run.shrineChoice) { run.shrineChoice = [...SHRINES].sort(() => Math.random() - 0.5).slice(0, 3).map((x) => SHRINES.indexOf(x)); persist(); }
  modal(`<h2 class="evt">✧ Schrein</h2><p class="center">Wähle einen Segen. Er wirkt für die nächsten <b>zwei Kämpfe</b>.</p>
    <div class="choices">${run.shrineChoice.map((i) => `<button class="choice" style="--cc:#7dffb0" data-a="shrinePick" data-i="${i}"><small>Schrein</small><b>${SHRINES[i].name}</b>
      <ul class="mods">${SHRINES[i].mods.map((m) => `<li>${esc(modText(m))}</li>`).join('')}</ul></button>`).join('')}</div>`, 'rewards');
}
on('shrinePick', (d) => {
  const run = R();
  const sh = SHRINES[Number(d.i)];
  run.shrine = { name: sh.name, mods: sh.mods, fights: atlasHas('aShrine') ? 3 : 2 };
  run.shrineChoice = null;
  sfx.levelup();
  finishNode();
});

// ===================================================================== Lager
export function showRest() {
  const run = R();
  const { P } = snapshot(run);
  const up = run.skills.filter((s) => s.lvl < MAX_SKILL_LVL);
  modal(`<h2 class="evt">☾ Lagerfeuer</h2><p class="center">Die Sterne flackern ruhig. Zeit, durchzuatmen.</p>${bar(run.hp, P.maxLife, 'hp')}<div class="col">
    <button class="btn opt" data-a="restHeal"><b>Ausruhen</b><small>Heilt 60% Leben</small></button>
    ${up.length ? `<button class="btn opt" data-a="restMed"><b>Meditieren</b><small>Eine Rune deiner Wahl +1 Stufe</small></button>` : ''}
    <button class="btn opt" data-a="restGlyph"><b>Runen schnitzen</b><small>Erhalte eine zufällige Glyphe</small></button></div>`, 'event');
}
on('restHeal', () => { const run = R(); const { P } = snapshot(run); run.hp = Math.min(P.maxLife, run.hp + P.maxLife * 0.6); sfx.levelup(); finishNode(); });
on('restMed', () => {
  const run = R();
  modal(`<h3>Welche Rune?</h3><div class="col">${run.skills.map((s, i) => s.lvl < MAX_SKILL_LVL ? `<button class="btn" data-a="restMedPick" data-s="${i}">${esc(SKILLS[s.id].name)} (${s.lvl}→${s.lvl + 1})</button>` : '').join('')}</div>`, 'event');
});
on('restMedPick', (d) => { R().skills[Number(d.s)].lvl++; sfx.levelup(); finishNode(); });
on('restGlyph', () => { applyEvent(R(), { glyph: 1 }); sfx.loot(); finishNode(); });

// ===================================================================== Run-Ende
export function showSummary(res, relics) {
  const accBefore = res.lvlBefore, acc = accountLevel();
  const relicHtml = relics.length ? `<h3>Neue Relikte</h3>${relics.map((r) => itemCard(r, { small: true })).join('')}` : '';
  const ach = res.achievements.length ? `<h3>Erfolge</h3>${res.achievements.map((a) => `<div class="ach done"><span class="ai">♛</span><div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div></div>`).join('')}` : '';
  const jewels = (save.run === null && res.jewelList) || [];
  const atlas = res.atlasDone ? `<div class="panel atlasdone"><h3>✶ Atlas-Region bezwungen</h3><p>${esc(res.atlasDone.name)} · Stufe ${res.atlasDone.tier}${res.atlasDone.points ? ` · <b class="up">+${res.atlasDone.points} Atlaspunkt</b>` : ''}</p></div>` : '';
  const pets = (res.hatched || []).length ? `<h3>Gefährten-Eier</h3>${res.hatched.map((h) => `<div class="ach done"><span class="ai">${PETS[h.id].glyph}</span><div><b>${esc(PETS[h.id].name)}</b><small>${h.isNew ? 'Neuer Gefährte!' : `Stufe ${h.lvl}`}</small></div></div>`).join('')}` : '';
  const jewelHtml = jewels.length ? `<h3>Neue Juwelen</h3>${jewels.map((j) => itemCard(j, { small: true })).join('')}` : '';
  const quests = (res.quests || []).length ? `<h3>Aufträge erfüllt</h3>${res.quests.map((q) => `<div class="ach done"><span class="ai">✔</span><div><b>${esc(q.text)}</b><small>+✦ ${q.dust}${q.relic ? ' · Relikt' : ''}</small></div></div>`).join('')}` : '';
  const extra = `${res.prophBonus ? `<div class="srow"><span>Prophezeiungen</span><b class="up">+${res.prophBonus}% Staub</b></div>` : ''}${res.dailyBonus ? '<div class="srow"><span>Tägliche Herausforderung</span><b class="up">Staub ×2</b></div>' : ''}`;
  const title = res.win ? '<h1 class="win">TRIUMPH</h1>' : res.outcome === 'abandon' ? '<h1 class="lose">RÜCKZUG</h1>' : '<h1 class="lose">GEFALLEN</h1>';
  const where = res.mode === 'abyss' ? `Abgrund · Ebene ${res.floor}` : res.win ? 'Alle drei Akte bezwungen' : `Fortschritt: ${res.depth} von ${3 * LAYERS} Orten`;
  const m = Math.floor(res.time / 60), s = res.time % 60;
  screen(`<div class="pad center summary">${title}<p>${esc(CLASSES[res.cls].name)} · ${where}${res.asc ? ` · Sternenhöhe ${res.asc}` : ''}</p>
    <div class="sgrid"><div><small>Stufe</small><b>${res.lvl}</b></div><div><small>Gegner</small><b>${fmt(res.kills)}</b></div>
    <div><small>Stärkster Treffer</small><b>${fmt(res.maxHit)}</b></div><div><small>Dauer</small><b>${m}:${String(s).padStart(2, '0')}</b></div></div>
    <div class="panel"><div class="srow"><span>Konto-Erfahrung</span><b>+${fmt(res.axp)}</b></div><div class="srow"><span>Sternenstaub</span><b class="dust">+✦ ${fmt(res.dust)}</b></div>
    ${extra}${acc.level > accBefore ? `<p class="up">Kontostufe ${accBefore} → ${acc.level}! +${acc.level - accBefore} Sternpunkt${acc.level - accBefore > 1 ? 'e' : ''}</p>` : ''}
    ${bar(acc.cur, acc.need, 'xp')}</div>
    ${res.win && res.mode !== 'abyss' ? `<p class="up">Sternenhöhe ${res.asc + 1} freigeschaltet!</p>` : ''}
    ${atlas}${pets}${quests}${relicHtml}${jewelHtml}${ach}<button class="btn primary big" data-a="nav" data-to="hub">Zur Sternwarte</button></div>`);
}
