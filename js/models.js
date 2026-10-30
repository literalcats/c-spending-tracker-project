/* =====================================================================
   models.js — the SHAPE of our data + validation.
   A "transaction" is one money record: either received or spent.
   Every record (typed by the user OR imported from a file) must pass
   through buildTransaction(). That keeps bad data out of the database.
   ===================================================================== */
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, DEFAULT_SETTINGS } from './config.js';

/**
 * One money record, exactly as stored in IndexedDB.
 * @typedef {Object} Transaction
 * @property {string} id         unique id
 * @property {'income'|'expense'} type
 * @property {number} amount     always positive, 2 decimals (the type gives the sign)
 * @property {string} category   an id from config.js
 * @property {string} date       "YYYY-MM-DD"
 * @property {string} note       up to 80 characters
 * @property {number} createdAt  ms timestamp (tie-breaker when sorting)
 */

// Make a unique id for each record.
export function newId() {
  return crypto.randomUUID ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Today's date as "YYYY-MM-DD" in the user's own timezone.
export function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Get the category list that matches the type.
export function categoriesFor(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

// Is this a real calendar date like "2026-02-28"?
function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// A usable timestamp is a finite number above 0. Anything else (NaN, Infinity, text) becomes 0 = "unknown".
export const cleanTimestamp = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);

// Is this a real month like "2026-10"? Use it on EVERY month that comes from an input box.
export const isValidMonth = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s));

/* Which settings get written when a backup is imported?
   "replace" means the file becomes the whole truth, so a budget or goal
   that the file does not contain is reset to its default (not kept). */
export function settingsForImport(settings, mode) {
  const out = { ...settings };
  if (mode === 'replace') {
    for (const key of ['budget', 'goal']) out[key] ??= structuredClone(DEFAULT_SETTINGS[key]);
  }
  return out;
}

/* Check + clean one transaction.
   Returns { ok: true, value } or { ok: false, error: 'message' }.
   `existing` (optional) keeps the old id/createdAt when editing. */
export function buildTransaction(input, existing = null) {
  const type = input.type === 'income' ? 'income' : input.type === 'expense' ? 'expense' : null;
  if (!type) return { ok: false, error: 'Choose Spent or Received.' };

  const amount = Math.round(Number(input.amount) * 100) / 100; // 2 decimal places
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter an amount above 0.' };
  if (amount > 1e9) return { ok: false, error: 'That amount is too large.' };

  const date = String(input.date || '');
  if (!isValidDate(date)) return { ok: false, error: 'Pick a valid date.' };

  // Unknown category? Fall back to the last one ("Other") instead of failing.
  const list = categoriesFor(type);
  const category = list.some((c) => c.id === input.category) ? input.category : list[list.length - 1].id;

  return {
    ok: true,
    value: {
      id: existing?.id || (typeof input.id === 'string' && input.id) || newId(),
      type, amount, category, date,
      note: String(input.note || '').trim().slice(0, 80),
      createdAt: existing?.createdAt || cleanTimestamp(input.createdAt) || Date.now(),
    },
  };
}

// Clean the budget object (so a bad import can't break the dashboard).
export function cleanBudget(b) {
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v) * 100) / 100 : 0);
  const limits = {};
  for (const c of EXPENSE_CATEGORIES) {
    const v = num(b?.categoryLimits?.[c.id]);
    if (v) limits[c.id] = v;
  }
  return { totalLimit: num(b?.totalLimit), categoryLimits: limits };
}

// Clean the savings goal.
export function cleanGoal(g) {
  const amt = Number(g?.amount);
  return {
    label: String(g?.label || '').trim().slice(0, 40),
    amount: Number.isFinite(amt) && amt > 0 ? Math.round(amt * 100) / 100 : 0,
  };
}
