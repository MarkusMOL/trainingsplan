import { h } from './dom.js';
import { fmtDuration, fmtShortDate, weekdayShort } from '../core/format.js';

const SYMBOL = { green: '✓', yellow: '◐', red: '✕' };
const LEVEL_WORD = { green: 'erfüllt', yellow: 'teilweise erfüllt', red: 'nicht erfüllt' };

/** Planeinheit (oder ungeplante Ist-Einheit) mit Ampelstatus. */
export function compareCard(item) {
  const { plan, ist } = item;
  const first = ist[0];
  const cls = item.kind === 'extra' ? 'lv-extra' : item.level ? `lv-${item.level}` : 'lv-pending';

  const day = first ? weekdayShort(first.date) : (plan?.day || '–');
  const goal = plan?.goal ?? first?.goal;
  const tag = [plan?.regKey ?? first?.regKey, plan?.abc ?? first?.abc].filter(Boolean).join(' · ');
  const goalDiffers = plan && first && first.goal && first.goal !== plan.goal;

  let sub;
  if (item.kind === 'extra') sub = 'ungeplant';
  else if (item.status === 'pending') sub = `offen · Soll ${fmtDuration(item.planMinutes)}`;
  else sub = `${SYMBOL[item.level]} ${Math.round(item.ratio * 100)}\u00a0% · Soll ${fmtDuration(item.planMinutes)}`;

  return h('article', { class: `session cmp ${cls}`, 'aria-label': item.level ? LEVEL_WORD[item.level] : undefined },
    h('div', { class: 's-day', 'aria-label': 'Tag' }, day),
    h('div', { class: 's-main' },
      h('div', { class: 's-top' },
        goal ? h('span', { class: 'chip' }, goal) : null,
        tag ? h('span', { class: 's-tag' }, tag) : null,
        goalDiffers ? h('span', { class: 's-tag' }, `Ist-Ziel: ${first.goal}`) : null),
      plan?.program ? h('div', { class: 's-program' }, plan.program) : null,
      ist.map((e) => h('div', { class: 's-ist' },
        h('b', {}, `${fmtShortDate(e.date)} `), e.program || ''))),
    h('div', { class: 's-result' },
      h('div', { class: 's-time' }, item.status === 'pending' ? '–' : fmtDuration(item.istMinutes)),
      h('div', { class: 's-sub' }, sub)));
}
