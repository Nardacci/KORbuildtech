/* KORbuild — service worker.
 * Guarda o app inteiro no aparelho na instalação, para abrir e funcionar no canteiro sem internet.
 * Arquivos do app: rede primeiro (pega a versão nova) e cópia guardada quando não há conexão.
 * O clima (Open-Meteo) nunca passa pelo cache: sem internet, o app pede para marcar à mão. */
var CACHE = 'korbuild-v13';
var APP = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/util.js', 'js/armazem.js', 'js/fotos.js', 'js/clima.js', 'js/ia.js',
  'js/exemplo.js', 'js/lacre.js', 'js/relatorio.js', 'js/plataforma.js', 'js/icones.js', 'js/prazos.js', 'js/crew.js', 'js/crew-telas.js', 'js/settings.js', 'js/settings-telas.js', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(APP); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (nomes) {
    return Promise.all(nomes.filter(function (n) { return n !== CACHE; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var fonte = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !fonte) return;
  e.respondWith(fetch(req).then(function (resp) {
    if (resp.ok || resp.type === 'opaque') {
      var copia = resp.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copia); });
    }
    return resp;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); });
  }));
});

/* Tocar na notificação de lembrete abre (ou traz para a frente) a tela Hoje do Daily. */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var destino = new URL('./' + ((e.notification.data && e.notification.data.url) || ''), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (janelas) {
    for (var i = 0; i < janelas.length; i++) {
      if ('focus' in janelas[i]) { janelas[i].navigate(destino); return janelas[i].focus(); }
    }
    return self.clients.openWindow(destino);
  }));
});
