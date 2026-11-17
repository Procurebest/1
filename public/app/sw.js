const CACHE = "procurebest-app-shell-v2";
const SHELL = ["/app/", "/app/career.html", "/app/manifest.webmanifest", "/app/app.css", "/app/app.js", "/img/mark.svg", "/img/icon-512.png"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/") || url.pathname.startsWith("/en/") || url.pathname.startsWith("/bn/")) return;
  if (url.pathname.startsWith("/app/") || url.pathname.startsWith("/img/")) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); }
      return response;
    })));
  }
});