// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

const scope = "https://example.org/sweat-shop/";
/** A release's page, naming the script and stylesheet it runs. */
const page = (script: string) =>
  `<script type="module" src="/sweat-shop/assets/${script}"></script><link rel="stylesheet" href="/sweat-shop/assets/app.css">`;

/** The browser's caches, in memory: each a map from a url to what was kept. */
function cacheStorage() {
  const stores = new Map<string, Map<string, Response>>();
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      match: async (key: string) => store.get(key)?.clone(),
      put: async (key: string, response: Response) => { store.set(key, response); },
      addAll: async (requests: Request[]) => {
        const responses = await Promise.all(requests.map((request) => server(request)));
        requests.forEach((request, index) => store.set(request.url, responses[index]));
      },
    };
  };
  let server: (request: Request) => Promise<Response> = async () => new Response("");
  return {
    stores,
    serveWith: (serve: (request: Request) => Promise<Response>) => { server = serve; },
    api: {
      open: vi.fn(open),
      keys: async () => [...stores.keys()],
      delete: vi.fn(async (name: string) => stores.delete(name)),
      match: async (key: string) => {
        for (const store of stores.values()) if (store.has(key)) return store.get(key)!.clone();
        return undefined;
      },
    },
  };
}

function worker(version = "new", served: Record<string, string> = { "index.html": page("app.js") }) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const caches = cacheStorage();
  const fetched: Request[] = [];
  caches.serveWith(async (request) => {
    fetched.push(request);
    const path = request.url.slice(scope.length);
    if (path === "assets/missing.js") throw new Error("offline");
    return new Response(served[path] ?? `the file ${path}`);
  });
  const claim = vi.fn(async () => {});
  const skipWaiting = vi.fn(async () => {});
  const fetch = vi.fn(async () => new Response("from the network"));
  const install = (assets = ["index.html", "assets/app.js", "assets/app.css"]) => {
    runInNewContext(readFileSync("scripts/service-worker.js", "utf8"), {
      __VERSION__: version, __ASSETS__: assets, URL, Request, Response, caches: caches.api, fetch,
      self: { registration: { scope }, clients: { claim }, skipWaiting,
        addEventListener: (type: string, handler: (event: unknown) => void) => { handlers[type] = handler; } },
    });
  };
  install();
  const run = async (type: string) => {
    let task: Promise<unknown> = Promise.resolve();
    handlers[type]({ waitUntil: (promise: Promise<unknown>) => { task = promise; } });
    await task;
  };
  return { handlers, caches, fetched, claim, skipWaiting, fetch, install, run };
}

it("installs the whole release afresh from the server, and takes over as soon as it has", async () => {
  const w = worker();
  await w.run("install");
  // Never through the browser's own cache, which may still hold the last release's page.
  expect(w.fetched.map((request) => [request.url, request.cache])).toEqual([
    [`${scope}index.html`, "reload"], [`${scope}assets/app.js`, "reload"], [`${scope}assets/app.css`, "reload"],
  ]);
  expect([...w.caches.stores.get("sweat-shop-static-new")!.keys()]).toContain(`${scope}index.html`);
  expect(w.skipWaiting).toHaveBeenCalledOnce();
});

it("rejects a partial download, and keeps none of it", async () => {
  const w = worker();
  w.install(["index.html", "assets/missing.js"]);
  await expect(w.run("install")).rejects.toThrow("offline");
  expect(w.caches.stores.get("sweat-shop-static-new")?.size ?? 0).toBe(0);
  expect(w.skipWaiting).not.toHaveBeenCalled();
});

it("rejects a release whose page names a script that did not come with it", async () => {
  // The last release's page, as a browser's cache might still hand it over.
  const w = worker("new", { "index.html": page("last-release.js") });
  await expect(w.run("install")).rejects.toThrow("different releases");
  expect(w.caches.stores.has("sweat-shop-static-new")).toBe(false);
  expect(w.skipWaiting).not.toHaveBeenCalled();
});

it("serves the app offline without intercepting external links or other applications", async () => {
  const w = worker();
  await w.run("install");
  let response: Promise<Response> = Promise.resolve(new Response(""));
  const respondWith = vi.fn((value: Promise<Response>) => { response = value; });
  w.handlers.fetch({ request: { method: "GET", mode: "navigate", url: scope }, respondWith });
  expect(await (await response).text()).toBe(page("app.js"));
  expect(w.fetch).not.toHaveBeenCalled();
  respondWith.mockClear();
  for (const url of ["https://shop.example.org/", "https://example.org/another-app/"]) {
    w.handlers.fetch({ request: { method: "GET", mode: "navigate", url }, respondWith });
  }
  expect(respondWith).not.toHaveBeenCalled();
});

it("keeps the release before for a page still open on it, and lets older ones go", async () => {
  const w = worker("new");
  const stamped = async (name: string, at: number, files: Record<string, string> = {}) => {
    const cache = await w.caches.api.open(name);
    await cache.put(`${scope}__installed__`, new Response(String(at)));
    for (const [path, body] of Object.entries(files)) await cache.put(`${scope}${path}`, new Response(body));
  };
  await stamped("sweat-shop-static-oldest", 1);
  await stamped("sweat-shop-static-before", 2, { "assets/before.js": "the release before's script" });
  await w.caches.api.open("another-app-static");
  await w.run("install");
  await w.run("activate");
  expect([...w.caches.stores.keys()].sort()).toEqual(["another-app-static", "sweat-shop-static-before", "sweat-shop-static-new"]);
  expect(w.claim).toHaveBeenCalledOnce();
  // A script the open page has yet to load comes from the release it was opened on.
  let response: Promise<Response> = Promise.resolve(new Response(""));
  w.handlers.fetch({ request: { method: "GET", mode: "no-cors", url: `${scope}assets/before.js` },
    respondWith: (value: Promise<Response>) => { response = value; } });
  expect(await (await response).text()).toBe("the release before's script");
});
