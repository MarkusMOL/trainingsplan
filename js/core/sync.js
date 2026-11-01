// OneDrive-Abgleich: lädt beide CSV-Dateien, legt sie lokal ab (Offline-Kopie) und aktualisiert die Ansicht.
import * as settings from './settings.js';
import { state, setState } from './store.js';
import { SYNC } from './config.js';
import { getConfig, isConfigured, isSupported, isSignedIn, fetchCsv, AuthRequiredError } from './onedrive.js';
import { reload } from './sources.js';
import { DATASETS } from './datasets.js';
import { render } from './router.js';

export const syncEnabled = () => isConfigured() && isSupported();

let running = false; // Sperre gegen parallele Abgleiche (state.syncing ist nur die Anzeige)

const fingerprint = () => JSON.stringify([...DATASETS.map((d) => settings.get(d.cache)), state.sync]);

/**
 * Gleicht beide Dateien mit OneDrive ab.
 * force=false beachtet den Mindestabstand (SYNC.minIntervalMin) – gedacht für „App wieder im Vordergrund“.
 * Die Ansicht wird nur neu aufgebaut, wenn sich Daten oder Status geändert haben (oder force gesetzt ist).
 */
export async function syncNow({ force = false } = {}) {
  if (!syncEnabled() || running) return;
  if (!force && Date.now() - Number(settings.get('odTry', '0')) < SYNC.minIntervalMin * 60000) return;
  settings.set('odTry', String(Date.now()));
  running = true;
  setState({ syncing: true });
  const before = fingerprint();

  const sync = { authNeeded: false, errors: [] };
  try {
    const cfg = getConfig();
    if (!isSignedIn()) {
      sync.authNeeded = true;
    } else {
      let any = false;
      for (const ds of DATASETS) {
        const path = cfg.paths[ds.id];
        if (!path) continue;
        try {
          settings.set(ds.cache, await fetchCsv(path));
          any = true;
        } catch (e) {
          if (e instanceof AuthRequiredError) { sync.authNeeded = true; break; }
          sync.errors.push(`${ds.label}: ${e.message}`);
        }
      }
      if (any) settings.set('odSyncedAt', String(Date.now()));
    }

  } catch (e) {
    sync.errors.push(e.message);
  } finally {
    running = false;
  }

  setState({ syncing: false, sync });
  await reload();
  if (force || fingerprint() !== before) render();
}
