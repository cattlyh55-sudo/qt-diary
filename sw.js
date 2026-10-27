// 앱 파일을 캐시해서 오프라인에서도 열리게 한다.
// 파일을 고치면 VERSION과 index.html의 ?v= 숫자를 함께 올릴 것.
const VERSION = 'qt-diary-v6';
const FILES = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'render.js',
  'manifest.webmanifest',
  'assets/header.png',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'vendor/jspdf.umd.min.js',
];

// 브라우저 HTTP 캐시(GitHub Pages는 10분)를 건너뛰고 서버에서 직접 받는다
self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 네트워크 우선, 실패하면 캐시. 'no-cache'로 매번 서버에 바뀌었는지 확인해서
// 새 index.html과 예전 app.js/style.css가 섞여 열리는 일을 막는다.
self.addEventListener('fetch', ev => {
  if (ev.request.method !== 'GET') return;
  const sameOrigin = new URL(ev.request.url).origin === location.origin;
  const req = !sameOrigin ? ev.request
    : ev.request.mode === 'navigate' ? new Request(ev.request.url, { cache: 'no-cache' })
    : new Request(ev.request, { cache: 'no-cache' });
  ev.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok && sameOrigin) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(ev.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(ev.request, { ignoreSearch: true }))
  );
});
