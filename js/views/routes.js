// Routen-Tabelle. Neue Ansicht = neues Modul in views/ + Eintrag hier (+ ggf. Kachel in tiles/registry.js).
// Der erste Eintrag ist zugleich die Standardroute.
import home from './home.js';
import week from './week.js';
import compare from './compare.js';
import events from './events.js';
import stats from './stats.js';
import years from './years.js';
import settings from './settings.js';

export const routes = [
  { pattern: /^\/?$/, view: home },
  { pattern: /^\/week(?:\/(\d+))?$/, view: week },
  { pattern: /^\/compare(?:\/(\d+))?$/, view: compare },
  { pattern: /^\/events$/, view: events },
  { pattern: /^\/stats(?:\/(\d+))?$/, view: stats },
  { pattern: /^\/years$/, view: years },
  { pattern: /^\/settings$/, view: settings },
];
