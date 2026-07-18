const CACHE = 'vve-beheer-v1'

// Cache de app shell bij installatie
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(['/', '/index.html'])
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Network-first: API calls altijd live; statische assets uit cache als offline
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // API en auth: altijd naar het netwerk
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match('/index.html')))
  )
})
