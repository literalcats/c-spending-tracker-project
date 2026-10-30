/* =====================================================================
   sw.js — the SERVICE WORKER: makes the app work offline.
   Strategy "stale-while-revalidate":
     1. Answer from the cache instantly (fast + offline).
     2. In the background, fetch a fresh copy and update the cache.
   HOW TO RELEASE AN UPDATE: change CACHE_VERSION below. Old caches are
   deleted automatically. If you ADD a new file to the app, add it to
   APP_FILES too so it is available offline from the first visit.
   ===================================================================== */
const CACHE_VERSION = 'v3';
const CACHE = `spending-tracker-${CACHE_VERSION}`;

const APP_FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'js/main.js', 'js/config.js', 'js/models.js', 'js/db.js', 'js/store.js', 'js/calc.js',
  'js/charts.js', 'js/exporter.js', 'js/xlsx.js', 'js/router.js', 'js/handlers.js', 'js/globalActions.js',
  'js/ui/dom.js', 'js/ui/icons.js', 'js/ui/toast.js', 'js/ui/theme.js', 'js/ui/install.js',
  'js/ui/txRow.js', 'js/ui/txDialog.js',
  'js/views/index.js', 'js/views/dashboard.js', 'js/views/transactions.js',
  'js/views/budget.js', 'js/views/reports.js', 'js/views/data.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon.png', 'icons/apple-touch-icon.png',
];

// Install: save the app files. (allSettled: one missing file can't block the install)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.allSettled(APP_FILES.map((f) => cache.add(f))))
      .then(() => self.skipWaiting())
  );
});

// Activate: delete caches from older versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch: cache first, refresh in the background.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req).then((res) => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      // Offline + not cached + page navigation → fall back to the app shell.
      return cached || (await network) || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
    })
  );
});
