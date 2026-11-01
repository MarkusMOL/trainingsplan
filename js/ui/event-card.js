import { h } from './dom.js';
import { fmtShortDate, weekdayShort } from '../core/format.js';
import { daysUntil, isRace, raceLabel } from '../core/events.js';
import { todayUTC } from '../core/plan.js';

/** Hinweis auf "in x Tagen" / "heute" / "vor x Tagen". */
export function whenText(ms, today = todayUTC()) {
  const d = daysUntil(ms, today);
  return d === 0 ? 'heute' : d > 0 ? `in ${d} Tag${d === 1 ? '' : 'en'}` : `vor ${-d} Tag${d === -1 ? '' : 'en'}`;
}

const ICON = { A1: '🏆', A2: '🏆', WK: '🏁', SB: '🚩', SE: '🏁' };

/** Karte für einen Termin in der Wochenansicht. Hauptrennen (Race A1/A2) sind golden hervorgehoben. */
export function eventCard(e, today = todayUTC()) {
  const race = isRace(e);
  return h('div', { class: `event ${race ? 'event-race' : 'event-plain'}`, role: 'note' },
    h('span', { class: 'event-icon', 'aria-hidden': 'true' }, ICON[e.kind] ?? '🏁'),
    h('div', { class: 'event-main' },
      h('div', { class: 'event-kind' }, raceLabel(e)),
      e.name ? h('div', { class: 'event-name' }, e.name) : null),
    h('div', { class: 'event-when' },
      h('b', {}, `${weekdayShort(e.date)} ${fmtShortDate(e.date)}`),
      h('span', {}, whenText(e.date, today))));
}

export const eventCards = (list, today) => (list.length ? h('div', { class: 'events' }, list.map((e) => eventCard(e, today))) : null);
