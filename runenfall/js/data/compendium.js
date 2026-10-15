// Kompendium: Erklärungen zu allen Mechaniken und Systemen. Text mit **fett**; `list` verweist auf
// eine Liste, die die Oberfläche aus den Spieldaten erzeugt (immer aktuell).

export const COMP_CATS = [
  ['start', 'Erste Schritte', '✦'],
  ['fight', 'Kampf & Schaden', '⚔'],
  ['def', 'Verteidigung', '⛨'],
  ['build', 'Dein Build', '⚒'],
  ['meta', 'Fortschritt', '✶'],
  ['world', 'Welt & Systeme', '⚜'],
  ['modes', 'Spielmodi', '♜'],
  ['foes', 'Gegner & Bosse', '☠'],
  ['icons', 'Symbole & Anzeigen', '◎'],
];

export const ARTICLES = [
  // ------------------------------------------------------------- Erste Schritte
  { id: 'loop', cat: 'start', title: 'Der Kreislauf', text: [
    'Runenfall besteht aus **Runs** und **dauerhaftem Fortschritt**. In einem Run kämpfst du dich mit einer Klasse durch eine Karte, sammelst Runen, Glyphen, Segen und Ausrüstung – all das gilt nur für diesen Run.',
    'Am Ende eines Runs – ob Sieg oder Niederlage – bekommst du **Konto-Erfahrung**, **Sternenstaub**, Rohstoffe, Ruf bei den Häusern und manchmal Relikte, Juwelen oder Eier. Damit wirst du dauerhaft stärker: Sternpunkte für die Sternenkarte, Altar-Segen, neue Runen im Kodex und vieles mehr.',
    'Sterben gehört dazu. Jeder Run bringt dich weiter – auch ein kurzer.',
  ], see: ['controls', 'hub', 'account', 'tips'] },
  { id: 'controls', cat: 'start', title: 'Steuerung', text: [
    '**Bewegen:** Daumen irgendwo auf den Bildschirm legen und ziehen. Es gibt keinen festen Joystick – du kannst überall ansetzen.',
    '**Angreifen:** Deine Runen feuern von selbst auf die nächsten Gegner. Deine Aufgabe ist, gut zu stehen, auszuweichen und Kugeln einzusammeln.',
    '**Pause:** Oben rechts. Dort findest du auch deinen Build und die Schadensanalyse des laufenden Kampfes.',
    'Am Handy bringt dich die **Zurück-Taste** eine Ebene zurück; im Kampf pausiert sie das Spiel.',
  ], see: ['hud', 'loop'] },
  { id: 'setup', cat: 'start', title: 'Einen Run vorbereiten', text: [
    '**Klasse:** bestimmt deine Startrune und dein Gebiet in der Sternenkarte. **Modus:** Feldzug, Abgrund, Sternenturm, Boss-Rush oder Sternenjagd – gesperrte Modi zeigen, wie du sie freischaltest.',
    '**Sternenhöhe:** die Schwierigkeit – höher bedeutet stärkere Gegner und mehr Belohnung. **Aufstiegsklasse**, **Gefährte** und **Trank** sind optionale Verstärkungen, sobald du sie besitzt.',
    '**Liga** und **Prophezeiungen** machen den Run schwerer und geben mehr Sternenstaub. **Gaben der Häuser** aus dem Händler gelten automatisch für diesen Run.',
  ], see: ['classes', 'ascension', 'mutators', 'modes_normal'] },
  { id: 'hub', cat: 'start', title: 'Die Sternwarte', text: [
    'Die Sternwarte ist dein Hauptmenü. Von hier startest du Runs und verwaltest alles Dauerhafte.',
    '**Stärke:** Sternenkarte, Altar, Relikte, Kodex – direkte Kraft für jeden Run. **Welt:** Atlas, Zitadelle, Häuser, Gefährten. **Sammlung & Wettstreit:** Schicksalskarten, Erzfeinde, Saison, Sternenturm, Erfolge.',
    'Die **Übersicht** zeigt dir, was du gerade tun kannst (z. B. freie Sternpunkte, abholbare Belohnungen) und wie weit du überall bist. Ein Punkt an einer Kachel bedeutet: Dort wartet etwas.',
  ], see: ['loop', 'tips'] },
  { id: 'tips', cat: 'start', title: 'Tipps für den Anfang', text: [
    '**Verteile Sternpunkte** nach jedem Run – sie sind dein stärkster Fortschritt. Suche in der Sternenkarte nach Begriffen wie „Feuer“ oder „Leben“.',
    '**Sockle Glyphen.** Eine passende Glyphe macht eine Rune oft doppelt so stark. Grün markierte Sockel passen.',
    '**Lege Ausrüstung an.** Neue Gegenstände landen im Beutel und wirken erst, wenn du sie im Build anlegst.',
    '**Eliten lohnen sich**, sind aber gefährlich. Weiche roten Markierungen am Boden immer aus.',
    'Nutze die **Schadensanalyse** im Pausemenü: Sie zeigt, welche Rune wirklich trägt.',
  ], see: ['tree', 'glyphs', 'gear', 'analysis'] },

  // ------------------------------------------------------------- Kampf & Schaden
  { id: 'damage', cat: 'fight', title: 'Die Schadensformel', text: [
    'Jede Rune hat **Grundschaden**, der mit ihrer Stufe steigt (+22% je Stufe). Hinzugefügter Schaden („Fügt X Feuerschaden hinzu“) kommt zum Grundschaden dazu.',
    'Danach wird der Schaden skaliert: **Grundschaden × (1 + Summe aller „erhöht“) × jedes „mehr“ einzeln**.',
    '**„Erhöht“ addiert sich:** +50% und +50% erhöht ergeben +100%, also doppelten Schaden. **„Mehr“ multipliziert sich:** 30% mehr und 30% mehr ergeben 69% mehr. Deshalb sind „mehr“-Boni (Keystones, Glyphen, Segen) so wertvoll, wenn du schon viel „erhöht“ hast.',
    'Ein Bonus gilt nur, wenn er zur Rune passt: „Feuerschaden“ wirkt nur auf Feuer-Anteile, „Zauberschaden“ nur auf Zauber, „Schaden“ auf alles.',
    'Zum Schluss ziehen die **Widerstände** des Gegners Schaden ab – Durchdringung senkt sie.',
  ], see: ['types', 'crit', 'resist', 'statsource'] },
  { id: 'types', cat: 'fight', title: 'Schadensarten & Umwandlung', text: [
    'Es gibt fünf Schadensarten: **Physisch**, **Blitz**, **Kälte**, **Feuer** und **Chaos**. Blitz, Kälte und Feuer zählen zusätzlich als **Elementar**.',
    'Umwandlung verschiebt Schaden in eine Richtung: **Physisch → Blitz → Kälte → Feuer → Chaos**. Umgewandelter Schaden behält alle früheren Arten im Gepäck: Physischer Schaden, der zu Feuer wurde, profitiert von „physischem Schaden“ **und** „Feuerschaden“.',
    'Die Schadensart entscheidet auch über Zustände: Feuer kann entzünden, Kälte unterkühlt und friert ein, Blitz schockt, Physisch und Chaos vergiften, Physisch lässt bluten.',
  ], see: ['damage', 'ailments', 'resist'] },
  { id: 'crit', cat: 'fight', title: 'Kritische Treffer', text: [
    'Jede Rune hat eine **Basis-Krit-Chance** (meist 5–6%). Flache Boni („+2% Basis-Krit-Chance“) kommen dazu, danach wird alles mit **erhöhter kritischer Trefferchance** multipliziert. Höchstens 100%.',
    'Ein kritischer Treffer verursacht **150% Schaden** plus deinen **Krit-Multiplikator**. Große Krits frieren das Bild kurz ein.',
    'Schaden über Zeit (Brand, Gift, Blutung, Flächen) kann nicht kritisch treffen. Der Keystone **Ruhiger Geist** verbietet Krits ganz, gibt aber mehr Schaden; **Henkerspräzision** macht jeden 4. Treffer kritisch.',
  ], see: ['damage', 'keystones'] },
  { id: 'speedarea', cat: 'fight', title: 'Tempo, Fläche & Geschosse', text: [
    '**Fertigkeitstempo** verkürzt die Abklingzeit einer Rune – sie feuert öfter.',
    '**Wirkungsbereich** vergrößert Flächen. Der Radius wächst mit der Wurzel: +100% Bereich ergeben etwa 41% mehr Radius.',
    '**Zusätzliche Projektile** gelten für Geschoss-Runen, Meteore, Zonen und kreisende Klingen. **Durchbohren** lässt Geschosse durch Gegner fliegen, **Kette** lässt Treffer zum nächsten Gegner springen.',
    '**Dauer** verlängert Zonen, Fallen, Begleiter und Auren.',
  ], see: ['runes', 'glyphs'] },
  { id: 'resist', cat: 'fight', title: 'Widerstände & Durchdringung', text: [
    'Gegner können Widerstände gegen Elemente haben – einige Biom-Gegner und Eliten mit „Feuerfest“, „Frostfest“ oder „Geerdet“ haben 75%. Widerstände senken Treffer- **und** Zustandsschaden.',
    '**Durchdringung** zieht direkt Prozentpunkte vom Widerstand des Gegners ab. Gegen widerstandsfähige Gegner hilft auch eine zweite Schadensart.',
  ], see: ['damage', 'elites', 'playerres'] },
  { id: 'ailments', cat: 'fight', title: 'Zustände', text: [
    '**Brand** (Feuer): Ein Treffer mit Entzündungschance setzt den Gegner 4 Sekunden in Brand – pro Sekunde 50% des Feuerschadens. Es zählt nur der stärkste Brand (außer mit **Ewige Glut**: dann stapeln sie).',
    '**Gift** (Physisch und Chaos): 3 Sekunden lang 30% des Schadens pro Sekunde. Gift **stapelt** sich – je öfter du triffst, desto mehr.',
    '**Blutung** (Physisch): 4 Sekunden lang 60% des physischen Schadens pro Sekunde. Es zählt die stärkste Blutung.',
    '**Schock** (Blitz): 3 Sekunden lang erleidet der Gegner mehr Schaden – bis zu 50%, abhängig von deiner Schockwirkung.',
    '**Unterkühlung** (Kälte): Jeder Kältetreffer verlangsamt 2 Sekunden lang (bis zu 50%). **Einfrieren** stoppt Gegner ganz (Bosse nur kurz).',
    '**Dauer von Zuständen** verlängert alle Zustände. Schaden über Zeit wird von Widerständen gesenkt und kann nicht kritisch treffen.',
  ], see: ['types', 'crit'] },
  { id: 'leech', cat: 'fight', title: 'Lebensraub & Heilung im Kampf', text: [
    '**Lebensraub** heilt dich um einen Teil deines Trefferschadens – höchstens 12% deines maximalen Lebens pro Sekunde.',
    '**Leben pro Sieg** heilt bei jedem getöteten Gegner, **Regeneration** dauerhaft pro Sekunde.',
    'Einige Keystones und Gegenstände verändern Heilung grundlegend (z. B. keine Regeneration, dafür mehr Lebensraub).',
  ], see: ['life', 'heal'] },
  { id: 'analysis', cat: 'fight', title: 'Schadensanalyse', text: [
    'Die Schadensanalyse zeigt, **wer wirklich Schaden macht**: Anteil jeder Rune, Schaden pro Sekunde, Treffer, Krit-Quote, Anteil von Schaden über Zeit und Siege.',
    'Dazu die Verteilung auf **Elemente**, wie viel deine **Krits** beitragen, **Brand, Gift und Blutung** einzeln und welcher **erlittene Schaden** von welchen Gegnern kam.',
    'Du findest sie im **Pausemenü** (dieser Kampf), im **Build unter „Analyse“** (ganzer Run oder letzter Kampf) und **am Ende jedes Runs**.',
  ], see: ['damage', 'statsource'] },

  // ------------------------------------------------------------- Verteidigung
  { id: 'life', cat: 'def', title: 'Leben & Regeneration', text: [
    'Dein Leben wächst mit jeder Stufe im Run. Flache Boni („+30 Leben“) und „erhöht“/„mehr“ maximales Leben kommen dazu.',
    'Fällt dein Leben auf 0, ist der Run vorbei – außer du hast eine Wiederbelebung (Altar „Zweites Leben“, bestimmte Unikate und Keystones).',
    'Unter 30% Leben hörst du deinen Herzschlag. Zeit, auszuweichen!',
  ], see: ['heal', 'armor', 'leech'] },
  { id: 'armor', cat: 'def', title: 'Rüstung', text: [
    'Rüstung senkt **physischen Trefferschaden**. Die Minderung ist **Rüstung ÷ (Rüstung + 8 × Treffer)**, höchstens 90%.',
    'Deshalb wirkt Rüstung gegen viele kleine Treffer besonders gut und gegen einzelne riesige Schläge weniger.',
  ], see: ['evasion', 'playerres'] },
  { id: 'evasion', cat: 'def', title: 'Ausweichen', text: [
    'Ausweichwert gibt dir eine Chance, Treffern komplett zu entgehen: **Ausweichwert ÷ (Ausweichwert + 600)**, höchstens 75%.',
    '**Akrobatik** (Ausweichchance) ist eine zweite, eigene Chance bis 60%. Flächen und Schaden über Zeit kann man nicht ausweichen – da hilft nur Laufen.',
  ], see: ['armor', 'barrier'] },
  { id: 'playerres', cat: 'def', title: 'Deine Widerstände', text: [
    'Widerstände gegen **Feuer, Kälte, Blitz und Chaos** senken den Schaden dieser Art. Normal ist bei **75%** Schluss; „maximaler Widerstand“ hebt diese Grenze.',
    '„Alle Elementarwiderstände“ zählt für Feuer, Kälte und Blitz. Chaos muss eigens geschützt werden.',
    'Biome haben Schwerpunkte: Die Glutschmiede brennt, der Sturmgipfel blitzt, das Nebelmoor vergiftet.',
  ], see: ['hazards', 'armor'] },
  { id: 'barrier', cat: 'def', title: 'Barriere', text: [
    'Die Barriere fängt Schaden **vor** deinem Leben ab. Sie lädt sich wieder auf, wenn du 2 Sekunden nicht getroffen wurdest – 25% pro Sekunde, schneller mit „Barriere-Aufladetempo“.',
    'Der Keystone **Sternenseele** setzt dein Leben auf 1, gibt dir dafür eine riesige Barriere.',
  ], see: ['life', 'keystones'] },
  { id: 'heal', cat: 'def', title: 'Heilung zwischen Kämpfen', text: [
    'Nach jedem gewonnenen Kampf heilst du **20%** deines Lebens (mehr mit dem Altar-Segen „Rastplatz“, weniger auf hohen Sternenhöhen). Nach einem Boss wirst du voll geheilt – ab Sternenhöhe 16 nur noch um die Hälfte.',
    'Das **Lager** heilt 60% – oder du meditierst (Rune +1) oder schnitzt eine Glyphe. Die Prophezeiung **Hungersnot** verbietet die Heilung nach Kämpfen.',
  ], see: ['life', 'mapicons'] },

  // ------------------------------------------------------------- Build
  { id: 'runes', cat: 'build', title: 'Runen', text: [
    'Runen sind deine Fertigkeiten. Du trägst **bis zu 4**, jede mit **3 Glyphen-Sockeln**. Runen steigen bis **Stufe 7** auf (Belohnungen, Lager, Ereignisse) – jede Stufe gibt +22% Grundschaden, Stufe 3 und 5 schalten Extras frei.',
    'Jede Rune hat **Tags** (z. B. Zauber, Projektil, Fläche, Feuer). Die Tags entscheiden, welche Boni und Glyphen wirken.',
    'Neue Runen gibt es als Belohnung. Welche erscheinen können, hängt von deinem **Kodex** ab.',
  ], see: ['glyphs', 'evolution', 'traits', 'codex'] },
  { id: 'glyphs', cat: 'build', title: 'Glyphen', text: [
    'Glyphen sind Unterstützungen für Runen – z. B. mehr Projektile, Kettenblitze, Nachbeben oder mehr Schaden gegen Bosse.',
    'Eine Glyphe passt nur zu Runen mit passenden Tags. Im Build tippst du eine Glyphe im Beutel an: **grüne Sockel passen**, rote nicht. Dieselbe Glyphe kann nicht zweimal in einer Rune stecken.',
    'Glyphen findest du als Belohnung, beim Händler, im Lager und in Ereignissen. Neue Glyphen-Arten schaltest du im Kodex frei.',
  ], see: ['runes', 'codex'] },
  { id: 'boons', cat: 'build', title: 'Segen & Pfade', text: [
    'Bei jedem Stufenaufstieg wählst du einen **Segen** – er gilt bis zum Ende des Runs. Die meisten Segen gehören zu einem von zehn **Pfaden** (Glut, Frost, Sturm, Seuche, Klinge, Geschosse, Erschütterung, Legion, Präzision, Bollwerk).',
    'Jeder Pfad hat **vier Stufen**. Stufe I ist ein kräftiger Grundbonus, **ab Stufe II verändert der Pfad, wie dein Build funktioniert** – Brände stapeln sich, Geschosse teilen sich, Begleiter markieren Gegner. Höhere Stufen gibt es erst ab Run-Stufe 4, 9 und 15.',
    'Du kannst **höchstens drei Pfade** pro Run beschreiten. Begonnene Pfade werden bevorzugt angeboten – wer sich festlegt, wird belohnt. Pfade, die zu deinen Runen passen, erscheinen häufiger.',
    'Sind zwei deiner Pfade auf Stufe II, kann ein **Bund-Segen** erscheinen: eine besondere Wirkung genau dieser Kombination (z. B. Glut + Geschosse = Brandpfeile).',
    '**Vertiefungen** verstärken einen begonnenen Pfad beliebig oft, **Grundsegen** geben allgemeine Werte. Bei beiden zeigt die Farbe die Seltenheit: Gewöhnlich (×1), Selten (×1,8), Episch (×3).',
    '**Neu würfeln** zeigt andere Segen, **Verbannen** entfernt einen Segen für den Rest des Runs – verbannst du die erste Stufe eines Pfads, erscheint dieser Pfad nicht mehr.',
  ], list: 'paths', see: ['effects', 'runes'] },
  { id: 'evolution', cat: 'build', title: 'Runen-Evolution', text: [
    'Erreicht eine Rune **Stufe 7**, kann sie sich weiterentwickeln. Du wählst **eine von zwei Formen** – jede verändert Aussehen und Regeln der Rune (z. B. Feuerball wird zum Kometen oder zur Splitterbombe).',
    'Die Wahl gilt für diesen Run. Alle entdeckten Formen sammelt der Kodex.',
  ], see: ['runes', 'codex'] },
  { id: 'traits', cat: 'build', title: 'Runenmerkmale & Archiv', text: [
    'Runen können mit **Merkmalen** erscheinen, z. B. *Glühender Zwillings-Feuerball*. Jedes Merkmal gibt einen Bonus, der zur Rune passt.',
    'In der Schmiede kannst du Merkmale per **Runenschliff** neu würfeln. Jede Kombination wird im **Runen-Archiv** (Kodex) gesammelt.',
  ], see: ['runes', 'crafting'] },
  { id: 'gear', cat: 'build', title: 'Ausrüstung', text: [
    'Es gibt 8 Plätze: Waffe, Rüstung, Helm, Handschuhe, Stiefel, Gürtel, Amulett, Ring. Neue Gegenstände landen im **Beutel** (max. 24) und wirken erst, wenn du sie anlegst.',
    'Der Vergleich beim Anlegen zeigt grün, was besser wird, und rot, was du verlierst. Unbrauchbares verkaufst du beim Händler.',
  ], see: ['rarity', 'crafting', 'uniques'] },
  { id: 'rarity', cat: 'build', title: 'Seltenheit & Affixe', text: [
    'Gegenstände haben eine **Seltenheit**: Normal (keine Affixe), Magisch (1–2), Selten (3–5), dazu Einzigartig, Set und Mythisch.',
    'Jeder Gegenstand hat höchstens **3 Präfixe und 3 Suffixe**. Die Zahl **S1–S8** neben einem Affix ist seine **Stufe** – je höher, desto stärker. Welche Stufen möglich sind, hängt von der **Gegenstandsstufe** ab, die mit dem Fortschritt im Run steigt.',
    '**Seltenheit gefundener Gegenstände** (Glück) macht seltene, einzigartige und mythische Funde wahrscheinlicher.',
  ], list: 'rarities', see: ['gear', 'crafting', 'uniques'] },
  { id: 'crafting', cat: 'build', title: 'Die Schmiede', text: [
    'In der Schmiede veränderst du Gegenstände gegen Gold:',
    '**Neu würfeln** – alle Affixe neu. **Affix hinzufügen** – solange Platz ist. **Verstärken** – ein Affix eine Stufe höher. **Sperren & würfeln** – ein gewähltes Affix bleibt, der Rest wird neu gewürfelt.',
    '**Verschmelzen** – zwei Gegenstände desselben Platzes werden zu einem mit den besten Eigenschaften. **Korrumpieren** – riskant: Es kann ein mächtiger Zusatz entstehen, nichts passieren oder der Gegenstand zerfallen; danach ist er nicht mehr veränderbar.',
    '**Unikat aufwerten** – einzigartige Gegenstände bis ★3 verstärken. Dazu kommen Runenschliff und – mit der Meisterschmiede der Zitadelle – mythisches Umschmieden.',
  ], see: ['rarity', 'uniques', 'traits'] },
  { id: 'uniques', cat: 'build', title: 'Unikate, Sets & Mythisches', text: [
    '**Einzigartige Gegenstände** haben feste, oft regelbrechende Effekte (z. B. alles wird Feuer, Zauber werden doppelt gewirkt). Gefundene Unikate sammelt der Kodex.',
    '**Set-Teile** geben einzeln Boni und mit 2 bzw. 4 Teilen desselben Sets starke Zusatzboni.',
    '**Mythische Gegenstände** haben die maximale Zahl an Affixen und dazu 1–2 besondere Effekte. Du bekommst sie von Erzfeinden, aus der Saison und von den Häusern.',
  ], see: ['rarity', 'nemesis'] },
  { id: 'relics', cat: 'build', title: 'Relikte', text: [
    'Relikte sind **dauerhafte Ausrüstung** für alle Runs. Du findest sie bei Bossen, Eliten und für Aufträge. Angelegte Relikte wirken in jedem Run.',
    'Du hast 3 Plätze, mehr über den Altar. Unbrauchbare Relikte kannst du zerlegen und andere mit Sternenstaub bis Stufe 10 veredeln.',
  ], see: ['jewels', 'altar'] },
  { id: 'jewels', cat: 'build', title: 'Juwelen', text: [
    'Juwelen werden in die **Juwelsockel der Sternenkarte** eingesetzt und wirken dann dauerhaft für diese Klasse. Du findest sie bei Bossen, in Ereignissen und bei den Häusern.',
  ], see: ['tree', 'relics'] },
  { id: 'statsource', cat: 'build', title: 'Woher kommen meine Werte?', text: [
    'Im Build unter **„Werte“** kannst du jeden Wert antippen. Du siehst dann, was er bedeutet und **woher er kommt**: Sternenkarte, Altar, Relikte, Ausrüstung, Segen & Run-Effekte, Aufstiegsklasse, Gefährte, Schicksalskarten & Trank sowie Juwelen, Sternenmacht & Häuser.',
    'Tippst du dort eine **Rune** an, siehst du alles, was genau diese Rune verstärkt – Schaden, hinzugefügten Schaden, Krit, Tempo und Wirkungsbereich –, getrennt nach Quelle und zusammengerechnet. Glyphen, Merkmale und Stufenboni der Rune stehen in einer eigenen Zeile.',
    '**„erhöht“** wird innerhalb eines Wertes addiert, **„mehr“** und **„weniger“** werden miteinander multipliziert – deshalb stehen beide in der Zeile „Zusammen“ getrennt.',
  ], see: ['damage', 'effects', 'analysis'] },
  { id: 'effects', cat: 'build', title: 'Aktive Effekte im Run', text: [
    'Im Build unter **„Effekte“** siehst du alles, was gerade in deinem Run wirkt: Segen, Belohnungen aus Ereignissen, Schreine, Tränke, Schicksalskarten, Gaben der Häuser, Prophezeiungen, Liga-, Regions- und Turmregeln, Set-Boni und die Ehren deiner Häuser.',
  ], see: ['boons', 'cards', 'mutators'] },

  // ------------------------------------------------------------- Fortschritt
  { id: 'account', cat: 'meta', title: 'Kontostufe & Sternpunkte', text: [
    'Jeder Run gibt **Konto-Erfahrung** – für besiegte Gegner, besuchte Orte, Eliten, Bosse und Siege. Höhere Sternenhöhen geben mehr.',
    'Mit jeder Kontostufe bekommst du einen **Sternpunkt**, alle 4 Stufen einen zusätzlichen. Dazu kommen 6 Startpunkte und Punkte aus Erfolgen. Ab Kontostufe 20 gibt es **Sternenmacht** (unendliche Zusatzstufen).',
  ], see: ['tree', 'achievements'] },
  { id: 'tree', cat: 'meta', title: 'Die Sternenkarte', text: [
    'Die Sternenkarte ist dein Talentbaum mit rund 1.700 Sternen. Jede Klasse hat ein eigenes Startgebiet, die Punkte gelten für alle Runs dieser Klasse. Die Karte **formt** deinen Build – getragen wird er von deinen Entscheidungen im Run.',
    'In jedem Klassengebiet liegen **Keystones in Reichweite** (rund 15–25 Punkte vom Ursprung), weitere am äußeren Ring. Viele **Notables** wirken unter **Bedingungen**: gegen brennende, unterkühlte oder vergiftete Gegner, während du dich bewegst, bei vollem Leben oder kurz nach einer Tötung.',
    '**Kleine Sterne** geben kleine Boni, **Notables** (größer, mit Namen) starke Kombinationen, **Meisterschaften** lassen dich 1 von 3 Boni wählen, **Keystones** verändern Regeln. **Sternbilder** belohnen mit einem Krönungsstern, **Sternentore** verbinden weit entfernte Bereiche, **Juwelsockel** nehmen Juwelen auf.',
    'Umverteilen ist **kostenlos** (außerhalb eines Runs). Mit ⎘ speicherst du bis zu 4 Builds pro Klasse. Mit ⌕ suchst du Begriffe, ◎ zeigt die ganze Karte, Σ fasst alle Boni zusammen.',
  ], list: 'keystones', see: ['keystones', 'jewels', 'account'] },
  { id: 'keystones', cat: 'meta', title: 'Keystones', text: [
    'Keystones sind die großen Sterne der Sternenkarte. Jeder verändert eine Grundregel – oft mit einem Preis. Sie lohnen sich, wenn dein Build darauf ausgelegt ist.',
  ], list: 'keystones', see: ['tree', 'crit', 'barrier'] },
  { id: 'altar', cat: 'meta', title: 'Der Altar', text: [
    'Am Altar kaufst du mit Sternenstaub **dauerhafte Segen**: mehr Schaden und Leben, Startgold und -ausrüstung, mehr Auswahl bei Belohnungen, Neu würfeln, Verbannen, Wiederbelebung, Rabatte, Relikt-Plätze und mehr. Jede Stufe kostet mehr als die vorige.',
  ], list: 'altar', see: ['account', 'relics'] },
  { id: 'codex', cat: 'meta', title: 'Der Kodex', text: [
    'Der Kodex sammelt alles, was du kennst: **Runen, Glyphen, Aufstiegsklassen, Unikate, Sets, das Runen-Archiv und das Bestiarium**.',
    'Neue Runen und Glyphen schaltest du hier mit Sternenstaub frei – sie können danach in Runs erscheinen. Je größer dein Kodex, desto mehr Build-Möglichkeiten.',
  ], see: ['runes', 'glyphs', 'classes'] },
  { id: 'classes', cat: 'meta', title: 'Klassen & Aufstiegsklassen', text: [
    'Es gibt 9 Klassen mit eigener Startrune und eigenem Bereich in der Sternenkarte. Drei sind von Anfang an da, die übrigen schaltest du mit Sternenstaub frei.',
    'Nach dem ersten Bosssieg kannst du im Kodex **Aufstiegsklassen** freischalten – zwei pro Klasse mit je 5 Stufen. Vor dem Run wählst du eine aus.',
  ], list: 'classes', see: ['codex', 'tree'] },
  { id: 'ascension', cat: 'meta', title: 'Sternenhöhe', text: [
    'Jede Klasse hat ihre **eigene Leiter**: Ein Feldzugssieg mit dieser Klasse schaltet ihre nächste **Sternenhöhe** frei. Pro Höhe haben Gegner **12% mehr Leben** und **7% mehr Schaden** (wächst aufeinander auf), dafür gibt es **25% mehr Sternenstaub** und mehr Konto-Erfahrung.',
    'Bis **Höhe 20** bringt jede Höhe eine **neue Regel** – mehr Eliten, schnellere Geschosse, teurere Händler, regenerierende Gegner, eine Segen-Wahl weniger, rasende Bosse. Danach wird es endlos stärker.',
    'Für die Höhen **5, 10, 15 und 20** jeder Klasse gibt es Erfolge mit Sternpunkten. Das Spiel merkt sich die zuletzt gewählte Höhe.',
  ], list: 'ascMods', see: ['classes', 'deeds', 'mutators'] },
  { id: 'fusion', cat: 'build', title: 'Runen verschmelzen & Echos', text: [
    'Im Build kannst du mit **⟁ Verschmelzen** eine Rune in eine andere übergehen lassen (kostet Gold). Die verschmolzene Rune wird zum **Echo**: Trifft die Hauptrune, löst das Echo **am Trefferort** aus – ein Feuerball-Treffer zündet eine Frostnova, ein Pfeil ruft einen Meteor, eine Kette entlädt sich aus einer Giftwolke.',
    'Echos behalten Stufe, Glyphen, Merkmale und Evolution. Jede Rune trägt bis zu **2 Echos**, und Echos können **selbst Echos tragen** – Feuerball → Frostnova → Kettenblitz. Wie tief du verschachteln darfst, schalten **Taten** frei (Ebene 2 und 3), die Waffenkunst *Tiefe Resonanz* gibt eine weitere Ebene.',
    'Wirkung je Ebene: 65%, 50%, 38%, 30%. Jedes Echo hat eine kurze **Abklingzeit** – schnelle Runen hallen öfter nach. Verschmelzen gibt einen **Runenplatz frei**: Du kannst danach eine weitere Rune aufnehmen.',
    'Sind alle Plätze voll und dir wird eine neue Rune angeboten, kannst du sie **direkt als Echo verschmelzen** statt eine Rune zu ersetzen.',
  ], see: ['weaponarts', 'runes', 'deeds'] },
  { id: 'weaponarts', cat: 'build', title: 'Waffenkünste & Hybridwaffen', text: [
    'Jede Waffenart hat eine **Waffenkunst**, die deine Echos verändert: *Echo-Fokus* (Zauberstab, Echos öfter), *Splitterschuss* (Bogen, Geschoss-Echos +1 Geschoss), *Wucht* (Streitaxt, größere Flächen-Echos), *Blutecho* (Ritualdolch, Echos auch beim Töten), *Ahnenruf* (Totemstab, Echo-Schaden), *Tiefe Resonanz* (Runenszepter, eine Echo-Ebene mehr).',
    'Verschmilzt du in der Schmiede zwei **Waffen verschiedener Art**, vereint die Waffe ihre Künste – eine **Hybridwaffe** mit bis zu **3 Künsten**. Auch Hybride lassen sich weiter verschmelzen.',
  ], see: ['fusion', 'crafting'] },
  { id: 'deeds', cat: 'meta', title: 'Taten', text: [
    'Manches schaltest du nicht mit Sternenstaub frei, sondern durch **Taten**: die **Meisterstücke** der Pfade (Stufe IV), die **Bund-Segen** und tiefere **Echo-Ebenen**.',
    'Einen Bund-Segen entdeckst du, indem du einen Boss mit beiden Pfaden auf Stufe II besiegst – ab dann kann er erscheinen, oft schon im selben Run. Alle Taten findest du unter **Erfolge**.',
  ], list: 'deeds', see: ['boons', 'fusion', 'ascension'] },
  { id: 'achievements', cat: 'meta', title: 'Erfolge', text: [
    'Über 150 Erfolge belohnen Meilensteine mit **Sternpunkten** und Sternenstaub. Die Erfolgs-Kachel zeigt, welche dir noch fehlen.',
  ], see: ['account'] },
  { id: 'pets', cat: 'meta', title: 'Gefährten', text: [
    'Gefährten schlüpfen aus **Eiern** (von Bossen, Ereignissen, der Zitadelle, der Saison und den Häusern). Jeder hat einen eigenen Angriff und einen passiven Bonus und steigt mit doppelten Funden bis Stufe 10.',
    'Vor dem Run wählst du einen Gefährten aus.',
  ], see: ['base'] },

  // ------------------------------------------------------------- Welt & Systeme
  { id: 'atlas', cat: 'world', title: 'Der Sternenatlas', text: [
    'Nach dem ersten Sieg öffnet sich der Atlas: 30 Regionen in 16 Stufen. Die gewählte Region wird zum **Akt IV** deines nächsten Feldzugs.',
    'Bezwungene Regionen geben **Atlaspunkte** für dauerhafte Atlas-Kenntnisse. In manchen Regionen warten Sternenbestien, ganz oben drei Endgegner mit Phasen.',
  ], see: ['beasts', 'modes_normal'] },
  { id: 'base', cat: 'world', title: 'Zitadelle & Alchemie', text: [
    'Die Zitadelle hat 8 Gebäude, die du mit **Rohstoffen** (Erz, Kristall, Essenz aus deinen Runs) ausbaust. Sie produzieren auch, wenn du nicht spielst – schau vorbei und sammle ein.',
    'In der **Alchemie** braust du Tränke. Einen Trank wählst du vor dem Run; er wirkt den ganzen Run.',
  ], see: ['cards', 'pets'] },
  { id: 'cards', cat: 'world', title: 'Schicksalskarten', text: [
    'Zu Beginn jedes Runs und nach jedem Akt ziehst du **2 Karten aus deinem Deck**. Ihre Boni gelten den ganzen Run.',
    'Karten gibt es in Packs (von Bossen, Bestien, der Saison, den Häusern oder gegen Kristalle). Doppelte Karten steigen bis ★5. Das Deck stellst du aus deiner Sammlung zusammen; mehr Plätze gibt das Observatorium.',
  ], see: ['base', 'effects'] },
  { id: 'nemesis', cat: 'world', title: 'Erzfeinde', text: [
    'Wer dich tötet, vergisst dich nicht: Der Gegner bekommt einen **Namen**, steigt im Rang und erhält Merkmale. In späteren Runs taucht er wieder auf – stärker als zuvor.',
    'Besiegst du einen Erzfeind, bekommst du **mythische Beute**. Die Erzfeind-Kachel zeigt alle, die auf dich lauern.',
  ], see: ['uniques'] },
  { id: 'season', cat: 'world', title: 'Saison, Ligen & Aufträge', text: [
    'Jeder Run bringt **Saison-Erfahrung**. Jeden Monat gibt es 40 Stufen mit Belohnungen (Staub, Rohstoffe, Packs, Eier, mythische Gegenstände).',
    'Die wöchentliche **Liga** hat eigene Regeln und gibt mehr Staub. **Aufträge** (3 gleichzeitig) belohnen Ziele in einem Run; einen kannst du täglich austauschen. Die **Tägliche Herausforderung** verdoppelt beim ersten Versuch des Tages den Staub.',
  ], see: ['factions', 'modes_normal'] },
  { id: 'factions', cat: 'world', title: 'Die Häuser', text: [
    'Drei Häuser buhlen um deine Runen: der **Orden der Glut**, der **Zirkel der Sternseher** und die **Leerenwandler**.',
    '**Ruf** bekommst du für Aufträge der Häuser, für Entscheidungen bei ihren **Begegnungen** im Run und für Taten, die ein Haus schätzt (Glut: Eliten und Bosse; Seher: Runen, Glyphen, Evolutionen; Leere: Prophezeiungen, Erzfeinde, Abgrund). Manche Entscheidungen verärgern ein anderes Haus.',
    'Jede der 5 Ruf-Stufen gibt einen **dauerhaften Bonus**. Jeder Ruf-Zuwachs bringt dieselbe Menge **Gunst** (◈), mit der du beim Händler des Hauses Gaben für den nächsten Run oder Sofort-Belohnungen kaufst.',
  ], list: 'factions', see: ['story', 'season'] },
  { id: 'story', cat: 'world', title: 'Die Sage', text: [
    'Die Geschichte von Runenfall erzählt sich in **20 Kapiteln**, die du mit Meilensteinen freischaltest – Bosse, Siege, Abgrund, Turm, Jagd und der Ruf bei den Häusern. Neue Kapitel kündigt die Sternwarte an.',
  ], see: ['factions'] },
  { id: 'backup', cat: 'world', title: 'Sicherung ohne Cloud', text: [
    'Dein Fortschritt liegt nur auf diesem Gerät. In den Einstellungen kannst du ihn sichern:',
    '**Sicherungsdatei speichern** – über das Teilen-Menü z. B. in Google Drive, per Mail oder Messenger. **Sicherungsdatei laden** – stellt sie wieder her.',
    '**Per QR-Code senden/empfangen** – das alte Handy zeigt eine Folge von QR-Codes, das neue scannt sie mit der Kamera. **Text-Code** – zum Kopieren in eine Notiz.',
    'Einmal täglich wird automatisch ein **Wiederherstellungspunkt** angelegt (die letzten drei bleiben).',
  ] },

  // ------------------------------------------------------------- Modi
  { id: 'modes_normal', cat: 'modes', title: 'Feldzug', text: [
    'Drei Akte mit je 8 Orten. Jeder Akt spielt in einem von drei Biomen und endet mit dessen Boss. Gegner werden mit jedem Ort (+14%) und jedem Akt stärker.',
    'Ein Sieg schaltet die nächste **Sternenhöhe** frei. Mit einem Atlas-Ziel folgt ein **Akt IV**.',
  ], see: ['mapicons', 'ascension', 'atlas'] },
  { id: 'modes_abyss', cat: 'modes', title: 'Abgrund', text: [
    'Endlos in die Tiefe – freigeschaltet nach dem ersten Feldzugssieg. Auf jeder Ebene wählst du einen von mehreren Wegen. Die Gegner werden pro Ebene 24% stärker.',
    'Jede 5. Ebene wartet ein Boss, ab Ebene 25 Sternenbestien. Je tiefer, desto mehr Staub und Konto-Erfahrung.',
  ], see: ['beasts'] },
  { id: 'modes_tower', cat: 'modes', title: 'Sternenturm', text: [
    'Jede Woche ein neuer Turm – für alle gleich. Jede Etage ist ein Kampf mit eigenem **Gesetz** (z. B. Titanen, Hast, Sternenregen). Alle 5 Etagen ein Boss, nach jeder dritten Etage ein Rastplatz. Prophezeiungen gelten hier nicht.',
    'Deine höchste Etage zählt für die **Wochen-Bestenliste** gegen 15 Rivalen, die im Laufe der Woche weiterklettern. Nach Wochenende holst du deine Belohnung nach Platz ab. Etage 10, 20, 30 … geben einmal pro Woche eine **Turmtruhe**.',
  ], list: 'towerLaws', see: ['mutators'] },
  { id: 'modes_rush', cat: 'modes', title: 'Boss-Rush', text: [
    'Alle 9 Bosse und ein Endgegner hintereinander – freigeschaltet, sobald du 3 verschiedene Bosse besiegt hast.',
    'Du startest auf Stufe 8 mit einer zweiten Rune, zwei Glyphen und Grundausrüstung. Nach jedem Boss wirst du voll geheilt und steigst zwei Stufen auf; nach jedem dritten Boss gibt es einen Rastplatz. Gewertet wird die **reine Kampfzeit**.',
  ], see: ['bosses'] },
  { id: 'modes_hunt', cat: 'modes', title: 'Sternenjagd', text: [
    'Eine verhüllte Karte, die du selbst erkundest. Jeder Zug kostet einen **Schritt** (👣). Je weiter du dich vom Lager entfernst, desto stärker die Gegner – und desto besser die Beute.',
    '**Spuren** zeigen zum Hort der Bestie und decken Felder in ihre Richtung auf. **Sternsplitter** nehmen ihr 12% Leben und etwas Schaden. Gehen dir die Schritte aus, findet die Bestie dich – im Hinterhalt ist sie stärker.',
    'Ein Sieg schaltet die nächste **Jagdstufe** frei.',
  ], list: 'huntTiles', see: ['beasts'] },
  { id: 'mutators', cat: 'modes', title: 'Prophezeiungen', text: [
    'Prophezeiungen sind freiwillige Erschwernisse vor einem Run. Jede erhöht den Sternenstaub am Ende – frei kombinierbar.',
  ], list: 'mutators', see: ['ascension'] },

  // ------------------------------------------------------------- Gegner & Bosse
  { id: 'scaling', cat: 'foes', title: 'Wie stark sind Gegner?', text: [
    'Jeder Kampf hat eine **Stärke**: Leben der Gegner × Stärke, Schaden × Stärke hoch 0,72. Im Feldzug liegt sie bei Akt I bei 1, Akt II bei 2,7 und Akt III bei 6,5 – und steigt mit jedem Ort um 14%.',
    'Normale Kämpfe dauern rund 40 Sekunden; mit der Zeit kommen immer mehr Gegner. Dazu kommen Eliten und – auf höheren Sternenhöhen – zusätzliche Erschwernisse.',
  ], see: ['elites', 'ascension'] },
  { id: 'elites', cat: 'foes', title: 'Eliten & Affixe', text: [
    'Eliten haben **4,5-mal so viel Leben**, 25% mehr Schaden und geben 8-mal so viel Erfahrung. Ihr Name zeigt ihre **Affixe** – im Akt I einen, später bis zu fünf.',
    'Eliten lassen bessere Beute und manchmal Relikte fallen. Rote Markierungen bei Eliten bedeuten einen gleich folgenden Angriff.',
  ], list: 'eliteAffixes', see: ['resist', 'scaling'] },
  { id: 'enemies', cat: 'foes', title: 'Gegner-Mechaniken', text: [
    'Jedes Biom hat eigene Gegner mit besonderen Fähigkeiten. Sobald du eine Gegnerart besiegt hast, steht sie hier mit ihren Fähigkeiten.',
  ], list: 'enemies', see: ['elites', 'hazards'] },
  { id: 'bosses', cat: 'foes', title: 'Bosse & ihre Mechaniken', text: [
    'Jeder Boss hat **Phasen**: Ab der Hälfte seines Lebens greift er wilder an und setzt eine Mechanik ein. Unter 50% wird er wütend.',
    '**Schildkristalle:** Der Boss ist fast unverwundbar, bis du die drei Kristalle zerstörst. Bricht der Schild, ist er kurz betäubt und nimmt mehr Schaden.',
    '**Seelenanker:** Zwei Anker heilen den Boss – zerstöre sie schnell.',
    '**Sichere Zonen:** Alles im roten Kreis wird gleich getroffen – nur die grünen Kreise sind sicher.',
    '**Schachbrett:** Einschläge in zwei Wellen – stell dich in die Lücken der ersten Welle und weich dann aus.',
  ], list: 'bossPatterns', see: ['beasts'] },
  { id: 'beasts', cat: 'foes', title: 'Sternenbestien', text: [
    'Sternenbestien sind **zufällig erzeugte Bosse** mit eigenen Namen, Angriffsmustern und 2–3 Phasen. Du triffst sie im Atlas, tief im Abgrund, im Sternenturm und in der Sternenjagd.',
    'Sie lassen sehr gute Beute fallen, oft Kartenpacks und Juwelen.',
  ], see: ['bosses', 'modes_hunt'] },
  { id: 'hazards', cat: 'foes', title: 'Gefahren im Gelände', text: [
    'Manche Biome sind selbst gefährlich: In der **Glutschmiede** und im **Aschewald** schlagen Flammen ein, im **Sturmgipfel** und im **Spiegellabyrinth** Blitze, im **Nebelmoor** und im **Seelenmeer** bilden sich Giftpfützen.',
    'Eine Markierung am Boden zeigt immer an, wo gleich etwas einschlägt. Die Prophezeiung **Sternenregen** lässt zusätzlich Meteore fallen.',
  ], see: ['playerres', 'mutators'] },

  // ------------------------------------------------------------- Symbole
  { id: 'mapicons', cat: 'icons', title: 'Symbole der Karte', text: [
    'Auf der Karte eines Akts wählst du deinen Weg von unten nach oben. Leuchtende Orte sind erreichbar.',
  ], list: 'nodeTypes', see: ['modes_normal', 'heal'] },
  { id: 'hunticons', cat: 'icons', title: 'Symbole der Sternenjagd', text: [
    'Verhüllte Felder sind gestreift. Leuchtend umrandete Felder kannst du betreten.',
  ], list: 'huntTiles', see: ['modes_hunt'] },
  { id: 'hud', cat: 'icons', title: 'Die Kampfanzeige', text: [
    '**Oben links:** dein Leben (rot), darüber eine Barriere (hell) und darunter die Erfahrung bis zur nächsten Stufe (blau).',
    '**Oben rechts:** deine Stufe und die verbleibende Zeit des Kampfes. **Mitte oben:** Gebiet und aktuelles Ziel (z. B. „Zerstöre die Schildkristalle!“).',
    '**Unten:** im Bosskampf die Lebensleiste des Bosses.',
    '**Zahlen:** weiß/farbig = normale Treffer (Farbe der Schadensart), gelb mit „!“ = kritisch, grün und klein = Schaden über Zeit.',
  ], see: ['controls', 'colors'] },
  { id: 'colors', cat: 'icons', title: 'Farben', text: [
    'Die Farben der Seltenheiten und Elemente ziehen sich durch das ganze Spiel:',
  ], list: 'colors', see: ['rarity', 'types'] },
];

// Was die besonderen Fähigkeiten von Gegnern bedeuten (für die Gegner-Liste)
export const MECH_TEXT = {
  ranged: 'schießt aus der Distanz', explode: 'explodiert neben dir', split: 'zerfällt beim Tod in kleinere Gegner',
  charge: 'holt aus und stürmt geradeaus auf dich zu', shield: 'schützt Gegner in der Nähe (halber Schaden)', heal: 'heilt Gegner in der Nähe',
  blink: 'teleportiert sich in deine Nähe', spawn: 'ruft laufend Verstärkung', phase: 'wird zeitweise unverwundbar (durchsichtig)',
  leap: 'springt dich aus der Entfernung an', mines: 'legt Minen', group: 'kommt in Gruppen', hasteAura: 'beschleunigt Gegner in der Nähe',
  deathPool: 'hinterlässt beim Tod eine schädliche Pfütze', vampHit: 'heilt sich mit jedem Treffer',
  reflect: 'hüllt sich zeitweise in einen Kristallpanzer (fast kein Schaden)', burrow: 'gräbt sich ein und bricht neben dir hervor',
  beam: 'zielt mit einem Strahl – raus aus der Linie', mortar: 'feuert Geschosse auf eine markierte Stelle', pull: 'zieht dich mit einem Sog heran',
  drain: 'saugt dir Leben ab und heilt sich – Abstand halten', trail: 'hinterlässt eine Feuerspur', twin: 'Zwillinge mit einem schädlichen Band – nicht hindurchlaufen',
  cloner: 'erschafft Trugbilder, wenn er verletzt wird', zigzag: 'fliegt im Zickzack', deathRing: 'verschießt beim Tod einen Splitterring',
  enrage: 'wird wütend, wenn Verbündete in der Nähe sterben', slowAura: 'verlangsamt dich in seiner Nähe', dmgAura: 'schadet allem in seiner Nähe',
  stomp: 'stampft nach dem Ansturm auf',
};
export const ELITE_TEXT = {
  fast: '40% schneller', armored: 'erleidet 40% weniger Schaden', burning: 'verbrennt alles in seiner Nähe', regen: 'regeneriert 3% Leben pro Sekunde',
  fireres: '75% Feuerwiderstand', coldres: '75% Kältewiderstand', lightres: '75% Blitzwiderstand', volatile: 'explodiert beim Tod',
  summoner: 'ruft regelmäßig Schatten herbei', vampiric: 'heilt sich mit Treffern', shielding: 'schützt Gegner in der Nähe', blinking: 'teleportiert sich',
  enraged: 'wird unter halbem Leben viel schneller', chilling: 'verlangsamt dich in seiner Nähe', splitting: 'zerfällt beim Tod in kleinere Eliten',
};
export const PATTERN_TEXT = {
  ring: ['Ring', 'Geschossring in alle Richtungen'], spiral: ['Spirale', 'drehende Geschossspirale'], barrage: ['Salve', 'gezielte Geschosse auf dich'],
  charge: ['Ansturm', 'rast auf dich zu'], slam: ['Bodenschlag', 'Einschläge an markierten Stellen'], summon: ['Beschwörung', 'ruft Diener'],
  laser: ['Strahlen', 'rotierende Strahlen'], blink: ['Sprung', 'teleportiert sich'], pools: ['Pfützen', 'schädliche Flächen am Boden'],
  firewall: ['Flammenwand', 'Wand aus Einschlägen'], cross: ['Kreuz', 'Einschläge in Kreuzform'], rain: ['Regen', 'viele Einschläge um dich'],
  vortex: ['Strudel', 'zieht dich heran'], clones: ['Doppelgänger', 'erschafft Abbilder'], checker: ['Schachbrett', 'Einschläge in zwei Wellen'],
  safezones: ['Sternenschlag', 'alles außer den grünen Kreisen wird getroffen'],
};
export const NODE_TEXT = {
  fight: 'Normaler Kampf – überlebe, bis die Zeit abläuft.', elite: 'Kampf mit Eliten – gefährlicher, bessere Beute.',
  trial: 'Prüfung – harte Eliten, sehr gute Belohnung.', event: 'Ereignis – eine Entscheidung mit Folgen, manchmal von einem Haus.',
  treasure: 'Schatzkammer – Gold und ein Gegenstand deiner Wahl.', shrine: 'Schrein – ein starker Bonus für die nächsten Kämpfe.',
  shop: 'Händler – Gegenstände, Glyphen, Heilung; hier verkaufst du auch.', forge: 'Schmiede – Gegenstände und Runen verbessern.',
  rest: 'Lager – heilen, eine Rune verbessern oder eine Glyphe schnitzen.', boss: 'Boss des Akts – nach dem Sieg volle Heilung und der nächste Akt.',
};
export const HUNT_TEXT = {
  start: 'dein Lager', fight: 'Kampf', elite: 'Elitekampf', trial: 'Prüfung', event: 'Ereignis', treasure: 'Schatz', shrine: 'Schrein',
  shop: 'Händler', forge: 'Schmiede', rest: 'Quelle: Lager und +3 Schritte', track: 'Spur: zeigt zum Hort und deckt Felder auf',
  shard: 'Sternsplitter: schwächt die Bestie', empty: 'Ödnis: nichts', lair: 'Hort der Bestie',
};
