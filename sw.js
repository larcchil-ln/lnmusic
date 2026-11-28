/* LNMusic service worker
 * - Shell aplikasi (HTML, ln-*.js, manifest, ikon) di-cache supaya UI tetap terbuka saat sinyal jelek/offline.
 * - Halaman & kode sendiri: network-first (deploy baru langsung terlihat), cache sebagai cadangan.
 * - CDN (Tailwind, Lucide, PeerJS, font): stale-while-revalidate.
 * - TIDAK menyentuh: /api/*, YouTube, signaling PeerJS, LRCLIB, atau request non-GET.
 * Naikkan VERSION setiap kali daftar SHELL berubah.
 */
const VERSION = 'v22-roomfull2';
const SHELL_CACHE = 'lnmusic-shell-' + VERSION;
const CDN_CACHE = 'lnmusic-cdn-' + VERSION;
const SHELL = [
  '/',
  '/index.html',
  '/ln-extras.js',
  '/ln-hub.js',
  '/ln-fix.js',
  '/ln-local.js',
  '/ln-offline-ui.js',
  '/ln-offline-v2.js',
  '/ln-redesign.css',
  '/ln-pages.css',
  '/ln-spotnav.css',
  '/ln-mixes.js',
  '/ln-orient.js',
  '/icons/splash-logo.png',
  '/ln-redesign.js',
  '/ln-roomfull.css',
  '/ln-roomfull.js',
  '/ln-minilyrics.js',
  '/ln-android.css',
  '/ln-android.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png'
];
const CDN_HOSTS = [
  'cdn.tailwindcss.com',
  'unpkg.com',
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache =>
      // Satu file gagal (mis. belum ada di server) tidak boleh menggagalkan seluruh install.
      Promise.all(SHELL.map(url => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => k.startsWith('lnmusic-') && k !== SHELL_CACHE && k !== CDN_CACHE)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Navigasi (buka halaman): network-first, cadangan dari cache.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then(c => c.put('/index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('/index.html').then(r => r || caches.match('/')))
    );
    return;
  }

  // File milik sendiri (ln-*.js, ikon, manifest): stale-while-revalidate.
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) return;
    // Kode (js/html/manifest): network-first, supaya deploy baru tidak tertahan versi lama
    // dan index.html tidak pernah berpasangan dengan ln-*.js yang usang. Ikon: stale-while-revalidate.
    const isIcon = url.pathname.startsWith('/icons/');
    event.respondWith(isIcon ? staleWhileRevalidate(req, SHELL_CACHE) : networkFirst(req, SHELL_CACHE));
    return;
  }

  // CDN yang dikenal: stale-while-revalidate.
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req, CDN_CACHE));
  }
  // Selain itu (YouTube, PeerJS, LRCLIB, dll): biarkan langsung ke jaringan.
});

function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then(cache =>
    cache.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          // Simpan respons normal maupun opaque (script/font lintas origin).
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
}

function networkFirst(req, cacheName) {
  return fetch(req)
    .then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(cacheName).then(c => c.put(req, copy)); }
      return res;
    })
    .catch(() => caches.match(req, { ignoreSearch: true }));
}
