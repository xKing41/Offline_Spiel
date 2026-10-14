# RUNENFALL ✦

Roguelite für das Handy – Survivor-Kämpfe, Pfadkarte wie in einem Deckbuilder, Beute mit Affix-Stufen wie in Path of Exile und eine riesige Sternenkarte für dauerhaften Fortschritt. Läuft komplett offline.

## 📲 APK herunterladen
**https://github.com/xKing41/Offline_Spiel/releases/download/runenfall/Runenfall.apk**
(Link in der **normalen Chrome-App** öffnen, nicht im eingebauten Browser einer anderen App.)

## Der Kreislauf
1. **Run starten:** Klasse und Sternenhöhe wählen.
2. **Karte:** 3 Akte mit je 8 Orten – Kampf, Elite, Prüfung, Schatzkammer, Schrein, Händler, Schmiede, Ereignis, Lager, Boss. Jeder Akt spielt in einem von zwei Biomen mit eigenen Gegnern, Gefahren und Bossen.
3. **Kampf:** Mit dem Daumen laufen, deine Runen feuern automatisch. Beim Stufenaufstieg wählst du Segen.
4. **Build:** Bis zu 4 Runen mit je 3 Glyphen-Sockeln, 8 Ausrüstungsplätze, Schmiede zum Würfeln von Affixen.
5. **Nach dem Run:** Konto-Erfahrung → Sternpunkte, Sternenstaub → Altar, Kodex, Klassen und Relikte.

## Dauerhafter Fortschritt
| System | Was es bringt |
|---|---|
| **Sternenkarte** | 525 Sterne, 60 bedeutende Sterne, 12 Keystones, 12 Juwelsockel, eigener Baum pro Klasse, jederzeit kostenlos umbaubar |
| **Sternenatlas** | Endgame: 30 Regionen (Stufe 1–16) als Akt IV, Atlas-Kenntnisse, 3 Endbosse mit Phasen |
| **Erzfeinde** | Wer dich tötet, bekommt einen Namen, steigt im Rang auf (bis zu 16 Merkmale wie Hydra, Blutsauger, Phasenwandler) und jagt dich in späteren Runs – Kopfgeld: mythische Beute |
| **Mythische Gegenstände** | Prozedural erzeugt: maximale Affixe + 1–2 von über 50 Spezialeffekten, umschmiedbar |
| **Runenmerkmale** | Jede Rune kann mit Merkmalen erscheinen (z. B. *Glühender Zwillings-Feuerball*) – über 1.000 Varianten im Runen-Archiv, Runenschliff in der Schmiede |
| **Sternenbestien** | 7 prozedural generierte Atlas-Bosse mit eigenen Angriffsmustern und Phasen |
| **Zitadelle** | 8 Gebäude, die auch offline produzieren (Staub, Erz, Kristalle, Essenz, Gefährten-Eier) |
| **Alchemie** | 9 Tränke als Run-Verstärker |
| **Schicksalskarten** | 80 sammelbare Karten in 4 Seltenheiten, eigenes Deck, Karten steigen bis ★5 |
| **Ligen** | Wöchentlich wechselnde Liga mit eigenen Regeln und Bonus |
| **Saison-Pass** | Monatlich neu: 40 Belohnungsstufen |
| **Juwelen** | Dauerhafte Beute mit zufälligen Affixen zum Einsetzen in die Sternenkarte |
| **Gefährten** | 12 sammelbare Begleiter mit Angriff und passivem Bonus, bis Stufe 10 |
| **Sets** | 6 Sets mit Boni für 2 und 4 Teile |
| **Sternenmacht** | Unendliche Paragon-Stufen ab Kontostufe 20 |
| **Kodex** | 46 Runen und 63 Glyphen – mehr Freischaltungen = mehr Build-Möglichkeiten |
| **Aufstiegsklassen** | 18 Spezialisierungen (2 pro Klasse) mit je 5 starken Stufen |
| **Altar** | 21 dauerhafte Verbesserungen (Schaden, Leben, Neuwürfeln, Wiederbeleben, Rabatte …) |
| **Relikte** | Dauerhafte Ausrüstung über alle Runs, bis zu 5 Affixe, mit Staub auf Stufe 10 veredelbar |
| **Klassen** | 9 Klassen, 6 davon freischaltbar |
| **Sternenhöhe** | Unendliche Schwierigkeitsstufen mit besseren Belohnungen |
| **Abgrund** | Endlosmodus nach dem ersten Sieg – wie tief kommst du? |
| **Prophezeiungen** | 12 frei kombinierbare Erschwernisse für mehr Sternenstaub |
| **Tägliche Herausforderung** | Jeden Tag ein fester Run mit doppeltem Staub |
| **Aufträge** | 3 wechselnde Ziele mit Staub- und Relikt-Belohnung |
| **Bestiarium** | 30 Gegnerarten, 12 Bosse und 7 Sternenbestien zum Erforschen |
| **Erfolge** | 126 Erfolge mit Sternpunkten und Staub als Belohnung |

## Build-Tiefe
- Schadensformel wie in PoE: Grundschaden × (1 + Σ erhöht) × Π mehr, mit Umwandlung (Physisch → Blitz → Kälte → Feuer → Chaos), Durchdringung und Widerständen.
- Zustände: Entzünden (stapelbar per Keystone), Gift (stapelt), Blutung, Schock (mehr erlittener Schaden), Unterkühlung/Einfrieren.
- Keystones wie *Glaskanone*, *Ruhiger Geist* (keine Krits, 30% mehr Schaden), *Henkerspräzision* (jeder 4. Treffer kritisch), *Seuchenfürst*, *Sternenseele* (Leben 1, riesige Barriere) verändern die Regeln.
- 74 Unikate wie *Aschenrufer* (alles wird Feuer), *Echos der Leere* (alle Zauber doppelt), *Phönixfeder* (einmal pro Kampf wiederbeleben) oder *Gespaltener Himmel* (Projektile teilen sich).

## Technik
Reines JavaScript (ES-Module), Canvas-Rendering, keine Abhängigkeiten. Spielstand in `localStorage`, Export/Import in den Einstellungen.
`js/data/*` enthält alle Inhalte (Fertigkeiten, Gegenstände, Baum, Gegner) – leicht erweiterbar.

Lokal starten: `cd runenfall && python3 -m http.server 8000` → http://localhost:8000
