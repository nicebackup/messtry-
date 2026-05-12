// ══════════════════════════════════════════════════════
//  Midland Quarter — Service Worker
//  ✅ Network-First strategy (সবসময় fresh data)
//  ✅ Auto cache-bust on new version
//  ✅ Firebase / CDN calls কখনো cache হয় না
//  ✅ skipWaiting + clients.claim → instant activation
// ══════════════════════════════════════════════════════

// ⚠️ নতুন কোড deploy করলে এই version বাড়াও (যেমন v4, v5...)
// তাহলে পুরনো cache মুছে নতুন version সাথে সাথে load হবে
const CACHE_VERSION = 'mq-v4';

// যেসব local asset cache করা হবে (app shell)
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './icon-192.png',
];

// ── Install: shell assets pre-cache ──
self.addEventListener('install', event => {
  console.log('[SW] Installing version:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      // addAll fails if any asset missing — তাই individual try করি
      return Promise.allSettled(
        SHELL_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Cache miss:', url, err))
        )
      );
    })
  );
  // ✅ পুরনো SW কে সরিয়ে নতুনটা সাথে সাথে activate করো
  self.skipWaiting();
});

// ── Activate: পুরনো cache মুছে ফেলো ──
self.addEventListener('activate', event => {
  console.log('[SW] Activating version:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => {
      // ✅ সব open tab এ নতুন SW নিয়ন্ত্রণ নিক
      return self.clients.claim();
    }).then(() => {
      // ✅ সব client-কে reload করতে বলো
      return self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SW_UPDATED' });
        });
      });
    })
  );
});

// ── Fetch: কোনটা cache করব, কোনটা করব না ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ════════════════════════════════════════════
  // ❌ এগুলো NEVER cache করব — সবসময় network
  // ════════════════════════════════════════════
  const neverCache = [
    'firebaseio.com',       // Firebase Realtime Database
    'firebaseapp.com',      // Firebase Auth
    'googleapis.com',       // Google APIs / Fonts
    'gstatic.com',          // Firebase SDK / Google static
    'cdnjs.cloudflare.com', // CDN scripts (jspdf, html2canvas)
    'fonts.gstatic.com',    // Google Fonts files
  ];

  if (neverCache.some(domain => url.hostname.includes(domain))) {
    // Network only — no cache
    return;
  }

  // Non-GET requests (POST, PUT etc.) — no cache
  if (event.request.method !== 'GET') {
    return;
  }

  // ════════════════════════════════════════════
  // ✅ App shell: Network-First, fallback to cache
  //    নেটওয়ার্ক থেকে নিতে পারলে নেবে (fresh)
  //    না পারলে cache থেকে দেবে (offline support)
  // ════════════════════════════════════════════
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // ✅ Network সফল — cache-এ update করো
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type !== 'opaque'
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_VERSION).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // ❌ Network fail (offline) — cache থেকে দাও
        return caches.match(event.request).then(cached => {
          if (cached) {
            return cached;
          }
          // Cache-এও নেই — index.html fallback (SPA)
          return caches.match('./index.html');
        });
      })
  );
});
