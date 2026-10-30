/* =====================================================================
   store.js — the app's single "source of truth" (the current data).
   HOW IT WORKS:
     1. loadAll() reads the database into `state` once at startup.
     2. Any change (add/edit/delete...) → save to IndexedDB → update
        `state` → call every subscriber so the screen re-draws.
   Views never touch the database directly; they only call these functions.
   ===================================================================== */
import * as db from './db.js';
import { DEFAULT_SETTINGS, CURRENCIES } from './config.js';
import { buildTransaction, cleanBudget, cleanGoal, cleanTimestamp, isValidMonth, settingsForImport, todayStr } from './models.js';

const state = {
  transactions: [],
  settings: structuredClone(DEFAULT_SETTINGS),
  month: todayStr().slice(0, 7), // the month the user is looking at
};

// ---- Subscribers (a tiny "tell me when data changes" system) ----
const listeners = new Set();
export const getState = () => state;
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() {
  // try/catch: if one listener crashes, the others still run.
  listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });
}

// ---- Setting cleaners: one per setting key. A Map, so unknown keys are never found. ----
const SETTING_CLEANERS = new Map([
  ['theme', (v) => (v === 'light' ? 'light' : 'dark')],
  ['currency', (v) => (CURRENCIES.includes(v) ? v : DEFAULT_SETTINGS.currency)],
  ['budget', cleanBudget],
  ['goal', cleanGoal],
  ['lastBackup', cleanTimestamp],
]);

const sortTx = () =>
  state.transactions.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

// ---- Load everything from IndexedDB (called once at startup) ----
export async function loadAll() {
  const [rows, settingRows] = await Promise.all([db.getAll('transactions'), db.getAll('settings')]);
  state.transactions = rows.map((r) => buildTransaction(r)).filter((r) => r.ok).map((r) => r.value);
  state.settings = structuredClone(DEFAULT_SETTINGS);
  for (const { key, value } of settingRows) {
    const clean = SETTING_CLEANERS.get(key);
    if (clean) state.settings[key] = clean(value);
  }
  sortTx();
  emit();
}

// ---- Transactions ----
// Add a new one, or edit if `id` is given. Returns { ok, error? }.
export async function saveTransaction(input, id = null) {
  const existing = id ? state.transactions.find((t) => t.id === id) : null;
  const result = buildTransaction(input, existing);
  if (!result.ok) return result;
  await db.put('transactions', result.value);
  state.transactions = state.transactions.filter((t) => t.id !== result.value.id);
  state.transactions.push(result.value);
  sortTx();
  emit();
  return { ok: true };
}

export async function deleteTransaction(id) {
  await db.remove('transactions', id);
  state.transactions = state.transactions.filter((t) => t.id !== id);
  emit();
}

// ---- Settings ----
export async function saveSetting(key, value) {
  const cleaner = SETTING_CLEANERS.get(key);
  if (!cleaner) return;
  const clean = cleaner(value);
  await db.put('settings', { key, value: clean });
  state.settings[key] = clean;
  emit();
}

// ---- Month the user is viewing (not saved; resets to this month on reload) ----
export function setMonth(ym) {
  if (!isValidMonth(ym)) return;
  state.month = ym;
  emit();
}

// ---- Import: mode 'merge' keeps old data, 'replace' makes the file the whole truth ----
export async function importData({ transactions, settings }, mode) {
  if (mode === 'replace') await db.replaceAll('transactions', transactions); // all-or-nothing
  else await db.putMany('transactions', transactions);

  const rows = Object.entries(settingsForImport(settings, mode))
    .filter(([key]) => SETTING_CLEANERS.has(key))
    .map(([key, value]) => ({ key, value: SETTING_CLEANERS.get(key)(value) }));
  await db.putMany('settings', rows);
  await loadAll();
}

// ---- Delete everything ----
export async function resetAll() {
  await db.clear('transactions');
  await db.clear('settings');
  await loadAll();
}
