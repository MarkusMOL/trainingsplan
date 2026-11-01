import { h } from './dom.js';
import { setState } from '../core/store.js';
import { importFiles } from '../core/sources.js';
import { dataset } from '../core/datasets.js';
import { render } from '../core/router.js';

/** Fasst das Ergebnis eines Mehrfach-Imports als Hinweis zusammen. */
export function summarize(results) {
  const lines = results.map((r) => (r.ok ? `✓ ${dataset(r.id).label}: ${r.name}` : `✕ ${r.name}: ${r.error}`));
  return { lines, error: results.some((r) => !r.ok) };
}

/** Button, der den Dateiauswahldialog (mehrere CSV-Dateien) öffnet und alles importiert. */
export function multiImportButton({ label = 'Dateien aktualisieren', cls = 'btn' } = {}) {
  const input = h('input', {
    type: 'file', accept: '.csv,text/csv,text/plain', multiple: true, hidden: true,
    onchange: async (e) => {
      const files = [...e.target.files];
      e.target.value = '';
      if (!files.length) return;
      setState({ importNote: summarize(await importFiles(files)) });
      render();
    },
  });
  return h('span', { style: { display: 'contents' } }, h('button', { class: cls, type: 'button', onclick: () => input.click() }, label), input);
}

/** Banner mit dem Ergebnis des letzten Imports (wird danach gelöscht). */
export function importNoteBanner(note) {
  if (!note) return null;
  return h('div', { class: 'banner' + (note.error ? ' banner-error' : ''), role: 'status' }, note.lines.map((l) => h('div', {}, l)));
}
