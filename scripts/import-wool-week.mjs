/**
 * Bring the Shetland Wool Week hats' charts over from the hat site, one file
 * a year, for the Wool Week Sampler.
 *
 *     node --experimental-strip-types scripts/import-wool-week.mjs ../wool-week
 *
 * Run by hand, once, against a checkout of lox352/wool-week; its output is
 * reviewed and committed, as the hat site's extracted charts are. Each year
 * lands in src/data/sweaters/wool-week/<id>.json and nowhere else, so a year
 * can be taken out again in one commit - the hat site's two-file rule, kept.
 *
 * What comes over is what the sampler knits from: every chart but 2026's
 * band of lettering, a cell a slot letter and a mark; and its first
 * colourway's colours, which is what each year's yarns are mapped onto the
 * sampler's from (see wool-week/ladder.ts). Charts drawn in a ground and a
 * motif, as 2026's are, are cast in that first colourway's yarns.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const source = process.argv[2];
if (!source) throw new Error("usage: import-wool-week.mjs <path to a wool-week checkout>");
const hats = path.join(source, "src/data/hats");
const out = path.join(path.dirname(new URL(import.meta.url).pathname), "../src/data/sweaters/wool-week");

// The hat files are TypeScript importing JSON: copied somewhere they can be loaded as they are.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "wool-week-"));
for (const file of fs.readdirSync(hats)) {
  if (!/^(sww\d\d.*\.(ts|json)|types\.ts)$/.test(file) || file.endsWith(".test.ts")) continue;
  let text = fs.readFileSync(path.join(hats, file), "utf8");
  if (file.endsWith(".ts")) {
    text = text
      .replace(/^import charts from "(.*\.json)";$/m, 'import charts from "$1" with { type: "json" };')
      .replace(/^import \{[^}]*\bpartKey\b[^}]*\} from "\.\/types";$/m, 'import { partKey } from "./types.ts";')
      .replace(/^import (type )?\{[^}]*\} from "\.\/types";$/m, "")
      .replace(/^import type .* from "\.\.\/yarns";$/m, "");
  }
  fs.writeFileSync(path.join(scratch, file), text);
}

const marks = { purl: "p", k1tbl: "t", k2tog: "k", s2kp: "s", sk2p: "x" };

for (const file of fs.readdirSync(scratch).filter((f) => /^sww\d\d.*\.ts$/.test(f)).sort()) {
  const hat = (await import(path.join(scratch, file))).default;
  const colourway = hat.colourways[0];
  const part = colourway.part;
  const charts = {};
  for (const chart of hat.charts) {
    // 2026's lettering is a band of words a knitter writes their own into; the sampler has no room for it.
    if (hat.year === 2026 && chart.id === "Brim") continue;
    const parts = part ? chart.parts?.[part] : undefined;
    charts[chart.id] = chart.rows.map((row, index) =>
      row
        .map((cell) => {
          let slot = cell.slot;
          if (slot === "ground" || slot === "motif") {
            if (!parts) throw new Error(`${hat.id} ${chart.id}: a ${slot} cell with no parts for ${part}`);
            slot = parts[index][slot === "ground" ? 0 : 1];
          }
          if (!/^[A-H]$/.test(slot)) throw new Error(`${hat.id} ${chart.id}: slot ${slot}`);
          return slot + (cell.symbol ? marks[cell.symbol] : "-");
        })
        .join(""),
    );
  }
  const year = {
    id: hat.id,
    year: hat.year,
    name: hat.name,
    designer: hat.designer,
    credit: hat.credit,
    patternUrl: hat.patternUrl,
    colourway: {
      name: colourway.name,
      shades: Object.fromEntries(colourway.shades.map((shade) => [shade.slot, { name: shade.name, hex: shade.hex, ...(shade.wool ? { wool: shade.wool } : {}) }])),
    },
    gauge: { stitches: hat.sizes[0].stitchesPer10cm, rounds: hat.sizes[0].roundsPer10cm },
    charts,
  };
  const name = `sww${String(hat.year).slice(2)}.json`;
  fs.writeFileSync(path.join(out, name), JSON.stringify(year, null, 1) + "\n");
  console.log(name, Object.keys(charts).join(" "));
}
fs.rmSync(scratch, { recursive: true });
