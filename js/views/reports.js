/* =====================================================================
   views/reports.js — charts by week + compare two months.
   cmpA / cmpB remember which months the user picked. They start empty
   (null) and fall back to "last month vs the viewed month".
   render() only READS them. Only the change handlers below write them.
   ===================================================================== */
import { byWeek, compareMonths, shiftMonth } from '../calc.js';
import { isValidMonth } from '../models.js';
import { esc, money, fmtMonth, monthPicker } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { groupedBars } from '../charts.js';

let cmpA = null, cmpB = null;

// Accept a month typed/picked by the user ONLY if it is a real "YYYY-MM".
// (Firefox desktop shows a plain text box, so the text can be anything.)
function pickMonth(el, ctx, apply) {
  if (el.value && !isValidMonth(el.value)) toast('Use the format YYYY-MM, for example 2026-10.', 'error');
  else if (el.value) apply(el.value);
  ctx.refresh(); // redraw either way, which also resets a bad value in the box
}

// "+₱50.00" / "-₱20.00" colored good/bad. goodWhenDown: spending going DOWN is good.
function change(diff, cur, goodWhenDown) {
  if (!diff) return '<span class="muted">no change</span>';
  const good = goodWhenDown ? diff < 0 : diff > 0;
  return `<span class="${good ? 'pos' : 'neg'}">${diff > 0 ? '+' : '-'}${esc(money(Math.abs(diff), cur))}</span>`;
}

// One table row: label | month A | month B | change
const compareRow = (label, a, b, cur, goodWhenDown) =>
  `<tr><th>${label}</th><td>${esc(money(a, cur))}</td><td>${esc(money(b, cur))}</td><td>${change(b - a, cur, goodWhenDown)}</td></tr>`;

function weeklyCard(state, cur) {
  const weeks = byWeek(state.transactions, state.month);
  return `<section class="card">
    <h3>Week by week</h3>
    <p class="muted">Days of ${esc(fmtMonth(state.month))}, Monday to Sunday.</p>
    ${groupedBars(weeks.map((w) => w.label), [
      { name: 'Received', color: '#34A853', values: weeks.map((w) => w.income) },
      { name: 'Spent', color: '#EA4335', values: weeks.map((w) => w.expense) },
    ], cur)}
  </section>`;
}

function compareCard(state, cur, monthA, monthB) {
  const cmp = compareMonths(state.transactions, monthA, monthB);
  const categoryChart = cmp.categories.length
    ? `<h4>Spending by category</h4>${groupedBars(cmp.categories.map((c) => c.label.slice(0, 8)), [
        { name: fmtMonth(monthA), color: '#4285F4', values: cmp.categories.map((c) => c.a) },
        { name: fmtMonth(monthB), color: '#E8710A', values: cmp.categories.map((c) => c.b) },
      ], cur)}`
    : '<p class="muted">No spending in either month.</p>';

  return `<section class="card">
    <h3>Compare two months</h3>
    <div class="compare-pick">
      <label class="field">Month A <input type="month" value="${esc(monthA)}" data-change="cmp-a"></label>
      <label class="field">Month B <input type="month" value="${esc(monthB)}" data-change="cmp-b"></label>
    </div>
    <div class="table-wrap" tabindex="0" role="region" aria-label="Comparison table (scrolls sideways if wide)"><table>
      <thead><tr><th></th><th>${esc(fmtMonth(monthA))}</th><th>${esc(fmtMonth(monthB))}</th><th>Change</th></tr></thead>
      <tbody>
        ${compareRow('Received', cmp.a.income, cmp.b.income, cur, false)}
        ${compareRow('Spent', cmp.a.expense, cmp.b.expense, cur, true)}
        ${compareRow('Saved', cmp.a.net, cmp.b.net, cur, false)}
      </tbody>
    </table></div>
    ${categoryChart}
  </section>`;
}

export default {
  id: 'reports', label: 'Reports', icon: 'chart',

  render(state) {
    const cur = state.settings.currency;
    const monthA = cmpA ?? shiftMonth(state.month, -1);
    const monthB = cmpB ?? state.month;
    return `${monthPicker(state.month)}${weeklyCard(state, cur)}${compareCard(state, cur, monthA, monthB)}`;
  },

  change: {
    'cmp-a': (el, ctx) => pickMonth(el, ctx, (v) => { cmpA = v; }),
    'cmp-b': (el, ctx) => pickMonth(el, ctx, (v) => { cmpB = v; }),
  },
};
