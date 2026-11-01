// Service Worker: App-Shell offline verfügbar.
// Bei Änderungen an Dateien VERSION erhöhen, damit installierte Apps den neuen Stand holen.
const VERSION = 'v6';
const CACHE = `trainingsplan-${VERSION}`;
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css',
  './js/main.js',
  './js/core/compare.js', './js/core/config.js', './js/core/csv.js', './js/core/datasets.js', './js/core/events.js', './js/core/format.js', './js/core/history.js', './js/core/ist.js', './js/core/onedrive.js', './js/core/plan.js',
  './js/core/router.js', './js/core/settings.js', './js/core/sources.js', './js/core/stats.js', './js/core/store.js', './js/core/sync.js', './js/core/theme.js',
  './js/ui/appbar.js', './js/ui/charts.js', './js/ui/compare-card.js', './js/ui/dom.js', './js/ui/event-card.js', './js/ui/goal.js', './js/ui/icons.js', './js/ui/import-button.js', './js/ui/session-card.js', './js/ui/sheet.js',
  './js/ui/swipe.js', './js/ui/week-header.js', './js/ui/week-picker.js',
  './js/tiles/registry.js',
  './js/views/compare.js', './js/views/events.js', './js/views/home.js', './js/views/routes.js', './js/views/settings.js',
  './js/views/stats.js', './js/views/week.js', './js/views/years.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('trainingsplan-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

// Daten (CSV): erst Netz, dann Cache (so erscheinen aktualisierte Ist-Daten sofort). Alles andere: Cache sofort, im Hintergrund aktualisieren.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.endsWith('.csv')) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req)));
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
      return cached || network;
    }));
});
