import { h } from '../ui/dom.js';
import { compareCard } from '../ui/compare-card.js';
import { openSheet } from '../ui/sheet.js';
import { weekHeader, statCell } from '../ui/week-header.js';
import { weekPicker } from '../ui/week-picker.js';
import { attachWeekNav } from '../ui/swipe.js';
import { state } from '../core/store.js';
import * as settings from '../core/settings.js';
import { go } from '../core/router.js';
import { SPORTS } from '../core/config.js';
import { currentWeekInfo, todayUTC, weekRange } from '../core/plan.js';
import { compareWeek } from '../core/compare.js';
import { eventCards } from '../ui/event-card.js';
import { eventsInRange, isRace, raceLabel } from '../core/events.js';
import { fmtDuration, fmtPercent, fmtRange } from '../core/format.js';

function message(text, linkText = 'Zu den Einstellungen', href = '#/settings') {
  return h('div', { class: 'screen' }, h('main', { class: 'content' },
    h('div', { class: 'banner' }, text),
    h('a', { class: 'btn', href }, linkText),
    ' ', h('a', { class: 'btn btn-ghost', href: '#/' }, 'Startseite')));
}

const legend = () => h('p', { class: 'legend' },
  h('span', {}, h('i', { class: 'dot lv-green' }), 'über 90 %'),
  h('span', {}, h('i', { class: 'dot lv-yellow' }), 'ab 50 %'),
  h('span', {}, h('i', { class: 'dot lv-red' }), 'darunter'),
  h('span', {}, h('i', { class: 'dot lv-pending' }), 'offen'));

export default {
  mount(root, [weekParam]) {
    const { plan, ist } = state;
    if (!plan) { root.append(message(state.error || 'Keine Plandaten geladen.')); return; }
    if (!ist) { root.append(message(state.istError || 'Es sind noch keine Ist-Daten geladen.', 'Ist-Daten importieren')); return; }

    const startISO = settings.get('startDate');
    const cur = currentWeekInfo(plan, startISO);
    if (cur.status === 'unset') { root.append(message('Ohne Wochendaten im Plan und ohne Plan-Start ist kein Vergleich möglich.', 'Plan-Start festlegen')); return; }
    if (cur.status === 'before') { root.append(message(`Der Plan startet in ${cur.daysUntil} Tag(en) – es gibt noch nichts zu vergleichen.`, 'Zur Planansicht', '#/week')); return; }

    // Vergleich nur bis zur aktuellen Woche (bei beendetem Plan: alle Wochen)
    const weeks = plan.weeks.filter((x) => x.week <= cur.week);
    const week = Math.min(cur.week, Math.max(plan.firstWeek, weekParam ? parseInt(weekParam, 10) : cur.week));
    const idx = weeks.findIndex((x) => x.week === week);
    const prev = weeks[idx - 1]?.week;
    const next = weeks[idx + 1]?.week;
    const open = (n) => go(`/compare/${n}`, { replace: true });

    const today = todayUTC();
    const w = plan.byWeek.get(week);
    const res = compareWeek(plan, ist, week, startISO, today);
    const t = res.totals;
    const range = weekRange(plan, startISO, week);
    const evs = range ? eventsInRange(state.events, range[0], range[1]) : [];
    const race = evs.find(isRace);
    const meta = [
      race ? `🏆 ${raceLabel(race)}` : null,
      w.phase.label,
      w.phase.season ? `Block ${w.phase.season}` : null,
      w.phase.cycle ? `Woche ${w.phase.cycle}` : null,
      range ? fmtRange(range) : null,
    ].filter(Boolean).join(' · ');

    const header = weekHeader({
      week, lastWeek: plan.lastWeek, prev, next, today: cur.week, meta, go: open,
      openPicker: () => {
        const dlg = openSheet('Woche wählen', weekPicker({
          weeks, selected: week, today: cur.week, pick: (n) => { dlg.close(); open(n); },
          levelOf: (n) => compareWeek(plan, ist, n, startISO, today).totals.level,
          eventOf: (n) => {
            const r = weekRange(plan, startISO, n);
            const list = r ? eventsInRange(state.events, r[0], r[1]).filter((e) => e.kind !== 'SB' && e.kind !== 'SE') : [];
            return list.some(isRace) ? 'A' : list.length ? 'WK' : null;
          },
        }));
      },
      stats: [
        statCell('Ist / Soll bis heute', [`${fmtDuration(t.actual)} / ${fmtDuration(t.due)}`, h('small', {}, ' h')], null, true),
        statCell('Erfüllung', t.ratio === null ? '–' : fmtPercent(t.ratio * 100),
          h('span', { class: 'bar', role: 'presentation' },
            h('span', { class: `bar-fill ${t.level ? `lv-${t.level}` : ''}`, style: { width: `${Math.min(100, (t.ratio ?? 0) * 100)}%` } }),
            h('span', { class: 'bar-mark', style: { left: '90%' } }))),
      ],
    });

    const body = h('main', { class: 'content week-body' },
      eventCards(evs),
      ist.sportInferred > 0
        ? h('div', { class: 'banner' }, 'Hinweis: In der Ist-Datei fehlt die Sportart. Sie wurde aus der Reihenfolge der Blöcke abgeleitet.')
        : null,
      t.extra > 0 ? h('div', { class: 'banner banner-extra' }, `Darin ${fmtDuration(t.extra)} h ungeplant – zählt zum Wochenumfang und zur Quote.`) : null,
      res.groups.length
        ? res.groups.map((g) => {
            const meta = SPORTS[g.sport];
            return h('section', { class: 'group' },
              h('div', { class: 'group-head' },
                h('span', { class: 'group-icon', 'aria-hidden': 'true' }, meta?.icon ?? '•'),
                h('h2', {}, meta?.label ?? g.sport),
                h('span', { class: 'group-sum' }, `${fmtDuration(g.done + g.extra)} / ${fmtDuration(g.due)} h`)),
              h('div', { class: 'group-list' }, g.items.map(compareCard)));
          })
        : h('p', { class: 'empty' }, 'In dieser Woche sind keine Einheiten geplant.'),
      legend());

    root.append(h('div', { class: 'screen' }, header, body));
    return attachWeekNav(body, { prev, next, go: open });
  },
};
