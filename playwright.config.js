/* Playwright = runs the REAL app in a REAL browser (clicking, typing, reloading, going offline).
   Run:  npm run test:e2e        (first time: npx playwright install chromium) */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'en-US',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node e2e/server.mjs',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
