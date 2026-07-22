// Minimal service worker: no offline caching (this app needs a live
// connection to Supabase to do anything useful anyway), but a registered
// worker with a fetch handler is required for "Add to Home Screen"
// installability on Chrome/Android.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Pass-through: always hit the network.
});
