// Service Worker — 联网即最新 + 断网可用
// 策略：导航请求网络优先（联网打开直接拉最新版），失败才用缓存；
// 其他静态资源缓存优先 + 后台更新。这样只要用最新链接打开，每次都是最新版；
// 链接失效/断网时，缓存把 App 拉起来，桌面图标不失效。
const CACHE = 'zq-wb-v5';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return; // 交给浏览器自检更新
  if (url.pathname.startsWith('/api/')) return; // 数据接口走网络，不缓存

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // 导航（打开 App）：网络优先，联网即最新
    if (req.mode === 'navigate') {
      try {
        const res = await fetch(req);
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      } catch (err) {
        const fb = await cache.match(req) || await cache.match('./index.html') || await cache.match('./');
        if (fb) return fb;
        return Response.error();
      }
    }
    // 其他资源：缓存优先 + 后台更新
    const cached = await cache.match(req);
    const net = fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) return cached;
    const res = await net;
    if (res) return res;
    return cached || Response.error();
  })());
});
