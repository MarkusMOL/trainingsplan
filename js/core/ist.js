// Ist-Daten (absolvierte Einheiten) einlesen und den Planwochen zuordnen. Keine DOM-Zugriffe.
import { parseCsv } from './csv.js';
import { DAY_MS, clean, mapColumns, parseDate, toMinutes, zeroToEmpty } from './plan.js';

const IST_COLUMNS = [
  { key: 'date',    match: /^datum/,          required: true, label: 'Datum' },
  { key: 'phase',   match: /^trainingsphase/ },
  { key: 'week',    match: /^trainingswoche/ },
  { key: 'sport',   match: /^sportart/ },
  { key: 'regKey',  match: /^regkey/,         required: true, label: 'Reg/Key' },
  { key: 'abc',     match: /^abc/,            required: true, label: 'A/B/C' },
  { key: 'goal',    match: /^trainingsziel/ },
  { key: 'minutes', match: /^zeit/,           required: true, label: 'Zeit' },
  { key: 'program', match: /^programm/ },
];

function weekOfDate(plan, ms) {
  return plan.weeks.find((w) => w.start != null && ms >= w.start && ms < w.start + 7 * DAY_MS)?.week;
}

/**
 * Ist-CSV -> { entries, byWeek, sportInferred, skipped, lastDate }.
 *
 * Zuordnung zu einer Planeinheit: Woche (über "Trainingsphase III", sonst Wochenspalte, sonst Datum)
 * + Sportart + Reg/Key + A/B/C.
 *
 * Sportart: Steht in der Spalte "Sportart" ein bekannter Wert (z. B. Swim), wird er verwendet.
 * Sonst (aktuelle Excel-Ausgabe: dort stehen A/B/C-Werte) wird sie aus der Blockreihenfolge der Datei
 * abgeleitet: Die Datei besteht aus Blöcken je Sportart in der Reihenfolge der Plan-Datei, getrennt durch
 * Zeilen mit ungültigem Datum ("00.01.1900") und Nullen.
 * Komplett leere Zeilen und Zeilen ohne Datum/Zeit werden ignoriert.
 */
export function parseIst(text, plan) {
  const table = parseCsv(text);
  if (table.length < 2) throw new Error('Die Ist-Datei enthält keine Datenzeilen.');
  const idx = mapColumns(table[0], IST_COLUMNS);
  const sportByLower = new Map(plan.sportOrder.map((s) => [s.toLowerCase(), s]));
  const weekByPhase = new Map(plan.weeks.filter((w) => w.phaseRaw).map((w) => [w.phaseRaw, w.week]));

  const entries = [];
  let block = 0, sportInferred = 0, skipped = 0;

  for (const r of table.slice(1)) {
    const cell = (key) => (key in idx ? clean(r[idx[key]]) : '');
    if (!r.some((c) => clean(c) !== '')) continue; // komplett leer

    const date = parseDate(cell('date'));
    const minutes = toMinutes(cell('minutes'));
    const regKey = zeroToEmpty(cell('regKey'));
    const abc = zeroToEmpty(cell('abc'));

    if (date === null) { block++; continue; } // Trennzeile zwischen den Sportart-Blöcken
    if (minutes <= 0 || !regKey || !abc) continue; // keine sinnvolle Einheit

    let sport = sportByLower.get(cell('sport').toLowerCase());
    const inferred = !sport;
    if (inferred) sport = plan.sportOrder[block];
    if (!sport) { skipped++; continue; }

    let week = weekByPhase.get(cell('phase'));
    if (week === undefined) {
      const n = parseInt(cell('week'), 10);
      week = plan.byWeek.has(n) ? n : weekOfDate(plan, date);
    }
    if (week === undefined) { skipped++; continue; }

    if (inferred) sportInferred++;
    entries.push({ date, week, sport, regKey, abc, goal: zeroToEmpty(cell('goal')), minutes, program: zeroToEmpty(cell('program')) });
  }

  entries.sort((a, b) => a.date - b.date);
  const byWeek = new Map();
  for (const e of entries) {
    if (!byWeek.has(e.week)) byWeek.set(e.week, []);
    byWeek.get(e.week).push(e);
  }
  return { entries, byWeek, sportInferred, skipped, lastDate: entries.length ? entries[entries.length - 1].date : null };
}
