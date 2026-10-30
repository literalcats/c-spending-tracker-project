/* =====================================================================
   views/budget.js — set the monthly limit, per-category limits
   and the savings goal. Values are cleaned by store.saveSetting().
   ===================================================================== */
import { EXPENSE_CATEGORIES } from '../config.js';
import { inMonth, spentByCategory } from '../calc.js';
import { saveSetting } from '../store.js';
import { esc, money } from '../ui/dom.js';
import { toast } from '../ui/toast.js';

// Show a saved number inside an input (empty if 0 / not set).
const val = (n) => (n ? n : '');

export default {
  id: 'budget', label: 'Budget', icon: 'target',

  render(state) {
    const { budget, goal, currency: cur } = state.settings;
    const spent = Object.fromEntries(spentByCategory(inMonth(state.transactions, state.month)).map((c) => [c.id, c.total]));

    return `<form class="stack" data-submit="save-budget" novalidate>
      <section class="card">
        <h3>Monthly spending limit</h3>
        <p class="muted">You get a warning at 80% and an alert when you go over. Leave empty for no limit.</p>
        <label class="field">Total limit (${esc(cur)})
          <input name="total" type="number" inputmode="decimal" min="0" step="0.01" value="${val(budget.totalLimit)}" placeholder="No limit">
        </label>
      </section>

      <section class="card">
        <h3>Limits per category</h3>
        <div class="cat-fields">
          ${EXPENSE_CATEGORIES.map((c) => `<label class="field"><span><i class="dot" style="background:${c.color}"></i>${esc(c.label)}</span>
            <input name="cat_${c.id}" type="number" inputmode="decimal" min="0" step="0.01" value="${val(budget.categoryLimits[c.id])}" placeholder="No limit">
            <small class="muted">Spent this month: ${esc(money(spent[c.id] || 0, cur))}</small></label>`).join('')}
        </div>
      </section>

      <section class="card">
        <h3>Savings goal</h3>
        <label class="field">What are you saving for?
          <input name="goalLabel" maxlength="40" value="${esc(goal.label)}" placeholder="e.g. New headphones">
        </label>
        <label class="field">Target amount (${esc(cur)})
          <input name="goalAmount" type="number" inputmode="decimal" min="0" step="0.01" value="${val(goal.amount)}" placeholder="No target">
        </label>
      </section>

      <button class="btn primary" type="submit">Save budget</button>
    </form>`;
  },

  submit: {
    'save-budget': async (form) => {
      const f = new FormData(form);
      const categoryLimits = {};
      for (const c of EXPENSE_CATEGORIES) categoryLimits[c.id] = f.get(`cat_${c.id}`);
      await saveSetting('budget', { totalLimit: f.get('total'), categoryLimits });
      await saveSetting('goal', { label: f.get('goalLabel'), amount: f.get('goalAmount') });
      toast('Budget saved');
    },
  },
};
