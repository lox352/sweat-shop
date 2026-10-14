/**
 * What the built site costs a phone to fetch, against what it may.
 *
 *     npm run build && npm run budgets
 *
 * Gzipped, as it goes over the wire. Three things are fetched at different
 * times, and each has its own budget:
 *
 * - the page: everything a visit fetches before anything else, which is
 *   what stands between a knitter and their chart;
 * - the 3D stage: three.js and the drawing of the sweater, fetched only when
 *   the sweater is on screen;
 * - a settled size: one size's settled sweater, fetched with it.
 *
 * Each budget leaves some room over what the site costs now, so that it
 * fails on a real jump rather than on every change.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const kb = 1024;
const budgets = { page: 170 * kb, stage: 260 * kb, settled: 300 * kb };

const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );
const gzipped = (path) => gzipSync(readFileSync(path), { level: 9 }).length;
const kind = (path) =>
  path.includes("/settled/") ? "settled" : /\/SweaterStage-[^/]+\.js$/.test(path) ? "stage" : "page";

const assets = files("dist/assets").filter((path) => /\.(js|css)$/.test(path));
const page = assets.filter((path) => kind(path) === "page").reduce((total, path) => total + gzipped(path), 0);
const rows = [
  ["the page", page, budgets.page],
  ...assets
    .filter((path) => kind(path) !== "page")
    .map((path) => [path.replace("dist/assets/", ""), gzipped(path), budgets[kind(path)]]),
];
let over = 0;
for (const [name, size, budget] of rows) {
  const verdict = size > budget ? "OVER" : "ok";
  if (size > budget) over++;
  console.log(`${verdict.padEnd(4)} ${String(Math.round(size / kb)).padStart(4)}KB of ${Math.round(budget / kb)}KB  ${name}`);
}
if (over) {
  console.error(`${over} over budget`);
  process.exitCode = 1;
}
