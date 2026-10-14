// Meta-Bildschirme außerhalb eines Runs.
import { app } from './app.js';
import { $, on, screen, hideScreen, modal, closeModal, toast, confirmBox, topbar, itemCard, glyphCard, skillInfo, bar, tagChips } from './ui.js';
import { esc, fmt, fmtV, clock } from './util.js';
import { save, persist, accountLevel, totalPoints, spentPoints, altarLvl, relicSlots, checkAchievements, exportSave, importSave, resetSave, achievementPoints, xpForLevel } from './save.js';
import { CLASSES, ALTAR, altarCost, ACHIEVEMENTS, ASC_MODS, BOSSES, ENEMIES, ASCENDANCIES, ASCEND_COST, MUTATORS } from './data/content.js';
import { SKILLS, SUPPORTS, catTags } from './data/skills.js';
import { UNIQUES, BASES, RARITY, relicRefine, relicRefineCost, relicSalvage, RELIC_TIERS } from './data/items.js';
import { getTree, findPath, removalSet, KEYSTONES } from './data/tree.js';
import { modText } from './data/stats.js';
import { buildSets, relicMods, ensureQuests, questText, dailyConfig } from './run.js';
import { computePlayer, computeSkill } from './calc.js';
import { systemTiles, leaguePanel, potionPanel, archiveTab } from './ui-systems.js';
import { EVOLUTIONS, evoOf } from './data/evolutions.js';
import { sfx } from './audio.js';
import { jewelsTab, jewelSocketPanel, paragonPanel } from './ui-endgame.js';
import { modeGrid, modePanel, modeTiles, towerClaimPanel, modeWhere, resWhere } from './ui-modes.js';
import { modeLock } from './data/modes.js';
import { PETS, SETS, getAtlas } from './data/endgame.js';

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
      ${run ? `<button class="btn primary big" data-a="continue">FORTSETZEN<small>${esc(CLASSES[run.cls].name)} · ${run.mode === 'abyss' ? 'Abgrund Ebene ' + run.floor : modeWhere(run) || 'Akt ' + (run.act + 1)} · Stufe ${run.lvl}</small></button>
        <button class="btn small ghost" data-a="abandon">Run aufgeben</button>`
      : `<button class="btn primary big" data-a="nav" data-to="setup">NEUER RUN</button>`}
      ${run ? '' : dailyTile()}
      ${towerClaimPanel()}
      ${questPanel()}
      <div class="grid2">
        <button class="tile" data-a="nav" data-to="tree"><span class="ti">✶</span>Sternenkarte${unspent ? '<i class="dot"></i>' : ''}<small>${pts} Punkte</small></button>
        <button class="tile" data-a="nav" data-to="codex"><span class="ti">❖</span>Kodex<small>Runen · Glyphen · Klassen</small></button>
        <button class="tile" data-a="nav" data-to="altar"><span class="ti">⛩</span>Altar<small>Dauerhafte Segen</small></button>
        <button class="tile" data-a="nav" data-to="relics"><span class="ti">◈</span>Relikte<small>${save.relicEq.length}/${relicSlots()} angelegt</small></button>
        <button class="tile" data-a="nav" data-to="ach"><span class="ti">♛</span>Erfolge<small>${achDone}/${ACHIEVEMENTS.length}</small></button>
        <button class="tile" data-a="nav" data-to="stats"><span class="ti">☷</span>Chronik<small>Statistik</small></button>
        <button class="tile" data-a="nav" data-to="atlas"><span class="ti">✷</span>Sternenatlas${(save.atlas?.points || 0) > Object.keys(save.atlas?.passives || {}).length ? '<i class="dot"></i>' : ''}<small>${Object.keys(save.atlas?.done || {}).length}/30 Regionen</small></button>
        <button class="tile" data-a="nav" data-to="pets"><span class="ti">🐾</span>Gefährten<small>${Object.keys(save.pets || {}).length}/12 gesammelt</small></button>
        ${systemTiles()}
        ${modeTiles()}
      </div>
      <button class="btn small ghost" data-a="nav" data-to="settings">⚙ Einstellungen</button>
      ${save.treeReset ? '<p class="note">Die Sternenkarte wurde überarbeitet – deine Punkte wurden zurückerstattet.</p>' : ''}
    </div>`, 'hubscreen');
  if (save.treeReset) { save.treeReset = false; persist(); }
}
on('continue', () => app.continueRun());

function dailyTile() {
  const d = dailyConfig();
  return `<button class="daily ${d.done ? 'done' : ''}" data-a="daily"><div><b>☀ Tägliche Herausforderung</b>
    <small>${esc(CLASSES[d.cls].name)} · Höhe ${d.asc} · ${d.mutators.map((m) => MUTATORS[m].name).join(', ')}</small></div>
    <em>${d.done ? '✓ erledigt' : 'Staub ×2'}</em></button>`;
}
on('daily', () => {
  const d = dailyConfig();
  confirmBox(`<b>Tägliche Herausforderung</b><br><br>Klasse: ${esc(CLASSES[d.cls].name)}<br>Sternenhöhe: ${d.asc}<br>Prophezeiungen: ${d.mutators.map((m) => `<br>· ${MUTATORS[m].name} – ${MUTATORS[m].desc}`).join('')}<br><br>Alle Spieler bekommen heute dieselbe Karte. ${d.done ? 'Du hast den Bonus heute schon erhalten.' : 'Der erste Versuch heute verdoppelt deinen Sternenstaub.'}`,
    'Starten', () => app.startRun({ cls: d.cls, asc: d.asc, mode: 'normal', mutators: d.mutators, daily: d.key, seed: d.seed, ascend: null }));
});

function questPanel() {
  ensureQuests();
  persist();
  const rows = save.quests.map((q, i) => `<div class="quest"><span>📜</span><div><b>${esc(questText(q))}</b><small>+✦ ${q.dust}${q.relic ? ' · + Relikt' : ''}</small></div>
    <button class="icon small" data-a="qReroll" data-i="${i}" title="Austauschen">↻</button></div>`).join('');
  return `<div class="panel quests"><div class="row between"><h3>Aufträge</h3><small class="muted">1× täglich austauschbar</small></div>${rows}</div>`;
}
on('qReroll', (d) => {
  const today = new Date().toDateString();
  if (save.questReroll === today) { toast('Heute schon ausgetauscht – morgen wieder.'); return; }
  save.questReroll = today;
  save.quests.splice(Number(d.i), 1);
  ensureQuests();
  persist();
  showHub();
});
on('abandon', () => confirmBox('Run wirklich aufgeben? Du erhältst die Belohnungen für den bisherigen Fortschritt.', 'Aufgeben', () => app.abandonRun()));

// ===================================================================== Run vorbereiten
let setup = { cls: null, asc: 0, mode: 'normal', ascend: null, mutators: [] };
export function showSetup() {
  if (!setup.cls || !save.unlockedCls.includes(setup.cls)) setup.cls = save.unlockedCls.includes(save.lastCls) ? save.lastCls : save.unlockedCls[0];
  setup.asc = Math.min(setup.asc, save.ascUnlocked);
  if (app.setupMode) { setup.mode = app.setupMode; app.setupMode = null; }
  if (!setup.mode || modeLock(setup.mode, save)) setup.mode = 'normal';
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
        ${modeGrid(setup)}
        <h3>Sternenhöhe ${setup.asc}</h3>
        <div class="stepper"><button class="icon" data-a="asc" data-d="-1">−</button>
          <div class="ascbar">${Array.from({ length: Math.max(1, save.ascUnlocked + 1) }, (_, i) => `<i class="${i <= setup.asc ? 'on' : ''}"></i>`).join('')}</div>
          <button class="icon" data-a="asc" data-d="1">+</button></div>
        <p class="small muted">Gegner +${Math.round((Math.pow(1.12, setup.asc) - 1) * 100)}% Leben, +${Math.round((Math.pow(1.07, setup.asc) - 1) * 100)}% Schaden · Belohnungen +${setup.asc * 25}% Staub. Gewinne, um die nächste Höhe freizuschalten (unendlich).</p>
        ${asc ? `<ul class="asclist">${asc}</ul>` : ''}
      </div>
      ${modePanel(setup)}
      ${ascendPanel()}
      ${petPanel()}
      ${atlasPanel()}
      ${leaguePanel(setup)}
      ${potionPanel(setup)}
      ${setup.mode === 'tower' ? '' : prophPanel()}
      <button class="btn primary big" data-a="go">LOS</button>
    </div>`);
}
on('pickCls', (d) => { setup.cls = d.id; setup.ascend = null; showSetup(); });

function ascendPanel() {
  const opts = Object.entries(ASCENDANCIES).filter(([, a]) => a.cls === setup.cls);
  const btn = (id, a) => {
    const lvl = (save.ascend || {})[id] || 0;
    return `<button class="${setup.ascend === id ? 'on' : ''} ${lvl ? '' : 'disabled'}" data-a="pickAsc" data-id="${id}">${esc(a.name)}<small>${lvl ? `Stufe ${lvl}/5` : '🔒 im Kodex'}</small></button>`;
  };
  return `<div class="panel"><h3>Aufstiegsklasse</h3><div class="seg">
    <button class="${!setup.ascend ? 'on' : ''}" data-a="pickAsc" data-id="">Keine<small>–</small></button>${opts.map(([id, a]) => btn(id, a)).join('')}</div>
    ${setup.ascend ? `<ul class="mods">${ASCENDANCIES[setup.ascend].nodes.slice(0, save.ascend[setup.ascend]).map((n) => `<li><b>${esc(n.name)}:</b> ${n.mods.map(modText).map(esc).join(', ')}</li>`).join('')}</ul>` : ''}</div>`;
}
on('pickAsc', (d) => {
  if (d.id && !((save.ascend || {})[d.id] > 0)) { toast('Schalte die Aufstiegsklasse zuerst im Kodex frei.'); return; }
  setup.ascend = d.id || null; showSetup();
});

function prophPanel() {
  const bonus = setup.mutators.reduce((s, m) => s + MUTATORS[m].reward, 0);
  return `<div class="panel"><div class="row between"><h3>Prophezeiungen</h3><b class="up">+${bonus}% Staub</b></div>
    <p class="small muted">Optionale Erschwernisse. Jede erhöht die Belohnung – für echte Min-Maxer.</p>
    <div class="proph">${Object.entries(MUTATORS).map(([id, m]) => `<button class="${setup.mutators.includes(id) ? 'on' : ''}" data-a="togMut" data-id="${id}"><b>${esc(m.name)}</b><small>${esc(m.desc)}</small><em>+${m.reward}%</em></button>`).join('')}</div></div>`;
}
on('togMut', (d) => {
  const i = setup.mutators.indexOf(d.id);
  if (i >= 0) setup.mutators.splice(i, 1); else setup.mutators.push(d.id);
  const y = document.getElementById('ui').scrollTop;
  showSetup();
  document.getElementById('ui').scrollTop = y;
});
on('buyCls', (d) => {
  const c = CLASSES[d.id];
  if (save.dust < c.unlock) { sfx.deny(); toast(`Benötigt ✦ ${fmt(c.unlock)} Sternenstaub`); return; }
  confirmBox(`${c.name} für ✦ ${fmt(c.unlock)} freischalten?`, 'Freischalten', () => {
    save.dust -= c.unlock; save.unlockedCls.push(d.id); setup.cls = d.id; persist(); sfx.loot(); showSetup();
  });
});
on('mode', (d) => {
  const lock = modeLock(d.m, save);
  if (lock) { sfx.deny(); toast(`🔒 ${lock}`); return; }
  setup.mode = d.m;
  const y = document.getElementById('ui').scrollTop; showSetup(); document.getElementById('ui').scrollTop = y;
});
on('huntTier', (d) => {
  const max = (save.hunt && save.hunt.tier) || 1;
  setup.tier = Math.max(1, Math.min(max, (setup.tier || 1) + Number(d.d)));
  const y = document.getElementById('ui').scrollTop; showSetup(); document.getElementById('ui').scrollTop = y;
});
on('asc', (d) => { setup.asc = Math.max(0, Math.min(save.ascUnlocked, setup.asc + Number(d.d))); showSetup(); });
on('go', () => {
  save.lastCls = setup.cls;
  app.startRun({ ...setup, mutators: setup.mode === 'tower' ? [] : setup.mutators, pet: setup.pet || null, atlas: setup.mode === 'normal' ? (save.atlas?.target || null) : null, potion: setup.potion || null, league: setup.mode === 'normal' && !!setup.league, tier: setup.tier || 1 });
});
function petPanel() {
  const own = Object.keys(save.pets || {});
  if (!own.length) return '';
  if (setup.pet && !own.includes(setup.pet)) setup.pet = null;
  if (setup.pet === undefined) setup.pet = own[0];
  return `<div class="panel"><h3>Gefährte</h3><div class="petpick"><button class="${!setup.pet ? 'on' : ''}" data-a="pickPet" data-id="">–</button>${own.map((id) =>
    `<button class="${setup.pet === id ? 'on' : ''}" data-a="pickPet" data-id="${id}" title="${PETS[id].name}">${PETS[id].glyph}<small>${save.pets[id].lvl}</small></button>`).join('')}</div>
    ${setup.pet ? `<p class="small">${esc(PETS[setup.pet].name)}: ${PETS[setup.pet].passive(save.pets[setup.pet].lvl).map(modText).map(esc).join(', ')}</p>` : ''}</div>`;
}
on('pickPet', (d) => { setup.pet = d.id || null; showSetup(); });
on('togLeague', () => { setup.league = !setup.league; const y = document.getElementById('ui').scrollTop; showSetup(); document.getElementById('ui').scrollTop = y; });
on('pickPot', (d) => { setup.potion = d.id || null; const y = document.getElementById('ui').scrollTop; showSetup(); document.getElementById('ui').scrollTop = y; });
function atlasPanel() {
  if (setup.mode !== 'normal') return '';
  const t = save.atlas?.target;
  if (!t) return Object.keys(save.stats.wins).length ? '<p class="small muted center">Tipp: Wähle im Sternenatlas ein Ziel – es wird zu Akt IV.</p>' : '';
  const reg = getAtlas().regions[t];
  return `<div class="panel atlasdone"><b>✷ Akt IV: ${esc(reg.name)}</b><small class="muted">Stufe ${reg.tier} · ändern im Sternenatlas</small></div>`;
}

// ===================================================================== Sternenkarte
let treeCls = null;
app.treeCls = () => treeCls;
app.refreshTree = () => { app.treeView.setAlloc(save.alloc[treeCls]); renderTreeUI(); };
let treeSel = null;
export function showTree() {
  if (!treeCls || !save.unlockedCls.includes(treeCls)) treeCls = save.run ? save.run.cls : save.lastCls;
  if (!save.unlockedCls.includes(treeCls)) treeCls = save.unlockedCls[0];
  const tv = app.treeView;
  tv.jewelColor = (id) => {
    const u = ((save.jewelSock || {})[treeCls] || {})[id];
    const j = u && (save.jewels || []).find((x) => x.uid === u);
    return j ? RARITY[j.rarity].color : null;
  };
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
      <input id="tsearch" type="search" placeholder="Suchen (z. B. Feuer, Krit, Meisterschaft) …" autocomplete="off" enterkeyhint="search">
      <button class="icon" data-a="tnext" title="Nächster Treffer">⌕</button>
      <button class="icon" data-a="tzoom" data-f="1.3">+</button><button class="icon" data-a="tzoom" data-f="0.77">−</button>
      <button class="icon" data-a="tview" title="Gesamtansicht">◎</button><button class="icon" data-a="thome" title="Zum Ursprung">⌂</button>
      <button class="icon" data-a="tsum" title="Zusammenfassung">Σ</button><button class="icon" data-a="tbuilds" title="Gespeicherte Builds">⎘</button></div>
    <div id="tsinfo" class="tsinfo"></div>
    ${locked ? '<div class="lockbar">Während eines Runs kann die Karte nur angesehen werden.</div>' : ''}
    <div id="tpanel" class="tpanel"></div>`, 'treescreen');
  const inp = $('#tsearch');
  inp.value = app.treeView.search;
  const info = () => { const n = app.treeView.matches.size; $('#tsinfo').textContent = app.treeView.search ? `${n} Treffer – ⌕ springt zum nächsten` : ''; };
  inp.addEventListener('input', () => { app.treeView.setSearch(inp.value); info(); });
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); app.treeView.nextMatch(); inp.blur(); } });
  info();
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
  const typeName = { key: 'Keystone', notable: 'Bedeutender Stern', small: 'Stern', travel: 'Wegstern', hub: 'Sternenherz', start: 'Ursprung', jewel: 'Juwelsockel', mastery: 'Meisterschaft', const: 'Sternbild', legend: 'Krönungsstern', portal: 'Sternentor', myth: 'Mythos-Stern' }[n.type];
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
  let keyDesc = n.type === 'key' ? `<p class="small muted">${esc(KEYSTONES[n.key].desc)}</p>` : '';
  if (n.type === 'mastery') {
    const ch = ((save.mastery || {})[treeCls] || {})[n.id] || 0;
    keyDesc = `<p class="small muted">Wähle eine Spezialisierung – jederzeit kostenlos wechselbar.</p><div class="mopts">${n.options.map((o, i) => `<button class="mopt ${ch === i ? 'on' : ''}" data-a="tmast" data-id="${n.id}" data-i="${i}"><b>${esc(o.name)}</b><small>${o.mods.map((m) => esc(modText(m))).join(' · ')}</small></button>`).join('')}</div>`;
  } else if (n.type === 'legend' || n.type === 'const') keyDesc = `<p class="small muted">Sternbild „${esc(n.constName)}“${n.type === 'legend' ? ' – Krönungsstern' : ''}</p>`;
  else if (n.type === 'portal') keyDesc = '<p class="small muted">Verbunden mit einem fernen Sternentor auf der anderen Seite der Karte.</p>';
  else if (n.type === 'myth') keyDesc = '<p class="small muted">Ein einzigartiger Stern vom Rand der Karte.</p>';
  el.innerHTML = `<div class="tnode t-${n.type}"><div><b>${esc(n.name)}</b> <small class="muted">${typeName}</small></div>
    <ul class="mods">${n.mods.map((m) => `<li>${esc(modText(m))}</li>`).join('')}</ul>${keyDesc}${n.type === 'jewel' ? jewelSocketPanel(treeCls, n) : ''}<div class="row">${act}</div></div>`;
}
on('treeCls', (d) => { treeCls = d.c; treeSel = null; app.treeView.open(treeCls, save.alloc[treeCls]); renderTreeUI(); });
on('tzoom', (d) => app.treeView.zoom(Number(d.f)));
on('tview', () => app.treeView.overview());
on('thome', () => app.treeView.home());
on('tnext', () => { if (!app.treeView.nextMatch()) toast('Gib zuerst einen Suchbegriff ein.'); });
on('tmast', (d) => {
  save.mastery = save.mastery || {};
  save.mastery[treeCls] = save.mastery[treeCls] || {};
  save.mastery[treeCls][d.id] = Number(d.i);
  persist(); sfx.click();
  renderTreePanel(app.treeView.preview);
});
on('tgo', (d) => { const n = getTree().nodes.get(d.id); if (n) { app.treeView.focus(n); } });
on('talloc', (d) => {
  const tree = getTree();
  const alloc = new Set(save.alloc[treeCls]);
  const path = findPath(tree, alloc, d.id, treeCls);
  if (!path) return;
  if (path.length > totalPoints() - spentPoints(treeCls)) { sfx.deny(); toast('Nicht genug Sternpunkte – steige im Konto auf oder hole Erfolge.'); return; }
  save.alloc[treeCls].push(...path);
  if (path.some((id) => tree.nodes.get(id).type === 'key')) save.stats.keystone++;
  for (const id of path) {
    const t = tree.nodes.get(id).type;
    const k = { legend: 'legends', portal: 'portals', mastery: 'masteries', myth: 'myths' }[t];
    if (k) save.stats[k] = (save.stats[k] || 0) + 1;
  }
  save.stats.maxTreeNodes = Math.max(save.stats.maxTreeNodes || 0, save.alloc[treeCls].length);
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
    const tn = tree.nodes.get(id);
    const extraM = tn.type === 'mastery' ? tn.options[((save.mastery || {})[treeCls] || {})[id] || 0].mods : [];
    for (const m of [...tn.mods, ...extraM]) {
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

// ===================================================================== Gespeicherte Builds
const BUILD_SLOTS = 4;
function showBuilds() {
  save.loadouts = save.loadouts || {};
  const list = save.loadouts[treeCls] = save.loadouts[treeCls] || [];
  const cur = save.alloc[treeCls].length - 1;
  const rows = Array.from({ length: BUILD_SLOTS }, (_, i) => {
    const b = list[i];
    if (!b) return `<div class="bslot empty"><div><b>Platz ${i + 1}</b><small class="muted">leer</small></div>
      <button class="btn small" data-a="bSave" data-i="${i}" ${save.run ? 'disabled' : ''}>Speichern</button></div>`;
    const keys = b.alloc.map((id) => getTree().nodes.get(id)).filter((n) => n && n.type === 'key').map((n) => n.name);
    return `<div class="bslot"><div><b>${esc(b.name)}</b><small class="muted">${b.alloc.length - 1} Sterne${keys.length ? ' · ' + esc(keys.join(', ')) : ''}</small></div>
      <div class="row"><button class="btn small primary" data-a="bLoad" data-i="${i}" ${save.run ? 'disabled' : ''}>Laden</button>
      <button class="btn small" data-a="bSave" data-i="${i}" ${save.run ? 'disabled' : ''}>Überschreiben</button>
      <button class="icon small" data-a="bRen" data-i="${i}" title="Umbenennen">✎</button><button class="icon small" data-a="bDel" data-i="${i}" title="Löschen">✕</button></div></div>`;
  }).join('');
  modal(`<h3>Gespeicherte Builds: ${esc(CLASSES[treeCls].name)}</h3>
    <p class="small muted">Speichere deine aktuelle Sternenkarte (inkl. Meisterschaften und Juwelen) und wechsle mit einem Tippen. Aktuell: ${cur} Sterne.</p>
    ${save.run ? '<p class="note">Während eines Runs nicht möglich.</p>' : ''}
    <div class="col">${rows}</div><button class="btn" data-a="_close">Schließen</button>`);
}
on('tbuilds', () => showBuilds());
on('bSave', (d) => {
  if (save.run) return;
  const list = save.loadouts[treeCls];
  const i = Number(d.i);
  const name = list[i] ? list[i].name : `Build ${i + 1}`;
  list[i] = {
    name, alloc: [...save.alloc[treeCls]],
    mastery: { ...((save.mastery || {})[treeCls] || {}) },
    jewels: { ...((save.jewelSock || {})[treeCls] || {}) },
  };
  save.stats.buildsSaved = (save.stats.buildsSaved || 0) + 1;
  persist(); sfx.loot(); toast('Build gespeichert.');
  showBuilds();
});
on('bLoad', (d) => {
  if (save.run) return;
  const b = save.loadouts[treeCls][Number(d.i)];
  if (!b) return;
  const tree = getTree();
  const alloc = b.alloc.filter((id) => tree.nodes.has(id));
  if (alloc.length - 1 > totalPoints()) { sfx.deny(); toast('Nicht genug Sternpunkte für diesen Build.'); return; }
  save.alloc[treeCls] = alloc;
  save.mastery = save.mastery || {}; save.mastery[treeCls] = { ...b.mastery };
  const own = new Set((save.jewels || []).map((j) => j.uid));
  save.jewelSock = save.jewelSock || {};
  save.jewelSock[treeCls] = Object.fromEntries(Object.entries(b.jewels || {}).filter(([, u]) => own.has(u)));
  persist(); sfx.levelup(); closeModal();
  app.treeView.setAlloc(save.alloc[treeCls]);
  renderTreeUI();
  toast(`„${esc(b.name)}“ geladen.`);
});
on('bRen', (d) => {
  const b = save.loadouts[treeCls][Number(d.i)];
  if (!b) return;
  const n = prompt('Name des Builds:', b.name);
  if (n && n.trim()) { b.name = n.trim().slice(0, 24); persist(); }
  showBuilds();
});
on('bDel', (d) => {
  const i = Number(d.i);
  confirmBox('Diesen gespeicherten Build löschen?', 'Löschen', () => { save.loadouts[treeCls][i] = null; persist(); showBuilds(); });
});

// ===================================================================== Kodex
let codexTab = 'skills';
export function showCodex() {
  const tabs = [['skills', 'Runen'], ['supports', 'Glyphen'], ['ascend', 'Aufstieg'], ['uniques', 'Unikate'], ['sets', 'Sets'], ['archive', 'Archiv'], ['bestiary', 'Bestien']]
    .map(([k, n]) => `<button class="${codexTab === k ? 'on' : ''}" data-a="ctab" data-t="${k}">${n}</button>`).join('');
  let body = '';
  if (codexTab === 'skills') {
    body = Object.entries(SKILLS).map(([id, s]) => {
      const have = save.codex.skills.includes(id);
      return `<div class="panel ${have ? '' : 'locked'}"><div class="row between"><h3>${esc(s.name)}</h3>
        ${have ? '<span class="ok">✓ freigeschaltet</span>' : `<button class="btn small primary" data-a="cbuy" data-k="skills" data-id="${id}">✦ ${s.cost}</button>`}</div>
        ${skillInfo(id)}${EVOLUTIONS[id] ? `<div class="evolist">${['a', 'b'].map((k) => { const e = evoOf(id, k); const seen = (save.codex.evos || []).includes(`${id}:${k}`); return `<p class="small"><b class="evoline">✦ ${esc(e.name)}</b>${seen ? ' ✓' : ''} – ${esc(e.desc)}</p>`; }).join('')}</div>` : ''}</div>`;
    }).join('');
  } else if (codexTab === 'supports') {
    body = `<div class="gcards">${Object.entries(SUPPORTS).map(([id, s]) => {
      const have = save.codex.supports.includes(id);
      return glyphCard(id, have ? '<span class="ok">✓ freigeschaltet</span>' : `<button class="btn small primary" data-a="cbuy" data-k="supports" data-id="${id}">✦ ${s.cost}</button>`);
    }).join('')}</div>`;
  } else if (codexTab === 'ascend') {
    const gate = Object.values(save.stats.bossKills).some((v) => v > 0);
    body = (gate ? '' : '<p class="note">Besiege zuerst einen Boss, um Aufstiegsklassen freizuschalten.</p>') +
      Object.entries(ASCENDANCIES).map(([id, a]) => {
        const lvl = (save.ascend || {})[id] || 0;
        const c = CLASSES[a.cls];
        const nodes = a.nodes.map((n, i) => `<li class="${i < lvl ? 'up' : 'muted'}">${i < lvl ? '✓' : '○'} <b>${esc(n.name)}:</b> ${n.mods.map(modText).map(esc).join(', ')}</li>`).join('');
        const btn = lvl >= 5 ? '<span class="ok">VOLLENDET</span>' : `<button class="btn small ${gate && save.dust >= ASCEND_COST[lvl] ? 'primary' : 'disabled'}" data-a="ascBuy" data-id="${id}">Stufe ${lvl + 1}: ✦ ${fmt(ASCEND_COST[lvl])}</button>`;
        return `<div class="panel"><div class="row between"><div><h3 style="color:${c.color}">${c.glyph} ${esc(a.name)}</h3><small class="muted">${esc(c.name)} · ${esc(a.desc)}</small></div>${btn}</div><ul class="mods">${nodes}</ul></div>`;
      }).join('');
  } else if (codexTab === 'sets') {
    const found = save.codex.sets || [];
    body = Object.entries(SETS).map(([sid, st]) => `<div class="panel"><h3 style="color:${st.color}">${esc(st.name)}</h3>
      <ul class="mods">${st.pieces.map((p, i) => found.includes(`${sid}:${i}`) ? `<li class="u">✓ ${esc(p.name)} – ${p.mods.map(modText).map(esc).join(', ')}</li>` : '<li class="muted">○ ???</li>').join('')}</ul>
      ${Object.entries(st.bonus).map(([n, mods]) => `<p class="small setb">${n} Teile: ${mods.map(modText).map(esc).join(', ')}</p>`).join('')}</div>`).join('');
    body = `<p class="muted center small">Set-Teile findest du überall, wo es Beute gibt. Mehrere Teile desselben Sets schalten Boni frei.</p>${body}`;
  } else if (codexTab === 'archive') {
    body = archiveTab();
  } else if (codexTab === 'bestiary') {
    const kills = save.stats.enemyKills || {};
    const dex = Object.entries(ENEMIES).filter(([, e]) => !e.noDex);
    const known = dex.filter(([k]) => kills[k] > 0).length;
    body = `<p class="muted center">${known}/${dex.length} Gegnerarten entdeckt</p>` +
      dex.map(([k, e]) => kills[k] ? `<div class="srow"><span><b style="color:${e.color}">●</b> ${esc(e.name)}</span><b>${fmt(kills[k])}</b></div>` : `<div class="srow muted"><span>● ???</span><b>0</b></div>`).join('') +
      `<h3>Bosse</h3>` + Object.entries(BOSSES).map(([k, b]) => `<div class="srow"><span><b style="color:${b.color}">♛</b> ${save.stats.bossKills[k] ? esc(b.name) : '???'}</span><b>${save.stats.bossKills[k] || 0}</b></div>`).join('');
    body = `<div class="panel">${body}</div>`;
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
on('ascBuy', (d) => {
  const lvl = (save.ascend || {})[d.id] || 0;
  if (!Object.values(save.stats.bossKills).some((v) => v > 0)) { toast('Besiege zuerst einen Boss.'); return; }
  if (lvl >= 5 || save.dust < ASCEND_COST[lvl]) { sfx.deny(); toast(`Benötigt ✦ ${fmt(ASCEND_COST[lvl])}`); return; }
  save.dust -= ASCEND_COST[lvl];
  save.ascend = save.ascend || {};
  save.ascend[d.id] = lvl + 1;
  checkAchievements();
  persist(); sfx.levelup(); showCodex();
});
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
  screen(`${topbar('Altar der Sterne', 'hub', `<b class="dust">✦ ${fmt(save.dust)}</b>`)}<div class="pad">${paragonPanel()}${rows}</div>`);
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
  const tabs = `<div class="seg"><button class="${relicTab === 'relics' ? 'on' : ''}" data-a="rTab" data-t="relics">Relikte</button><button class="${relicTab === 'jewels' ? 'on' : ''}" data-a="rTab" data-t="jewels">Juwelen (${(save.jewels || []).length})</button></div>`;
  const body = relicTab === 'jewels' ? jewelsTab(app.jewelSel) : `<h3>Angelegt (${eq.length}/${slots})</h3><div class="rslots">${eqHtml}</div>
    <h3>Sammlung (${save.relics.length}/60)</h3><div class="rgrid">${inv || '<p class="muted">Noch keine Relikte.</p>'}</div>
    ${detail}`;
  screen(`${topbar('Relikte & Juwelen', 'hub', `<b class="dust">✦ ${fmt(save.dust)}</b>`)}<div class="pad">${tabs}${body}</div>`);
}
let relicTab = 'relics';
on('rTab', (d) => { relicTab = d.t; showRelics(); });
on('jSel', (d) => { app.jewelSel = d.u; showRelics(); });
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
    ${row('Höchste Turm-Etage', s.maxTower || 0)}${row('Turm-Wochensiege', s.towerWins || 0)}
    ${row('Boss-Rush', save.rush && save.rush.best ? `${save.rush.best.n}/10 · ${clock(save.rush.best.time)}` : '–')}${row('Höchste Jagdstufe (erlegt)', s.maxHunt || '–')}
    ${row('Besiegte Gegner', fmt(s.kills))}${row('Stärkster Treffer', fmt(s.maxHit))}${row('Höchste Run-Stufe', s.maxRunLvl)}
    ${Object.entries(BOSSES).map(([k, b]) => row(b.name, s.bossKills[k] || 0)).join('')}
    ${row('Spielzeit', `${h} h ${m} min`)}${row('Mythische Relikte', s.mythic)}</div>
    ${best ? `<div class="panel"><h3>Bester Run</h3><p>${esc(CLASSES[best.cls].name)} · ${best.mode === 'abyss' ? `Abgrund Ebene ${best.floor}` : resWhere(best) || (best.win ? 'Feldzug gewonnen' : 'Feldzug')} · Sternenhöhe ${best.asc} · Stufe ${best.lvl} · ${fmt(best.kills)} Gegner</p></div>` : ''}
    </div>`);
}

// ===================================================================== Einstellungen
export function showSettings() {
  const st = save.settings;
  const tg = (k, label) => `<button class="toggle ${st[k] ? 'on' : ''}" data-a="setTog" data-k="${k}"><span>${label}</span><i></i></button>`;
  screen(`${topbar('Einstellungen')}<div class="pad"><div class="panel">
    ${tg('sound', 'Ton')}${tg('vibrate', 'Vibration')}${tg('dmgNums', 'Schadenszahlen')}${tg('shake', 'Bildschirmwackeln')}</div>
    <div class="panel"><h3>Grafik</h3><div class="seg">${[['auto', 'Automatisch'], ['high', 'Pracht'], ['low', 'Schnell']].map(([k, n]) => `<button class="${(st.gfx || 'auto') === k ? 'on' : ''}" data-a="setGfx" data-k="${k}">${n}</button>`).join('')}</div>
    <p class="small muted">„Pracht“: Licht, Schatten und Atmosphäre. „Schnell“ für ältere Handys. „Automatisch“ wechselt bei Rucklern selbst.</p></div>
    <div class="panel"><h3>Spielstand</h3><p class="small muted">Dein Fortschritt liegt nur auf diesem Gerät. Sichere ihn gelegentlich als Text (z. B. in einer Notiz).</p>
    <div class="row"><button class="btn small" data-a="exp">Exportieren</button><button class="btn small" data-a="imp">Importieren</button></div>
    <button class="btn small danger" data-a="wipe">Alles löschen</button></div>
    <p class="muted small center">Runenfall · läuft komplett offline</p></div>`);
}
on('setTog', (d) => { save.settings[d.k] = !save.settings[d.k]; persist(); showSettings(); });
on('setGfx', (d) => { save.settings.gfx = d.k; app.combat.lowGfx = d.k === 'low'; persist(); showSettings(); });
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
