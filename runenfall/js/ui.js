// Gemeinsame UI-Bausteine: Bildschirme, Overlays, Karten für Gegenstände/Glyphen/Fertigkeiten.
import { esc, fmt, fmtV } from './util.js';
import { SKILLS, SUPPORTS, catTags } from './data/skills.js';
import { TAG_NAME, ELEM, modText } from './data/stats.js';
import { BASES, RARITY, SLOT_NAME, UNIQUES, itemName, itemMods, affixLine, uniqueMods } from './data/items.js';
import { SETS, JEWEL_SPECIALS } from './data/endgame.js';
import { MYTHIC_EFFECTS } from './data/systems.js';
import { sfx, unlockAudio } from './audio.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------- Aktionen per data-a="name" (Ereignis-Delegation) ----------
const actions = new Map();
export const on = (name, fn) => actions.set(name, fn);
document.addEventListener('click', (e) => {
  unlockAudio();
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled || el.classList.contains('disabled')) return;
  const fn = actions.get(el.dataset.a);
  if (!fn) return;
  e.preventDefault();
  e.stopPropagation();
  if (!el.dataset.silent) sfx.click();
  fn(el.dataset, el, e);
});

// ---------- Bildschirme ----------
export function screen(html, cls = '') {
  const ui = $('#ui');
  ui.className = 'show ' + cls;
  ui.innerHTML = html;
  ui.scrollTop = 0;
}
export function hideScreen() { const ui = $('#ui'); ui.className = ''; ui.innerHTML = ''; }

export function modal(html, cls = '') {
  const m = $('#modal');
  m.className = 'show ' + cls;
  m.innerHTML = `<div class="mbox">${html}</div>`;
  m.scrollTop = 0;
}
export function closeModal() { const m = $('#modal'); m.className = ''; m.innerHTML = ''; }
export const modalOpen = () => $('#modal').classList.contains('show');

let toastT = null;
export function toast(msg, kind = '') {
  const t = $('#toast');
  t.innerHTML = msg;
  t.className = 'show ' + kind;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.className = ''; }, 2400);
}

export function confirmBox(text, yesLabel, onYes) {
  on('_confirmYes', () => { closeModal(); onYes(); });
  modal(`<p class="center">${text}</p><div class="row"><button class="btn" data-a="_close">Abbrechen</button><button class="btn danger" data-a="_confirmYes">${yesLabel}</button></div>`);
}
on('_close', () => closeModal());

// ---------- Kopfzeile mit Zurück ----------
export const topbar = (title, back = 'hub', extra = '') =>
  `<div class="topbar"><button class="icon" data-a="nav" data-to="${back}">‹</button><h2>${title}</h2><div class="tb-extra">${extra}</div></div>`;

// ---------- Gegenstände ----------
export const rarityColor = (r) => (RARITY[r] || RARITY.normal).color;

export function itemTitle(item) {
  return `<b style="color:${rarityColor(item.rarity)}">${esc(itemName(item))}${item.uqLvl ? ` <span class="uqlvl">${'★'.repeat(item.uqLvl)}</span>` : ''}</b>`;
}

export function itemCard(item, { compare = null, actions = '', small = false, affixAction = null, lockIdx = -1 } = {}) {
  if (!item) return '';
  const base = BASES[item.base];
  const col = rarityColor(item.rarity);
  const lines = [];
  if (item.rarity === 'unique') {
    for (const m of uniqueMods(item)) lines.push(`<li class="u">${esc(modText(m))}</li>`);
  } else if (item.rarity === 'set') {
    const st = SETS[item.set];
    for (const m of st.pieces[item.piece].mods) lines.push(`<li class="u">${esc(modText(m))}</li>`);
    lines.push('<li class="sep"></li>');
    lines.push(`<li class="setb"><b>${esc(st.name)}</b> (${st.pieces.map((p) => esc(p.name)).join(', ')})</li>`);
    for (const [n, mods] of Object.entries(st.bonus)) lines.push(`<li class="setb">${n} Teile: ${mods.map((m) => esc(modText(m))).join(', ')}</li>`);
  } else {
    for (const m of base.imp || []) lines.push(`<li class="imp">${esc(modText(m))}</li>`);
    if (base.imp && base.imp.length && item.affixes.length) lines.push('<li class="sep"></li>');
    item.affixes.forEach((af, i) => {
      const l = affixLine(item, af);
      const act = affixAction ? ` data-a="${affixAction}" data-i="${i}"` : '';
      lines.push(`<li class="${affixAction ? 'pick' : ''} ${lockIdx === i ? 'locked' : ''}"${act}>${lockIdx === i ? '🔒 ' : ''}${esc(l.text)} <span class="tier">S${l.tier}</span></li>`);
    });
    if (item.rarity === 'mythic' && item.effects) {
      for (const e of item.effects) {
        const fx = MYTHIC_EFFECTS[e];
        lines.push(`<li class="myth">✦ ${esc(fx.name)}: ${fx.mods.map((m) => esc(modText(m))).join(', ')}</li>`);
      }
    }
    if (item.slot === 'jewel' && item.special !== null && item.special !== undefined) {
      for (const m of JEWEL_SPECIALS[item.special]) lines.push(`<li class="u">✦ ${esc(modText(m))}</li>`);
    }
  }
  if (item.cmods && item.cmods.length) { lines.push('<li class="sep"></li>'); for (const m of item.cmods) lines.push(`<li class="corr">⛧ ${esc(modText(m))}</li>`); }
  if (item.corrupt) lines.push('<li class="corrtag">Korrumpiert</li>');
  const sub = item.slot === 'relic' ? `Relikt · Stufe ${item.ilvl}` : item.slot === 'jewel' ? `Juwel · Stufe ${item.ilvl}` : `${SLOT_NAME[base.slot]} · ${base.name}${item.rarity === 'set' ? '' : ` · Gst. ${item.ilvl}`}`;
  const flavor = item.rarity === 'unique' ? `<p class="flavor">${esc(UNIQUES[item.uq].flavor)}</p>` : '';
  let cmp = '';
  if (compare !== null) cmp = compareHtml(item, compare);
  return `<div class="icard ${small ? 'small' : ''}" style="--rc:${col}">
    <div class="ih"><div>${itemTitle(item)}<small>${RARITY[item.rarity].name} · ${sub}</small></div></div>
    <ul class="mods">${lines.join('') || '<li class="muted">Keine Eigenschaften</li>'}</ul>${flavor}${cmp}
    ${actions ? `<div class="iact">${actions}</div>` : ''}</div>`;
}

/** Vergleich: summiert gleiche Werte und zeigt die Differenz. */
function compareHtml(item, other) {
  const sum = (mods) => {
    const m = new Map();
    for (const x of mods) {
      const k = x.s + '|' + (x.t || 'flat');
      m.set(k, { ...x, v: (m.get(k)?.v || 0) + x.v });
    }
    return m;
  };
  const a = sum(itemMods(item)), b = sum(other ? itemMods(other) : []);
  const keys = new Set([...a.keys(), ...b.keys()]);
  const rows = [];
  for (const k of keys) {
    const va = a.get(k)?.v || 0, vb = b.get(k)?.v || 0;
    const d = Math.round((va - vb) * 10) / 10;
    if (!d) continue;
    const proto = a.get(k) || b.get(k);
    rows.push(`<li class="${d > 0 ? 'up' : 'down'}">${esc(modText({ ...proto, v: d }))}</li>`);
  }
  if (!rows.length) return '<p class="muted small">Gleichwertig zum Ausgerüsteten</p>';
  return `<div class="cmp"><small>Gegenüber ${other ? 'ausgerüstet' : 'leerem Platz'}:</small><ul>${rows.join('')}</ul></div>`;
}

// ---------- Glyphen & Fertigkeiten ----------
export function tagChips(tags) {
  return tags.map((t) => `<span class="chip t-${t}">${TAG_NAME[t] || t}</span>`).join('');
}

export function glyphCard(id, actions = '', fits = null) {
  const g = SUPPORTS[id];
  const req = g.req.length ? `Für: ${g.req.map((t) => TAG_NAME[t]).join(' / ')}` : 'Passt zu allen Fertigkeiten';
  return `<div class="gcard ${fits === false ? 'nofit' : ''}">
    <div class="gh"><span class="gem">◆</span><b>${esc(g.name)}</b></div>
    <small class="muted">${req}</small>
    <ul class="mods">${g.mods.map((m) => `<li>${esc(modText(m))}</li>`).join('')}</ul>
    ${actions ? `<div class="iact">${actions}</div>` : ''}</div>`;
}

export function skillInfo(id, lvl = 1) {
  const d = SKILLS[id];
  const dmg = d.dmg ? Object.entries(d.dmg).map(([t, [a, b]]) => `<span style="color:${ELEM[t].color}">${a}–${b} ${ELEM[t].name}</span>`).join(', ')
    : Object.entries(d.dps).map(([t, v]) => `<span style="color:${ELEM[t].color}">${v} ${ELEM[t].name}/s</span>`).join(', ');
  const extra = [];
  if (d.lvl3) extra.push(`Ab Stufe 3: ${d.lvl3.map(modText).join(', ')}`);
  if (d.lvl5) extra.push(`Ab Stufe 5: ${d.lvl5.map(modText).join(', ')}`);
  return `<div class="skinfo"><div class="tags">${tagChips(catTags(d))}</div>
    <p>${esc(d.desc)}</p><p class="small">Grundschaden: ${dmg} · Intervall ${fmtV(d.cd)} s${d.crit ? ` · Krit ${d.crit}%` : ''}</p>
    ${extra.map((x) => `<p class="small muted">${esc(x)}</p>`).join('')}</div>`;
}

/** Kleine Kennzahlen-Zeile für eine berechnete Fertigkeit. */
export function skillStatsLine(S) {
  const parts = [`<b class="dps">${fmt(S.dps)}</b> Schaden/s`];
  if (!S.isDot) parts.push(`Treffer Ø ${fmt(S.avgHit)}`);
  if (!S.noCrit && !S.isDot) parts.push(S.nthCrit ? `jeder ${S.nthCrit}. kritisch` : `Krit ${fmtV(S.crit)}% ×${fmtV(S.critMulti / 100)}`);
  parts.push(`alle ${fmtV(S.interval)} s`);
  if (S.count > 1 && (S.def.tags.includes('proj') || S.def.beh === 'orbit' || S.def.beh === 'meteor')) parts.push(`${S.count} Geschosse`);
  if (S.pierce) parts.push(`durchbohrt ${S.pierce}`);
  if (S.chain) parts.push(`Kette ${S.chain}`);
  if (S.minions) parts.push(`${S.minions} Begleiter`);
  if (S.area) parts.push(`Radius ${Math.round(S.area)}`);
  if (S.dur) parts.push(`Dauer ${fmtV(S.dur)} s`);
  const ail = [];
  if (S.ign) ail.push(`Entzünden ${Math.round(S.ign)}%`);
  if (S.frz) ail.push(`Einfrieren ${Math.round(S.frz)}%`);
  if (S.shk) ail.push(`Schock ${Math.round(S.shk)}%`);
  if (S.psn) ail.push(`Gift ${Math.round(S.psn)}%`);
  if (S.bld) ail.push(`Blutung ${Math.round(S.bld)}%`);
  if (S.echo) ail.push('Echo');
  const dmgTypes = Object.entries(S.dmg).map(([t, [a, b]]) => `<span style="color:${ELEM[t].color}">${fmt(a)}–${fmt(b)}</span>`).join(' ');
  return `<div class="sline">${parts.join(' · ')}</div><div class="sline small">${dmgTypes}${ail.length ? ' · ' + ail.join(' · ') : ''}</div>`;
}

export function bar(cur, max, cls = '') {
  const p = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  return `<div class="bar ${cls}"><i style="width:${p}%"></i><span>${fmt(Math.max(0, cur))} / ${fmt(max)}</span></div>`;
}
