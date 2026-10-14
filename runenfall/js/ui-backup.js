// Oberfläche der Sicherung: Datei, Text-Code, Wiederherstellungspunkte und QR-Übertragung.
import { app } from './app.js';
import { $, on, modal, closeModal, toast, confirmBox, onModalClose } from './ui.js';
import { esc, fmt } from './util.js';
import { save } from './save.js';
import {
  saveFile, pickFile, parseBackup, describe, applyBackup, compactCode, shareCode, restorePoints, restorePoint,
  qrFrames, drawQR, QrReceiver, startScanner,
} from './backup.js';
import { sfx } from './audio.js';

const ago = (t) => {
  if (!t) return 'noch nie';
  const d = Math.floor((Date.now() - t) / 86400000);
  return d <= 0 ? 'heute' : d === 1 ? 'gestern' : `vor ${d} Tagen`;
};
const when = (t) => new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function backupPanel() {
  const pts = restorePoints();
  return `<div class="panel backup"><h3>Sicherung – ganz ohne Cloud</h3>
    <p class="small muted">Dein Fortschritt liegt nur auf diesem Gerät. Speichere ihn als Datei (z. B. in Google Drive, per Mail oder Messenger) oder übertrage ihn per QR-Code auf ein anderes Handy. Letzte Sicherung: <b>${ago(save.lastBackup)}</b>.</p>
    <div class="col">
      <button class="btn" data-a="bkFile">💾 Sicherungsdatei speichern</button>
      <button class="btn" data-a="bkLoad">📂 Sicherungsdatei laden</button>
      <div class="row"><button class="btn small" data-a="bkQrSend">▦ Per QR-Code senden</button><button class="btn small" data-a="bkQrScan">📷 QR-Code empfangen</button></div>
      <div class="row"><button class="btn small ghost" data-a="bkCode">Text-Code teilen</button><button class="btn small ghost" data-a="bkPaste">Text-Code einfügen</button></div>
    </div>
    <h4>Wiederherstellungspunkte</h4>
    ${pts.length ? pts.map((p, i) => `<div class="rpoint"><div><b>${when(p.date)}</b><small>${esc(p.label)} · Kontostufe ${p.lvl}</small></div><button class="btn small" data-a="bkRestore" data-i="${i}">Zurückholen</button></div>`).join('')
      : '<p class="small muted">Noch keine – einmal täglich wird automatisch einer angelegt.</p>'}
  </div>`;
}

/** Gefundenen Spielstand zeigen und nach Bestätigung übernehmen. */
function confirmLoad(obj, from) {
  const d = describe(obj);
  confirmBox(`<b>Spielstand gefunden</b> (${esc(from)})<br><br>Kontostufe <b>${d.lvl}</b> · ✦ ${fmt(d.dust)} · ${d.runs} Runs · ${d.wins} Siege · ${d.classes} Klassen<br><br>Dein aktueller Fortschritt wird ersetzt. Vorher wird automatisch ein Wiederherstellungspunkt angelegt.`,
    'Übernehmen', () => {
      try { applyBackup(obj); sfx.levelup(); toast('Spielstand übernommen!'); app.nav('hub'); }
      catch (e) { sfx.deny(); toast('Das hat nicht geklappt: ' + esc(e.message)); }
    });
}

on('bkFile', async () => {
  try {
    const how = await saveFile();
    if (!how) return;
    toast(how === 'download' ? 'Sicherungsdatei heruntergeladen.' : 'Sicherung bereit zum Speichern.');
    app.nav('settings');
  } catch (e) { sfx.deny(); toast('Speichern nicht möglich: ' + esc(e.message || String(e))); }
});
on('bkLoad', async () => {
  try {
    const text = await pickFile();
    confirmLoad(await parseBackup(text), 'Datei');
  } catch (e) { if (!/Keine Datei/.test(e.message)) { sfx.deny(); toast('Keine gültige Runenfall-Sicherung.'); } }
});
on('bkCode', async () => {
  try {
    const how = await shareCode();
    if (how === 'copied') toast('Code kopiert – füge ihn z. B. in eine Notiz ein.');
    else if (how) toast('Code geteilt.');
  } catch (e) {
    const code = await compactCode();
    modal(`<h3>Text-Code</h3><p class="small muted">Markiere den Code und kopiere ihn.</p><textarea class="code" readonly>${esc(code)}</textarea><button class="btn" data-a="_close">Fertig</button>`);
  }
});
on('bkPaste', () => modal(`<h3>Text-Code einfügen</h3><p class="small muted">Achtung: ersetzt den aktuellen Fortschritt.</p>
  <textarea id="bkTxt" class="code" placeholder="Code oder Inhalt der Sicherungsdatei hier einfügen"></textarea>
  <div class="row"><button class="btn" data-a="_close">Abbrechen</button><button class="btn primary" data-a="bkPasteGo">Prüfen</button></div>`));
on('bkPasteGo', async () => {
  try { confirmLoad(await parseBackup($('#bkTxt').value), 'Text-Code'); }
  catch (e) { sfx.deny(); toast('Ungültiger Code.'); }
});
on('bkRestore', (d) => {
  const p = restorePoints()[Number(d.i)];
  if (!p) return;
  confirmBox(`Wiederherstellungspunkt vom <b>${when(p.date)}</b> (Kontostufe ${p.lvl}) zurückholen? Der aktuelle Fortschritt wird ersetzt.`, 'Zurückholen', () => {
    try { restorePoint(Number(d.i)); toast('Wiederhergestellt.'); app.nav('hub'); } catch (e) { toast('Fehler beim Wiederherstellen.'); }
  });
});

// ---------------------------------------------------------------- QR senden
let qrTimer = null;
on('bkQrSend', async () => {
  const frames = await qrFrames();
  modal(`<h3 class="center">▦ Spielstand senden</h3><p class="small center">Öffne auf dem anderen Gerät <b>Einstellungen → QR-Code empfangen</b> und halte die Kamera ruhig auf diesen Bildschirm, bis alle Teile angekommen sind.</p>
    <canvas id="qrCv" class="qrcv" width="720" height="720"></canvas>
    <p class="center small muted" id="qrInfo"></p>
    <div class="row"><button class="btn small" data-a="qrSlower">Langsamer</button><button class="btn small" data-a="qrFaster">Schneller</button></div>
    <button class="btn" data-a="_close">Fertig</button>`, 'qrmodal');
  let i = 0;
  const show = () => {
    const cv = $('#qrCv');
    if (!cv) return stopQr();
    drawQR(cv, frames[i]);
    $('#qrInfo').textContent = `Teil ${i + 1} von ${frames.length}`;
    i = (i + 1) % frames.length;
    qrTimer = setTimeout(show, qrDelay);
  };
  stopQr();
  show();
  onModalClose(stopQr);
});
let qrDelay = 450;
on('qrSlower', () => { qrDelay = Math.min(1500, qrDelay + 150); toast(`Ein Teil alle ${qrDelay} ms`); });
on('qrFaster', () => { qrDelay = Math.max(200, qrDelay - 100); toast(`Ein Teil alle ${qrDelay} ms`); });
function stopQr() { clearTimeout(qrTimer); qrTimer = null; }

// ---------------------------------------------------------------- QR empfangen
let stopCam = null;
on('bkQrScan', async () => {
  modal(`<h3 class="center">📷 Spielstand empfangen</h3><p class="small center">Richte die Kamera auf den QR-Code des anderen Geräts. Die Teile werden automatisch eingesammelt.</p>
    <div class="qrcam"><video id="qrVid" playsinline muted></video><div class="qrframe"></div></div>
    <div class="bar xp"><i id="qrBar" style="width:0%"></i><span id="qrTxt">Warte auf den ersten Teil …</span></div>
    <button class="btn" data-a="_close">Abbrechen</button>`, 'qrmodal');
  const rx = new QrReceiver((have, n) => {
    const bar = $('#qrBar'), txt = $('#qrTxt');
    if (bar) bar.style.width = `${(have / n) * 100}%`;
    if (txt) txt.textContent = `${have} von ${n} Teilen`;
    sfx.click();
  });
  let done = false;
  try {
    stopCam = await startScanner($('#qrVid'), async (text) => {
      if (done || !rx.feed(text)) return;
      done = true;
      camOff();
      try { const obj = await rx.result(); confirmLoad(obj, 'QR-Übertragung'); }
      catch (e) { closeModal(); sfx.deny(); toast('Übertragung fehlerhaft – bitte noch einmal.'); }
    });
    onModalClose(camOff);
  } catch (e) {
    camOff();
    $('#qrTxt') && ($('#qrTxt').textContent = 'Kamera nicht verfügbar');
    toast('Kein Kamerazugriff. Erlaube die Kamera oder nutze die Sicherungsdatei.');
  }
});
function camOff() { if (stopCam) { const s = stopCam; stopCam = null; s(); } }
