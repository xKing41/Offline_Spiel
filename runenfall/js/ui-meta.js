// Meta-Bildschirme außerhalb eines Runs.
import { app } from './app.js';
import { $, on, screen, hideScreen, modal, closeModal, toast, confirmBox, topbar, itemCard, glyphCard, skillInfo, bar, tagChips } from './ui.js';
import { esc, fmt, fmtV } from './util.js';
import { save, persist, accountLevel, totalPoints, spentPoints, altarLvl, relicSlots, checkAchievements, exportSave, importSave, resetSave, achievementPoints, xpForLevel } from './save.js';
import { CLASSES, ALTAR, altarCost, ACHIEVEMENTS, ASC_MODS, BOSSES } from './data/content.js';
import { SKILLS, SUPPORTS, catTags } from './data/skills.js';
import { UNIQUES, BASES, RARITY, relicRefine, relicRefineCost, relicSalvage, RELIC_TIERS } from './data/items.js';
import { getTree, findPath, removalSet, KEYSTONES } from './data/tree.js';
import { modText } from './data/stats.js';
import { buildSets, relicMods } from './run.js';
import { computePlayer, computeSkill } from './calc.js';
import { sfx } from './audio.js';

on('nav', (d) => app.nav(d.to));

// ===================================================================== Sternwarte
export function showHub() {
  const acc = accountLevel();
  const pts = totalPoints();
  const unspent = Object.keys(CLASSES).filter((c) => save.unlockedCls.includes(c)).some((c) => spentPoints(c) < pts);
  const run = save.run;
  const achDone = Object.keys(save.ach).length;
  screen(`
    <div class="hub">
      <div class="logo"><span>RUNEN</span><span>FALL</span></div>
      <p class="tag">Die Sterne sind gefallen. Sammle ihre Macht.</p>
      <div class="acc">
        <div class="acc-l"><small>Kontostufe</small><b>${acc.level}</b></div>
        <div class="acc-bar">${bar(acc.cur, acc.need, 'xp')}</div>
        <div class="acc-d"><small>Sternenstaub</small><b class="dust">✦ ${fmt(save.dust)}</b></div>
      </div>
      ${run ? `<button class="btn primary big" data-a="continue">FORTSETZEN<small>${esc(CLASSES[run.cls].name)} · ${run.mode === 'abyss' ? 'Abgrund Ebene ' + run.floor : 'Akt ' + (run.act + 1)} · Stufe ${run.lvl}</small></button>
        <button class="btn small ghost" data-a="abandon">Run aufgeben</button>`
      : `<button class="btn primary big" data-a="nav" data-to="setup">NEUER RUN</button>`}
      <div class="grid2">
        <button class="tile" data-a="nav" data-to="tree"><span class="ti">✶</span>Sternenkarte${unspent ? '<i class="dot"></i>' : ''}<small>${pts} Punkte</small></button>
        <button class="tile" data-a="nav" data-to="codex"><span class="ti">❖</span>Kodex<small>Runen · Glyphen · Klassen</small></button>
        <button class="tile" data-a="nav" data-to="altar"><span class="ti">⛩</span>Altar<small>Dauerhafte Segen</small></button>
        <button class="tile" data-a="nav" data-to="relics"><span class="ti">◈</span>Relikte<small>${save.relicEq.length}/${relicSlots()} angelegt</small></button>
        <button class="tile" data-a="nav" data-to="ach"><span class="ti">♛</span>Erfolge<small>${achDone}/${ACHIEVEMENTS.length}</small></button>
        <button class="tile" data-a="nav" data-to="stats"><span class="ti">☷</span>Chronik<small>Statistik</small></button>
      </div>
      <button class="btn small ghost" data-a="nav" data-to="settings">⚙ Einstellungen</button>
      ${save.treeReset ? '<p class="note">Die Sternenkarte wurde überarbeitet – deine Punkte wurden zurückerstattet.</p>' : ''}
    </div>`, 'hubscreen');
  if (save.treeReset) { save.treeReset = false; persist(); }
}
on('continue', () => app.continueRun());
on('abandon', () => confirmBox('Run wirklich aufgeben? Du erhältst die Belohnungen für den bisherigen Fortschritt.', 'Aufgeben', () => app.abandonRun()));

// ===================================================================== Run vorbereiten
let setup = { cls: null, asc: 0, mode: 'normal' };
export function showSetup() {
  if (!setup.cls || !save.unlockedCls.includes(setup.cls)) setup.cls = save.unlockedCls.includes(save.lastCls) ? save.lastCls : save.unlockedCls[0];
  setup.asc = Math.min(setup.asc, save.ascUnlocked);
  const abyssOk = Object.keys(save.stats.wins).length > 0;
  if (!abyssOk) setup.mode = 'normal';
  const cards = Object.entries(CLASSES).map(([id, c]) => {
    const unlocked = save.unlockedCls.includes(id);
    const pts = spentPoints(id);
    return `<button class="ccard ${setup.cls === id ? 'sel' : ''} ${unlocked ? '' : 'locked'}" style="--cc:${c.color}" data-a="${unlocked ? 'pickCls' : 'buyCls'}" data-id="${id}">
      <span class="cg">${c.glyph}</span><b>${c.name}</b>
      <small>${unlocked ? `${pts} Sternpunkte · Siege: ${save.stats.wins[id] || 0}` : `🔒 ✦ ${fmt(c.unlock)}`}</small></button>`;
  }).join('');
  const c = CLASSES[setup.cls];
  const asc = ASC_MODS.filter((m) => m.lvl <= setup.asc).map((m) => `<li>${m.text}</li>`).join('');
  screen(`${topbar('Neuer Run')}
    <div class="pad">
      <div class="cgrid">${cards}</div>
      <div class="panel">
        <h3 style="color:${c.color}">${c.glyph} ${c.name}</h3>
        <p>${esc(c.desc)}</p>
        <p class="small">Startrune: <b>${SKILLS[c.start].name}</b></p>
        ${skillInfo(c.start)}
      </div>
      <div class="panel">
        <h3>Modus</h3>
        <div class="seg">
          <button class="${setup.mode === 'normal' ? 'on' : ''}" data-a="mode" data-m="normal">Feldzug<small>3 Akte · 3 Bosse</small></button>
          <button class="${setup.mode === 'abyss' ? 'on' : ''} ${abyssOk ? '' : 'disabled'}" data-a="mode" data-m="abyss">Abgrund<small>${abyssOk ? 'Endlos · Bestenliste' : '🔒 Gewinne einen Feldzug'}</small></button>
        </div>
        <h3>Sternenhöhe ${setup.asc}</h3>
        <div class="stepper"><button class="icon" data-a="asc" data-d="-1">−</button>
          <div class="ascbar">${Array.from({ length: Math.max(1, save.ascUnlocked + 1) }, (_, i) => `<i class="${i <= setup.asc ? 'on' : ''}"></i>`).join('')}</div>
          <button class="icon" data-a="asc" data-d="1">+</button></div>
        <p class="small muted">Gegner +${Math.round((Math.pow(1.12, setup.asc) - 1) * 100)}% Leben, +${Math.round((Math.pow(1.07, setup.asc) - 1) * 100)}% Schaden · Belohnungen +${setup.asc * 25}% Staub. Gewinne, um die nächste Höhe freizuschalten (unendlich).</p>
        ${asc ? `<ul class="asclist">${asc}</ul>` : ''}
      </div>
      <button class="btn primary big" data-a="go">LOS</button>
    </div>`);
}
on('pickCls', (d) => { setup.cls = d.id; showSetup(); });
on('buyCls', (d) => {
  const c = CLASSES[d.id];
  if (save.dust < c.unlock) { sfx.deny(); toast(`Benötigt ✦ ${fmt(c.unlock)} Sternenstaub`); return; }
  confirmBox(`${c.name} für ✦ ${fmt(c.unlock)} freischalten?`, 'Freischalten', () => {
    save.dust -= c.unlock; save.unlockedCls.push(d.id); setup.cls = d.id; persist(); sfx.loot(); showSetup();
  });
});
on('mode', (d) => { setup.mode = d.m; showSetup(); });
on('asc', (d) => { setup.asc = Math.max(0, Math.min(save.ascUnlocked, setup.asc + Number(d.d))); showSetup(); });
on('go', () => { save.lastCls = setup.cls; app.startRun({ ...setup }); });

// ===================================================================== Sternenkarte
let treeCls = null;
let treeSel = null;
export function showTree() {
  if (!treeCls || !save.unlockedCls.includes(treeCls)) treeCls = save.run ? save.run.cls : save.lastCls;
  if (!save.unlockedCls.includes(treeCls)) treeCls = save.unlockedCls[0];
  const tv = app.treeView;
  tv.onSelect = (n, path) => { treeSel = n; renderTreePanel(path); };
  tv.open(treeCls, save.alloc[treeCls]);
  renderTreeUI();
}
function renderTreeUI() {
  const pts = totalPoints(), spent = spentPoints(treeCls);
  const tabs = save.unlockedCls.map((c) => `<button class="${c === treeCls ? 'on' : ''}" data-a="treeCls" data-c="${c}" style="--cc:${CLASSES[c].color}">${CLASSES[c].glyph}</button>`).join('');
  const locked = !!save.run;
  screen(`${topbar('Sternenkarte', save.run ? 'map' : 'hub', `<b class="pts">${pts - spent}</b><small>/${pts}</small>`)}
    <div class="treebar"><div class="ctabs">${tabs}</div>
      <input id="tsearch" type="search" placeholder="Suchen (z. B. Feuer, Krit) …" autocomplete="off">
      <button class="icon" data-a="tzoom" data-f="1.3">+</button><button class="icon" data-a="tzoom" data-f="0.77">−</button>
      <button class="icon" data-a="tsum" title="Zusammenfassung">Σ</button></div>
    ${locked ? '<div class="lockbar">Während eines Runs kann die Karte nur angesehen werden.</div>' : ''}
    <div id="tpanel" class="tpanel"></div>`, 'treescreen');
  const inp = $('#tsearch');
  inp.value = app.treeView.search;
  inp.addEventListener('input', () => app.treeView.setSearch(inp.value));
  renderTreePanel(app.treeView.preview);
}
function renderTreePanel(path) {
  const el = $('#tpanel');
  if (!el) return;
  const n = treeSel;
  if (!n) { el.innerHTML = '<p class="muted small center">Tippe einen Stern an. Ziehen = verschieben, zwei Finger = zoomen.</p>'; return; }
  const alloc = new Set(save.alloc[treeCls]);
  const tree = getTree();
  const on = alloc.has(n.id);
  const pts = totalPoints() - spentPoints(treeCls);
  const typeName = { key: 'Keystone', notable: 'Bedeutender Stern', small: 'Stern', travel: 'Wegstern', hub: 'Sternenherz', start: 'Ursprung' }[n.type];
  let act = '';
  if (save.run) act = '';
  else if (n.type === 'start') act = '';
  else if (on) {
    const rm = removalSet(tree, alloc, n.id, tree.starts[treeCls]);
    act = `<button class="btn small" data-a="tfree" data-id="${n.id}">Entfernen${rm.length > 1 ? ` (${rm.length} Sterne)` : ''}</button>`;
  } else if (path && path.length) {
    act = `<button class="btn small ${path.length > pts ? 'disabled' : 'primary'}" data-a="talloc" data-id="${n.id}">Zuweisen (${path.length} ${path.length === 1 ? 'Punkt' : 'Punkte'})</button>`;
  } else if (n.type === 'start') act = '';
  else act = '<small class="muted">Nicht erreichbar (Ursprung einer anderen Klasse)</small>';
  const keyDesc = n.type === 'key' ? `<p class="small muted">${esc(KEYSTONES[n.key].desc)}</p>` : '';
  el.innerHTML = `<div class="tnode t-${n.type}"><div><b>${esc(n.name)}</b> <small class="muted">${typeName}</small></div>
    <ul class="mods">${n.mods.map((m) => `<li>${esc(modText(m))}</li>`).join('')}</ul>${keyDesc}<div class="row">${act}</div></div>`;
}
on('treeCls', (d) => { treeCls = d.c; treeSel = null; app.treeView.open(treeCls, save.alloc[treeCls]); renderTreeUI(); });
on('tzoom', (d) => app.treeView.zoom(Number(d.f)));
on('talloc', (d) => {
  const tree = getTree();
  const alloc = new Set(save.alloc[treeCls]);
  const path = findPath(tree, alloc, d.id, treeCls);
  if (!path) return;
  if (path.length > totalPoints() - spentPoints(treeCls)) { sfx.deny(); toast('Nicht genug Sternpunkte – steige im Konto auf oder hole Erfolge.'); return; }
  save.alloc[treeCls].push(...path);
  if (path.some((id) => tree.nodes.get(id).type === 'key')) save.stats.keystone++;
  checkAchievements();
  persist();
  sfx.levelup();
  app.treeView.setAlloc(save.alloc[treeCls]);
  renderTreeUI();
});
on('tfree', (d) => {
  const tree = getTree();
  const alloc = new Set(save.alloc[treeCls]);
  const rm = new Set(removalSet(tree, alloc, d.id, tree.starts[treeCls]));
  save.alloc[treeCls] = save.alloc[treeCls].filter((x) => !rm.has(x));
  persist();
  app.treeView.setAlloc(save.alloc[treeCls]);
  renderTreeUI();
});
on('tsum', () => {
  const tree = getTree();
  const sums = new Map();
  for (const id of save.alloc[treeCls]) {
    for (const m of tree.nodes.get(id).mods) {
      const k = m.s + '|' + (m.t || '');
      const e = sums.get(k) || { ...m, v: 0 };
      e.v = m.t === 'more' ? ((1 + e.v / 100) * (1 + m.v / 100) - 1) * 100 : e.v + m.v;
      sums.set(k, e);
    }
  }
  const keys = save.alloc[treeCls].map((id) => tree.nodes.get(id)).filter((n) => n.type === 'key');
  modal(`<h3>Zusammenfassung: ${CLASSES[treeCls].name}</h3>
    ${keys.length ? `<p><b>Keystones:</b> ${keys.map((k) => esc(k.name)).join(', ')}</p>` : ''}
    <ul class="mods">${[...sums.values()].map((m) => `<li>${esc(modText(m))}</li>`).join('') || '<li class="muted">Noch nichts zugewiesen</li>'}</ul>
    <div class="row"><button class="btn" data-a="_close">Schließen</button>${save.run ? '' : '<button class="btn danger" data-a="treset">Alles zurücksetzen</button>'}</div>`);
});
on('treset', () => {
  closeModal();
  confirmBox('Alle Punkte dieser Klasse zurückerstatten?', 'Zurücksetzen', () => {
    save.alloc[treeCls] = [getTree().starts[treeCls]];
    persist();
    app.treeView.setAlloc(save.alloc[treeCls]);
    treeSel = null;
    renderTreeUI();
  });
});
export const treeTabLocked = () => !!save.run;

// ===================================================================== Kodex
let codexTab = 'skills';
export function showCodex() {
  const tabs = [['skills', 'Runen'], ['supports', 'Glyphen'], ['uniques', 'Unikate']]
    .map(([k, n]) => `<button class="${codexTab === k ? 'on' : ''}" data-a="ctab" data-t="${k}">${n}</button>`).join('');
  let body = '';
  if (codexTab === 'skills') {
    body = Object.entries(SKILLS).map(([id, s]) => {
      const have = save.codex.skills.includes(id);
      return `<div class="panel ${have ? '' : 'locked'}"><div class="row between"><h3>${esc(s.name)}</h3>
        ${have ? '<span class="ok">✓ freigeschaltet</span>' : `<button class="btn small primary" data-a="cbuy" data-k="skills" data-id="${id}">✦ ${s.cost}</button>`}</div>
        ${skillInfo(id)}</div>`;
    }).join('');
  } else if (codexTab === 'supports') {
    body = `<div class="gcards">${Object.entries(SUPPORTS).map(([id, s]) => {
      const have = save.codex.supports.includes(id);
      return glyphCard(id, have ? '<span class="ok">✓ freigeschaltet</span>' : `<button class="btn small primary" data-a="cbuy" data-k="supports" data-id="${id}">✦ ${s.cost}</button>`);
    }).join('')}</div>`;
  } else {
    const total = Object.keys(UNIQUES).length;
    body = `<p class="muted center">${save.codex.uniques.length}/${total} entdeckt. Einzigartige Gegenstände findest du bei Bossen, Eliten und Händlern.</p><div class="gcards">` +
      Object.keys(UNIQUES).map((k) => save.codex.uniques.includes(k)
        ? itemCard({ slot: BASES[UNIQUES[k].base].slot, base: UNIQUES[k].base, rarity: 'unique', uq: k, ilvl: 1, affixes: [] }, { small: true })
        : `<div class="icard small unknown"><b>???</b><small>${BASES[UNIQUES[k].base].name}</small></div>`).join('') + '</div>';
  }
  screen(`${topbar('Kodex', 'hub', `<b class="dust">✦ ${fmt(save.dust)}</b>`)}
    <div class="pad"><p class="muted small center">Freigeschaltete Runen und Glyphen können in Runs erscheinen. Mehr Auswahl = mehr Build-Möglichkeiten.</p>
    <div class="seg">${tabs}</div>${body}</div>`);
}
on('ctab', (d) => { codexTab = d.t; showCodex(); });
on('cbuy', (d) => {
  const def = d.k === 'skills' ? SKILLS[d.id] : SUPPORTS[d.id];
  if (save.dust < def.cost) { sfx.deny(); toast(`Benötigt ✦ ${def.cost}`); return; }
  save.dust -= def.cost;
  save.codex[d.k].push(d.id);
  persist(); sfx.loot();
  toast(`${def.name} freigeschaltet!`);
  showCodex();
});

// ===================================================================== Altar
export function showAltar() {
  const rows = ALTAR.map((a) => {
    const l = altarLvl(a.id);
    const max = l >= a.max;
    const cost = altarCost(a, l);
    return `<div class="panel altar"><div class="row between"><div><b>${esc(a.name)}</b> <small class="muted">${l}/${a.max}</small><p class="small">${esc(a.desc)}</p></div>
      ${max ? '<span class="ok">MAX</span>' : `<button class="btn small ${save.dust >= cost ? 'primary' : 'disabled'}" data-a="abuy" data-id="${a.id}">✦ ${fmt(cost)}</button>`}</div>
      <div class="pips">${Array.from({ length: a.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</div></div>`;
  }).join('');
  screen(`${topbar('Altar der Sterne', 'hub', `<b class="dust">✦ ${fmt(save.dust)}</b>`)}<div class="pad">${rows}</div>`);
}
on('abuy', (d) => {
  const a = ALTAR.find((x) => x.id === d.id);
  const l = altarLvl(a.id), cost = altarCost(a, l);
  if (l >= a.max || save.dust < cost) { sfx.deny(); return; }
  save.dust -= cost;
  save.altar[a.id] = l + 1;
  persist(); sfx.levelup();
  showAltar();
});

// ===================================================================== Relikte
let relicSel = null;
export function showRelics() {
  const slots = relicSlots();
  const eq = save.relicEq.map((u) => save.relics.find((r) => r.uid === u)).filter(Boolean);
  const eqHtml = Array.from({ length: slots }, (_, i) => eq[i]
    ? `<button class="rslot on" style="--rc:${RARITY[eq[i].rarity].color}" data-a="rsel" data-u="${eq[i].uid}">◈<small>${esc(eq[i].title)}</small></button>`
    : '<div class="rslot">leer</div>').join('');
  const inv = [...save.relics].sort((a, b) => (b.affixes.length - a.affixes.length) || b.ilvl - a.ilvl).map((r) =>
    `<button class="rinv ${save.relicEq.includes(r.uid) ? 'eq' : ''} ${relicSel === r.uid ? 'sel' : ''}" style="--rc:${RARITY[r.rarity].color}" data-a="rsel" data-u="${r.uid}">◈</button>`).join('');
  const sel = save.relics.find((r) => r.uid === relicSel);
  let detail = '<p class="muted small center">Relikte findest du bei Bossen (immer) und Eliten (manchmal). Sie wirken in jedem Run.</p>';
  if (sel) {
    const isEq = save.relicEq.includes(sel.uid);
    const refine = sel.affixes.map((af, i) => af.tier < RELIC_TIERS - 1
      ? `<button class="btn tiny" data-a="rref" data-i="${i}">S${af.tier + 1}→${af.tier + 2} · ✦ ${relicRefineCost(af)}</button>` : '<span class="ok tiny">MAX</span>').join('');
    detail = itemCard(sel, { actions: `
      <button class="btn small ${isEq ? '' : 'primary'}" data-a="${isEq ? 'runeq' : 'req'}">${isEq ? 'Ablegen' : 'Anlegen'}</button>
      <button class="btn small danger" data-a="rsalv">Zerlegen (+✦ ${relicSalvage(sel)})</button>` }) +
      `<div class="panel"><b>Veredeln</b><p class="small muted">Hebt einen Affix eine Stufe an (bis Stufe ${RELIC_TIERS}).</p><div class="refine">${refine}</div></div>`;
  }
  screen(`${topbar('Relikte', 'hub', `<b class="dust">✦ ${fmt(save.dust)}</b>`)}
    <div class="pad"><h3>Angelegt (${eq.length}/${slots})</h3><div class="rslots">${eqHtml}</div>
    <h3>Sammlung (${save.relics.length}/60)</h3><div class="rgrid">${inv || '<p class="muted">Noch keine Relikte.</p>'}</div>
    ${detail}</div>`);
}
on('rsel', (d) => { relicSel = d.u; showRelics(); });
on('req', () => {
  if (save.run) { toast('Relikte können nur zwischen Runs gewechselt werden.'); return; }
  if (save.relicEq.length >= relicSlots()) { toast('Alle Plätze belegt – lege zuerst ein Relikt ab.'); return; }
  save.relicEq.push(relicSel); persist(); showRelics();
});
on('runeq', () => {
  if (save.run) { toast('Relikte können nur zwischen Runs gewechselt werden.'); return; }
  save.relicEq = save.relicEq.filter((u) => u !== relicSel); persist(); showRelics();
});
on('rsalv', () => {
  const r = save.relics.find((x) => x.uid === relicSel);
  if (!r) return;
  if (save.run && save.relicEq.includes(r.uid)) { toast('Während eines Runs nicht möglich.'); return; }
  confirmBox('Relikt zerlegen? Das kann nicht rückgängig gemacht werden.', 'Zerlegen', () => {
    save.dust += relicSalvage(r);
    save.relics = save.relics.filter((x) => x.uid !== r.uid);
    save.relicEq = save.relicEq.filter((u) => u !== r.uid);
    relicSel = null; persist(); showRelics();
  });
});
on('rref', (d) => {
  const r = save.relics.find((x) => x.uid === relicSel);
  const af = r && r.affixes[Number(d.i)];
  if (!af) return;
  const cost = relicRefineCost(af);
  if (save.dust < cost) { sfx.deny(); toast(`Benötigt ✦ ${cost}`); return; }
  save.dust -= cost;
  relicRefine(r, Number(d.i));
  persist(); sfx.loot(); showRelics();
});

// ===================================================================== Erfolge
export function showAch() {
  const list = ACHIEVEMENTS.map((a) => {
    const done = !!save.ach[a.id];
    const rw = a.reward.points ? `+${a.reward.points} Sternpunkt${a.reward.points > 1 ? 'e' : ''}` : `+✦ ${a.reward.dust}`;
    return `<div class="ach ${done ? 'done' : ''}"><span class="ai">${done ? '♛' : '○'}</span><div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div><em>${rw}</em></div>`;
  }).join('');
  screen(`${topbar('Erfolge', 'hub', `<small>${achievementPoints()} Punkte</small>`)}<div class="pad">${list}</div>`);
}

// ===================================================================== Chronik
export function showStats() {
  const s = save.stats;
  const h = Math.floor(s.playTime / 3600), m = Math.floor((s.playTime % 3600) / 60);
  const best = s.bestRun;
  const row = (k, v) => `<div class="srow"><span>${k}</span><b>${v}</b></div>`;
  screen(`${topbar('Chronik')}<div class="pad"><div class="panel">
    ${row('Runs', s.runs)}${row('Siege', Object.values(s.wins).reduce((a, b) => a + b, 0))}
    ${row('Höchste gewonnene Sternenhöhe', s.maxAscWin < 0 ? '–' : s.maxAscWin)}${row('Tiefste Abgrund-Ebene', s.maxAbyss)}
    ${row('Besiegte Gegner', fmt(s.kills))}${row('Stärkster Treffer', fmt(s.maxHit))}${row('Höchste Run-Stufe', s.maxRunLvl)}
    ${Object.entries(BOSSES).map(([k, b]) => row(b.name, s.bossKills[k] || 0)).join('')}
    ${row('Spielzeit', `${h} h ${m} min`)}${row('Mythische Relikte', s.mythic)}</div>
    ${best ? `<div class="panel"><h3>Bester Run</h3><p>${esc(CLASSES[best.cls].name)} · ${best.mode === 'abyss' ? `Abgrund Ebene ${best.floor}` : best.win ? 'Feldzug gewonnen' : 'Feldzug'} · Sternenhöhe ${best.asc} · Stufe ${best.lvl} · ${fmt(best.kills)} Gegner</p></div>` : ''}
    </div>`);
}

// ===================================================================== Einstellungen
export function showSettings() {
  const st = save.settings;
  const tg = (k, label) => `<button class="toggle ${st[k] ? 'on' : ''}" data-a="setTog" data-k="${k}"><span>${label}</span><i></i></button>`;
  screen(`${topbar('Einstellungen')}<div class="pad"><div class="panel">
    ${tg('sound', 'Ton')}${tg('vibrate', 'Vibration')}${tg('dmgNums', 'Schadenszahlen')}${tg('shake', 'Bildschirmwackeln')}</div>
    <div class="panel"><h3>Spielstand</h3><p class="small muted">Dein Fortschritt liegt nur auf diesem Gerät. Sichere ihn gelegentlich als Text (z. B. in einer Notiz).</p>
    <div class="row"><button class="btn small" data-a="exp">Exportieren</button><button class="btn small" data-a="imp">Importieren</button></div>
    <button class="btn small danger" data-a="wipe">Alles löschen</button></div>
    <p class="muted small center">Runenfall · läuft komplett offline</p></div>`);
}
on('setTog', (d) => { save.settings[d.k] = !save.settings[d.k]; persist(); showSettings(); });
on('exp', () => {
  const code = exportSave();
  modal(`<h3>Spielstand exportieren</h3><textarea class="code" readonly>${code}</textarea>
    <div class="row"><button class="btn" data-a="copyExp">Kopieren</button><button class="btn" data-a="_close">Fertig</button></div>`);
  window.__exp = code;
});
on('copyExp', async () => {
  try { await navigator.clipboard.writeText(window.__exp); toast('Kopiert!'); } catch (e) { toast('Bitte manuell markieren und kopieren.'); }
});
on('imp', () => modal(`<h3>Spielstand importieren</h3><p class="small muted">Achtung: überschreibt den aktuellen Fortschritt.</p>
  <textarea id="impTxt" class="code" placeholder="Code hier einfügen"></textarea>
  <div class="row"><button class="btn" data-a="_close">Abbrechen</button><button class="btn danger" data-a="doImp">Importieren</button></div>`));
on('doImp', () => {
  try { importSave($('#impTxt').value); closeModal(); toast('Spielstand geladen!'); app.nav('hub'); }
  catch (e) { toast('Ungültiger Code.'); }
});
on('wipe', () => confirmBox('Wirklich ALLES löschen? Konto, Sternenkarte, Relikte – alles weg.', 'Endgültig löschen', () => {
  resetSave(); app.nav('hub'); toast('Neuer Anfang.');
}));
