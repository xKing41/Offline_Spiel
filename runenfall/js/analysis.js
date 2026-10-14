// Schadensanalyse: fasst die Kampfstatistik zusammen (je Rune, Element, Krit, Schaden über Zeit, erlittener Schaden).
import { esc, fmt } from './util.js';
import { SKILLS } from './data/skills.js';
import { ELEM } from './data/stats.js';
import { PETS } from './data/endgame.js';
import { runeName } from './calc.js';

/** Analyse eines Kampfes in die Run-Summe übernehmen. */
export function mergeAn(dst, src, time = 0) {
  if (!src) return dst;
  dst = dst || { sk: {}, el: {}, crit: [0, 0, 0, 0], dot: {}, other: 0, tk: {}, src: {}, dodged: 0, time: 0, fights: 0 };
  for (const [k, v] of Object.entries(src.sk)) {
    const d = dst.sk[k] || (dst.sk[k] = { d: 0, h: 0, c: 0, dot: 0, k: 0 });
    d.d += v.d; d.h += v.h; d.c += v.c; d.dot += v.dot; d.k += v.k;
  }
  for (const key of ['el', 'dot', 'tk', 'src']) for (const [k, v] of Object.entries(src[key])) dst[key][k] = (dst[key][k] || 0) + v;
  for (let i = 0; i < 4; i++) dst.crit[i] += src.crit[i];
  dst.other += src.other; dst.dodged += src.dodged;
  dst.time = (dst.time || 0) + time; dst.fights = (dst.fights || 0) + 1;
  // Quellen begrenzen (nur die stärksten behalten)
  const srcs = Object.entries(dst.src);
  if (srcs.length > 30) dst.src = Object.fromEntries(srcs.sort((a, b) => b[1] - a[1]).slice(0, 20));
  return dst;
}

function skillLabel(run, key) {
  if (key.startsWith('pet:')) { const id = key.slice(8); return PETS[id] ? `🐾 ${PETS[id].name}` : 'Gefährte'; }
  const inst = run && run.skills.find((s) => s.id === key);
  return inst ? runeName(inst) : SKILLS[key] ? SKILLS[key].name : key;
}
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const DOT_NAME = { burn: 'Brand', poison: 'Gift', bleed: 'Blutung' };

/** HTML der Analyse. time = Kampfdauer in Sekunden (für Schaden pro Sekunde). */
export function analysisHtml(an, time, run) {
  if (!an || !an.crit[0] && !Object.keys(an.sk).length && !an.other) return '<p class="muted small center">Noch keine Daten – kämpfe ein wenig.</p>';
  const skills = Object.entries(an.sk).sort((a, b) => b[1].d - a[1].d);
  const total = skills.reduce((s, [, v]) => s + v.d, 0) + an.other;
  const t = Math.max(1, time || an.time || 1);
  const rows = skills.map(([k, v]) => `<div class="anrow"><div class="row between"><b>${esc(skillLabel(run, k))}</b><span>${fmt(v.d)} · <b class="gold">${pct(v.d, total)}%</b></span></div>
    <div class="anbar"><i style="width:${pct(v.d, total)}%"></i></div>
    <small class="muted">${fmt(v.d / t)}/s · ${fmt(v.h)} Treffer · Krit ${pct(v.c, v.h)}%${v.dot ? ` · Schaden über Zeit ${pct(v.dot, v.d)}%` : ''} · ${fmt(v.k)} Siege</small></div>`).join('');
  const other = an.other > 0 ? `<div class="anrow"><div class="row between"><b>Sonstiges</b><span>${fmt(an.other)} · ${pct(an.other, total)}%</span></div><small class="muted">Explosionen, Dornen, Sturmschritte, Relikte</small></div>` : '';
  const elTot = Object.values(an.el).reduce((a, b) => a + b, 0);
  const els = Object.entries(an.el).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const elBar = els.map(([k, v]) => `<i style="width:${(v / elTot) * 100}%;background:${ELEM[k].color}"></i>`).join('');
  const elLeg = els.map(([k, v]) => `<span><i style="background:${ELEM[k].color}"></i>${ELEM[k].name} ${pct(v, elTot)}%</span>`).join('');
  const [hits, crits, critDmg, hitDmg] = an.crit;
  const dots = Object.entries(an.dot).filter(([, v]) => v > 0);
  const dotTot = dots.reduce((a, [, v]) => a + v, 0);
  const tkTot = Object.values(an.tk).reduce((a, b) => a + b, 0);
  const tks = Object.entries(an.tk).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const srcs = Object.entries(an.src).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return `<div class="an">
    <div class="sgrid"><div><small>Gesamtschaden</small><b>${fmt(total)}</b></div><div><small>Schaden/s</small><b>${fmt(total / t)}</b></div></div>
    <h4>Runen</h4>${rows}${other}
    ${els.length ? `<h4>Elemente</h4><div class="anstack">${elBar}</div><div class="anleg">${elLeg}</div>` : ''}
    <h4>Kritische Treffer</h4><p class="small">${pct(crits, hits)}% der Treffer waren kritisch und brachten <b>${pct(critDmg, hitDmg)}%</b> des Trefferschadens.</p>
    ${dots.length ? `<h4>Schaden über Zeit</h4><p class="small">${dots.map(([k, v]) => `${DOT_NAME[k]}: <b>${fmt(v)}</b>`).join(' · ')} – zusammen ${pct(dotTot, total)}% deines Schadens.</p>` : ''}
    <h4>Erlittener Schaden</h4>
    ${tkTot > 0 ? `<div class="anstack">${tks.map(([k, v]) => `<i style="width:${(v / tkTot) * 100}%;background:${ELEM[k].color}"></i>`).join('')}</div>
      <div class="anleg">${tks.map(([k, v]) => `<span><i style="background:${ELEM[k].color}"></i>${ELEM[k].name} ${fmt(v)}</span>`).join('')}</div>
      <p class="small muted">Gefährlichste Quellen: ${srcs.map(([k, v]) => `${esc(k)} (${fmt(v)})`).join(', ')}</p>` : '<p class="small">Kein Schaden erlitten.</p>'}
    <p class="small muted">Ausgewichen: ${fmt(an.dodged)}×</p></div>`;
}

/** Kurzfassung für die Zusammenfassung am Run-Ende. */
export function analysisTop(an, run) {
  if (!an) return '';
  const skills = Object.entries(an.sk).sort((a, b) => b[1].d - a[1].d).slice(0, 4);
  const total = Object.values(an.sk).reduce((s, v) => s + v.d, 0) + an.other;
  if (!total) return '';
  return `<div class="panel"><h3>Wer hat den Schaden gemacht?</h3>${skills.map(([k, v]) => `<div class="anrow"><div class="row between"><b>${esc(skillLabel(run, k))}</b><span>${fmt(v.d)} · <b class="gold">${pct(v.d, total)}%</b></span></div><div class="anbar"><i style="width:${pct(v.d, total)}%"></i></div></div>`).join('')}</div>`;
}
