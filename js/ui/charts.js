// Kleine SVG-Diagramme ohne Bibliothek. Farben über CSS-Variablen (hell/dunkel), Größe skaliert mit der Breite.
const NS = 'http://www.w3.org/2000/svg';

export function svg(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined && v !== false) el.setAttribute(k, v);
  const add = (c) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(add); else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}

const niceMax = (v) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};

function frame({ width, height, m, xMin, xMax, yMax, yTicks, yFmt, xTicks, label }) {
  const W = width, H = height;
  const sx = (x) => m.l + ((x - xMin) / (xMax - xMin || 1)) * (W - m.l - m.r);
  const sy = (y) => m.t + (1 - y / yMax) * (H - m.t - m.b);
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': label });
  for (const t of yTicks) {
    root.append(
      svg('line', { class: 'ch-grid', x1: m.l, x2: W - m.r, y1: sy(t), y2: sy(t) }),
      svg('text', { class: 'ch-text', x: m.l - 5, y: sy(t) + 3, 'text-anchor': 'end' }, yFmt(t)));
  }
  for (const t of xTicks) {
    root.append(svg('text', { class: 'ch-text', x: sx(t.x), y: H - m.b + 13, 'text-anchor': 'middle' }, t.label));
  }
  return { root, sx, sy, W, H, m };
}

const ticksFor = (yMax, n = 4) => Array.from({ length: n + 1 }, (_, i) => (yMax / n) * i);

/**
 * Liniendiagramm.
 * series: [{ points: [[x, y], …], color, width, dash, opacity }], marks: [{ x, label, color }] senkrechte Linien.
 */
export function lineChart({ series, xMin, xMax, xTicks, yMax, yTicks, yFmt = (v) => String(Math.round(v)), marks = [], width = 360, height = 230, label = 'Diagramm' }) {
  const top = yMax ?? niceMax(Math.max(...series.flatMap((s) => s.points.map((p) => p[1])), 1) * 1.05);
  const f = frame({ width, height, m: { l: 38, r: 10, t: 12, b: 24 }, xMin, xMax, yMax: top, yTicks: yTicks ?? ticksFor(top), yFmt, xTicks, label });
  for (const mk of marks) {
    f.root.append(
      svg('line', { x1: f.sx(mk.x), x2: f.sx(mk.x), y1: f.m.t, y2: height - f.m.b, stroke: mk.color ?? 'currentColor', 'stroke-width': 1.2, 'stroke-dasharray': '3 3', opacity: 0.8 }),
      mk.label ? svg('text', { class: 'ch-text', x: f.sx(mk.x), y: f.m.t - 2, 'text-anchor': 'middle', fill: mk.color }, mk.label) : null);
  }
  for (const s of series) {
    if (!s.points.length) continue;
    const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${f.sx(p[0]).toFixed(1)},${f.sy(p[1]).toFixed(1)}`).join('');
    f.root.append(svg('path', {
      d, fill: 'none', stroke: s.color, 'stroke-width': s.width ?? 1.6, 'stroke-dasharray': s.dash ?? null,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: s.opacity ?? 1,
    }));
  }
  return f.root;
}

/**
 * Balkendiagramm (auch gestapelt).
 * bars: [{ label, parts: [{ value, color }], x? }], guides: [{ y, label, dash }]. xEvery: nur jede n-te Beschriftung.
 * lines: zusätzliche Linien über den Balken, Punkte in Balkenindex-Koordinaten: [{ points: [[i, y]], color, dash }]
 */
export function barChart({ bars, yMax, yTicks, yFmt = (v) => String(Math.round(v)), guides = [], lines = [], xEvery = 1, width = 360, height = 220, label = 'Diagramm', topLabels = false }) {
  const total = (b) => b.parts.reduce((n, p) => n + p.value, 0);
  const top = yMax ?? niceMax(Math.max(...bars.map(total), ...lines.flatMap((l) => l.points.map((p) => p[1])), 1) * 1.08);
  const m = { l: 38, r: 8, t: 12, b: 24 };
  const n = bars.length;
  const f = frame({
    width, height, m, xMin: -0.5, xMax: n - 0.5, yMax: top, yTicks: yTicks ?? ticksFor(top), yFmt, label,
    xTicks: bars.map((b, i) => ({ x: i, label: i % xEvery === 0 ? b.label : '' })),
  });
  const bw = Math.max(1.5, ((width - m.l - m.r) / n) * 0.72);
  bars.forEach((b, i) => {
    let acc = 0;
    for (const p of b.parts) {
      if (p.value <= 0) continue;
      const y0 = f.sy(acc), y1 = f.sy(acc + p.value);
      f.root.append(svg('rect', { x: f.sx(i) - bw / 2, y: y1, width: bw, height: Math.max(0.5, y0 - y1), rx: 1.5, fill: p.color }));
      acc += p.value;
    }
    if (topLabels && acc > 0) f.root.append(svg('text', { class: 'ch-text', x: f.sx(i), y: f.sy(acc) - 3, 'text-anchor': 'middle' }, yFmt(acc)));
  });
  for (const g of guides) {
    f.root.append(
      svg('line', { x1: m.l, x2: width - m.r, y1: f.sy(g.y), y2: f.sy(g.y), stroke: g.color ?? 'currentColor', 'stroke-width': 1, 'stroke-dasharray': g.dash ?? '4 3', opacity: 0.7 }),
      g.label ? svg('text', { class: 'ch-text', x: width - m.r, y: f.sy(g.y) - 3, 'text-anchor': 'end', fill: g.color }, g.label) : null);
  }
  for (const l of lines) {
    const d = l.points.map((p, i) => `${i ? 'L' : 'M'}${f.sx(p[0]).toFixed(1)},${f.sy(p[1]).toFixed(1)}`).join('');
    f.root.append(svg('path', { d, fill: 'none', stroke: l.color, 'stroke-width': l.width ?? 1.8, 'stroke-dasharray': l.dash ?? null, 'stroke-linejoin': 'round' }));
  }
  return f.root;
}
