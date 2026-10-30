/* =====================================================================
   eslint.config.js — the "code spell-checker". Run:  npm run lint
   It catches mistakes BEFORE the app runs: unused variables, typos in
   names, accidentally hiding a built-in (like our old `alert` bug), etc.
   ===================================================================== */
import js from '@eslint/js';

// Names the browser provides. A name NOT listed here is reported as a typo (no-undef).
const browser = Object.fromEntries([
  'document', 'window', 'navigator', 'location', 'indexedDB', 'caches', 'crypto', 'structuredClone', 'console',
  'setTimeout', 'clearTimeout', 'queueMicrotask', 'fetch', 'FormData', 'Blob', 'URL', 'TextEncoder', 'Event',
  'DataView', 'Uint8Array', 'Uint32Array', 'confirm', 'alert', 'Response', 'SVGElement', 'getComputedStyle',
].map((n) => [n, 'readonly']));
const node = Object.fromEntries([
  'process', 'Buffer', 'console', 'URL', 'setTimeout', 'clearTimeout', 'queueMicrotask', 'structuredClone',
  'performance', 'navigator', 'Blob', 'TextEncoder', 'globalThis',
].map((n) => [n, 'readonly']));
const serviceWorker = Object.fromEntries(['self', 'caches', 'location', 'fetch', 'Response', 'URL'].map((n) => [n, 'readonly']));

const rules = {
  eqeqeq: ['error', 'always'],
  'no-var': 'error',
  'prefer-const': 'error',
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-unused-vars': ['error', { args: 'after-used', caughtErrors: 'all' }],
  // Forbids a local name that hides another one (including browser built-ins like alert).
  'no-shadow': ['error', { builtinGlobals: true, hoist: 'functions' }],
};

export default [
  { ignores: ['node_modules/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  { files: ['js/**/*.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: browser }, rules },
  { files: ['sw.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: serviceWorker }, rules },
  {
    files: ['tests/**/*.mjs', 'e2e/**/*.{js,mjs}', 'playwright.config.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...node, ...browser } }, // e2e code also runs inside the page
    rules,
  },
];
