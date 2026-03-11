/* ============================================================
   SERVICE WORKER — Tennis Team App
   Zorgt dat de app installeerbaar is en offline werkt
   ============================================================ */

const CACHE = 'tennis-app-v4'
const STATIC = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './icon.svg',
  './manifest.json'
]

// Bij installatie: sla statische bestanden op in de cache
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC))
  )
  self.skipWaiting()
})

// Bij activatie: verwijder oude caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Verzoeken: gebruik cache voor statische bestanden, netwerk voor Firebase
self.addEventListener('fetch', e => {
  // Firebase en andere externe verzoeken altijd via netwerk
  if (!e.request.url.startsWith(self.location.origin)) return

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  )
})
