// Auswertungen: Plan-Erfüllung der Saison, Block-Projektion, Vergleich mit Vorjahren. Keine DOM-Zugriffe.
import { THRESHOLDS } from './config.js';
import { compareWeek, levelOf } from './compare.js';
import { DAY_MS, currentWeekInfo, dayIndex, sportRank, todayUTC, weekStartMs } from './plan.js';

export const SPORT_KEYS = ['Swim', 'Bike', 'Run', 'Athletik'];
export const MIN_COMPARE_MINUTES = 180; // unter 3 h Vorjahres-Ø wird keine Prozent-Abweichung angezeigt

// ============================================================
// Plan-Erfüllung der Saison
// ============================================================

/** Erfüllung aller Wochen bis zur aktuellen. null, solange der Plan noch nicht begonnen hat. */
export function seasonStats(plan, ist, startISO, today = todayUTC()) {
  const cur = currentWeekInfo(plan, startISO, today);
  if (cur.status === 'unset' || cur.status === 'before') return null;
  const weeks = [], bySport = new Map();
  let due = 0, done = 0, extra = 0;
  const count = { done: 0, missed: 0, pending: 0 };

  for (const w of plan.weeks) {
    if (w.week > cur.week) break;
    const res = compareWeek(plan, ist, w.week, startISO, today);
    weeks.push({ week: w.week, phase: w.phase, start: res.start, planTotal: w.minutes, ...res.totals });
    due += res.totals.due; done += res.totals.done; extra += res.totals.extra;
    for (const g of res.groups) {
      const s = bySport.get(g.sport) ?? { sport: g.sport, due: 0, done: 0 };
      s.due += g.due; s.done += g.done;
      bySport.set(g.sport, s);
    }
    for (const it of res.items) if (it.kind === 'plan') count[it.status]++;
  }
  const ratio = due > 0 ? done / due : null;
  const completed = weeks.filter((w) => w.week < cur.week && w.due > 0);
  let streak = 0;
  for (let i = completed.length - 1; i >= 0 && completed[i].level === 'green'; i--) streak++;
  const byRatio = [...completed].sort((a, b) => a.ratio - b.ratio);
  return {
    currentWeek: cur.week, weeks, due, done, extra, ratio, level: ratio === null ? null : levelOf(ratio),
    bySport: [...bySport.values()].sort((a, b) => sportRank(a.sport) - sportRank(b.sport)).map((s) => ({ ...s, ratio: s.due > 0 ? s.done / s.due : null })),
    count, streak, worst: byRatio[0] ?? null, best: byRatio[byRatio.length - 1] ?? null,
  };
}

// ============================================================
// Trainingsblöcke (z. B. BASE 1 = 4 Wochen)
// ============================================================

/** Aufeinanderfolgende Wochen mit gleicher Phase ("01 - BASE 1"). */
export function blocksOf(plan) {
  const blocks = [];
  for (const w of plan.weeks) {
    const key = `${w.phase.season}|${w.phase.label}`;
    const last = blocks[blocks.length - 1];
    if (last?.key === key) last.weeks.push(w);
    else blocks.push({ key, label: w.phase.label || '–', season: w.phase.season, weeks: [w] });
  }
  return blocks.map((b) => ({ ...b, firstWeek: b.weeks[0].week, lastWeek: b.weeks[b.weeks.length - 1].week }));
}

/**
 * Stand und Projektion eines Blocks (Minuten):
 *  - Fortschreibung: bisherige Quote (Ist/Soll der fälligen Einheiten) gilt auch für die restlichen Einheiten
 *  - Bestfall: alle restlichen Einheiten werden zu 100 % erfüllt
 *  - nötige Rest-Quote, um insgesamt über 90 % (grün) zu landen
 */
export function blockProjection(plan, ist, block, startISO, today = todayUTC()) {
  let planTotal = 0, due = 0, done = 0, missed = 0, pending = 0;
  for (const w of block.weeks) {
    for (const it of compareWeek(plan, ist, w.week, startISO, today).items) {
      if (it.kind !== 'plan') continue;
      planTotal += it.planMinutes;
      if (it.status === 'done') { due += it.planMinutes; done += it.istMinutes; }
      else if (it.status === 'missed') { due += it.planMinutes; missed += it.planMinutes; }
      else pending += it.planMinutes;
    }
  }
  const ratioSoFar = due > 0 ? done / due : null;
  const target = THRESHOLDS.green * planTotal;
  const need = Math.max(0, target - done);
  const projected = ratioSoFar === null ? null : (done + pending * ratioSoFar) / planTotal;
  return {
    block, planTotal, due, done, missed, pending, ratioSoFar,
    level: ratioSoFar === null ? null : levelOf(ratioSoFar),
    projected, projectedLevel: projected === null ? null : levelOf(projected),
    best: planTotal > 0 ? (done + pending) / planTotal : null,
    needQuote: pending > 0 ? need / pending : need > 0 ? Infinity : 0, // 1.0 = Rest genau nach Plan
    finished: pending === 0,
    started: due > 0 || done > 0,
  };
}

// ============================================================
// Vergleich mit Vorjahren (Ausrichtung am Renntag Race A1)
// ============================================================

/** Wochen bis zum Rennen: Renntag und die 6 Tage davor = 1, danach 2, … (0 und darunter = nach dem Rennen). */
export const weeksToRace = (off) => Math.floor(off / 7) + 1;

const matches = (s, sport) => !sport || sport === 'Alle' || s.sport === sport;
const off = (race, date) => Math.round((race - date) / DAY_MS);
const phaseKey = (w) => (w.phase.season ? `${w.phase.season} - ${w.phase.label}` : w.phase.label);

/** Ist-Einheiten des laufenden Jahres in der gleichen Form wie die Vorjahre. */
export function currentSessions(plan, ist, race) {
  return (ist?.entries ?? []).map((e) => ({
    off: off(race, e.date), date: e.date, sport: e.sport, minutes: e.minutes, phase: phaseKey(plan.byWeek.get(e.week)),
  }));
}

/** Geplante Einheiten (Plan-Tag; ohne Tag: Sonntag der Woche). */
export function planSessions(plan, race, startISO) {
  const out = [];
  for (const w of plan.weeks) {
    const start = weekStartMs(plan, w.week, startISO);
    if (start === null) continue;
    for (const s of w.sessions) {
      const di = dayIndex(s.day);
      const date = start + (di === 99 ? 6 : di) * DAY_MS;
      out.push({ off: off(race, date), date, sport: s.sport, minutes: s.minutes, phase: phaseKey(w) });
    }
  }
  return out;
}

export function yearSessions(year) {
  return year.sessions;
}

/** Kumulierte Minuten je Tag; Index i entspricht off = maxOff - i. Einheiten vor maxOff zählen am Anfang. */
export function cumulative(sessions, sport, maxOff, minOff = 0) {
  const arr = new Float64Array(maxOff - minOff + 1);
  for (const s of sessions) {
    if (!matches(s, sport) || s.off < minOff) continue;
    arr[maxOff - Math.min(s.off, maxOff)] += s.minutes;
  }
  for (let i = 1; i < arr.length; i++) arr[i] += arr[i - 1];
  return arr;
}

/** Summe bis zu einem Zeitpunkt (alle Einheiten mit off >= offNow). */
export function totalUntil(sessions, sport, offNow) {
  let sum = 0;
  for (const s of sessions) if (matches(s, sport) && s.off >= offNow) sum += s.minutes;
  return sum;
}

/** Minuten je "Wochen bis Race" (Map: Woche -> Minuten). */
export function weeklyMinutes(sessions, sport) {
  const m = new Map();
  for (const s of sessions) if (matches(s, sport)) m.set(weeksToRace(s.off), (m.get(weeksToRace(s.off)) ?? 0) + s.minutes);
  return m;
}

/** Minuten und Kilometer je Phase ("01 - BASE 1"). */
export function phaseTotals(sessions, sport) {
  const m = new Map();
  for (const s of sessions) {
    if (!s.phase || !matches(s, sport)) continue;
    const t = m.get(s.phase) ?? { minutes: 0, km: 0 };
    t.minutes += s.minutes; t.km += s.km ?? 0;
    m.set(s.phase, t);
  }
  return m;
}

export const average = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);

/** Mittel mehrerer gleich langer Reihen. */
export function averageSeries(list) {
  if (!list.length) return null;
  const out = new Float64Array(list[0].length);
  for (const a of list) for (let i = 0; i < out.length; i++) out[i] += a[i];
  for (let i = 0; i < out.length; i++) out[i] /= list.length;
  return out;
}

/** Jahre, die vor dem laufenden Rennen liegen (das laufende Jahr nie mit sich selbst vergleichen). */
export const pastYears = (history, race) => (history?.years ?? []).filter((y) => y.race < race);

/**
 * Alles für den Vorjahresvergleich (Ansicht und Kachel):
 * Ausrichtung am Renntag Race A1; "heute" entspricht dem gleichen Abstand zum Rennen in den Vorjahren.
 */
export function yearsData({ plan, ist, ev, history, startISO, sport = 'Alle', selected = [], today = todayUTC() }) {
  const race = ev.a1.date;
  const years = pastYears(history, race);
  const sel = years.filter((y) => selected.includes(y.year));
  const cur = currentSessions(plan, ist, race);
  const planS = planSessions(plan, race, startISO);
  const offNow = Math.max(0, Math.round((race - today) / DAY_MS));
  const seasonOff = Math.round((race - (ev.seasonStart ?? plan.weeks[0].start)) / DAY_MS);
  const maxOff = Math.min(400, Math.max(seasonOff, ...sel.map((y) => y.startOff)));

  const at = (sessions) => totalUntil(sessions, sport, offNow);
  const curMin = at(cur), planMin = at(planS);
  const selMin = sel.map((y) => at(y.sessions));
  const avgMin = average(selMin);
  return {
    race, years, sel, cur, planS, offNow, maxOff,
    curMin, planMin, avgMin,
    rows: sel.map((y, i) => ({ year: y.year, minutes: selMin[i] })),
    // Zu Saisonbeginn ist der Ø fast 0 – dann wäre die Abweichung in Prozent irreführend
    delta: avgMin >= MIN_COMPARE_MINUTES ? (curMin - avgMin) / avgMin : null,
    series: {
      cur: cumulative(cur, sport, maxOff), plan: cumulative(planS, sport, maxOff),
      years: sel.map((y) => cumulative(y.sessions, sport, maxOff)),
      avg: averageSeries(sel.map((y) => cumulative(y.sessions, sport, maxOff))),
    },
  };
}
