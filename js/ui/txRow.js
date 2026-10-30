/* =====================================================================
   ui/txRow.js — draws ONE transaction as a list row (used by 2 screens).
   ===================================================================== */
import { findCategory } from '../config.js';
import { esc, money, fmtDate } from './dom.js';
import { icons } from './icons.js';

export function txRow(t, currency, withActions = false) {
  const cat = findCategory(t.category);
  const sign = t.type === 'income' ? '+' : '-';
  const actions = withActions
    ? `<span class="tx-actions">
        <button class="icon-btn" data-click="edit-tx" data-id="${esc(t.id)}" aria-label="Edit">${icons.edit}</button>
        <button class="icon-btn" data-click="delete-tx" data-id="${esc(t.id)}" aria-label="Delete">${icons.trash}</button>
      </span>` : '';
  return `<li class="tx">
    <span class="dot" style="background:${cat?.color || '#9AA0A6'}"></span>
    <div class="tx-main">
      <strong>${esc(cat?.label || t.category)}</strong>
      <small>${esc(fmtDate(t.date))}${t.note ? ` <span class="note">${esc(t.note)}</span>` : ''}</small>
    </div>
    <span class="amt ${t.type}">${sign}${esc(money(t.amount, currency))}</span>${actions}
  </li>`;
}
