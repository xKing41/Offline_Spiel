// Taten: Neues wird durch Spielen freigeschaltet, nicht durch Sternenstaub.
// Pfad-Meisterstücke (Stufe IV), Bund-Segen und tiefere Echo-Ebenen warten auf eine Tat.
import { save } from '../save.js';
import { BOONS, PATHS, PATH_IDS, pathTiers } from './boons.js';
import { echoTreeDepth } from '../calc.js';

const capOf = (pid) => BOONS.find((b) => b.path === pid && b.tier === 4);

export const DEEDS = [
  ...PATH_IDS.map((pid) => ({
    id: `cap_${pid}`, kind: 'cap', path: pid,
    text: `Besiege einen Boss, während dein Pfad ${PATHS[pid].name} auf Stufe III ist`,
    reward: `Meisterstück „${capOf(pid).name}“ (${PATHS[pid].name} IV)`,
  })),
  ...BOONS.filter((b) => b.bund).map((b) => ({
    id: b.id, kind: 'bund', pair: b.bund,
    text: `Besiege einen Boss mit ${PATHS[b.bund[0]].name} und ${PATHS[b.bund[1]].name} auf Stufe II`,
    reward: `Bund-Segen „${b.name}“`,
  })),
  { id: 'echo2', kind: 'echo', lvl: 1, text: 'Verschmelze insgesamt 3 Runen zu Echos', reward: 'Echos bis Ebene 2 (Echos in Echos)' },
  { id: 'echo3', kind: 'echo', lvl: 2, text: 'Besiege einen Boss mit einer Rune, die Echos auf Ebene 2 trägt', reward: 'Echos bis Ebene 3' },
];
export const deedById = (id) => DEEDS.find((d) => d.id === id);

const U = () => (save.unlocks = save.unlocks || { done: {}, echoDepth: 0 });
export const deedDone = (id) => !!U().done[id];
export const capOpen = (pid) => deedDone(`cap_${pid}`);
export const bundOpen = (id) => deedDone(id);
/** Gesperrt? (für Segen-Angebote und Anzeigen) */
export const boonLocked = (d) => !!d && ((d.tier === 4 && !capOpen(d.path)) || (d.bund && !bundOpen(d.id)));

/** Taten prüfen – ev: 'boss' (nach einem Bosssieg) oder 'fuse' (nach dem Verschmelzen). Gibt neu vollbrachte Taten zurück. */
export function checkDeeds(run, ev) {
  const u = U(), got = [];
  const t = run ? pathTiers(run) : {};
  const mark = (d) => { u.done[d.id] = true; got.push(d); if (d.kind === 'echo') u.echoDepth = Math.max(u.echoDepth || 0, d.lvl); };
  for (const d of DEEDS) {
    if (u.done[d.id]) continue;
    if (ev === 'boss' && run) {
      if (d.kind === 'cap' && (t[d.path] || 0) >= 3) mark(d);
      else if (d.kind === 'bund' && (t[d.pair[0]] || 0) >= 2 && (t[d.pair[1]] || 0) >= 2) mark(d);
      else if (d.id === 'echo3' && run.skills.some((s) => echoTreeDepth(s) >= 2)) mark(d);
    }
    if (ev === 'fuse' && d.id === 'echo2' && (save.stats.fusions || 0) >= 3) mark(d);
  }
  return got;
}
export const deedsDoneCount = () => DEEDS.filter((d) => deedDone(d.id)).length;
