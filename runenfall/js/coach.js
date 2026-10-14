// Einführung: Willkommen, geführter erster Run und Hinweise beim ersten Kontakt mit jedem System.
// Jeder Hinweis erscheint genau einmal (gespeichert in save.hints) und lässt sich abschalten.
import { app } from './app.js';
import { save, persist } from './save.js';
import { esc } from './util.js';

export const HINTS = {
  setup: ['Neuer Run', 'Wähle eine Klasse. Für den Anfang ist der Funkenmagier ideal: Seine Feuerbälle suchen sich ihre Ziele selbst. Der Modus „Feldzug“ führt durch drei Akte mit je einem Boss.'],
  map: ['Die Karte des Akts', 'Tippe einen leuchtenden Ort an, um weiterzuziehen.\n⚔ Kampf · ☠ Elite (stärker, bessere Beute) · ? Ereignis · ⚖ Händler · ⚒ Schmiede · ☾ Lager · ◆ Schatz · ✧ Schrein\nGanz oben wartet der Boss des Akts.'],
  move: ['Kämpfen', 'Ziehe den Daumen irgendwo über den Bildschirm, um dich zu bewegen. Deine Runen greifen von selbst an – du musst nur ausweichen und gut stehen.\nÜberlebe, bis die Zeit oben rechts abgelaufen ist.'],
  orbs: ['Erfahrung sammeln', 'Besiegte Gegner hinterlassen leuchtende Kugeln. Lauf darüber, um Erfahrung und Gold einzusammeln. Rote Markierungen am Boden: Dort schlägt gleich etwas ein – raus da!'],
  levelup: ['Stufenaufstieg', 'Wähle einen Segen. Er gilt bis zum Ende des Runs. Die Farbe zeigt die Seltenheit – je seltener, desto stärker. Manchmal steigt stattdessen eine Rune auf.'],
  rewards: ['Beute', 'Nach jedem Kampf wählst du eine Belohnung: eine neue Rune (eine weitere Fertigkeit), eine Glyphe (verbessert eine Rune) oder Ausrüstung. Gegenstände landen im Beutel – anlegen kannst du sie im Build.'],
  build: ['Dein Build', 'Runen feuern automatisch. Tippe eine Glyphe im Beutel an und dann einen grün markierten Sockel, um eine Rune zu verbessern. Unter „Ausrüstung“ legst du Gegenstände an, unter „Werte“ siehst du alles im Detail.'],
  glyph: ['Eine Glyphe!', 'Du hast deine erste Glyphe. Öffne oben „⚒ Build“ und sockle sie in eine passende Rune – grün markierte Sockel passen.'],
  boss: ['Ein Boss', 'Bosse haben mehrere Phasen. Achte auf Markierungen am Boden und weiche aus. Ab der Hälfte ihres Lebens setzen sie Mechaniken ein: Zerstöre Schildkristalle oder heilende Seelenanker, und flüchte bei Sternenschlägen in die grünen Kreise.'],
  shop: ['Händler', 'Kaufe Gegenstände, Glyphen und Heilung für Gold. Was du nicht brauchst, verkaufst du hier.'],
  forge: ['Schmiede', 'Würfle Eigenschaften eines Gegenstands neu, füge welche hinzu oder verstärke sie. Du kannst eine Eigenschaft sperren, zwei Gegenstände verschmelzen oder – riskant! – einen Gegenstand korrumpieren.'],
  evo: ['Runen-Evolution', 'Eine Rune hat Stufe 7 erreicht und kann sich weiterentwickeln. Wähle eine von zwei Formen – sie verändert, wie die Rune aussieht und wirkt.'],
  death: ['Gefallen – aber nicht umsonst', 'Jeder Run bringt Konto-Erfahrung und Sternenstaub. Mit jeder Kontostufe bekommst du Sternpunkte für die Sternenkarte. So wirst du dauerhaft stärker.'],
  tree: ['Die Sternenkarte', 'Hier verteilst du Sternpunkte – dauerhaft, für jeden Run dieser Klasse. Tippe einen Stern an und dann „Verteilen“. Große Sterne (Notables) sind stark, die riesigen Keystones verändern deine ganze Spielweise. ◎ zeigt die ganze Karte, ⌕ sucht nach Begriffen wie „Feuer“.'],
  codex: ['Der Kodex', 'Alles, was du entdeckt hast: Runen, Glyphen, Klassen, Aufstiegsklassen und Evolutionen. Neue Runen und Klassen schaltest du hier mit Sternenstaub frei.'],
  altar: ['Der Altar', 'Dauerhafte Segen für Sternenstaub: mehr Schaden und Leben, Startausrüstung, mehr Auswahl bei Belohnungen und vieles mehr.'],
  relics: ['Relikte', 'Relikte findest du bei Bossen, Eliten und Aufträgen. Angelegte Relikte wirken in jedem Run. Unbrauchbare kannst du zerlegen oder andere damit verfeinern.'],
  base: ['Die Zitadelle', 'Baue Gebäude mit Rohstoffen aus deinen Runs. Sie arbeiten auch, wenn du nicht spielst – schau regelmäßig vorbei und sammle ein. In der Alchemie braust du Tränke für den nächsten Run.'],
  cards: ['Schicksalskarten', 'Zu Beginn jedes Runs und nach jedem Akt ziehst du 2 Karten aus deinem Deck. Stelle dein Deck aus deiner Sammlung zusammen – doppelte Karten werden stärker.'],
  nemesis: ['Erzfeinde', 'Gegner, die dich töten, merken es sich. Sie wachsen, bekommen Namen und tauchen in späteren Runs wieder auf. Besiege sie für mythische Beute.'],
  season: ['Die Saison', 'Jeder Run bringt Saison-Erfahrung. Jeden Monat warten 40 Stufen mit Belohnungen.'],
  atlas: ['Der Sternenatlas', 'Wähle eine Region als Ziel – sie wird zum vierten Akt deines nächsten Feldzugs. Bezwungene Regionen geben Atlaspunkte für dauerhafte Vorteile.'],
  pets: ['Gefährten', 'Gefährten schlüpfen aus Eiern und kämpfen an deiner Seite. Wähle vor dem Run einen aus.'],
  factions: ['Die Häuser', 'Drei Häuser buhlen um deine Runen. Ruf bekommst du für Aufträge, Entscheidungen bei Begegnungen und Taten, die ein Haus schätzt. Jede Ruf-Stufe gibt einen dauerhaften Bonus und öffnet neue Waren beim Händler.'],
  story: ['Die Sage', 'Mit jedem Meilenstein schaltest du ein Kapitel der Geschichte frei. Was geschah in der Nacht, als der Himmel brach?'],
  abyss: ['Der Abgrund', 'Endlos in die Tiefe: Wähle auf jeder Ebene einen von mehreren Wegen. Jede 5. Ebene wartet ein Boss, ab Ebene 25 Sternenbestien.'],
  tower: ['Der Sternenturm', 'Jede Etage ist ein Kampf mit eigenem Gesetz. Nach jeder dritten Etage darfst du rasten. Deine höchste Etage zählt für die Wochen-Bestenliste – am Wochenende gibt es Belohnungen nach Platz.'],
  rush: ['Boss-Rush', 'Zehn Bosse hintereinander. Nach jedem Boss wirst du geheilt und steigst zwei Stufen auf. Die reine Kampfzeit zählt für deine Bestleistung.'],
  hunt: ['Sternenjagd', 'Die Karte ist verhüllt. Ziehe Feld für Feld weiter (👣 kostet einen Schritt). Spuren (⋯) zeigen zum Hort der Bestie, Sternsplitter (✦) schwächen sie. Gehen dir die Schritte aus, findet die Bestie dich.'],
};

const queue = [];
let showing = null, pausedCombat = false;
const on = () => !save.settings || save.settings.hints !== false;

/** Hinweis einmalig zeigen (wenn noch nicht gesehen). */
export function coach(id) {
  if (!HINTS[id] || !on()) return;
  save.hints = save.hints || {};
  if (save.hints[id] || queue.includes(id) || showing === id) return;
  queue.push(id);
  if (!showing) setTimeout(next, 220);
}
function next() {
  if (showing || !queue.length) return;
  const id = queue.shift();
  if (save.hints[id]) return next();
  showing = id;
  const [title, text] = HINTS[id];
  let el = document.getElementById('coach');
  if (!el) { el = document.createElement('div'); el.id = 'coach'; document.body.appendChild(el); }
  el.innerHTML = `<div class="cbox"><div class="cstar">✦</div><h3>${esc(title)}</h3>${text.split('\n').map((p) => `<p>${esc(p)}</p>`).join('')}
    <button class="btn primary" id="coachOk">Verstanden</button><button class="cskip" id="coachOff">Keine Hinweise mehr</button></div>`;
  el.className = 'show';
  const c = app.combat;
  if (c && c.running && !c.paused && !c.over) { c.paused = true; pausedCombat = true; }
  el.querySelector('#coachOk').onclick = (e) => { e.stopPropagation(); done(false); };
  el.querySelector('#coachOff').onclick = (e) => { e.stopPropagation(); done(true); };
}
function done(off) {
  const el = document.getElementById('coach');
  if (el) { el.className = ''; el.innerHTML = ''; }
  save.hints[showing] = true;
  if (off) { save.settings.hints = false; queue.length = 0; }
  persist();
  showing = null;
  if (queue.length) return setTimeout(next, 250);
  if (pausedCombat) { pausedCombat = false; const c = app.combat; if (c && c.running && !document.querySelector('#modal.show')) { c.paused = false; app.resetClock && app.resetClock(); } }
}
export const coachOpen = () => !!showing;
export function resetHints() { save.hints = {}; save.settings.hints = true; persist(); }

/** Willkommen beim allerersten Start. */
export function welcome(startTutorial) {
  save.hints = save.hints || {};
  if (save.hints.welcome || save.stats.runs > 0 || save.run) return false;
  let el = document.getElementById('coach');
  if (!el) { el = document.createElement('div'); el.id = 'coach'; document.body.appendChild(el); }
  showing = 'welcome';
  el.innerHTML = `<div class="cbox welcome"><div class="cstar">✦</div><h2>Willkommen, Runenträger</h2>
    <p>Die Sterne sind gefallen. Wo sie aufschlugen, erwachten Ungeheuer – und Runen voller Macht.</p>
    <p>In jedem <b>Run</b> kämpfst du dich durch drei Akte. Du wirst oft fallen – doch jeder Run macht dich dauerhaft stärker: mit Sternpunkten, Sternenstaub, Relikten und vielem mehr.</p>
    <button class="btn primary" id="coachOk">Einführung starten</button><button class="cskip" id="coachOff">Ich kenne mich aus – keine Hinweise</button></div>`;
  el.className = 'show';
  const close = (off) => {
    el.className = ''; el.innerHTML = '';
    showing = null;
    save.hints.welcome = true;
    if (off) save.settings.hints = false;
    persist();
    if (!off) startTutorial();
  };
  el.querySelector('#coachOk').onclick = (e) => { e.stopPropagation(); close(false); };
  el.querySelector('#coachOff').onclick = (e) => { e.stopPropagation(); close(true); };
  return true;
}
