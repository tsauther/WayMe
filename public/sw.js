const CACHE_NAME = 'wayme-v1'

// Install event
self.addEventListener('install', event => {
  self.skipWaiting()
})

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// Fetch event - Network first strategy for development
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return
  }
// Only handle requests inside the PWA scope (important for GitHub Pages) 
 if (!event.request.url.startsWith(self.registration.scope)) return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Only cache successful responses
        if (response && response.status === 200) {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache)
          })
        }
        return response
      })
      .catch(() => {
        // Try cache on network failure
        return caches.match(event.request)
      })
  )
})
