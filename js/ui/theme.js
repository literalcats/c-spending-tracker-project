/* =====================================================================
   ui/theme.js — dark / light mode.
   The theme is just an attribute on <html>: data-theme="dark" | "light".
   css/styles.css reads that attribute to pick the colors.
   ===================================================================== */
import { icons } from './icons.js';

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  // Keep the phone's browser bar the same color as the app.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'light' ? '#ffffff' : '#1b1e1c';
  // Show the icon of the mode you would switch TO.
  const btn = document.getElementById('themeBtn');
  if (btn) {
    btn.innerHTML = theme === 'light' ? icons.moon : icons.sun;
    btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
  }
}
