/* ============================================================
   SERVICE WORKER — Tennis Team App
   Zorgt dat de app installeerbaar is en offline werkt
   ============================================================ */

const CACHE = 'tennis-app-v6'

// Bij installatie: sla ALLEEN het icoontje en manifest op
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['./icon.svg', './manifest.json']))
  )
  self.skipWaiting()
})

// Bij activatie: verwijder ALLE oude caches (ook v1–v5)
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Verzoeken: HTML/JS/CSS ALTIJD vers van het netwerk halen
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
    // index.html, app.js, style.css: ALTIJD netwerk, nooit cachen
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    )
  }
})
