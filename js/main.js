/* =====================================================================
   main.js — the START of the program. It connects everything:
     database/store  →  views (screens)  →  the page.
   Flow:  boot() → load data → draw screen → wait for the user →
          user clicks → handler runs → store changes → screen re-draws.
   ===================================================================== */
import views from './views/index.js';
import { currentViewId, onRouteChange } from './router.js';
import { collectHandlers } from './handlers.js';
import { onDatabaseOutdated, requestPersistence } from './db.js';
import { globalClick, globalChange } from './globalActions.js';
import { loadAll, getState, subscribe } from './store.js';
import { applyTheme } from './ui/theme.js';
import { initInstall } from './ui/install.js';
import { initTxDialog } from './ui/txDialog.js';
import { toast } from './ui/toast.js';
import { icons } from './ui/icons.js';

const viewEl = document.getElementById('view');
const navEl = document.getElementById('nav');

/* ---------- 1. Collect handlers from all views into lookup tables (Maps) ---------- */
const clickMap = collectHandlers(views, 'click', globalClick);
const changeMap = collectHandlers(views, 'change', globalChange);
const submitMap = collectHandlers(views, 'submit');

/* ---------- 2. Draw the current screen ---------- */
function render() {
  const state = getState();
  const id = currentViewId(views);
  const view = views.find((v) => v.id === id);

  // If one screen has a bug, show an error card instead of a blank app.
  try {
    viewEl.innerHTML = view.render(state);
  } catch (err) {
    console.error(err);
    viewEl.innerHTML = '<section class="card"><h3>Something went wrong</h3><p class="muted">This screen could not load. Try another tab or reload the page.</p></section>';
  }

  navEl.innerHTML = views.map((v) =>
    `<a href="#/${v.id}" class="${v.id === id ? 'on' : ''}" ${v.id === id ? 'aria-current="page"' : ''}>${icons[v.icon] || ''}<span>${v.label}</span></a>`).join('');
  applyTheme(state.settings.theme);
}

/* ---------- 3. Listen to the user (one listener per event type) ---------- */
// "Event delegation": we listen on the whole page and look for data-click="name".
function dispatch(attr, map, selector) {
  return async (e) => {
    const el = e.target.closest(selector);
    if (!el) return;
    if (attr === 'submit') e.preventDefault(); // an unknown form must never reload the page
    const handler = map.get(el.dataset[attr]);
    if (!handler) {
      // A typo in data-click="..." would otherwise fail silently.
      console.warn(`No handler registered for data-${attr}="${el.dataset[attr]}". Check the spelling in the view and in views/*.js or globalActions.js.`);
      return;
    }
    try {
      await handler(el, { state: getState(), refresh: render }, e);
    } catch (err) {
      console.error(err);
      toast('Something went wrong. Please try again.', 'error');
    }
  };
}
document.addEventListener('click', dispatch('click', clickMap, '[data-click]'));
document.addEventListener('change', dispatch('change', changeMap, '[data-change]'));
document.addEventListener('submit', dispatch('submit', submitMap, '[data-submit]'));

/* ---------- 4. Start the app ---------- */
async function boot() {
  initInstall();
  initTxDialog();
  // Another tab upgraded the database: this tab's copy of the app is outdated.
  onDatabaseOutdated(() => toast('The app was updated in another tab. Please reload this page.', 'error'));
  try {
    await loadAll();                 // read IndexedDB into the store
  } catch (err) {
    console.error(err);
    const reason = err.name === 'DatabaseBlockedError'
      ? 'The app was updated, but another tab still has the old version open. Close other tabs of this app, then reload.'
      : 'This browser blocked local storage (private mode?). Open the app in a normal window.';
    viewEl.innerHTML = `<section class="card"><h3>Can't open your data</h3><p class="muted">${reason}</p></section>`;
    return;
  }
  requestPersistence();              // ask the browser to keep our data (it may say no; backups still matter)
  subscribe(render);                 // from now on, every data change re-draws
  onRouteChange(render);             // and so does every menu click
  render();

  // Offline support: register the service worker (see sw.js).
  if ('serviceWorker' in navigator) {
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW failed', e));
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) toast('App updated. Reload to see the latest version.');
    });
  }
}
boot();
