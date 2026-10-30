/* PWA tests: manifest, security headers, install button, offline mode. */
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { addRecord, openApp } from './helpers.js';

test('manifest is valid and its icons exist', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBeTruthy();
  expect(res.headers()['content-type']).toContain('application/manifest+json');
  const m = await res.json();
  expect(m.display).toBe('standalone');
  expect(m.start_url).toBeTruthy();
  const sizes = m.icons.map((i) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(m.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  for (const icon of m.icons) {
    const r = await request.get('/' + icon.src);
    expect(r.ok(), icon.src).toBeTruthy();
    expect(r.headers()['content-type']).toContain('image/png');
  }
});

test('security headers are sent; the service worker is never cached', async ({ request }) => {
  const page = await request.get('/');
  expect(page.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(page.headers()['x-content-type-options']).toBe('nosniff');
  const sw = await request.get('/sw.js');
  expect(sw.headers()['cache-control']).toContain('no-cache');
});

test('install button is hidden, then appears when the browser says the app is installable', async ({ page }) => {
  await openApp(page);
  const button = page.locator('.topbar .install-btn');
  await expect(button).toBeHidden();
  await page.evaluate(() => {              // pretend to be Chrome announcing "installable"
    const event = new Event('beforeinstallprompt');
    event.prompt = async () => { window.__prompted = true; };
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);
  });
  await expect(button).toBeVisible();
  await button.click();
  await expect.poll(() => page.evaluate(() => window.__prompted)).toBe(true);
  await expect(button).toBeHidden();
});

test('works fully offline after the first visit', async ({ page, context }) => {
  const swSource = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const fileCount = (swSource.match(/APP_FILES = \[([\s\S]*?)\];/)[1].match(/'[^']+'/g) || []).length;

  await openApp(page);
  // Wait until the service worker has saved every app file.
  await page.waitForFunction(async (expected) => {
    const names = await caches.keys();
    if (!names.length) return false;
    return (await (await caches.open(names[0])).keys()).length >= expected;
  }, fileCount - 1, { timeout: 15000 }); // -1: './' and 'index.html' may share one cache entry
  // ...and until it has taken control of this page (it activates a moment after caching).
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#nav a')).toHaveCount(5);
  await addRecord(page, { amount: 40, note: 'offline' });
  await expect(page.locator('.stat.expense .stat-value')).toHaveText('₱40.00');
});
