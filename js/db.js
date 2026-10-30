/* =====================================================================
   db.js — the ONLY file that talks to IndexedDB.
   IndexedDB = a small database built into the browser. Data stays on
   the user's device (no server needed).
   Two "object stores" (like tables):
     - transactions : one row per money record
     - settings     : key/value pairs (theme, budget, goal, currency...)
   Every function returns a Promise, so we use `await` when calling.
   ===================================================================== */
import { DB_NAME, DB_VERSION } from './config.js';

let dbPromise = null;                 // we open the database once and reuse it
let outdatedHandler = () => {};       // who to tell when another tab upgrades the database

// main.js uses this to show "please reload" when the app was updated in another tab.
export const onDatabaseOutdated = (fn) => { outdatedHandler = fn; };

function openDB() {
  if (dbPromise) return dbPromise;
  const attempt = new Promise((resolve, reject) => {
    let settled = false;
    const fail = (err) => { settled = true; reject(err); };
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    // Runs only the first time (or when DB_VERSION goes up): create the stores.
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('transactions')) {
        const s = db.createObjectStore('transactions', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      if (settled) { db.close(); return; } // we already gave up (blocked): don't leave a connection open
      // Another tab wants to upgrade the database: close ours so it isn't blocked.
      db.onversionchange = () => { db.close(); dbPromise = null; outdatedHandler(); };
      resolve(db);
    };
    req.onerror = () => fail(req.error);
    // Our upgrade is waiting because an OLD tab still has the database open.
    req.onblocked = () => {
      const err = new Error('The database upgrade is blocked by another open tab of this app.');
      err.name = 'DatabaseBlockedError';
      fail(err);
    };
  });
  dbPromise = attempt;
  // If opening fails, forget it so the next call can try again (instead of failing forever).
  attempt.catch(() => { if (dbPromise === attempt) dbPromise = null; });
  return attempt;
}

// Helper: run one action inside a transaction and wait until it finishes.
async function run(storeName, mode, action) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = action(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// Ask the browser NOT to delete our data when the device runs low on space.
// The browser may say no (returns false); that is why the backup reminder exists.
export async function requestPersistence() {
  try { return Boolean(await navigator.storage?.persist?.()); } catch { return false; }
}

// ---- Public functions (the rest of the app only uses these) ----
export const getAll = (store) => run(store, 'readonly', (s) => s.getAll());
export const put = (store, value) => run(store, 'readwrite', (s) => s.put(value));
export const remove = (store, key) => run(store, 'readwrite', (s) => s.delete(key));
export const clear = (store) => run(store, 'readwrite', (s) => s.clear());

// Wipe a store and write new rows in ONE transaction: if anything fails,
// the old data is kept (used by "Replace" import so nothing is lost halfway).
export const replaceAll = (store, rows) =>
  run(store, 'readwrite', (s) => { s.clear(); rows.forEach((r) => s.put(r)); });

// Save many rows at once (all-or-nothing, so a failure can't leave half-saved data).
export const putMany = (store, rows) =>
  run(store, 'readwrite', (s) => { rows.forEach((r) => s.put(r)); });
