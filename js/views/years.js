import { h } from '../ui/dom.js';
import { appBar } from '../ui/appbar.js';
import { lineChart, barChart } from '../ui/charts.js';
import { state } from '../core/store.js';
import * as settings from '../core/settings.js';
import { SPORTS, SPORT_HUES } from '../core/config.js';
import { todayUTC } from '../core/plan.js';
import {
  SPORT_KEYS, yearsData, weeklyMinutes, weeksToRace, phaseTotals, blocksOf, average,
} from '../core/stats.js';
import { fmtDuration, fmtPercent } from '../core/format.js';

const sportColor = (s) => `hsl(${SPORT_HUES[s] ?? 215} 65% 52%)`;
const yearColor = (i) => `hsl(${Math.round((i * 137.5 + 20) % 360)} 62% 52%)`;
const hours = (min) => min / 60;
const hFmt = (v) => `${Math.round(v)}`;

function message(text) {
  return h('div', { class: 'screen' }, appBar({ title: 'Vorjahre', backHref: '#/' }),
    h('main', { class: 'content' }, h('div', { class: 'banner' }, text), h('a', { class: 'btn', href: '#/settings' }, 'Zu den Einstellungen')));
}

const loadSel = () => { try { return JSON.parse(settings.get('yearsSel') || 'null'); } catch { return null; } };

export default {
  mount(root) {
    const { plan, ist, events: ev, history } = state;
    if (!plan) return root.append(message(state.error || 'Keine Plandaten geladen.'));
    if (!history) return root.append(message('Es sind keine Vorjahresdaten geladen.'));
    if (!ev?.a1) return root.append(message('Für den Vergleich wird das Datum von Race A1 benötigt (Basisdaten).'));

    const startISO = settings.get('startDate');
    const today = todayUTC();
    const allYears = history.years.filter((y) => y.race < ev.a1.date);
    if (!allYears.length) return root.append(message('Keine Vorjahre vor dem aktuellen Race A1 vorhanden.'));

    let selected = (loadSel() ?? allYears.slice(-3).map((y) => y.year)).filter((y) => allYears.some((a) => a.year === y));
    let sport = settings.get('yearsSport', 'Alle');
    const sports = SPORT_KEYS.filter((s) => allYears.some((y) => y.sessions.some((x) => x.sport === s)));
    if (sport !== 'Alle' && !sports.includes(sport)) sport = 'Alle';
    const idxOf = (year) => allYears.findIndex((y) => y.year === year);

    const out = h('div', {});
    const save = () => { settings.set('yearsSel', JSON.stringify(selected)); settings.set('yearsSport', sport); draw(); };
    const toggle = (year) => { selected = selected.includes(year) ? selected.filter((y) => y !== year) : [...selected, year].sort(); save(); };

    function controls() {
      const chip = (label, on, onclick, color) => h('button', { class: 'chip-btn', type: 'button', 'aria-pressed': String(on), onclick },
        color ? h('i', { class: 'dot', style: { '--lv': color } }) : null, label);
      return h('section', { class: 'card' },
        h('h2', {}, 'Sportart'),
        h('div', { class: 'chips' }, ['Alle', ...sports].map((s) => chip(s === 'Alle' ? 'Alle' : (SPORTS[s]?.label ?? s), sport === s, () => { sport = s; save(); }, s === 'Alle' ? null : sportColor(s)))),
        h('h2', { style: { marginTop: '14px' } }, 'Vorjahre auswählen'),
        h('div', { class: 'chips' }, allYears.map((y) => chip(String(y.year), selected.includes(y.year), () => toggle(y.year), yearColor(idxOf(y.year))))),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { selected = allYears.slice(-3).map((y) => y.year); save(); } }, 'Letzte 3'),
          h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { selected = allYears.map((y) => y.year); save(); } }, 'Alle'),
          h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { selected = []; save(); } }, 'Keine')));
    }

    function draw() {
      const d = yearsData({ plan, ist, ev, history, startISO, sport, selected, today });
      const sportLabel = sport === 'Alle' ? 'alle Sportarten' : (SPORTS[sport]?.label ?? sport);
      const secs = [controls()];

      if (!d.sel.length) {
        secs.push(h('div', { class: 'banner' }, 'Wähle mindestens ein Vorjahr aus, um zu vergleichen.'));
      } else {
        // ---- Stand zum gleichen Zeitpunkt ----
        const when = d.offNow > 0 ? `${d.offNow} Tage (${Math.floor(d.offNow / 7)} Wochen) vor Race A1` : 'am Renntag';
        const delta = d.delta;
        const maxMin = Math.max(d.curMin, d.planMin, ...d.rows.map((r) => r.minutes), 1);
        const row = (label, minutes, cls, color) => h('div', { class: 'row row-simple' },
          h('span', { class: 'row-label' }, color ? h('i', { class: 'dot', style: { '--lv': color } }) : null, label),
          h('span', { class: 'row-val' }, fmtDuration(minutes)),
          h('span', { class: 'row-pct' }, d.avgMin > 0 && cls !== 'avg' ? fmtPercent((minutes / d.avgMin) * 100) : ''),
          h('span', { class: 'bar', role: 'presentation' }, h('span', { class: `bar-fill ${cls ?? ''}`, style: { width: `${(minutes / maxMin) * 100}%` } })));
        secs.push(h('section', { class: 'card' },
          h('h2', {}, `Stand ${when}`),
          delta === null ? null
            : h('div', { class: 'big' }, h('span', { class: delta >= 0 ? 'pos' : 'neg' }, `${delta >= 0 ? '+' : '−'}${Math.abs(Math.round(delta * 100))}\u00a0%`),
                h('span', { class: 'big-note' }, 'gegenüber dem Ø der gewählten Jahre')),
          h('p', { class: 'hint' }, `Trainingsumfang (${sportLabel}) bis zum gleichen Abstand zum Rennen. Prozent = Anteil am Ø der gewählten Jahre.${delta === null && d.avgMin !== null ? ' Die Abweichung wird erst angezeigt, sobald der Vorjahres-Ø mindestens 3 Stunden beträgt.' : ''}`),
          h('div', { class: 'rows' },
            row('Aktuell (Ist)', d.curMin, 'cur'),
            row('Plan (Soll)', d.planMin, 'plan'),
            row('Ø gewählte', d.avgMin ?? 0, 'avg'),
            d.rows.map((r) => row(String(r.year), r.minutes, null, yearColor(idxOf(r.year)))))));

        // ---- Kumulierter Verlauf ----
        const N = d.maxOff;
        const pts = (arr, upTo = arr.length - 1) => Array.from({ length: Math.min(upTo, arr.length - 1) + 1 }, (_, i) => [i, hours(arr[i])]);
        const nowIdx = N - d.offNow;
        const xTicks = [];
        for (let off = Math.floor(N / 28) * 28; off >= 0; off -= 28) xTicks.push({ x: N - off, label: off === 0 ? 'Race' : String(off / 7) });
        secs.push(h('section', { class: 'card' },
          h('h2', {}, `Kumulierter Umfang (h) · ${sportLabel}`),
          lineChart({
            xMin: 0, xMax: N, xTicks, yFmt: hFmt, label: 'Kumulierter Trainingsumfang gegen Wochen bis Race A1',
            marks: d.offNow > 0 ? [{ x: nowIdx, label: 'heute', color: 'var(--danger)' }] : [],
            series: [
              { points: pts(d.series.plan), color: 'var(--muted)', width: 1.6, dash: '2 3' },
              ...d.series.years.map((s, i) => ({ points: pts(s), color: yearColor(idxOf(d.sel[i].year)), width: 1.2, opacity: 0.85 })),
              { points: pts(d.series.avg), color: 'var(--text)', width: 1.8, dash: '6 3' },
              { points: pts(d.series.cur, nowIdx), color: 'var(--accent)', width: 3 },
            ],
          }),
          h('p', { class: 'legend legend-left' },
            h('span', {}, h('i', { class: 'ln ln-cur' }), 'Aktuell (Ist)'), h('span', {}, h('i', { class: 'ln ln-plan' }), 'Plan'),
            h('span', {}, h('i', { class: 'ln ln-avg' }), 'Ø gewählte'), h('span', {}, 'x-Achse: Wochen bis Race A1'))));

        // ---- Wochenumfang ----
        const wCur = weeklyMinutes(d.cur, sport), wPlan = weeklyMinutes(d.planS, sport);
        const wYears = d.sel.map((y) => ({ y, m: weeklyMinutes(y.sessions, sport), n: weeksToRace(y.startOff) }));
        const maxW = Math.max(...wPlan.keys(), weeksToRace(d.maxOff - 1));
        const weeks = Array.from({ length: maxW }, (_, i) => maxW - i); // früheste Woche links
        const avgOf = (w) => average(wYears.filter((e) => w <= e.n).map((e) => hours(e.m.get(w) ?? 0)));
        secs.push(h('section', { class: 'card' },
          h('h2', {}, `Wochenumfang (h) · ${sportLabel}`),
          barChart({
            bars: weeks.map((w) => ({ label: String(w), parts: [{ value: hours(wCur.get(w) ?? 0), color: 'var(--accent)' }] })),
            lines: [
              { points: weeks.map((w, i) => [i, hours(wPlan.get(w) ?? 0)]), color: 'var(--muted)', dash: '2 3', width: 1.6 },
              { points: weeks.map((w, i) => [i, avgOf(w) ?? 0]), color: 'var(--text)', dash: '6 3', width: 1.8 },
            ],
            xEvery: 4, yFmt: (v) => v.toFixed(v < 10 ? 1 : 0), label: 'Wochenumfang je Woche bis Race A1',
          }),
          h('p', { class: 'legend legend-left' },
            h('span', {}, h('i', { class: 'sw sw-cur' }), 'Aktuell (Ist)'), h('span', {}, h('i', { class: 'ln ln-plan' }), 'Plan'),
            h('span', {}, h('i', { class: 'ln ln-avg' }), 'Ø gewählte'), h('span', {}, 'x-Achse: Wochen bis Race A1'))));

        // ---- Blöcke ----
        const planPhase = phaseTotals(d.planS, sport), curPhase = phaseTotals(d.cur, sport);
        const yPhases = d.sel.map((y) => phaseTotals(y.sessions, sport));
        const blocks = blocksOf(plan).filter((b) => b.weeks[0].start < ev.a1.date);
        const rows = blocks.map((b) => {
          const key = b.season ? `${b.season} - ${b.label}` : b.label;
          const vals = yPhases.map((m) => m.get(key)?.minutes).filter((v) => v !== undefined);
          return { label: b.label, plan: planPhase.get(key)?.minutes ?? 0, cur: curPhase.get(key)?.minutes ?? 0, avg: vals.length ? average(vals) : null, n: vals.length };
        });
        const maxB = Math.max(...rows.flatMap((r) => [r.plan, r.cur, r.avg ?? 0]), 1);
        const bar = (v, cls) => h('span', { class: 'hbar' }, h('span', { class: `hbar-fill ${cls}`, style: { width: `${(v / maxB) * 100}%` } }), h('b', {}, fmtDuration(v)));
        secs.push(h('section', { class: 'card' },
          h('h2', {}, `Trainingsblöcke · ${sportLabel}`),
          h('div', { class: 'blocks' }, rows.map((r) => h('div', { class: 'blk' },
            h('div', { class: 'blk-name' }, r.label, r.n ? h('small', {}, ` · Ø aus ${r.n} Jahr${r.n === 1 ? '' : 'en'}`) : null),
            h('div', { class: 'blk-bars' },
              h('span', { class: 'hb-label' }, 'Plan'), bar(r.plan, 'is-plan'),
              h('span', { class: 'hb-label' }, 'Ist'), bar(r.cur, 'is-cur'),
              r.avg !== null ? [h('span', { class: 'hb-label' }, 'Ø VJ'), bar(r.avg, 'is-avg')] : null)))),
          h('p', { class: 'hint' }, 'Gesamtumfang je Phase. Für Vorjahre zählen nur Jahre, deren Phasen genauso benannt sind (z. B. „01 - BASE 1“).')));
      }

      // ---- Jahresübersicht (alle Jahre, unabhängig von der Auswahl) ----
      const sportsShown = sport === 'Alle' ? sports : [sport];
      const preRace = (sessions) => sessions.filter((s) => s.off >= 0);
      const parts = (sessions) => sportsShown.map((s) => ({ value: hours(sessions.filter((x) => x.sport === s).reduce((n, x) => n + x.minutes, 0)), color: sportColor(s) }));
      const planPre = preRace(yearsOf(plan, ev, startISO));
      secs.push(h('section', { class: 'card' },
        h('h2', {}, 'Jahresumfang bis Race A1 (h)'),
        barChart({
          bars: [...allYears.map((y) => ({ label: `’${String(y.year).slice(2)}`, parts: parts(preRace(y.sessions)) })), { label: 'Plan', parts: parts(planPre) }],
          yFmt: hFmt, topLabels: true, xEvery: 1, label: 'Trainingsumfang je Jahr bis Race A1',
        }),
        h('p', { class: 'legend legend-left' }, sportsShown.map((s) => h('span', {}, h('i', { class: 'dot', style: { '--lv': sportColor(s) } }), SPORTS[s]?.label ?? s))),
        d_km(allYears, selected)));

      out.replaceChildren(...secs);
    }

    function yearsOf(planArg, evArg, startArg) { return yearsData({ plan: planArg, ist, ev: evArg, history, startISO: startArg, sport: 'Alle', selected: [], today }).planS; }

    // Kilometer-Tabelle der gewählten Jahre (bis Race A1)
    function d_km(yearsAll, sel) {
      const rows = yearsAll.filter((y) => sel.includes(y.year));
      if (!rows.length) return null;
      const km = (y, s) => y.sessions.filter((x) => x.sport === s && x.off >= 0).reduce((n, x) => n + x.km, 0);
      return h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, h('th', {}, 'km bis Race'), ['Swim', 'Bike', 'Run'].map((s) => h('th', {}, SPORTS[s]?.label ?? s)))),
        h('tbody', {}, rows.map((y) => h('tr', {}, h('td', {}, String(y.year)), ['Swim', 'Bike', 'Run'].map((s) => h('td', {}, Math.round(km(y, s)).toLocaleString('de-DE'))))))));
    }

    root.append(h('div', { class: 'screen' }, appBar({ title: 'Vorjahre', backHref: '#/' }), h('main', { class: 'content' }, out)));
    draw();
  },
};
