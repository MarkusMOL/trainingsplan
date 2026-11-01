// Fachlogik: CSV-Tabelle -> Plan-Modell (Wochen, Einheiten, Summen). Keine DOM-Zugriffe.
import { parseCsv } from './csv.js';
import { SPORTS, DAY_ORDER } from './config.js';

export const DAY_MS = 86400000;

// ---- gemeinsame Helfer (auch von ist.js genutzt) ----
export const normHeader = (s) => s.normalize('NFKD').toLowerCase().replace(/[^a-z]/g, '');
export const clean = (v) => (v ?? '').trim();
export const zeroToEmpty = (v) => (v === '0' ? '' : v);

/** Spalten über den normalisierten Überschriftentext finden (Reihenfolge/Schreibweise egal). */
export function mapColumns(header, defs) {
  const norm = header.map(normHeader);
  const idx = {};
  const missing = [];
  for (const col of defs) {
    const i = norm.findIndex((h) => col.match.test(h));
    if (i >= 0) idx[col.key] = i;
    else if (col.required) missing.push(col.label ?? col.key);
  }
  if (missing.length) throw new Error(`Spalte(n) nicht gefunden: ${missing.join(', ')}`);
  return idx;
}

export function toMinutes(v) {
  v = clean(v);
  if (!v) return 0;
  if (v.includes(':')) {
    const [h, m] = v.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function toPercent(v) {
  v = clean(v);
  if (!v) return null;
  const n = parseFloat(v.replace('%', '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** "03.11.2025" oder "2025-11-03" -> UTC-Mitternacht (ms); ungültig (z. B. Excel-Nulldatum "00.01.1900") -> null */
export function parseDate(v) {
  v = clean(v);
  let d, mo, y, m;
  if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else return null;
  if (y < 1990 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return Date.UTC(y, mo - 1, d);
}

// ---- Plan ----
const PLAN_COLUMNS = [
  { key: 'weekStart', match: /^erstertag/ },
  { key: 'phase',     match: /^trainingsphase/ },
  { key: 'week',      match: /^trainingswoche/, required: true, label: 'Trainingswoche' },
  { key: 'sport',     match: /^sportart/,       required: true, label: 'Sportart' },
  { key: 'regKey',    match: /^regkey/ },
  { key: 'abc',       match: /^abc/ },
  { key: 'goal',      match: /^trainingsziel/,  required: true, label: 'Trainingsziel' },
  { key: 'minutes',   match: /^zeit/,           required: true, label: 'Zeit' },
  { key: 'program',   match: /^programm/ },
  { key: 'day',       match: /^standardtag/ },
  { key: 'volume',    match: /^verplantes/ },
  { key: 'summary',   match: /^zusammenfassung/ },
];

/** "01 - PREP 1 // Me-1/5" -> { season: '01', label: 'PREP 1', cycle: '1/5' } */
export function parsePhase(raw) {
  const m = /^\s*(\d+)\s*-\s*(.+?)\s*\/\/\s*(.+?)\s*$/.exec(raw || '');
  if (!m) return { raw: raw || '', season: '', label: raw || '', cycle: '' };
  const c = /(\d+\s*\/\s*\d+)/.exec(m[3]);
  return { raw, season: m[1], label: m[2], cycle: c ? c[1].replace(/\s/g, '') : '' };
}

/** CSV-Text -> Plan. Wirft einen Error mit lesbarer Meldung bei ungültigen Daten. */
export function parsePlan(text) {
  const table = parseCsv(text);
  if (table.length < 2) throw new Error('Die Datei enthält keine Datenzeilen.');
  const idx = mapColumns(table[0], PLAN_COLUMNS);
  const get = (r, key) => (key in idx ? clean(r[idx[key]]) : '');

  const rows = [];
  for (const r of table.slice(1)) {
    if (!r.some((c) => clean(c) !== '')) continue;
    const week = parseInt(get(r, 'week'), 10);
    const sport = get(r, 'sport');
    // Platzhalter-/Füllzeilen (Woche 0, Sportart "0" oder leer) sind keine Planzeilen
    if (!Number.isInteger(week) || week < 1 || !sport || sport === '0') continue;
    rows.push({
      week,
      weekStart: parseDate(get(r, 'weekStart')),
      phase: get(r, 'phase'),
      sport,
      regKey: get(r, 'regKey'),
      abc: get(r, 'abc'),
      goal: zeroToEmpty(get(r, 'goal')),
      minutes: toMinutes(get(r, 'minutes')),
      program: zeroToEmpty(get(r, 'program')),
      day: zeroToEmpty(get(r, 'day')),
      volume: toPercent(get(r, 'volume')),
      summary: get(r, 'summary'),
    });
  }
  if (!rows.length) throw new Error('Keine gültigen Zeilen (Trainingswoche fehlt oder ist keine Zahl).');
  return buildPlan(rows);
}

/**
 * Leere Slots (Zeit 0) werden verworfen, liefern aber Phase, Volumen und Wochenstart, falls diese
 * nur dort stehen. Fehlt der Wochenstart bei einzelnen Wochen, wird er aus den übrigen berechnet.
 */
export function buildPlan(rows) {
  const byWeek = new Map();
  for (const r of rows) {
    let w = byWeek.get(r.week);
    if (!w) {
      w = { week: r.week, phaseRaw: '', volume: null, start: null, sessions: [], minutes: 0, phase: null };
      byWeek.set(r.week, w);
    }
    if (!w.phaseRaw && r.phase) w.phaseRaw = r.phase;
    if (w.volume === null && r.volume !== null) w.volume = r.volume;
    if (w.start === null && r.weekStart !== null) w.start = r.weekStart;
    if (r.minutes > 0) w.sessions.push(r);
  }
  const weeks = [...byWeek.values()].sort((a, b) => a.week - b.week);
  const anchor = weeks.find((w) => w.start !== null);
  for (const w of weeks) {
    w.minutes = w.sessions.reduce((sum, s) => sum + s.minutes, 0);
    w.phase = parsePhase(w.phaseRaw);
    if (anchor && w.start === null) w.start = anchor.start + (w.week - anchor.week) * 7 * DAY_MS;
  }
  return {
    weeks,
    byWeek,
    firstWeek: weeks[0].week,
    lastWeek: weeks[weeks.length - 1].week,
    maxVolume: Math.max(150, ...weeks.map((w) => w.volume ?? 0)),
    sessionCount: weeks.reduce((n, w) => n + w.sessions.length, 0),
    hasDates: Boolean(anchor),
    sportOrder: [...new Set(rows.map((r) => r.sport))], // Reihenfolge wie in der Datei
  };
}

export const dayIndex = (d) => {
  const i = DAY_ORDER.indexOf(d);
  return i < 0 ? 99 : i;
};

export const sportRank = (sport) => SPORTS[sport]?.order ?? 999;

/** Einheiten einer Woche je Sportart gruppiert, sortiert nach Tag, dann A/B/C. */
export function groupBySport(week) {
  const groups = new Map();
  for (const s of week.sessions) {
    if (!groups.has(s.sport)) groups.set(s.sport, []);
    groups.get(s.sport).push(s);
  }
  return [...groups.entries()]
    .map(([sport, sessions]) => ({
      sport,
      sessions: sessions.sort((a, b) =>
        dayIndex(a.day) - dayIndex(b.day) || a.abc.localeCompare(b.abc) || a.regKey.localeCompare(b.regKey)),
      minutes: sessions.reduce((n, s) => n + s.minutes, 0),
    }))
    .sort((a, b) => sportRank(a.sport) - sportRank(b.sport));
}

// ---- Kalender: Welche Trainingswoche ist heute? ----

export const parseISODate = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
};
export const toISODate = (ms) => new Date(ms).toISOString().slice(0, 10);
export const mondayOf = (ms) => ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY_MS;
export const todayUTC = () => {
  const n = new Date();
  return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
};

/** Wochenbeginn (UTC-ms): aus der CSV, sonst aus dem manuell gesetzten Startdatum, sonst null. */
export function weekStartMs(plan, week, startISO) {
  const w = plan.byWeek.get(week);
  if (w?.start != null) return w.start;
  const s = parseISODate(startISO);
  return s === null ? null : mondayOf(s) + (week - plan.firstWeek) * 7 * DAY_MS;
}

export function weekRange(plan, startISO, week) {
  const from = weekStartMs(plan, week, startISO);
  return from === null ? null : [from, from + 6 * DAY_MS];
}

/** Aktuelle Trainingswoche: status 'in' | 'before' | 'after' | 'unset' (kein Datum bekannt). */
export function currentWeekInfo(plan, startISO, now = todayUTC()) {
  if (!plan) return { status: 'unset', week: null };
  if (plan.hasDates) {
    const first = plan.byWeek.get(plan.firstWeek).start;
    if (now < first) return { status: 'before', week: plan.firstWeek, daysUntil: Math.ceil((first - now) / DAY_MS) };
    const hit = plan.weeks.find((w) => now >= w.start && now < w.start + 7 * DAY_MS);
    return hit ? { status: 'in', week: hit.week } : { status: 'after', week: plan.lastWeek };
  }
  const start = parseISODate(startISO);
  if (start === null) return { status: 'unset', week: null };
  const base = mondayOf(start);
  const idx = Math.floor((now - base) / (7 * DAY_MS));
  if (idx < 0) return { status: 'before', week: plan.firstWeek, daysUntil: Math.ceil((base - now) / DAY_MS) };
  const week = plan.firstWeek + idx;
  return week > plan.lastWeek ? { status: 'after', week: plan.lastWeek } : { status: 'in', week };
}
