// Die Sternenkarte: ein großer Passivbaum im Stil von Path of Exile.
// Aufbau (deterministisch, damit Speicherstände stabil bleiben):
//   · Zentraler Sternenring (12 Knoten), 6 Klassen-Startpunkte im Kreis
//   · je Klasse ein Sektor mit 10 Clustern (4 kleine Knoten im Ring + 1 Notable)
//   · Pfade aus Wegknoten verbinden Cluster, Brücken verbinden Nachbarsektoren
//   · 12 Keystones am äußeren Rand verändern die Spielregeln
// Wird der Aufbau geändert, TREE_VERSION erhöhen – dann werden alle Punkte erstattet.

export const TREE_VERSION = 1;

const inc = (s, v) => ({ s, t: 'inc', v });
const more = (s, v) => ({ s, t: 'more', v });
const flat = (s, v) => ({ s, v });

// Thema: kleine Knoten + Notable-Varianten [Name, Modifikatoren]
export const THEMES = {
  fire: { small: [inc('dmg_fire', 10)], notables: [['Glutherz', [inc('dmg_fire', 25), flat('igniteChance', 10)]], ['Flammenzunge', [inc('dmg_fire', 20), flat('pen_fire', 8)]]] },
  cold: { small: [inc('dmg_cold', 10)], notables: [['Permafrost', [inc('dmg_cold', 25), flat('freezeChance', 8)]], ['Eisiger Atem', [inc('dmg_cold', 20), inc('chillEffect', 30)]]] },
  light: { small: [inc('dmg_light', 10)], notables: [['Gewitterseele', [inc('dmg_light', 25), flat('shockChance', 10)]], ['Funkenflug', [inc('dmg_light', 20), inc('speed', 8)]]] },
  phys: { small: [inc('dmg_phys', 10)], notables: [['Rohe Gewalt', [inc('dmg_phys', 25), flat('add_phys', 3)]], ['Stahlwille', [inc('dmg_phys', 20), flat('armor', 40)]]] },
  chaos: { small: [inc('dmg_chaos', 10)], notables: [['Leerenbrut', [inc('dmg_chaos', 25), flat('res_chaos', 15)]], ['Verderbnis', [inc('dmg_chaos', 20), flat('poisonChance', 15)]]] },
  elem: { small: [inc('dmg_elem', 8)], notables: [['Elementarwandler', [inc('dmg_elem', 20), flat('res_elem', 10)]], ['Prisma', [inc('dmg_elem', 18), flat('pen', 5)]]] },
  spell: { small: [inc('dmg_spell', 10)], notables: [['Arkane Gelehrsamkeit', [inc('dmg_spell', 25), inc('speed_spell', 8)]], ['Runenschrift', [inc('dmg_spell', 20), inc('crit_spell', 35)]]] },
  attack: { small: [inc('dmg_attack', 10)], notables: [['Klingenmeister', [inc('dmg_attack', 25), inc('speed_attack', 8)]], ['Kampfrausch', [inc('dmg_attack', 20), flat('lifeOnKill', 3)]]] },
  proj: { small: [inc('dmg_proj', 10)], notables: [['Scharfschütze', [inc('dmg_proj', 25), inc('projSpeed', 20)]], ['Splitterregen', [inc('dmg_proj', 15), flat('pierce', 1)]]] },
  area: { small: [inc('area', 6)], notables: [['Weitblick', [inc('area', 18), inc('dmg_area', 15)]], ['Erschütterung', [inc('dmg_area', 25), inc('area', 8)]]] },
  melee: { small: [inc('dmg_melee', 10)], notables: [['Berserker', [inc('dmg_melee', 25), flat('lifeOnKill', 3)]], ['Wuchtschlag', [inc('dmg_melee', 20), inc('area_melee', 15)]]] },
  crit: { small: [inc('crit', 12)], notables: [['Todesstoß', [inc('crit', 30), flat('critMulti', 20)]], ['Schwachstelle', [flat('critBase', 1), inc('crit', 20)]]] },
  critmulti: { small: [flat('critMulti', 8)], notables: [['Vernichter', [flat('critMulti', 30)]], ['Scharfrichter', [flat('critMulti', 20), inc('dmgVsBoss', 15)]]] },
  speed: { small: [inc('speed', 4)], notables: [['Raserei', [inc('speed', 12), inc('move', 5)]], ['Fließende Bewegung', [inc('speed', 10), inc('dmg', 8)]]] },
  life: { small: [inc('life', 6)], notables: [['Unverwüstlich', [inc('life', 15), flat('lifeRegen', 2)]], ['Titanenblut', [inc('life', 12), flat('life', 25)]]] },
  armor: { small: [inc('armor', 15)], notables: [['Bollwerk', [flat('armor', 80), inc('armor', 25)]], ['Eiserne Haut', [inc('armor', 30), flat('res_elem', 6)]]] },
  evasion: { small: [flat('evasion', 25)], notables: [['Schattenschritt', [inc('evasion', 30), inc('move', 5)]], ['Phantom', [flat('evasion', 100), inc('evasion', 15)]]] },
  barrier: { small: [inc('barrier', 8)], notables: [['Sternenschild', [flat('barrier', 30), inc('barrier', 20)]], ['Ruhender Geist', [inc('barrierRecharge', 40), inc('barrier', 15)]]] },
  regen: { small: [flat('lifeRegen', 1)], notables: [['Lebensquell', [flat('lifeRegenPct', 1)]], ['Zähigkeit', [flat('lifeRegen', 3), inc('life', 8)]]] },
  leech: { small: [flat('leech', 0.3)], notables: [['Blutdurst', [flat('leech', 1), inc('dmg', 8)]], ['Vampir', [flat('leech', 1.2), inc('life', 6)]]] },
  burn: { small: [inc('burn', 12)], notables: [['Feuersbrunst', [inc('burn', 30), flat('igniteChance', 10)]], ['Schwelbrand', [inc('burn', 20), inc('ailDur', 20)]]] },
  poison: { small: [inc('poison', 12)], notables: [['Toxikologe', [inc('poison', 30), flat('poisonChance', 15)]], ['Schleichendes Gift', [inc('poison', 20), inc('ailDur', 20)]]] },
  bleed: { small: [inc('bleed', 12)], notables: [['Aderbruch', [inc('bleed', 30), flat('bleedChance', 15)]], ['Hämorrhagie', [inc('bleed', 25), inc('dmg_phys', 10)]]] },
  shock: { small: [inc('shockEffect', 10)], notables: [['Überspannung', [inc('shockEffect', 30), flat('shockChance', 10)]], ['Kurzschluss', [flat('shockChance', 15), inc('dmg_light', 10)]]] },
  chill: { small: [inc('chillEffect', 10)], notables: [['Eiszeit', [flat('freezeChance', 10), inc('chillEffect', 20)]], ['Kältestarre', [inc('dmgVsAilment', 20), inc('chillEffect', 15)]]] },
  dot: { small: [inc('dmg_dot', 10)], notables: [['Langsamer Tod', [inc('dmg_dot', 25), inc('dur', 10)]], ['Zersetzung', [inc('dmg_dot', 20), inc('ailDur', 15)]]] },
  dur: { small: [inc('dur', 8)], notables: [['Beständigkeit', [inc('dur', 25)]], ['Zeitdehnung', [inc('dur', 15), inc('dmg_dot', 10)]]] },
  minion: { small: [inc('dmg_minion', 12)], notables: [['Heerführer', [inc('dmg_minion', 25), inc('speed_minion', 10)]], ['Seelenband', [flat('minionCount', 1), inc('dmg_minion', 10)]]] },
  trap: { small: [inc('dmg_trap', 12)], notables: [['Fallensteller', [inc('dmg_trap', 25), inc('speed_trap', 15)]], ['Runenmeister', [inc('dmg_trap', 20), inc('area_trap', 20)]]] },
  aura: { small: [inc('dmg_aura', 12)], notables: [['Strahlende Präsenz', [inc('dmg_aura', 25), inc('area_aura', 15)]], ['Glühender Kern', [inc('dmg_aura', 20), inc('burn', 15)]]] },
  orbit: { small: [inc('dmg_orbit', 12)], notables: [['Klingensturm', [inc('dmg_orbit', 25), inc('speed_orbit', 10)]], ['Stählerner Reigen', [inc('dmg_orbit', 20), flat('proj', 1)]]] },
  chain: { small: [inc('dmg_chain', 10)], notables: [['Kettenmeister', [flat('chain', 1), inc('dmg_chain', 15)]], ['Blitzableiter', [inc('dmg_chain', 20), flat('shockChance', 8)]]] },
  move: { small: [inc('move', 3)], notables: [['Windläufer', [inc('move', 10), inc('evasion', 10)]], ['Sammler', [inc('magnet', 40), inc('move', 5)]]] },
  res: { small: [flat('res_elem', 4)], notables: [['Elementarschild', [flat('res_elem', 12)]], ['Unbeugsam', [flat('res_chaos', 20), flat('res_elem', 6)]]] },
  fortune: { small: [inc('luck', 8)], notables: [['Glückskind', [inc('luck', 25), inc('gold', 20)]], ['Weisheit', [inc('xp', 15)]]] },
  dmg: { small: [inc('dmg', 5)], notables: [['Kriegskunst', [inc('dmg', 15)]], ['Allmacht', [inc('dmg', 12), inc('speed', 5)]]] },
  execute: { small: [inc('dmgVsLow', 10)], notables: [['Henkersmal', [inc('dmgVsLow', 30), flat('critMulti', 10)]], ['Großwildjäger', [inc('dmgVsBoss', 30)]]] },
  pen: { small: [flat('pen', 2)], notables: [['Durchdringung', [flat('pen', 8)]], ['Bresche', [flat('pen', 5), inc('dmg_elem', 10)]]] },
};

// Keystones: verändern die Regeln. Gute Builds drehen sich oft um einen davon.
export const KEYSTONES = {
  glass: { name: 'Glaskanone', mods: [more('dmg', 50), more('life', -40)], desc: 'Alles oder nichts.' },
  calm: { name: 'Ruhiger Geist', mods: [flat('spec_noCrit', 1), more('dmg', 30)], desc: 'Beständigkeit statt Glück.' },
  precise: { name: 'Henkerspräzision', mods: [flat('spec_nthCrit', 4), flat('critMulti', 50)], desc: 'Jeder vierte Treffer sitzt.' },
  eternal: { name: 'Ewige Glut', mods: [flat('spec_burnStack', 1), more('burn', -40)], desc: 'Brände stapeln sich.' },
  plaguelord: { name: 'Seuchenfürst', mods: [flat('spec_onlyPoison', 1), flat('poisonChance', 40), more('poison', 50)], desc: 'Nur Gift. Aber viel davon.' },
  barrage: { name: 'Funkenregen', mods: [flat('proj', 2), more('dmg_proj', -25)], desc: 'Masse statt Klasse.' },
  acrobat: { name: 'Akrobatik', mods: [flat('dodge', 20), more('armor', -50), more('barrier', -50)], desc: 'Nicht getroffen werden ist die beste Rüstung.' },
  legion: { name: 'Geisterlegion', mods: [flat('minionCount', 2), more('dmg', -40)], desc: 'Deine Diener kämpfen, du befiehlst. (Betrifft keine Begleiter)' },
  bloodpact: { name: 'Blutpakt', mods: [flat('spec_leechMult', 3), flat('spec_noRegen', 1)], desc: 'Leben nur durch Blut.' },
  starsoul: { name: 'Sternenseele', mods: [flat('spec_ci', 1), inc('barrierRecharge', 50)], desc: 'Werde zu reinem Licht.' },
  timewarp: { name: 'Zeitbruch', mods: [more('speed', 25), more('dur', -40)], desc: 'Schneller, aber kürzer.' },
  giant: { name: 'Riesenblut', mods: [more('area', 40), more('life', 20), more('move', -20), more('speed', -10)], desc: 'Groß, langsam, unaufhaltsam.' },
};

export const CLASS_ORDER = ['pyro', 'storm', 'ranger', 'plague', 'warden', 'binder'];

const SECTORS = {
  pyro: { themes: ['fire', 'spell', 'burn', 'area', 'elem', 'barrier', 'pen', 'aura', 'dmg', 'crit'], keys: ['eternal', 'starsoul'], minor: inc('dmg_spell', 4), start: [inc('dmg_fire', 8), flat('barrier', 10)] },
  storm: { themes: ['light', 'speed', 'shock', 'spell', 'chain', 'crit', 'elem', 'move', 'critmulti', 'cold'], keys: ['timewarp', 'precise'], minor: inc('speed', 2), start: [inc('dmg_light', 8), inc('move', 4)] },
  ranger: { themes: ['proj', 'crit', 'evasion', 'attack', 'critmulti', 'move', 'speed', 'poison', 'dmg', 'execute'], keys: ['barrage', 'acrobat'], minor: inc('dmg_proj', 4), start: [inc('dmg_proj', 8), flat('evasion', 30)] },
  plague: { themes: ['chaos', 'poison', 'dot', 'dur', 'leech', 'bleed', 'evasion', 'res', 'execute', 'regen'], keys: ['plaguelord', 'bloodpact'], minor: inc('dmg_dot', 4), start: [inc('dmg_chaos', 8), flat('res_chaos', 10)] },
  warden: { themes: ['life', 'armor', 'melee', 'phys', 'regen', 'bleed', 'res', 'attack', 'area', 'dmg'], keys: ['giant', 'glass'], minor: flat('life', 8), start: [flat('life', 20), flat('armor', 30)] },
  binder: { themes: ['minion', 'trap', 'aura', 'barrier', 'life', 'dur', 'cold', 'fortune', 'area', 'orbit'], keys: ['legion', 'calm'], minor: inc('dmg_minion', 5), start: [inc('dmg_minion', 10), flat('life', 10)] },
};

// Cluster-Positionen je Sektor: [Radius, Winkelversatz]
const CPOS = [[470, -15], [470, 15], [700, -23], [700, 0], [700, 23], [930, -17], [930, 17], [1170, -24], [1170, 0], [1170, 24]];
const CLINKS = [[0, 2], [0, 3], [1, 3], [1, 4], [2, 5], [3, 5], [3, 6], [4, 6], [5, 7], [5, 8], [6, 8], [6, 9]];

let cached = null;

export function getTree() {
  if (cached) return cached;
  const nodes = new Map();
  const edges = [];
  const add = (id, props) => { const n = { id, adj: new Set(), mods: [], ...props }; nodes.set(id, n); return n; };
  const link = (a, b) => {
    if (a === b || nodes.get(a).adj.has(b)) return;
    nodes.get(a).adj.add(b); nodes.get(b).adj.add(a); edges.push([a, b]);
  };
  const polar = (r, deg) => ({ x: r * Math.cos((deg * Math.PI) / 180), y: r * Math.sin((deg * Math.PI) / 180) });
  const path = (aId, bId, pfx, sector) => {
    const a = nodes.get(aId), b = nodes.get(bId);
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(0, Math.round(d / 88) - 1);
    let prev = aId;
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const id = `${pfx}_${i}`;
      const mods = sector ? (i % 2 ? [SECTORS[sector].minor] : [flat('life', 8)]) : [i % 2 ? inc('dmg', 3) : flat('life', 6)];
      add(id, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, type: 'travel', name: 'Wegstern', mods });
      link(prev, id);
      prev = id;
    }
    link(prev, bId);
  };
  const nearestSmall = (prefix, x, y) => {
    let best = null, bd = Infinity;
    for (let i = 0; i < 4; i++) {
      const n = nodes.get(`${prefix}s${i}`);
      const d = (n.x - x) ** 2 + (n.y - y) ** 2;
      if (d < bd) { bd = d; best = n.id; }
    }
    return best;
  };

  // Zentraler Ring
  for (let i = 0; i < 12; i++) {
    const p = polar(120, -90 + i * 30);
    add(`h${i}`, { ...p, type: 'hub', name: 'Sternenherz', mods: [i % 2 ? flat('life', 6) : inc('dmg', 3)] });
  }
  for (let i = 0; i < 12; i++) link(`h${i}`, `h${(i + 1) % 12}`);

  const starts = {};
  CLASS_ORDER.forEach((cls, k) => {
    const th = -90 + 60 * k;
    const sec = SECTORS[cls];
    const sp = polar(250, th);
    const sid = `start_${cls}`;
    add(sid, { ...sp, type: 'start', cls, name: 'Ursprung', mods: sec.start });
    starts[cls] = sid;
    path(sid, `h${2 * k}`, `p_${sid}_hub`, null);

    // Cluster
    CPOS.forEach(([r, off], c) => {
      const ang = th + off;
      const center = polar(r, ang);
      const pfx = `s${k}c${c}`;
      const theme = THEMES[sec.themes[c]];
      const [nName, nMods] = theme.notables[(k + c) % theme.notables.length];
      add(`${pfx}n`, { ...center, type: 'notable', name: nName, mods: nMods, theme: sec.themes[c] });
      const toCenter = Math.atan2(-center.y, -center.x);
      for (let i = 0; i < 4; i++) {
        const a = toCenter + Math.PI / 4 + (i * Math.PI) / 2;
        add(`${pfx}s${i}`, { x: center.x + Math.cos(a) * 54, y: center.y + Math.sin(a) * 54, type: 'small', name: 'Stern', mods: theme.small, theme: sec.themes[c] });
      }
      for (let i = 0; i < 4; i++) link(`${pfx}s${i}`, `${pfx}s${(i + 1) % 4}`);
      link(`${pfx}n`, `${pfx}s1`);
      link(`${pfx}n`, `${pfx}s2`);
    });

    const cc = (c) => nodes.get(`s${k}c${c}n`);
    const clusterPath = (c1, c2, pfx) => {
      const a = cc(c1), b = cc(c2);
      path(nearestSmall(`s${k}c${c1}`, b.x, b.y), nearestSmall(`s${k}c${c2}`, a.x, a.y), pfx, cls);
    };
    // Start -> innere Cluster
    for (const c of [0, 1]) {
      const b = cc(c);
      path(sid, nearestSmall(`s${k}c${c}`, sp.x, sp.y), `p_${sid}_${c}`, cls);
    }
    for (const [a, b] of CLINKS) clusterPath(a, b, `p_s${k}_${a}_${b}`);

    // Keystones
    sec.keys.forEach((key, i) => {
      const kp = polar(1430, th + (i ? 14 : -14));
      const kid = `key_${key}`;
      add(kid, { ...kp, type: 'key', key, name: KEYSTONES[key].name, mods: KEYSTONES[key].mods });
      for (const c of i ? [9, 8] : [7, 8]) {
        path(nearestSmall(`s${k}c${c}`, kp.x, kp.y), kid, `p_${kid}_${c}`, cls);
      }
    });
  });

  // Brücken zwischen benachbarten Sektoren
  CLASS_ORDER.forEach((cls, k) => {
    const k2 = (k + 1) % 6;
    for (const [c1, c2] of [[4, 2], [9, 7]]) {
      const a = nodes.get(`s${k}c${c1}n`), b = nodes.get(`s${k2}c${c2}n`);
      path(nearestSmall(`s${k}c${c1}`, b.x, b.y), nearestSmall(`s${k2}c${c2}`, a.x, a.y), `b_${k}_${c1}`, null);
    }
  });

  cached = { nodes, edges, starts };
  return cached;
}

// ---------- Zuweisen / Entfernen ----------
const passable = (tree, n, cls) => n.type !== 'start' || n.cls === cls;

/** Kürzester Pfad (Liste neuer Knoten) vom zugewiesenen Bereich zum Zielknoten. */
export function findPath(tree, alloc, target, cls) {
  if (alloc.has(target)) return [];
  const t = tree.nodes.get(target);
  if (!t || !passable(tree, t, cls)) return null;
  const prev = new Map();
  const queue = [];
  for (const id of alloc) { prev.set(id, null); queue.push(id); }
  let head = 0;
  while (head < queue.length) {
    const id = queue[head++];
    for (const nb of tree.nodes.get(id).adj) {
      if (prev.has(nb)) continue;
      const n = tree.nodes.get(nb);
      if (!passable(tree, n, cls)) continue;
      prev.set(nb, id);
      if (nb === target) {
        const out = [];
        let cur = nb;
        while (cur && !alloc.has(cur)) { out.push(cur); cur = prev.get(cur); }
        return out.reverse();
      }
      queue.push(nb);
    }
  }
  return null;
}

/** Welche Knoten verschwinden, wenn `id` entfernt wird (inkl. abgeschnittener Knoten)? */
export function removalSet(tree, alloc, id, startId) {
  if (id === startId || !alloc.has(id)) return [];
  const reach = new Set([startId]);
  const stack = [startId];
  while (stack.length) {
    const cur = stack.pop();
    for (const nb of tree.nodes.get(cur).adj) {
      if (nb === id || reach.has(nb) || !alloc.has(nb)) continue;
      reach.add(nb);
      stack.push(nb);
    }
  }
  return [...alloc].filter((x) => !reach.has(x));
}

export function treeMods(tree, alloc) {
  const out = [];
  for (const id of alloc) {
    const n = tree.nodes.get(id);
    if (n) out.push(...n.mods);
  }
  return out;
}
