/**
 * What the built site costs a phone to fetch, against what it may.
 *
 *     npm run build && npm run budgets
 *
 * Gzipped, as it goes over the wire. Four things are fetched at different
 * times, and each has its own budget:
 *
 * - the page: everything a visit fetches before anything else, which is
 *   what stands between a knitter and their chart;
 * - the 3D stage: three.js and the drawing of the sweater, fetched only when
 *   the sweater is on screen;
 * - a settled shape: one size's settled sweater, fetched with it (see
 *   scripts/shapes.mjs);
 * - a frozen edition: one size's knitting, fetched when that size is shown
 *   (see library/editions);
 * - the fitting: the designs' planners and the engine, in a worker, fetched
 *   only when a knitter asks for the rest of their sweater to be worked out
 *   again for their tension (see library/fit);
 * - the settling: the physics, in a worker, fetched only to settle such a
 *   sweater into its shape (see physics/settling).
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
 * Then the designs' own files and the engine go from the site altogether: a
 * page reads the designs from a catalogue and their knitting from frozen
 * copies, and is 198KB: 210KB. A sweater worked out for its knitter is
 * worked out in workers the page does not carry, but what the page does
 * with one is its own - a tension asked for and compared, the preview of a
 * fit, knitting and shapes kept on the device, an update joined part way,
 * a colourway placed on it - and brings it to 210KB: 220KB. The chart
 * keeping its place as it is looked about - the way back to the stitch
 * being knitted, the round numbers kept beside the box, a block of columns
 * opening or closing round the box held off the screen, and a pinch carried
 * along with the fingers - brings it to 221KB: 230KB. Rows left whole, never
 * closed up, take it back to 220KB. The felines redrawn from closer traces,
 * with their sleeves' and cuffs' creatures, bring it to 228KB; and a card
 * that shows a front, a raglan's bands closed up with their corners folded
 * out, to 231KB: 240KB.
 */
// A frozen edition of the largest size is 19KB.
/*
 * The fitting worker was 78KB - every design's planner and charts, and the
 * engine - and had grown to 90KB. A yoke shaped to the body brings it to
 * 100KB: how its increases are placed, and the bodies they are placed by,
 * eight sizes' tables of room kept as each depth's difference from the one
 * above (6KB; written out whole they were 18KB): 110KB.
 */
const budgets = { page: 240 * kb, stage: 260 * kb, settled: 300 * kb, edition: 40 * kb, fitting: 110 * kb, settling: 20 * kb };

const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );
const gzipped = (path) => gzipSync(readFileSync(path), { level: 9 }).length;
const kind = (path) =>
  /\/Sweater(Stage|Comparison)-[^/]+\.js$/.test(path) ? "stage" : /\/fit\.worker-[^/]+\.js$/.test(path) ? "fitting" : /\/settle\.worker-[^/]+\.js$/.test(path) ? "settling" : "page";

const assets = files("dist/assets").filter((path) => /\.(js|css)$/.test(path));
const page = assets.filter((path) => kind(path) === "page").reduce((total, path) => total + gzipped(path), 0);
// Frozen editions are served as they are, beside the assets: the largest stands for them all.
// Beside them, the settled sweater of an edition a size has moved on from, held to a settled size's budget.
const largestOf = (dir, budget) =>
  (existsSync(dir) ? files(dir) : []).map((path) => [path.replace("dist/", ""), gzipped(path), budget]).sort((a, b) => b[1] - a[1]).slice(0, 1);
const largest = [...largestOf("dist/editions", budgets.edition), ...largestOf("dist/shapes", budgets.settled)];
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
