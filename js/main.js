import { initTheme } from './core/theme.js';
import { setState } from './core/store.js';
import { reload } from './core/sources.js';
import { handleRedirect } from './core/onedrive.js';
import { syncNow, syncEnabled } from './core/sync.js';
import * as router from './core/router.js';
import { routes } from './views/routes.js';

initTheme();

// Rückkehr von der Microsoft-Anmeldeseite (?code=…) verarbeiten, bevor irgendetwas angezeigt wird
const login = await handleRedirect();
if (login && !login.ok) setState({ authError: login.error });

// Sofort mit den lokal vorhandenen Daten starten (zuletzt geladene OneDrive-Kopie), Abgleich läuft danach
setState({ syncing: syncEnabled() });
await reload();
router.addRoutes(routes);
router.start(document.getElementById('app'));

if (syncEnabled()) {
  syncNow({ force: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
  window.addEventListener('online', () => syncNow({ force: true }));
} else {
  setState({ syncing: false });
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service Worker:', e));
}
