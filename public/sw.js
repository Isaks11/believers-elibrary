/**
 * Believers e-Library — Offline-First Service Worker (Phase 3 — Stage 2)
 *
 * Cache Versioning & Privacy Strategy:
 * - SHELL_CACHE: static app shell & hashed Vite assets (`believers-library-shell-v4`)
 * - SCRIPTURE_CACHE: public-domain Bible API GET responses (`believers-library-scripture-v4`)
 * - STRICT PRIVACY RULE: Never cache authenticated requests, Supabase REST/Auth endpoints,
 *   private user journals, prayer requests, or any non-GET request in shared Cache Storage.
 *
 * Notifications (Phase 3 — Stage 4):
 * - `notificationclick`: closes the notification, focuses an existing matching
 *   client window, or opens the target URL in a new window.
 * - `push`: defensively parses the push payload (JSON with title/body/url,
 *   falling back to plain text) and shows a local notification.
 */

const CACHE_VERSION = 'v4';
const SHELL_CACHE = `believers-library-shell-${CACHE_VERSION}`;
const SCRIPTURE_CACHE = `believers-library-scripture-${CACHE_VERSION}`;
const ALLOWED_CACHES = [SHELL_CACHE, SCRIPTURE_CACHE];

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.svg',
  '/icon-512.svg',
];

function isPrivateOrAuthenticatedRequest(request) {
  if (request.method !== 'GET') return true;
  if (request.headers.get('Authorization')) return true;
  const url = new URL(request.url);
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('/auth/') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/functions/v1/')
  ) {
    return true;
  }
  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {
        /* Tolerate individual pre-cache failure so SW still installs */
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (!ALLOWED_CACHES.includes(key)) {
              return caches.delete(key);
            }
            return Promise.resolve(false);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing window already showing the target page, if any
        for (const client of clientList) {
          if ('focus' in client && client.url.includes(targetUrl)) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});

self.addEventListener('push', (event) => {
  let title = 'Believers e-Library';
  let body = 'You have a new notification';
  let url = '/';
  try {
    const payload = event.data ? event.data.json() : null;
    if (payload && typeof payload === 'object') {
      title = String(payload.title || title);
      body = String(payload.body || payload.message || body);
      url = String(payload.url || url);
    }
  } catch {
    // Not JSON — fall back to the raw text payload
    if (event.data) {
      body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      data: { url },
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never cache private user content or non-GET requests
  if (isPrivateOrAuthenticatedRequest(request)) {
    return;
  }

  const url = new URL(request.url);

  // 1. Public-domain Scripture lookups (bible-api.com): network-first with cache fallback
  if (url.hostname === 'bible-api.com') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(SCRIPTURE_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 2. SPA HTML Navigation requests: network-first, falling back to cached /index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copy)).catch(() => {});
          }
          return response;
        })
        .catch(() =>
          caches.match('/index.html').then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  // 3. Same-origin static assets (JS, CSS, SVG, fonts): stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              const copy = response.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
  }
});
