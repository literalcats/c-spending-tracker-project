/* User-flow tests: the things a student actually does. */
import { test, expect } from '@playwright/test';
import { addRecord, go, openApp, readDownload } from './helpers.js';

const value = (page, block) => page.locator(`.stat.${block} .stat-value`);
const toast = (page) => page.locator('#toast');

test('first visit: dark theme and a friendly empty state', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { name: 'Start with your allowance' })).toBeVisible();
});

test('adding allowance and spending updates the numbers', async ({ page }) => {
  await openApp(page);
  await addRecord(page, { type: 'income', amount: 1000 });
  await expect(toast(page)).toHaveText('Saved');
  await addRecord(page, { amount: 250, category: 'Food', note: 'Lunch' });
  await expect(value(page, 'income')).toHaveText('₱1,000.00');
  await expect(value(page, 'expense')).toHaveText('₱250.00');
  await expect(value(page, 'balance')).toHaveText('₱750.00');
});

test('records survive a page reload (IndexedDB)', async ({ page }) => {
  await openApp(page);
  await addRecord(page, { type: 'income', amount: 500 });
  await page.reload();
  await expect(page.locator('#nav a')).toHaveCount(5);
  await expect(value(page, 'balance')).toHaveText('₱500.00');
});

test('invalid amounts are rejected with a message and the form stays open', async ({ page }) => {
  await openApp(page);
  await page.locator('.fab').click();
  const dialog = page.locator('#txDialog');
  await dialog.locator('[name=amount]').fill('-5');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.locator('#txError')).toHaveText('Enter an amount above 0.');
  await expect(dialog).toBeVisible();
});

test('budget: warning at 90%, then an over-budget alert', async ({ page }) => {
  await openApp(page);
  await go(page, 'budget');
  await page.locator('[name=total]').fill('100');
  await page.getByRole('button', { name: 'Save budget' }).click();
  await expect(toast(page)).toHaveText('Budget saved');
  await addRecord(page, { amount: 90 });
  await go(page, 'dashboard');
  await expect(page.locator('.alert.warn')).toContainText('You used 90% of your budget');
  await addRecord(page, { amount: 20 });
  await expect(page.locator('.alert.over')).toContainText('Over budget by ₱10.00');
});

test('edit and delete a record', async ({ page }) => {
  await openApp(page);
  await addRecord(page, { amount: 80, category: 'Fun' });
  await go(page, 'transactions');
  await page.getByRole('button', { name: 'Edit' }).click();
  const dialog = page.locator('#txDialog');
  await expect(dialog.getByRole('heading', { name: 'Edit record' })).toBeVisible();
  await dialog.locator('[name=amount]').fill('300');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.tx .amt')).toHaveText('-₱300.00');
  page.once('dialog', (d) => d.accept()); // the browser's "Are you sure?" box
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('No records here yet')).toBeVisible();
});

test('theme switch works and is remembered after reload', async ({ page }) => {
  await openApp(page);
  await page.locator('#themeBtn').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('JSON backup: export, wipe everything, import restores it', async ({ page }) => {
  await openApp(page);
  await addRecord(page, { type: 'income', amount: 1000 });
  await addRecord(page, { amount: 250 });
  await go(page, 'data');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export backup' }).click()]);
  const file = await readDownload(download);
  const backup = JSON.parse(file.toString('utf8'));
  expect(backup.app).toBe('spending-tracker');
  expect(backup.transactions).toHaveLength(2);

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete everything' }).click();
  await expect(toast(page)).toHaveText('All data deleted');

  await page.setInputFiles('input[type=file]', { name: 'backup.json', mimeType: 'application/json', buffer: file });
  await expect(toast(page)).toHaveText('Imported 2 records');
  await go(page, 'dashboard');
  await expect(value(page, 'balance')).toHaveText('₱750.00');
});

test('a bad import file is rejected and existing data is untouched', async ({ page }) => {
  await openApp(page);
  await addRecord(page, { amount: 40 });
  await go(page, 'data');
  await page.setInputFiles('input[type=file]', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('not json') });
  await expect(toast(page)).toHaveText('That file is not valid JSON.');
  await go(page, 'dashboard');
  await expect(value(page, 'expense')).toHaveText('₱40.00');
});

test('CSV and Excel exports download real files', async ({ page }) => {
  await openApp(page);
  await addRecord(page, { type: 'income', amount: 100, note: 'Allowance' });
  await go(page, 'data');

  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);
  const csvText = (await readDownload(csv)).toString('utf8');
  expect(csvText).toContain('Date,Type,Category,Note,Amount');
  expect(csvText).toContain('Received');

  const [xlsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export Excel' }).click()]);
  expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/);
  expect((await readDownload(xlsx)).subarray(0, 2).toString()).toBe('PK'); // .xlsx is a ZIP file
});

test('a full tour of every screen causes no console errors (also proves the CSP blocks nothing)', async ({ page }) => {
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`${m.type()}: ${m.text()}`); });
  await openApp(page);
  await addRecord(page, { type: 'income', amount: 1000 });
  await addRecord(page, { amount: 120, category: 'Transport' });
  for (const id of ['transactions', 'budget', 'reports', 'data', 'dashboard']) await go(page, id);
  await page.locator('#themeBtn').click();
  for (const id of ['reports', 'dashboard']) await go(page, id);
  expect(problems).toEqual([]);
});

test('no screen is wider than the device (no sideways page scrolling)', async ({ page }) => {
  await openApp(page);
  await addRecord(page, { type: 'income', amount: 1000 });
  await addRecord(page, { amount: 120, category: 'Transport' });
  const deviceWidth = page.viewportSize().width;
  for (const id of ['dashboard', 'transactions', 'budget', 'reports', 'data']) {
    await go(page, id);
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth, `screen "${id}" is ${pageWidth}px wide on a ${deviceWidth}px device`).toBeLessThanOrEqual(deviceWidth);
  }
});
