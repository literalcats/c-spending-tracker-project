/* =====================================================================
   ui/dom.js — small helpers for building HTML safely.
   IMPORTANT: always wrap user-typed text in esc() before putting it in
   HTML. This stops someone (or an imported file) from injecting code.
   ===================================================================== */
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 1234.5 → "₱1,234.50"   (negative → "-₱1,234.50")
export function money(n, currency) {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? '-' : ''}${currency}${abs}`;
}

// "2026-10-28" → "Oct 28"
export const fmtDate = (ds) =>
  new Date(ds + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// "2026-10" → "October 2026"
export const fmtMonth = (ym) =>
  new Date(ym + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

// A progress bar. ratio can be above 1 (the bar just stops at 100%).
export function progress(ratio, state = 'ok', label = 'Progress') {
  const pct = Math.min(100, Math.round(ratio * 100));
  return `<div class="bar" role="progressbar" aria-label="${esc(label)}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
    <span class="bar-fill ${state}" style="width:${pct}%"></span></div>`;
}

import { icons } from './icons.js';

// The month picker row (◀ month ▶) used on several screens.
export function monthPicker(ym) {
  return `<div class="month-picker">
    <button class="icon-btn" data-click="month-prev" aria-label="Previous month">${icons.left}</button>
    <input type="month" value="${esc(ym)}" data-change="set-month" aria-label="Choose month">
    <button class="icon-btn" data-click="month-next" aria-label="Next month">${icons.right}</button>
  </div>`;
}
