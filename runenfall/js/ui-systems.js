// Langzeit-Systeme: Zitadelle (Gebäude, Ressourcen, Alchemie), Schicksalskarten, Erzfeinde, Saison-Pass,
// sowie Bausteine für Run-Vorbereitung, Schmiede (Runenschliff), Kodex-Archiv und Run-Abschluss.
import { $, on, screen, modal, closeModal, toast, topbar, itemCard } from './ui.js';
import { esc, fmt } from './util.js';
import { save, persist, checkAchievements } from './save.js';
import { ENEMIES, BOSSES, MUTATORS } from './data/content.js';
import { SKILLS } from './data/skills.js';
import { RARITY } from './data/items.js';
import { modText } from './data/stats.js';
import { PETS } from './data/endgame.js';
import {
  RES, BUILDINGS, PROD_CAP_HOURS, POTIONS, CARDS, CARD_IDS, CARD_RARITY, CARD_MAX_LVL, cardMods, PACK_COST, openPack, deckSize,
  NEMESIS_TRAITS, NEMESIS_MAX, LEAGUES, currentLeague, seasonKey, SEASON_TIERS, seasonXpFor, seasonReward, RUNE_TRAITS, RUNE_TRAIT_IDS, traitFits,
} from './data/systems.js';
import { baseLvl, addRes, hatchEgg, grindRune, grindCost, mythForge, mythForgeCost } from './run.js';
import { runeName } from './calc.js';
import { sfx, buzz } from './audio.js';

// ===================================================================== Hilfen
const ensureBase = () => {
  save.base = save.base || {};
  const b = save.base;
  b.lvl = b.lvl || {}; b.res = b.res || {}; b.potions = b.potions || {};
  for (const k of Object.keys(RES)) b.res[k] = b.res[k] || 0;
  if (!b.last) b.last = Date.now();
  b.eggT = b.eggT || 0; b.dustT = b.dustT || 0;
  return b;
};
const costOf = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]).filter(([, v]) => v > 0));
const canPay = (cost) => Object.entries(cost).every(([k, v]) => (ensureBase().res[k] || 0) >= v);
const pay = (cost) => { for (const [k, v] of Object.entries(cost)) ensureBase().res[k] -= v; };
export const resChips = (o, have = true) => Object.entries(o).map(([k, v]) => {
  const ok = !have || (ensureBase().res[k] || 0) >= v;
  return `<span class="rchip ${ok ? '' : 'no'}" style="--rc:${RES[k].color}">${RES[k].icon} ${fmt(v)}</span>`;
}).join('');

/** Offline-Produktion einsammeln (max. PROD_CAP_HOURS Stunden). Gibt das Eingesammelte zurück. */
export function collectBase() {
  const b = ensureBase();
  const now = Date.now();
  const hours = Math.min(PROD_CAP_HOURS, Math.max(0, (now - b.last) / 3600000));
  b.last = now;
  if (hours <= 0) return null;
  const got = {};
  for (const [id, B] of Object.entries(BUILDINGS)) {
    const l = baseLvl(id);
    if (!l) continue;
    for (const [k, v] of Object.entries(B.prod(l))) got[k] = (got[k] || 0) + v * hours;
  }
  const out = {};
  if (got.dust) { b.dustT += got.dust; const d = Math.floor(b.dustT); b.dustT -= d; if (d) { save.dust += d; out.dust = d; } }
  if (got.egg) {
    b.eggT += got.egg;
    while (b.eggT >= 1) { b.eggT -= 1; const h = hatchEgg(); out.eggs = [...(out.eggs || []), h]; }
  }
  const res = {};
  for (const k of Object.keys(RES)) if (got[k]) res[k] = got[k];
  if (Object.keys(res).length) { addRes(res); out.res = res; }
  persist();
  return out;
}
const prodText = (id, l) => {
  const p = BUILDINGS[id].prod(l);
  return Object.entries(p).map(([k, v]) => k === 'dust' ? `✦ ${fmt(v)}/h` : k === 'egg' ? `🥚 1 je ${fmt(24 / l)} h` : `${RES[k].icon} ${fmt(v)}/h`).join(' · ');
};
const resBar = () => `<div class="resbar">${Object.entries(RES).map(([k, r]) => `<span style="--rc:${r.color}" title="${r.name}">${r.icon} <b>${fmt(Math.floor(ensureBase().res[k] || 0))}</b></span>`).join('')}</div>`;

// ===================================================================== Zitadelle
let baseTab = 'build';
export function showBase() {
  const got = collectBase();
  const resShown = got && got.res ? Object.entries(got.res).filter(([, v]) => v >= 1) : [];
  if (got && (got.dust || resShown.length || got.eggs)) {
    const parts = [];
    if (got.dust) parts.push(`✦ ${fmt(got.dust)}`);
    parts.push(...resShown.map(([k, v]) => `${RES[k].icon} ${fmt(Math.round(v))}`));
    if (got.eggs) parts.push(...got.eggs.map((h) => `${PETS[h.id].glyph} ${h.isNew ? 'Neu!' : 'Stufe ' + h.lvl}`));
    toast(`Eingesammelt: ${parts.join(' · ')}`);
  }
  const b = ensureBase();
  const tabs = `<div class="seg"><button class="${baseTab === 'build' ? 'on' : ''}" data-a="bTab" data-t="build">Gebäude</button><button class="${baseTab === 'alch' ? 'on' : ''}" data-a="bTab" data-t="alch">Alchemie</button></div>`;
  let body = '';
  if (baseTab === 'build') {
    body = `<p class="muted small center">Gebäude arbeiten auch, wenn du nicht spielst (bis zu ${PROD_CAP_HOURS} Stunden). Rohstoffe bringst du außerdem aus jedem Run mit.</p>` +
      Object.entries(BUILDINGS).map(([id, B]) => {
        const l = baseLvl(id);
        const max = l >= B.max;
        const cost = max ? null : costOf(B.cost(l));
        const ok = cost && canPay(cost);
        return `<div class="panel bld"><div class="row between"><div><h3>${B.icon} ${esc(B.name)} <small>Stufe ${l}/${B.max}</small></h3>
          <p class="small">${esc(B.desc)}</p>${l ? `<p class="small up">${prodText(id, l) || 'Aktiv'}</p>` : ''}
          ${!max ? `<p class="small muted">Nächste Stufe: ${prodText(id, l + 1) || esc(B.desc)}</p>` : ''}</div></div>
          ${max ? '<span class="ok">AUSGEBAUT</span>' : `<div class="row between"><div class="rchips">${resChips(cost)}</div>
          <button class="btn small ${ok ? 'primary' : 'disabled'}" data-a="bUp" data-id="${id}">${l ? 'Ausbauen' : 'Errichten'}</button></div>`}</div>`;
      }).join('');
  } else {
    const lab = baseLvl('lab');
    body = `<p class="muted small center">Tränke wirken einen ganzen Run. Wähle sie vor dem Start aus. Stärkere Rezepte erfordern ein besseres Alchemielabor (Stufe ${lab}).</p>` +
      Object.entries(POTIONS).map(([id, P]) => {
        const have = b.potions[id] || 0;
        const locked = lab < P.lab;
        const ok = !locked && canPay(P.cost);
        return `<div class="panel ${locked ? 'locked' : ''}"><div class="row between"><div><b>${esc(P.name)}</b> ${have ? `<span class="badge">×${have}</span>` : ''}<p class="small">${esc(P.desc)}</p></div></div>
          <div class="row between"><div class="rchips">${locked ? `<small class="muted">🔒 Labor Stufe ${P.lab}</small>` : resChips(P.cost)}</div>
          <button class="btn small ${ok ? 'primary' : 'disabled'}" data-a="brew" data-id="${id}">Brauen</button></div></div>`;
      }).join('');
  }
  screen(`${topbar('Zitadelle', 'hub', `<b class="dust">✦ ${fmt(save.dust)}</b>`)}<div class="pad">${resBar()}${tabs}${body}</div>`);
}
on('bTab', (d) => { baseTab = d.t; showBase(); });
on('bUp', (d) => {
  const B = BUILDINGS[d.id], l = baseLvl(d.id);
  if (l >= B.max) return;
  const cost = costOf(B.cost(l));
  if (!canPay(cost)) { sfx.deny(); toast('Nicht genug Rohstoffe.'); return; }
  collectBase();
  pay(cost);
  ensureBase().lvl[d.id] = l + 1;
  save.stats.buildingUps = (save.stats.buildingUps || 0) + 1;
  sfx.levelup(); buzz(30);
  achToast();
  persist();
  const y = $('#ui').scrollTop; showBase(); $('#ui').scrollTop = y;
});
on('brew', (d) => {
  const P = POTIONS[d.id];
  if (baseLvl('lab') < P.lab || !canPay(P.cost)) { sfx.deny(); toast('Nicht genug Rohstoffe.'); return; }
  pay(P.cost);
  const b = ensureBase();
  b.potions[d.id] = (b.potions[d.id] || 0) + 1;
  save.stats.potionsBrewed = (save.stats.potionsBrewed || 0) + 1;
  sfx.loot(); achToast(); persist();
  const y = $('#ui').scrollTop; showBase(); $('#ui').scrollTop = y;
});
function achToast() {
  const n = checkAchievements();
  if (n.length) setTimeout(() => toast(`♛ Erfolg: ${esc(n[0].name)}`), 600);
}

// ===================================================================== Schicksalskarten
let cardTab = 'deck';
let cardFilter = -1;
const cardHtml = (id, lvl, extra = '') => {
  const c = CARDS[id], r = CARD_RARITY[c.rarity];
  return `<div class="tcard" style="--rc:${r.color}"><div class="row between"><b>${esc(c.name)}</b><small>${lvl ? '★'.repeat(lvl) : ''}</small></div>
    <p class="small">${cardMods(id, Math.max(1, lvl)).map(modText).map(esc).join(', ')}</p>${extra}</div>`;
};
export function showCards() {
  save.cards = save.cards || {};
  save.deck = (save.deck || []).filter((id) => save.cards[id]);
  const size = deckSize(baseLvl('observatory'));
  const owned = CARD_IDS.filter((id) => save.cards[id]);
  const tabs = `<div class="seg"><button class="${cardTab === 'deck' ? 'on' : ''}" data-a="cdTab" data-t="deck">Deck ${save.deck.length}/${size}</button>
    <button class="${cardTab === 'all' ? 'on' : ''}" data-a="cdTab" data-t="all">Sammlung ${owned.length}/${CARD_IDS.length}</button>
    <button class="${cardTab === 'packs' ? 'on' : ''}" data-a="cdTab" data-t="packs">Packs</button></div>`;
  let body = '';
  if (cardTab === 'deck') {
    body = `<p class="muted small center">Zu Beginn jedes Runs und nach jedem Akt ziehst du zufällig 2 Karten aus deinem Deck. Ihre Boni gelten den ganzen Run. Doppelte Karten erhöhen die Stufe (max. ${CARD_MAX_LVL}).</p>` +
      (save.deck.length ? `<div class="tgrid">${save.deck.map((id) => cardHtml(id, save.cards[id], `<button class="btn small" data-a="cdTog" data-id="${id}">Entfernen</button>`)).join('')}</div>`
        : '<p class="note">Dein Deck ist leer. Füge Karten aus deiner Sammlung hinzu.</p>') +
      `<p class="muted small center">Mehr Plätze: Observatorium ausbauen (+1 je 2 Stufen).</p>`;
  } else if (cardTab === 'all') {
    const filt = `<div class="seg small"><button class="${cardFilter < 0 ? 'on' : ''}" data-a="cdFilt" data-r="-1">Alle</button>${CARD_RARITY.map((r, i) => `<button class="${cardFilter === i ? 'on' : ''}" data-a="cdFilt" data-r="${i}" style="color:${r.color}">${r.name}</button>`).join('')}</div>`;
    body = filt + `<div class="tgrid">${CARD_IDS.filter((id) => cardFilter < 0 || CARDS[id].rarity === cardFilter).map((id) => {
      const lvl = save.cards[id];
      if (!lvl) return `<div class="tcard unknown"><b>???</b><small style="color:${CARD_RARITY[CARDS[id].rarity].color}">${CARD_RARITY[CARDS[id].rarity].name}</small></div>`;
      const inDeck = save.deck.includes(id);
      return cardHtml(id, lvl, `<button class="btn small ${inDeck ? '' : save.deck.length < size ? 'primary' : 'disabled'}" data-a="cdTog" data-id="${id}">${inDeck ? '✓ Im Deck' : 'Ins Deck'}</button>`);
    }).join('')}</div>`;
  } else {
    const ok = canPay(PACK_COST);
    body = `<div class="panel center"><h3>🂠 Schicksalspack</h3><p class="small">4 zufällige Karten. Seltenheiten: ${CARD_RARITY.map((r) => `<b style="color:${r.color}">${r.name} ${r.w}%</b>`).join(' · ')}</p>
      <div class="row center"><div class="rchips">${resChips(PACK_COST)}</div><button class="btn primary ${ok ? '' : 'disabled'}" data-a="cdPack">Öffnen</button></div></div>
      <p class="muted small center">Packs gibt es auch von Bossen (30%), Sternenbestien (70%) und im Saison-Pass. Kristalle liefert das Observatorium.</p>`;
  }
  screen(`${topbar('Schicksalskarten', 'hub', `<small>${owned.length}/${CARD_IDS.length}</small>`)}<div class="pad">${resBar()}${tabs}${body}</div>`);
}
on('cdTab', (d) => { cardTab = d.t; showCards(); });
on('cdFilt', (d) => { cardFilter = Number(d.r); showCards(); });
on('cdTog', (d) => {
  const i = save.deck.indexOf(d.id);
  if (i >= 0) save.deck.splice(i, 1);
  else if (save.deck.length < deckSize(baseLvl('observatory'))) save.deck.push(d.id);
  else { toast('Dein Deck ist voll.'); return; }
  persist();
  const y = $('#ui').scrollTop; showCards(); $('#ui').scrollTop = y;
});
export function grantPack(n = 4) {
  const got = openPack(n);
  save.cards = save.cards || {};
  const res = got.map((id) => { const was = save.cards[id] || 0; save.cards[id] = Math.min(CARD_MAX_LVL, was + 1); return { id, isNew: !was, lvl: save.cards[id] }; });
  save.stats.packsOpened = (save.stats.packsOpened || 0) + 1;
  return res;
}
const packModal = (res, back) => {
  modal(`<h2 class="center">🂠 Schicksal gezogen</h2><div class="tgrid">${res.map((r) => cardHtml(r.id, r.lvl, `<small class="${r.isNew ? 'up' : 'muted'}">${r.isNew ? 'NEU!' : `Stufe ${r.lvl}`}</small>`)).join('')}</div>
    <button class="btn primary" data-a="${back}">Weiter</button>`, 'event');
};
on('cdPack', () => {
  if (!canPay(PACK_COST)) { sfx.deny(); toast('Nicht genug Kristalle.'); return; }
  pay(PACK_COST);
  const res = grantPack(4);
  sfx.loot(); buzz(40); achToast(); persist();
  packModal(res, 'cdPackDone');
});
on('cdPackDone', () => { closeModal(); showCards(); });

// ===================================================================== Erzfeinde
export function showNemesis() {
  const list = [...(save.nemesis || [])].sort((a, b) => b.rank - a.rank);
  const body = list.length ? list.map((n) => {
    const base = ENEMIES[n.base];
    return `<div class="panel nem" style="--nc:${n.color}"><div class="row between"><div><h3>☠ ${esc(n.name)}</h3>
      <small class="muted">Ursprung: ${esc(n.from)} · ${esc(base ? base.name : n.base)}</small></div><b class="rank">Rang ${n.rank}</b></div>
      <div class="tags">${n.traits.map((t) => `<span class="chip" title="${esc(NEMESIS_TRAITS[t].desc)}">${esc(NEMESIS_TRAITS[t].name)}</span>`).join('')}</div>
      <ul class="mods">${n.traits.map((t) => `<li>${esc(NEMESIS_TRAITS[t].name)}: ${esc(NEMESIS_TRAITS[t].desc)}</li>`).join('')}</ul>
      <p class="small muted">Hat dich ${n.kills}× getötet · Kopfgeld: ✦ ${120 * n.rank} + Mythischer Gegenstand${n.rank >= 3 ? ' + Relikt' : ''}</p></div>`;
  }).join('') : '<p class="note">Noch hat dich niemand bezwungen. Wer dich tötet, merkt es sich – und wird stärker.</p>';
  screen(`${topbar('Erzfeinde', 'hub', `<small>${list.length}/${NEMESIS_MAX}</small>`)}<div class="pad">
    <p class="muted small center">Gegner, die dich töten, werden zu Erzfeinden: Sie bekommen einen Namen, steigen im Rang auf und lauern dir in späteren Runs auf. Besiege sie für mythische Beute.</p>
    <div class="sgrid"><div><small>Vernichtet</small><b>${save.stats.nemesisSlain || 0}</b></div><div><small>Höchster Rang</small><b>${save.stats.nemesisMax || 0}</b></div></div>
    ${body}</div>`);
}

// ===================================================================== Saison-Pass
export function seasonState() {
  if (!save.season || save.season.key !== seasonKey()) save.season = { key: seasonKey(), xp: 0, claimed: [] };
  let xp = save.season.xp, tier = 0;
  while (tier < SEASON_TIERS && xp >= seasonXpFor(tier)) { xp -= seasonXpFor(tier); tier++; }
  return { tier, cur: xp, need: tier < SEASON_TIERS ? seasonXpFor(tier) : 1, claimable: Array.from({ length: tier }, (_, i) => i).filter((i) => !save.season.claimed.includes(i)).length };
}
export function showSeason() {
  const st = seasonState();
  const L = currentLeague();
  const month = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const rows = Array.from({ length: SEASON_TIERS }, (_, i) => {
    const rw = seasonReward(i);
    const got = save.season.claimed.includes(i);
    const reached = i < st.tier;
    return `<div class="stier ${reached ? 'reached' : ''} ${got ? 'got' : ''} ${rw.mythic ? 'big' : ''}"><b>${i + 1}</b><span>${esc(rw.label)}</span>
      ${got ? '<span class="ok">✓</span>' : reached ? `<button class="btn small primary" data-a="sClaim" data-i="${i}">Abholen</button>` : '<small class="muted">🔒</small>'}</div>`;
  }).join('');
  screen(`${topbar('Saison', 'hub', `<small>Stufe ${st.tier}/${SEASON_TIERS}</small>`)}<div class="pad">
    <div class="panel center"><h3>✧ Saison ${esc(month)}</h3><p class="small">Jeder Run bringt Saison-Erfahrung (Ligaruns +50%). Die Saison wechselt jeden Monat – mit neuen Belohnungen.</p>
    <div class="bar xp"><i style="width:${Math.round((st.cur / st.need) * 100)}%"></i></div><small>${st.tier >= SEASON_TIERS ? 'Saison abgeschlossen!' : `${fmt(st.cur)} / ${fmt(st.need)} bis Stufe ${st.tier + 1}`}</small>
    ${st.claimable > 1 ? `<button class="btn primary small" data-a="sClaimAll">Alle abholen (${st.claimable})</button>` : ''}</div>
    <div class="panel league"><h3>⚑ Liga dieser Woche: ${esc(L.name)}</h3><p class="small">${esc(L.desc)}</p>
      <p class="small muted">Prophezeiungen: ${L.muts.map((m) => esc(MUTATORS[m]?.name || m)).join(', ')} · +${L.bonus}% Staub · Saison-EP ×1,5</p>
      <p class="small">Ligaruns gespielt: <b>${save.stats.leagueRuns || 0}</b> · Bestleistung diese Woche: <b>${save.leagueBest && save.leagueBest.key === L.key ? save.leagueBest.depth : 0}</b></p></div>
    <div class="stiers">${rows}</div></div>`);
}
function claimTier(i) {
  if (save.season.claimed.includes(i) || i >= seasonState().tier) return null;
  save.season.claimed.push(i);
  const rw = seasonReward(i);
  if (rw.dust) save.dust += rw.dust;
  if (rw.res) addRes(rw.res);
  if (rw.mythic) save.pendingMythic = (save.pendingMythic || 0) + 1;
  let pack = null, egg = null;
  if (rw.pack) pack = grantPack(4);
  if (rw.egg) egg = hatchEgg();
  save.stats.seasonClaims = (save.stats.seasonClaims || 0) + 1;
  return { rw, pack, egg };
}
on('sClaim', (d) => {
  const r = claimTier(Number(d.i));
  if (!r) return;
  sfx.loot(); buzz(30); achToast(); persist();
  if (r.pack) return packModal(r.pack, 'sDone');
  if (r.egg) toast(`${PETS[r.egg.id].glyph} ${esc(PETS[r.egg.id].name)} ${r.egg.isNew ? 'ist geschlüpft!' : `– Stufe ${r.egg.lvl}`}`);
  else toast(`Erhalten: ${esc(r.rw.label)}`);
  const y = $('#ui').scrollTop; showSeason(); $('#ui').scrollTop = y;
});
on('sClaimAll', () => {
  const st = seasonState();
  const packs = [];
  for (let i = 0; i < st.tier; i++) { const r = claimTier(i); if (r && r.pack) packs.push(...r.pack); }
  sfx.loot(); achToast(); persist();
  if (packs.length) return packModal(packs, 'sDone');
  showSeason();
});
on('sDone', () => { closeModal(); showSeason(); });

// ===================================================================== Run-Vorbereitung: Liga & Tränke
export function leaguePanel(setup) {
  if (setup.mode !== 'normal' || !Object.keys(save.stats.wins).length) return '';
  const L = currentLeague();
  return `<div class="panel league"><div class="row between"><h3>⚑ ${esc(L.name)}</h3>
    <button class="btn small ${setup.league ? 'primary' : ''}" data-a="togLeague">${setup.league ? '✓ Teilnehmen' : 'Teilnehmen'}</button></div>
    <p class="small">${esc(L.desc)} <b class="up">+${L.bonus}% Staub · Saison-EP ×1,5</b></p></div>`;
}
export function potionPanel(setup) {
  const p = (save.base && save.base.potions) || {};
  const have = Object.keys(POTIONS).filter((id) => p[id] > 0);
  if (!have.length) return '';
  if (setup.potion && !have.includes(setup.potion)) setup.potion = null;
  return `<div class="panel"><h3>⚗ Trank</h3><div class="seg"><button class="${!setup.potion ? 'on' : ''}" data-a="pickPot" data-id="">Keiner<small>–</small></button>
    ${have.map((id) => `<button class="${setup.potion === id ? 'on' : ''}" data-a="pickPot" data-id="${id}">${esc(POTIONS[id].name)}<small>×${p[id]} · ${esc(POTIONS[id].desc)}</small></button>`).join('')}</div></div>`;
}

// ===================================================================== Schmiede: Runenschliff & Mythisches Umschmieden
export function grindPanel(run) {
  const cost = grindCost(run);
  const runes = run.skills.map((sk, i) => {
    const tr = (sk.traits || []).map((t) => RUNE_TRAITS[t]?.name).filter(Boolean);
    return `<div class="srow"><span><b>${esc(runeName(sk))}</b>${tr.length ? '' : ' <small class="muted">(ohne Merkmal)</small>'}</span>
      <button class="btn small ${run.gold >= cost ? '' : 'disabled'}" data-a="grind" data-i="${i}">Schleifen ● ${cost}</button></div>`;
  }).join('');
  const myth = baseLvl('forge') >= 5 ? [...Object.values(run.eq), ...run.bag].filter((it) => it && it.rarity === 'mythic') : [];
  const mc = mythForgeCost(run);
  return `<div class="panel"><h3>✧ Runenschliff</h3><p class="small muted">Würfelt die Merkmale einer Rune neu (z. B. „Glühend“, „Zwillings“). Runen ohne Merkmal erhalten eins.</p>${runes}</div>
    ${myth.length ? `<div class="panel"><h3>✦ Mythisches Umschmieden</h3><p class="small muted">Ersetzt einen zufälligen Spezialeffekt.</p>${myth.map((it) =>
      `<div class="srow"><span style="color:${RARITY.mythic.color}">${esc(it.title || 'Mythisch')}</span><button class="btn small ${run.gold >= mc ? '' : 'disabled'}" data-a="mForge" data-u="${it.uid}">● ${mc}</button></div>`).join('')}</div>` : ''}`;
}
on('grind', (d) => {
  const run = save.run;
  const inst = run && run.skills[Number(d.i)];
  if (!inst || !grindRune(run, inst)) { sfx.deny(); toast('Nicht genug Gold.'); return; }
  sfx.loot(); buzz(15); persist();
  toast(`Neu geschliffen: <b>${esc(runeName(inst))}</b>`);
  import('./ui-run.js').then((m) => m.showForge());
});
on('mForge', (d) => {
  const run = save.run;
  const it = [...Object.values(run.eq), ...run.bag].find((x) => x && x.uid === d.u);
  if (!it || !mythForge(run, it)) { sfx.deny(); toast('Nicht möglich.'); return; }
  sfx.loot(); persist();
  import('./ui-run.js').then((m) => m.showForge());
});

// ===================================================================== Kodex: Runen-Archiv
export function archiveTab() {
  const arch = new Set(save.runeArchive || []);
  let total = 0;
  const rows = Object.entries(SKILLS).map(([id, def]) => {
    const fits = RUNE_TRAIT_IDS.filter((t) => traitFits(RUNE_TRAITS[t], def));
    total += fits.length;
    const found = fits.filter((t) => arch.has(`${id}:${t}`));
    if (!found.length) return `<div class="srow muted"><span>${esc(def.name)}</span><small>0/${fits.length}</small></div>`;
    return `<div class="panel"><div class="row between"><b>${esc(def.name)}</b><small>${found.length}/${fits.length}</small></div>
      <div class="tags">${fits.map((t) => `<span class="chip ${arch.has(`${id}:${t}`) ? 'on' : 'off'}" title="${esc(RUNE_TRAITS[t].mods.map(modText).join(', '))}">${arch.has(`${id}:${t}`) ? esc(RUNE_TRAITS[t].name) : '?'}</span>`).join('')}</div></div>`;
  }).join('');
  return `<p class="muted center small">${arch.size}/${total} Runenvarianten entdeckt. Runen können mit Merkmalen erscheinen, die ihr Verhalten verändern – sammle alle.</p>${rows}`;
}

// ===================================================================== Run-Abschluss
export function systemsSummary(res) {
  let h = '';
  if (res.nemesis) {
    const n = res.nemesis;
    h += `<div class="panel nem" style="--nc:${n.color}"><h3>☠ ${n.promoted ? 'Dein Erzfeind wird stärker' : 'Ein neuer Erzfeind erhebt sich'}</h3>
      <p><b>${esc(n.name)}</b> · Rang ${n.rank}</p><p class="small muted">${esc(n.taunt)}</p>
      <div class="tags">${n.traits.map((t) => `<span class="chip">${esc(NEMESIS_TRAITS[t].name)}</span>`).join('')}</div></div>`;
  }
  for (const n of res.nemesisSlain || []) h += `<div class="panel atlasdone"><b>☠ Erzfeind vernichtet: ${esc(n.name)}</b><small class="muted">Rang ${n.rank}</small></div>`;
  const mats = Object.entries(res.mats || {}).filter(([, v]) => v > 0);
  if (mats.length || res.sxp) {
    h += `<div class="panel">${mats.length ? `<div class="srow"><span>Rohstoffe</span><span class="rchips">${mats.map(([k, v]) => `<span class="rchip" style="--rc:${RES[k].color}">${RES[k].icon} ${fmt(v)}</span>`).join('')}</span></div>` : ''}
      ${res.sxp ? `<div class="srow"><span>Saison-Erfahrung${res.league ? ' (Liga)' : ''}</span><b class="up">+${fmt(res.sxp)}</b></div>` : ''}</div>`;
  }
  if ((res.packs || []).length) {
    h += `<h3>Kartenpacks</h3><div class="tgrid">${res.packs.map((id) => cardHtml(id, save.cards[id] || 1)).join('')}</div>`;
  }
  if ((res.cards || []).length) h += `<p class="small muted">Gezogene Schicksalskarten: ${res.cards.filter((c) => CARDS[c]).map((c) => esc(CARDS[c].name)).join(', ')}</p>`;
  return h;
}

/** Kacheln für den Hub. */
export function systemTiles() {
  const t = systemTileMap();
  return t.base + t.cards + t.nemesis + t.season;
}
/** Einzelne Kacheln für die Sternwarte. */
export function systemTileMap() {
  const st = seasonState();
  const nem = (save.nemesis || []).length;
  const b = ensureBase();
  const pend = (Date.now() - b.last) / 3600000 > 1 && Object.keys(b.lvl).length;
  return {
    base: `<button class="tile" data-a="nav" data-to="base"><span class="ti">🏰</span>Zitadelle${pend ? '<i class="dot"></i>' : ''}<small>${Object.values(b.lvl).reduce((a, x) => a + x, 0)} Gebäudestufen</small></button>`,
    cards: `<button class="tile" data-a="nav" data-to="cards"><span class="ti">🂠</span>Schicksal<small>${Object.keys(save.cards || {}).length}/${CARD_IDS.length} Karten</small></button>`,
    nemesis: `<button class="tile" data-a="nav" data-to="nemesis"><span class="ti">☠</span>Erzfeinde${nem ? '<i class="dot"></i>' : ''}<small>${nem} lauern</small></button>`,
    season: `<button class="tile" data-a="nav" data-to="season"><span class="ti">✧</span>Saison${st.claimable ? '<i class="dot"></i>' : ''}<small>Stufe ${st.tier}/${SEASON_TIERS}</small></button>`,
  };
}
