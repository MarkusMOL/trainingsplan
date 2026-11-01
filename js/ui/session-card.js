import { h } from './dom.js';
import { goalAttrs } from './goal.js';
import { fmtDuration } from '../core/format.js';

/** Eine Trainingseinheit als Karte; Farbe nach Trainingsziel. */
export function sessionCard(s) {
  const { class: goalClass, style } = goalAttrs(s.goal);
  const tag = [s.regKey, s.abc].filter(Boolean).join(' · ');
  return h('article', { class: `session ${goalClass}`, style },
    h('div', { class: 's-day', 'aria-label': 'Tag' }, s.day || '–'),
    h('div', { class: 's-main' },
      h('div', { class: 's-top' },
        s.goal ? h('span', { class: 'chip' }, s.goal) : null,
        tag ? h('span', { class: 's-tag' }, tag) : null),
      s.program ? h('div', { class: 's-program' }, s.program) : null),
    h('div', { class: 's-time', 'aria-label': 'Dauer' }, fmtDuration(s.minutes)));
}
