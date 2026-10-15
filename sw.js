// =====================================================
// SERVICE WORKER — Caderneta
// Estratégia "rede primeiro": HTML, JS, CSS e JSON vêm SEMPRE do servidor
// (ignorando o cache do navegador); o cache só é usado se estiver offline.
// Assim a atualização aparece na primeira abertura, sem precisar recarregar.
// Ícones e imagens: cache primeiro, com atualização em segundo plano.
//
// Ao publicar, suba CACHE_VERSION para limpar o cache antigo dos aparelhos.
// =====================================================

const CACHE_VERSION = 'v2';
const CACHE_NAME = 'caderneta-' + CACHE_VERSION;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './firebase-sync.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.ico',
  './icons/favicon-32.png',
  './icons/favicon-16.png'
];

// domínios que NUNCA passam pelo service worker (vão direto para a rede)
const DOMINIOS_IGNORADOS = ['googleapis.com', 'gstatic.com', 'firebaseio.com', 'firebaseapp.com'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // 'reload' ignora o cache HTTP: guarda a versão mais nova do servidor
    await Promise.all(APP_SHELL.map(async (p) => {
      try {
        const res = await fetch(new Request(p, { cache: 'reload' }));
        if (res && res.ok) await cache.put(p, res);
      } catch (e) { /* offline na instalação: segue */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('caderneta-') && k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

const ehCodigo = (url) => /\.(?:html|js|css|json|webmanifest)$/i.test(url.pathname) || url.pathname.endsWith('/');

async function redePrimeiro(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(request, { cache: 'no-cache' });
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(request, { ignoreSearch: true })
      || (request.mode === 'navigate' && await cache.match('./index.html'));
    if (hit) return hit;
    return new Response('Sem conexão e sem cópia guardada.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function cachePrimeiro(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const rede = fetch(request).then((res) => {
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => cached);
  return cached || rede;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;                 // fontes, CDN etc.: direto na rede
  if (DOMINIOS_IGNORADOS.some((d) => url.hostname.includes(d))) return;
  if (request.mode === 'navigate' || ehCodigo(url)) { event.respondWith(redePrimeiro(request)); return; }
  event.respondWith(cachePrimeiro(request));
});

self.addEventListener('message', (event) => { if (event.data === 'SKIP_WAITING') self.skipWaiting(); });
