/* =====================================================================
   router.js — decides which screen to show from the web address.
   "#/budget" in the URL → show the view whose id is "budget".
   Unknown address → show the first view (Home).
   ===================================================================== */
export function currentViewId(views) {
  const id = location.hash.replace(/^#\//, '');
  return views.some((v) => v.id === id) ? id : views[0].id;
}

export const onRouteChange = (fn) => window.addEventListener('hashchange', fn);
