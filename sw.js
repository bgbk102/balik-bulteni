// Uygulama kabuğunu önbellekler; tahmin ve Claude notları her zaman ağdan, olmazsa önbellekten gelir.
const SHELL = 'bb-shell-v1';
const FILES = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/engine.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Önce ağ: uygulama dosyaları da güncel gelsin, çevrimdışıyken önbellek
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok && (url.origin === location.origin || url.hostname === 'unpkg.com' || url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com'))) {
        const copy = r.clone(); caches.open(SHELL).then(c => c.put(e.request, copy));
      }
      return r;
    }).catch(() => caches.match(e.request))
  );
});
