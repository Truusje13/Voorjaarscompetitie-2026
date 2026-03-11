/* ============================================================
   SERVICE WORKER — Tennis Team App
   Zorgt dat de app installeerbaar is en offline werkt
   ============================================================ */

const CACHE = 'tennis-app-v5'
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

// Verzoeken: network-first voor eigen bestanden, zodat updates meteen zichtbaar zijn
self.addEventListener('fetch', e => {
  // Firebase en andere externe verzoeken altijd via netwerk
  if (!e.request.url.startsWith(self.location.origin)) return

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Sla de verse versie op in de cache
        const clone = response.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return response
      })
      .catch(() => caches.match(e.request)) // Offline: gebruik cache
  )
})
