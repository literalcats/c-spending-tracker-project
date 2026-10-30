/* =====================================================================
   handlers.js — builds the lookup table "handler name → function".
   main.js uses it to find what to run when the user clicks something
   with data-click="name" (or data-change / data-submit).
   WHY a Map and not a plain object: a plain object already contains
   names like "constructor" and "toString", so a lookup could find
   something we never wrote. A Map only knows what we put in it.
   ===================================================================== */
export function collectHandlers(views, kind, base = {}) {
  const map = new Map(Object.entries(base));
  for (const view of views) {
    for (const [name, fn] of Object.entries(view[kind] || {})) {
      // Two screens using the same name would silently replace each other.
      if (map.has(name)) console.warn(`Duplicate ${kind} handler "${name}" in view "${view.id}"`);
      map.set(name, fn);
    }
  }
  return map;
}
