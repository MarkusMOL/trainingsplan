import { h } from './dom.js';
import { icon } from './icons.js';

export function appBar({ title, backHref = null, actions = [] }) {
  return h('header', { class: 'appbar' },
    backHref
      ? h('a', { class: 'icon-btn', href: backHref, 'aria-label': 'Zurück' }, icon('back'))
      : h('span', { class: 'appbar-spacer' }),
    h('h1', {}, title),
    h('div', { class: 'appbar-actions' }, actions));
}
