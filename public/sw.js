/**
 * sw.js – Service worker de la PWA
 *
 * Estrategias:
 * - App shell (html/css/js/iconos): stale-while-revalidate (offline-ready,
 *   se actualiza en segundo plano).
 * - /data/*: network-first con fallback a caché (ver el archivo offline con
 *   lo último cargado).
 * - Thumbs (/videos/*.jpg): stale-while-revalidate.
 * - Videos: passthrough (Range requests van directo a red; no se cachean).
 * - Core de ffmpeg (jsdelivr, URLs versionadas): cache-first, así comprimir
 *   no re-descarga 32 MB y funciona offline.
 *
 * Nunca se cachean redirecciones (p.ej. 302 → /login) ni respuestas de error.
 */

const VERSION = 'v1';
const SHELL_CACHE = `arwuchivo-shell-${VERSION}`;
const DATA_CACHE = 'arwuchivo-data';
const RUNTIME_CACHE = 'arwuchivo-runtime';

const SHELL = [
  '/',
  '/style.css',
  '/ffmpeg.js',
  '/manifest.webmanifest',
  '/js/app.js',
  '/js/colors.js',
  '/js/data.js',
  '/js/layout.js',
  '/js/queue.js',
  '/js/seasonMenu.js',
  '/js/timeline.js',
  '/js/upload.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      // addAll manual: solo cacheamos respuestas OK y no redirigidas
      // (si la sesión caducó, '/' devuelve la página de login: no la queremos).
      await Promise.all(
        SHELL.map(async (url) => {
          try {
            const res = await fetch(url, { credentials: 'same-origin' });
            if (res.ok && !res.redirected) await cache.put(url, res);
          } catch (_) { /* offline durante install: se cacheará en runtime */ }
        })
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('arwuchivo-shell-') && k !== SHELL_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function cacheable(res) {
  return res && res.ok && !res.redirected && res.status === 200;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (cacheable(res)) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (cacheable(res)) cache.put(request, res.clone());
    return res;
  } catch (_) {
    const cached = await cache.match(request);
    return cached || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (cacheable(res)) cache.put(request, res.clone());
  return res;
}

async function handleNavigation(request) {
  try {
    const res = await fetch(request);
    // Redirecciones (302 → /login) y errores se devuelven sin cachear
    if (cacheable(res) && new URL(request.url).pathname === '/') {
      const cache = await caches.open(SHELL_CACHE);
      cache.put('/', res.clone());
    }
    return res;
  } catch (_) {
    // Offline: servimos el shell cacheado
    const cached = await caches.match('/');
    return cached || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Core de ffmpeg desde CDN: cache-first (URLs versionadas, inmutables)
  if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.pathname.startsWith('/data/')) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  if (url.pathname.startsWith('/videos/')) {
    // Solo thumbs; los videos (Range requests) van directo a red
    if (url.pathname.endsWith('.jpg')) {
      event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    }
    return;
  }

  if (url.pathname.startsWith('/api/')) return;

  // Resto de estáticos same-origin (shell)
  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
});
