/* =====================================================================
   views/transactions.js — the full list of records for a month,
   with filter (All / Spent / Received), edit and delete.
   `filter` is local to this file: it only affects this screen.
   ===================================================================== */
import { inMonth } from '../calc.js';
import { deleteTransaction } from '../store.js';
import { monthPicker } from '../ui/dom.js';
import { txRow } from '../ui/txRow.js';
import { openTxDialog } from '../ui/txDialog.js';
import { toast } from '../ui/toast.js';

let filter = 'all'; // 'all' | 'expense' | 'income'

const CHIPS = [['all', 'All'], ['expense', 'Spent'], ['income', 'Received']];

export default {
  id: 'transactions', label: 'Records', icon: 'list',

  render(state) {
    const cur = state.settings.currency;
    const rows = inMonth(state.transactions, state.month).filter((t) => filter === 'all' || t.type === filter);
    return `
      ${monthPicker(state.month)}
      <div class="chips">${CHIPS.map(([v, l]) =>
        `<button class="chip ${filter === v ? 'on' : ''}" data-click="tx-filter" data-value="${v}">${l}</button>`).join('')}</div>
      <section class="card">
        ${rows.length
          ? `<ul class="tx-list">${rows.map((t) => txRow(t, cur, true)).join('')}</ul>`
          : '<p class="muted">No records here yet. Tap the + button to add one.</p>'}
      </section>`;
  },

  click: {
    'tx-filter': (el, ctx) => { filter = el.dataset.value; ctx.refresh(); },
    'edit-tx': (el, ctx) => {
      const t = ctx.state.transactions.find((x) => x.id === el.dataset.id);
      if (t) openTxDialog(t);
    },
    'delete-tx': async (el) => {
      if (!confirm('Delete this record? This cannot be undone.')) return;
      await deleteTransaction(el.dataset.id);
      toast('Deleted');
    },
  },
};
