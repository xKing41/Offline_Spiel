// Sicherung ohne Cloud: Sicherungsdatei speichern/teilen/laden, kompakter Text-Code, tägliche Wiederherstellungspunkte
// und Übertragung auf ein anderes Gerät per QR-Code-Folge (Kamera).
import { save, persist, importSaveObject, accountLevel } from './save.js';
import { qrcode } from './vendor/qrcode.mjs';

const KEY_BAK = 'runenfall_wiederherstellung';
const pad = (n) => String(n).padStart(2, '0');

/** Capacitor-Plugins in der App (null im Browser). */
export const native = () => {
  const c = typeof window !== 'undefined' && window.Capacitor;
  return c && c.isNativePlatform && c.isNativePlatform() ? c.Plugins : null;
};

// ---------------------------------------------------------------- Kompression
const canZip = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
async function deflate(str) {
  const buf = await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
  return new Uint8Array(buf);
}
async function inflate(bytes) {
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
}
function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(str) {
  const s = atob(str), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
const utf8B64 = (str) => btoa(unescape(encodeURIComponent(str)));
const b64Utf8 = (b64) => decodeURIComponent(escape(atob(b64)));

// ---------------------------------------------------------------- Lesen & Prüfen
/** Erkennt Sicherungsdatei, rohen Spielstand, kompakten Code (RFZ1:) oder alten Text-Code. */
export async function parseBackup(text) {
  text = String(text || '').trim();
  let obj;
  if (text.startsWith('{')) {
    const j = JSON.parse(text);
    obj = j && j.app === 'runenfall' && j.save ? j.save : j;
  } else if (text.startsWith('RFZ1:')) {
    obj = JSON.parse(await inflate(fromB64(text.slice(5).replace(/\s+/g, ''))));
  } else {
    obj = JSON.parse(b64Utf8(text.replace(/\s+/g, '')));
  }
  if (!obj || typeof obj !== 'object' || obj.alloc === undefined || !obj.stats) throw new Error('Keine Runenfall-Sicherung');
  return obj;
}
/** Kurzinfo zu einem Spielstand (für die Bestätigung vor dem Laden). */
export function describe(obj) {
  const lvl = accountLevel(obj.axp || 0).level;
  const wins = Object.values((obj.stats && obj.stats.wins) || {}).reduce((a, b) => a + b, 0);
  return { lvl, dust: obj.dust || 0, runs: (obj.stats && obj.stats.runs) || 0, wins, classes: (obj.unlockedCls || []).length };
}
/** Spielstand übernehmen (vorher automatisch den aktuellen sichern). */
export function applyBackup(obj) {
  autoBackup('Vor dem Laden');
  importSaveObject(obj);
}

// ---------------------------------------------------------------- Datei
export function backupName() {
  const d = new Date();
  return `runenfall-sicherung-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}
const backupText = () => JSON.stringify({ app: 'runenfall', v: 1, date: Date.now(), lvl: accountLevel().level, save });
const mark = (how) => { save.lastBackup = Date.now(); persist(); return how; };

/** Sicherungsdatei erzeugen und teilen bzw. herunterladen. Gibt null zurück, wenn abgebrochen. */
export async function saveFile() {
  const text = backupText(), name = backupName();
  const P = native();
  if (P && P.Filesystem && P.Share) {
    const r = await P.Filesystem.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
    try { await P.Share.share({ title: 'Runenfall-Sicherung', text: 'Mein Runenfall-Spielstand', files: [r.uri], dialogTitle: 'Sicherung speichern oder senden' }); }
    catch (e) { if (/cancel/i.test(String(e && e.message))) return null; throw e; }
    return mark('native');
  }
  const file = typeof File !== 'undefined' ? new File([text], name, { type: 'application/json' }) : null;
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Runenfall-Sicherung' }); return mark('shared'); }
    catch (e) { if (e && e.name === 'AbortError') return null; }
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return mark('download');
}
/** Datei auswählen und als Text lesen. */
export function pickFile() {
  return new Promise((resolve, reject) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,.txt,application/json,text/plain'; inp.style.display = 'none';
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return reject(new Error('Keine Datei gewählt'));
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsText(f);
    };
    document.body.appendChild(inp);
    inp.click();
  });
}

// ---------------------------------------------------------------- Text-Code
/** Kompakter Code (komprimiert), sonst der klassische Code. */
export async function compactCode() {
  const json = JSON.stringify(save);
  return canZip() ? 'RFZ1:' + toB64(await deflate(json)) : utf8B64(json);
}
export async function shareCode() {
  const code = await compactCode();
  const P = native();
  if (P && P.Share) {
    try { await P.Share.share({ title: 'Runenfall-Code', text: code, dialogTitle: 'Code senden' }); }
    catch (e) { if (/cancel/i.test(String(e && e.message))) return null; throw e; }
    return mark('native');
  }
  if (navigator.share) {
    try { await navigator.share({ title: 'Runenfall-Code', text: code }); return mark('shared'); }
    catch (e) { if (e && e.name === 'AbortError') return null; }
  }
  await navigator.clipboard.writeText(code);
  return mark('copied');
}

// ---------------------------------------------------------------- Wiederherstellungspunkte
export function restorePoints() {
  try { return JSON.parse(localStorage.getItem(KEY_BAK) || '[]'); } catch (e) { return []; }
}
export function autoBackup(label = 'Automatisch') {
  if (!save.stats || !save.stats.runs) return;
  try {
    const list = restorePoints();
    list.unshift({ date: Date.now(), lvl: accountLevel().level, label, data: JSON.stringify(save) });
    while (list.length > 3) list.pop();
    localStorage.setItem(KEY_BAK, JSON.stringify(list));
  } catch (e) { /* Speicher voll: Sicherungspunkt auslassen */ }
}
/** Einmal pro Tag beim Start einen Wiederherstellungspunkt anlegen. */
export function dailyBackup() {
  const today = new Date().toDateString();
  const last = restorePoints()[0];
  if (last && new Date(last.date).toDateString() === today) return;
  autoBackup('Tagesbeginn');
}
export function restorePoint(i) {
  const p = restorePoints()[i];
  if (!p) return false;
  const obj = JSON.parse(p.data);
  importSaveObject(obj);
  return true;
}

// ---------------------------------------------------------------- QR-Übertragung
const CHUNK = 620;
/** Spielstand als Folge von QR-Texten: RF1|id|i|n|art|daten */
export async function qrFrames() {
  const json = JSON.stringify(save);
  const zip = canZip();
  const data = zip ? toB64(await deflate(json)) : utf8B64(json);
  const id = Math.random().toString(36).slice(2, 7);
  const n = Math.ceil(data.length / CHUNK);
  return Array.from({ length: n }, (_, i) => `RF1|${id}|${i}|${n}|${zip ? 'z' : 'b'}|${data.slice(i * CHUNK, (i + 1) * CHUNK)}`);
}
/** QR-Code in eine Leinwand zeichnen (weiß mit Ruhezone, gut scanbar vom Bildschirm). */
export function drawQR(canvas, text) {
  const qr = qrcode(0, 'L');
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount(), quiet = 4, size = canvas.width, cell = size / (n + quiet * 2);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (qr.isDark(r, c)) ctx.fillRect(Math.floor((c + quiet) * cell), Math.floor((r + quiet) * cell), Math.ceil(cell), Math.ceil(cell));
  }
}
/** Sammelt gescannte Teile, bis der Spielstand vollständig ist. */
export class QrReceiver {
  constructor(onProgress) { this.onProgress = onProgress; this.id = null; this.parts = []; this.n = 0; this.kind = 'z'; }
  feed(text) {
    const m = /^RF1\|(\w+)\|(\d+)\|(\d+)\|([zb])\|([\s\S]*)$/.exec(String(text || ''));
    if (!m) return false;
    const id = m[1], i = Number(m[2]), n = Number(m[3]);
    if (this.id !== id) { this.id = id; this.n = n; this.kind = m[4]; this.parts = new Array(n).fill(null); }
    if (i < n && this.parts[i] === null) { this.parts[i] = m[5]; this.onProgress(this.parts.filter((x) => x !== null).length, n); }
    return this.parts.length > 0 && this.parts.every((x) => x !== null);
  }
  async result() {
    const data = this.parts.join('');
    const json = this.kind === 'z' ? await inflate(fromB64(data)) : b64Utf8(data);
    const obj = JSON.parse(json);
    if (!obj || obj.alloc === undefined || !obj.stats) throw new Error('Keine Runenfall-Sicherung');
    return obj;
  }
}
/** Kamera starten und erkannte QR-Texte melden. Gibt eine Stopp-Funktion zurück. */
export async function startScanner(video, onText) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  video.srcObject = stream;
  video.setAttribute('playsinline', '');
  video.muted = true;
  await video.play();
  let detector = null, jsQR = null;
  if (typeof BarcodeDetector !== 'undefined') {
    try { const f = await BarcodeDetector.getSupportedFormats(); if (f.includes('qr_code')) detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { detector = null; }
  }
  if (!detector) { await import('./vendor/jsQR.js'); jsQR = self.jsQR; }
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    if (video.readyState >= 2) {
      try {
        if (detector) { for (const c of await detector.detect(video)) onText(c.rawValue); }
        else {
          const w = video.videoWidth, h = video.videoHeight, sc = Math.min(1, 800 / Math.max(w, h));
          cv.width = Math.round(w * sc); cv.height = Math.round(h * sc);
          ctx.drawImage(video, 0, 0, cv.width, cv.height);
          const r = jsQR(ctx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height, { inversionAttempts: 'dontInvert' });
          if (r && r.data) onText(r.data);
        }
      } catch (e) { /* einzelnes Bild nicht lesbar */ }
    }
    setTimeout(tick, detector ? 90 : 140);
  };
  tick();
  return () => { stopped = true; for (const t of stream.getTracks()) t.stop(); video.srcObject = null; };
}
