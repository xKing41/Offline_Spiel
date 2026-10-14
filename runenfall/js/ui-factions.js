// Oberflächen für die drei Häuser (Ruf, Boni, Aufträge, Händler) und die Sage.
import { app } from './app.js';
import { on, screen, modal, closeModal, toast, topbar, bar } from './ui.js';
import { esc, fmt } from './util.js';
import { save, persist, checkAchievements } from './save.js';
import { modText } from './data/stats.js';
import { FACTIONS, FACTION_IDS, REP_RANKS, repRank, repProgress, OFFERS, STORY, facIcon } from './data/factions.js';
import { factionState, ensureContracts, contractText, rerollContract, buyOffer, newChapters } from './run.js';
import { sfx, buzz } from './audio.js';

let tab = 'glut';
const unlocked = () => save.stats.runs >= 1;

// ===================================================================== Häuser
export function showFactions() {
  ensureContracts();
  persist();
  const tabs = FACTION_IDS.map((id) => `<button class="${tab === id ? 'on' : ''}" data-a="facTab" data-f="${id}" style="--fc:${FACTIONS[id].color}"><span class="fi">${facIcon(id)}</span>${esc(FACTIONS[id].short)}<small>${esc(REP_RANKS[repRank(factionState(id).rep)].name)}</small></button>`).join('');
  const F = FACTIONS[tab], st = factionState(tab), pr = repProgress(st.rep);
  const bonus = F.bonus.map((m, i) => `<li class="${i < pr.r ? 'on' : ''}"><b>${esc(REP_RANKS[i + 1].name)}</b> ${esc(modText(m))}</li>`).join('');
  const c = st.contract;
  const offers = OFFERS[tab].map((o) => {
    const lock = pr.r < o.rank, poor = st.favor < o.cost;
    return `<div class="offer ${lock ? 'locked' : ''}"><div><b>${esc(o.name)}</b><small>${esc(o.desc)}</small>${lock ? `<small class="muted">🔒 ab „${esc(REP_RANKS[o.rank].name)}“</small>` : ''}</div>
      <button class="btn small ${lock || poor ? 'disabled' : 'primary'}" data-a="facBuy" data-o="${o.id}">◈ ${o.cost}</button></div>`;
  }).join('');
  const gifts = (save.gifts || []).length ? `<div class="panel"><h3>Gaben für den nächsten Run</h3><ul class="mods">${save.gifts.map((g) => `<li>${FACTIONS[g.fid] ? facIcon(g.fid) : '✦'} ${esc(g.name)}</li>`).join('')}</ul></div>` : '';
  screen(`${topbar('Die Häuser', 'hub', `<b class="favor" style="color:${F.color}">◈ ${fmt(st.favor)}</b>`)}<div class="pad">
    <div class="seg factabs">${tabs}</div>
    <div class="panel fachead" style="--fc:${F.color}"><div class="row"><span class="fbig">${facIcon(tab)}</span><div><h3>${esc(F.name)}</h3><small class="muted">${esc(F.leader)}</small></div></div>
      <p class="motto">„${esc(F.motto)}“</p><p class="small">${esc(F.desc)}</p>
      <div class="row between"><b>${esc(REP_RANKS[pr.r].name)}</b><small class="muted">${pr.max ? 'Höchste Stufe' : `Ruf ${fmt(st.rep)} / ${fmt(REP_RANKS[pr.r + 1].need)}`}</small></div>
      ${bar(pr.cur, pr.need, 'rep')}
      <p class="small muted">Ruf gibt es für Aufträge, Begegnungen im Run und für Taten, die das Haus schätzt. Jeder Ruf-Zuwachs bringt dieselbe Menge Gunst (◈) für den Händler.</p></div>
    <div class="panel"><h3>Ehren des Hauses</h3><ul class="facbonus">${bonus}</ul><p class="small muted">Gilt dauerhaft in jedem Run.</p></div>
    <div class="panel"><div class="row between"><h3>Auftrag</h3><button class="icon small" data-a="facReroll" title="Austauschen (1× täglich)">↻</button></div>
      ${c ? `<div class="quest"><span>${facIcon(tab)}</span><div><b>${esc(contractText(tab, c))}</b><small>+${c.rep} Ruf & Gunst</small></div></div>` : '<p class="muted small">Kein Auftrag.</p>'}
      <p class="small muted">Wird am Ende eines Runs geprüft – egal in welchem Modus.</p></div>
    <div class="panel"><h3>Händler des Hauses</h3><div class="offers">${offers}</div></div>
    ${gifts}
  </div>`);
}
on('facTab', (d) => { tab = d.f; showFactions(); });
on('facReroll', () => {
  if (!rerollContract(tab)) { toast('Heute schon ausgetauscht – morgen wieder.'); return; }
  persist(); sfx.click(); showFactions();
});
on('facBuy', (d) => {
  const st = factionState(tab), o = OFFERS[tab].find((x) => x.id === d.o);
  if (repRank(st.rep) < o.rank) { sfx.deny(); toast(`Benötigt den Rang „${REP_RANKS[o.rank].name}“.`); return; }
  if (st.favor < o.cost) { sfx.deny(); toast('Nicht genug Gunst.'); return; }
  const msg = buyOffer(tab, o.id);
  if (!msg) { sfx.deny(); return; }
  checkAchievements();
  persist();
  sfx.loot(); buzz(40);
  toast(esc(msg));
  const y = document.getElementById('ui').scrollTop; showFactions(); document.getElementById('ui').scrollTop = y;
});

// ===================================================================== Sage
export function showStory() {
  save.story = save.story || { seen: [] };
  const open = STORY.filter((c) => c.when(save));
  const rows = STORY.map((c, i) => {
    const ok = open.includes(c);
    const fresh = ok && !save.story.seen.includes(c.id);
    return ok ? `<div class="panel chapter ${fresh ? 'fresh' : ''}"><h3><small>Kapitel ${i + 1}</small>${esc(c.title)}</h3><p>${esc(c.text)}</p></div>`
      : `<div class="panel chapter locked"><h3><small>Kapitel ${i + 1}</small>???</h3><p class="small muted">${esc(c.hint)}</p></div>`;
  }).join('');
  for (const c of open) if (!save.story.seen.includes(c.id)) save.story.seen.push(c.id);
  persist();
  screen(`${topbar('Die Sage', 'hub', `<small>${open.length}/${STORY.length}</small>`)}<div class="pad story">${rows}</div>`);
}
/** Hinweis auf neue Kapitel in der Sternwarte. */
export function storyPanel() {
  const fresh = newChapters();
  if (!fresh.length) return '';
  const c = fresh[0];
  return `<button class="storynew" data-a="storyRead" data-id="${c.id}"><span>📜</span><div><b>Neues Kapitel der Sage</b><small>${esc(c.title)}${fresh.length > 1 ? ` und ${fresh.length - 1} weitere` : ''}</small></div><em>Lesen</em></button>`;
}
on('storyRead', (d) => {
  const c = STORY.find((x) => x.id === d.id);
  if (!c) return;
  save.story.seen.push(c.id);
  persist();
  modal(`<h2 class="evt">📜 ${esc(c.title)}</h2><p class="storytext">${esc(c.text)}</p><button class="btn primary" data-a="storyClose">Weiter</button>`, 'event');
});
on('storyClose', () => { closeModal(); app.nav('hub'); });

// ===================================================================== Kacheln, Vorbereitung, Zusammenfassung
export function factionTiles() {
  if (!unlocked()) return '';
  ensureContracts();
  const best = FACTION_IDS.map((id) => repRank(factionState(id).rep)).reduce((a, b) => a + b, 0);
  const canBuy = FACTION_IDS.some((id) => { const st = factionState(id); return OFFERS[id].some((o) => o.rank <= repRank(st.rep) && o.cost <= st.favor); });
  const fresh = newChapters().length;
  const open = STORY.filter((c) => c.when(save)).length;
  return `<button class="tile" data-a="nav" data-to="factions"><span class="ti">⚜</span>Die Häuser${canBuy ? '<i class="dot"></i>' : ''}<small>${best}/15 Ruf-Stufen</small></button>
    <button class="tile" data-a="nav" data-to="story"><span class="ti">📜</span>Die Sage${fresh ? '<i class="dot"></i>' : ''}<small>${open}/${STORY.length} Kapitel</small></button>`;
}
export function giftsPanel() {
  const g = save.gifts || [];
  if (!g.length) return '';
  return `<div class="panel gifts"><h3>Gaben der Häuser</h3><p class="small">${g.map((x) => `${FACTIONS[x.fid] ? facIcon(x.fid) : '✦'} ${esc(x.name)}`).join(' · ')}</p><p class="small muted">Gelten für diesen Run.</p></div>`;
}
export function factionSummary(res) {
  const f = res.faction;
  if (!f || (!f.lines.length && !f.done.length)) return '';
  const done = f.done.map((x) => `<div class="ach done"><span class="ai">${facIcon(x.fid)}</span><div><b>${esc(x.text)}</b><small>Auftrag erfüllt · +${x.rep} Ruf</small></div></div>`).join('');
  const lines = f.lines.map((x) => `<div class="srow"><span style="color:${FACTIONS[x.fid].color}">${facIcon(x.fid)} ${esc(FACTIONS[x.fid].name)}</span><b class="up">+${x.v} Ruf${x.up !== null && x.up !== undefined ? ` · ${esc(REP_RANKS[x.up].name)}!` : ''}</b></div>`).join('');
  return `<h3>Die Häuser</h3>${done}<div class="panel">${lines}</div>`;
}
