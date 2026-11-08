import { h } from './dom.js';
import { state, setState } from '../core/store.js';
import * as settings from '../core/settings.js';
import * as fh from '../core/filehandles.js';
import { pickAndRemember } from '../core/sources.js';
import { deviceRefresh } from '../core/devicesync.js';
import { multiImportButton, summarize as summarizeImport } from './import-button.js';
import { render } from '../core/router.js';
import { fmtDateTime } from '../core/format.js';

/** Dateiauswahl öffnen (im Ordner der zuletzt gewählten Datei), importieren und merken. */
async function choose() {
  const results = await pickAndRemember();
  if (results) setState({ importNote: summarizeImport(results) });
  render();
}

/**
 * „Daten aktualisieren“: Erst werden die gemerkten Dateien direkt gelesen. Verweigert das Gerät das (Chrome auf Android),
 * öffnet sich sofort die Dateiauswahl im gleichen Ordner. Dort genügt es, die geänderten Dateien zu wählen.
 */
async function smartUpdate() {
  if (settings.get('permDenied') === '1') return choose(); // bekannt: direkt wählen (Tipp-Aktivierung bleibt erhalten)
  const r = await deviceRefresh({ interactive: true, quiet: true });
  if (r?.denied || r?.needPermission) return choose();
  if (r) setState({ importNote: { lines: r.results.map((x) => (x.ok ? `✓ ${x.name} aktualisiert` : x.unchanged ? `– ${x.name} unverändert` : `✕ ${x.name}: ${x.error}`)), error: r.results.some((x) => x.ok === false) } });
  render();
}

/** Aktionen zum Aktualisieren der Daten auf der Startseite (je nach Browser-Unterstützung). */
export function updateBox() {
  if (!fh.isSupported()) {
    return h('div', { class: 'update-box' },
      multiImportButton({ label: 'Daten aktualisieren', cls: 'btn btn-wide' }),
      h('p', { class: 'hint' }, 'Wähle eine oder mehrere CSV-Dateien aus (auch direkt aus OneDrive). Die Art der Datei wird erkannt.'));
  }
  const imported = Number(settings.get('importedAt', '0'));
  const stand = imported ? ` Zuletzt aktualisiert: ${fmtDateTime(imported)}.` : '';
  if (!state.deviceFiles.length) {
    return h('div', { class: 'update-box' },
      h('button', { class: 'btn btn-wide', type: 'button', onclick: choose }, 'Dateien auswählen'),
      h('p', { class: 'hint' }, `Wähle die CSV-Dateien aus (auch direkt aus OneDrive). Die Art der Datei wird erkannt.${stand}`));
  }
  return h('div', { class: 'update-box' },
    h('button', { class: 'btn btn-wide', type: 'button', onclick: smartUpdate }, 'Daten aktualisieren'),
    h('p', { class: 'hint' }, `Wähle im Dialog die geänderten Dateien aus (meist nur die Ist-Datei). Der Dialog öffnet im gleichen Ordner wie zuletzt.${stand}`));
}
