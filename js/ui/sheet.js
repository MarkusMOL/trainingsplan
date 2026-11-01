import { h } from './dom.js';
import { icon } from './icons.js';

/** Bottom-Sheet auf Basis von <dialog>. */
export function openSheet(title, content) {
  const dlg = h('dialog', { class: 'sheet', 'aria-label': title },
    h('div', { class: 'sheet-head' },
      h('h2', {}, title),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Schließen', onclick: () => dlg.close() }, icon('close'))),
    h('div', { class: 'sheet-body' }, content));
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  document.body.append(dlg);
  dlg.showModal();
  dlg.querySelector('.is-selected')?.scrollIntoView({ block: 'center' });
  return dlg;
}
