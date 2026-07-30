// =====================================================
// SERVICE WORKER — Caderneta
// Mesmo padrão dos outros apps: cache do "app shell" com
// versionamento manual, e domínios do Firebase/Google
// (auth, firestore, fonts, gstatic) sempre passam direto
// pela rede — nunca ficam presos em cache velho.
//
// IMPORTANTE: sempre que publicar uma alteração no app,
// suba o número da versão abaixo (v1 -> v2 -> v3...).
// Isso força o navegador a buscar os arquivos novos.
// =====================================================

const CACHE_VERSION = 'v1';
const CACHE_NAME = `caderneta-${CACHE_VERSION}`;

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

// domínios que NUNCA devem passar pelo cache do service worker
const DOMINIOS_IGNORADOS = [
  'googleapis.com',
  'gstatic.com',
  'firebaseio.com',
  'firebaseapp.com',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com'
];

function deveIgnorar(url){
  return DOMINIOS_IGNORADOS.some(d => url.includes(d));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes
          .filter((nome) => nome.startsWith('caderneta-') && nome !== CACHE_NAME)
          .map((nome) => caches.delete(nome))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (deveIgnorar(request.url)) return; // deixa a rede cuidar (auth, firestore, fontes)

  event.respondWith(
    caches.match(request).then((cached) => {
      const rede = fetch(request)
        .then((resposta) => {
          if (resposta && resposta.ok){
            const clone = resposta.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return resposta;
        })
        .catch(() => cached);
      return cached || rede;
    })
  );
});
