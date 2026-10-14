// Endgame-Bildschirme: Sternenatlas, Gefährten, Juwelen, Sternenmacht.
import { app } from './app.js';
import { $, on, screen, modal, closeModal, toast, confirmBox, topbar, itemCard } from './ui.js';
import { esc, fmt } from './util.js';
import { save, persist, accountLevel, paragonFree, checkAchievements } from './save.js';
import { BIOMES, BOSSES, MUTATORS, CLASSES } from './data/content.js';
import { RARITY } from './data/items.js';
import { modText } from './data/stats.js';
import {
  getAtlas, ATLAS_COLS, ATLAS_ROWS, ATLAS_PASSIVES, atlasPower, PETS, PET_IDS, PET_MAX, PET_EGG_COST, PARAGON, paragonPoints,
} from './data/endgame.js';
import { atlasUnlocked, hatchEgg } from './run.js';
import { getTree } from './data/tree.js';
import { sfx } from './audio.js';

// ===================================================================== Sternenatlas
let atlasSel = null;
let atlasTab = 'map';
export function showAtlas() {
  const A = getAtlas();
  save.atlas = save.atlas || { done: {}, points: 0, passives: {}, target: null };
  const done = save.atlas.done;
  const unlockedAny = Object.keys(save.stats.wins).length > 0;
  const spent = Object.keys(save.atlas.passives).reduce((s, k) => s + (ATLAS_PASSIVES.find((p) => p.id === k)?.cost || 0), 0);
  const free = (save.atlas.points || 0) - spent;
  const tabs = `<div class="seg"><button class="${atlasTab === 'map' ? 'on' : ''}" data-a="atTab" data-t="map">Karte</button><button class="${atlasTab === 'pass' ? 'on' : ''}" data-a="atTab" data-t="pass">Kenntnisse${free > 0 ? ` (${free})` : ''}</button></div>`;
  let body = '';
  if (!unlockedAny) {
    body = '<p class="note">Der Sternenatlas öffnet sich, sobald du einen Feldzug gewonnen hast.</p>';
  }
  if (atlasTab === 'map') {
    let grid = '';
    for (let r = 0; r < ATLAS_ROWS; r++) {
      for (let c = 0; c < ATLAS_COLS; c++) {
        const reg = A.regions[`r${c}_${r}`];
        const isDone = done[reg.id] !== undefined;
        const open = unlockedAny && atlasUnlocked(reg.id);
        const tgt = save.atlas.target === reg.id;
        grid += `<button class="areg ${isDone ? 'done' : ''} ${open ? 'open' : 'locked'} ${reg.pinnacle ? 'pin' : ''} ${tgt ? 'tgt' : ''} ${atlasSel === reg.id ? 'sel' : ''}"
          style="--bc:${BIOMES[reg.biome].floor}" data-a="atSel" data-id="${reg.id}">
          <b>${reg.pinnacle ? '♛' : reg.tier}</b><small>${isDone ? '✓' : open ? '' : '🔒'}</small></button>`;
      }
    }
    const reg = atlasSel ? A.regions[atlasSel] : null;
    let detail = '<p class="muted small center">Wähle eine Region. Ein Ziel wird nach dem Sieg über Akt III zu <b>Akt IV</b> deines Runs.</p>';
    if (reg) {
      const open = unlockedAny && atlasUnlocked(reg.id);
      const tgt = save.atlas.target === reg.id;
      detail = `<div class="panel"><h3>${reg.pinnacle ? '♛ ' : ''}${esc(reg.name)}</h3>
        <p class="small">Stufe <b>${reg.tier}</b> · Gegnerstärke ×${fmt(atlasPower(reg.tier))} · Boss: <b>${esc(BOSSES[reg.boss].name)}</b></p>
        <p class="small muted">Gebiet: ${esc(BIOMES[reg.biome].name)}</p>
        <ul class="mods">${reg.mods.map((m) => `<li>✧ ${esc(MUTATORS[m].name)} – ${esc(MUTATORS[m].desc)}</li>`).join('')}</ul>
        ${done[reg.id] !== undefined ? `<p class="up small">Abgeschlossen (beste Stufe ${done[reg.id]})</p>` : ''}
        <div class="row">${open ? `<button class="btn small ${tgt ? '' : 'primary'}" data-a="atTarget" data-id="${reg.id}">${tgt ? 'Ziel entfernen' : 'Als Ziel wählen'}</button>` : '<small class="muted">Schließe eine benachbarte Region ab, um sie freizuschalten.</small>'}</div></div>`;
    }
    const tgtReg = save.atlas.target ? A.regions[save.atlas.target] : null;
    body += `<p class="small center">${tgtReg ? `Aktuelles Ziel: <b>${esc(tgtReg.name)}</b> (Stufe ${tgtReg.tier})` : 'Kein Ziel gewählt – der Feldzug endet nach Akt III.'}</p>
      <div class="atlas">${grid}</div>${detail}`;
  } else {
    body += `<p class="small center">Freie Atlaspunkte: <b class="gold">${free}</b> · Punkte gibt es für jede neu abgeschlossene Region.</p>` +
      ATLAS_PASSIVES.map((p) => {
        const on = !!save.atlas.passives[p.id];
        return `<div class="panel row between"><div><b>${esc(p.name)}</b><p class="small">${esc(p.desc)}</p></div>
          <button class="btn small ${on ? '' : free >= p.cost ? 'primary' : 'disabled'}" data-a="atPass" data-id="${p.id}">${on ? '✓ Aktiv' : `${p.cost} Pkt.`}</button></div>`;
      }).join('') + '<p class="muted small center">Aktive Kenntnisse können jederzeit kostenlos zurückgenommen werden.</p>';
  }
  screen(`${topbar('Sternenatlas', 'hub', `<small>${Object.keys(done).length}/${Object.keys(A.regions).length}</small>`)}<div class="pad">${tabs}${body}</div>`);
}
on('atTab', (d) => { atlasTab = d.t; showAtlas(); });
on('atSel', (d) => { atlasSel = d.id; showAtlas(); });
on('atTarget', (d) => { save.atlas.target = save.atlas.target === d.id ? null : d.id; persist(); showAtlas(); });
on('atPass', (d) => {
  const p = ATLAS_PASSIVES.find((x) => x.id === d.id);
  if (save.atlas.passives[p.id]) { delete save.atlas.passives[p.id]; }
  else {
    const spent = Object.keys(save.atlas.passives).reduce((s, k) => s + (ATLAS_PASSIVES.find((x) => x.id === k)?.cost || 0), 0);
    if ((save.atlas.points || 0) - spent < p.cost) { sfx.deny(); toast('Nicht genug Atlaspunkte.'); return; }
    save.atlas.passives[p.id] = 1;
    sfx.levelup();
  }
  persist(); showAtlas();
});

// ===================================================================== Gefährten
let petSel = null;
export function showPets() {
  save.pets = save.pets || {};
  const cards = PET_IDS.map((id) => {
    const p = PETS[id], own = save.pets[id];
    return `<button class="petc ${own ? '' : 'unk'} ${petSel === id ? 'sel' : ''}" style="--pc:${p.color}" data-a="petSel" data-id="${id}">
      <span>${own ? p.glyph : '?'}</span><b>${own ? esc(p.name) : '???'}</b><small>${own ? `Stufe ${own.lvl}/${PET_MAX}` : 'unbekannt'}</small></button>`;
  }).join('');
  let detail = '';
  if (petSel && save.pets[petSel]) {
    const p = PETS[petSel], lvl = save.pets[petSel].lvl;
    detail = `<div class="panel"><h3 style="color:${p.color}">${p.glyph} ${esc(p.name)} · Stufe ${lvl}</h3>
      <p class="small">${p.ranged ? 'Fernkampf' : 'Nahkampf'} · kämpft an deiner Seite (Begleiter-Fertigkeit, Stufe = Gefährtenstufe)</p>
      <h3>Passiver Bonus</h3><ul class="mods">${p.passive(lvl).map((m) => `<li>${esc(modText(m))}</li>`).join('')}</ul>
      ${lvl < PET_MAX ? `<p class="small muted">Auf Stufe ${PET_MAX}: ${p.passive(PET_MAX).map(modText).map(esc).join(', ')}</p>` : '<p class="up small">Höchststufe erreicht!</p>'}</div>`;
  }
  screen(`${topbar('Gefährten', 'hub', `<b class="dust">✦ ${fmt(save.dust)}</b>`)}<div class="pad">
    <p class="muted small center">Gefährten schlüpfen aus Eiern (Bosse, Ereignisse, Atlas). Doppelte Eier lassen deinen Gefährten aufsteigen. Wähle beim Run-Start, wer dich begleitet.</p>
    <div class="petgrid">${cards}</div>${detail}
    <button class="btn primary" data-a="buyEgg">🥚 Sternenei ausbrüten · ✦ ${fmt(PET_EGG_COST)}</button></div>`);
}
on('petSel', (d) => { petSel = d.id; showPets(); });
on('buyEgg', () => {
  if (save.dust < PET_EGG_COST) { sfx.deny(); toast(`Benötigt ✦ ${fmt(PET_EGG_COST)}`); return; }
  save.dust -= PET_EGG_COST;
  const h = hatchEgg();
  checkAchievements();
  persist();
  sfx.loot();
  petSel = h.id;
  toast(`${PETS[h.id].glyph} ${h.isNew ? 'Neuer Gefährte' : 'Stufenaufstieg'}: ${PETS[h.id].name}${h.isNew ? '' : ` (Stufe ${h.lvl})`}!`);
  showPets();
});

// ===================================================================== Juwelen (im Relikt-Bildschirm)
export function jewelsTab(sel) {
  const jewels = save.jewels || [];
  const used = new Map();
  for (const [cls, m] of Object.entries(save.jewelSock || {})) for (const [node, u] of Object.entries(m)) used.set(u, cls);
  const grid = [...jewels].sort((a, b) => b.affixes.length - a.affixes.length || b.ilvl - a.ilvl).map((j) =>
    `<button class="rinv ${used.has(j.uid) ? 'eq' : ''} ${sel === j.uid ? 'sel' : ''}" style="--rc:${RARITY[j.rarity].color}" data-a="jSel" data-u="${j.uid}">⬢</button>`).join('');
  const j = jewels.find((x) => x.uid === sel);
  let detail = '<p class="muted small center">Juwelen setzt du in Juwelsockel der Sternenkarte ein (sechseckige Sterne). Sie wirken nur, wenn der Sockel zugewiesen ist.</p>';
  if (j) {
    const cls = used.get(j.uid);
    detail = itemCard(j, { actions: `${cls ? `<small class="muted">Eingesetzt bei: ${esc(CLASSES[cls].name)}</small>` : ''}
      <button class="btn small danger" data-a="jSalv">Zerlegen (+✦ ${jewelSalvage(j)})</button>` });
  }
  return `<h3>Juwelen (${jewels.length}/60)</h3><div class="rgrid">${grid || '<p class="muted">Noch keine Juwelen. Eliten, Bosse und der Atlas lassen sie fallen.</p>'}</div>${detail}`;
}
export const jewelSalvage = (j) => Math.round(15 * j.affixes.reduce((s, a) => s + a.tier + 1, 0) * ({ magic: 1, rare: 1.4, legend: 2, mythic: 3 }[j.rarity] || 1));
on('jSalv', () => {
  const sel = app.jewelSel;
  const j = (save.jewels || []).find((x) => x.uid === sel);
  if (!j) return;
  if (save.run) { toast('Während eines Runs nicht möglich.'); return; }
  confirmBox('Juwel zerlegen?', 'Zerlegen', () => {
    save.dust += jewelSalvage(j);
    save.jewels = save.jewels.filter((x) => x.uid !== j.uid);
    for (const m of Object.values(save.jewelSock || {})) for (const [k, u] of Object.entries(m)) if (u === j.uid) delete m[k];
    app.jewelSel = null; persist(); app.nav('relics');
  });
});

/** Panel in der Sternenkarte für einen Juwelsockel. */
export function jewelSocketPanel(cls, node) {
  const sock = ((save.jewelSock || {})[cls] || {})[node.id];
  const j = sock ? (save.jewels || []).find((x) => x.uid === sock) : null;
  const allocated = (save.alloc[cls] || []).includes(node.id);
  return `${j ? itemCard(j, { small: true }) : '<p class="small muted">Leerer Sockel.</p>'}
    ${allocated ? '' : '<p class="small note">Weise den Sockel zu, damit das Juwel wirkt.</p>'}
    ${save.run ? '' : `<div class="row"><button class="btn small primary" data-a="jPick" data-n="${node.id}">${j ? 'Juwel wechseln' : 'Juwel einsetzen'}</button>${j ? `<button class="btn small" data-a="jOut" data-n="${node.id}">Entfernen</button>` : ''}</div>`}`;
}
on('jPick', (d) => {
  const cls = app.treeCls();
  const used = new Set(Object.values((save.jewelSock || {})[cls] || {}));
  const list = (save.jewels || []).filter((j) => !used.has(j.uid));
  if (!list.length) { toast('Keine freien Juwelen.'); return; }
  modal(`<h3>Juwel wählen</h3><div class="choices">${list.map((j) => `<button class="choice item" data-a="jPut" data-n="${d.n}" data-u="${j.uid}">${itemCard(j, { small: true })}</button>`).join('')}</div>
    <button class="btn ghost" data-a="_close">Abbrechen</button>`);
});
on('jPut', (d) => {
  const cls = app.treeCls();
  save.jewelSock = save.jewelSock || {};
  save.jewelSock[cls] = save.jewelSock[cls] || {};
  save.jewelSock[cls][d.n] = d.u;
  save.stats.jewelsSocketed = (save.stats.jewelsSocketed || 0) + 1;
  save.stats.maxJewels = Math.max(save.stats.maxJewels || 0, Object.keys(save.jewelSock[cls]).length);
  checkAchievements();
  persist(); closeModal(); sfx.loot();
  app.refreshTree();
});
on('jOut', (d) => {
  const cls = app.treeCls();
  if (save.jewelSock && save.jewelSock[cls]) delete save.jewelSock[cls][d.n];
  persist(); app.refreshTree();
});

// ===================================================================== Sternenmacht (im Altar)
export function paragonPanel() {
  const lvl = accountLevel().level;
  const total = paragonPoints(lvl), free = paragonFree();
  const rows = PARAGON.map((p) => {
    const n = (save.paragon || {})[p.id] || 0;
    return `<div class="prow"><div><b>${esc(p.name)}</b> <small class="muted">Rang ${n}</small><p class="small">${esc(p.desc)} je Rang${n ? ` · aktuell: ${p.per(n).map(modText).map(esc).join(', ')}` : ''}</p></div>
      <button class="icon small" data-a="parUp" data-id="${p.id}" ${free > 0 ? '' : 'disabled'}>+</button></div>`;
  }).join('');
  return `<div class="panel"><div class="row between"><h3>✸ Sternenmacht</h3><b class="gold">${free}/${total}</b></div>
    <p class="small muted">Unendlicher Fortschritt: ab Kontostufe 20 gibt es alle 2 Stufen einen Punkt.${total ? '' : ` (Du bist Stufe ${lvl}.)`}</p>
    ${rows}${total ? '<button class="btn small ghost" data-a="parReset">Zurücksetzen (kostenlos)</button>' : ''}</div>`;
}
on('parUp', (d) => {
  if (paragonFree() <= 0) return;
  save.paragon = save.paragon || {};
  save.paragon[d.id] = (save.paragon[d.id] || 0) + 1;
  checkAchievements(); persist(); sfx.click(); app.nav('altar');
});
on('parReset', () => { save.paragon = {}; persist(); app.nav('altar'); });
