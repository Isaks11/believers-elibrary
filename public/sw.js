/**
 * Believers e-Library â€” Offline-First Service Worker (Phase 3 â€” Stage 2)
 *
 * Cache Versioning & Privacy Strategy:
 * - SHELL_CACHE: static app shell & hashed Vite assets (`believers-library-shell-v4`)
 * - SCRIPTURE_CACHE: public-domain Bible API GET responses (`believers-library-scripture-v4`)
 * - STRICT PRIVACY RULE: Never cache authenticated requests, Supabase REST/Auth endpoints,
 *   private user journals, prayer requests, or any non-GET request in shared Cache Storage.
 *
 * Notifications (Phase 3 â€” Stage 4):
 * - `notificationclick`: closes the notification, focuses an existing matching
 *   client window, or opens the target URL in a new window.
 * - `push`: defensively parses the push payload (JSON with title/body/url,
 *   falling back to plain text) and shows a local notification.
 */

const CACHE_VERSION = 'v6';
const SHELL_CACHE = `believers-library-shell-${CACHE_VERSION}`;
const SCRIPTURE_CACHE = `believers-library-scripture-${CACHE_VERSION}`;
const RUNTIME_CACHE = `believers-library-runtime-${CACHE_VERSION}`;
const ALLOWED_CACHES = [SHELL_CACHE, SCRIPTURE_CACHE, RUNTIME_CACHE];

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/brand-logo.png',
];

// Visual background images used across Home/Devotional/Dashboard/Hymn.
// Prefetched best-effort so they are available offline after first install/update.
const IMAGE_PRECACHE_URLS = [
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=1400&q=80',
  'https://storage.googleapis.com/dala-prod-public-storage/generated-images/f095a220-d4e4-4a6a-8aec-8a5aa9c8ce04/devotional-cover-1-cb4ac9fc-1782601932817.webp',
  'https://storage.googleapis.com/dala-prod-public-storage/generated-images/f095a220-d4e4-4a6a-8aec-8a5aa9c8ce04/bible-module-bg-2d68d807-1782601933195.webp',
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
  event.waitUntil((async () => {
    try {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(PRECACHE_URLS).catch(() => {});
    } catch {
      /* Tolerate shell pre-cache failure so SW still installs */
    }
    try {
      const runtime = await caches.open(RUNTIME_CACHE);
      await Promise.all(
        IMAGE_PRECACHE_URLS.map(async (url) => {
          try {
            const req = new Request(url, { mode: 'no-cors' });
            const res = await fetch(req);
            if (res) await runtime.put(req, res);
          } catch {
            /* Best-effort: image may cache later when viewed online */
          }
        })
      );
    } catch {
      /* ignore */
    }
  })());
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
    // Not JSON â€” fall back to the raw text payload
    if (event.data) {
      body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
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

  // 3. Same-origin static assets (JS, CSS, SVG, fonts, images): stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && (response.status === 200 || response.status === 206) && (response.type === 'basic' || response.type === 'cors')) {
              const copy = response.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
    return;
  }

  // 4. Cross-origin images and static media used in the app (backgrounds/thumbnails):
  // cache-first for offline availability, with background refresh when online.
  if (request.destination === 'image' || /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && (response.status === 200 || response.type === 'opaque')) {
              const copy = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});

