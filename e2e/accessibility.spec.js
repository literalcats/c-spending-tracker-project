/* Accessibility tests run in the REAL browser on every screen, in BOTH themes.
   (1) colour contrast measured from what is actually painted, (2) basic names/labels. */
import { test, expect } from '@playwright/test';
import { addRecord, go, openApp } from './helpers.js';

const SCREENS = ['dashboard', 'transactions', 'budget', 'reports', 'data'];

// Runs inside the page: returns a list of text that is hard to read.
function findLowContrast() {
  const parse = (css) => {
    let m = css.match(/rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; }
    m = css.match(/color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)/); // how Chrome reports color-mix()
    if (m) return { r: m[1] * 255, g: m[2] * 255, b: m[3] * 255, a: m[4] === undefined ? 1 : Number(m[4]) };
    return null;
  };
  const over = (top, bottom) => ({ // paint `top` over `bottom`
    r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
  const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const background = (el) => {          // what is really behind this element
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    return layers.reduceRight((below, layer) => over(layer, below), { r: 255, g: 255, b: 255, a: 1 });
  };
  const bad = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'text') continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
    const isField = el.matches('input:not([type=radio]):not([type=file]):not([type=hidden]), select') && (el.value || el.tagName === 'SELECT');
    if (!own && !isField) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || !el.getClientRects().length || Number(style.opacity) === 0) continue;
    const fgRaw = parse(el instanceof SVGElement ? style.fill : style.color);
    if (!fgRaw) continue;
    const bg = isField ? over(parse(style.backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }, background(el.parentElement)) : background(el);
    const fg = over(fgRaw, bg);
    const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
    const ratio = (hi + 0.05) / (lo + 0.05);
    const px = parseFloat(style.fontSize), bold = Number(style.fontWeight) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    if (ratio < (large ? 3 : 4.5)) bad.push(`${ratio.toFixed(2)}:1 "${(own || el.value).slice(0, 30)}" <${el.tagName.toLowerCase()} class="${el.getAttribute('class') || ''}">`);
  }
  return bad;
}

for (const theme of ['dark', 'light']) {
  test(`${theme} theme: all text is readable on every screen (contrast)`, async ({ page }) => {
    await openApp(page);
    await addRecord(page, { type: 'income', amount: 1000, note: 'Allowance' });
    await addRecord(page, { amount: 90, category: 'Food', note: 'Lunch' });
    await go(page, 'budget');
    await page.locator('[name=total]').fill('100');
    await page.locator('[name=cat_food]').fill('50');
    await page.locator('[name=goalLabel]').fill('Headphones');
    await page.locator('[name=goalAmount]').fill('2000');
    await page.getByRole('button', { name: 'Save budget' }).click();
    if (theme === 'light') await page.locator('#themeBtn').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    for (const id of SCREENS) {
      await go(page, id);
      await page.waitForTimeout(350);            // let the toast/animations settle
      expect(await page.evaluate(findLowContrast), `screen "${id}"`).toEqual([]);
    }
    await page.locator('.fab').click();          // the pop-up form too
    await expect(page.locator('#txDialog')).toBeVisible();
    expect(await page.evaluate(findLowContrast), 'add-record dialog').toEqual([]);
  });
}

test('every control has an accessible name', async ({ page }) => {
  await openApp(page);
  await addRecord(page, { amount: 20 });
  const missing = [];
  for (const id of SCREENS) {
    await go(page, id);
    missing.push(...await page.evaluate((screen) => {
      const out = [];
      for (const el of document.querySelectorAll('button, a[href], [role=progressbar], [role=region], input:not([type=hidden]), select')) {
        if (!el.getClientRects().length) continue;
        const named = (el.textContent || '').trim() || el.getAttribute('aria-label') || (el.labels && el.labels.length);
        if (!named) out.push(`${screen}: <${el.tagName.toLowerCase()} class="${el.className}"> has no name`);
      }
      return out;
    }, id));
  }
  expect(missing).toEqual([]);
});
