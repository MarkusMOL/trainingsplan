import { h } from '../ui/dom.js';
import { sessionCard } from '../ui/session-card.js';
import { openSheet } from '../ui/sheet.js';
import { weekHeader, statCell } from '../ui/week-header.js';
import { weekPicker } from '../ui/week-picker.js';
import { attachWeekNav } from '../ui/swipe.js';
import { state } from '../core/store.js';
import * as settings from '../core/settings.js';
import { go } from '../core/router.js';
import { SPORTS } from '../core/config.js';
import { currentWeekInfo, groupBySport, weekRange } from '../core/plan.js';
import { eventCards } from '../ui/event-card.js';
import { eventsInRange, isRace, raceLabel } from '../core/events.js';
import { fmtDuration, fmtPercent, fmtRange } from '../core/format.js';
import { goalHue } from '../ui/goal.js';

function banner(cur, hasParam, plan) {
  if (hasParam) return null;
  if (cur.status === 'unset') {
    return h('div', { class: 'banner' },
      'Der Plan enthält keine Wochendaten und es ist kein Plan-Start gesetzt – deshalb wird nicht automatisch die aktuelle Woche gezeigt. ',
      h('a', { href: '#/settings' }, 'Plan-Start festlegen'));
  }
  if (cur.status === 'before') return h('div', { class: 'banner' }, `Der Plan startet in ${cur.daysUntil} Tag(en). Angezeigt wird die erste Woche.`);
  if (cur.status === 'after') return h('div', { class: 'banner' }, 'Der Plan ist beendet. Angezeigt wird die letzte Woche.');
  return null;
}

/** Farblegende: Kartenfarbe = Trainingsziel (nur die Ziele dieser Woche). */
function goalLegend(week) {
  const goals = [...new Set(week.sessions.map((s) => s.goal).filter(Boolean))];
  if (!goals.length) return null;
  return h('p', { class: 'legend' },
    h('span', {}, 'Farbe = Trainingsziel:'),
    goals.map((g) => h('span', {},
      h('i', { class: 'dot', style: { '--lv': `hsl(${goalHue(g)} var(--g-bar-s) var(--g-bar-l))` } }), g)));
}

/** 'A' (Hauptrennen), 'WK' oder null für die Wochenauswahl. */
function eventKind(plan, startISO, n) {
  const r = weekRange(plan, startISO, n);
  const list = r ? eventsInRange(state.events, r[0], r[1]).filter((e) => e.kind !== 'SB' && e.kind !== 'SE') : [];
  return list.some(isRace) ? 'A' : list.length ? 'WK' : null;
}

export default {
  mount(root, [weekParam]) {
    const plan = state.plan;
    if (!plan) {
      root.append(h('div', { class: 'screen' }, h('main', { class: 'content' },
        h('div', { class: 'banner banner-error' }, state.error || 'Keine Daten geladen.'),
        h('a', { class: 'btn', href: '#/settings' }, 'Zu den Einstellungen'))));
      return;
    }

    const startISO = settings.get('startDate');
    const cur = currentWeekInfo(plan, startISO);
    const clamp = (n) => Math.min(plan.lastWeek, Math.max(plan.firstWeek, n));
    const fallback = cur.week ?? clamp(parseInt(settings.get('lastWeek', plan.firstWeek), 10) || plan.firstWeek);
    const week = clamp(weekParam ? parseInt(weekParam, 10) : fallback);
    if (cur.status === 'unset') settings.set('lastWeek', String(week));

    const w = plan.byWeek.get(week) ?? plan.weeks[0];
    const idx = plan.weeks.findIndex((x) => x.week === w.week);
    const prev = plan.weeks[idx - 1]?.week;
    const next = plan.weeks[idx + 1]?.week;
    const open = (n) => go(`/week/${n}`, { replace: true });
    const range = weekRange(plan, startISO, w.week);

    const evs = range ? eventsInRange(state.events, range[0], range[1]) : [];
    const race = evs.find(isRace);
    const meta = [
      race ? `🏆 ${raceLabel(race)}` : null,
      w.phase.label,
      w.phase.season ? `Block ${w.phase.season}` : null,
      w.phase.cycle ? `Woche ${w.phase.cycle}` : null,
      range ? fmtRange(range) : null,
    ].filter(Boolean).join(' · ');

    const volPct = w.volume === null ? 0 : Math.min(100, (w.volume / plan.maxVolume) * 100);

    const header = weekHeader({
      week: w.week, lastWeek: plan.lastWeek, prev, next, today: cur.week, meta, go: open,
      openPicker: () => {
        const dlg = openSheet('Woche wählen', weekPicker({
          weeks: plan.weeks, selected: w.week, today: cur.week, pick: (n) => { dlg.close(); open(n); },
          eventOf: (n) => eventKind(plan, startISO, n),
        }));
      },
      stats: [
        statCell('Wochenumfang', [fmtDuration(w.minutes), h('small', {}, ' h')]),
        statCell('Volumen', fmtPercent(w.volume),
          h('span', { class: 'bar', role: 'presentation' },
            h('span', { class: 'bar-fill', style: { width: `${volPct}%` } }),
            h('span', { class: 'bar-mark', style: { left: `${(100 / plan.maxVolume) * 100}%` } }))),
      ],
    });

    const groups = groupBySport(w);
    const body = h('main', { class: 'content week-body' },
      banner(cur, Boolean(weekParam), plan),
      eventCards(evs),
      groups.length
        ? groups.map((g) => {
            const meta = SPORTS[g.sport];
            return h('section', { class: 'group' },
              h('div', { class: 'group-head' },
                h('span', { class: 'group-icon', 'aria-hidden': 'true' }, meta?.icon ?? '•'),
                h('h2', {}, meta?.label ?? g.sport),
                h('span', { class: 'group-sum' }, `${g.sessions.length}× · ${fmtDuration(g.minutes)} h`)),
              h('div', { class: 'group-list' }, g.sessions.map(sessionCard)));
          })
        : h('p', { class: 'empty' }, 'In dieser Woche sind keine Einheiten geplant.'),
      goalLegend(w));

    root.append(h('div', { class: 'screen' }, header, body));
    return attachWeekNav(body, { prev, next, go: open });
  },
};
