const CACHE_NAME = "app-assets-v2";
const OFFLINE_URL = "/offline.html";
// The SPA serves the same HTML (the app shell) for every route. The last shell
// loaded online is saved under this key so the app can open offline.
const SHELL_URL = "/";
const urlsToCache = [
  OFFLINE_URL,
  "/logo-mark.png",
  "/icon/icon-192.png",
  "/icon/icon-512.png",
  "/icon/icon-maskable-192.png",
  "/icon/icon-maskable-512.png",
];
const matchCached = (request) => caches.match(request, { cacheName: CACHE_NAME });
const isHtml = (response) => (response.headers.get("content-type") ?? "").includes("text/html");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.allSettled(urlsToCache.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/auth")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && isHtml(response)) {
            const shellToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(SHELL_URL, shellToCache));
          }
          return response;
        })
        .catch(() =>
          matchCached(SHELL_URL)
            .then((shell) => shell ?? matchCached(OFFLINE_URL))
            .then((cached) => cached ?? new Response("Offline", { status: 503 })),
        ),
    );
    return;
  }

  if (!url.pathname.startsWith("/assets/") && !urlsToCache.includes(url.pathname)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response.ok || isHtml(response)) {
          return matchCached(event.request).then((cached) => cached ?? response);
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        return response;
      })
      .catch(() =>
        matchCached(event.request).then((cached) => cached ?? new Response("Offline", { status: 503 })),
      ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith("app-assets-") && cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(self.registration.showNotification(data.title, data.options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    }),
  );
});
