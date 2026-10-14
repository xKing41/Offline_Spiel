// Runen-Evolution: Erreicht eine Rune die Höchststufe, verwandelt sie sich in eine von zwei Formen.
// Jede Form hat eigene Modifikatoren (mods) und kann Grundwerte der Rune verändern (ov = Funktion(def) → Teilobjekt).
// vis überschreibt optional die Optik (siehe skillfx.js).
const inc = (s, v) => ({ s, t: 'inc', v });
const more = (s, v) => ({ s, t: 'more', v });
const flat = (s, v) => ({ s, v });

const E = (name, desc, mods, ov = null, vis = null) => ({ name, desc, mods, ov, vis });

export const EVOLUTIONS = {
  starbolt: [
    E('Kometenschwarm', 'Drei suchende Splitter statt einem.', [more('dmg', -20)], (d) => ({ count: d.count + 2, spread: 0.5 })),
    E('Sternenlanze', 'Ein mächtiger Splitter, der alles durchbohrt.', [more('dmg', 60), more('speed', -20)], (d) => ({ size: 11, pierce: 4, homing: 1.5 }), { proj: 'icelance' }),
  ],
  fireball: [
    E('Sonnenkugel', 'Eine gewaltige, langsame Sonne mit riesiger Explosion.', [more('dmg', 50), more('speed', -25), flat('igniteChance', 25)], () => ({ size: 15, explode: 82, speed: 300 })),
    E('Funkenhagel', 'Ein Hagel kleiner Feuerbälle.', [more('dmg', -35), more('speed', 15)], (d) => ({ count: d.count + 3, spread: 0.55, size: 6, explode: 30 })),
  ],
  frostshard: [
    E('Gletscherfächer', 'Ein breiter Fächer aus Eissplittern.', [more('dmg', -25), flat('freezeChance', 5)], (d) => ({ count: d.count + 4, spread: 0.9 })),
    E('Eisdorn', 'Ein einzelner, riesiger Dorn, der alles durchdringt.', [more('dmg', 85), inc('chillEffect', 30)], () => ({ count: 1, size: 11, pierce: 6 }), { proj: 'icelance' }),
  ],
  arrows: [
    E('Pfeilsturm', 'Salven aus sechs Pfeilen.', [more('dmg', -30)], (d) => ({ count: d.count + 4, spread: 0.6, cd: d.cd * 0.85 })),
    E('Meisterschuss', 'Ein einziger, tödlicher Schuss.', [more('dmg', 75), flat('critBase', 4), flat('critMulti', 40)], () => ({ count: 1, speed: 950, pierce: 2, size: 7 }), { proj: 'arrowLight' }),
  ],
  bloodlance: [
    E('Blutfontäne', 'Die Lanze explodiert bei jedem Treffer in Blut.', [more('dmg', 15), flat('bleedChance', 20)], () => ({ explode: 48 }), null),
    E('Aderlass', 'Saugt Leben und reißt tiefe Wunden.', [more('dmg', 10), flat('leech', 2), more('bleed', 60), flat('bleedChance', 25)]),
  ],
  frostnova: [
    E('Absoluter Nullpunkt', 'Eine riesige, langsame Kältewelle, die fast alles einfriert.', [flat('freezeChance', 15), more('dmg', 55)], (d) => ({ area: d.area * 1.35, cd: d.cd * 1.3 })),
    E('Eispuls', 'Schnelle, kleinere Kälteimpulse.', [more('dmg', -20), inc('chillEffect', 40)], (d) => ({ area: d.area * 0.82, cd: d.cd * 0.6 })),
  ],
  chainlight: [
    E('Gewitterkette', 'Springt bis zu acht weitere Male.', [more('dmg', -20)], (d) => ({ chain: d.chain + 5 })),
    E('Donnerkeil', 'Ein gewaltiger Einzelblitz.', [more('dmg', 90), flat('shockChance', 30), inc('shockEffect', 30)], () => ({ chain: 1 })),
  ],
  blades: [
    E('Klingenkranz', 'Ein dichter Ring aus fünf Klingen.', [more('dmg', -15)], (d) => ({ count: d.count + 3 })),
    E('Riesenklingen', 'Zwei schwere Klingen auf weiter Bahn.', [more('dmg', 60), more('speed', -15)], (d) => ({ area: d.area * 1.4 })),
  ],
  plague: [
    E('Pestwolke', 'Eine riesige, lang anhaltende Seuchenwolke.', [more('dmg', -10)], (d) => ({ area: d.area * 1.5, dur: d.dur * 1.3 })),
    E('Schwarzer Tod', 'Kurz, aber tödlich.', [more('dmg', 60), more('dur', -30)]),
  ],
  slam: [
    E('Erdspalter', 'Jeder Schlag erzeugt ein Nachbeben.', [flat('spec_aftershock', 1)], (d) => ({ area: d.area * 1.3 })),
    E('Titanenfaust', 'Langsame, zermalmende Schläge.', [more('dmg', 80), more('speed', -20), flat('critMulti', 30)]),
  ],
  wisps: [
    E('Lichterschwarm', 'Ein ganzer Schwarm von Irrlichtern.', [more('dmg', -30)], (d) => ({ count: d.count + 3 })),
    E('Sonnengeist', 'Ein einzelner, gleißender Geist.', [more('dmg', 150)], () => ({ count: 1 })),
  ],
  skeletons: [
    E('Knochenlegion', 'Eine Armee aus Knochen.', [more('dmg', -25)], (d) => ({ count: d.count + 3 })),
    E('Todesritter', 'Ein einziger, unaufhaltsamer Ritter.', [more('dmg', 140), flat('critMulti', 30)], () => ({ count: 1 })),
  ],
  meteor: [
    E('Meteorschauer', 'Vier Meteore auf einmal.', [more('dmg', -40), more('area', -20)], (d) => ({ count: d.count + 3 })),
    E('Weltenbrecher', 'Ein gigantischer Meteor mit verheerendem Einschlag.', [more('dmg', 120), more('speed', -30)], (d) => ({ area: d.area * 1.5, delay: 1.1 })),
  ],
  emberaura: [
    E('Inferno', 'Die Glut breitet sich weit aus.', [more('dmg', 20)], (d) => ({ area: d.area * 1.35 })),
    E('Glutkern', 'Konzentrierte, sengende Hitze.', [more('dmg', 90)], (d) => ({ area: d.area * 0.75 })),
  ],
  runetrap: [
    E('Runenfeld', 'Mehr und schnellere Runenfallen.', [more('dmg', -25)], (d) => ({ max: d.max + 4, cd: d.cd * 0.7 })),
    E('Sternenrune', 'Gewaltige Runen mit großer Reichweite.', [more('dmg', 90), inc('area', 40), more('speed', -20)]),
  ],
  venomfan: [
    E('Giftsturm', 'Ein dichter Sturm aus Giftklingen.', [more('dmg', -30)], (d) => ({ count: d.count + 4, spread: 0.36 })),
    E('Viperbiss', 'Ein einzelner, durchbohrender Giftzahn.', [more('dmg', 90), flat('poisonChance', 40)], () => ({ count: 1, pierce: 3, size: 8 })),
  ],
  icelance: [
    E('Frostspeer', 'Durchbohrt noch mehr Gegner.', [more('dmg', 25)], (d) => ({ pierce: d.pierce + 5 })),
    E('Gefrorene Salve', 'Drei Lanzen gleichzeitig.', [more('dmg', -30)], () => ({ count: 3, spread: 0.3 })),
  ],
  glaive: [
    E('Doppelglefe', 'Zwei Glefen auf einmal.', [more('dmg', -20)], () => ({ count: 2, spread: 0.4 })),
    E('Sternenschneide', 'Eine riesige Glefe mit tödlichen Schnitten.', [more('dmg', 60), flat('critMulti', 30)], () => ({ size: 14 })),
  ],
  balllight: [
    E('Gewitterkugel', 'Entlädt sich schneller und weiter.', [more('dmg', -10)], (d) => ({ pulse: { r: d.pulse.r * 1.4, rate: d.pulse.rate * 0.7 } })),
    E('Kugelblitz-Kaskade', 'Drei Kugeln auf einmal.', [more('dmg', -25)], (d) => ({ count: d.count + 2, spread: 0.6 })),
  ],
  flamewave: [
    E('Feuerwalze', 'Eine lange Welle aus Flammensäulen.', [more('dmg', -15)], (d) => ({ steps: d.steps + 3 })),
    E('Flammensäule', 'Eine einzige, riesige Säule aus Feuer.', [more('dmg', 120)], (d) => ({ steps: 2, area: d.area * 1.6 })),
  ],
  acidpool: [
    E('Säuresee', 'Ein großer, ätzender See.', [more('dmg', -10)], (d) => ({ area: d.area * 1.6 })),
    E('Ätzende Tropfen', 'Viele kleine Säurepfützen.', [more('dmg', -25)], (d) => ({ count: d.count + 3, area: d.area * 0.7 })),
  ],
  frostorb: [
    E('Eiskranz', 'Fünf kreisende Frostkugeln.', [more('dmg', -15), flat('freezeChance', 5)], (d) => ({ count: d.count + 2 })),
    E('Polarwirbel', 'Ein weiter, eisiger Wirbel.', [more('dmg', 40), inc('chillEffect', 50)], (d) => ({ area: d.area * 1.5 })),
  ],
  shadowblades: [
    E('Schattenreigen', 'Ein Reigen aus sechs Schattenklingen.', [more('dmg', -20)], (d) => ({ count: d.count + 3 })),
    E('Leerenklingen', 'Die Klingen werden zu reiner Leere.', [flat('conv_phys_chaos', 50), more('dmg', 50), flat('pen_chaos', 15)]),
  ],
  bonespear: [
    E('Knochenregen', 'Vier Speere in breitem Fächer.', [more('dmg', -35)], () => ({ count: 4, spread: 0.5 })),
    E('Rückgratbrecher', 'Ein Speer, der durch ganze Horden bricht.', [more('dmg', 70), more('dmgVsBoss', 30)], (d) => ({ pierce: d.pierce + 6, size: 11 })),
  ],
  soulreap: [
    E('Seelensturm', 'Eine gewaltige Ernte, die Leben schenkt.', [more('dmg', 40), flat('lifeOnKill', 3)], (d) => ({ area: d.area * 1.4, cd: d.cd * 1.2 })),
    E('Seelenfresser', 'Saugt die Seelen der Getroffenen aus.', [flat('leech', 3), more('dmg', 30)]),
  ],
  bloodnova: [
    E('Blutregen', 'Weite, blutige Wellen.', [more('dmg', 20), flat('bleedChance', 30)], (d) => ({ area: d.area * 1.35 })),
    E('Herzschlag', 'Schnelle, pochende Wellen.', [more('dmg', -25)], (d) => ({ cd: d.cd * 0.6 })),
  ],
  thunderclap: [
    E('Donnergott', 'Ein gewaltiger Donnerschlag.', [more('dmg', 20), flat('shockChance', 25)], (d) => ({ area: d.area * 1.4 })),
    E('Blitzhieb', 'Blitzschnelle Schläge.', [more('dmg', -20), flat('critBase', 3)], (d) => ({ cd: d.cd * 0.6 })),
  ],
  icegolem: [
    E('Gletschertitan', 'Ein riesiger Golem mit vernichtenden Schlägen.', [more('dmg', 75), flat('freezeChance', 10)]),
    E('Eisrudel', 'Drei kleinere Golems.', [more('dmg', -35)], (d) => ({ count: d.count + 2 })),
  ],
  firespirits: [
    E('Phönixschar', 'Sechs Flammengeister.', [more('dmg', -25)], (d) => ({ count: d.count + 3 })),
    E('Feuerelementar', 'Ein einzelner, mächtiger Elementar.', [more('dmg', 150)], () => ({ count: 1 })),
  ],
  poisontrap: [
    E('Seuchenminen', 'Ein Feld aus Giftfallen.', [more('dmg', -20)], (d) => ({ max: d.max + 4 })),
    E('Todeswolke', 'Riesige, tödliche Giftwolken.', [more('dmg', 50), flat('poisonChance', 30)], (d) => ({ area: d.area * 1.5 })),
  ],
  frostaura: [
    E('Ewiger Winter', 'Die Kälte reicht weit.', [more('dmg', 20), inc('chillEffect', 40)], (d) => ({ area: d.area * 1.35 })),
    E('Eisherz', 'Eiskalte Nähe.', [more('dmg', 100)], (d) => ({ area: d.area * 0.75 })),
  ],
  thunderstorm: [
    E('Supergewitter', 'Fünf Blitze auf einmal.', [more('dmg', -25)], (d) => ({ count: d.count + 3 })),
    E('Zorn des Himmels', 'Ein einzelner, gewaltiger Blitz.', [more('dmg', 150)], (d) => ({ count: 1, area: d.area * 1.5 })),
  ],
  bladestorm: [
    E('Klingenhurrikan', 'Ein weiter Wirbel aus Klingen.', [more('dmg', 10)], (d) => ({ area: d.area * 1.35 })),
    E('Tausend Schnitte', 'Unaufhörliche, blutige Schnitte.', [more('dmg', -30), flat('bleedChance', 20)], (d) => ({ cd: d.cd * 0.55 })),
  ],
  voidrift: [
    E('Schwarzes Loch', 'Ein riesiger Riss, der alles anzieht.', [more('dmg', 25)], (d) => ({ area: d.area * 1.4 })),
    E('Risskaskade', 'Drei Risse auf einmal.', [more('dmg', -20)], (d) => ({ count: (d.count || 1) + 2 })),
  ],
  starfall: [
    E('Sternenregen', 'Acht fallende Sterne.', [more('dmg', -30)], (d) => ({ count: d.count + 4 })),
    E('Supernova-Fall', 'Wenige, aber gewaltige Sterne.', [more('dmg', 90), more('speed', -25)], (d) => ({ area: d.area * 1.6 })),
  ],
  spectral: [
    E('Geisterarmee', 'Fünf Geisterklingen.', [more('dmg', -25)], (d) => ({ count: d.count + 3 })),
    E('Seelenklinge', 'Raubt Leben und durchbohrt mehr.', [more('dmg', 60), flat('leech', 2)], (d) => ({ pierce: d.pierce + 2 })),
  ],
  arcticbreath: [
    E('Blizzard', 'Ein langer Eissturm.', [more('dmg', -15)], (d) => ({ steps: d.steps + 3 })),
    E('Frostatem', 'Ein kurzer, aber eisiger Stoß.', [more('dmg', 60), flat('freezeChance', 10)], (d) => ({ steps: 2, area: d.area * 1.4 })),
  ],
  stormblades: [
    E('Gewitterring', 'Vier Sturmklingen.', [more('dmg', -10)], (d) => ({ count: d.count + 2 })),
    E('Blitzsensen', 'Geladene Klingen, die alles schocken.', [more('dmg', 50), flat('shockChance', 30)]),
  ],
  bloodrite: [
    E('Blutmond', 'Ein weiter Kreis, der Leben raubt.', [more('dmg', 20), flat('leech', 1)], (d) => ({ area: d.area * 1.35 })),
    E('Opferritus', 'Ein enger, blutiger Kreis.', [more('dmg', 80), more('area', -20)]),
  ],
  shockwave: [
    E('Erdbeben', 'Jede Welle erzeugt ein Nachbeben.', [more('dmg', 25), flat('spec_aftershock', 1)], (d) => ({ area: d.area * 1.3 })),
    E('Schallknall', 'Schnelle, dröhnende Wellen.', [more('dmg', -20)], (d) => ({ cd: d.cd * 0.6 })),
  ],
  spiketrap: [
    E('Dornenfeld', 'Ein dichtes Feld aus Dornenfallen.', [more('dmg', -20)], (d) => ({ max: d.max + 4 })),
    E('Pfählung', 'Tödliche Dornen, die tiefe Wunden reißen.', [more('dmg', 80), flat('bleedChance', 40)]),
  ],
  comet: [
    E('Eisregen', 'Vier Kometen auf einmal.', [more('dmg', -40)], (d) => ({ count: d.count + 3 })),
    E('Gletscherkomet', 'Ein riesiger Komet, der alles einfriert.', [more('dmg', 100), flat('freezeChance', 20)], (d) => ({ area: d.area * 1.5, delay: 1.2 })),
  ],
  spiritwolves: [
    E('Großes Rudel', 'Vier Geisterwölfe.', [more('dmg', -20)], (d) => ({ count: d.count + 2 })),
    E('Alphawolf', 'Ein einzelner, gewaltiger Wolf.', [more('dmg', 140), flat('critMulti', 30)], () => ({ count: 1 })),
  ],
  locusts: [
    E('Plage', 'Ein riesiger Schwarm.', [more('dmg', -25)], (d) => ({ count: d.count + 4 })),
    E('Blutheuschrecken', 'Giftige, gierige Heuschrecken.', [more('dmg', 60), flat('poisonChance', 30)]),
  ],
  firestorm: [
    E('Feuerregen', 'Sieben brennende Geschosse.', [more('dmg', -30)], (d) => ({ count: d.count + 4 })),
    E('Sonnensturz', 'Wenige, gewaltige Feuerbälle.', [more('dmg', 90)], (d) => ({ area: d.area * 1.5 })),
  ],
  lightningarrow: [
    E('Kettenpfeil', 'Springt zu vielen weiteren Gegnern.', [more('dmg', -15)], (d) => ({ chain: d.chain + 4 })),
    E('Donnerpfeil', 'Explodiert bei jedem Treffer.', [more('dmg', 40), flat('shockChance', 20)], () => ({ explode: 58 })),
  ],
};

const cache = new Map();
/** Verwandelte Definition einer Rune (zwischengespeichert). */
export function evolvedDef(base, id, evo) {
  const list = EVOLUTIONS[id];
  if (!list || !evo) return base;
  const e = list[evo === 'b' ? 1 : 0];
  const key = id + evo;
  let d = cache.get(key);
  if (d && d.__base === base) return d;
  d = { ...base, ...(e.ov ? e.ov(base) : {}), name: e.name, evo, evoBase: base.name, __base: base };
  if (d.explode && !d.tags.includes('area')) d.tags = [...d.tags, 'area'];
  cache.set(key, d);
  return d;
}
export const evoOf = (id, evo) => (EVOLUTIONS[id] && evo ? EVOLUTIONS[id][evo === 'b' ? 1 : 0] : null);
