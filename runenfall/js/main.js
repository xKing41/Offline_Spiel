// Einstiegspunkt: Spielschleife, Navigation, Kampfablauf, HUD.
import { app } from './app.js';
import { $, on, screen, hideScreen, modal, closeModal, modalOpen, toast, helpBtn } from './ui.js';
import { fmt } from './util.js';
import { checkDeeds } from './data/deeds.js';
import { save, persist, checkAchievements, altarLvl } from './save.js';
import { Combat } from './combat.js';
import { TreeView } from './treeview.js';
import { BOSSES, PINNACLES } from './data/content.js';
import { RARITY } from './data/items.js';
import {
  newRun, snapshot, combatCfg, gainXp, xpNeed, rollRewards, healAfterFight, advanceAct, endRun, dropRelic, genAbyssChoices, priceMult,
  dropJewel, completeAtlas, atlasHas, setCountMax, nemesisSlain, actInfo, bossHeal,
} from './run.js';
import { showHub, showSetup, showTree, showCodex, showAltar, showRelics, showAch, showStats, showSettings } from './ui-meta.js';
import { showAtlas, showPets } from './ui-endgame.js';
import { showBase, showCards, showNemesis, showSeason } from './ui-systems.js';
import { showMap, showBuild, showLevelUp, showRewards, showShop, showForge, showEvent, showRest, showSummary } from './ui-run.js';
import { sfx, buzz } from './audio.js';
import { towerCampAfter, RUSH_LEN, rushCampAfter, huntTile } from './data/modes.js';
import { showFactions, showStory } from './ui-factions.js';
import { showCompendium } from './ui-compendium.js';
import { showOverview } from './ui-overview.js';
import { coach, welcome } from './coach.js';
import { mergeAn, analysisHtml } from './analysis.js';
import { dailyBackup } from './backup.js';
import { music } from './music.js';

const combat = new Combat($('#cv'));
const treeView = new TreeView($('#tree'));
app.combat = combat;
app.pauseMenu = () => showPauseMenu();
app.treeView = treeView;

// ===================================================================== Navigation
const SCREENS = {
  hub: showHub, setup: showSetup, tree: showTree, codex: showCodex, altar: showAltar, relics: showRelics,
  ach: showAch, stats: showStats, settings: showSettings, map: () => showMap(), atlas: showAtlas, pets: showPets,
  base: showBase, cards: showCards, nemesis: showNemesis, season: showSeason, factions: showFactions, story: showStory, compendium: () => showCompendium(), overview: showOverview,
};
app.nav = (to) => {
  closeModal();
  if (to !== 'tree') treeView.close();
  if (to === 'map' && !save.run) to = 'hub';
  (SCREENS[to] || showHub)();
  if (['setup', 'tree', 'codex', 'altar', 'relics', 'base', 'cards', 'nemesis', 'season', 'atlas', 'pets', 'factions', 'story'].includes(to)) coach(to);
  if (to === 'map') runMusic(0.15); else if (to !== 'tree' || !save.run) { music.play('menu'); music.setIntensity(0.3); }
};
/** Musik des laufenden Runs (Biom bzw. Abgrund) in ruhiger oder wilder Fassung. */
function runMusic(x) {
  const run = save.run;
  if (!run) return;
  music.play(run.mode === 'abyss' ? 'abyss' : actInfo(run).biomeId);
  music.setIntensity(x);
}
app.runMusic = runMusic;
app.resetClock = () => { last = performance.now(); };
app.showMap = () => app.nav('map');

app.startRun = (opts) => {
  save.run = newRun(opts);
  persist();
  sfx.levelup();
  runMusic(0.15);
  showMap();
};

app.continueRun = () => {
  const run = save.run;
  if (!run) return showHub();
  runMusic(0.15);
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
  // Musik: Boss-Thema, Endgegner/Bestie, sonst das Biom in Kampf-Fassung
  if (cfg.kind === 'boss') music.play(PINNACLES[cfg.bossId] || String(cfg.bossId).startsWith('beast_') ? 'pinnacle' : 'boss');
  else music.play(run.mode === 'abyss' ? 'abyss' : cfg.biome);
  music.setIntensity(cfg.kind === 'fight' ? 0.4 : 0.65);
  combat.start(cfg, snap.P, snap.skills, run.hp, {
    onXp(v) {
      const ups = gainXp(run, v * combat.P.xpMult);
      if (ups && !combat.over) {
        combat.paused = true;
        buzz(30);
        music.stinger('levelup');
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
      coach('boss');
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
    onLose(stats) { music.stinger('death'); if (run.rush) run.rush.time += combat.t; addStats(stats); run.killer = combat.killer || null; $('#hud').classList.remove('show'); combat.cfg = null; finishRun('death'); },
  });
  last = performance.now();
  // Einführung im ersten Kampf
  if (!save.hints || !save.hints.move) setTimeout(() => coach('move'), 700);
  else if (!save.hints.orbs) setTimeout(() => { if (combat.running) coach('orbs'); }, 5000);
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
  run.stats.an = mergeAn(run.stats.an, st.an, combat.t);
  run.lastAn = { an: st.an, t: combat.t };
  run.hp = Math.max(1, combat.player.hp);
}

function fightWon(node, cfg) {
  const run = save.run;
  $('#hud').classList.remove('show');
  combat.cfg = null;
  run.stats.nodes++;
  const boss = cfg.kind === 'boss';
  if (boss) music.stinger('bossdown');
  runMusic(0.15);
  if (run.shrine && run.shrine.fights > 0) { run.shrine.fights--; if (run.shrine.fights <= 0) run.shrine = null; }
  if (boss) {
    run.stats.bosses++;
    checkDeeds(run, 'boss').forEach((d, i) => setTimeout(() => toast(`✦ Tat vollbracht! Freigeschaltet: ${d.reward}`), 300 + i * 1600));
    if (combat.stats.hitsTaken === 0) { save.stats.flawless = (save.stats.flawless || 0) + 1; run.stats.flawless = (run.stats.flawless || 0) + 1; }
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
        if (boss) bossHeal(run);
        persist();
        return showMap();
      }
      if (run.mode === 'tower') {
        if (towerCampAfter(run.floor)) run.towerCamp = true;
        run.floor++;
        if (boss) bossHeal(run);
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
  music.play(outcome === 'win' ? 'victory' : 'defeat');
  showSummary(res, relics);
  if (outcome !== 'win') coach('death');
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
    <button class="btn" data-a="pAnalysis">📊 Schadensanalyse</button>
    <button class="btn" data-a="pHelp">📖 Hilfe</button>
    <button class="btn ghost" data-a="pquit">Zur Sternwarte (Kampf wird neu gestartet)</button></div>`);
}
on('resume', () => { closeModal(); hideScreen(); refreshCombatStats(); combat.paused = false; last = performance.now(); });
on('pbuild', () => { closeModal(); showBuild('combat'); });
on('pAnalysis', () => {
  modal(`<h2>📊 Dieser Kampf</h2>${analysisHtml(combat.stats.an, combat.t, save.run)}<div class="col"><button class="btn primary" data-a="pAnBack">Zurück</button></div>`);
});
on('pAnBack', () => showPauseMenu());
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
let musicT = 0;
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
    // Musik-Intensität folgt dem Getümmel
    musicT -= dt;
    if (musicT <= 0) { musicT = 0.5; music.setIntensity(Math.min(1, 0.3 + combat.enemies.length / 45 + (combat.boss && !combat.boss.dead ? 0.35 : 0) + (combat.player && combat.player.hp < combat.P.maxLife * 0.35 ? 0.15 : 0))); }
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
    const coachOk = document.querySelector('#coach.show #coachOk');
    if (coachOk) return coachOk.click();
    if (combat.running && !combat.paused) return pauseCombat();
    if (modalOpen()) { if (combat.running) return; return closeModal(); }
    if (combat.running) return;
    const back = document.querySelector('.topbar [data-a="nav"], .topbar [data-a="buildBack"], .topbar [data-a="compList"]');
    if (back) back.click();
    else if (document.querySelector('.hubscreen')) cap.Plugins.App.exitApp();
    else app.nav(save.run ? 'map' : 'hub');
  });
}

checkAchievements();
persist();

/** Einmaliger Hinweis nach dem Umbau „Tiefe statt Breite“. */
// Neuigkeiten seit dem letzten Öffnen (einmalig, neueste zuerst)
const NEWS = [
  { v: 1, title: 'Tiefe statt Breite', items: [
    '<b>Segen-Pfade:</b> Zehn Pfade (Glut, Frost, Geschosse, Legion …) mit je vier Stufen. Ab Stufe II verändern sie, wie dein Build funktioniert. Bis zu drei Pfade pro Run.',
    '<b>Runen gezielt:</b> Angebote passen zu deinen Pfaden.',
    '<b>Sternenkarte neu:</b> kompakt, Keystones nach rund 20 Punkten erreichbar, Notables mit Bedingungen. Deine Punkte wurden zurückerstattet.',
    '<b>Kontomacht neu:</b> Altar, Relikte, Juwelen, Sternenmacht, Häuser, Gefährten, Karten und Tränke geben weniger allgemeine Werte – deine Entscheidungen im Run zählen.',
  ] },
  { v: 2, title: 'Kombinationen ohne Ende', items: [
    '<b>Runen verschmelzen:</b> Mit ⟁ im Build geht eine Rune als <b>Echo</b> in eine andere über und löst bei deren Treffern am Trefferort aus. Echos können selbst Echos tragen – Feuerball → Frostnova → Kettenblitz. Verschmelzen gibt einen Runenplatz frei.',
    '<b>Waffenkünste:</b> Jede Waffenart verändert deine Echos. Verschmilzt du Waffen verschiedener Art, entsteht eine Hybridwaffe mit mehreren Künsten.',
    '<b>Taten:</b> Meisterstücke (Pfad-Stufe IV), Bund-Segen und tiefere Echo-Ebenen schaltest du durch Taten frei – z. B. einen Boss mit zwei Pfaden auf Stufe II besiegen. Alle Taten stehen unter Erfolge.',
    '<b>Sternenhöhe pro Klasse:</b> Jede Klasse hat ihre eigene Leiter mit 20 Höhen, jede Höhe bringt eine neue Regel. Meilensteine geben Sternpunkte.',
  ] },
];
function updateNotice() {
  const latest = NEWS[NEWS.length - 1].v;
  if (save.newsSeen === undefined) save.newsSeen = save.metaNote ? 0 : save.stats.runs > 0 ? 1 : latest;
  const show = NEWS.filter((n) => n.v > save.newsSeen).reverse();
  if (!show.length) return;
  const refund = (save.metaNote && save.metaNote.refund) || 0;
  modal(`<h2 class="center">✦ Neu in Runenfall ✦</h2>
    ${show.map((n) => `<h3>${n.title}</h3><ul class="mods updlist">${n.items.map((t) => `<li>${t}</li>`).join('')}</ul>`).join('')}
    ${refund ? `<p class="small">Für Altar-Stufen über dem neuen Höchstwert hast du <b class="dust">✦ ${fmt(refund)}</b> Sternenstaub zurückbekommen.</p>` : ''}
    <div class="row between helprow"><span class="small muted">Runen verschmelzen erklärt</span>${helpBtn('fusion')}</div>
    <button class="btn primary" data-a="_close">Verstanden</button>`, 'helpmodal');
  save.newsSeen = latest; save.metaNote = null; save.treeReset = false;
  persist();
}
// Start: Sternwarte zeigen, dann Willkommen (neu) oder Neuigkeiten (bestehende Spielstände)
dailyBackup();
app.nav('hub');
if (!welcome(() => app.nav('setup'))) updateNotice();
requestAnimationFrame(frame);
if (location.hash === '#debug') window.__rf = { app, save: () => save, combat, treeView, snapshot };
