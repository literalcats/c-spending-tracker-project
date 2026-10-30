/* =====================================================================
   ui/txDialog.js — the "Add / Edit record" pop-up form.
   It lives in index.html as <dialog id="txDialog">. We fill it with a
   form every time it opens, so it always starts clean.
   ===================================================================== */
import { categoriesFor, todayStr } from '../models.js';
import { saveTransaction, getState } from '../store.js';
import { esc } from './dom.js';
import { toast } from './toast.js';

const dlg = () => document.getElementById('txDialog');

// Build the <option> list for the chosen type.
const options = (type, selected) =>
  categoriesFor(type).map((c) => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(c.label)}</option>`).join('');

function formHtml(tx, type) {
  const cur = getState().settings.currency;
  return `<form method="dialog" id="txForm" novalidate>
    <h2>${tx ? 'Edit record' : 'Add record'}</h2>
    <div class="segmented" role="radiogroup" aria-label="Type">
      <label><input type="radio" name="type" value="expense" ${type === 'expense' ? 'checked' : ''}><span>Spent</span></label>
      <label><input type="radio" name="type" value="income" ${type === 'income' ? 'checked' : ''}><span>Received</span></label>
    </div>
    <label class="field">Amount (${esc(cur)})
      <input name="amount" type="number" inputmode="decimal" step="0.01" min="0" required value="${tx ? tx.amount : ''}" placeholder="0.00">
    </label>
    <label class="field">Category
      <select name="category">${options(type, tx?.category)}</select>
    </label>
    <label class="field">Date
      <input name="date" type="date" required value="${tx ? tx.date : todayStr()}">
    </label>
    <label class="field">Note (optional)
      <input name="note" maxlength="80" value="${tx ? esc(tx.note) : ''}" placeholder="e.g. Lunch at canteen">
    </label>
    <p class="form-error" id="txError" role="alert"></p>
    <div class="dialog-actions">
      <button type="button" class="btn ghost" data-close>Cancel</button>
      <button type="submit" class="btn primary">Save</button>
    </div>
  </form>`;
}

// Open the dialog. Pass a transaction to edit it, or nothing to add a new one.
export function openTxDialog(tx = null) {
  const d = dlg();
  d.dataset.editId = tx?.id || '';
  d.innerHTML = formHtml(tx, tx?.type || 'expense');
  d.showModal();
  d.querySelector('[name="amount"]').focus();
}

// Set up the dialog's own events ONCE at startup.
export function initTxDialog() {
  const d = dlg();

  // Type switched → swap the category list.
  d.addEventListener('change', (e) => {
    if (e.target.name === 'type') {
      d.querySelector('[name="category"]').innerHTML = options(e.target.value);
    }
  });

  // Cancel button, or clicking the dark backdrop → close.
  d.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]') || e.target === d) d.close();
  });

  // Save button.
  d.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const errorEl = d.querySelector('#txError');
    try {
      const result = await saveTransaction(Object.fromEntries(f), d.dataset.editId || null);
      if (!result.ok) { errorEl.textContent = result.error; return; }
      d.close();
      toast('Saved');
    } catch (err) {                       // e.g. the browser refused to write to storage
      console.error(err);
      errorEl.textContent = 'Could not save. Check that browser storage is available.';
    }
  });
}
