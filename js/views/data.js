/* =====================================================================
   views/data.js — backup & restore, spreadsheet export, install,
   currency, and reset. (Only JSON can be imported; CSV/Excel are export-only.)
   ===================================================================== */
import { CURRENCIES } from '../config.js';
import { exportJSON, exportCSV, exportExcel, parseBackup } from '../exporter.js';
import { importData, saveSetting, resetAll } from '../store.js';
import { icons } from '../ui/icons.js';
import { toast } from '../ui/toast.js';

const MAX_FILE = 5 * 1024 * 1024; // refuse files bigger than 5 MB

const lastBackupText = (ms) =>
  ms ? new Date(ms).toLocaleDateString('en-US', { dateStyle: 'medium' }) : 'never';

export default {
  id: 'data', label: 'Data', icon: 'data',

  render(state) {
    return `<div class="stack">
      <section class="card install-card">
        <h3>Install the app</h3>
        <p class="muted">Use it like a normal app, even without internet.</p>
        <button class="btn primary install-btn" data-click="install">${icons.install} Install app</button>
        <p class="muted installed-note">If you don't see an install button, your browser may not support it, or the app is already installed.</p>
      </section>

      <section class="card">
        <h3>Backup (JSON)</h3>
        <p class="muted">Save everything to a file, or restore from one. Last backup: ${lastBackupText(state.settings.lastBackup)}.</p>
        <button class="btn" data-click="export-json">Export backup</button>
        <div class="import-box">
          <div class="segmented small" role="radiogroup" aria-label="Import mode">
            <label><input type="radio" name="importMode" value="merge" checked><span>Merge with current</span></label>
            <label><input type="radio" name="importMode" value="replace"><span>Replace current</span></label>
          </div>
          <label class="btn file-btn">Import backup<input type="file" accept=".json,application/json" data-change="import-file" hidden></label>
        </div>
      </section>

      <section class="card">
        <h3>Spreadsheet</h3>
        <p class="muted">Export only. These files cannot be imported back.</p>
        <div class="btn-row">
          <button class="btn" data-click="export-excel">Export Excel</button>
          <button class="btn" data-click="export-csv">Export CSV</button>
        </div>
      </section>

      <section class="card">
        <h3>Currency</h3>
        <select data-change="set-currency" aria-label="Currency">
          ${CURRENCIES.map((c) => `<option ${c === state.settings.currency ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </section>

      <section class="card danger">
        <h3>Delete all data</h3>
        <p class="muted">Removes every record and setting from this device. Export a backup first.</p>
        <button class="btn danger-btn" data-click="reset-all">Delete everything</button>
      </section>
    </div>`;
  },

  click: {
    'export-json': async (el, ctx) => {
      exportJSON(ctx.state);
      await saveSetting('lastBackup', Date.now()); // powers the "last backup" reminder
      toast('Backup saved');
    },
    'export-csv': (el, ctx) => exportCSV(ctx.state.transactions),
    'export-excel': (el, ctx) => exportExcel(ctx.state.transactions),
    'reset-all': async () => {
      if (!confirm('Delete ALL records and settings on this device? This cannot be undone.')) return;
      await resetAll();
      toast('All data deleted');
    },
  },

  change: {
    'set-currency': (el) => saveSetting('currency', el.value),

    'import-file': async (el) => {
      const file = el.files[0];
      el.value = ''; // lets the user pick the same file again later
      if (!file) return;
      if (file.size > MAX_FILE) return toast('That file is too big (max 5 MB).', 'error');

      const result = parseBackup(await file.text());
      if (!result.ok) return toast(result.error, 'error');

      const mode = document.querySelector('input[name="importMode"]:checked')?.value || 'merge';
      if (mode === 'replace' && !confirm('Replace all current records with this backup?')) return;

      await importData(result, mode);
      toast(`Imported ${result.transactions.length} records` + (result.skipped ? ` (${result.skipped} skipped)` : ''));
    },
  },
};
