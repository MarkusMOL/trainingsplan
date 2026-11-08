// Abgleich mit den gemerkten Geräte-Dateien (z. B. aus OneDrive gewählt): beim Start und bei Rückkehr in die App.
import * as settings from './settings.js';
import { state, setState } from './store.js';
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
    const r = await refreshFromHandles({ interactive, list: interactive ? state.deviceFiles : null });
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


/** Diagnose für die Einstellungen: Zugriffsstatus jeder gemerkten Datei (nur aus einem Tipp heraus aufrufen). */
export async function diagnoseDeviceFiles() {
  const lines = [];
  for (const f of state.deviceFiles) {
    let q = '?', r = '';
    try { q = await f.handle.queryPermission({ mode: 'read' }); } catch (e) { q = `Fehler ${e.name}`; }
    if (q !== 'granted') { try { r = await f.handle.requestPermission({ mode: 'read' }); } catch (e) { r = `Fehler ${e.name}`; } }
    let g;
    try { const file = await f.handle.getFile(); g = `lesbar (${file.size} Byte)`; } catch (e) { g = `nicht lesbar (${e.name})`; }
    lines.push(`${f.name}: Status ${q}${r ? `, nach Anfrage ${r}` : ''}; ${g}`);
  }
  return lines;
}
