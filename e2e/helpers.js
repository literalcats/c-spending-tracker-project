/* Small shared helpers so each test reads like a story. */
import { expect } from '@playwright/test';

// Open the app and wait until the menu is drawn (= data loaded).
export async function openApp(page) {
  await page.goto('/');
  await expect(page.locator('#nav a')).toHaveCount(5);
}

// Click a menu tab by its view id: 'dashboard' | 'transactions' | 'budget' | 'reports' | 'data'
export const go = (page, id) => page.locator(`#nav a[href="#/${id}"]`).click();

// Use the + button to add a record, exactly like a user would.
export async function addRecord(page, { type = 'expense', amount, category, note } = {}) {
  await page.locator('.fab').click();
  const dialog = page.locator('#txDialog');
  await expect(dialog).toBeVisible();
  if (type === 'income') await dialog.locator('label', { hasText: 'Received' }).click();
  await dialog.locator('[name=amount]').fill(String(amount));
  if (category) await dialog.locator('[name=category]').selectOption({ label: category });
  if (note) await dialog.locator('[name=note]').fill(note);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
}

// Read a file the browser downloaded.
export async function readDownload(download) {
  const fs = await import('node:fs');
  return fs.readFileSync(await download.path());
}
