/* =====================================================================
   config.js — ALL the app's settings and fixed lists live here.
   WHY: if you want a new category or a new currency, you only edit THIS
   file. Nothing else in the program needs to change.
   ===================================================================== */

// ---- Database info (used by db.js) ----
export const DB_NAME = 'spending-tracker';
export const DB_VERSION = 1;          // bump this ONLY when you add/remove an object store
export const APP_FILE_TAG = 'spending-tracker'; // written inside exported JSON files
export const FILE_VERSION = 1;        // version of the JSON export format

// ---- Spending categories (shown in forms, charts, budgets) ----
// color = the chart color for this category
export const EXPENSE_CATEGORIES = [
  { id: 'food',      label: 'Food',      color: '#34A853' },
  { id: 'transport', label: 'Transport', color: '#4285F4' },
  { id: 'school',    label: 'School',    color: '#FBBC05' },
  { id: 'bills',     label: 'Bills',     color: '#EA4335' },
  { id: 'fun',       label: 'Fun',       color: '#E8710A' },
  { id: 'shopping',  label: 'Shopping',  color: '#9C6ADE' },
  { id: 'health',    label: 'Health',    color: '#26A69A' },
  { id: 'other',     label: 'Other',     color: '#9AA0A6' },
];

// ---- Money-received categories (allowance is the main one) ----
export const INCOME_CATEGORIES = [
  { id: 'allowance', label: 'Allowance', color: '#34A853' },
  { id: 'gift',      label: 'Gift',      color: '#FBBC05' },
  { id: 'income',    label: 'Other income', color: '#4285F4' },
];

// Find a category (spending OR income) by id. Returns undefined if unknown.
export const findCategory = (id) =>
  [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].find((c) => c.id === id);

// ---- Currency choices (just the symbol is stored) ----
export const CURRENCIES = ['₱', '$', '€', '£', '¥'];

// ---- Budget rules ----
export const WARN_AT = 0.8; // show a yellow warning when 80% of the budget is used
export const BACKUP_REMIND_DAYS = 14; // nudge the user to export a backup after this many days

// ---- Default values used on a fresh install ----
export const DEFAULT_SETTINGS = {
  theme: 'dark',                              // dark mode is the default
  currency: '₱',
  budget: { totalLimit: 0, categoryLimits: {} }, // 0 = "no limit set"
  goal: { label: '', amount: 0 },                // savings target (0 = none)
  lastBackup: 0,                                 // time (ms) of the last JSON export; 0 = never
};
