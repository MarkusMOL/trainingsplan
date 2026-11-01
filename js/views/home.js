import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { appBar } from '../ui/appbar.js';
import { tiles } from '../tiles/registry.js';
import { state, setState } from '../core/store.js';
import { multiImportButton, importNoteBanner } from '../ui/import-button.js';
import * as settings from '../core/settings.js';
import { fmtShortDate, fmtDateTime } from '../core/format.js';
import { signIn, isConfigured } from '../core/onedrive.js';
import { syncNow, syncEnabled } from '../core/sync.js';

export default {
  mount(root) {
    const grid = h('div', { class: 'tile-grid' }, tiles.map((t) => {
      const { lines = [], level } = t.info?.() ?? {};
      return h('a', { class: 'tile', href: t.href },
        h('span', { class: 'tile-icon' }, icon(t.icon, 26)),
        h('span', { class: 'tile-title' }, t.title),
        lines[0] ? h('span', { class: 'tile-line' }, level ? h('span', { class: `dot lv-${level}`, 'aria-hidden': 'true' }) : null, lines[0]) : null,
        lines[1] ? h('span', { class: 'tile-line tile-line-2' }, lines[1]) : null);
    }));

    const { plan, ist, error, istError, warnings, sync, syncing, authError, source } = state;
    const od = syncEnabled();
    const note = state.importNote;
    setState({ importNote: null }); // nur einmal anzeigen
    const importedAt = Number(settings.get('importedAt', '0'));

    const foot = [];
    if (plan) foot.push(`Plan: ${plan.weeks.length} Wochen, ${plan.sessionCount} Einheiten`);
    if (ist) foot.push(`Ist: ${ist.entries.length} Einheiten${ist.lastDate ? ` (zuletzt ${fmtShortDate(ist.lastDate)})` : ''}`);
    if (od) {
      foot.push(syncing ? 'OneDrive: gleiche ab …'
        : source?.kind === 'onedrive' && source.at ? `OneDrive-Stand ${fmtDateTime(source.at)}`
        : 'OneDrive: noch nicht abgeglichen');
    }

    const banners = [
      importNoteBanner(note),
      authError ? h('div', { class: 'banner banner-error', role: 'alert' }, authError) : null,
      error ? h('div', { class: 'banner banner-error', role: 'alert' }, error, ' ', h('a', { href: '#/settings' }, 'Einstellungen')) : null,
      istError ? h('div', { class: 'banner banner-error', role: 'alert' }, istError) : null,
      ...(warnings ?? []).map((w) => h('div', { class: 'banner' }, w)),
      od && sync?.authNeeded && isConfigured()
        ? h('div', { class: 'banner' },
            'Die OneDrive-Anmeldung fehlt oder ist abgelaufen (das passiert etwa einmal täglich). Angezeigt werden die zuletzt geladenen Daten. ',
            h('button', { class: 'btn', type: 'button', style: { marginTop: '8px' }, onclick: () => signIn().catch((e) => alert(e.message)) }, 'Bei OneDrive anmelden'))
        : null,
      od && sync?.errors?.length
        ? h('div', { class: 'banner banner-error', role: 'alert' }, `OneDrive-Abgleich fehlgeschlagen – ${sync.errors.join(' · ')}`)
        : null,
    ];

    root.append(h('div', { class: 'screen' },
      appBar({
        title: 'Trainingsplan',
        actions: [
          od ? h('button', {
            class: 'icon-btn' + (syncing ? ' spin' : ''), type: 'button', 'aria-label': 'Mit OneDrive abgleichen',
            onclick: (e) => { e.currentTarget.classList.add('spin'); syncNow({ force: true }); },
          }, icon('refresh')) : null,
          h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'Einstellungen' }, icon('sliders')),
        ],
      }),
      h('main', { class: 'content' },
        banners,
        plan ? grid : null,
        !od ? h('div', { class: 'update-box' },
          multiImportButton({ label: 'Daten aktualisieren', cls: 'btn btn-wide' }),
          h('p', { class: 'hint' }, `Wähle eine oder mehrere CSV-Dateien aus (auch direkt aus OneDrive). Die Art der Datei wird erkannt.${importedAt ? ` Zuletzt aktualisiert: ${fmtDateTime(importedAt)}.` : ''}`)) : null,
        foot.length ? h('p', { class: 'footnote' }, foot.join(' · ')) : null)));
  },
};
