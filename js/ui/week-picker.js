import { h } from './dom.js';

/**
 * Inhalt des Wochen-Auswahl-Sheets, gruppiert nach Phase.
 * weeks: Array von Plan-Wochen; levelOf(week) optional -> 'green' | 'yellow' | 'red' | null (Ampel-Markierung);
 * eventOf(week) optional -> 'A' (Hauptrennen) | 'WK' | null (Termin-Markierung).
 */
export function weekPicker({ weeks, selected, today, pick, levelOf, eventOf }) {
  const wrap = h('div', { class: 'picker' });
  let lastKey = null, grid = null;
  for (const w of weeks) {
    const key = `${w.phase.season}|${w.phase.label}`;
    if (key !== lastKey) {
      wrap.append(h('h3', { class: 'picker-h' },
        w.phase.season ? `Block ${w.phase.season} · ${w.phase.label}` : (w.phase.label || '–')));
      grid = h('div', { class: 'picker-grid' });
      wrap.append(grid);
      lastKey = key;
    }
    const level = levelOf?.(w.week) ?? null;
    grid.append(h('button', {
      type: 'button',
      class: 'wk' + (w.week === selected ? ' is-selected' : '') + (w.week === today ? ' is-today' : ''),
      'data-level': level,
      'data-event': eventOf?.(w.week) ?? null,
      'aria-label': `Woche ${w.week}`,
      onclick: () => pick(w.week),
    }, String(w.week)));
  }
  return wrap;
}
