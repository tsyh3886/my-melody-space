// Service Worker：App Shell 预缓存 + 静态资源 SWR，API 永不缓存
const CACHE = 'mms-v2';
const SHELL = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/main.js',
  '/js/auth.js',
  '/js/data.js',
  '/js/ai.js',
  '/js/render.js',
  '/js/ui.js',
  '/manifest.webmanifest',
  '/assets/img/melody-0.png',
  '/assets/img/melody-1.png',
  '/assets/img/melody-2.png',
  '/assets/img/melody-3.png',
  '/assets/img/melody-4.png',
  '/assets/img/melody-5.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // API 只走网络

  // 页面导航：网络优先，失败回退缓存（保证登录态页面总是最新）
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put('/', copy));
        return res;
      }).catch(() => caches.match('/'))
    );
    return;
  }

  // 静态资源：网络优先（避免新旧版本混合导致白屏），失败回退缓存（离线兜底）
  event.respondWith(
    fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});