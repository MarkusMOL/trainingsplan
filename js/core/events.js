// Termine: Saisonbeginn/-ende, Hauptrennen (Race A1/A2) und Wettkampfkalender. Keine DOM-Zugriffe.
// Unterstützte Zeilenformate (mit oder ohne Kopfzeile, Trenner ; , Tab):
//   Basisdaten:    Saisonbeginn;01.11.2025;            Race A1;05.07.2026;Beispiel-Triathlon
//   WK-Kalender:   1;15.03.2026;Beispiellauf
//   Gemeinsam:     Typ;Datum;Name  mit Typ = Saisonbeginn | Saisonende | Race A1 | Race A2 | WK
import { parseCsv } from './csv.js';
import { DAY_MS, clean, parseDate, todayUTC } from './plan.js';

const KINDS = [[/^saisonbeginn$/, 'SB'], [/^saisonende$/, 'SE'], [/^racea1$/, 'A1'], [/^racea2$/, 'A2']];
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** CSV-Text -> Liste einzelner Termine [{kind: 'SB'|'SE'|'A1'|'A2'|'WK', date, name}]. Zeilen ohne Datum werden ignoriert. */
export function parseEventRows(text) {
  const out = [];
  for (const row of parseCsv(text)) {
    const cells = row.map(clean);
    const di = cells.findIndex((c) => parseDate(c) !== null);
    if (di < 0) continue; // Kopfzeile, leere Platzhalter (z. B. "11;;")
    const key = norm(cells[0] ?? '');
    const kind = KINDS.find(([re]) => re.test(key))?.[1] ?? 'WK';
    out.push({ kind, date: parseDate(cells[di]), name: cells.slice(di + 1).find(Boolean) ?? '' });
  }
  if (!out.length) throw new Error('Keine Termine gefunden (es fehlt eine Spalte mit Datum).');
  return out;
}

/** Mehrere Quellen zusammenführen. Wettkämpfe am Tag eines Hauptrennens werden nicht doppelt geführt. */
export function buildEvents(entries) {
  const first = (k) => entries.find((e) => e.kind === k) ?? null;
  const races = entries.filter((e) => e.kind === 'A1' || e.kind === 'A2').map((e) => ({ ...e }));
  const raceDates = new Set(races.map((r) => r.date));
  for (const r of races) if (!r.name) r.name = entries.find((e) => e.kind === 'WK' && e.date === r.date)?.name ?? '';
  const wk = entries.filter((e) => e.kind === 'WK' && !raceDates.has(e.date));
  return {
    seasonStart: first('SB')?.date ?? null,
    seasonEnd: first('SE')?.date ?? null,
    a1: races.find((r) => r.kind === 'A1') ?? null,
    a2: races.find((r) => r.kind === 'A2') ?? null,
    list: [...races, ...wk].sort((a, b) => a.date - b.date), // Hauptrennen + Wettkämpfe, nach Datum
  };
}

/** Termine im Zeitraum [from, to] (UTC-ms), inkl. Saisonbeginn/-ende. */
export function eventsInRange(ev, from, to) {
  if (!ev) return [];
  const out = ev.list.filter((e) => e.date >= from && e.date <= to);
  if (ev.seasonStart !== null && ev.seasonStart >= from && ev.seasonStart <= to) out.push({ kind: 'SB', date: ev.seasonStart, name: '' });
  if (ev.seasonEnd !== null && ev.seasonEnd >= from && ev.seasonEnd <= to) out.push({ kind: 'SE', date: ev.seasonEnd, name: '' });
  return out.sort((a, b) => a.date - b.date);
}

export const daysUntil = (ms, today = todayUTC()) => Math.round((ms - today) / DAY_MS);

/** Nächster Termin ab heute (heute eingeschlossen); mit kinds auf bestimmte Arten einschränkbar. */
export function nextEvent(ev, today = todayUTC(), kinds = null) {
  return ev?.list.find((e) => e.date >= today && (!kinds || kinds.includes(e.kind))) ?? null;
}

export const isRace = (e) => e.kind === 'A1' || e.kind === 'A2';
export const raceLabel = (e) => (e.kind === 'A1' ? 'Race A1' : e.kind === 'A2' ? 'Race A2' : e.kind === 'SB' ? 'Saisonbeginn' : e.kind === 'SE' ? 'Saisonende' : 'Wettkampf');
