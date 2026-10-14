// Oberflächen der Spielmodi: Sternenturm (mit Wochen-Bestenliste), Boss-Rush und Sternenjagd.
import { app } from './app.js';
import { on, screen, modal, closeModal, toast, confirmBox } from './ui.js';
import { esc, fmt, clock, clamp } from './util.js';
import { save, persist, checkAchievements } from './save.js';
import { CLASSES, BIOMES } from './data/content.js';
import {
  MODE_INFO, MODE_IDS, modeLock, ensureBoss, towerState, towerBoard, towerFloor, towerPower, lawName, lawDesc, TOWER_MILES, rankReward, weekStart,
  RUSH_LEN, RUSH_POWER, HUNT_TILES, HUNT_SHARDS, huntMoves, huntTile, huntReveal, huntArrow, followTrack, huntPower, huntSteps, huntDist,
} from './data/modes.js';
import { NODE_TYPES, towerAnchor, addRes } from './run.js';
import { runHeader, enterNode } from './ui-run.js';
import { grantPack } from './ui-systems.js';
import { sfx, buzz } from './audio.js';

const R = () => save.run;
const clsGlyph = (c) => (CLASSES[c] ? `<span style="color:${CLASSES[c].color}">${CLASSES[c].glyph}</span>` : '·');

// ===================================================================== Beschriftungen
/** Ortsangabe eines laufenden Runs (null = Standard). */
export function modeWhere(run) {
  if (run.mode === 'tower') return `Sternenturm · Etage ${run.floor}`;
  if (run.mode === 'rush') return `Boss-Rush · ${Math.min(run.rush.idx + 1, RUSH_LEN)}/${RUSH_LEN}`;
  if (run.mode === 'hunt') return `Sternenjagd · Jagdstufe ${run.hunt.tier}`;
  return null;
}
/** Ortsangabe in der Zusammenfassung. */
export function resWhere(res) {
  if (res.mode === 'tower') return `Sternenturm · ${res.depth} ${res.depth === 1 ? 'Etage' : 'Etagen'} erklommen`;
  if (res.mode === 'rush') return res.win ? 'Alle Bosse bezwungen' : `Boss-Rush · ${res.depth}/${RUSH_LEN} Bosse`;
  if (res.mode === 'hunt') return `${res.win ? 'Bestie erlegt' : 'Sternenjagd'} · Jagdstufe ${res.tier}`;
  return null;
}
const weekLeft = () => {
  const ms = weekStart() + 7 * 86400000 - Date.now();
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `noch ${d} T ${h} Std` : `noch ${h} Std`;
};

// ===================================================================== Run vorbereiten
export function modeGrid(setup) {
  return `<div class="modes">${MODE_IDS.map((id) => {
    const M = MODE_INFO[id], lock = modeLock(id, save);
    return `<button class="mode ${setup.mode === id ? 'on' : ''} ${lock ? 'locked' : ''}" data-a="mode" data-m="${id}">
      <span>${M.icon}</span><b>${esc(M.name)}</b><small>${lock ? '🔒 ' + esc(lock) : esc(M.short)}</small></button>`;
  }).join('')}</div><p class="small muted">${esc(MODE_INFO[setup.mode].desc)}</p>`;
}

/** Zusatzfeld je Modus auf dem Vorbereitungs-Bildschirm. */
export function modePanel(setup) {
  if (setup.mode === 'tower') {
    const T = towerState(save, towerAnchor());
    persist();
    const board = towerBoard(T), me = board.find((r) => r.me);
    const top = board.slice(0, 4);
    if (!top.includes(me)) top.push(me);
    const floors = [1, 2, 3, 4, 5, 6].map((f) => towerFloor(T.key, f)).map((F) => `<div class="tfl t-${F.type}"><b>${F.f}</b><span>${NODE_TYPES[F.type].icon}</span><small>${esc(lawName(F.law))}</small></div>`).join('');
    return `<div class="panel tower"><div class="row between"><h3>♜ Wochenturm ${esc(T.key.slice(-3))}</h3><small class="muted">${weekLeft()}</small></div>
      <p class="small">Deine Bestleistung: <b>${T.best ? `Etage ${T.best}` : '—'}</b> · Platz <b class="gold">${me.rank}</b> von ${board.length}</p>
      <div class="board">${top.map(boardRow).join('')}</div>
      <button class="btn small" data-a="towerBoard">Ganze Bestenliste</button>
      <div class="tfls">${floors}</div>
      <p class="small muted">Alle Spieler bekommen diese Woche denselben Turm. Jede Etage hat ein eigenes Gesetz, Prophezeiungen gelten hier nicht. Alle 5 Etagen ein Boss, nach jeder dritten Etage ein Rastplatz. Etagen ${TOWER_MILES.slice(0, 4).join(', ')} … geben einmal pro Woche eine Turmtruhe.</p></div>`;
  }
  if (setup.mode === 'rush') {
    const b = save.rush && save.rush.best;
    return `<div class="panel"><h3>♛ Boss-Rush</h3>
      <p class="small">${b ? `Bestleistung: <b>${b.n}/${RUSH_LEN}</b> Bosse in <b>${clock(b.time)}</b> (${esc(CLASSES[b.cls].name)}${b.asc ? `, Höhe ${b.asc}` : ''})` : 'Noch kein Versuch.'}</p>
      <p class="small muted">Du startest auf Stufe 8 mit einer zweiten Rune, zwei Glyphen und Grundausrüstung. Nach jedem Boss: volle Heilung, zwei freie Stufen und Beute. Nach jedem dritten Boss ein Rastplatz. Gemessen wird die reine Kampfzeit.</p></div>`;
  }
  if (setup.mode === 'hunt') {
    const max = (save.hunt && save.hunt.tier) || 1;
    setup.tier = clamp(setup.tier || max, 1, max);
    const t = setup.tier;
    return `<div class="panel"><h3>✧ Jagdstufe ${t}</h3>
      <div class="stepper"><button class="icon" data-a="huntTier" data-d="-1">−</button>
        <div class="ascbar">${Array.from({ length: Math.min(max, 20) }, (_, i) => `<i class="${i < t ? 'on' : ''}"></i>`).join('')}</div>
        <button class="icon" data-a="huntTier" data-d="1">+</button></div>
      <p class="small muted">Gegnerstärke ×${fmt(huntPower(t, 0))} am Lager bis ×${fmt(huntPower(t, 12))} am Kartenrand · Staub +${t * 25}% (+50% bei Erfolg). Folge Spuren (⋯) zum Hort der Bestie, Sternsplitter (✦) schwächen sie. Nach ${huntSteps(t)} Schritten findet die Bestie dich. Jeder Erfolg schaltet die nächste Stufe frei.</p></div>`;
  }
  return '';
}

const boardRow = (r) => `<div class="brow ${r.me ? 'me' : ''}"><span class="br">${r.rank}</span>${clsGlyph(r.cls)}<b>${esc(r.name)}</b><em>${r.floor ? `Etage ${r.floor}` : '—'}</em></div>`;

export function towerBoardModal() {
  const T = towerState(save, towerAnchor());
  persist();
  const board = towerBoard(T);
  const rewards = [[1, 'Platz 1'], [2, 'Platz 2–3'], [4, 'Platz 4–8'], [9, 'ab Platz 9']].map(([rk, l]) => `<div class="srow"><span>${l}</span><b>${esc(rankReward(rk).label)}</b></div>`).join('');
  modal(`<h2 class="center">♜ Sternenturm</h2><p class="small muted center">Woche ${esc(T.key)} · ${weekLeft()} · Die Rivalen klettern im Laufe der Woche weiter.</p>
    <div class="board">${board.map(boardRow).join('')}</div>
    <h3>Wochenbelohnung</h3><div class="small">${rewards}</div>
    <div class="col"><button class="btn primary" data-a="towerStart">Zum Turm</button><button class="btn ghost" data-a="_close">Schließen</button></div>`);
}
on('towerBoard', () => towerBoardModal());
on('towerStart', () => { closeModal(); if (save.run) { toast('Beende zuerst deinen laufenden Run.'); return; } app.setupMode = 'tower'; app.nav('setup'); });

// ===================================================================== Sternwarte
/** Hinweis auf die Wochenwertung und Turm-Kachel. */
export function towerClaimPanel() {
  const T = towerState(save, towerAnchor());
  const L = T.last;
  if (!L || L.claimed) return '';
  return `<div class="panel claim"><h3>♜ Wochenwertung ${esc(L.key)}</h3><p>Du hast mit <b>Etage ${L.best}</b> den <b class="gold">${L.rank}. Platz</b> von ${L.of} belegt.</p>
    <p class="small">${esc(rankReward(L.rank).label)}</p><button class="btn primary" data-a="towerClaim">Belohnung abholen</button></div>`;
}
on('towerClaim', () => {
  const T = towerState(save, towerAnchor());
  const L = T.last;
  if (!L || L.claimed) return;
  const r = rankReward(L.rank);
  save.dust += r.dust;
  addRes(r.res);
  if (r.mythic) save.pendingMythic = (save.pendingMythic || 0) + r.mythic;
  if (r.pack) grantPack(4);
  if (L.rank === 1) save.stats.towerWins = (save.stats.towerWins || 0) + 1;
  L.claimed = true;
  checkAchievements();
  persist();
  sfx.loot(); buzz(60);
  toast(`♜ Wochenbelohnung erhalten: ${r.label}`);
  app.nav('hub');
});
export function modeTiles() {
  const T = towerState(save, towerAnchor());
  const me = towerBoard(T).find((r) => r.me);
  return `<button class="tile" data-a="towerBoard"><span class="ti">♜</span>Sternenturm${T.last && !T.last.claimed ? '<i class="dot"></i>' : ''}<small>Platz ${me.rank} · ${T.best ? `Etage ${T.best}` : 'Woche ' + T.key.slice(-2)}</small></button>`;
}

// ===================================================================== Rastplatz (Turm & Boss-Rush)
function campScreen(title) {
  screen(`${runHeader()}<div class="pad center"><h2 class="evt">⛺ Rastplatz</h2><p class="muted">${esc(title)} Wähle eine Station, bevor es weitergeht.</p>
    <div class="abchoices">${['shop', 'forge', 'rest'].map((t) => `<button class="abnode t-${t}" data-a="campPick" data-t="${t}"><span>${NODE_TYPES[t].icon}</span><b>${NODE_TYPES[t].name}</b></button>`).join('')}</div>
    <button class="btn ghost" data-a="campSkip">Weiterziehen</button></div>`, 'runscreen');
}
on('campPick', (d) => enterNode({ type: d.t }));
on('campSkip', () => { const run = R(); run.towerCamp = false; run.rushCamp = false; persist(); app.showMap(); });

// ===================================================================== Sternenturm
export function showTowerRun() {
  const run = R();
  if (run.towerCamp) return campScreen(`Etage ${run.floor - 1} geschafft.`);
  const cur = towerFloor(run.towerKey, run.floor);
  const rows = [];
  for (let f = run.floor + 4; f >= Math.max(1, run.floor - 2); f--) {
    const F = towerFloor(run.towerKey, f);
    const what = F.type === 'boss' ? esc(ensureBoss(F.boss).name) : NODE_TYPES[F.type].name;
    rows.push(`<div class="tfloor t-${F.type} ${f === run.floor ? 'cur' : f < run.floor ? 'past' : ''}">
      <span class="tfn">${f}</span><span class="tfi">${f < run.floor ? '✓' : NODE_TYPES[F.type].icon}</span>
      <div><b>${what}</b><small>${esc(BIOMES[F.biome].name)} · ${[F.law, F.law2].filter(Boolean).map(lawName).map(esc).join(' + ')}</small></div>
      ${TOWER_MILES.includes(f) ? '<em>Truhe</em>' : ''}</div>`);
  }
  const laws = [cur.law, cur.law2].filter((l) => l && l !== 'calm');
  const T = towerState(save, towerAnchor());
  const rec = run.towerKey === T.key ? `Wochenrekord: ${T.best ? `Etage ${T.best}` : '—'} · Platz ${towerBoard(T).find((r) => r.me).rank}` : 'Turm der Vorwoche – zählt nicht mehr für die Bestenliste';
  screen(`${runHeader()}<div class="pad"><h2 class="center towerh">Etage ${run.floor}</h2>
    <p class="muted center small">Gegnerstärke ×${fmt(towerPower(run.floor))} · ${esc(rec)}</p>
    ${laws.length ? laws.map((l) => `<div class="law"><b>⚖ ${esc(lawName(l))}</b><small>${esc(lawDesc(l))}</small></div>`).join('') : '<div class="law calm"><b>Stille</b><small>Diese Etage hat kein besonderes Gesetz.</small></div>'}
    <div class="tfloors">${rows.join('')}</div>
    <button class="btn primary big" data-a="towerGo">Etage ${run.floor} betreten</button></div>`, 'runscreen');
}
on('towerGo', () => {
  const run = R();
  const F = towerFloor(run.towerKey, run.floor);
  enterNode({ type: F.type, boss: F.boss });
});

// ===================================================================== Boss-Rush
export function showRushRun() {
  const run = R(), Ru = run.rush;
  if (run.rushCamp) return campScreen(`${Ru.idx} Bosse bezwungen.`);
  const list = Ru.order.map((id, i) => {
    const B = ensureBoss(id);
    return `<div class="rboss ${i < Ru.idx ? 'past' : i === Ru.idx ? 'cur' : ''}" style="--bc:${B.color}"><span>${i + 1}</span><b>${esc(B.name)}</b><small>${i < Ru.idx ? '✓' : `×${fmt(RUSH_POWER[i])}`}</small></div>`;
  }).join('');
  const B = ensureBoss(Ru.order[Ru.idx]);
  const best = save.rush && save.rush.best;
  screen(`${runHeader()}<div class="pad"><h2 class="center">Boss ${Ru.idx + 1} von ${RUSH_LEN}</h2>
    <p class="center muted small">Kampfzeit: <b>${clock(Ru.time)}</b>${best ? ` · Bestleistung ${best.n}/${RUSH_LEN} in ${clock(best.time)}` : ''}</p>
    <div class="rushlist">${list}</div>
    <button class="btn primary big" data-a="rushGo" style="--bc:${B.color}">${esc(B.name)} herausfordern</button></div>`, 'runscreen');
}
on('rushGo', () => { const run = R(); enterNode({ type: 'boss', boss: run.rush.order[run.rush.idx] }); });

// ===================================================================== Sternenjagd
export function showHuntRun() {
  const run = R(), h = run.hunt;
  const moves = new Set(huntMoves(h).map(([x, y]) => `${x}_${y}`));
  const B = ensureBoss(h.beast);
  let cells = '';
  for (let y = 0; y < h.h; y++) for (let x = 0; x < h.w; x++) {
    const t = huntTile(h, x, y), here = x === h.x && y === h.y, can = moves.has(`${x}_${y}`);
    const lairShown = t.t === 'lair' && (t.seen || h.found);
    const T = HUNT_TILES[t.t];
    let cls = 'hcell', inner = '';
    if (lairShown) { cls += ' h-lair'; inner = '♛'; }
    else if (!t.seen) cls += ' fog';
    else { cls += ` h-${t.t}${t.done ? ' done' : ''}`; inner = t.t === 'track' && t.done ? huntArrow(h, x, y) : T.icon; }
    if (here) { cls += ' here'; inner = CLASSES[run.cls].glyph; }
    if (can) cls += ' can';
    cells += `<button class="${cls}" style="--hc:${here ? CLASSES[run.cls].color : lairShown ? B.color : T.col}" ${can ? `data-a="huntMove" data-x="${x}" data-y="${y}"` : 'disabled'}>${inner}</button>`;
  }
  const dist = huntDist(h, h.x, h.y);
  screen(`${runHeader()}<div class="pad">
    <div class="hstat"><span class="${h.steps <= 5 ? 'warn' : ''}">👣 <b>${h.steps}</b></span><span>✦ <b>${h.shards}/${HUNT_SHARDS}</b></span><span>×${fmt(huntPower(h.tier, dist))}</span>
      <span style="color:${B.color}">♛ ${h.found ? esc(B.name) : '???'}</span></div>
    <div class="hunt" style="grid-template-columns:repeat(${h.w},1fr)">${cells}</div>
    <p class="small muted center">Ziehe auf ein angrenzendes Feld (👣 −1). Spuren zeigen zum Hort, jeder Sternsplitter nimmt der Bestie 12% Leben. Je weiter vom Lager, desto stärker die Gegner – und desto besser die Beute.</p></div>`, 'runscreen');
  if (h.steps <= 0) setTimeout(huntAmbush, 60);
}
function huntAmbush() {
  const run = R();
  if (!run || run.mode !== 'hunt' || run.curNode) return;
  const B = ensureBoss(run.hunt.beast);
  modal(`<h2 class="evt" style="color:${B.color}">♛ Hinterhalt!</h2><p class="center">Du warst zu lange unterwegs. <b>${esc(B.name)}</b> hat deine Fährte aufgenommen und greift an – stärker als in ihrem Hort.</p>
    <button class="btn primary" data-a="huntAmbushGo">Kämpfen</button>`, 'event');
}
on('huntAmbushGo', () => { closeModal(); const h = R().hunt; enterNode({ type: 'boss', boss: h.beast, lair: true, ambush: true }); });
on('huntMove', (d) => {
  const run = R(), h = run.hunt;
  const x = Number(d.x), y = Number(d.y), t = huntTile(h, x, y);
  if (t.t === 'lair' && !t.done) {
    const B = ensureBoss(h.beast);
    confirmBox(`<b style="color:${B.color}">♛ ${esc(B.name)}</b><br><br>Du stehst vor dem Hort der Bestie. Gesammelte Sternsplitter: ${h.shards}/${HUNT_SHARDS} (−${h.shards * 12}% Leben).<br><br>Danach gibt es kein Zurück.`, 'Hort betreten', () => {
      moveTo(h, x, y);
      persist();
      enterNode({ type: 'boss', boss: h.beast, lair: true });
    });
    return;
  }
  moveTo(h, x, y);
  if (!t.done) {
    if (t.t === 'track') { t.done = true; followTrack(h, x, y); sfx.zap(); toast(`Frische Spuren führen nach ${huntArrow(h, x, y)}`); }
    else if (t.t === 'shard') { t.done = true; h.shards++; sfx.loot(); buzz(40); toast(`✦ Sternsplitter ${h.shards}/${HUNT_SHARDS} – die Bestie wird schwächer${h.shards >= HUNT_SHARDS ? '. Ihr Hort ist enthüllt!' : ''}`); if (h.shards >= HUNT_SHARDS) h.found = true; }
    else if (t.t === 'empty') t.done = true;
    else {
      if (t.t === 'rest') { h.steps += 3; toast('Die Quelle stärkt dich: +3 Schritte'); }
      persist();
      return enterNode({ type: t.t, hunt: true });
    }
  }
  persist();
  showHuntRun();
});
function moveTo(h, x, y) {
  h.x = x; h.y = y; h.steps--; h.moves++;
  huntReveal(h, x, y, 1);
}
