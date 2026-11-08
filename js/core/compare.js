// Plan/Ist-Vergleich mit Ampel. Keine DOM-Zugriffe.
import { THRESHOLDS } from './config.js';
import { DAY_MS, dayIndex, sportRank, todayUTC, weekStartMs } from './plan.js';

/** Ampel: grün über 90 %, gelb ab 50 %, rot darunter (Grenzen in config.js). */
export function levelOf(ratio) {
  if (ratio > THRESHOLDS.green) return 'green';
  if (ratio >= THRESHOLDS.yellow) return 'yellow';
  return 'red';
}

const keyOf = (x) => `${x.sport}|${x.regKey}|${x.abc}`;

/**
 * Vergleich einer Woche.
 * Je Planeinheit: 'done' (Ist vorhanden, bewertet), 'missed' (Plantag liegt vor heute, kein Ist -> rot)
 * oder 'pending' (Plantag ist heute oder später, noch nicht bewertbar).
 * Ist-Einheiten ohne passende Planeinheit sind 'extra' (ungeplant) und zählen zum Ist-Umfang der Woche (aber nicht zu einer Planeinheit).
 */
export function compareWeek(plan, ist, week, startISO, today = todayUTC()) {
  const w = plan.byWeek.get(week);
  const start = weekStartMs(plan, week, startISO);
  const entries = ist?.byWeek.get(week) ?? [];
  const used = new Set();
  const items = [];

  for (const s of w.sessions) {
    const hits = entries.filter((e) => keyOf(e) === keyOf(s));
    hits.forEach((e) => used.add(e));
    const istMinutes = hits.reduce((n, e) => n + e.minutes, 0);
    const di = dayIndex(s.day);
    const planDate = start === null ? null : start + (di === 99 ? 6 : di) * DAY_MS;
    let status, ratio = null, level = null;
    if (hits.length) { status = 'done'; ratio = istMinutes / s.minutes; level = levelOf(ratio); }
    else if (planDate !== null && planDate < today) { status = 'missed'; ratio = 0; level = 'red'; }
    else status = 'pending';
    items.push({ kind: 'plan', sport: s.sport, plan: s, ist: hits, planMinutes: s.minutes, istMinutes, ratio, level, status, planDate });
  }
  for (const e of entries) {
    if (used.has(e)) continue;
    items.push({ kind: 'extra', sport: e.sport, plan: null, ist: [e], planMinutes: 0, istMinutes: e.minutes, ratio: null, level: null, status: 'extra', planDate: e.date });
  }

  const sortKey = (i) => (i.kind === 'plan'
    ? [0, dayIndex(i.plan.day), i.plan.abc, i.plan.regKey]
    : [1, i.planDate, '', '']);
  items.sort((a, b) => {
    const ka = sortKey(a), kb = sortKey(b);
    for (let i = 0; i < 4; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
    return 0;
  });

  const bySport = new Map();
  for (const it of items) {
    if (!bySport.has(it.sport)) bySport.set(it.sport, []);
    bySport.get(it.sport).push(it);
  }
  const groups = [...bySport.entries()]
    .map(([sport, list]) => ({
      sport,
      items: list,
      due: list.filter((i) => i.status === 'done' || i.status === 'missed').reduce((n, i) => n + i.planMinutes, 0),
      done: list.filter((i) => i.status === 'done').reduce((n, i) => n + i.istMinutes, 0),
      extra: list.filter((i) => i.kind === 'extra').reduce((n, i) => n + i.istMinutes, 0), // ungeplant
    }))
    .sort((a, b) => sportRank(a.sport) - sportRank(b.sport));

  const due = groups.reduce((n, g) => n + g.due, 0);
  const done = groups.reduce((n, g) => n + g.done, 0);
  const extra = items.filter((i) => i.kind === 'extra').reduce((n, i) => n + i.istMinutes, 0);
  // Ungeplante Einheiten zählen zum Wochenumfang: Quote = (zugeordnet + ungeplant) / Soll bis heute
  const actual = done + extra;
  const ratio = due > 0 ? actual / due : null;
  return {
    week, start, items, groups,
    totals: { planTotal: w.minutes, due, done, extra, actual, ratio, ratioPlanned: due > 0 ? done / due : null, level: ratio === null ? null : levelOf(ratio) },
  };
}
