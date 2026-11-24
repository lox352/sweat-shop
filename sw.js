const version = "c9671c5fc5e1b119";
const assets = ["404.html","apple-touch-icon.png","assets/SweaterComparison-BP7pOP8K.js","assets/SweaterComparison-D1KKs_NQ.css","assets/SweaterStage-BNKOoWgO.js","assets/index-B_rfhwnz.css","assets/index-DxVVyilS.js","assets/index-J_9FJd5X.js","favicon.svg","fonts/README.md","fonts/fonts.css","fonts/oswald-variable.woff2","fonts/source-sans-3-italic.woff2","fonts/source-sans-3-variable.woff2","icon-192.png","icon-512.png","icon-maskable-512.png","index.html","manifest.webmanifest","robots.txt"];
const prefix = "sweat-shop-static-";
const cacheName = prefix + version;
const urlFor = path => new URL(path, self.registration.scope).href;
const urls = assets.map(urlFor);
/** Where each release's cache notes when it was installed, to tell the release before from older ones. */
const stamp = urlFor("__installed__");
/**
 * A frozen edition of a size's knitting, and a settled shape: each a file
 * named by what it holds, which never changes, fetched only when its size is
 * shown. So neither is prepared in advance, and both are kept from the first
 * time they are fetched, through every release after.
 */
const keeps = url => url.startsWith(urlFor("editions/")) || url.startsWith(urlFor("shapes/")) || url.startsWith(urlFor("colourways/"));

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
    /*
     * A frozen edition is what a project part way through knits (see below),
     * and its file never changes, so the ones a release going kept come with
     * it into this one: a project must still open offline however many
     * releases have come and gone since its edition was fetched.
     */
    const cache = await caches.open(cacheName);
    for (const { key } of installed) {
      const old = await caches.open(key);
      for (const { url } of await old.keys()) {
        if (!keeps(url) || (await cache.match(url))) continue;
        const kept = await old.match(url);
        if (kept) await cache.put(url, kept);
      }
    }
    for (const { key } of installed.slice(1)) await caches.delete(key);
    await self.clients.claim();
  })());
});

/*
 * The editions the knitter's own projects knit, named by the page once this
 * worker is up: one fetched before it was - on a first visit - was never
 * kept, and a pattern can be had no other way offline. The page is answered
 * when they are kept, or could not be.
 */
self.addEventListener("message", event => {
  const keep = event.data?.keep;
  if (!Array.isArray(keep)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    for (const path of keep) {
      const url = urlFor(path);
      if (!keeps(url) || (await caches.match(url))) continue;
      try {
        const response = await fetch(url);
        if (response.ok) await cache.put(url, response);
      } catch {
        // Kept when it is next fetched.
      }
    }
    event.ports[0]?.postMessage("kept");
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
   * there offline from then on. So is a frozen edition of a size's knitting,
   * which only a project still knitting it fetches.
   */
  if (keeps(url.href)) {
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
