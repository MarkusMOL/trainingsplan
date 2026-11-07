import { h } from '../ui/dom.js';
import { appBar } from '../ui/appbar.js';
import { state, setState } from '../core/store.js';
import * as settings from '../core/settings.js';
import { getTheme, setTheme } from '../core/theme.js';
import { importFile, clearImports, reload, forgetDeviceFiles } from '../core/sources.js';
import { DATASETS } from '../core/datasets.js';
import { parseISODate, mondayOf, toISODate } from '../core/plan.js';
import { render } from '../core/router.js';
import { fmtLongDate, fmtShortDate, fmtDateTime } from '../core/format.js';
import * as od from '../core/onedrive.js';
import { syncNow } from '../core/sync.js';
import { multiImportButton, importNoteBanner } from '../ui/import-button.js';
import { APP_VERSION } from '../core/config.js';

let flash = null; // Meldung, die nach dem Neuaufbau der Seite angezeigt wird

const KIND = { import: ' (importiert)', onedrive: ' (OneDrive)', bundled: '' };
function infoFor(id) {
  const src = state.sources[id];
  if (!src) return id === 'plan' && state.error ? state.error : 'Keine Datei geladen.';
  const tail = `${src.name}${KIND[src.kind] ?? ''}`;
  if (id === 'plan') return `${state.plan.weeks.length} Wochen · ${state.plan.sessionCount} Einheiten · ${tail}`;
  if (id === 'ist') return `${state.ist.entries.length} Einheiten${state.ist.lastDate ? ` · zuletzt ${fmtShortDate(state.ist.lastDate)}` : ''} · ${tail}`;
  if (id === 'hist') return `${state.history.years.length} Jahre (${state.history.years[0].year}–${state.history.years.at(-1).year}) · ${tail}`;
  return tail;
}

export default {
  mount(root) {
    const note = state.importNote;
    setState({ importNote: null });
    const status = h('p', { class: 'status', role: 'status' });
    const say = (msg, isError = false) => { status.textContent = msg; status.className = 'status' + (isError ? ' status-error' : ''); };
    if (flash) { say(flash.msg, flash.isError); flash = null; }

    // Ein Import: prüfen, speichern, alles neu laden, Seite neu aufbauen
    const importer = (id, label) => async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        await importFile(id, file);
        await reload();
        flash = { msg: `${label} importiert: „${file.name}“.` };
      } catch (err) {
        flash = { msg: `${label}-Import fehlgeschlagen: ${err.message}`, isError: true };
      }
      render();
    };

    // --- Plan-Start (nur nötig, wenn der Plan keine Wochendaten enthält) ---
    let startCard = null;
    if (state.plan?.hasDates) {
      const first = state.plan.byWeek.get(state.plan.firstWeek).start;
      startCard = h('section', { class: 'card' }, h('h2', {}, 'Plan-Start'),
        h('p', { class: 'hint', style: { margin: '0' } }, `Laut Plan-CSV beginnt Woche ${state.plan.firstWeek} am ${fmtLongDate(first)}.`));
    } else if (state.plan) {
      const hint = h('p', { class: 'hint' });
      const showHint = () => {
        const ms = parseISODate(settings.get('startDate'));
        hint.textContent = ms === null
          ? 'Der Plan enthält keine Wochendaten. Ohne Startdatum zeigt „Aktuelle Woche“ die zuletzt angesehene Woche.'
          : `Woche ${state.plan.firstWeek} beginnt am ${fmtLongDate(mondayOf(ms))}.`;
      };
      startCard = h('section', { class: 'card' }, h('h2', {}, 'Plan-Start'),
        h('label', { for: 'start' }, 'Datum der ersten Trainingswoche'),
        h('input', {
          type: 'date', id: 'start', value: settings.get('startDate', ''),
          onchange: (e) => {
            const ms = parseISODate(e.target.value);
            if (ms === null) settings.remove('startDate'); else settings.set('startDate', toISODate(mondayOf(ms)));
            e.target.value = settings.get('startDate', '');
            showHint();
          },
        }), hint);
      showHint();
    }

    // --- OneDrive ---
    const cfg = od.getConfig();
    const field = (label, key, value, placeholder) => {
      const input = h('input', { type: 'text', id: key, value, placeholder, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
      return { key, input, el: h('div', { class: 'field' }, h('label', { for: key }, label), input) };
    };
    const fClient = field('Anwendungs-(Client-)ID der Azure-App', 'odClientId', cfg.clientId, '00000000-0000-0000-0000-000000000000');
    const fPaths = DATASETS.map((ds) => field(`Pfad: ${ds.label} (ab OneDrive-Stamm)`, ds.odKey, cfg.paths[ds.id], ds.example));
    const saveFields = () => { for (const f of [fClient, ...fPaths]) settings.set(f.key, f.input.value.trim()); };
    const signedIn = od.isSignedIn();
    const lastSync = Number(settings.get('odSyncedAt', '0'));
    const odStatus = !od.isConfigured() ? 'Noch nicht eingerichtet. Leere Pfade werden nicht abgeglichen.'
      : !signedIn ? 'Nicht angemeldet.'
      : state.sync?.authNeeded ? 'Anmeldung abgelaufen – bitte neu anmelden.'
      : lastSync ? `Angemeldet. Letzter Abgleich: ${fmtDateTime(lastSync)}.` : 'Angemeldet. Noch nicht abgeglichen.';
    const odCard = !od.isSupported()
      ? h('section', { class: 'card' }, h('h2', {}, 'OneDrive'),
          h('p', { class: 'hint', style: { margin: '0' } }, 'Die OneDrive-Anbindung funktioniert nur in der veröffentlichten App (https://…), nicht in einer lokal geöffneten Datei.'))
      : h('section', { class: 'card' }, h('h2', {}, 'OneDrive'),
          fClient.el, fPaths.map((f) => f.el),
          h('p', { class: 'hint', style: { marginTop: '0' } }, 'Basisdaten und WK-Kalender dürfen auch in einer gemeinsamen Datei stehen (Spalten: Typ;Datum;Name). Dann trägst du nur den Pfad bei „Basisdaten“ ein.'),
          h('div', { class: 'field' }, h('label', { for: 'odRedirect' }, 'Weiterleitungs-URI (in der Azure-App eintragen)'),
            h('input', { type: 'text', id: 'odRedirect', value: od.redirectUri(), readonly: true, onfocus: (e) => e.target.select() })),
          h('p', { class: 'hint' }, odStatus),
          h('div', { class: 'btn-row' },
            h('button', {
              class: 'btn', type: 'button',
              onclick: async () => { saveFields(); try { await od.signIn(); } catch (err) { flash = { msg: err.message, isError: true }; render(); } },
            }, signedIn ? 'Neu anmelden' : 'Bei OneDrive anmelden'),
            signedIn ? h('button', {
              class: 'btn btn-ghost', type: 'button',
              onclick: async () => { saveFields(); await syncNow({ force: true }); flash = { msg: state.sync?.errors?.length ? state.sync.errors.join(' · ') : 'Abgleich abgeschlossen.', isError: Boolean(state.sync?.errors?.length) }; render(); },
            }, 'Jetzt abgleichen') : null,
            signedIn ? h('button', {
              class: 'btn btn-ghost', type: 'button',
              onclick: async () => { od.signOut(); await reload(); flash = { msg: 'Abgemeldet. Die lokalen OneDrive-Kopien wurden gelöscht.' }; render(); },
            }, 'Abmelden') : null));

    // --- Design ---
    const themeBtns = [['auto', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([mode, label]) =>
      h('button', {
        type: 'button', 'aria-pressed': String(getTheme() === mode), 'data-mode': mode,
        onclick: () => { setTheme(mode); themeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode))); },
      }, label));

    // --- Daten je Datei ---
    const files = DATASETS.map((ds) => h('input', { type: 'file', accept: '.csv,text/csv,text/plain', hidden: true, onchange: importer(ds.id, ds.label) }));
    const dataCards = DATASETS.map((ds, i) => h('section', { class: 'card' },
      h('h2', {}, ds.label),
      h('p', { class: 'hint', style: { margin: '0' } }, infoFor(ds.id)),
      ds.id === 'ist' && state.ist?.sportInferred > 0
        ? h('p', { class: 'hint' }, `Hinweis: Bei ${state.ist.sportInferred} Einheit(en) fehlt die Sportart in der Datei. Sie wird aus der Reihenfolge der Blöcke abgeleitet.`) : null,
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick: () => files[i].click() }, `${ds.label}-CSV importieren`))));

    const hasImport = Object.values(state.sources).some((s) => s?.kind === 'import');

    root.append(h('div', { class: 'screen' },
      appBar({ title: 'Einstellungen', backHref: '#/' }),
      h('main', { class: 'content' },
        importNoteBanner(note),
        startCard,
        odCard,
        h('section', { class: 'card' }, h('h2', {}, 'Design'),
          h('div', { class: 'segmented', role: 'group', 'aria-label': 'Design' }, themeBtns)),
        h('section', { class: 'card' }, h('h2', {}, 'Alle Dateien auf einmal'),
          h('p', { class: 'hint', style: { margin: '0 0 12px' } }, 'Mehrere CSV-Dateien gleichzeitig auswählen, zum Beispiel direkt aus OneDrive. Die App erkennt, welche Datei welche ist.'),
          multiImportButton({ label: 'Dateien auswählen und importieren' })),
        state.deviceFiles.length
          ? h('section', { class: 'card' }, h('h2', {}, 'Gemerkte Dateien'),
              h('p', { class: 'hint', style: { margin: '0 0 12px' } }, `${state.deviceFiles.map((f) => f.name).join(', ')}. Diese Dateien liest die App bei jedem Öffnen neu.`),
              h('button', { class: 'btn btn-ghost', type: 'button', onclick: async () => { await forgetDeviceFiles(); flash = { msg: 'Gemerkte Dateien vergessen. Importierte Daten bleiben erhalten.' }; render(); } }, 'Gemerkte Dateien vergessen'))
          : null,
        dataCards,
        h('section', { class: 'card' },
          h('div', { class: 'btn-row', style: { marginTop: '0' } },
            h('button', {
              class: 'btn btn-ghost', type: 'button', disabled: !hasImport,
              onclick: async () => {
                clearImports();
                await reload();
                flash = state.error ? { msg: state.error, isError: true } : { msg: 'Importierte Dateien entfernt.' };
                render();
              },
            }, 'Importierte Dateien entfernen')),
          files, status),
        h('p', { class: 'footnote' }, `Trainingsplan v${APP_VERSION}`))));
  },
};
