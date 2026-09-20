const CACHE_NAME = 'pollstrack-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  // Offline form data is handled by localStorage queue.
  // This SW mainly makes the app installable.
})