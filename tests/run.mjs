/* Quick safety-net tests for the "pure" logic (no browser needed).
   Run with:  npm test   — if a change breaks the math, this tells you. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { buildTransaction } from '../js/models.js';
import { totals, balanceUpTo, byWeek, budgetStatus, projection, compareMonths, spentByCategory, shiftMonth, goalProgress } from '../js/calc.js';
import { parseBackup } from '../js/exporter.js';
import { buildXlsx } from '../js/xlsx.js';

import * as _fs from 'node:fs';
const require_fs = () => _fs;
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('  ok -', name); };
const tx = (type, amount, date, category = 'food') => buildTransaction({ type, amount, date, category }).value;

await test('rejects bad transactions', () => {
  assert.equal(buildTransaction({ type: 'expense', amount: -5, date: '2026-10-01' }).ok, false);
  assert.equal(buildTransaction({ type: 'expense', amount: 5, date: '2026-02-30' }).ok, false);
  assert.equal(buildTransaction({ type: 'nope', amount: 5, date: '2026-10-01' }).ok, false);
  assert.equal(buildTransaction({ type: 'expense', amount: 5, date: '2026-10-01', category: 'zzz' }).value.category, 'other');
});

const data = [
  tx('income', 1000, '2026-09-15', 'allowance'), tx('expense', 200, '2026-09-20'),
  tx('income', 500, '2026-10-01', 'allowance'), tx('expense', 100.1, '2026-10-02'),
  tx('expense', 50.2, '2026-10-08', 'fun'),
];

await test('totals + carry-over balance (no float drift)', () => {
  assert.deepEqual(totals(data.filter((t) => t.date.startsWith('2026-10'))), { income: 500, expense: 150.3, net: 349.7 });
  assert.equal(balanceUpTo(data, '2026-09'), 800);
  assert.equal(balanceUpTo(data, '2026-10'), 1149.7);
});
await test('category + week breakdown', () => {
  assert.equal(spentByCategory(data)[0].id, 'food');
  const w = byWeek(data, '2026-10');
  assert.equal(w[0].label, '1–4');
  assert.equal(w.reduce((n, x) => n + x.expense, 0).toFixed(2), '150.30');
});
await test('budget flags', () => {
  assert.equal(budgetStatus(50, 100).state, 'ok');
  assert.equal(budgetStatus(80, 100).state, 'warn');
  assert.equal(budgetStatus(101, 100).state, 'over');
  assert.equal(budgetStatus(5, 0).state, 'none');
});
await test('projection + goal + compare + shiftMonth', () => {
  assert.equal(projection(data, '2026-10', '2026-10-10', 0).mode, 'now');
  assert.equal(projection(data, '2026-09', '2026-10-10', 0).mode, 'past');
  assert.equal(goalProgress(500, { amount: 1000 }).ratio, 0.5);
  assert.equal(compareMonths(data, '2026-09', '2026-10').a.expense, 200);
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
});
await test('import validation', () => {
  assert.equal(parseBackup('not json').ok, false);
  assert.equal(parseBackup('{"app":"other"}').ok, false);
  const r = parseBackup(JSON.stringify({ app: 'spending-tracker', version: 1, transactions: [data[0], { bad: 1 }] }));
  assert.equal(r.ok, true); assert.equal(r.transactions.length, 1); assert.equal(r.skipped, 1);
});
await test('xlsx builds', async () => {
  const blob = buildXlsx([['Date', 'Amount'], ['2026-10-01', 12.5], ['=evil<&>', 1]]);
  writeFileSync('/tmp/test.xlsx', Buffer.from(await blob.arrayBuffer()));
});
await test('every screen renders without undefined/NaN', async () => {
  const views = (await import('../js/views/index.js')).default;
  const { DEFAULT_SETTINGS } = await import('../js/config.js');
  for (const settings of [DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, budget: { totalLimit: 100, categoryLimits: { food: 50 } }, goal: { label: '<b>x</b>', amount: 2000 } }]) {
    for (const transactions of [[], data]) {
      const state = { transactions, settings, month: '2026-10' };
      for (const v of views) {
        const html = v.render(state);
        assert.ok(!/undefined|NaN|\[object/.test(html), `${v.id} contains bad text`);
        assert.ok(!html.includes('<b>x</b>'), `${v.id} did not escape user text`);
      }
    }
  }
});
await test('sw.js caches every app file (no forgotten files)', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const walk = (dir) => readdirSync(new URL(dir, import.meta.url)).flatMap((f) =>
    statSync(new URL(dir + f, import.meta.url)).isDirectory() ? walk(dir + f + '/') : [dir.replace('../', '') + f]);
  for (const file of [...walk('../js/'), 'css/styles.css']) {
    assert.ok(sw.includes(`'${file}'`), `${file} is missing from APP_FILES in sw.js`);
  }
});
await test('layer rules: calc/models/config stay pure', async () => {
  const { readFileSync } = await import('node:fs');
  for (const f of ['calc', 'models', 'config', 'xlsx']) {
    const src = readFileSync(new URL(`../js/${f}.js`, import.meta.url), 'utf8');
    assert.ok(!/from '\.\/(ui|views|db|store)/.test(src), `${f}.js must not import UI, views, db or store`);
    assert.ok(!/\bdocument\b|\bwindow\b|indexedDB/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')), `${f}.js must not touch the browser`);
  }
});

/* ---------- Hardening tests (one block per fix) ---------- */
const models = await import('../js/models.js');
const calc = await import('../js/calc.js');
const { collectHandlers } = await import('../js/handlers.js');
const allViews = (await import('../js/views/index.js')).default;
const { DEFAULT_SETTINGS: DEFAULTS, BACKUP_REMIND_DAYS } = await import('../js/config.js');
globalThis.document = { getElementById: () => null }; // toast() needs a page; this stub makes it a no-op

await test('FIX 1a: backup reminder rule', () => {
  const DAY = 86400000, now = Date.now();
  const old = [{ ...data[0], createdAt: now - 20 * DAY }];
  const fresh = [{ ...data[0], createdAt: now - 2 * DAY }];
  assert.equal(calc.backupReminder([], 0, now, 14), null);                        // no data, no nag
  assert.equal(calc.backupReminder(fresh, 0, now, 14), null);                     // new user, not yet
  assert.deepEqual(calc.backupReminder(old, 0, now, 14), { days: 20, never: true });
  assert.equal(calc.backupReminder(old, now - DAY, now, 14), null);               // backed up yesterday
  assert.deepEqual(calc.backupReminder(old, now - 15 * DAY, now, 14), { days: 15, never: false });
  assert.equal(calc.backupReminder(Array(300000).fill(old[0]), 0, now, 14).days, 20); // no spread-argument crash
  const html = allViews.find((v) => v.id === 'dashboard').render({ transactions: old, settings: DEFAULTS, month: '2026-10' });
  assert.ok(html.includes('Back up now'), 'dashboard shows the reminder');
  assert.ok(!allViews.find((v) => v.id === 'dashboard').render({ transactions: fresh, settings: DEFAULTS, month: '2026-10' }).includes('Back up now'));
  assert.ok(BACKUP_REMIND_DAYS > 0);
});

await test('FIX 1b: persistence request', async () => {
  const { requestPersistence } = await import('../js/db.js');
  Object.defineProperty(globalThis.navigator, 'storage', { value: { persist: async () => true }, configurable: true });
  assert.equal(await requestPersistence(), true);
  Object.defineProperty(globalThis.navigator, 'storage', { value: { persist: async () => { throw new Error('x'); } }, configurable: true });
  assert.equal(await requestPersistence(), false);   // errors are swallowed
  Object.defineProperty(globalThis.navigator, 'storage', { value: undefined, configurable: true });
  assert.equal(await requestPersistence(), false);   // unsupported browser
});

await test('FIX 2: compare months are validated and escaped', () => {
  const reports = allViews.find((v) => v.id === 'reports');
  const render = () => reports.render({ transactions: [], settings: DEFAULTS, month: '2026-10' });
  let refreshes = 0; const ctx = { refresh: () => refreshes++ };
  for (const evil of ['"><img src=x onerror=alert(1)>', '2026-13', '26-1', "2026-10' onfocus='x"]) {
    reports.change['cmp-a']({ value: evil }, ctx);
    reports.change['cmp-b']({ value: evil }, ctx);
    assert.ok(!render().includes('<img'), 'no injected tag');
    assert.ok(!/value="[^"]*(onfocus|onerror)/.test(render()), 'no injected attribute');
  }
  reports.change['cmp-a']({ value: '2026-08' }, ctx);
  assert.ok(render().includes('value="2026-08"'), 'a valid month is accepted');
  // Defense in depth: even if a bad month reached render() some other way, it must be escaped.
  const evilState = { transactions: [], settings: DEFAULTS, month: '"><img src=x onerror=1>' };
  assert.ok(!reports.render(evilState).includes('<img'), 'reports escapes month values');
  assert.ok(!allViews.find((v) => v.id === 'dashboard').render({ ...evilState, transactions: [data[0]] }).includes('<img'), 'month picker escapes');
  assert.equal(refreshes, 9); // 4 bad values x 2 handlers + 1 good value: every input redraws
  assert.equal(models.isValidMonth('2026-10'), true);
  assert.equal(models.isValidMonth('2026-00'), false);
  assert.equal(models.isValidMonth('<x>'), false);
});

await test('FIX 3: blocked/failed database opens recover; other tabs can upgrade', async () => {
  let mode = 'error', opens = 0, closed = 0, lastReq;
  const fakeDb = {
    objectStoreNames: { contains: () => true }, close() { closed++; },
    transaction() { const tx = {}; tx.objectStore = () => ({ getAll() { const r = { result: ['row'] }; queueMicrotask(() => tx.oncomplete()); return r; } }); return tx; },
  };
  globalThis.indexedDB = { open() {
    opens++; const req = (lastReq = {});
    queueMicrotask(() => {
      if (mode === 'error') { req.error = new Error('boom'); req.onerror(); }
      else if (mode === 'blocked') req.onblocked();
      else { req.result = fakeDb; req.onsuccess(); }
    });
    return req;
  } };
  const db = await import('../js/db.js');
  await assert.rejects(db.getAll('transactions'), /boom/);                                  // 1st: fails...
  mode = 'blocked';
  await assert.rejects(db.getAll('transactions'), (e) => e.name === 'DatabaseBlockedError'); // ...2nd: blocked
  lastReq.result = fakeDb; lastReq.onsuccess();                                              // late success after giving up
  assert.equal(closed, 1, 'late connection is closed, not leaked');
  mode = 'ok';
  assert.deepEqual(await db.getAll('transactions'), ['row']);                                // 3rd: recovers (no stuck failure)
  assert.equal(opens, 3);
  let told = 0; db.onDatabaseOutdated(() => told++);
  fakeDb.onversionchange();                                                                  // another tab upgrades
  assert.equal(closed, 2); assert.equal(told, 1);
  await db.getAll('transactions'); assert.equal(opens, 4, 'reopens after being closed');
});

await test('FIX 4: createdAt must be a finite positive number', () => {
  for (const bad of [Infinity, -Infinity, NaN, -5, 0, 'abc', null, undefined, {}]) {
    const t = buildTransaction({ type: 'expense', amount: 5, date: '2026-10-01', createdAt: bad }).value;
    assert.ok(Number.isFinite(t.createdAt) && t.createdAt > 0, `createdAt ${String(bad)} was cleaned`);
  }
  assert.equal(buildTransaction({ type: 'expense', amount: 5, date: '2026-10-01', createdAt: 1700000000000 }).value.createdAt, 1700000000000);
  const r = parseBackup('{"app":"spending-tracker","version":1,"transactions":[{"type":"expense","amount":5,"date":"2026-10-01","createdAt":1e999}]}');
  assert.ok(Number.isFinite(r.transactions[0].createdAt));   // the real attack: 1e999 inside a JSON file
});

await test('FIX 5a: no shadowed alert(); handler tables are Maps', () => {
  const fs = require_fs();
  assert.ok(!/^\s*(const|let|var|function)\s+alert\b/m.test(fs.readFileSync(new URL('../js/views/dashboard.js', import.meta.url), 'utf8')));
  const table = collectHandlers([{ id: 'x', click: { a() {} } }], 'click', { b() {} });
  assert.ok(table instanceof Map && table.has('a') && table.has('b'));
  for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) assert.equal(table.get(name), undefined, name);
  const warned = []; const orig = console.warn; console.warn = (m) => warned.push(m);
  collectHandlers([{ id: 'one', click: { same() {} } }, { id: 'two', click: { same() {} } }], 'click');
  console.warn = orig;
  assert.equal(warned.length, 1, 'duplicate handler names are reported');
  for (const v of allViews) for (const kind of ['click', 'change', 'submit']) collectHandlers([v], kind);
  collectHandlers(allViews, 'click'); collectHandlers(allViews, 'change'); collectHandlers(allViews, 'submit'); // real views: no duplicates (a warning would be printed above)
});

await test('FIX 5b: Replace import resets budget + goal, Merge keeps them', () => {
  const file = { currency: '$' };                       // backup that has NO budget/goal
  const replace = models.settingsForImport(file, 'replace');
  assert.deepEqual(replace.budget, DEFAULTS.budget); assert.deepEqual(replace.goal, DEFAULTS.goal);
  assert.equal(replace.currency, '$');
  replace.budget.totalLimit = 999; assert.equal(DEFAULTS.budget.totalLimit, 0, 'defaults are copied, not shared');
  const merge = models.settingsForImport(file, 'merge');
  assert.equal('budget' in merge, false); assert.equal('goal' in merge, false);
  const withBudget = models.settingsForImport({ budget: { totalLimit: 50, categoryLimits: {} } }, 'replace');
  assert.equal(withBudget.budget.totalLimit, 50);       // the file's own budget wins
  assert.equal(models.settingsForImport({}, 'replace').lastBackup, undefined); // never touches the backup time
});

await test('FIX 5c: CSP header exists and the app obeys it', () => {
  const fs = require_fs();
  const cfg = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const csp = cfg.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy').value;
  const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'));
  assert.ok(scriptSrc && !/unsafe-inline|unsafe-eval|\*/.test(scriptSrc), 'scripts: same-origin only');
  assert.ok(csp.includes("object-src 'none'") && csp.includes("frame-ancestors 'none'"));
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(!/<script(?![^>]*\bsrc=)/i.test(html), 'index.html has no inline <script>');
  assert.ok(!/\son[a-z]+\s*=/i.test(html), 'index.html has no inline onclick-style attributes');
  assert.ok(!/<link[^>]+href="https?:/i.test(html) && !/<script[^>]+src="https?:/i.test(html), 'no external files');
  const jsFiles = fs.readdirSync(new URL('../js/', import.meta.url), { recursive: true }).filter((f) => f.endsWith('.js'));
  for (const f of jsFiles) {
    const src = fs.readFileSync(new URL('../js/' + f, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    assert.ok(!/\beval\s*\(|new\s+Function\s*\(|\son(click|change|submit|error|load)\s*=\s*["'\\]/.test(src), `${f} uses eval / inline handlers`);
  }
});

/* ---------- Accessibility + wiring guards ---------- */
await test('CSS contrast: every text/background pair meets WCAG AA (4.5:1) in BOTH themes', () => {
  const fs = require_fs();
  const css = fs.readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // All "--name: #hex" variables declared directly inside blocks with this exact selector.
  const vars = (selector) => Object.fromEntries([...css.matchAll(new RegExp(esc(selector) + '\\s*\\{([^}]*)\\}', 'g'))]
    .flatMap((m) => [...m[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((v) => [v[1], v[2]])));
  const dark = vars(':root');
  const light = { ...dark, ...vars('html[data-theme="light"]') };

  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (h) => { const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const blend = (fg, bg, a) => '#' + rgb(fg).map((v, i) => Math.round(v * a + rgb(bg)[i] * (1 - a)).toString(16).padStart(2, '0')).join('');

  const failures = [];
  const check = (theme, v, name, fg, bg, min = 4.5) => {
    const f = fg.startsWith('#') ? fg : v[fg], b = bg.startsWith('#') ? bg : v[bg];
    assert.ok(f && b, `${theme}: unknown color in pair "${name}"`);
    const r = ratio(f, b);
    if (r < min) failures.push(`${theme}: ${name} = ${r.toFixed(2)}:1 (${f} on ${b}, needs ${min})`);
  };
  for (const [theme, v] of [['dark', dark], ['light', light]]) {
    for (const [name, fg, bg] of [
      ['text on page', 'text', 'bg'], ['text on card', 'text', 'surface'], ['text on input', 'text', 'surface-2'],
      ['muted on page', 'muted', 'bg'], ['muted on card', 'muted', 'surface'], ['muted on input', 'muted', 'surface-2'],
      ['link on page', 'accent-text', 'bg'], ['link on card', 'accent-text', 'surface'], ['active menu item', 'accent-text', 'surface-2'],
      ['primary button', 'on-accent', 'accent'], ['received amounts', 'ok', 'surface'], ['negative numbers', 'over', 'surface'],
      ['red button', '#ffffff', 'danger-bg'], ['toast', 'bg', 'text'],
    ]) check(theme, v, name, fg, bg);
    check(theme, v, 'over-budget alert', 'over', blend(v.over, v.bg, 0.12));
    check(theme, v, 'info alert', 'text', blend(v.goal, v.bg, 0.12));
    check(theme, v, 'warning alert', theme === 'dark' ? 'warn' : 'text', blend(v.warn, v.bg, 0.14));
  }
  // Light mode: numbers sit ON solid Google-colored blocks.
  for (const [name, bg] of [['income', 'c-income'], ['expense', 'c-expense'], ['balance', 'c-balance']]) check('light', light, `${name} block`, 'on-block', bg);
  check('light', light, 'projected block', 'on-projected', 'c-projected');
  // Dark mode: block labels sit on the dark card.
  check('dark', dark, 'block label', 'muted', 'surface');
  assert.deepEqual(failures, [], '\n' + failures.join('\n'));
});

await test('every data-click/change/submit in the HTML has a handler (and no handler is dead)', async () => {
  const fs = require_fs();
  const { globalClick, globalChange } = await import('../js/globalActions.js');
  const maps = { click: collectHandlers(allViews, 'click', globalClick), change: collectHandlers(allViews, 'change', globalChange), submit: collectHandlers(allViews, 'submit') };
  const used = { click: new Set(), change: new Set(), submit: new Set() };
  const scan = (html) => { for (const [, kind, name] of html.matchAll(/data-(click|change|submit)="([^"]+)"/g)) used[kind].add(name); };
  scan(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'));
  const over = { ...DEFAULTS, budget: { totalLimit: 10, categoryLimits: { food: 5 } }, goal: { label: 'g', amount: 100 } };
  for (const transactions of [[], data]) for (const v of allViews) {
    scan(v.render({ transactions, settings: over, month: '2026-10' }));
  }
  for (const kind of ['click', 'change', 'submit']) {
    for (const name of used[kind]) assert.ok(maps[kind].has(name), `HTML uses data-${kind}="${name}" but no handler is registered`);
    for (const name of maps[kind].keys()) assert.ok(used[kind].has(name), `handler "${name}" (${kind}) is never used in any HTML`);
  }
});

console.log(`\n${n} test groups passed`);
