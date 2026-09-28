const CACHE  = 'fragapp-v1';
const EXTRAS = 'fragapp-extras-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c =>
    c.addAll(['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== EXTRAS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function networkFirst(req) {
  return new Promise(resolve => {
    let done = false;
    const fallback = () => caches.match(req).then(hit => hit || caches.match('./index.html'));
    const t = setTimeout(() => {
      fallback().then(hit => { if (hit && !done) { done = true; resolve(hit); } });
    }, 3000);
    fetch(req).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      if (!done) { done = true; clearTimeout(t); resolve(r); }
    }).catch(() => {
      clearTimeout(t);
      if (!done) fallback().then(hit => { done = true; resolve(hit || Response.error()); });
    });
  });
}

function cacheFirst(req) {
  return caches.open(EXTRAS).then(c => c.match(req).then(hit => hit ||
    fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; })));
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname.includes('firebaseio.com')) return;
  if (url.hostname === 'raw.githubusercontent.com' ||
      url.hostname === 'fonts.googleapis.com' ||
      url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(e.request));
    return;
  }
  if (url.origin === self.location.origin) e.respondWith(networkFirst(e.request));
});