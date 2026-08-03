/**
 * IRISSAM ERP — Service Worker
 *
 * Cache strategy:
 *   Static assets (JS, CSS, fonts, icons) → Cache First  (versioned by SW URL param)
 *   Navigation / HTML                     → Network First → shell fallback (offline)
 *   API / auth / PDF / uploads            → Network Only  (never cached — sensitive data)
 *
 * Version: read from the ?v= query param of THIS script's URL so the cache
 * name changes automatically with every build without touching sw.js.
 */

// ─── Build version (injected via SW registration URL: sw.js?v=BUILD_ID) ──────
const BUILD_VERSION = new URL(self.location.href).searchParams.get('v') || 'v1';
const STATIC_CACHE  = `irissam-static-${BUILD_VERSION}`;
const SHELL_CACHE   = `irissam-shell-${BUILD_VERSION}`;
const ALL_CACHES    = [STATIC_CACHE, SHELL_CACHE];

// File extensions we treat as static (cache-first)
const STATIC_EXTENSIONS = [
  '.js', '.css', '.mjs',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif',
  '.svg', '.ico',
  '.webmanifest',
];

// Patterns that must NEVER be cached (sensitive / auth)
const NEVER_CACHE_PATTERNS = [
  /\/api\//,
  /\/api$/,
];

// ─── INSTALL ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) =>
        cache.addAll([
          './',
          './index.html',
        ]).catch(() => { /* non-fatal — shell may not exist yet in first build */ }),
      )
      .then(() => self.skipWaiting()),
  );
});

// ─── ACTIVATE ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !ALL_CACHES.includes(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── MESSAGES ────────────────────────────────────────────────────────────────
// React's PWAUpdateBanner sends SKIP_WAITING when user clicks "Mettre à jour"
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GET requests; pass through everything else
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  // ── 1. NEVER CACHE: API, auth, PDFs, uploads ─────────────────────────────
  if (NEVER_CACHE_PATTERNS.some((p) => p.test(path))) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ error: 'offline', message: 'Aucune connexion Internet' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    return;
  }

  // ── 2. STATIC ASSETS: Cache First ────────────────────────────────────────
  const isStatic = STATIC_EXTENSIONS.some((ext) => path.endsWith(ext));
  if (isStatic) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok && response.type !== 'opaque') {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => cached || new Response('', { status: 504 }));
        }),
      ),
    );
    return;
  }

  // ── 3. NAVIGATION: Network First → shell fallback ────────────────────────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigation responses as shell
          if (response.ok) {
            const clone = response.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match('./index.html')
            .then((cached) => cached || caches.match('/index.html'))
            .then((cached) => cached || new Response('<h1>Hors ligne</h1>', { status: 503, headers: { 'Content-Type': 'text/html' } })),
        ),
    );
    return;
  }

  // ── 4. EVERYTHING ELSE: Network with cache fallback ──────────────────────
  event.respondWith(
    fetch(request).catch(() => caches.match(request)),
  );
});
