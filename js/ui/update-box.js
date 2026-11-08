import { h } from './dom.js';
import { state, setState } from '../core/store.js';
import * as settings from '../core/settings.js';
import * as fh from '../core/filehandles.js';
import { pickAndRemember } from '../core/sources.js';
import { deviceRefresh } from '../core/devicesync.js';
import { multiImportButton, summarize as summarizeImport } from './import-button.js';
import { render } from '../core/router.js';
import { fmtDateTime } from '../core/format.js';

/** Aktionen zum Aktualisieren der Daten auf der Startseite (je nach Browser-Unterstützung). */
export function updateBox() {
  if (!fh.isSupported()) {
    return h('div', { class: 'update-box' },
      multiImportButton({ label: 'Daten aktualisieren', cls: 'btn btn-wide' }),
      h('p', { class: 'hint' }, 'Wähle eine oder mehrere CSV-Dateien aus (auch direkt aus OneDrive). Die Art der Datei wird erkannt.'));
  }
  const files = state.deviceFiles;
  const checked = Number(settings.get('devCheckedAt', '0'));

  const choose = async () => {
    const results = await pickAndRemember();
    if (results) setState({ importNote: summarizeImport(results), fileAccessNeeded: false });
    render();
  };

  if (!files.length) {
    return h('div', { class: 'update-box' },
      h('button', { class: 'btn btn-wide', type: 'button', onclick: choose }, 'Dateien auswählen und merken'),
      h('p', { class: 'hint' }, 'Einmal die CSV-Dateien auswählen (auch direkt aus OneDrive). Danach liest die App sie bei jedem Öffnen selbst, ohne erneute Auswahl.'));
  }
  return h('div', { class: 'update-box' },
    h('button', { class: 'btn btn-wide', type: 'button', onclick: () => deviceRefresh({ interactive: true }) }, 'Daten aktualisieren'),
    h('button', { class: 'btn btn-ghost btn-wide', type: 'button', style: { marginTop: '8px' }, onclick: choose }, 'Dateien neu wählen (öffnet im gleichen Ordner)'),
    h('p', { class: 'hint' }, `Gemerkt: ${files.map((f) => f.name).join(', ')}.${checked ? ` Zuletzt geprüft: ${fmtDateTime(checked)}.` : ''}`));
}
