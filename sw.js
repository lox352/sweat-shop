const version = "3e6a44321f125649";
const assets = ["404.html","assets/SweaterStage-BhHxQ56Y.js","assets/index-9tKdngmy.css","assets/index-BvY4MzR1.js","assets/index-DxVVyilS.js","favicon.svg","fonts/README.md","fonts/fonts.css","fonts/oswald-variable.woff2","fonts/source-sans-3-italic.woff2","fonts/source-sans-3-variable.woff2","index.html","robots.txt"];
const prefix = "sweat-shop-static-";
const cacheName = prefix + version;
const urlFor = path => new URL(path, self.registration.scope).href;
const urls = assets.map(urlFor);

self.addEventListener("install", event => {
  // addAll is atomic: a failed download must not advertise offline readiness.
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(urls)));
  // No skipWaiting: keep an open knitting session on one coherent release.
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(prefix) && key !== cacheName) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin) return;
  const home = request.mode === "navigate" &&
    (url.pathname === scope.pathname || url.pathname === `${scope.pathname}index.html`);
  const key = home ? urlFor("index.html") : url.href;
  /*
   * A size's settled sweater is not prepared in advance - there are eight, and
   * a knitter needs one - so it is kept the first time it is shown, and is
   * there offline from then on.
   */
  if (url.pathname.startsWith(`${scope.pathname}assets/settled/`)) {
    event.respondWith((async () => {
      const cache = await caches.open(cacheName);
      const cached = await cache.match(key);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(key, response.clone());
      return response;
    })());
    return;
  }
  if (!home && !urls.includes(key)) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(cacheName)).match(key);
    return cached ?? fetch(request);
  })());
});
