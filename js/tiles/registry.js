// Startscreen-Kacheln. Neue Kachel = neuer Eintrag + ggf. neue Route in views/routes.js.
//   id      eindeutige Kennung
//   title   Überschrift
//   icon    Name aus ui/icons.js
//   href    Ziel (Hash-Route)
//   info()  -> { lines: [Zeile 1, Zeile 2], level?: 'green'|'yellow'|'red' }  (wird beim Rendern berechnet)
import { state } from '../core/store.js';
import * as settings from '../core/settings.js';
import { currentWeekInfo, todayUTC } from '../core/plan.js';
import { compareWeek } from '../core/compare.js';
import { daysUntil, nextEvent, raceLabel } from '../core/events.js';
import { blocksOf, blockProjection, seasonStats, yearsData } from '../core/stats.js';
import { fmtDuration, fmtPercent } from '../core/format.js';

const pct = (r) => fmtPercent(r * 100);
const noData = (a, b) => ({ lines: [a, b] });

export const tiles = [
  {
    id: 'current-week',
    title: 'Aktuelle Woche',
    icon: 'calendar',
    href: '#/week',
    info() {
      const plan = state.plan;
      if (!plan) return noData('Keine Daten', 'Siehe Einstellungen');
      const cur = currentWeekInfo(plan, settings.get('startDate'));
      if (cur.status === 'unset') return noData('Plan-Start fehlt', 'Einstellungen öffnen');
      const w = plan.byWeek.get(cur.week);
      const note = cur.status === 'before' ? ' (bald)' : cur.status === 'after' ? ' (beendet)' : '';
      return { lines: [`Woche ${w.week} · ${w.phase.label || '–'}${note}`, `${fmtDuration(w.minutes)} h · ${fmtPercent(w.volume)}`] };
    },
  },
  {
    id: 'compare',
    title: 'Plan/Ist-Vergleich',
    icon: 'chart',
    href: '#/compare',
    info() {
      const { plan, ist } = state;
      if (!plan) return noData('Keine Daten', 'Siehe Einstellungen');
      if (!ist) return noData('Keine Ist-Daten', 'Einstellungen → Daten');
      const startISO = settings.get('startDate');
      const cur = currentWeekInfo(plan, startISO);
      if (cur.status === 'unset') return noData('Plan-Start fehlt', 'Einstellungen öffnen');
      if (cur.status === 'before') return noData('Plan startet erst', `in ${cur.daysUntil} Tag(en)`);
      const t = compareWeek(plan, ist, cur.week, startISO).totals;
      return {
        lines: [`Woche ${cur.week} · ${t.ratio === null ? 'noch nichts fällig' : pct(t.ratio)}`, `${fmtDuration(t.actual)} / ${fmtDuration(t.due)} h`],
        level: t.level,
      };
    },
  },
  {
    id: 'events',
    title: 'Wettkämpfe',
    icon: 'flag',
    href: '#/events',
    info() {
      const ev = state.events;
      if (!ev) return noData('Keine Termine', 'Einstellungen → Daten');
      const today = todayUTC();
      const race = nextEvent(ev, today, ['A1', 'A2']);
      const wk = nextEvent(ev, today, ['WK']);
      return {
        lines: [
          race ? `${raceLabel(race)}: noch ${daysUntil(race.date, today)} Tage` : 'Hauptrennen vorbei',
          wk ? `${wk.name || 'Wettkampf'} · ${daysUntil(wk.date, today)} T` : '',
        ],
      };
    },
  },
  {
    id: 'stats',
    title: 'Auswertung',
    icon: 'trend',
    href: '#/stats',
    info() {
      const { plan, ist } = state;
      if (!plan || !ist) return noData('Keine Ist-Daten', 'Einstellungen → Daten');
      const startISO = settings.get('startDate');
      const st = seasonStats(plan, ist, startISO);
      if (!st) return noData('Noch nichts auszuwerten', '');
      const cur = blocksOf(plan).find((b) => b.lastWeek >= st.currentWeek);
      const bp = cur && blockProjection(plan, ist, cur, startISO);
      return {
        lines: [`Saison: ${pct(st.ratio ?? 0)}`, bp?.projected != null ? `${cur.label}: Prognose ${pct(bp.projected)}` : `Block ${cur?.label ?? ''}`],
        level: st.level,
      };
    },
  },
  {
    id: 'years',
    title: 'Vorjahre',
    icon: 'history',
    href: '#/years',
    info() {
      const { plan, ist, events: ev, history } = state;
      if (!plan || !history || !ev?.a1) return noData('Keine Vorjahre', 'Einstellungen → Daten');
      let sel = null;
      try { sel = JSON.parse(settings.get('yearsSel') || 'null'); } catch { /* ignorieren */ }
      const past = history.years.filter((y) => y.race < ev.a1.date);
      if (!past.length) return noData('Keine Vorjahre', '');
      const years = sel?.length ? sel : past.slice(-3).map((y) => y.year);
      const d = yearsData({ plan, ist, ev, history, startISO: settings.get('startDate'), selected: years });
      return {
        lines: [d.delta === null ? `${past.length} Jahre` : `${d.delta >= 0 ? '+' : '−'}${Math.abs(Math.round(d.delta * 100))} % ggü. Ø`, `Vergleich: ${d.sel.length} Vorjahr(e)`],
      };
    },
  },
];
