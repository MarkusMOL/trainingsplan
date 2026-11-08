// Datenquellen. Reihenfolge je Datei: zuletzt von OneDrive geladene Kopie -> importierte CSV -> mitgelieferte CSV.
// Das Laden aus OneDrive selbst (Netzwerk) passiert in sync.js; hier wird nur gelesen und geparst.
import { decodeBytes } from './csv.js';
import { parsePlan, normHeader } from './plan.js';
import { parseIst } from './ist.js';
import { parseEventRows, buildEvents } from './events.js';
import { parseHistory } from './history.js';
import { DATASETS, dataset } from './datasets.js';
import * as settings from './settings.js';
import { getConfig, isConfigured } from './onedrive.js';
import * as fh from './filehandles.js';
import { state, setState } from './store.js';

// standalone.html liefert die Daten eingebettet mit (dort ist fetch() per file:// nicht möglich).
async function bundledText(ds) {
  const embedded = globalThis[ds.embedded];
  if (embedded) return embedded;
  try {
    const res = await fetch(ds.bundled, { cache: 'no-cache' });
    return res.ok ? decodeBytes(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** Erste Quelle, deren Text sich fehlerfrei parsen lässt. Fehler landen in warnings. */
async function firstValid(candidates, parse, warnings) {
  for (const c of candidates) {
    const text = await c.text();
    if (!text) continue;
    try {
      return { value: parse(text), source: c.source };
    } catch (e) {
      console.warn(`${c.label} ungültig`, e);
      warnings.push(`${c.label} ist ungültig (${e.message}) – es werden andere Daten verwendet.`);
    }
  }
  return null;
}

function candidates(ds) {
  const path = isConfigured() ? getConfig().paths[ds.id] : '';
  const list = [];
  if (path) {
    list.push({
      label: `Die OneDrive-Datei „${path}“`,
      source: { kind: 'onedrive', name: path, at: Number(settings.get('odSyncedAt', '0')) || null },
      text: async () => settings.get(ds.cache),
    });
  }
  list.push({
    label: `Die importierte Datei (${ds.label})`,
    source: { kind: 'import', name: settings.get(ds.impName, 'Import') },
    text: async () => settings.get(ds.imp),
  });
  list.push({
    label: `Die mitgelieferte Datei (${ds.label})`,
    source: { kind: 'bundled', name: ds.bundled.replace('data/', '') },
    text: () => bundledText(ds),
  });
  return list;
}

/** Liest alle Daten aus den lokal vorhandenen Quellen. Nur der Plan ist Pflicht; alles andere ergänzt die Auswertungen. */
export async function loadAll() {
  const out = {
    plan: null, source: null, error: null, ist: null, istSource: null, istError: null,
    events: null, history: null, sources: {}, warnings: [],
  };
  const planHit = await firstValid(candidates(dataset('plan')), parsePlan, out.warnings);
  if (!planHit) {
    out.error = 'Es sind noch keine Plandaten vorhanden. Verbinde OneDrive oder importiere die Plan-CSV in den Einstellungen.';
    return out;
  }
  out.plan = planHit.value;
  out.source = out.sources.plan = planHit.source;

  try {
    const hit = await firstValid(candidates(dataset('ist')), (t) => parseIst(t, out.plan), out.warnings);
    if (hit) { out.ist = hit.value; out.istSource = out.sources.ist = hit.source; }
  } catch (e) {
    console.error(e);
    out.istError = `Ist-Daten konnten nicht geladen werden: ${e.message}`;
  }

  // Termine: Basisdaten und WK-Kalender (getrennt oder in einer Datei) zusammenführen
  const entries = [];
  for (const id of ['basis', 'wk']) {
    const hit = await firstValid(candidates(dataset(id)), parseEventRows, out.warnings);
    if (hit) { entries.push(...hit.value); out.sources[id] = hit.source; }
  }
  if (entries.length) out.events = buildEvents(entries);

  const hist = await firstValid(candidates(dataset('hist')), parseHistory, out.warnings);
  if (hist) { out.history = hist.value; out.sources.hist = hist.source; }
  return out;
}

export async function reload() {
  setState(await loadAll());
}

// ---- Import (prüft zuerst, speichert erst bei gültigen Daten) ----
const VALIDATE = {
  plan: (text) => parsePlan(text),
  ist: (text) => parseIst(text, state.plan ?? (() => { throw new Error('Bitte zuerst einen gültigen Plan laden.'); })()),
  basis: parseEventRows,
  wk: parseEventRows,
  hist: parseHistory,
};

function saveImport(id, text, name) {
  const ds = dataset(id);
  VALIDATE[id](text); // wirft bei ungültigen Daten, bevor etwas gespeichert wird
  if (!settings.set(ds.imp, text)) throw new Error('Speichern im Browser nicht möglich (Speicher voll oder blockiert).');
  settings.set(ds.impName, name);
  settings.set('importedAt', String(Date.now()));
}

export async function importFile(id, file) {
  saveImport(id, decodeBytes(await file.arrayBuffer()), file.name);
}

/** Erkennt anhand der Kopfzeile bzw. des Inhalts, um welche Datei es sich handelt. null = unbekannt. */
export function detectDataset(text) {
  const first = text.replace(/^\ufeff/, '').split(/\r?\n/, 1)[0] ?? '';
  const h = normHeader(first);
  if (h.includes('trainingsjahr')) return 'hist';
  if (h.includes('erstertag') || h.includes('standardtag')) return 'plan';
  if (h.includes('datum') && h.includes('regkey')) return 'ist';
  try {
    return parseEventRows(text).some((e) => e.kind !== 'WK') ? 'basis' : 'wk';
  } catch {
    return null;
  }
}

/**
 * Mehrere Dateien auf einmal importieren (Typ wird erkannt, Reihenfolge egal).
 * @returns {Promise<{name, id, ok, error?}[]>}
 */
export async function importFiles(files) {
  const items = [];
  for (const file of files) {
    const text = decodeBytes(await file.arrayBuffer());
    items.push({ name: file.name, text, id: detectDataset(text), handle: file.handle });
  }
  const order = ['plan', 'ist', 'basis', 'wk', 'hist'];
  items.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const results = [];
  for (const it of items) {
    if (!it.id) { results.push({ name: it.name, id: null, ok: false, error: 'Dateityp nicht erkannt' }); continue; }
    try {
      saveImport(it.id, it.text, it.name);
      if (it.handle) await fh.remember(it.id, it.handle).catch((e) => console.warn('Datei konnte nicht gemerkt werden', e));
      results.push({ name: it.name, id: it.id, ok: true });
      if (it.id === 'plan') await reload(); // Ist-Daten werden gegen den (neuen) Plan geprüft
    } catch (e) {
      results.push({ name: it.name, id: it.id, ok: false, error: e.message });
    }
  }
  await reload();
  return results;
}

export function clearImports() {
  for (const ds of DATASETS) { settings.remove(ds.imp); settings.remove(ds.impName); }
}

// ---- Gemerkte Geräte-Dateien (Dateiauswahl nur einmal) ----

/** Aktualisiert die Anzeige-Liste der gemerkten Dateien. */
export async function loadDeviceFiles() {
  const list = await fh.remembered();
  setState({ deviceFiles: list.map((e) => ({ id: e.id, name: e.handle.name, handle: e.handle })) });
}

/** Dateien über den Auswahldialog wählen, importieren und für später merken. */
export async function pickAndRemember() {
  const handles = await fh.pick(state.deviceFiles[0]?.handle ?? null);
  if (!handles.length) return null;
  const files = await Promise.all(handles.map(async (handle) => {
    const f = await handle.getFile();
    return { name: f.name, arrayBuffer: () => f.arrayBuffer(), handle };
  }));
  const results = await importFiles(files);
  await loadDeviceFiles();
  return results;
}

export async function forgetDeviceFiles() {
  await fh.forgetAll();
  await loadDeviceFiles();
}

/**
 * Liest alle gemerkten Dateien neu und übernimmt geänderte.
 * interactive=true (aus einem Tipp heraus) darf die Freigabe neu anfragen; sonst werden Dateien ohne Freigabe übersprungen.
 * list: bereits geladene Handles ([{id, handle}]); so beginnt die Freigabe-Anfrage direkt im Tipp, ohne vorherigen Datenbankzugriff.
 * Ist die Freigabe nicht erteilt, wird trotzdem versucht, die Datei zu lesen (manche Browser erlauben das).
 * @returns {Promise<{results: {id, ok?, unchanged?, error?, name?}[], needPermission: boolean, changed: boolean}>}
 */
export async function refreshFromHandles({ interactive = false, list = null } = {}) {
  const order = ['plan', 'ist', 'basis', 'wk', 'hist'];
  const items = (list ?? (await fh.remembered())).slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const results = [];
  let needPermission = false, changed = false;
  for (const { id, handle } of items) {
    const ds = dataset(id);
    if (!ds) continue;
    let perm = 'unbekannt', permError = null;
    try {
      try { perm = await handle.queryPermission({ mode: 'read' }); } catch (e) { permError = e.name; }
      if (perm !== 'granted' && interactive) {
        try { perm = await handle.requestPermission({ mode: 'read' }); } catch (e) { permError = e.name; }
      }
      let file;
      try {
        file = await handle.getFile();
      } catch (e) {
        if (perm === 'granted') throw e;
        needPermission = true;
        results.push({ id, ok: false, name: handle.name, error: `Freigabe fehlt (Status: ${perm}${permError ? `, ${permError}` : ''}; Lesen: ${e.name})` });
        continue;
      }
      const text = decodeBytes(await file.arrayBuffer());
      if (text === settings.get(ds.imp)) { results.push({ id, unchanged: true, name: file.name }); continue; }
      saveImport(id, text, file.name);
      changed = true;
      results.push({ id, ok: true, name: file.name });
      if (id === 'plan') await reload();
    } catch (e) {
      results.push({ id, ok: false, name: handle.name, error: e.name === 'NotFoundError' ? 'Datei nicht mehr vorhanden (verschoben oder gelöscht)' : `${e.name}: ${e.message}` });
    }
  }
  if (changed) await reload();
  return { results, needPermission, changed };
}
