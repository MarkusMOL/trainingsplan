import { h } from '../ui/dom.js';
import { svg } from '../ui/charts.js';
import { appBar } from '../ui/appbar.js';
import { whenText } from '../ui/event-card.js';
import { state } from '../core/store.js';
import { DAY_MS, todayUTC } from '../core/plan.js';
import { daysUntil, isRace, nextEvent, raceLabel } from '../core/events.js';
import { blocksOf } from '../core/stats.js';
import { PHASE_HUES } from '../core/config.js';
import { fmtShortDate, fmtLongDate } from '../core/format.js';

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/** Große Zähler für ein Hauptrennen. */
function countdown(e, today) {
  const d = daysUntil(e.date, today);
  const past = d < 0;
  return h('div', { class: 'cd' + (past ? ' cd-past' : '') },
    h('div', { class: 'cd-kind' }, `🏆 ${raceLabel(e)}`),
    h('div', { class: 'cd-name' }, e.name || '–'),
    h('div', { class: 'cd-num' }, past ? '✓' : String(d), h('small', {}, past ? ` vor ${-d} Tagen` : d === 0 ? ' heute!' : d === 1 ? ' Tag' : ' Tage')),
    h('div', { class: 'cd-sub' }, `${fmtLongDate(e.date)}${!past && d > 6 ? ` · ${Math.floor(d / 7)} Wochen ${d % 7} Tage` : ''}`));
}

/** Saison als Zeitleiste: Phasen, Wettkämpfe, Hauptrennen, heute. */
function timeline(ev, plan, today) {
  const W = 360, H = 112, l = 8, r = 8;
  const a = ev.seasonStart ?? plan?.weeks[0].start, b = ev.seasonEnd ?? (plan ? plan.weeks.at(-1).start + 7 * DAY_MS : null);
  if (a == null || b == null || b <= a) return null;
  const x = (ms) => l + ((Math.min(b, Math.max(a, ms)) - a) / (b - a)) * (W - l - r);
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Zeitleiste der Saison mit Phasen und Wettkämpfen' });

  // Phasen (nach Namensstamm zusammengefasst: PREP, BASE, BUILD, …)
  if (plan?.hasDates) {
    const bands = [];
    for (const blk of blocksOf(plan)) {
      const stem = blk.label.split(' ')[0];
      const from = blk.weeks[0].start, to = blk.weeks.at(-1).start + 7 * DAY_MS;
      const last = bands.at(-1);
      if (last && last.stem === stem) last.to = to; else bands.push({ stem, from, to });
    }
    for (const bd of bands) {
      const hue = PHASE_HUES[bd.stem] ?? 215;
      const x0 = x(bd.from), x1 = x(bd.to);
      root.append(svg('rect', { x: x0, y: 40, width: Math.max(1, x1 - x0 - 1), height: 22, rx: 3, fill: `hsl(${hue} 45% 55% / .55)` }));
      if (x1 - x0 > 26) root.append(svg('text', { class: 'ch-text ch-band', x: (x0 + x1) / 2, y: 55, 'text-anchor': 'middle' }, bd.stem));
    }
  }
  // Monatsmarken
  const d0 = new Date(a);
  for (let t = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 1); t < b; ) {
    const dt = new Date(t);
    root.append(svg('line', { class: 'ch-grid', x1: x(t), x2: x(t), y1: 62, y2: 68 }),
      svg('text', { class: 'ch-text', x: x(t), y: 80, 'text-anchor': 'middle' }, MONTHS[dt.getUTCMonth()]));
    t = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1);
  }
  // Wettkämpfe
  for (const e of ev.list) {
    if (isRace(e)) {
      root.append(svg('line', { x1: x(e.date), x2: x(e.date), y1: 18, y2: 62, stroke: 'var(--gold)', 'stroke-width': 2.2 }),
        svg('circle', { cx: x(e.date), cy: 16, r: 7, fill: 'var(--gold)' }),
        svg('text', { x: x(e.date), y: 19.5, 'text-anchor': 'middle', class: 'ch-flag' }, e.kind === 'A1' ? 'A1' : 'A2'));
    } else {
      root.append(svg('circle', { cx: x(e.date), cy: 32, r: 3.2, fill: 'var(--accent)' }));
    }
  }
  // heute
  if (today >= a && today <= b) {
    root.append(svg('line', { x1: x(today), x2: x(today), y1: 30, y2: 96, stroke: 'var(--danger)', 'stroke-width': 1.4, 'stroke-dasharray': '3 2' }),
      svg('text', { class: 'ch-text', x: x(today), y: 108, 'text-anchor': 'middle', fill: 'var(--danger)' }, 'heute'));
  }
  return root;
}

export default {
  mount(root) {
    const { events: ev, plan } = state;
    if (!ev) {
      root.append(h('div', { class: 'screen' }, appBar({ title: 'Wettkämpfe', backHref: '#/' }),
        h('main', { class: 'content' }, h('div', { class: 'banner' }, 'Es sind noch keine Termine geladen (Basisdaten / WK-Kalender).'),
          h('a', { class: 'btn', href: '#/settings' }, 'Zu den Einstellungen'))));
      return;
    }
    const today = todayUTC();
    const next = nextEvent(ev, today);
    const season = ev.seasonStart !== null && ev.seasonEnd !== null && ev.seasonEnd > ev.seasonStart
      ? Math.min(1, Math.max(0, (today - ev.seasonStart) / (ev.seasonEnd - ev.seasonStart))) : null;

    root.append(h('div', { class: 'screen' },
      appBar({ title: 'Wettkämpfe', backHref: '#/' }),
      h('main', { class: 'content' },
        h('div', { class: 'cd-grid' }, [ev.a1, ev.a2].filter(Boolean).map((e) => countdown(e, today))),
        next && !isRace(next)
          ? h('div', { class: 'card' }, h('h2', {}, 'Nächster Wettkampf'),
              h('div', { class: 'next-wk' }, h('b', {}, next.name || 'Wettkampf'), h('span', {}, `${fmtLongDate(next.date)} · ${whenText(next.date, today)}`)))
          : null,
        season !== null
          ? h('div', { class: 'card' }, h('h2', {}, 'Saison'),
              h('div', { class: 'season-bar', role: 'img', 'aria-label': `Saison zu ${Math.round(season * 100)} Prozent vorbei` },
                h('span', { style: { width: `${season * 100}%` } })),
              h('p', { class: 'hint' }, `${fmtShortDate(ev.seasonStart)} – ${fmtShortDate(ev.seasonEnd)} · ${today < ev.seasonStart ? 'noch nicht gestartet' : today > ev.seasonEnd ? 'beendet' : `${Math.round(season * 100)} % vorbei, noch ${daysUntil(ev.seasonEnd, today)} Tage`}`))
          : null,
        timeline(ev, plan, today) ? h('div', { class: 'card' }, h('h2', {}, 'Zeitleiste'), timeline(ev, plan, today)) : null,
        h('div', { class: 'card' }, h('h2', {}, 'Alle Termine'),
          h('ul', { class: 'ev-list' }, ev.list.map((e) => {
            const past = e.date < today;
            return h('li', { class: (isRace(e) ? 'is-race ' : '') + (past ? 'is-past ' : '') + (e === next ? 'is-next' : '') },
              h('span', { class: 'ev-date' }, fmtShortDate(e.date)),
              h('span', { class: 'ev-name' }, isRace(e) ? `🏆 ${raceLabel(e)}: ${e.name}` : (e.name || 'Wettkampf')),
              h('span', { class: 'ev-when' }, whenText(e.date, today)));
          }))))));
  },
};
