// Kompendium: durchsuchbares Lexikon mit Kategorien, Artikeln, Listen aus den Spieldaten und „?“-Hilfe an Ort und Stelle.
import { app } from './app.js';
import { $, on, screen, modal, closeModal, topbar } from './ui.js';
export { helpBtn } from './ui.js';
import { esc, fmt } from './util.js';
import { save } from './save.js';
import { COMP_CATS, ARTICLES, MECH_TEXT, ELITE_TEXT, PATTERN_TEXT, NODE_TEXT, HUNT_TEXT } from './data/compendium.js';
import { CLASSES, ENEMIES, BIOMES, ELITE_AFFIXES, ASC_MODS, MUTATORS, BOON_RARITY, ALTAR } from './data/content.js';
import { SKILLS } from './data/skills.js';
import { KEYSTONES } from './data/tree.js';
import { RARITY } from './data/items.js';
import { ELEM, modText } from './data/stats.js';
import { FACTIONS, FACTION_IDS, REP_RANKS, facIcon } from './data/factions.js';
import { TOWER_LAWS, lawName, lawDesc, HUNT_TILES } from './data/modes.js';
import { NODE_TYPES } from './run.js';

const byId = Object.fromEntries(ARTICLES.map((a) => [a.id, a]));
/** Absatz formatieren: **fett**, Zeilen bleiben Zeilen. */
const para = (t) => `<p>${esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>`;
const row = (left, right, color) => `<div class="cmrow"><b${color ? ` style="color:${color}"` : ''}>${left}</b><span>${right}</span></div>`;

// Listen, die immer aus den aktuellen Spieldaten entstehen
const LISTS = {
  boonRarity: () => BOON_RARITY.map((r) => row(esc(r.name), `Wirkung ×${String(r.mult).replace('.', ',')} · ${r.w}% Grundchance`, r.color)).join(''),
  rarities: () => [['normal', 'keine Affixe'], ['magic', '1–2 Affixe'], ['rare', '3–5 Affixe, eigener Name'], ['unique', 'feste, besondere Effekte'], ['set', 'Set-Boni ab 2 und 4 Teilen'], ['mythic', 'maximale Affixe + 1–2 Spezialeffekte']]
    .map(([k, t]) => row(esc(RARITY[k].name), t, RARITY[k].color)).join(''),
  keystones: () => Object.values(KEYSTONES).map((k) => row(esc(k.name), `${esc(k.desc)} <small>${k.mods.map(modText).map(esc).join(', ')}</small>`, '#ffd84d')).join(''),
  altar: () => ALTAR.map((a) => row(esc(a.name), `${esc(a.desc)} <small>(max. ${a.max})</small>`)).join(''),
  classes: () => Object.values(CLASSES).map((c) => row(`${c.glyph} ${esc(c.name)}`, `${esc(c.desc)} <small>Start: ${esc(SKILLS[c.start].name)}${c.unlock ? ` · ✦ ${fmt(c.unlock)}` : ''}</small>`, c.color)).join(''),
  ascMods: () => ASC_MODS.map((m) => row(`Höhe ${m.lvl}`, esc(m.text))).join(''),
  mutators: () => Object.values(MUTATORS).map((m) => row(esc(m.name), `${esc(m.desc)} <small>+${m.reward}% Staub</small>`)).join(''),
  towerLaws: () => TOWER_LAWS.map((l) => row(esc(lawName(l)), esc(lawDesc(l)))).join(''),
  huntTiles: () => Object.entries(HUNT_TILES).map(([k, t]) => row(`<span style="color:${t.col}">${t.icon}</span> ${esc(t.name)}`, esc(HUNT_TEXT[k] || ''))).join(''),
  nodeTypes: () => Object.entries(NODE_TYPES).map(([k, t]) => row(`${t.icon} ${esc(t.name)}`, esc(NODE_TEXT[k] || ''))).join(''),
  eliteAffixes: () => Object.entries(ELITE_AFFIXES).map(([k, a]) => row(esc(a.name), esc(ELITE_TEXT[k] || ''))).join(''),
  bossPatterns: () => Object.values(PATTERN_TEXT).map(([n, t]) => row(esc(n), esc(t))).join(''),
  factions: () => FACTION_IDS.map((id) => {
    const F = FACTIONS[id];
    return `<div class="cmfac"><b style="color:${F.color}">${facIcon(id)} ${esc(F.name)}</b><small class="muted">${esc(F.leader)} · „${esc(F.motto)}“</small>
      ${F.bonus.map((m, i) => row(esc(REP_RANKS[i + 1].name), `${esc(modText(m))} <small>ab ${fmt(REP_RANKS[i + 1].need)} Ruf</small>`)).join('')}</div>`;
  }).join(''),
  colors: () => Object.values(RARITY).map((r) => row(esc(r.name), 'Seltenheit', r.color)).join('') + Object.values(ELEM).map((e) => row(esc(e.name), 'Schadensart', e.color)).join(''),
  enemies: () => {
    const kills = save.stats.enemyKills || {};
    const seen = new Set();
    let html = '', hidden = 0;
    for (const [bid, b] of Object.entries(BIOMES)) {
      const rows = [];
      for (const [eid] of b.pool) {
        if (seen.has(eid)) continue;
        seen.add(eid);
        const e = ENEMIES[eid];
        if (!e || e.noDex) continue;
        if (!kills[eid]) { hidden++; continue; }
        const mech = Object.keys(MECH_TEXT).filter((k) => e[k]).map((k) => MECH_TEXT[k]);
        rows.push(row(`<span style="color:${e.color}">●</span> ${esc(e.name)}`, mech.length ? esc(mech.join(' · ')) : 'läuft auf dich zu'));
      }
      if (rows.length) html += `<h4>${esc(b.name)}</h4>${rows.join('')}`;
    }
    return (html || '<p class="muted small">Noch keine Gegner besiegt.</p>') + (hidden ? `<p class="muted small">${hidden} weitere Gegnerarten noch unentdeckt.</p>` : '');
  },
};

function articleHtml(a, inModal) {
  const list = a.list && LISTS[a.list] ? `<div class="cmlist">${LISTS[a.list]()}</div>` : '';
  const see = (a.see || []).filter((id) => byId[id]).map((id) => `<button class="chip" data-a="${inModal ? 'helpGo' : 'compOpen'}" data-id="${id}">${esc(byId[id].title)}</button>`).join('');
  return `<div class="article"><small class="muted">${esc(COMP_CATS.find((c) => c[0] === a.cat)[1])}</small><h2>${esc(a.title)}</h2>${a.text.map(para).join('')}${list}
    ${see ? `<div class="seealso"><small class="muted">Siehe auch</small><div class="chips">${see}</div></div>` : ''}</div>`;
}

// ===================================================================== Bildschirm
let current = null, query = '', back = 'hub';
export function showCompendium(id = null) {
  if (id) current = id;
  const a = current && byId[current];
  if (a) {
    screen(`<div class="topbar"><button class="icon" data-a="compList">‹</button><h2>Kompendium</h2><div class="tb-extra"></div></div><div class="pad">${articleHtml(a, false)}</div>`);
    return;
  }
  const q = query.trim().toLowerCase();
  const hits = q ? ARTICLES.filter((x) => (x.title + ' ' + x.text.join(' ')).toLowerCase().includes(q)) : null;
  const groups = hits ? `<div class="panel">${hits.length ? hits.map(linkRow).join('') : '<p class="muted small">Nichts gefunden.</p>'}</div>`
    : COMP_CATS.map(([cid, name, icon]) => `<div class="panel"><h3>${icon} ${esc(name)}</h3>${ARTICLES.filter((x) => x.cat === cid).map(linkRow).join('')}</div>`).join('');
  screen(`${topbar('Kompendium', back, `<small>${ARTICLES.length} Artikel</small>`)}<div class="pad">
    <input id="compQ" type="search" placeholder="Suchen (z. B. Gift, Rüstung, Turm) …" autocomplete="off" enterkeyhint="search" value="${esc(query)}">
    ${groups}</div>`);
  const inp = $('#compQ');
  inp.addEventListener('input', () => { query = inp.value; const pos = inp.selectionStart; showCompendium(); const n = $('#compQ'); n.focus(); n.setSelectionRange(pos, pos); });
}
const linkRow = (x) => `<button class="cmlink" data-a="compOpen" data-id="${x.id}"><span>${esc(x.title)}</span><i>›</i></button>`;
on('compOpen', (d) => { current = d.id; showCompendium(); document.getElementById('ui').scrollTop = 0; });
// Zurück aus einem Artikel zur Liste (eigene Aktion, damit „nav“ unberührt bleibt)
on('compList', () => { current = null; showCompendium(); });
app.openCompendium = (id = null, from = 'hub') => { back = from; current = id; app.nav('compendium'); };

// ===================================================================== „?“-Hilfe an Ort und Stelle
on('help', (d) => openHelp(d.id));
on('helpGo', (d) => openHelp(d.id, helpBack));
let helpBack = '_close';
/** Artikel als Fenster (auch mitten im Run). back: Aktion des Schließen-Knopfs. */
export function openHelp(id, back = '_close') {
  const a = byId[id];
  if (!a) return;
  helpBack = back;
  modal(`${articleHtml(a, true)}<button class="btn" data-a="${back}">${back === '_close' ? 'Schließen' : 'Zurück'}</button>`, 'helpmodal');
}
// Hilfe aus dem Pausemenü: Auswahl wichtiger Artikel, danach zurück in die Pause
const PAUSE_HELP = ['controls', 'hud', 'ailments', 'elites', 'enemies', 'bosses', 'hazards', 'evasion', 'playerres', 'analysis'];
on('pHelp', () => modal(`<h2>📖 Hilfe</h2><div class="col">${PAUSE_HELP.map((id) => `<button class="cmlink" data-a="pHelpOpen" data-id="${id}"><span>${esc(byId[id].title)}</span><i>›</i></button>`).join('')}</div>
  <button class="btn" data-a="pHelpBack">Zurück zur Pause</button>`, 'helpmodal'));
on('pHelpOpen', (d) => openHelp(d.id, 'pHelp'));
on('pHelpBack', () => app.pauseMenu());
export const compArticle = (id) => byId[id];
