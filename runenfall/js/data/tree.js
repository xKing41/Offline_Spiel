// Die Sternenkarte: ein riesiger Passivbaum.
// Aufbau (deterministisch aus einem festen Startwert, damit Speicherstände stabil bleiben):
//   · Sternenherz im Zentrum, 9 Klassen-Ursprünge im Kreis
//   · drei Zonen: Heimat (Klassenthemen), Grenzland (gemischt, Sternbilder), Sternenrand (Keystones, Mythos, Tore)
//   · Hunderte Cluster in verschiedenen Formen (Ring, Rad, Stern, Kette, Doppel …), verbunden zu einem Netz
//   · Meisterschaften (wähle 1 von 3), Sternbilder mit Krönungsstern, Sternentore, Juwelsockel
// Wird der Aufbau geändert, TREE_VERSION erhöhen – dann werden alle Punkte erstattet.
import { makeRng } from '../util.js';

export const TREE_VERSION = 2;

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


// Zusätzliche, seltenere Themen (vor allem im Grenzland und am Sternenrand)
Object.assign(THEMES, {
  conv: { small: [inc('dmg_elem', 6)], notables: [['Glutwandlung', [flat('conv_phys_fire', 25), inc('dmg_fire', 10)]], ['Frostwandlung', [flat('conv_phys_cold', 25), inc('dmg_cold', 10)]], ['Blitzwandlung', [flat('conv_phys_light', 25), inc('dmg_light', 10)]], ['Leerenwandlung', [flat('conv_phys_chaos', 20), inc('dmg_chaos', 10)]]] },
  dodge: { small: [flat('evasion', 20)], notables: [['Windgestalt', [flat('dodge', 4), inc('move', 4)]], ['Schemen', [flat('dodge', 5), inc('evasion', 15)]]] },
  thorns: { small: [inc('armor', 12)], notables: [['Dornenhaut', [flat('spec_thorns', 60), inc('armor', 15)]], ['Stachelwall', [flat('spec_thorns', 40), flat('armor', 60)]]] },
  gold: { small: [inc('gold', 8)], notables: [['Schatzsucher', [inc('gold', 25), flat('startGold', 40)]], ['Goldader', [inc('gold', 20), inc('luck', 12)]]] },
  heal: { small: [inc('heal', 8)], notables: [['Lebensfunke', [inc('heal', 25), flat('lifeOnKill', 4)]], ['Wundheiler', [inc('heal', 20), flat('lifeRegen', 3)]]] },
  spellcrit: { small: [inc('crit_spell', 15)], notables: [['Sternendeutung', [inc('crit_spell', 40), flat('critMulti', 15)]], ['Arkaner Funke', [inc('crit_spell', 30), inc('speed_spell', 6)]]] },
  attackcrit: { small: [inc('crit_attack', 15)], notables: [['Klingenauge', [inc('crit_attack', 40), flat('critMulti', 15)]], ['Präzisionsschlag', [inc('crit_attack', 30), inc('speed_attack', 6)]]] },
  projcrit: { small: [inc('crit_proj', 15)], notables: [['Falkenblick', [inc('crit_proj', 40), inc('projSpeed', 15)]], ['Meisterschuss', [inc('crit_proj', 30), flat('pierce', 1)]]] },
  areaspell: { small: [inc('area_spell', 6)], notables: [['Sternenexplosion', [inc('area_spell', 20), inc('dmg_spell', 12)]], ['Weite Bahnen', [inc('area_spell', 15), inc('dur', 10)]]] },
  firepen: { small: [flat('pen_fire', 2)], notables: [['Weißglut', [flat('pen_fire', 10), inc('dmg_fire', 10)]]] },
  coldpen: { small: [flat('pen_cold', 2)], notables: [['Absoluter Nullpunkt', [flat('pen_cold', 10), inc('dmg_cold', 10)]]] },
  lightpen: { small: [flat('pen_light', 2)], notables: [['Durchschlag', [flat('pen_light', 10), inc('dmg_light', 10)]]] },
  chaospen: { small: [flat('pen_chaos', 2)], notables: [['Seelenfraß', [flat('pen_chaos', 10), inc('dmg_chaos', 10)]]] },
  addfire: { small: [flat('add_fire', 1)], notables: [['Funkenschmied', [flat('add_fire', 4), inc('dmg_fire', 10)]]] },
  addcold: { small: [flat('add_cold', 1)], notables: [['Frostschmied', [flat('add_cold', 4), inc('dmg_cold', 10)]]] },
  addlight: { small: [flat('add_light', 1)], notables: [['Sturmschmied', [flat('add_light', 4), inc('dmg_light', 10)]]] },
  addchaos: { small: [flat('add_chaos', 1)], notables: [['Leerenschmied', [flat('add_chaos', 4), inc('dmg_chaos', 10)]]] },
  boss: { small: [inc('dmgVsBoss', 8)], notables: [['Titanentöter', [inc('dmgVsBoss', 25), flat('critMulti', 10)]], ['Königsmörder', [inc('dmgVsBoss', 20), flat('pen', 4)]]] },
  ailment: { small: [inc('dmgVsAilment', 8)], notables: [['Grausamkeit', [inc('dmgVsAilment', 25), inc('ailDur', 10)]], ['Leidbringer', [inc('dmgVsAilment', 20), flat('bleedChance', 8)]]] },
  resall: { small: [flat('res_elem', 3), flat('res_chaos', 3)], notables: [['Sternenmantel', [flat('res_elem', 10), flat('res_chaos', 10)]], ['Urgewalt', [flat('resMax', 2), flat('res_elem', 6)]]] },
  barrierfast: { small: [inc('barrierRecharge', 10)], notables: [['Schnellschild', [inc('barrierRecharge', 35), flat('barrier', 15)]]] },
  minionspeed: { small: [inc('speed_minion', 6)], notables: [['Rudelführer', [inc('speed_minion', 20), inc('dmg_minion', 10)]]] },
  traparea: { small: [inc('area_trap', 8)], notables: [['Weite Fallen', [inc('area_trap', 25), inc('dmg_trap', 10)]]] },
  aurarea: { small: [inc('area_aura', 8)], notables: [['Sternenkrone', [inc('area_aura', 25), inc('dmg_aura', 10)]]] },
  orbitspeed: { small: [inc('speed_orbit', 6)], notables: [['Wirbelwind', [inc('speed_orbit', 20), inc('dmg_orbit', 10)]]] },
  meleearea: { small: [inc('area_melee', 6)], notables: [['Weiter Schwung', [inc('area_melee', 20), inc('dmg_melee', 10)]]] },
});
const THEME_NAMES = {
  fire: 'Feuer', cold: 'Kälte', light: 'Blitz', phys: 'Physisch', chaos: 'Chaos', elem: 'Elementar', spell: 'Zauber', attack: 'Angriff',
  proj: 'Projektil', area: 'Fläche', melee: 'Nahkampf', crit: 'Kritisch', critmulti: 'Vernichtung', speed: 'Tempo', life: 'Leben',
  armor: 'Rüstung', evasion: 'Ausweichen', barrier: 'Barriere', regen: 'Regeneration', leech: 'Lebensraub', burn: 'Brand',
  poison: 'Gift', bleed: 'Blutung', shock: 'Schock', chill: 'Kälte', dot: 'Siechtum', dur: 'Dauer', minion: 'Begleiter',
  trap: 'Fallen', aura: 'Aura', orbit: 'Klingenkreis', chain: 'Kette', move: 'Bewegung', res: 'Widerstand', fortune: 'Glück',
  dmg: 'Macht', execute: 'Henker', pen: 'Durchdringung', conv: 'Wandlung', dodge: 'Schemen', thorns: 'Dornen', gold: 'Reichtum',
  heal: 'Heilung', spellcrit: 'Sternendeutung', attackcrit: 'Klingenauge', projcrit: 'Falkenblick', areaspell: 'Weite',
  firepen: 'Weißglut', coldpen: 'Nullpunkt', lightpen: 'Durchschlag', chaospen: 'Seelenfraß', addfire: 'Funkenschmiede',
  addcold: 'Frostschmiede', addlight: 'Sturmschmiede', addchaos: 'Leerenschmiede', boss: 'Titanenjagd', ailment: 'Grausamkeit',
  resall: 'Sternenmantel', barrierfast: 'Schildlicht', minionspeed: 'Rudel', traparea: 'Fallenfeld', aurarea: 'Strahlkraft',
  orbitspeed: 'Wirbel', meleearea: 'Schwung',
};
export const themeName = (t) => THEME_NAMES[t] || t;

// Namen für die Notables: „[Substantiv] [Genitiv]“ – ergibt Hunderte eindeutige Namen.
const NOUNS = ['Herz', 'Krone', 'Pfad', 'Kunst', 'Gabe', 'Siegel', 'Ruf', 'Wille', 'Zorn', 'Segen', 'Atem', 'Kreis', 'Echo', 'Tanz',
  'Lied', 'Schwur', 'Wacht', 'Pakt', 'Funke', 'Schild', 'Hand', 'Auge', 'Klinge', 'Stimme', 'Gesetz', 'Erbe', 'Opfer', 'Weg', 'Gruß', 'Lohn'];
const GEN = {
  fire: ['der Glut', 'der Flammen', 'des Infernos', 'der Esse', 'des Phönix'], cold: ['des Frosts', 'des Winters', 'der Gletscher', 'des Raureifs'],
  light: ['des Sturms', 'der Blitze', 'des Donners', 'der Gewitter'], phys: ['des Stahls', 'der Faust', 'des Hammers', 'der Kraft'],
  chaos: ['der Leere', 'des Abgrunds', 'der Verderbnis', 'des Nichts'], elem: ['der Elemente', 'des Prismas', 'der Urkräfte'],
  spell: ['der Magier', 'der Runen', 'der Arkana', 'der Zauberei'], attack: ['der Krieger', 'der Schlacht', 'des Kampfes'],
  proj: ['der Schützen', 'der Pfeile', 'des Falken'], area: ['der Weite', 'des Bebens', 'der Wellen'], melee: ['der Klingen', 'des Nahkampfs', 'der Fäuste'],
  crit: ['des Glücks', 'der Präzision', 'des Zufalls'], critmulti: ['der Vernichtung', 'des Todesstoßes'], speed: ['der Eile', 'des Windes', 'der Hast'],
  life: ['des Lebens', 'der Titanen', 'der Ausdauer'], armor: ['der Festung', 'des Eisens', 'der Mauern'], evasion: ['der Schatten', 'des Nebels'],
  barrier: ['der Sterne', 'des Lichts', 'des Schildes'], regen: ['der Quelle', 'der Erneuerung'], leech: ['des Blutes', 'der Vampire'],
  burn: ['der Asche', 'des Brandes'], poison: ['der Natter', 'des Giftes'], bleed: ['der Wunden', 'der Adern'], shock: ['der Spannung', 'der Funken'],
  chill: ['des Eises', 'der Starre'], dot: ['des Siechtums', 'der Fäulnis'], dur: ['der Ewigkeit', 'der Zeit'], minion: ['der Legion', 'der Diener', 'des Rudels'],
  trap: ['der Fallen', 'der Runensteine'], aura: ['der Präsenz', 'der Strahlen'], orbit: ['des Reigens', 'der Kreise'], chain: ['der Ketten', 'der Kaskaden'],
  move: ['der Reise', 'der Wanderer'], res: ['des Widerstands', 'der Standhaftigkeit'], fortune: ['des Schicksals', 'der Fortuna'], dmg: ['der Macht', 'des Sieges'],
  execute: ['des Henkers', 'des Richters'], pen: ['der Bresche', 'des Durchbruchs'], conv: ['der Wandlung', 'der Alchemie'], dodge: ['der Schemen', 'des Phantoms'],
  thorns: ['der Dornen', 'der Stacheln'], gold: ['des Goldes', 'der Händler'], heal: ['der Heiler', 'der Gnade'], spellcrit: ['der Sterndeuter'],
  attackcrit: ['der Klingenmeister'], projcrit: ['der Jäger'], areaspell: ['der Sphären'], firepen: ['der Weißglut'], coldpen: ['des Nullpunkts'],
  lightpen: ['des Blitzschlags'], chaospen: ['der Seelenfresser'], addfire: ['der Funkenschmiede'], addcold: ['der Frostschmiede'],
  addlight: ['der Sturmschmiede'], addchaos: ['der Leerenschmiede'], boss: ['der Titanenjäger'], ailment: ['der Qual'], resall: ['des Sternenmantels'],
  barrierfast: ['des Schildlichts'], minionspeed: ['der Meute'], traparea: ['des Fallenfelds'], aurarea: ['der Strahlkraft'], orbitspeed: ['des Wirbels'],
  meleearea: ['des Schwungs'],
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


// Weitere Keystones am Sternenrand – jeder verändert das Spiel spürbar.
Object.assign(KEYSTONES, {
  volcano: { name: 'Vulkanherz', mods: [flat('spec_killExplode', 15), more('speed', -10)], desc: 'Jeder Tod wird zur Explosion.' },
  critchain: { name: 'Kettenreaktion', mods: [flat('spec_critChain', 1), inc('crit', -25)], desc: 'Kritische Treffer springen weiter.' },
  overflow: { name: 'Überlauf', mods: [flat('spec_overkill', 1), more('speed', -10)], desc: 'Überschüssige Kraft geht nie verloren.' },
  phoenix: { name: 'Phönixschwur', mods: [flat('spec_rebirth', 1), more('life', -15)], desc: 'Einmal pro Kampf stehst du wieder auf.' },
  thornlord: { name: 'Dornenfürst', mods: [flat('spec_thorns', 300), flat('armor', 150), more('dmg', -20)], desc: 'Wer dich berührt, blutet.' },
  frenzy: { name: 'Blutrausch', mods: [flat('spec_frenzy', 1), more('life', -10)], desc: 'Jede Tötung treibt dich an.' },
  berserk: { name: 'Berserkerblut', mods: [flat('spec_berserk', 1), flat('res_elem', -20)], desc: 'Je näher am Tod, desto tödlicher.' },
  stillness: { name: 'Meditation', mods: [flat('spec_stillness', 1), more('move', -25)], desc: 'Wer stillsteht, trifft härter.' },
  bulwark: { name: 'Sternenbollwerk', mods: [flat('spec_bulwark', 1), more('barrier', 30), more('life', -20)], desc: 'Die Barriere schützt vor allem.' },
  shatter: { name: 'Zersplitterung', mods: [flat('spec_shatter', 1), flat('freezeChance', 15), more('dmg_fire', -50)], desc: 'Eis zerbricht – und reißt andere mit.' },
  boomerang: { name: 'Wiederkehr', mods: [flat('spec_return', 1), more('projSpeed', -20)], desc: 'Alles, was du wirfst, kehrt zurück.' },
  fork: { name: 'Gabelung', mods: [flat('spec_fork', 1), more('dmg_proj', -10)], desc: 'Jedes Geschoss teilt sich.' },
  aftershock: { name: 'Nachbeben', mods: [flat('spec_aftershock', 1), more('speed', -15)], desc: 'Jeder Einschlag hallt nach.' },
  plaguewind: { name: 'Seuchenwind', mods: [flat('spec_poisonVuln', 25), more('dmg_phys', -30)], desc: 'Gift schwächt alles.' },
  frostaura: { name: 'Ewiger Winter', mods: [flat('spec_chillAura', 1), more('dmg_fire', -30)], desc: 'Um dich herum erstarrt die Welt.' },
  stormwalker: { name: 'Sturmläufer', mods: [flat('spec_moveStrike', 2), more('speed', -10)], desc: 'Jeder Schritt ruft den Blitz.' },
  ruthless: { name: 'Gnadenlos', mods: [flat('spec_ruthless', 100), more('speed', -15)], desc: 'Jeder dritte Schlag ist vernichtend.' },
  bloodbond: { name: 'Blutband', mods: [flat('spec_minionLeech', 3), more('life', -15)], desc: 'Deine Diener nähren dich.' },
  eternity: { name: 'Echo der Ewigkeit', mods: [flat('spec_echoAll', 1), more('dmg', -35)], desc: 'Jeder Zauber erklingt zweimal.' },
  elembond: { name: 'Elementarbund', mods: [more('dmg_elem', 30), more('dmg_phys', -60)], desc: 'Nur die Elemente zählen.' },
  crystal: { name: 'Kristallgeist', mods: [flat('resMax', 5), flat('res_elem', 20), more('life', -10)], desc: 'Unberührbar für die Elemente.' },
  avatar: { name: 'Avatar der Sterne', mods: [flat('lvl', 1), more('dmg', -10), more('life', -10)], desc: 'Höhere Runen, schwächerer Körper.' },
  greed: { name: 'Sternengier', mods: [inc('luck', 80), inc('gold', 50), more('dmg', -15)], desc: 'Reichtum über alles.' },
  aegis: { name: 'Ewiger Schild', mods: [more('barrier', 60), more('barrierRecharge', -50)], desc: 'Ein Schild, der langsam heilt.' },
  scavenger: { name: 'Aasfresser', mods: [flat('lifeOnKill', 20), flat('spec_noRegen', 1)], desc: 'Leben nur durch Tötungen.' },
  nova: { name: 'Supernova', mods: [flat('spec_critExplode', 40), flat('critBase', -2)], desc: 'Seltene Krits, die alles zerreißen.' },
  ailmaster: { name: 'Herr der Qualen', mods: [more('dmgVsAilment', 40), more('dmg', -10), inc('ailDur', 30)], desc: 'Wer leidet, fällt schneller.' },
  colossus: { name: 'Koloss', mods: [more('life', 40), more('move', -15), more('speed', -10)], desc: 'Unerschütterlich, aber schwerfällig.' },
  hunter: { name: 'Großwildjagd', mods: [more('dmgVsBoss', 50), more('dmg', -15)], desc: 'Gemacht für die Großen.' },
  swarmlord: { name: 'Schwarmgeist', mods: [flat('minionCount', 3), more('dmg_minion', -30)], desc: 'Masse ist Macht.' },
});

export const CLASS_ORDER = ['pyro', 'storm', 'ranger', 'hunter', 'plague', 'warden', 'monk', 'binder', 'chrono'];
const SECTORS = {
  pyro: { themes: ['fire', 'spell', 'burn', 'area', 'elem', 'barrier', 'pen', 'aura', 'firepen', 'addfire', 'spellcrit', 'areaspell'], minor: inc('dmg_fire', 3), start: [inc('dmg_fire', 8), flat('barrier', 10)], name: 'Reich der Glut' },
  storm: { themes: ['light', 'speed', 'shock', 'spell', 'chain', 'crit', 'elem', 'move', 'lightpen', 'addlight', 'spellcrit', 'critmulti'], minor: inc('speed', 2), start: [inc('dmg_light', 8), inc('move', 4)], name: 'Gewitterweiten' },
  ranger: { themes: ['proj', 'crit', 'evasion', 'attack', 'critmulti', 'move', 'speed', 'projcrit', 'execute', 'dodge', 'pen', 'fortune'], minor: inc('dmg_proj', 3), start: [inc('dmg_proj', 8), flat('evasion', 30)], name: 'Pfad der Schützen' },
  hunter: { themes: ['attack', 'minion', 'proj', 'bleed', 'minionspeed', 'boss', 'execute', 'speed', 'attackcrit', 'move', 'phys', 'gold'], minor: inc('dmg_attack', 3), start: [inc('dmg_attack', 8), inc('dmg_minion', 8)], name: 'Jagdgründe' },
  plague: { themes: ['chaos', 'poison', 'dot', 'dur', 'leech', 'bleed', 'ailment', 'res', 'chaospen', 'addchaos', 'regen', 'evasion'], minor: inc('dmg_dot', 3), start: [inc('dmg_chaos', 8), flat('res_chaos', 10)], name: 'Seuchenland' },
  warden: { themes: ['life', 'armor', 'melee', 'phys', 'regen', 'thorns', 'res', 'attack', 'meleearea', 'heal', 'resall', 'dmg'], minor: flat('life', 6), start: [flat('life', 20), flat('armor', 30)], name: 'Feste der Wächter' },
  monk: { themes: ['melee', 'speed', 'crit', 'dodge', 'move', 'attackcrit', 'meleearea', 'light', 'evasion', 'leech', 'execute', 'dmg'], minor: inc('dmg_melee', 3), start: [inc('dmg_melee', 8), inc('speed', 4)], name: 'Kloster der Stille' },
  binder: { themes: ['minion', 'trap', 'aura', 'barrier', 'orbit', 'traparea', 'aurarea', 'orbitspeed', 'minionspeed', 'dur', 'fortune', 'life'], minor: inc('dmg_minion', 4), start: [inc('dmg_minion', 10), flat('life', 10)], name: 'Bannkreis' },
  chrono: { themes: ['cold', 'dur', 'chill', 'spell', 'coldpen', 'addcold', 'barrierfast', 'areaspell', 'elem', 'crit', 'speed', 'conv'], minor: inc('dmg_cold', 3), start: [inc('dmg_cold', 8), inc('dur', 8)], name: 'Zeitgletscher' },
};
const EXOTIC = ['conv', 'resall', 'boss', 'ailment', 'thorns', 'dodge', 'gold', 'heal', 'critmulti', 'pen', 'dmg', 'execute', 'leech', 'fortune', 'chain', 'orbit'];

// Mythos-Sterne: einzigartige, starke Notables am Sternenrand (Spezialeffekte).
const MYTHS = [
  ['Sternenfall', [flat('spec_killExplode', 6), inc('dmg_area', 15)]], ['Leuchtfeuer', [flat('spec_burnSpread', 1), inc('burn', 20)]],
  ['Kettenblitz', [flat('spec_shockSpread', 1), inc('shockEffect', 20)]], ['Schwarze Pest', [flat('spec_poisonVuln', 10), inc('poison', 15)]],
  ['Frosthauch', [flat('spec_chillAura', 1), inc('dmg_cold', 10)]], ['Donnerschritt', [flat('spec_moveStrike', 1), inc('move', 5)]],
  ['Henkerschwur', [flat('spec_ruthless', 50), inc('dmgVsLow', 15)]], ['Zersplitterer', [flat('spec_shatter', 1), flat('freezeChance', 6)]],
  ['Dornenkleid', [flat('spec_thorns', 80), inc('armor', 20)]], ['Zweite Chance', [flat('spec_rebirth', 1)]],
  ['Blutsband', [flat('spec_minionLeech', 1), inc('dmg_minion', 15)]], ['Funkensprung', [flat('spec_critChain', 1), inc('crit', 10)]],
  ['Überkraft', [flat('spec_overkill', 1), inc('dmg', 6)]], ['Rausch', [flat('spec_frenzy', 1), inc('speed', 4)]],
  ['Letztes Gefecht', [flat('spec_berserk', 1), inc('life', 5)]], ['Ruhepol', [flat('spec_stillness', 1), flat('armor', 40)]],
  ['Sternenwall', [flat('spec_bulwark', 1), inc('barrier', 15)]], ['Splitterhagel', [flat('spec_fork', 1), inc('dmg_proj', 8)]],
  ['Rückkehr', [flat('spec_return', 1), inc('projSpeed', 15)]], ['Erdbeben', [flat('spec_aftershock', 1), inc('dmg_area', 8)]],
  ['Sternenriss', [flat('spec_critExplode', 15), flat('critMulti', 10)]], ['Runenmeister', [flat('lvl', 1)]],
  ['Ewige Wache', [flat('resMax', 2), flat('res_elem', 8)]], ['Urfunke', [more('dmg', 6)]], ['Urleben', [more('life', 6)]],
];

// Sternbilder: Formen (Einheitskoordinaten) + zusätzliche Kanten. Der letzte Punkt ist der Krönungsstern.
const SHAPES = [
  { name: 'Der Drache', pts: [[-1, 0.6], [-0.6, 0.1], [-0.2, 0.4], [0.2, -0.1], [0.5, 0.3], [0.8, -0.2], [0.6, -0.7], [1, -0.9]], extra: [] },
  { name: 'Die Waage', pts: [[0, 0.9], [0, 0.3], [-0.8, 0.1], [0.8, 0.1], [-0.9, -0.4], [0.9, -0.4], [0, -0.3], [0, -0.9]], extra: [[1, 2], [1, 3], [2, 4], [3, 5], [1, 6]] },
  { name: 'Der Jäger', pts: [[-0.5, 0.9], [0.5, 0.9], [-0.3, 0.2], [0.3, 0.2], [0, 0], [-0.6, -0.5], [0.6, -0.5], [0, -0.95]], extra: [[0, 2], [1, 3], [2, 4], [3, 4], [4, 5], [4, 6], [5, 7], [6, 7]] },
  { name: 'Die Krone', pts: [[-1, 0.4], [-0.6, -0.3], [-0.3, 0.2], [0, -0.6], [0.3, 0.2], [0.6, -0.3], [1, 0.4], [0, 0.6]], extra: [[0, 7], [6, 7]] },
  { name: 'Der Skorpion', pts: [[-0.9, -0.6], [-0.7, -0.2], [-0.4, 0], [0, 0.1], [0.4, 0.3], [0.7, 0.6], [0.95, 0.3], [0.8, -0.1]], extra: [] },
  { name: 'Die Schlange', pts: [[-0.9, 0.8], [-0.4, 0.6], [-0.2, 0.2], [-0.5, -0.1], [-0.1, -0.4], [0.4, -0.3], [0.6, 0.1], [0.95, -0.2]], extra: [] },
  { name: 'Der Kelch', pts: [[-0.8, -0.8], [0.8, -0.8], [-0.5, -0.2], [0.5, -0.2], [0, 0.1], [0, 0.5], [-0.4, 0.9], [0.4, 0.9]], extra: [[0, 2], [1, 3], [2, 4], [3, 4], [4, 5], [5, 6], [5, 7]] },
  { name: 'Das Schwert', pts: [[0, 1], [0, 0.6], [-0.5, 0.4], [0.5, 0.4], [0, 0.2], [0, -0.2], [0, -0.6], [0, -1]], extra: [[1, 2], [1, 3], [2, 4], [3, 4]] },
  { name: 'Der Phönix', pts: [[-1, -0.6], [-0.6, -0.1], [-0.25, 0.25], [1, -0.6], [0.6, -0.1], [0.25, 0.25], [0, 0.55], [0, -0.3]], extra: [[0, 1], [1, 2], [3, 4], [4, 5], [2, 6], [5, 6], [6, 7]] },
];
const LEGENDS = [
  ['Herz des Drachen', [more('dmg_fire', 15), flat('igniteChance', 15)]], ['Gleichgewicht', [more('dmg', 8), more('life', 8)]],
  ['Gürtel des Jägers', [more('dmg_proj', 15), flat('proj', 1)]], ['Krone der Sterne', [flat('lvl', 1), inc('dmg', 10)]],
  ['Stachel des Skorpions', [more('poison', 25), flat('poisonChance', 20)]], ['Häutung', [flat('lifeRegenPct', 1.5), more('life', 6)]],
  ['Gral', [flat('leech', 2), more('heal', 30)]], ['Sternenklinge', [more('dmg_melee', 15), flat('critMulti', 25)]],
  ['Auferstehung', [flat('spec_rebirth', 1), more('barrier', 20)]], ['Feuer des Drachen', [flat('conv_phys_fire', 40), more('dmg_fire', 10)]],
  ['Waagschale', [flat('res_elem', 15), flat('resMax', 2)]], ['Pfeil des Jägers', [more('dmgVsBoss', 25), inc('crit_proj', 50)]],
  ['Diadem', [more('dmg_spell', 15), inc('speed_spell', 10)]], ['Giftschwanz', [flat('spec_poisonVuln', 15), more('dmg_chaos', 12)]],
  ['Ouroboros', [more('dur', 25), more('dmg_dot', 15)]], ['Kelch des Lebens', [more('life', 12), flat('lifeOnKill', 6)]],
  ['Schwertschwur', [more('dmg_attack', 15), more('speed_attack', 8)]], ['Asche und Flug', [more('speed', 10), inc('move', 10)]],
];

const SKIP_PORT = new Set(['notable', 'mastery', 'key', 'jewel', 'portal', 'myth', 'legend']);
let cached = null;

export function getTree() {
  if (cached) return cached;
  const rng = makeRng(20251014);
  const nodes = new Map();
  const edges = [];
  const add = (id, props) => { const n = { id, adj: new Set(), mods: [], ...props }; nodes.set(id, n); return n; };
  const link = (a, b, kind) => {
    if (a === b || nodes.get(a).adj.has(b)) return;
    nodes.get(a).adj.add(b); nodes.get(b).adj.add(a); edges.push(kind ? [a, b, kind] : [a, b]);
  };
  const polar = (r, deg) => ({ x: r * Math.cos((deg * Math.PI) / 180), y: r * Math.sin((deg * Math.PI) / 180) });
  const N = CLASS_ORDER.length, SEC = 360 / N;
  const angOf = (x, y) => { let a = (Math.atan2(y, x) * 180) / Math.PI + 90 + SEC / 2; a = ((a % 360) + 360) % 360; return a; };
  const sectorOf = (x, y) => Math.floor(angOf(x, y) / SEC) % N;
  const R_MAX = 5600;
  const zoneOf = (r) => (r < 1900 ? 0 : r < 3700 ? 1 : 2);
  const round = (v) => (Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 2) / 2);
  const scale = (mods, k) => mods.map((m) => (m.s.startsWith('spec_') || m.s === 'lvl' || m.s === 'proj' || m.s === 'minionCount' || m.s === 'chain' || m.s === 'pierce' ? m : { ...m, v: round(m.v * k) }));
  const usedNames = new Set();
  const notableName = (theme, base) => {
    const g = GEN[theme] || ['der Sterne'];
    for (let i = 0; i < 12; i++) {
      const nm = `${rng.pick(NOUNS)} ${rng.pick(g)}`;
      if (!usedNames.has(nm)) { usedNames.add(nm); return nm; }
    }
    return base;
  };
  const travelMods = (sec, zone, i) => {
    const minor = SECTORS[CLASS_ORDER[sec]].minor;
    const pool = [minor, flat('life', 6), inc('dmg', 3), flat('res_elem', 2), inc('speed', 2), flat('armor', 15), flat('evasion', 15), inc('crit', 6)];
    return [zone === 0 ? (i % 2 ? minor : flat('life', 6)) : pool[(i * 7 + sec * 3 + zone) % pool.length]];
  };
  const path = (aId, bId, pfx) => {
    const a = nodes.get(aId), b = nodes.get(bId);
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(0, Math.round(d / 90) - 1);
    let prev = aId;
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      const id = `${pfx}_${i}`;
      add(id, { x, y, type: 'travel', name: 'Wegstern', mods: travelMods(sectorOf(x, y), zoneOf(Math.hypot(x, y)), i) });
      link(prev, id);
      prev = id;
    }
    link(prev, bId);
  };

  // ---------------- Zentrum: Sternenherz + Ursprünge
  const HUBS = N * 2;
  for (let i = 0; i < HUBS; i++) add(`h${i}`, { ...polar(130, -90 + (i * 360) / HUBS), type: 'hub', name: 'Sternenherz', mods: [i % 2 ? flat('life', 6) : inc('dmg', 3)] });
  for (let i = 0; i < HUBS; i++) link(`h${i}`, `h${(i + 1) % HUBS}`);
  const starts = {};
  CLASS_ORDER.forEach((cls, k) => {
    const sid = `start_${cls}`;
    add(sid, { ...polar(270, -90 + SEC * k), type: 'start', cls, name: 'Ursprung', mods: SECTORS[cls].start });
    starts[cls] = sid;
    path(sid, `h${2 * k}`, `p_${sid}_hub`);
  });

  // ---------------- Entitäten (Cluster & Besonderheiten) platzieren
  const ents = [];
  const grid = new Map();
  const G = 460;
  const gk = (x, y) => `${Math.floor(x / G)},${Math.floor(y / G)}`;
  const free = (x, y, rad) => {
    const gx = Math.floor(x / G), gy = Math.floor(y / G);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const cell = grid.get(`${gx + dx},${gy + dy}`);
      if (cell) for (const e of cell) { const m = e.rad + rad, ex = e.x - x, ey = e.y - y; if (ex * ex + ey * ey < m * m) return false; }
    }
    return true;
  };
  const place = (e) => { e.idx = ents.length; ents.push(e); const k = gk(e.x, e.y); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(e); return e; };

  // Keystones: zwei Ringe am Rand
  const keyIds = Object.keys(KEYSTONES);
  keyIds.forEach((key, i) => {
    const outer = i % 2 === 0;
    const a = -90 + (i * 360) / keyIds.length + rng.range(-2, 2);
    const p = polar(outer ? 5350 : 4450, a);
    place({ kind: 'key', key, ...p, rad: 150, maxLinks: 1 });
  });
  // Sternbilder
  for (let i = 0; i < 18; i++) {
    const a = -90 + SEC / 2 + (i % 9) * SEC + (i < 9 ? 0 : SEC / 2) + rng.range(-4, 4);
    const r = i < 9 ? 2900 : 4700;
    place({ kind: 'const', shape: SHAPES[i % SHAPES.length], legend: LEGENDS[i], ...polar(r, a), rad: 270, maxLinks: 3, rot: rng.range(0, Math.PI * 2), id: i });
  }
  // Juwelsockel: 4 pro Sektor
  CLASS_ORDER.forEach((cls, k) => {
    [950, 1800, 2700, 3600, 4600].forEach((r, i) => {
      for (let t = 0; t < 30; t++) {
        const p = polar(r + rng.range(-80, 80), -90 + SEC * k + rng.range(-SEC / 2.6, SEC / 2.6));
        if (free(p.x, p.y, 120)) { place({ kind: 'jewel', id: `${k}_${i}`, ...p, rad: 120, maxLinks: 2 }); break; }
      }
    });
  });
  // Sternentore: Paare über die Karte hinweg
  for (let i = 0; i < 12; i++) {
    for (let t = 0; t < 40; t++) {
      const a = rng.range(0, 360), b = a + 180 + rng.range(-50, 50);
      const pa = polar(rng.range(3900, 5100), a), pb = polar(rng.range(3900, 5100), b);
      if (free(pa.x, pa.y, 130) && free(pb.x, pb.y, 130)) {
        place({ kind: 'portal', id: `${i}a`, pair: `${i}b`, ...pa, rad: 130, maxLinks: 2 });
        place({ kind: 'portal', id: `${i}b`, pair: `${i}a`, ...pb, rad: 130, maxLinks: 2 });
        break;
      }
    }
  }
  // Normale Cluster füllen den Rest (Dart-Throwing)
  let ci = 0;
  for (let t = 0, fails = 0; t < 120000 && ci < 2000 && fails < 6000; t++) {
    const r = Math.sqrt(rng.range(430 * 430, R_MAX * R_MAX));
    const p = polar(r, rng.range(0, 360));
    const zone = zoneOf(r);
    const rad = zone === 0 ? 135 : zone === 1 ? 150 : 165;
    if (!free(p.x, p.y, rad)) { fails++; continue; }
    fails = 0;
    place({ kind: 'cluster', id: ci++, ...p, rad, maxLinks: 4, zone });
  }

  // ---------------- Entitäten in Knoten umsetzen
  const pickTheme = (e) => {
    const sec = sectorOf(e.x, e.y), z = zoneOf(Math.hypot(e.x, e.y));
    const own = SECTORS[CLASS_ORDER[sec]].themes;
    if (z === 0) return rng.pick(own);
    if (z === 1) {
      const nb = SECTORS[CLASS_ORDER[(sec + (rng.next() < 0.5 ? 1 : N - 1)) % N]].themes;
      const r = rng.next();
      return r < 0.5 ? rng.pick(own) : r < 0.8 ? rng.pick(nb) : rng.pick(EXOTIC);
    }
    return rng.next() < 0.45 ? rng.pick(own) : rng.pick(EXOTIC.concat(own));
  };
  const strength = (x, y) => 1 + Math.hypot(x, y) / 9000;
  const mkSmall = (id, x, y, theme, k) => add(id, { x, y, type: 'small', name: themeName(theme), mods: scale(THEMES[theme].small, k), theme });
  const mkNotable = (id, x, y, theme, k, second) => {
    const th = THEMES[theme];
    const [base, mods] = rng.pick(th.notables);
    let m = scale(mods, k);
    if (second && second !== theme && rng.next() < 0.55) m = m.concat(scale(THEMES[second].small, k * 1.5));
    return add(id, { x, y, type: 'notable', name: notableName(theme, base), mods: m, theme });
  };
  const mkMastery = (id, x, y, theme, k) => {
    const sm = THEMES[theme].small;
    const opts = [
      { name: 'Vertiefung', mods: scale(sm, k * 3) },
      { name: 'Standhaftigkeit', mods: scale(sm, k * 1.5).concat([inc('life', round(6 * k))]) },
      { name: 'Schwung', mods: scale(sm, k * 1.5).concat([inc('speed', round(3 * k))]) },
    ];
    return add(id, { x, y, type: 'mastery', name: `Meisterschaft: ${themeName(theme)}`, mods: [], options: opts, theme });
  };
  const SHAPES_BY_ZONE = [['ring4', 'ring4', 'tri', 'line', 'pair', 'star'], ['ring4', 'wheel', 'star', 'line', 'double', 'tri', 'cross'], ['wheel', 'star', 'double', 'cross', 'ring4', 'myth', 'line']];
  for (const e of ents) {
    const k = strength(e.x, e.y);
    const toC = Math.atan2(-e.y, -e.x);
    const pfx = `${e.kind[0]}${e.id ?? e.key}`;
    e.ports = [];
    const P = (i, rr, off = 0) => ({ x: e.x + Math.cos(toC + off + (i * Math.PI * 2) / 1) * rr, y: e.y + Math.sin(toC + off) * rr });
    void P;
    if (e.kind === 'key') {
      const kd = KEYSTONES[e.key];
      const out = Math.atan2(e.y, e.x);
      add(`key_${e.key}`, { x: e.x + Math.cos(out) * 30, y: e.y + Math.sin(out) * 30, type: 'key', key: e.key, name: kd.name, mods: kd.mods });
      const th = pickTheme(e);
      mkSmall(`${pfx}a`, e.x - Math.cos(out) * 60, e.y - Math.sin(out) * 60, th, k);
      link(`${pfx}a`, `key_${e.key}`);
      e.ports.push(`${pfx}a`);
      continue;
    }
    if (e.kind === 'jewel') {
      add(`jewel_${e.id}`, { x: e.x, y: e.y, type: 'jewel', name: 'Juwelsockel', mods: [] });
      const th = pickTheme(e);
      for (let i = 0; i < 3; i++) {
        const a = toC + (i * Math.PI * 2) / 3;
        mkSmall(`${pfx}s${i}`, e.x + Math.cos(a) * 62, e.y + Math.sin(a) * 62, th, k);
        link(`${pfx}s${i}`, `jewel_${e.id}`);
        e.ports.push(`${pfx}s${i}`);
      }
      continue;
    }
    if (e.kind === 'portal') {
      add(`portal_${e.id}`, { x: e.x, y: e.y, type: 'portal', name: 'Sternentor', pair: `portal_${e.pair}`, mods: [flat('res_elem', 4), inc('move', 4)] });
      const th = pickTheme(e);
      mkSmall(`${pfx}s`, e.x + Math.cos(toC) * 62, e.y + Math.sin(toC) * 62, th, k);
      link(`${pfx}s`, `portal_${e.id}`);
      e.ports.push(`${pfx}s`);
      continue;
    }
    if (e.kind === 'const') {
      const th = pickTheme(e);
      const pts = e.shape.pts.map(([px, py]) => {
        const c = Math.cos(e.rot), s = Math.sin(e.rot);
        return { x: e.x + (px * c - py * s) * 190, y: e.y + (px * s + py * c) * 190 };
      });
      const ids = pts.map((p, i) => {
        const id = `${pfx}_${i}`;
        const last = i === pts.length - 1;
        if (last) add(id, { ...p, type: 'legend', name: e.legend[0], mods: e.legend[1], theme: th, constName: e.shape.name });
        else add(id, { ...p, type: 'const', name: e.shape.name, mods: scale(THEMES[th].small, k * 2), theme: th, constName: e.shape.name });
        return id;
      });
      const pairs = e.shape.extra.length ? e.shape.extra : ids.slice(1).map((_, i) => [i, i + 1]);
      for (const [a, b] of pairs) link(ids[a], ids[b], 'const');
      // Sicherstellen, dass das Sternbild zusammenhängt
      for (;;) {
        const seen = new Set([ids[0]]), st = [ids[0]];
        while (st.length) for (const nb of nodes.get(st.pop()).adj) if (ids.includes(nb) && !seen.has(nb)) { seen.add(nb); st.push(nb); }
        const rest = ids.filter((x) => !seen.has(x));
        if (!rest.length) break;
        let best = null, bd = Infinity;
        for (const a of seen) for (const b of rest) { const A = nodes.get(a), B = nodes.get(b); const d = Math.hypot(A.x - B.x, A.y - B.y); if (d < bd) { bd = d; best = [a, b]; } }
        link(best[0], best[1], 'const');
      }
      e.ports.push(...ids.slice(0, -1));
      continue;
    }
    // ---- normale Cluster
    const theme = pickTheme(e);
    const second = rng.next() < 0.4 ? pickTheme(e) : null;
    const shape = rng.pick(SHAPES_BY_ZONE[e.zone]);
    const st = (id, x, y, i) => mkSmall(id, x, y, second && i % 2 ? second : theme, k);
    if (shape === 'ring4' || shape === 'tri' || shape === 'wheel') {
      const n = shape === 'tri' ? 3 : shape === 'ring4' ? 4 : 6;
      const rr = shape === 'wheel' ? 78 : 58;
      const centerType = shape === 'wheel' ? 'mastery' : 'notable';
      for (let i = 0; i < n; i++) {
        const a = toC + Math.PI / n + (i * Math.PI * 2) / n;
        st(`${pfx}s${i}`, e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr, i);
        e.ports.push(`${pfx}s${i}`);
      }
      for (let i = 0; i < n; i++) link(`${pfx}s${i}`, `${pfx}s${(i + 1) % n}`);
      if (centerType === 'mastery') {
        mkMastery(`${pfx}m`, e.x, e.y, theme, k);
        // zwei Notables außen am Rad
        for (const j of [Math.floor(n / 2) - 1, Math.floor(n / 2)]) {
          const a = toC + Math.PI / n + (j * Math.PI * 2) / n;
          mkNotable(`${pfx}n${j}`, e.x + Math.cos(a) * (rr + 62), e.y + Math.sin(a) * (rr + 62), theme, k, second);
          link(`${pfx}n${j}`, `${pfx}s${j}`);
        }
        link(`${pfx}m`, `${pfx}s0`); link(`${pfx}m`, `${pfx}s${n / 2}`);
      } else {
        mkNotable(`${pfx}n`, e.x, e.y, theme, k, second);
        link(`${pfx}n`, `${pfx}s${Math.floor(n / 2)}`);
        if (n === 4) link(`${pfx}n`, `${pfx}s1`);
      }
    } else if (shape === 'star' || shape === 'myth') {
      const n = shape === 'myth' ? 3 : 5;
      if (shape === 'myth') {
        const [nm, mm] = MYTHS[e.id % MYTHS.length];
        add(`${pfx}n`, { x: e.x, y: e.y, type: 'myth', name: nm, mods: mm, theme });
      } else mkNotable(`${pfx}n`, e.x, e.y, theme, k, second);
      for (let i = 0; i < n; i++) {
        const a = toC + (i * Math.PI * 2) / n;
        const len = shape === 'myth' ? 2 : 1;
        let prev = `${pfx}n`;
        for (let j = 1; j <= len; j++) {
          const id = `${pfx}s${i}_${j}`;
          st(id, e.x + Math.cos(a) * 62 * j, e.y + Math.sin(a) * 62 * j, i);
          link(prev, id); prev = id;
        }
        e.ports.push(prev);
      }
    } else if (shape === 'line' || shape === 'pair') {
      const n = shape === 'pair' ? 2 : 4;
      const a = toC + Math.PI / 2 + rng.range(-0.5, 0.5);
      const ids = [];
      for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * 64;
        const id = `${pfx}s${i}`;
        st(id, e.x + Math.cos(a) * o, e.y + Math.sin(a) * o, i);
        if (ids.length) link(ids[ids.length - 1], id);
        ids.push(id);
      }
      const na = a + Math.PI / 2;
      mkNotable(`${pfx}n`, e.x + Math.cos(na) * 70, e.y + Math.sin(na) * 70, theme, k, second);
      link(`${pfx}n`, ids[Math.floor(n / 2)]);
      e.ports.push(ids[0], ids[n - 1]);
    } else if (shape === 'double') {
      const a = toC + Math.PI / 2;
      for (const s of [-1, 1]) {
        const cx = e.x + Math.cos(a) * 62 * s, cy = e.y + Math.sin(a) * 62 * s;
        mkNotable(`${pfx}n${s > 0 ? 1 : 0}`, cx + Math.cos(toC + Math.PI) * 58, cy + Math.sin(toC + Math.PI) * 58, s > 0 && second ? second : theme, k, null);
      }
      const ring = [];
      for (let i = 0; i < 4; i++) {
        const b = toC + (i * Math.PI) / 2;
        const id = `${pfx}s${i}`;
        st(id, e.x + Math.cos(b) * 50, e.y + Math.sin(b) * 50, i);
        ring.push(id);
        e.ports.push(id);
      }
      for (let i = 0; i < 4; i++) link(ring[i], ring[(i + 1) % 4]);
      link(`${pfx}n0`, ring[3]); link(`${pfx}n1`, ring[1]);
    } else if (shape === 'cross') {
      mkMastery(`${pfx}m`, e.x, e.y, theme, k);
      for (let i = 0; i < 4; i++) {
        const a = toC + Math.PI / 4 + (i * Math.PI) / 2;
        const id1 = `${pfx}s${i}`, id2 = `${pfx}t${i}`;
        st(id1, e.x + Math.cos(a) * 58, e.y + Math.sin(a) * 58, i);
        link(`${pfx}m`, id1);
        if (i % 2) { mkNotable(id2, e.x + Math.cos(a) * 116, e.y + Math.sin(a) * 116, theme, k, second); link(id1, id2); }
        else { st(id2, e.x + Math.cos(a) * 116, e.y + Math.sin(a) * 116, i); link(id1, id2); e.ports.push(id2); }
      }
    }
  }

  // ---------------- Netz zwischen den Entitäten
  const segX = (a, b, c, d) => {
    const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
    if (a === c || a === d || b === c || b === d) return false;
    if (Math.max(a.x, b.x) < Math.min(c.x, d.x) || Math.max(c.x, d.x) < Math.min(a.x, b.x) || Math.max(a.y, b.y) < Math.min(c.y, d.y) || Math.max(c.y, d.y) < Math.min(a.y, b.y)) return false;
    return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
  };
  const cand = [];
  for (let i = 0; i < ents.length; i++) {
    const a = ents[i];
    const gx = Math.floor(a.x / G), gy = Math.floor(a.y / G);
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
      for (const b of grid.get(`${gx + dx},${gy + dy}`) || []) {
        if (b.idx <= i) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 700) cand.push([d, a, b]);
      }
    }
  }
  cand.sort((p, q) => p[0] - q[0]);
  const parent = new Map(ents.map((e) => [e, e]));
  const find = (e) => { while (parent.get(e) !== e) { parent.set(e, parent.get(parent.get(e))); e = parent.get(e); } return e; };
  const deg = new Map(ents.map((e) => [e, 0]));
  const chosen = [];
  const crosses = (a, b) => chosen.some(([c, d]) => segX(a, b, c, d));
  const accept = (a, b) => { chosen.push([a, b]); deg.set(a, deg.get(a) + 1); deg.set(b, deg.get(b) + 1); parent.set(find(a), find(b)); };
  // 1) Spannbaum ohne Kreuzungen
  for (const [, a, b] of cand) {
    if (find(a) === find(b) || deg.get(a) >= a.maxLinks || deg.get(b) >= b.maxLinks) continue;
    if (crosses(a, b)) continue;
    accept(a, b);
  }
  // 2) Zusätzliche Wege für mehr Routen
  for (const [d, a, b] of cand) {
    if (d > 520 || deg.get(a) >= Math.min(3, a.maxLinks) || deg.get(b) >= Math.min(3, b.maxLinks)) continue;
    if (chosen.some(([c, e]) => (c === a && e === b) || (c === b && e === a))) continue;
    if (crosses(a, b)) continue;
    accept(a, b);
  }
  // 3) Restliche Inseln anbinden (notfalls mit Kreuzung, beliebige Entfernung)
  for (const [, a, b] of cand) if (find(a) !== find(b)) accept(a, b);
  for (;;) {
    const root = find(ents[0]);
    const iso = ents.filter((e) => find(e) !== root);
    if (!iso.length) break;
    let best = null, bd = Infinity;
    for (const a of iso) for (const b of ents) { if (find(b) !== root) continue; const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < bd) { bd = d; best = [a, b]; } }
    accept(best[0], best[1]);
  }
  // Wege bauen
  const nearestPort = (e, x, y) => {
    let best = null, bd = Infinity;
    for (const id of e.ports) { const n = nodes.get(id); const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = id; } }
    return best;
  };
  chosen.forEach(([a, b], i) => {
    const pa = nearestPort(a, b.x, b.y), pb = nearestPort(b, a.x, a.y);
    path(pa, pb, `w${i}`);
  });
  // Ursprünge an die nächsten inneren Cluster anbinden
  CLASS_ORDER.forEach((cls) => {
    const s = nodes.get(starts[cls]);
    const near = ents.filter((e) => e.kind === 'cluster').map((e) => [Math.hypot(e.x - s.x, e.y - s.y), e]).sort((p, q) => p[0] - q[0]).slice(0, 3);
    near.forEach(([, e], i) => path(starts[cls], nearestPort(e, s.x, s.y), `p_${cls}_${i}`));
  });
  // Sternentore verbinden
  for (const n of nodes.values()) if (n.type === 'portal' && n.id < n.pair) link(n.id, n.pair, 'portal');

  const regions = CLASS_ORDER.map((cls, k) => ({ cls, name: SECTORS[cls].name, ang: -90 + SEC * k }));
  cached = { nodes, edges, starts, regions, radius: R_MAX + 200 };
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

/** Alle Modifikatoren der zugewiesenen Sterne (Meisterschaften mit gewählter Option). */
export function treeMods(tree, alloc, choices = {}) {
  const out = [];
  for (const id of alloc) {
    const n = tree.nodes.get(id);
    if (!n) continue;
    out.push(...n.mods);
    if (n.type === 'mastery') out.push(...n.options[choices[id] || 0].mods);
  }
  return out;
}

