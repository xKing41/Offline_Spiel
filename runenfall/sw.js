// Service Worker: speichert alle Dateien lokal, damit Runenfall ohne Internet läuft.
const CACHE = 'runenfall-v7';
const ASSETS = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/runering.svg', 'fonts/cinzel.woff2', 'fonts/cinzel-deco.woff2', 'js/gfx.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'js/main.js', 'js/app.js', 'js/ui.js', 'js/ui-meta.js', 'js/ui-run.js', 'js/run.js', 'js/calc.js', 'js/combat.js',
  'js/treeview.js', 'js/save.js', 'js/audio.js', 'js/util.js', 'js/ui-endgame.js', 'js/ui-systems.js', 'js/data/systems.js', 'js/skillfx.js', 'js/data/evolutions.js', 'js/data/modes.js', 'js/ui-modes.js', 'js/data/factions.js', 'js/ui-factions.js', 'js/coach.js', 'js/analysis.js', 'js/backup.js', 'js/ui-backup.js', 'js/vendor/qrcode.mjs', 'js/vendor/jsQR.js',
  'js/data/stats.js', 'js/data/skills.js', 'js/data/items.js', 'js/data/tree.js', 'js/data/content.js', 'js/data/endgame.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (cached) { e.waitUntil(network); return cached; }
    const res = await network;
    if (res) return res;
    if (req.mode === 'navigate') return cache.match('index.html');
    return Response.error();
  }));
});
