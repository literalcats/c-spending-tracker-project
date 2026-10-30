/* =====================================================================
   charts.js — tiny chart makers, no libraries (so they work offline).
   Each function takes data and returns an HTML/SVG string.
   Colors come from the data or from CSS variables (see styles.css).
   ===================================================================== */
import { esc, money } from './ui/dom.js';

// ---- Donut chart: how spending is split by category ----
// items = [{ label, total, color }]
export function donut(items, currency) {
  const total = items.reduce((n, i) => n + i.total, 0);
  if (!total) return '';
  const R = 52, C = 2 * Math.PI * R; // radius and circle length
  let offset = 0;
  const arcs = items.map((i) => {
    const len = (i.total / total) * C;
    const arc = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${i.color}" stroke-width="20"
      stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}"><title>${esc(i.label)}: ${esc(money(i.total, currency))}</title></circle>`;
    offset += len;
    return arc;
  }).join('');
  return `<svg class="donut" viewBox="0 0 140 140" role="img" aria-label="Spending by category">
    <g transform="rotate(-90 70 70)">${arcs}</g>
    <text x="70" y="66" text-anchor="middle" class="donut-small">Spent</text>
    <text x="70" y="84" text-anchor="middle" class="donut-big">${esc(money(total, currency))}</text></svg>`;
}

// ---- Grouped bar chart ----
// labels = ['1–4', ...]   series = [{ name, color, values: [..] }]
export function groupedBars(labels, series, currency) {
  const n = labels.length;
  if (!n) return '';
  const H = 200, top = 12, bottom = 26;
  const slot = series.length * 16 + 22;
  const W = Math.max(320, n * slot + 20);
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const plotH = H - top - bottom;
  const barW = 14;

  const bars = labels.map((label, i) => {
    const gx = 10 + i * ((W - 20) / n) + ((W - 20) / n - series.length * barW) / 2;
    const rects = series.map((s, j) => {
      const h = (s.values[i] / max) * plotH;
      return `<rect x="${gx + j * barW}" y="${top + plotH - h}" width="${barW - 2}" height="${h}" rx="3" fill="${s.color}">
        <title>${esc(s.name)} (${esc(label)}): ${esc(money(s.values[i], currency))}</title></rect>`;
    }).join('');
    const cx = 10 + i * ((W - 20) / n) + (W - 20) / n / 2;
    return `${rects}<text x="${cx}" y="${H - 8}" text-anchor="middle" class="axis">${esc(label)}</text>`;
  }).join('');

  const legend = series.map((s) => `<span class="legend-item"><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('');
  return `<div class="chart-scroll" tabindex="0" role="region" aria-label="Chart (scrolls sideways if wide)"><svg viewBox="0 0 ${W} ${H}" style="min-width:${Math.min(W, 640)}px" role="img" aria-label="Bar chart">
    <line x1="10" x2="${W - 10}" y1="${top + plotH}" y2="${top + plotH}" class="axis-line"/>${bars}</svg></div>
    <div class="legend">${legend}</div>`;
}
