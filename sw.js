// ══════════════════════════════════════════════════════
//  Midland Quarter — Service Worker v6
//  ✅ App shell: Network-First (fresh content)
//  ✅ Firebase SDK + CDN: Cache-First (3-4s বাঁচে!)
//  ✅ Firebase RTDB data: Network-Only (সবসময় fresh)
//  ✅ skipWaiting + clients.claim → instant activation
// ══════════════════════════════════════════════════════

const CACHE_VERSION = 'mq-v6';

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
];

// Firebase SDK + CDN — version-fixed URLs, cache করা safe
const EXTERNAL_ASSETS = [
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js',
];

self.addEventListener('install', event => {
  console.log('[SW] Installing:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      const shellP = SHELL_ASSETS.map(url =>
        cache.add(url).catch(err => console.warn('[SW] Shell miss:', url, err))
      );
      const extP = EXTERNAL_ASSETS.map(url =>
        fetch(url, { mode: 'no-cors' })
          .then(res => cache.put(url, res))
          .catch(err => console.warn('[SW] Ext miss:', url, err))
      );
      return Promise.allSettled([...shellP, ...extP]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[SW] Activating:', CACHE_VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' })
        .then(cs => cs.forEach(c => c.postMessage({ type: 'SW_UPDATED' })))
      )
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // 1️⃣ Firebase RTDB + Auth → NETWORK ONLY (real-time data)
  const networkOnly = ['firebaseio.com', 'firebaseapp.com', 'googleapis.com'];
  if (networkOnly.some(d => url.hostname.includes(d))) return;

  // 2️⃣ Firebase SDK + CDN → CACHE FIRST (instant on 2nd load)
  const cacheFirst = ['gstatic.com', 'cdnjs.cloudflare.com', 'fonts.gstatic.com'];
  if (cacheFirst.some(d => url.hostname.includes(d))) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request, { mode: 'no-cors' }).then(res => {
          caches.open(CACHE_VERSION).then(c => c.put(event.request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // 3️⃣ App shell → NETWORK FIRST, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          caches.open(CACHE_VERSION).then(c => c.put(event.request, res.clone()));
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request)
          .then(cached => cached || caches.match('./index.html'))
      )
  );
});
