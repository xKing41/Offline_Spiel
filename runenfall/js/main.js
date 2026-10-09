// Einstiegspunkt: Spielschleife, Navigation, Kampfablauf, HUD.
import { app } from './app.js';
import { $, on, screen, hideScreen, modal, closeModal, modalOpen, toast } from './ui.js';
import { fmt } from './util.js';
import { save, persist, checkAchievements } from './save.js';
import { Combat } from './combat.js';
import { TreeView } from './treeview.js';
import { BOSSES } from './data/content.js';
import { RARITY } from './data/items.js';
import {
  newRun, snapshot, combatCfg, gainXp, xpNeed, rollRewards, healAfterFight, advanceAct, endRun, dropRelic, genAbyssChoices, priceMult,
} from './run.js';
import { showHub, showSetup, showTree, showCodex, showAltar, showRelics, showAch, showStats, showSettings } from './ui-meta.js';
import { showMap, showBuild, showLevelUp, showRewards, showShop, showForge, showEvent, showRest, showSummary } from './ui-run.js';
import { sfx, buzz } from './audio.js';

const combat = new Combat($('#cv'));
const treeView = new TreeView($('#tree'));
app.combat = combat;
app.pauseMenu = () => showPauseMenu();
app.treeView = treeView;

// ===================================================================== Navigation
const SCREENS = {
  hub: showHub, setup: showSetup, tree: showTree, codex: showCodex, altar: showAltar, relics: showRelics,
  ach: showAch, stats: showStats, settings: showSettings, map: () => showMap(),
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
    onGold(v) { run.gold += Math.round(v * combat.P.goldMult); },
    onEliteKill() {
      run.stats.elites++;
      const r = dropRelic(run, 0.06);
      if (r) { fightRelics.push(r); toast(`<b style="color:${RARITY[r.rarity].color}">◈ Relikt gefunden!</b>`); sfx.loot(); }
    },
    onBoss(e) {
      $('#hBoss').classList.remove('hidden');
      $('#hBossName').textContent = e.name;
    },
    onDeath() {
      if (run.revive) {
        run.revive = false;
        combat.player.hp = combat.P.maxLife * 0.5;
        return true;
      }
      return false;
    },
    onWin(stats) { addStats(stats); fightWon(node, cfg); },
    onLose(stats) { addStats(stats); $('#hud').classList.remove('show'); combat.cfg = null; finishRun('death'); },
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
  run.hp = Math.max(1, combat.player.hp);
}

function fightWon(node, cfg) {
  const run = save.run;
  $('#hud').classList.remove('show');
  combat.cfg = null;
  run.stats.nodes++;
  const boss = cfg.kind === 'boss';
  if (boss) {
    run.stats.bosses++;
    save.stats.bossKills[cfg.bossId] = (save.stats.bossKills[cfg.bossId] || 0) + 1;
    const r = dropRelic(run, 1);
    if (r) fightRelics.push(r);
  } else healAfterFight(run);
  persist();
  const relicTxt = fightRelics.length ? `<br><b style="color:${RARITY[fightRelics[0].rarity].color}">◈ Relikt erhalten: ${fightRelics[0].title}</b>` : '';
  const info = `${cfg.kind === 'boss' ? BOSSES[cfg.bossId].name + ' besiegt!' : cfg.kind === 'elite' ? 'Elite bezwungen' : 'Gebiet gesäubert'}${relicTxt}`;
  afterLevels(() => {
    showRewards(rollRewards(run, cfg.kind), info, () => {
      run.curNode = null;
      if (run.mode === 'abyss') {
        run.floor++;
        run.abyssChoices = genAbyssChoices(run);
        if (boss) run.hp = snapshot(run).P.maxLife;
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
  const relics = run.stats.relics.map((u) => save.relics.find((r) => r.uid === u)).filter(Boolean);
  const res = endRun(run, outcome);
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
  H.hpTxt.textContent = `${fmt(Math.max(0, p.hp))}${P.maxBarrier ? ' + ' + fmt(p.barrier) : ''} / ${fmt(P.maxLife)}`;
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
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  if (combat.running) {
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
