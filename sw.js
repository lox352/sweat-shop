const version = "8e74ffffb21549ec";
const assets = ["404.html","assets/SweaterStage-Au5QsJAr.js","assets/index-Cyz04e-u.css","assets/index-DwJYEsFG.js","assets/index-DxVVyilS.js","favicon.svg","fonts/README.md","fonts/fonts.css","fonts/oswald-variable.woff2","fonts/source-sans-3-italic.woff2","fonts/source-sans-3-variable.woff2","index.html","robots.txt"];
const prefix = "sweat-shop-static-";
const cacheName = prefix + version;
const urlFor = path => new URL(path, self.registration.scope).href;
const urls = assets.map(urlFor);
/** Where each release's cache notes when it was installed, to tell the release before from older ones. */
const stamp = urlFor("__installed__");

/** Whether a release's page names only scripts and stylesheets that came with the release. */
const whole = async cache => {
  const page = await cache.match(urlFor("index.html"));
  if (!page) return false;
  const named = [...(await page.text()).matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)];
  return named.every(([, path]) => urls.includes(new URL(path, self.registration.scope).href));
};

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    /*
     * Every file afresh from the server, never from the browser's own cache.
     * GitHub Pages lets a browser keep a file for ten minutes, so a release
     * fetched through that cache just after it is published can pair the
     * last release's page with this one's scripts. Once the last release's
     * scripts are gone from the server, that page is blank - and the worker
     * would go on serving it. addAll is atomic: a failed download must not
     * advertise offline readiness, and nor must a page that names scripts
     * its release did not bring.
     */
    await cache.addAll(urls.map(url => new Request(url, { cache: "reload" })));
    if (!(await whole(cache))) {
      await caches.delete(cacheName);
      throw new Error("The page and its scripts are from different releases.");
    }
    await cache.put(stamp, new Response(String(Date.now())));
    /*
     * Take over as soon as the release is whole, not once every Sweat Shop
     * tab has closed: a page a bad release left blank would otherwise stay
     * blank through every reload. A page already open keeps the scripts it
     * has loaded, and the release before is kept for any it has yet to load.
     */
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    // This release, and the one before it for a page still open on that one; anything older goes.
    const others = (await caches.keys()).filter(key => key.startsWith(prefix) && key !== cacheName);
    const installed = await Promise.all(others.map(async key => {
      const noted = await (await caches.open(key)).match(stamp);
      return { key, at: noted ? Number(await noted.text()) : 0 };
    }));
    installed.sort((a, b) => b.at - a.at);
    for (const { key } of installed.slice(1)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const home = request.mode === "navigate" &&
    (url.pathname === scope.pathname || url.pathname === `${scope.pathname}index.html`);
  const key = home ? urlFor("index.html") : url.href;
  /*
   * A size's settled sweater is not prepared in advance - there are many, and
   * a knitter needs one - so it is kept the first time it is shown, and is
   * there offline from then on.
   */
  if (url.pathname.startsWith(`${scope.pathname}assets/settled/`)) {
    event.respondWith((async () => {
      const cached = await caches.match(key);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await (await caches.open(cacheName)).put(key, response.clone());
      return response;
    })());
    return;
  }
  if (home || urls.includes(key)) {
    event.respondWith((async () => {
      const cached = await (await caches.open(cacheName)).match(key);
      return cached ?? fetch(request);
    })());
    return;
  }
  // Anything else: a file of the release before, for a page still open on it, or the network.
  event.respondWith((async () => (await caches.match(key)) ?? fetch(request))());
});
