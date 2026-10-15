// Build-Werte mit Herkunft: jeder Wert antippbar (Erklärung + Quellen), Schadensquellen je Rune, aktive Effekte des Runs.
import { on, modal, helpBtn, tagChips } from './ui.js';
import { esc, fmt, fmtV } from './util.js';
import { save } from './save.js';
import { ELEM, ELEMENTAL, DMG_TYPES, modText } from './data/stats.js';
import { BOON_RARITY, MUTATORS, ASC_MODS } from './data/content.js';
import { POTIONS, CARDS, cardMods, currentLeague } from './data/systems.js';
import { PETS, SETS } from './data/endgame.js';
import { FACTIONS, REP_RANKS, repRank, facIcon } from './data/factions.js';
import { towerFloor, lawName, lawDesc } from './data/modes.js';
import { snapshot, boonMods, ascendMods, actInfo, xpNeed } from './run.js';
import { skillLocal, flatSum, runeName, BASE_LIFE, LIFE_PER_LVL } from './calc.js';

const R = () => save.run;
const nz = (v) => Math.abs(v) > 1e-6;
const flatTxt = (v, unit) => `${v >= 0 ? '+' : '−'}${fmtV(Math.abs(v))}${unit}`;
const incTxt = (v) => (v >= 0 ? `+${fmtV(v)}% erhöht` : `${fmtV(-v)}% verringert`);
const moreTxt = (m) => (m >= 1 ? `${fmtV((m - 1) * 100)}% mehr` : `${fmtV((1 - m) * 100)}% weniger`);
const parts = (flat, inc, more, unit = '') => [nz(flat) ? flatTxt(flat, unit) : '', nz(inc) ? incTxt(inc) : '', nz(more - 1) ? moreTxt(more) : ''].filter(Boolean).join(' · ');

/**
 * Beitrag jeder Quelle zu den Schlüsseln – zählt wie calc.aggKeys: In den ersten `skip` Sets
 * gilt der erste Schlüssel nicht (Begleiter profitieren nicht von allgemeinen Boni). Leer: ''.
 */
function sourceRows(sets, keys, { skip = 0, unit = '' } = {}) {
  const rows = [];
  let tf = 0, ti = 0, tm = 1;
  sets.forEach((set, i) => {
    let flat = 0, inc = 0, more = 1;
    keys.forEach((k, j) => {
      if (j === 0 && i < skip) return;
      const e = set.m.get(k);
      if (e) { flat += e.flat; inc += e.inc; more *= e.more; }
    });
    if (!nz(flat) && !nz(inc) && !nz(more - 1)) return;
    tf += flat; ti += inc; tm *= more;
    rows.push(`<div class="srcrow"><span>${esc(set.label || 'Sonstiges')}</span><b>${parts(flat, inc, more, unit)}</b></div>`);
  });
  if (!rows.length) return '';
  return rows.join('') + (rows.length > 1 ? `<div class="srcrow total"><span>Zusammen</span><b>${parts(tf, ti, tm, unit)}</b></div>` : '');
}
/** Gruppen [Titel, Schlüssel, Einheit] – getrennt, wo Werte nicht zusammengezählt werden. */
function groupsHtml(sets, groups, { skip = 0, empty = 'Keine Boni aus irgendeiner Quelle – nur der Grundwert.' } = {}) {
  const out = groups.map(([title, keys, unit]) => {
    const r = sourceRows(sets, keys, { skip, unit });
    return r ? `${title ? `<h4>${esc(title)}</h4>` : ''}<div class="srclist">${r}</div>` : '';
  }).join('');
  return out || `<p class="small muted">${empty}</p>`;
}

const pct = (x) => `${x >= 1 ? '+' : '−'}${Math.round(Math.abs(x - 1) * 100)}%`;
const incMore = (sets, key) => {
  let inc = 0, more = 1;
  for (const s of sets) { const e = s.m.get(key); if (e) { inc += e.inc; more *= e.more; } }
  return [nz(inc) ? `${inc >= 0 ? '+' : '−'}${fmtV(Math.abs(inc))}%` : '', nz(more - 1) ? moreTxt(more) : ''].filter(Boolean).join(' · ') || '±0%';
};

// Werte im Build: Name, Gruppen, Kompendium-Artikel, Erklärung, Anzeige
const STATS = {
  life: { name: 'Leben', g: [['', ['life']]], help: 'life', text: 'Dein maximales Leben: Grundwert je Run-Stufe plus flache Boni, dann „erhöht“ (addiert sich) und „mehr“ (multipliziert sich).', show: (P, run) => `${fmt(run.hp)} / ${fmt(P.maxLife)}` },
  barrier: { name: 'Barriere', g: [['Barriere', ['barrier']], ['Aufladetempo', ['barrierRecharge']]], help: 'barrier', text: 'Fängt Schaden vor dem Leben ab und lädt nach 2 Sekunden ohne Treffer wieder auf.', show: (P) => fmt(P.maxBarrier) },
  armor: { name: 'Rüstung', g: [['', ['armor']]], help: 'armor', text: 'Senkt physischen Trefferschaden: Rüstung ÷ (Rüstung + 8 × Treffer), höchstens 90%. Gegen kleine Treffer wirkt sie viel stärker als gegen große.', show: (P) => fmt(Math.round(P.armor)) },
  evasion: { name: 'Ausweichen', g: [['Ausweichwert', ['evasion']], ['Ausweichchance (Akrobatik)', ['dodge'], '%']], help: 'evasion', text: 'Chance, Treffern ganz zu entgehen: Ausweichwert ÷ (Ausweichwert + 600), höchstens 75%. Akrobatik kommt als eigene Chance dazu (höchstens 60%).', show: (P) => `${fmt(Math.round(P.evasion))} (${Math.round(Math.min(75, (P.evasion / (P.evasion + 600)) * 100))}%)${P.dodge ? ` + ${P.dodge}%` : ''}` },
  regen: { name: 'Regeneration', g: [['Leben pro Sekunde', ['lifeRegen']], ['Anteil deines Lebens pro Sekunde', ['lifeRegenPct'], '%']], help: 'heal', text: 'Leben pro Sekunde – flach und in Prozent deines maximalen Lebens.', show: (P) => `${fmtV(P.regen)}/s` },
  res: { name: 'Widerstände', g: [['Feuer', ['res_fire'], '%'], ['Kälte', ['res_cold'], '%'], ['Blitz', ['res_light'], '%'], ['Chaos', ['res_chaos'], '%'], ['Alle Elementarwiderstände (Feuer, Kälte, Blitz)', ['res_elem'], '%'], ['Höchstwert (Grundwert 75%)', ['resMax'], '%']], help: 'playerres', text: 'Senken Schaden der jeweiligen Art. Normal höchstens 75% – „maximale Widerstände“ heben die Grenze.', show: (P) => ['fire', 'cold', 'light', 'chaos'].map((t) => `<span style="color:${ELEM[t].color}">${Math.round(P.res[t])}%</span>`).join(' · '),
    big: (P) => `<div class="sgrid g4">${['fire', 'cold', 'light', 'chaos'].map((t) => `<div><small>${ELEM[t].name}</small><b style="color:${ELEM[t].color}">${Math.round(P.res[t])}%</b></div>`).join('')}</div>` },
  dmgTaken: { name: 'Erlittener Schaden', g: [['', ['dmgTaken']]], help: 'life', text: 'Verändert jeden Schaden, den du nimmst – weniger ist besser.', show: (P) => pct(P.dmgTaken) },
  dmg: { name: 'Schaden (allgemein)', g: [['', ['dmg']]], help: 'damage', text: 'Gilt für alle Runen außer Begleitern. Dazu kommen Boni für Schadensarten, Zauber, Projektile usw. – tippe eine Rune an, um alles zu sehen, was sie verstärkt.', show: (P, run, sets) => incMore(sets, 'dmg') },
  crit: { name: 'Kritische Treffer', g: [['Krit-Chance (Basis der Rune + flache Boni, dann erhöht)', ['critBase', 'crit'], '%'], ['Krit-Multiplikator (Grundwert 150%)', ['critMulti'], '%']], help: 'crit', text: 'Krit-Chance: Basiswert der Rune plus flache Boni, mal „erhöhte kritische Trefferchance“. Kritische Treffer verursachen Schaden mal Krit-Multiplikator.', show: (P, run, sets) => incMore(sets, 'crit') },
  speed: { name: 'Fertigkeitstempo', g: [['', ['speed']]], help: 'speedarea', text: 'Runen feuern öfter. Boni nur für bestimmte Runenarten siehst du bei der jeweiligen Rune.', show: (P, run, sets) => incMore(sets, 'speed') },
  area: { name: 'Wirkungsbereich', g: [['', ['area']]], help: 'speedarea', text: 'Größere Flächen – der Radius wächst mit der Wurzel des Bonus.', show: (P, run, sets) => incMore(sets, 'area') },
  proj: { name: 'Projektile & Ketten', g: [['Zusätzliche Projektile', ['proj']], ['Durchbohren', ['pierce']], ['Kettensprünge', ['chain']]], help: 'speedarea', text: 'Mehr Geschosse, Durchbohren (fliegt durch Gegner) und Kettensprünge (springt zum nächsten Gegner). Hier stehen Boni für alle Runen – Glyphen wirken nur auf ihre eigene Rune.', show: (P, run, sets) => {
    const [n, p, c] = ['proj', 'pierce', 'chain'].map((k) => flatSum(sets, k));
    return [nz(n) ? `${flatTxt(n, '')} Geschosse` : '', nz(p) ? `${fmtV(p)}× Durchbohren` : '', nz(c) ? `${fmtV(c)}× Kette` : ''].filter(Boolean).join(' · ') || 'keine Boni';
  } },
  move: { name: 'Bewegungstempo', g: [['', ['move']]], help: 'controls', text: 'Wie schnell du läufst (100% = Grundtempo).', show: (P) => Math.round((P.move / 155) * 100) + '%' },
  magnet: { name: 'Aufsammelradius', g: [['', ['magnet']]], help: 'controls', text: 'Ab welcher Entfernung Kugeln zu dir fliegen (Grundwert 75).', show: (P) => Math.round(P.magnet) },
  xp: { name: 'Erfahrung', g: [['', ['xp']]], help: 'loop', text: 'Mehr Erfahrung aus Kugeln – schnellere Stufenaufstiege und damit mehr Segen im Run.', show: (P) => pct(P.xpMult) },
  luck: { name: 'Seltenheit', g: [['', ['luck']]], help: 'rarity', text: 'Seltenere Gegenstände und Segen werden wahrscheinlicher.', show: (P) => `+${Math.round(P.luck)}%` },
  gold: { name: 'Goldfund', g: [['', ['gold']]], help: 'loop', text: 'Mehr Gold von Gegnern und Ereignissen.', show: (P) => pct(P.goldMult) },
  heal: { name: 'Heilwirkung', g: [['', ['heal']]], help: 'heal', text: 'Verstärkt jede Heilung – nach Kämpfen, aus Ereignissen und durch Lebensraub.', show: (P) => pct(P.heal) },
};

/** Werte-Tab des Builds: jeder Wert antippbar. */
export function sheetHtml(run, snap) {
  const P = snap.P, sets = snap.sets;
  const row = (id) => { const S = STATS[id]; return `<button class="statrow" data-a="statInfo" data-k="${id}"><span>${esc(S.name)}</span><b>${S.show(P, run, sets)}</b><i>›</i></button>`; };
  const total = snap.skills.reduce((s, S) => s + S.dps, 0);
  const skills = snap.skills.map((S, i) => (S.isPet ? `<div class="statrow plain"><span>🐾 ${esc(S.def.name)}</span><b>${fmt(S.dps)}/s</b></div>`
    : `<button class="statrow" data-a="skillSrc" data-i="${i}"><span>${esc(runeName(run.skills[i]))}</span><b>${fmt(S.dps)}/s</b><i>›</i></button>`)).join('');
  const spec = Object.keys(P.spec).length ? `<div class="panel"><h3>Besondere Effekte</h3><ul class="mods">${Object.entries(P.spec).map(([k, v]) => `<li>${esc(modText({ s: k, v }))}</li>`).join('')}</ul></div>` : '';
  return `<p class="small muted center">Tippe einen Wert oder eine Rune an, um zu sehen, woher er kommt.</p>
    <div class="panel"><h3>Angriff</h3><div class="statrow plain"><span>Geschätzter Gesamtschaden</span><b class="dps">${fmt(total)}/s</b></div>${skills}
      ${['dmg', 'crit', 'speed', 'area', 'proj'].map(row).join('')}</div>
    <div class="panel"><h3>Verteidigung</h3>${['life', 'barrier', 'armor', 'evasion', 'regen', 'res', 'dmgTaken'].map(row).join('')}</div>
    <div class="panel"><h3>Sonstiges</h3>${['move', 'magnet', 'xp', 'luck', 'gold', 'heal'].map(row).join('')}
      <div class="statrow plain"><span>Run-Erfahrung</span><b>${fmt(run.xp)} / ${fmt(xpNeed(run.lvl))}</b></div></div>${spec}`;
}

on('statInfo', (d) => {
  const run = R(), S = STATS[d.k];
  if (!run || !S) return;
  const snap = snapshot(run);
  const base = d.k === 'life' ? `<div class="srclist"><div class="srcrow"><span>Grundwert (Run-Stufe ${run.lvl})</span><b>${BASE_LIFE + run.lvl * LIFE_PER_LVL}</b></div></div>` : '';
  modal(`<h2>${esc(S.name)}</h2>${S.big ? S.big(snap.P) : `<p class="center big">${S.show(snap.P, run, snap.sets)}</p>`}<p class="small">${esc(S.text)}</p>
    <h3>Herkunft</h3>${base}${groupsHtml(snap.sets, S.g)}
    <div class="row between helprow"><span class="small muted">Mehr dazu im Kompendium</span>${helpBtn(S.help)}</div>
    <button class="btn" data-a="_close">Schließen</button>`, 'helpmodal');
});

on('skillSrc', (d) => {
  const run = R();
  const i = Number(d.i), inst = run && run.skills[i];
  if (!inst) return;
  const snap = snapshot(run), S = snap.skills[i];
  const { def, local } = skillLocal(inst, snap.sets);
  const all = [...snap.sets, local];
  const minion = def.tags.includes('minion');
  const skip = minion ? snap.sets.length : 0;
  // Schadensarten wie in der Berechnung: Endarten plus Ursprungsarten (umgewandelter Schaden zählt für beide)
  const types = [...new Set([...Object.keys(S.dmg), ...Object.keys(def.dmg || def.dps || {})])];
  const tags = [...S.cat, ...types, ...(types.some((t) => ELEMENTAL.includes(t)) ? ['elem'] : []), ...(S.isDot ? ['dot'] : [])];
  const scoped = (b, list) => [b, ...list.map((t) => `${b}_${t}`)];
  const sec = (title, keys, opt = { skip }) => `<h4>${esc(title)}</h4>${groupsHtml(all, [['', keys, opt.unit]], { skip: opt.skip || 0, empty: 'Keine Boni.' })}`;
  const added = S.isDot ? [] : DMG_TYPES.filter((t) => nz(flatSum(all, 'add_' + t)));
  const hit = Object.keys(S.dmg).map((t) => `<span style="color:${ELEM[t].color}">${fmt(S.dmg[t][0])}–${fmt(S.dmg[t][1])} ${esc(ELEM[t].name)}</span>`).join(' · ');
  modal(`<h2>${esc(runeName(inst))}</h2><div class="tags center">${tagChips(S.cat)}</div>
    <div class="sgrid g3"><div><small>Schaden/s</small><b>${fmt(S.dps)}</b></div><div><small>Stufe</small><b>${S.lvl}</b></div>
      <div><small>Krit</small><b>${S.noCrit ? '–' : `${Math.round(S.crit)}% ×${Math.round(S.critMulti)}%`}</b></div></div>
    <p class="small center">${hit || 'Kein direkter Schaden'} · alle ${fmtV(S.interval)} s</p>
    ${minion ? '<p class="small muted">Begleiter profitieren nicht von allgemeinem Schaden, Tempo, Krit und Wirkungsbereich deiner anderen Quellen – nur von Begleiter-Boni und passenden Schadensarten.</p>' : ''}
    <h3>Herkunft</h3>
    ${sec('Schaden', scoped('dmg', tags))}
    ${added.map((t) => sec(`Hinzugefügt: ${ELEM[t].name}${def.eff && def.eff !== 1 ? ` (Wirksamkeit ${Math.round(def.eff * 100)}%)` : ''}`, ['add_' + t], { skip: 0 })).join('')}
    ${S.noCrit ? '' : `${sec('Krit-Chance', [...scoped('crit', S.cat), 'critBase'], { skip, unit: '%' })}${sec('Krit-Multiplikator', ['critMulti'], { skip: 0, unit: '%' })}`}
    ${sec('Tempo', scoped('speed', S.cat))}
    ${S.area || S.explode ? sec('Wirkungsbereich', scoped('area', S.cat)) : ''}
    <div class="row between helprow"><span class="small muted">Wie Schaden berechnet wird</span>${helpBtn('damage')}</div>
    <button class="btn" data-a="_close">Schließen</button>`, 'helpmodal');
});

// ===================================================================== Aktive Effekte des Runs
export function effectsHtml(run) {
  const sec = [];
  const lis = (mods) => mods.map((m) => `<li>${esc(modText(m))}</li>`).join('');
  if (run.boons.length) sec.push(`<h3>Segen (${run.boons.length})</h3><ul class="mods">${run.boons.map((b) => `<li style="color:${BOON_RARITY[b.r].color}">${boonMods(b).map(modText).map(esc).join(', ')}</li>`).join('')}</ul>`);
  if (run.runMods.length) sec.push(`<h3>Aus Ereignissen & Gaben</h3><ul class="mods">${lis(run.runMods)}</ul>`);
  if (run.shrine && run.shrine.fights > 0) sec.push(`<h3>Schrein: ${esc(run.shrine.name)}</h3><p class="small muted">Noch ${run.shrine.fights === 1 ? 'ein Kampf' : `${run.shrine.fights} Kämpfe`}</p><ul class="mods">${lis(run.shrine.mods)}</ul>`);
  if (run.potion && POTIONS[run.potion]) sec.push(`<h3>Trank: ${esc(POTIONS[run.potion].name)}</h3><ul class="mods">${lis(POTIONS[run.potion].mods)}</ul>`);
  const cards = (run.cards || []).filter((c) => CARDS[c] && save.cards && save.cards[c]);
  if (cards.length) sec.push(`<h3>Schicksalskarten</h3><ul class="mods">${cards.map((c) => `<li><b>${esc(CARDS[c].name)}</b> ★${save.cards[c]}: ${cardMods(c, save.cards[c]).map(modText).map(esc).join(', ')}</li>`).join('')}</ul>`);
  if ((run.gifts || []).length) sec.push(`<h3>Gaben der Häuser</h3><p class="small">${run.gifts.map(esc).join(' · ')}</p>`);
  const asc = ascendMods(run.ascend);
  if (asc.length) sec.push(`<h3>Aufstiegsklasse</h3><ul class="mods">${lis(asc)}</ul>`);
  if (run.pet && PETS[run.pet] && save.pets[run.pet]) sec.push(`<h3>Gefährte: ${esc(PETS[run.pet].name)} (Stufe ${save.pets[run.pet].lvl})</h3><ul class="mods">${lis(PETS[run.pet].passive(save.pets[run.pet].lvl))}</ul>`);
  const setCount = {};
  for (const it of Object.values(run.eq)) if (it && it.rarity === 'set' && SETS[it.set]) setCount[it.set] = (setCount[it.set] || 0) + 1;
  for (const [sid, n] of Object.entries(setCount)) {
    const act = Object.entries(SETS[sid].bonus).filter(([k]) => n >= Number(k));
    sec.push(`<h3 style="color:${SETS[sid].color}">Set: ${esc(SETS[sid].name)} (${n} Teile)</h3>${act.length ? `<ul class="mods">${act.map(([k, mods]) => `<li>${k} Teile: ${mods.map(modText).map(esc).join(', ')}</li>`).join('')}</ul>` : '<p class="small muted">Noch kein Bonus aktiv (ab 2 Teilen).</p>'}`);
  }
  // Regeln des Runs
  const rules = [];
  for (const m of run.mutators || []) if (MUTATORS[m]) rules.push(`<li><b>${esc(MUTATORS[m].name)}:</b> ${esc(MUTATORS[m].desc)}</li>`);
  if (run.league && currentLeague().key === run.league) rules.push(`<li><b>${esc(currentLeague().name)}</b> – +${run.leagueBonus}% Sternenstaub</li>`);
  for (const m of ASC_MODS.filter((x) => x.lvl <= run.asc)) rules.push(`<li><b>Sternenhöhe ${m.lvl}:</b> ${esc(m.text)}</li>`);
  const A = actInfo(run);
  for (const m of A.regionMods || []) if (MUTATORS[m]) rules.push(`<li><b>${run.mode === 'tower' ? 'Turmgesetz' : 'Regionsregel'} ${esc(MUTATORS[m].name)}:</b> ${esc(MUTATORS[m].desc)}</li>`);
  if (run.mode === 'tower') { const F = towerFloor(run.towerKey, run.floor); if (F.law === 'calm' && !F.law2) rules.push(`<li><b>Turmgesetz ${esc(lawName('calm'))}:</b> ${esc(lawDesc('calm'))}</li>`); }
  if (rules.length) sec.push(`<h3>Regeln dieses Runs</h3><ul class="mods">${rules.join('')}</ul>`);
  // Dauerhafte Hausboni zur Erinnerung
  const fac = Object.entries(save.factions || {}).filter(([id, f]) => FACTIONS[id] && repRank(f.rep || 0) > 0);
  if (fac.length) sec.push(`<h3>Ehren der Häuser</h3><ul class="mods">${fac.map(([id, f]) => { const r = repRank(f.rep || 0); return `<li><b style="color:${FACTIONS[id].color}">${facIcon(id)} ${esc(FACTIONS[id].short)} (${esc(REP_RANKS[r].name)}):</b> ${FACTIONS[id].bonus.slice(0, r).map(modText).map(esc).join(', ')}</li>`; }).join('')}</ul>`);
  return sec.length ? `<div class="panel effects">${sec.join('')}</div>` : '<p class="muted center">Noch keine besonderen Effekte. Segen erhältst du beim Stufenaufstieg.</p>';
}
