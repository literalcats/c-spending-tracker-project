/* =====================================================================
   calc.js — ALL the math. "Pure" functions only:
   they take data IN and give an answer OUT. They never touch the
   screen or the database. That makes them easy to test and impossible
   to break by changing the UI.
   Dates are text like "2026-10-28". Months are text like "2026-10".
   ===================================================================== */
import { EXPENSE_CATEGORIES, WARN_AT } from './config.js';

const r2 = (n) => Math.round(n * 100) / 100; // round to 2 decimals (avoids 0.1+0.2 problems)

// ---------- Month helpers ----------
export const monthOf = (dateStr) => dateStr.slice(0, 7);
export const inMonth = (txs, ym) => txs.filter((t) => monthOf(t.date) === ym);

export function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// ---------- Totals ----------
// Add up received / spent / net for a list of transactions.
export function totals(txs) {
  let income = 0, expense = 0;
  for (const t of txs) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income: r2(income), expense: r2(expense), net: r2(income - expense) };
}

// Money left = everything received minus everything spent, up to the END of month `ym`.
// (Money not spent last month carries over to this month.)
export function balanceUpTo(txs, ym) {
  return totals(txs.filter((t) => monthOf(t.date) <= ym)).net;
}

// ---------- Categories ----------
// Spending per category, biggest first. Each item gets a `share` (0 to 1).
export function spentByCategory(txs) {
  const sums = {};
  for (const t of txs) if (t.type === 'expense') sums[t.category] = (sums[t.category] || 0) + t.amount;
  const total = Object.values(sums).reduce((a, b) => a + b, 0);
  return EXPENSE_CATEGORIES
    .filter((c) => sums[c.id] > 0)
    .map((c) => ({ ...c, total: r2(sums[c.id]), share: total ? sums[c.id] / total : 0 }))
    .sort((a, b) => b.total - a.total);
}

// ---------- Weeks ----------
// Weeks run Monday → Sunday. Returns the Monday of the week a date is in.
function weekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// One entry per week of the month: { label: "5–11", income, expense }
export function byWeek(txs, ym) {
  const last = daysInMonth(ym);
  const weeks = new Map(); // Monday date -> week info
  for (let day = 1; day <= last; day++) {
    const key = weekStart(`${ym}-${String(day).padStart(2, '0')}`);
    if (!weeks.has(key)) weeks.set(key, { from: day, to: day, income: 0, expense: 0 });
    weeks.get(key).to = day;
  }
  for (const t of inMonth(txs, ym)) {
    const w = weeks.get(weekStart(t.date));
    if (w) w[t.type === 'income' ? 'income' : 'expense'] += t.amount;
  }
  return [...weeks.values()].map((w) => ({
    label: w.from === w.to ? `${w.from}` : `${w.from}–${w.to}`,
    income: r2(w.income), expense: r2(w.expense),
  }));
}

// ---------- Budget ----------
// How much of a limit is used? state: none | ok | warn | over
export function budgetStatus(spent, limit) {
  if (!limit) return { state: 'none', ratio: 0, left: null };
  const ratio = spent / limit;
  const state = spent > limit ? 'over' : ratio >= WARN_AT ? 'warn' : 'ok';
  return { state, ratio, left: r2(limit - spent) };
}

// Which categories have their own limit AND are over / close to it?
export function categoryFlags(txs, limits) {
  const spent = Object.fromEntries(spentByCategory(txs).map((c) => [c.id, c.total]));
  return EXPENSE_CATEGORIES
    .filter((c) => limits[c.id])
    .map((c) => ({ ...c, spent: spent[c.id] || 0, limit: limits[c.id], ...budgetStatus(spent[c.id] || 0, limits[c.id]) }));
}

// ---------- Savings goal ----------
export function goalProgress(balance, goal) {
  if (!goal.amount) return { set: false };
  return {
    set: true,
    ratio: Math.max(0, balance) / goal.amount,
    left: r2(Math.max(0, goal.amount - balance)),
    reached: balance >= goal.amount,
  };
}

// ---------- Projection ("if I keep spending like this...") ----------
export function projection(txs, ym, today, limit) {
  const thisMonth = monthOf(today);
  if (ym !== thisMonth) return { mode: ym < thisMonth ? 'past' : 'future' };

  const spent = totals(inMonth(txs, ym)).expense;
  const day = Number(today.slice(8, 10));
  const dim = daysInMonth(ym);
  const perDay = spent / day;
  const daysLeft = dim - day;
  return {
    mode: 'now',
    perDay: r2(perDay),
    daysLeft,
    projectedSpend: r2(perDay * dim),
    projectedBalance: r2(balanceUpTo(txs, ym) - perDay * daysLeft),
    overBudget: Boolean(limit) && perDay * dim > limit, // on pace to break the limit?
  };
}

// ---------- Compare two months ----------
export function compareMonths(txs, a, b) {
  const A = inMonth(txs, a), B = inMonth(txs, b);
  const catA = Object.fromEntries(spentByCategory(A).map((c) => [c.id, c.total]));
  const catB = Object.fromEntries(spentByCategory(B).map((c) => [c.id, c.total]));
  return {
    a: totals(A), b: totals(B),
    categories: EXPENSE_CATEGORIES
      .map((c) => ({ ...c, a: catA[c.id] || 0, b: catB[c.id] || 0 }))
      .filter((c) => c.a || c.b)
      .map((c) => ({ ...c, diff: r2(c.b - c.a) })),
  };
}

// ---------- Backup reminder ----------
// Returns null (no reminder) or { days, never }.
// Counts from the last backup; if there never was one, from the oldest record.
export function backupReminder(txs, lastBackup, now, afterDays) {
  if (!txs.length) return null;
  const since = lastBackup || txs.reduce((oldest, t) => Math.min(oldest, t.createdAt), Infinity);
  const days = Math.floor((now - since) / 86400000);
  return days >= afterDays ? { days, never: !lastBackup } : null;
}
