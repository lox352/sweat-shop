import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

function worker(failDownload = false) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const shell = { body: "cached app" };
  const cache = { addAll: vi.fn(() => failDownload ? Promise.reject(new Error("offline")) : Promise.resolve()),
    match: vi.fn(() => Promise.resolve(shell)) };
  const caches = { open: vi.fn(() => Promise.resolve(cache)), keys: async () => ["other-app", "sweat-shop-static-old"],
    delete: vi.fn(async () => true) };
  const claim = vi.fn(async () => {});
  const fetch = vi.fn();
  runInNewContext(readFileSync("scripts/service-worker.js", "utf8"), {
    __VERSION__: "test", __ASSETS__: ["index.html", "assets/app.js"], URL, caches, fetch,
    self: { registration: { scope: "https://example.org/sweat-shop/" }, clients: { claim },
      addEventListener: (type: string, handler: (event: unknown) => void) => { handlers[type] = handler; } },
  });
  return { handlers, caches, cache, shell, claim, fetch };
}

it("installs the complete release and rejects partial offline downloads", async () => {
  const good = worker();
  let task: Promise<unknown> = Promise.resolve();
  const event = { waitUntil: (promise: Promise<unknown>) => { task = promise; } };
  good.handlers.install(event);
  await task;
  expect(good.cache.addAll).toHaveBeenCalledWith(["https://example.org/sweat-shop/index.html", "https://example.org/sweat-shop/assets/app.js"]);
  worker(true).handlers.install(event);
  await expect(task).rejects.toThrow("offline");
});

it("serves the app offline without intercepting external links or other applications", async () => {
  const w = worker();
  let response: Promise<unknown> = Promise.resolve();
  const respondWith = vi.fn((value: Promise<unknown>) => { response = value; });
  w.handlers.fetch({ request: { method: "GET", mode: "navigate", url: "https://example.org/sweat-shop/" }, respondWith });
  expect(await response).toBe(w.shell);
  expect(w.fetch).not.toHaveBeenCalled();
  respondWith.mockClear();
  for (const url of ["https://shop.example.org/", "https://example.org/another-app/"]) {
    w.handlers.fetch({ request: { method: "GET", mode: "navigate", url }, respondWith });
  }
  expect(respondWith).not.toHaveBeenCalled();
});

it("cleans up only obsolete Wool Week caches when activation is safe", async () => {
  const w = worker();
  let task: Promise<unknown> = Promise.resolve();
  w.handlers.activate({ waitUntil: (promise: Promise<unknown>) => { task = promise; } });
  await task;
  expect(w.caches.delete).toHaveBeenCalledExactlyOnceWith("sweat-shop-static-old");
  expect(w.claim).toHaveBeenCalledOnce();
});
