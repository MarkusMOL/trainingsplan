// Vorjahre: absolvierte Einheiten früherer Trainingsjahre, bezogen auf das jeweilige Race A1. Keine DOM-Zugriffe.
// Je Jahr gibt es eine Zeile "Start" (Saisonbeginn) und eine Zeile "RACE A1" (Renntag). Andere Zeilen mit Sportart
// Swim/Bike/Run/Athletik sind Einheiten. Zeilen mit Jahr 0 oder ungültigem Datum werden ignoriert.
import { parseCsv } from './csv.js';
import { DAY_MS, clean, mapColumns, parseDate, toMinutes } from './plan.js';

const COLUMNS = [
  { key: 'year',    match: /^trainingsjahr/, required: true, label: 'Trainingsjahr' },
  { key: 'date',    match: /^datum/,         required: true, label: 'Datum' },
  { key: 'sport',   match: /^sportart/,      required: true, label: 'Sportart' },
  { key: 'minutes', match: /^zeit/,          required: true, label: 'Zeit' },
  { key: 'km',      match: /^distanz/ },
  { key: 'phase',   match: /^phase/ },
];

const toKm = (v) => { const n = parseFloat(clean(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };

/**
 * -> { years: [{ year, start, race, sessions: [{ date, off, sport, minutes, km, phase }] }] }
 * off = Tage bis zum Renntag (positiv = davor, 0 = Renntag, negativ = danach).
 */
export function parseHistory(text) {
  const table = parseCsv(text);
  if (table.length < 2) throw new Error('Die Datei enthält keine Datenzeilen.');
  const idx = mapColumns(table[0], COLUMNS);
  const get = (r, k) => (k in idx ? clean(r[idx[k]]) : '');

  const byYear = new Map();
  for (const r of table.slice(1)) {
    const year = parseInt(get(r, 'year'), 10);
    const date = parseDate(get(r, 'date'));
    if (!Number.isInteger(year) || year < 1990 || date === null) continue;
    if (!byYear.has(year)) byYear.set(year, { year, start: null, race: null, sessions: [] });
    const y = byYear.get(year);
    const sport = get(r, 'sport');
    const key = sport.toLowerCase();
    if (key === 'start') y.start = date;
    else if (key === 'race a1') y.race = date;
    else if (sport && sport !== '0') {
      const minutes = toMinutes(get(r, 'minutes'));
      if (minutes > 0) y.sessions.push({ date, sport, minutes, km: toKm(get(r, 'km')), phase: get(r, 'phase') });
    }
  }
  const years = [...byYear.values()]
    .filter((y) => y.race !== null && y.sessions.length) // ohne Renntag keine Ausrichtung möglich
    .sort((a, b) => a.year - b.year);
  if (!years.length) throw new Error('Keine auswertbaren Trainingsjahre gefunden (Zeile „RACE A1“ fehlt?).');
  for (const y of years) {
    for (const s of y.sessions) s.off = Math.round((y.race - s.date) / DAY_MS);
    y.startOff = y.start !== null ? Math.round((y.race - y.start) / DAY_MS) : Math.max(...y.sessions.map((s) => s.off));
  }
  return { years };
}
