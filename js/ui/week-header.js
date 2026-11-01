import { h } from './dom.js';
import { icon } from './icons.js';

/** Eine Kennzahl-Zelle der Kopfzeile. */
export function statCell(label, value, extra = null, compact = false) {
  return h('div', { class: 'stat' },
    h('span', { class: 'stat-label' }, label),
    h('span', { class: 'stat-value' + (compact ? ' stat-compact' : '') }, value),
    extra);
}

/**
 * Gemeinsame, angeheftete Kopfzeile für Wochenansichten.
 * prev/next: Wochennummer oder undefined (Button deaktiviert); today: Wochennummer der aktuellen Woche oder null.
 */
export function weekHeader({ week, lastWeek, prev, next, today, meta, stats, go, openPicker }) {
  return h('header', { class: 'week-head' },
    h('div', { class: 'wh-row' },
      h('a', { class: 'icon-btn', href: '#/', 'aria-label': 'Startseite' }, icon('back')),
      h('div', { class: 'wh-nav' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Vorherige Woche', disabled: prev === undefined, onclick: () => go(prev) }, icon('left')),
        h('button', { class: 'wh-title', type: 'button', 'aria-label': 'Woche wählen', onclick: openPicker },
          h('span', { class: 'wh-week' }, `Woche ${week}`),
          h('span', { class: 'wh-of' }, `von ${lastWeek}`)),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Nächste Woche', disabled: next === undefined, onclick: () => go(next) }, icon('right'))),
      h('button', {
        class: 'icon-btn', type: 'button', 'aria-label': 'Zur aktuellen Woche',
        disabled: today === null || today === week, onclick: () => go(today),
      }, icon('today'))),
    h('div', { class: 'wh-meta' }, meta || '–'),
    h('div', { class: 'wh-stats' }, stats));
}
