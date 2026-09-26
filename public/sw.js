// Service worker: lets the site open and work without a connection once it has
// been visited. The compiler (public/toolchain) is cached separately by the
// compiler worker, so it's left alone here.
//
// scripts/prerender.mjs fills in BUILD when the site is built: the app's built files, saved
// when this installs so that one visit is enough, and a version that changes whenever they
// or the home page do, so the browser installs the new service worker and drops the old copies.
const BUILD = { version: "dev", files: [] };
const CACHE = "cpp-arena-app-" + BUILD.version;
const scope = new URL(self.registration.scope);
const SHELL = new URL("./", scope).href;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll([SHELL, new URL("manifest.webmanifest", scope).href, ...BUILD.files.map((f) => new URL(f, scope).href)]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("cpp-arena-app-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    // Offline: the saved copy of this page, or the app shell (the app routes it).
    return (await cache.match(req, { ignoreSearch: true })) ?? (await cache.match(SHELL)) ?? Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const fresh = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit ?? Response.error());
  return hit ?? fresh;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const path = url.pathname.slice(scope.pathname.length);
  if (path.startsWith("toolchain/")) return;
  if (req.mode === "navigate") return e.respondWith(networkFirst(req));
  // Built files have a content hash in their name, so a cached copy never goes stale.
  if (path.startsWith("assets/")) return e.respondWith(cacheFirst(req));
  e.respondWith(staleWhileRevalidate(req));
});
