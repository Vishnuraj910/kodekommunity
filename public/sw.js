const CACHE_PREFIX = "kommunity-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const APP_SHELL = ["/", "/manifest.webmanifest"];
const PRIVATE_PATH_PREFIXES = ["/api/", "/auth/", "/oauth/", "/admin/"];
const PUBLIC_ASSET_PREFIXES = ["/assets/"];
const PUBLIC_ASSET_PATHS = new Set(["/manifest.webmanifest"]);
const CACHEABLE_DESTINATIONS = new Set([
  "font",
  "image",
  "manifest",
  "script",
  "style",
  "worker",
]);

const isOwnedCache = (key) => key.startsWith(CACHE_PREFIX);
const isPrivatePath = (pathname) =>
  PRIVATE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
const isPublicAssetPath = (pathname) =>
  PUBLIC_ASSET_PATHS.has(pathname) ||
  PUBLIC_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix));

const isPublicAssetRequest = (request) => {
  if (request.method !== "GET" || request.headers.has("authorization")) {
    return false;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.search) return false;
  if (isPrivatePath(url.pathname) || !isPublicAssetPath(url.pathname)) return false;

  return CACHEABLE_DESTINATIONS.has(request.destination);
};

const isPublicResponse = (response) => {
  if (!response.ok || response.type !== "basic") return false;

  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  return !cacheControl.includes("private") && !cacheControl.includes("no-store");
};

const cachePublicShell = async () => {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    APP_SHELL.map(async (path) => {
      const request = new Request(path, {
        cache: "reload",
        credentials: "omit",
      });
      const response = await fetch(request);
      if (isPublicResponse(response)) {
        await cache.put(path, response);
      }
    }),
  );
};

self.addEventListener("install", (event) => {
  event.waitUntil(cachePublicShell());
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
    const url = new URL(request.url);
    if (url.origin !== self.location.origin || isPrivatePath(url.pathname)) {
      return;
    }
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
