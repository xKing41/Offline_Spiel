// Einstiegspunkt: Spielschleife, Navigation, Kampfablauf, HUD.
import { app } from './app.js';
import { $, on, screen, hideScreen, modal, closeModal, modalOpen, toast } from './ui.js';
import { fmt } from './util.js';
import { save, persist, checkAchievements, altarLvl } from './save.js';
import { Combat } from './combat.js';
import { TreeView } from './treeview.js';
import { BOSSES } from './data/content.js';
import { RARITY } from './data/items.js';
import {
  newRun, snapshot, combatCfg, gainXp, xpNeed, rollRewards, healAfterFight, advanceAct, endRun, dropRelic, genAbyssChoices, priceMult,
  dropJewel, completeAtlas, atlasHas, setCountMax, nemesisSlain,
} from './run.js';
import { showHub, showSetup, showTree, showCodex, showAltar, showRelics, showAch, showStats, showSettings } from './ui-meta.js';
import { showAtlas, showPets } from './ui-endgame.js';
import { showBase, showCards, showNemesis, showSeason } from './ui-systems.js';
import { showMap, showBuild, showLevelUp, showRewards, showShop, showForge, showEvent, showRest, showSummary } from './ui-run.js';
import { sfx, buzz } from './audio.js';
import { towerCampAfter, RUSH_LEN, rushCampAfter, huntTile } from './data/modes.js';

const combat = new Combat($('#cv'));
const treeView = new TreeView($('#tree'));
app.combat = combat;
app.pauseMenu = () => showPauseMenu();
app.treeView = treeView;

// ===================================================================== Navigation
const SCREENS = {
  hub: showHub, setup: showSetup, tree: showTree, codex: showCodex, altar: showAltar, relics: showRelics,
  ach: showAch, stats: showStats, settings: showSettings, map: () => showMap(), atlas: showAtlas, pets: showPets,
  base: showBase, cards: showCards, nemesis: showNemesis, season: showSeason,
};
app.nav = (to) => {
  closeModal();
  if (to !== 'tree') treeView.close();
  if (to === 'map' && !save.run) to = 'hub';
  (SCREENS[to] || showHub)();
};
app.showMap = () => app.nav('map');

app.startRun = (opts) => {
  save.run = newRun(opts);
  persist();
  sfx.levelup();
  showMap();
};

app.continueRun = () => {
  const run = save.run;
  if (!run) return showHub();
  afterLevels(() => {
    const node = run.curNode;
    if (!node) return showMap();
    if (['fight', 'elite', 'boss'].includes(node.type)) app.startCombat(node);
    else if (node.type === 'shop') showShop(false);
    else if (node.type === 'forge') showForge();
    else if (node.type === 'event') showEvent();
    else if (node.type === 'rest') showRest();
    else showMap();
  });
};

app.abandonRun = () => {
  if (!save.run) return showHub();
  finishRun('abandon');
};

/** Offene Stufenaufstiege nacheinander abarbeiten. */
function afterLevels(next) {
  if (save.run && save.run.pendingLvl > 0) { hideScreen(); showLevelUp(next); }
  else next();
}

// ===================================================================== Kampf
let fightRelics = [];
app.startCombat = (node) => {
  const run = save.run;
  closeModal();
  hideScreen();
  treeView.close();
  const snap = snapshot(run);
  const cfg = combatCfg(run, node);
  fightRelics = [];
  $('#hud').classList.add('show');
  $('#hBoss').classList.add('hidden');
  $('#hTitle').textContent = cfg.kind === 'boss' ? BOSSES[cfg.bossId].name : cfg.label;
  combat.start(cfg, snap.P, snap.skills, run.hp, {
    onXp(v) {
      const ups = gainXp(run, v * combat.P.xpMult);
      if (ups && !combat.over) {
        combat.paused = true;
        buzz(30);
        setTimeout(() => showLevelUp(() => { refreshCombatStats(); combat.paused = false; }), 120);
      }
    },
    onGold(v) { const g = Math.round(v * combat.P.goldMult); run.gold += g; run.stats.gold = (run.stats.gold || 0) + g; },
    onEliteKill() {
      run.stats.elites++;
      const r = dropRelic(run, 0.06 + 0.04 * altarLvl('relicfind') + (atlasHas('aRelic') ? 0.05 : 0));
      if (r) { fightRelics.push(r); toast(`<b style="color:${RARITY[r.rarity].color}">◈ Relikt gefunden!</b>`); sfx.loot(); }
      const j = dropJewel(run, 0.03 + (atlasHas('aJewel') ? 0.04 : 0));
      if (j) { toast(`<b style="color:${RARITY[j.rarity].color}">⬢ Juwel gefunden!</b>`); sfx.loot(); }
    },
    onNemesisKill(n) {
      const r = nemesisSlain(run, n.uid);
      if (r) { toast(`<b style="color:#ff5d5d">☠ Erzfeind ${n.name} vernichtet!</b><br>Mythischer Gegenstand erbeutet`); sfx.loot(); buzz(60); }
    },
    onBoss(e) {
      $('#hBoss').classList.remove('hidden');
      $('#hBossName').textContent = e.name;
    },
    onDeath() {
      if (run.revive) {
        run.revive = false;
        run.usedRevive = true;
        combat.player.hp = combat.P.maxLife * 0.5;
        return true;
      }
      return false;
    },
    onWin(stats) { if (run.rush) run.rush.time += combat.t; addStats(stats); fightWon(node, cfg); },
    onLose(stats) { if (run.rush) run.rush.time += combat.t; addStats(stats); run.killer = combat.killer || null; $('#hud').classList.remove('show'); combat.cfg = null; finishRun('death'); },
  });
  last = performance.now();
};

function refreshCombatStats() {
  const snap = snapshot(save.run);
  combat.setPlayerStats(snap.P);
  combat.setSkills(snap.skills);
}

function addStats(st) {
  const run = save.run;
  run.stats.kills += st.kills;
  run.stats.maxHit = Math.max(run.stats.maxHit, st.maxHit);
  run.stats.dmg += st.dmgDone;
  run.stats.maxSet = Math.max(run.stats.maxSet || 0, setCountMax(run));
  run.stats.byType = run.stats.byType || {};
  for (const [k, v] of Object.entries(st.byType || {})) run.stats.byType[k] = (run.stats.byType[k] || 0) + v;
  run.hp = Math.max(1, combat.player.hp);
}

function fightWon(node, cfg) {
  const run = save.run;
  $('#hud').classList.remove('show');
  combat.cfg = null;
  run.stats.nodes++;
  const boss = cfg.kind === 'boss';
  if (run.shrine && run.shrine.fights > 0) { run.shrine.fights--; if (run.shrine.fights <= 0) run.shrine = null; }
  if (boss) {
    run.stats.bosses++;
    if (combat.stats.hitsTaken === 0) save.stats.flawless = (save.stats.flawless || 0) + 1;
    if (dropJewel(run, node.lair ? 1 : 0.25 + (atlasHas('aJewel') ? 0.2 : 0))) toast('⬢ Juwel gefunden!');
    if (Math.random() < 0.08 + (atlasHas('aEgg') ? 0.1 : 0)) { run.eggs = (run.eggs || 0) + 1; toast('🥚 Ein Gefährten-Ei!'); }
    if (run.mode === 'normal' && run.act >= 3 && run.atlas) completeAtlas(run);
    if (Math.random() < 0.3 + (BOSSES[cfg.bossId].beast ? 0.4 : 0)) { run.packs = (run.packs || 0) + 1; toast('🂠 Ein Schicksalskartenpack!'); }
    if (BOSSES[cfg.bossId].beast) save.stats.beasts = (save.stats.beasts || 0) + 1;
    save.stats.bossKills[cfg.bossId] = (save.stats.bossKills[cfg.bossId] || 0) + 1;
    const r = dropRelic(run, run.mode === 'rush' ? 0.35 : 1);
    if (r) fightRelics.push(r);
  } else healAfterFight(run);
  persist();
  const relicTxt = fightRelics.length ? `<br><b style="color:${RARITY[fightRelics[0].rarity].color}">◈ Relikt erhalten: ${fightRelics[0].title}</b>` : '';
  const info = `${cfg.kind === 'boss' ? BOSSES[cfg.bossId].name + ' besiegt!' : cfg.kind === 'elite' ? 'Elite bezwungen' : 'Gebiet gesäubert'}${relicTxt}`;
  afterLevels(() => {
    const rkind = node.arena ? 'arena' : cfg.trial ? 'trial' : cfg.kind;
    showRewards(rollRewards(run, rkind), info, () => {
      if (node.arena) { run.curNode = null; return app.finishNode(); }
      run.curNode = null;
      if (run.mode === 'abyss') {
        run.floor++;
        run.abyssChoices = genAbyssChoices(run);
        if (boss) run.hp = snapshot(run).P.maxLife;
        persist();
        return showMap();
      }
      if (run.mode === 'tower') {
        if (towerCampAfter(run.floor)) run.towerCamp = true;
        run.floor++;
        if (boss) run.hp = snapshot(run).P.maxLife;
        persist();
        return showMap();
      }
      if (run.mode === 'rush') {
        if (rushCampAfter(run.rush.idx)) run.rushCamp = true;
        run.rush.idx++;
        if (run.rush.idx >= RUSH_LEN) { persist(); return finishRun('win'); }
        // Zwischen den Bossen: zwei freie Stufen und volle Heilung
        run.lvl += 2; run.pendingLvl += 2;
        persist();
        return afterLevels(() => { run.hp = snapshot(run).P.maxLife; persist(); showMap(); });
      }
      if (run.mode === 'hunt') {
        const t = huntTile(run.hunt, run.hunt.x, run.hunt.y);
        if (t) t.done = true;
        if (node.lair) { persist(); return finishRun('win'); }
        persist();
        return showMap();
      }
      if (boss) {
        const won = advanceAct(run);
        persist();
        if (won) return finishRun('win');
        toast(`Akt ${run.act + 1} beginnt …`);
      }
      persist();
      showMap();
    });
  });
}

function finishRun(outcome) {
  const run = save.run;
  const jewelIds = run.stats.jewels || [];
  const res = endRun(run, outcome);
  const relics = run.stats.relics.map((u) => save.relics.find((r) => r.uid === u)).filter(Boolean);
  res.jewelList = jewelIds.map((u) => (save.jewels || []).find((j) => j.uid === u)).filter(Boolean);
  if (outcome === 'win') sfx.win();
  showSummary(res, relics);
}

// ===================================================================== HUD
const H = {
  hp: $('#hpFill'), bar: $('#barFill'), hpTxt: $('#hpTxt'), xp: $('#xpFill'), lvl: $('#hLvl'), time: $('#hTime'),
  obj: $('#hObj'), boss: $('#hBossFill'), bossWrap: $('#hBoss'),
};
let hudCache = '';
function updateHud() {
  const run = save.run, p = combat.player, P = combat.P;
  if (!run || !p) return;
  const tot = P.maxLife + P.maxBarrier;
  const left = combat.cfg && combat.cfg.kind !== 'boss' ? Math.max(0, Math.ceil(combat.cfg.duration - combat.t)) : null;
  const key = `${Math.ceil(p.hp)}|${Math.ceil(p.barrier)}|${run.xp.toFixed(1)}|${run.lvl}|${left}|${combat.objective}|${combat.boss ? Math.ceil(combat.boss.hp) : ''}`;
  if (key === hudCache) return;
  hudCache = key;
  H.hp.style.width = `${(Math.max(0, p.hp) / tot) * 100}%`;
  H.bar.style.left = `${(Math.max(0, p.hp) / tot) * 100}%`;
  H.bar.style.width = `${(p.barrier / tot) * 100}%`;
  H.hpTxt.textContent = `${fmt(Math.ceil(Math.max(0, p.hp)))}${P.maxBarrier ? " + " + fmt(Math.floor(p.barrier)) : ""} / ${fmt(Math.round(P.maxLife))}`;
  H.xp.style.width = `${(run.xp / xpNeed(run.lvl)) * 100}%`;
  H.lvl.textContent = `Stufe ${run.lvl}`;
  H.time.textContent = left !== null ? (left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '') : '';
  H.obj.textContent = combat.objective || '';
  if (combat.boss) H.boss.style.width = `${(Math.max(0, combat.boss.hp) / combat.boss.maxHp) * 100}%`;
}

on('hpause', () => pauseCombat());
function pauseCombat() {
  if (!combat.running || combat.over || combat.paused) return;
  combat.paused = true;
  showPauseMenu();
}
function showPauseMenu() {
  hideScreen();
  modal(`<h2>Pause</h2><div class="col">
    <button class="btn primary" data-a="resume">Weiter</button>
    <button class="btn" data-a="pbuild">⚒ Build ansehen</button>
    <button class="btn ghost" data-a="pquit">Zur Sternwarte (Kampf wird neu gestartet)</button></div>`);
}
on('resume', () => { closeModal(); hideScreen(); refreshCombatStats(); combat.paused = false; last = performance.now(); });
on('pbuild', () => { closeModal(); showBuild('combat'); });
on('pquit', () => {
  closeModal();
  combat.running = false;
  combat.cfg = null;
  $('#hud').classList.remove('show');
  persist();
  app.nav('hub');
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { pauseCombat(); persist(); } });
window.addEventListener('pagehide', () => persist());

// ===================================================================== Schleife
let last = performance.now();
// Automatische Grafikqualität: bei dauerhaft niedriger Bildrate auf „Schnell“ wechseln.
let frameAvg = 1 / 60, slowT = 0;
combat.lowGfx = save.settings.gfx === 'low';
function autoGfx(dt) {
  if (save.settings.gfx !== 'auto' || combat.lowGfx) return;
  frameAvg = frameAvg * 0.96 + dt * 0.04;
  slowT = frameAvg > 1 / 38 ? slowT + dt : 0;
  if (slowT > 3) { combat.lowGfx = true; toast('Grafik automatisch auf „Schnell“ gestellt'); }
}
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  if (combat.running) {
    autoGfx(dt);
    combat.update(dt);
    combat.render();
    updateHud();
  } else if (treeView.active) {
    treeView.render();
  } else {
    combat.render();
  }
  requestAnimationFrame(frame);
}

// ===================================================================== Start
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
const cap = window.Capacitor;
if (cap && cap.Plugins && cap.Plugins.App) {
  cap.Plugins.App.addListener('backButton', () => {
    if (combat.running && !combat.paused) return pauseCombat();
    if (modalOpen()) { if (combat.running) return; return closeModal(); }
    if (combat.running) return;
    const back = document.querySelector('.topbar [data-a="nav"], .topbar [data-a="buildBack"]');
    if (back) back.click();
    else if (document.querySelector('.hubscreen')) cap.Plugins.App.exitApp();
    else app.nav(save.run ? 'map' : 'hub');
  });
}

checkAchievements();
persist();
app.nav('hub');
requestAnimationFrame(frame);
if (location.hash === '#debug') window.__rf = { app, save: () => save, combat, treeView, snapshot };
