// Abgleich mit den gemerkten Geräte-Dateien (z. B. aus OneDrive gewählt): beim Start und bei Rückkehr in die App.
import * as settings from './settings.js';
import { setState } from './store.js';
import { SYNC } from './config.js';
import { dataset } from './datasets.js';
import * as fh from './filehandles.js';
import { refreshFromHandles } from './sources.js';
import { render } from './router.js';

let running = false;

export function summarizeRefresh(r) {
  const lines = r.results.map((x) => {
    const label = dataset(x.id).label;
    return x.ok ? `✓ ${label} aktualisiert: ${x.name}` : x.unchanged ? `– ${label} unverändert` : `✕ ${label}: ${x.error}`;
  });
  if (r.needPermission) lines.push('Für einige Dateien fehlt noch die Freigabe.');
  return { lines, error: r.results.some((x) => x.ok === false) || r.needPermission };
}

/**
 * force=false beachtet den Mindestabstand; interactive=true nur aus einem Tipp heraus (darf Freigabe anfragen).
 * Die Ansicht wird nur neu aufgebaut, wenn sich etwas geändert hat oder eine Freigabe fehlt.
 */
export async function deviceRefresh({ force = false, interactive = false } = {}) {
  if (!fh.isSupported() || running) return null;
  if (!force && !interactive && Date.now() - Number(settings.get('devTry', '0')) < SYNC.minIntervalMin * 60000) return null;
  running = true;
  try {
    settings.set('devTry', String(Date.now()));
    const r = await refreshFromHandles({ interactive });
    if (r.results.length || r.needPermission) settings.set('devCheckedAt', String(Date.now()));
    setState({ fileAccessNeeded: r.needPermission });
    if (interactive) setState({ importNote: summarizeRefresh(r) });
    if (r.changed || r.needPermission || interactive) render();
    return r;
  } catch (e) {
    console.warn('Abgleich der gemerkten Dateien fehlgeschlagen', e);
    return null;
  } finally {
    running = false;
  }
}

