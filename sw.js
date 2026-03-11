/* ============================================================
   SERVICE WORKER — Tennis Team App
   Zorgt dat de app installeerbaar is en offline werkt
   ============================================================ */

const CACHE = 'tennis-app-v10'

// Bij installatie: sla ALLEEN het icoontje en manifest op
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['./icon.svg', './manifest.json']))
  )
  self.skipWaiting()
})

// Bij activatie: verwijder ALLE oude caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Verzoeken: HTML/JS/CSS ALTIJD vers van de server (bypast HTTP-cache)
self.addEventListener('fetch', e => {
  if (!e.request.url.startsWith(self.location.origin)) return

  const url = new URL(e.request.url)
  const isCachedAsset = url.pathname.endsWith('.svg') ||
                        url.pathname.endsWith('manifest.json')

  if (isCachedAsset) {
    // Icoontje en manifest: cache-first (veranderen zelden)
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    )
  } else {
    // index.html, app.js, style.css: altijd VERS van de server,
    // cache: 'no-cache' zorgt dat de browser-HTTP-cache wordt genegeerd
    e.respondWith(
      fetch(new Request(e.request.url, { cache: 'no-cache' }))
        .catch(() => caches.match(e.request))
    )
  }
})
