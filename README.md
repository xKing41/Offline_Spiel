# NEON RUSH 🎮

Schneller Neon-Arcade-Dodger fürs Handy – perfekt für die Pause.
**Läuft komplett offline**, sobald die App einmal geöffnet wurde.

## Spielprinzip

- **Steuern:** Finger irgendwo auf den Bildschirm legen und nach links/rechts ziehen.
- **◆ Kristalle** sammeln – Serien erhöhen den Combo-Multiplikator (bis x5).
- **Knapp vorbei** an Hindernissen gibt Bonuspunkte.
- **Power-Ups:** Schild (fängt einen Treffer ab), Zeitlupe, Magnet.
- Mit Kristallen neue **Skins** freischalten oder nach einem Crash **weiterspielen**.
- Das Spiel wird mit der Zeit immer schneller und bringt neue Hindernisse (bewegliche Blöcke, Rotoren, Zickzack-Wände).
- Verlässt du die App (Anruf, Chef kommt 😉), pausiert das Spiel automatisch.

## 📲 APK herunterladen (Android)

**Direkter Link:** https://github.com/xKing41/Offline_Spiel/releases/latest/download/NeonRush.apk

1. Link auf dem Handy öffnen – die APK wird heruntergeladen.
2. Antippen und installieren. Beim ersten Mal fragt Android, ob der Browser
   „unbekannte Apps installieren“ darf – einmal erlauben.
3. Fertig. Neon Rush läuft komplett offline.

Die APK wird bei jeder Code-Änderung automatisch in der Cloud gebaut
(GitHub Actions → „APK bauen“, Dauer ca. 3–5 Minuten). Der Link zeigt immer
auf die neueste Version. Alle Builds haben denselben Signaturschlüssel
(`apk/neonrush-ci.jks`) – eine neue APK installiert sich als Update über die
alte, Rekord und Kristalle bleiben erhalten.

Alternativ liegt die APK auch unter **Actions → letzter Lauf „APK bauen“ → Artifacts**.

## Als Web-App (auch iPhone)

1. Auf GitHub im Repo: **Settings → Pages → Source: „GitHub Actions“** auswählen.
2. Den Code auf `main` mergen – die Action `Deploy auf GitHub Pages` veröffentlicht das Spiel automatisch.
3. Die Seite (z. B. `https://<dein-name>.github.io/Offline_Spiel/`) einmal mit Internet auf dem Handy öffnen.
4. Installieren:
   - **Android (Chrome):** Button „Als App installieren“ im Menü oder ⋮ → „App installieren“.
   - **iPhone (Safari):** Teilen → „Zum Home-Bildschirm“.
5. Fertig – ab jetzt startet Neon Rush vom Homescreen, auch ohne Internet. Updates werden automatisch geladen, wenn du mal online bist.

## Lokal testen

```bash
python3 -m http.server 8000
# dann http://localhost:8000 im Browser öffnen (Pfeiltasten / A-D zum Steuern, P = Pause)
```

## Technik

Reines HTML5-Canvas + JavaScript, keine Abhängigkeiten, kein Build-Schritt.

| Datei | Inhalt |
|---|---|
| `index.html` | Grundgerüst, Menüs |
| `style.css` | Neon-Design |
| `game.js` | Spiel-Engine, Sound (Web Audio, synthetisch), Speicherstand (localStorage) |
| `sw.js` | Service Worker für den Offline-Betrieb |
| `manifest.webmanifest` | App-Infos für die Installation |
| `apk/` | Android-Hülle (Capacitor): Icons, Vollbild, Signaturschlüssel |
| `.github/workflows/build-apk.yml` | Baut die APK in der Cloud und aktualisiert den Download-Link |
