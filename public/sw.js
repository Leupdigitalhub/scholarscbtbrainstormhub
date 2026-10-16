// Pass-through service worker: makes the app installable without caching anything,
// so students always get the latest version (no stale pages after updates).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // No respondWith: the browser handles every request normally from the network.
});
