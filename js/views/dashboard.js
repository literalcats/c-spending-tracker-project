/* =====================================================================
   views/dashboard.js — the Home screen: numbers, alerts, chart.
   A "view" is an object with:
     id / label / icon  → how it appears in the menu
     render(state)      → returns the HTML for the screen
     click / change / submit → (optional) handlers for data-click etc.
   Reading tip: render() at the bottom only ASSEMBLES small helper
   functions. Each helper draws one card and can be read on its own.
   ===================================================================== */
import { backupReminder, inMonth, totals, balanceUpTo, budgetStatus, categoryFlags, goalProgress, projection, spentByCategory } from '../calc.js';
import { BACKUP_REMIND_DAYS } from '../config.js';
import { todayStr } from '../models.js';
import { esc, money, progress, monthPicker } from '../ui/dom.js';
import { icons } from '../ui/icons.js';
import { txRow } from '../ui/txRow.js';
import { donut } from '../charts.js';

// ---------- Small card builders (each returns an HTML string) ----------

// One colored number block. `tone` picks its color in the CSS.
const stat = (tone, label, value, sub = '') =>
  `<div class="stat ${tone}"><span class="stat-label">${label}</span><strong class="stat-value">${esc(value)}</strong><span class="stat-sub">${esc(sub)}</span></div>`;

const banner = (kind, text, extra = '') => `<div class="alert ${kind}">${esc(text)}${extra}</div>`;

// Shown to first-time users (no records yet).
const emptyState = () => `<section class="empty">
  <h2>Start with your allowance</h2>
  <p>Add the money you received, then record what you spend. Your balance, budget and charts appear here.</p>
  <button class="btn primary" data-click="add-tx">${icons.plus} Add your first record</button>
</section>`;

// Budget warnings: total limit first, then any category that is over its own limit.
function alertsHtml({ status, limit, flags, proj, cur, spent }) {
  const out = [];
  if (status.state === 'over') out.push(banner('over', `Over budget by ${money(-status.left, cur)}. You spent ${money(spent, cur)} of ${money(limit, cur)}.`));
  else if (status.state === 'warn') out.push(banner('warn', `You used ${Math.round(status.ratio * 100)}% of your budget. ${money(status.left, cur)} left.`));
  else if (proj.overBudget) out.push(banner('warn', `At your current pace you will pass your ${money(limit, cur)} budget this month.`));
  for (const f of flags.filter((x) => x.state === 'over')) {
    out.push(banner('over', `${f.label} is over its limit by ${money(-f.left, cur)}.`));
  }
  return out.join('');
}

// Gentle nudge to export a backup (browsers can delete local data).
function reminderHtml(reminder) {
  if (!reminder) return '';
  const text = reminder.never
    ? "You haven't saved a backup yet. Your data only lives in this browser."
    : `Your last backup was ${reminder.days} days ago.`;
  return banner('info', text, ' <a href="#/data">Back up now</a>');
}

// The 4 colored blocks. The 4th changes for current vs past/future months.
function statsHtml({ t, balance, proj, cur }) {
  const fourth = proj.mode === 'now'
    ? stat('projected', 'Projected money left', money(proj.projectedBalance, cur), `at ${money(proj.perDay, cur)} per day`)
    : stat('projected', 'Saved this month', money(t.net, cur), 'received minus spent');
  return `<div class="stats">
    ${stat('income', 'Received', money(t.income, cur), 'this month')}
    ${stat('expense', 'Spent', money(t.expense, cur), 'this month')}
    ${stat('balance', 'Money left', money(balance, cur), 'including past months')}
    ${fourth}
  </div>`;
}

const budgetCard = ({ status, limit, spent, cur }) => `<section class="card">
  <h3>Monthly budget</h3>
  ${limit
    ? `${progress(status.ratio, status.state, 'Monthly budget used')}<p class="muted">${esc(money(spent, cur))} of ${esc(money(limit, cur))} used</p>`
    : '<p class="muted">No limit yet. <a href="#/budget">Set a budget</a> to get warnings.</p>'}
</section>`;

const goalCard = ({ goal, settingsGoal, cur }) => `<section class="card">
  <h3>${esc(settingsGoal.label || 'Savings goal')}</h3>
  ${goal.set
    ? `${progress(goal.ratio, goal.reached ? 'ok' : 'goal', 'Savings goal progress')}
       <p class="muted">${goal.reached ? 'Goal reached.' : `${esc(money(goal.left, cur))} to go`} (target ${esc(money(settingsGoal.amount, cur))})</p>`
    : '<p class="muted">No target yet. <a href="#/budget">Set a savings goal</a>.</p>'}
</section>`;

const categoriesCard = (cats, cur) => `<section class="card">
  <h3>Where your money went</h3>
  ${cats.length
    ? `<div class="donut-row">${donut(cats, cur)}<ul class="legend-list">${cats.map((c) =>
        `<li><i style="background:${c.color}"></i><span>${esc(c.label)}</span><b>${esc(money(c.total, cur))}</b></li>`).join('')}</ul></div>`
    : '<p class="muted">No spending recorded this month.</p>'}
</section>`;

const recentCard = (monthTx, cur) => `<section class="card">
  <h3>Recent</h3>
  ${monthTx.length
    ? `<ul class="tx-list">${monthTx.slice(0, 5).map((x) => txRow(x, cur)).join('')}</ul><a href="#/transactions">See all records</a>`
    : '<p class="muted">Nothing recorded this month.</p>'}
</section>`;

// ---------- The view ----------
export default {
  id: 'dashboard', label: 'Home', icon: 'home',

  render(state) {
    const { transactions, settings, month } = state;
    if (!transactions.length) return emptyState();

    // 1) Gather the numbers once...
    const cur = settings.currency, limit = settings.budget.totalLimit;
    const monthTx = inMonth(transactions, month);
    const t = totals(monthTx);
    const balance = balanceUpTo(transactions, month);
    const status = budgetStatus(t.expense, limit);
    const proj = projection(transactions, month, todayStr(), limit);
    const flags = categoryFlags(monthTx, settings.budget.categoryLimits);
    const goal = goalProgress(balance, settings.goal);
    const reminder = backupReminder(transactions, settings.lastBackup, Date.now(), BACKUP_REMIND_DAYS);

    // 2) ...then assemble the screen from the small builders above.
    return `
      ${monthPicker(month)}
      ${alertsHtml({ status, limit, flags, proj, cur, spent: t.expense })}
      ${reminderHtml(reminder)}
      ${statsHtml({ t, balance, proj, cur })}
      <div class="grid-2">
        ${budgetCard({ status, limit, spent: t.expense, cur })}
        ${goalCard({ goal, settingsGoal: settings.goal, cur })}
      </div>
      ${categoriesCard(spentByCategory(monthTx), cur)}
      ${recentCard(monthTx, cur)}`;
  },
};
