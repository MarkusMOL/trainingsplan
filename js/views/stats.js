import { h } from '../ui/dom.js';
import { appBar } from '../ui/appbar.js';
import { icon } from '../ui/icons.js';
import { barChart } from '../ui/charts.js';
import { state } from '../core/store.js';
import * as settings from '../core/settings.js';
import { go } from '../core/router.js';
import { SPORTS, THRESHOLDS, LEVEL_LABEL } from '../core/config.js';
import { currentWeekInfo, todayUTC } from '../core/plan.js';
import { blocksOf, blockProjection, seasonStats } from '../core/stats.js';
import { levelOf } from '../core/compare.js';
import { fmtDuration, fmtPercent, fmtRange, fmtShortDate } from '../core/format.js';

const pct = (r) => (r === null || r === undefined ? '–' : fmtPercent(r * 100));
const SCALE = 1.2; // Balken reichen von 0 bis 120 %

/** Fortschrittsbalken 0–120 % mit Marke bei 90 %. */
const levelBar = (ratio, level) => h('span', { class: 'bar', role: 'presentation' },
  h('span', { class: `bar-fill ${level ? `lv-${level}` : ''}`, style: { width: `${Math.min(1, (ratio ?? 0) / SCALE) * 100}%` } }),
  h('span', { class: 'bar-mark', style: { left: `${(THRESHOLDS.green / SCALE) * 100}%` } }));

const dot = (level) => h('span', { class: `dot lv-${level ?? 'pending'}`, 'aria-hidden': 'true' });

function message(text) {
  return h('div', { class: 'screen' }, appBar({ title: 'Auswertung', backHref: '#/' }),
    h('main', { class: 'content' }, h('div', { class: 'banner' }, text), h('a', { class: 'btn', href: '#/settings' }, 'Zu den Einstellungen')));
}

/** Stapelbalken: erledigt / verpasst / offen im Verhältnis zum Plan des Blocks. */
function blockBar(bp) {
  // Basis: Plan-Umfang, bei Übererfüllung die Summe aller Teile, damit nichts abgeschnitten wird
  const base = Math.max(bp.planTotal, bp.done + bp.extra + bp.missed + bp.pending);
  const w = (v) => `${(v / base) * 100}%`;
  return h('div', { class: 'stack', role: 'img', 'aria-label': 'Block: erledigt, ungeplant, verpasst, offen' },
    h('span', { class: 'stack-done', style: { width: w(bp.done) } }),
    h('span', { class: 'stack-extra', style: { width: w(bp.extra) } }),
    h('span', { class: 'stack-missed', style: { width: w(bp.missed) } }),
    h('span', { class: 'stack-pending', style: { width: w(bp.pending) } }),
    h('span', { class: 'stack-mark', style: { left: `${((THRESHOLDS.green * bp.planTotal) / base) * 100}%` } }));
}

function quoteText(bp) {
  if (!bp.started && bp.pending === bp.planTotal) return { value: '–', note: 'Der Block hat noch nicht begonnen.' };
  if (bp.finished) return { value: pct(bp.actual / bp.planTotal), note: 'Block abgeschlossen: Erfüllung insgesamt.' };
  if (bp.needQuote === 0) return { value: '0 %', note: 'Die 90 % sind bereits gesichert.' };
  if (bp.needQuote === Infinity || bp.needQuote > 1.5) return { value: '> 150 %', note: 'Über 90 % sind kaum noch erreichbar.' };
  return { value: pct(bp.needQuote), note: `Mit dieser Quote bei den restlichen Einheiten landet der Block über ${Math.round(THRESHOLDS.green * 100)} %.` };
}

export default {
  mount(root, [blockParam]) {
    const { plan, ist } = state;
    if (!plan) return root.append(message(state.error || 'Keine Plandaten geladen.'));
    if (!ist) return root.append(message(state.istError || 'Für die Auswertung werden Ist-Daten benötigt.'));
    const startISO = settings.get('startDate');
    const today = todayUTC();
    const cur = currentWeekInfo(plan, startISO, today);
    if (cur.status === 'unset') return root.append(message('Ohne Wochendaten im Plan ist keine Auswertung möglich.'));
    if (cur.status === 'before') return root.append(message(`Der Plan startet in ${cur.daysUntil} Tag(en) – es gibt noch nichts auszuwerten.`));

    const st = seasonStats(plan, ist, startISO, today);
    const blocks = blocksOf(plan).filter((b) => b.firstWeek <= cur.week);
    const curBlock = blocks.findIndex((b) => b.lastWeek >= cur.week);
    const bi = Math.min(blocks.length - 1, Math.max(0, blockParam !== undefined ? parseInt(blockParam, 10) : curBlock));
    const bp = blockProjection(plan, ist, blocks[bi], startISO, today);
    const b = blocks[bi];
    const quote = quoteText(bp);
    const openBlock = (i) => go(`/stats/${i}`, { replace: true });

    // --- Wochen-Erfüllung ---
    const weeksWithDue = st.weeks.filter((w) => w.due > 0);
    const chart = weeksWithDue.length
      ? barChart({
          bars: st.weeks.map((w) => {
            // Balken = Gesamtquote; unterer Teil planmäßig (Ampelfarbe), oberer Teil ungeplant (blau); höchstens 150 %
            const planned = w.due > 0 ? (w.done / w.due) * 100 : 0, unplanned = w.due > 0 ? (w.extra / w.due) * 100 : 0;
            const f = Math.min(1, 150 / Math.max(1, planned + unplanned));
            return { label: String(w.week), parts: [{ value: planned * f, color: `var(--lv-${w.level ?? 'red'})` }, { value: unplanned * f, color: 'var(--accent)' }] };
          }),
          yMax: 150, yTicks: [0, 50, 100, 150], yFmt: (v) => `${Math.round(v)}`, xEvery: Math.max(1, Math.ceil(st.weeks.length / 12)),
          guides: [{ y: THRESHOLDS.green * 100, label: '90 %', color: 'var(--lv-green)' }, { y: THRESHOLDS.yellow * 100, label: '50 %', color: 'var(--lv-yellow)' }],
          label: 'Erfüllung je Woche in Prozent',
        })
      : null;

    root.append(h('div', { class: 'screen' },
      appBar({ title: 'Auswertung', backHref: '#/' }),
      h('main', { class: 'content' },
        // 1) Saison bis heute
        h('section', { class: 'card' },
          h('h2', {}, `Plan-Erfüllung bis heute · Woche ${st.currentWeek}`),
          h('div', { class: 'big' }, dot(st.level), pct(st.ratio), st.level ? h('span', { class: 'big-note' }, LEVEL_LABEL[st.level]) : null),
          levelBar(st.ratio, st.level),
          h('p', { class: 'hint' }, `Ist ${fmtDuration(st.actual)} h von ${fmtDuration(st.due)} h Soll${st.extra > 0 ? ` (darin ${fmtDuration(st.extra)} h ungeplant)` : ''} · Einheiten: ${st.count.done} erledigt, ${st.count.missed} verpasst, ${st.count.pending} offen${st.count.extra ? `, ${st.count.extra} ungeplant` : ''}`),
          h('div', { class: 'rows' }, st.bySport.map((s) => {
            const lvl = s.ratio === null ? null : levelOf(s.ratio);
            return h('div', { class: 'row' },
              h('span', { class: 'row-label' }, SPORTS[s.sport]?.icon ?? '•', ' ', SPORTS[s.sport]?.label ?? s.sport),
              h('span', { class: 'row-val' }, `${fmtDuration(s.actual)} / ${fmtDuration(s.due)}`),
              h('span', { class: 'row-pct' }, pct(s.ratio)),
              levelBar(s.ratio, lvl));
          }))),

        // 2) Wochenverlauf
        chart ? h('section', { class: 'card' }, h('h2', {}, 'Erfüllung je Woche (%)'), chart,
          h('p', { class: 'legend legend-left' }, h('span', {}, h('i', { class: 'sw sw-done' }), 'planmäßig (Farbe = Ampel)'), h('span', {}, h('i', { class: 'sw sw-extra' }), 'ungeplant (zählt mit)')),
          h('div', { class: 'facts' },
            h('span', {}, `Serie grüner Wochen: ${st.streak}`),
            st.best ? h('span', {}, `Beste: Woche ${st.best.week} (${pct(st.best.ratio)})`) : null,
            st.worst ? h('span', {}, `Schwächste: Woche ${st.worst.week} (${pct(st.worst.ratio)})`) : null)) : null,

        // 3) Block-Projektion
        h('section', { class: 'card' },
          h('div', { class: 'card-head' },
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Vorheriger Block', disabled: bi === 0, onclick: () => openBlock(bi - 1) }, icon('left')),
            h('div', { class: 'card-title' }, h('h2', {}, `Block ${b.label}`), h('span', { class: 'hint-inline' }, `Woche ${b.firstWeek}–${b.lastWeek}${bi === curBlock ? ' · aktuell' : ''}`)),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Nächster Block', disabled: bi >= blocks.length - 1, onclick: () => openBlock(bi + 1) }, icon('right'))),
          blockBar(bp),
          h('p', { class: 'legend legend-left' },
            h('span', {}, h('i', { class: 'sw sw-done' }), `erledigt ${fmtDuration(bp.done)}`),
            bp.extra > 0 ? h('span', {}, h('i', { class: 'sw sw-extra' }), `ungeplant ${fmtDuration(bp.extra)}`) : null,
            h('span', {}, h('i', { class: 'sw sw-missed' }), `verpasst ${fmtDuration(bp.missed)}`),
            h('span', {}, h('i', { class: 'sw sw-pending' }), `offen ${fmtDuration(bp.pending)}`),
            h('span', {}, `Soll gesamt ${fmtDuration(bp.planTotal)} h`)),
          h('div', { class: 'kpis' },
            h('div', { class: 'kpi' }, h('span', { class: 'kpi-label' }, 'Quote bisher'), h('span', { class: 'kpi-val' }, dot(bp.level), pct(bp.ratioSoFar))),
            h('div', { class: 'kpi' }, h('span', { class: 'kpi-label' }, 'Prognose Block'), h('span', { class: 'kpi-val' }, dot(bp.projectedLevel), bp.finished ? pct(bp.actual / bp.planTotal) : pct(bp.projected))),
            h('div', { class: 'kpi' }, h('span', { class: 'kpi-label' }, 'Bestfall (Rest 100 %)'), h('span', { class: 'kpi-val' }, pct(bp.best))),
            h('div', { class: 'kpi' }, h('span', { class: 'kpi-label' }, bp.finished ? 'Ergebnis' : 'Rest-Quote für > 90 %'), h('span', { class: 'kpi-val' }, quote.value))),
          h('p', { class: 'hint' }, quote.note, bp.finished ? '' : ' Prognose = bisherige Quote (inkl. ungeplanter Einheiten) wird bei den restlichen Einheiten fortgeschrieben.')),

        // 4) Blöcke im Überblick
        h('section', { class: 'card' }, h('h2', {}, 'Blöcke im Überblick'),
          h('div', { class: 'rows' }, blocks.map((blk, i) => {
            const p = blockProjection(plan, ist, blk, startISO, today);
            const r = p.finished ? p.actual / p.planTotal : p.ratioSoFar;
            return h('a', { class: 'row row-link' + (i === bi ? ' is-active' : ''), href: `#/stats/${i}` },
              h('span', { class: 'row-label' }, `${blk.label}`, h('small', {}, ` · W${blk.firstWeek}–${blk.lastWeek}`)),
              h('span', { class: 'row-val' }, p.finished ? 'abgeschlossen' : p.started ? 'läuft' : 'offen'),
              h('span', { class: 'row-pct' }, pct(r)),
              levelBar(r, r === null ? null : levelOf(r)));
          }))))));
  },
};
