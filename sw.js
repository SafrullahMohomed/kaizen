// Service worker: makes Kaizen work offline.
// App files are cache-first (bump VERSION whenever any app file changes).
// Content files are network-first, so new ideas appear without bumping VERSION.
const VERSION = 'kaizen-app-v1';
const CONTENT = 'kaizen-content';

const APP_FILES = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/util.js',
  './js/srs.js',
  './js/content.js',
  './js/store.js',
  './js/art.js',
  './js/ui.js',
  './js/sheets.js',
  './js/reader.js',
  './js/review.js',
  './js/views.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];
const CONTENT_FILES = ['./content/index.json', './content/journeys.json', './content/packs/leadership.json', './content/packs/learning.json', './content/packs/engineering.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    Promise.all([
      caches.open(VERSION).then((c) => c.addAll(APP_FILES)),
      caches.open(CONTENT).then((c) => c.addAll(CONTENT_FILES).catch(() => {})),
    ])
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== CONTENT).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));

async function networkFirst(req) {
  const cache = await caches.open(CONTENT);
  try {
    const res = await Promise.race([fetch(req, { cache: 'no-cache' }), timeout(5000)]);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw new Error('offline and not cached');
  }
}

async function cacheFirst(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && new URL(req.url).origin === self.location.origin) {
    const cache = await caches.open(VERSION);
    cache.put(req, res.clone());
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((hit) => hit || fetch(req)));
    return;
  }
  if (url.pathname.includes('/content/')) {
    e.respondWith(networkFirst(req));
    return;
  }
  e.respondWith(cacheFirst(req));
});
