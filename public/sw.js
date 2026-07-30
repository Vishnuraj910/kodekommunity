const CACHE_PREFIX = "kommunity-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const APP_SHELL = ["/", "/manifest.webmanifest"];
const PRIVATE_PATH_PREFIXES = ["/api/", "/auth/", "/oauth/", "/admin/"];
const CACHEABLE_DESTINATIONS = new Set([
  "font",
  "image",
  "manifest",
  "script",
  "style",
  "worker",
]);

const isOwnedCache = (key) => key.startsWith(CACHE_PREFIX);

const isPublicAssetRequest = (request) => {
  if (request.method !== "GET" || request.headers.has("authorization")) {
    return false;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.search) return false;
  if (PRIVATE_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return false;
  }

  return CACHEABLE_DESTINATIONS.has(request.destination);
};

const isPublicResponse = (response) => {
  if (!response.ok || response.type !== "basic") return false;

  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  return !cacheControl.includes("private") && !cacheControl.includes("no-store");
};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => isOwnedCache(key) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/").then((cached) => cached ?? Response.error()),
      ),
    );
    return;
  }
  if (!isPublicAssetRequest(request)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchAndCache = () => fetch(request).then((response) => {
        if (isPublicResponse(response)) {
          event.waitUntil(
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, response.clone())),
          );
        }
        return response;
      });

      if (!cached) return fetchAndCache();
      event.waitUntil(fetchAndCache().catch(() => undefined));
      return cached;
    }),
  );
});
