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
 * - a settled size: one size's settled sweater, fetched with it;
 * - a frozen edition: one size's knitting as a project part way through
 *   knits it, fetched only by such a project (see data/sweaters/editions).
 *
 * Each budget leaves some room over what the site costs now, so that it
 * fails on a real jump rather than on every change.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const kb = 1024;
/*
 * The page's was 170KB, and the site had grown to exactly that. The two Wool
 * Week samplers bring it to 195KB: thirteen hats' charts and every colourway
 * they were published in, and the planning, knitting and palettes that make
 * a jumper of them. Their nine many-colour palettes, tens of yarns each,
 * bring it to 211KB; stitch markers drawn up the chart, the underarm torn
 * apart in the Body view, and each part of the samplers' trim in its own
 * darkest yarn, to 220KB. By 229KB, the chart gliding to the next stitch
 * where it will be, worked out ahead, brings it to 230KB, a hundred bytes
 * over: 240KB. The two Nasca feline jumpers - their felines a vector model
 * drawn as stitches at whatever size a jumper has room for, and the raglan
 * and round-yoke knitting that lays them in - bring it to 242KB: 250KB.
 */
// A frozen edition of the largest size is 19KB.
const budgets = { page: 250 * kb, stage: 260 * kb, settled: 300 * kb, edition: 40 * kb };

const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );
const gzipped = (path) => gzipSync(readFileSync(path), { level: 9 }).length;
const kind = (path) =>
  path.includes("/settled/") ? "settled" : /\/SweaterStage-[^/]+\.js$/.test(path) ? "stage" : "page";

const assets = files("dist/assets").filter((path) => /\.(js|css)$/.test(path));
const page = assets.filter((path) => kind(path) === "page").reduce((total, path) => total + gzipped(path), 0);
// Frozen editions are served as they are, beside the assets: the largest stands for them all.
const editions = existsSync("dist/editions") ? files("dist/editions").map((path) => [path.replace("dist/", ""), gzipped(path), budgets.edition]) : [];
const largest = editions.sort((a, b) => b[1] - a[1]).slice(0, 1);
const rows = [
  ["the page", page, budgets.page],
  ...largest,
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
