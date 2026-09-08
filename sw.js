// sw.js — QuizNCC
//
// Cache dell'app per l'uso offline. Cambiare VERSION a ogni deploy: la vecchia cache
// viene buttata e i file ricaricati dalla rete.
const VERSION = 'quizncc-2026-09-08a';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'data/domande.json', 'data/percorsi.json', 'data/confluenze.json', 'data/cosadove.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Rete prima, cache se offline: così un deploy nuovo arriva al primo ricaricamento online.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
