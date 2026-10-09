const SHELL_CACHE = "trc-atlas-shell-0.15.5";
const SHELL_URLS = [
  "/",
  "/index.html",
  "/assets/styles.css?v=0.15.5",
  "/assets/help-content.js?v=0.15.5",
  "/assets/app.js?v=0.15.5",
  "/assets/trc-atlas-layers-logo.svg",
  "/assets/trc-atlas-icon-192.png",
  "/assets/trc-atlas-icon-512.png",
  "/assets/help/github-release-0.15.2.png",
  "/assets/help/settings-backups.png",
  "/assets/help/settings-updates.png",
  "/manifest.webmanifest?v=0.15.5",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("trc-atlas-shell-") && key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(SHELL_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(request, { ignoreSearch: false });
      if (cached) return cached;
      if (request.mode === "navigate") return caches.match("/index.html");
      return Response.error();
    }
  })());
});
