/* =====================================================================
   exporter.js — getting data OUT of the app and (JSON only) back IN.
     - JSON  : export + import (full backup)
     - CSV   : export only
     - Excel : export only (.xlsx)
   ===================================================================== */
import { APP_FILE_TAG, FILE_VERSION, CURRENCIES, findCategory } from './config.js';
import { buildTransaction, cleanBudget, cleanGoal } from './models.js';
import { buildXlsx } from './xlsx.js';

// ---- Download helper: turns data into a file the browser saves ----
function download(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const stamp = () => new Date().toISOString().slice(0, 10);

// ---- JSON: export ----
export function exportJSON(state) {
  const backup = {
    app: APP_FILE_TAG, version: FILE_VERSION, exportedAt: new Date().toISOString(),
    settings: { currency: state.settings.currency, budget: state.settings.budget, goal: state.settings.goal },
    transactions: state.transactions,
  };
  download(`spending-backup-${stamp()}.json`, new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
}

// ---- JSON: read + CHECK a file's text. Never trusts the file. ----
export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { return { ok: false, error: 'That file is not valid JSON.' }; }
  if (!data || data.app !== APP_FILE_TAG || !Array.isArray(data.transactions)) {
    return { ok: false, error: 'This is not a Spending Tracker backup file.' };
  }
  if (Number(data.version) > FILE_VERSION) {
    return { ok: false, error: 'This backup is from a newer version of the app.' };
  }
  const transactions = [];
  let skipped = 0;
  for (const raw of data.transactions) {
    const r = buildTransaction(raw || {});
    r.ok ? transactions.push(r.value) : skipped++; // bad rows are skipped, not fatal
  }
  const s = data.settings || {};
  const settings = {};
  if (CURRENCIES.includes(s.currency)) settings.currency = s.currency;
  if (s.budget) settings.budget = cleanBudget(s.budget);
  if (s.goal) settings.goal = cleanGoal(s.goal);
  return { ok: true, transactions, skipped, settings };
}

// ---- Table rows used by both CSV and Excel ----
const labelOf = (t) => findCategory(t.category)?.label || t.category;
function tableRows(transactions) {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  return [
    ['Date', 'Type', 'Category', 'Note', 'Amount'],
    ...sorted.map((t) => [t.date, t.type === 'income' ? 'Received' : 'Spent', labelOf(t), t.note, t.amount]),
  ];
}

// ---- CSV: export ----
function csvCell(v) {
  let s = String(v);
  if (/^[=+@-]/.test(s) && typeof v === 'string') s = "'" + s; // stops "formula injection" in Excel
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function exportCSV(transactions) {
  const text = tableRows(transactions).map((r) => r.map(csvCell).join(',')).join('\r\n');
  // \uFEFF (BOM) makes Excel read special characters correctly.
  download(`spending-${stamp()}.csv`, new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' }));
}

// ---- Excel: export ----
export function exportExcel(transactions) {
  download(`spending-${stamp()}.xlsx`, buildXlsx(tableRows(transactions)));
}
