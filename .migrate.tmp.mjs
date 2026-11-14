import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { withSite } from "./scripts/settlement-plan.mjs";
import { editionKey, shapeNamer, shapePath, shapesDir, writeShapes } from "./scripts/shapes.mjs";
const git = (...args) => execFileSync("git", args, { stdio: "inherit" });
await withSite(async (load) => {
  const { decodeEdition } = await load("/src/data/sweaters/editions/format.ts");
  const { settledLength } = await load("/src/data/sweaters/settled/format.ts");
  const { sweaters } = await load("/src/data/sweaters/index.ts");
  const { buildSweater } = await load("/src/knitting/engine.ts");
  const shapeOf = await shapeNamer(load);
  const manifest = JSON.parse(readFileSync("src/data/sweaters/editions/manifest.json", "utf8"));
  mkdirSync(shapesDir, { recursive: true });
  const shapes = {}; const later = [];
  for (const name of readdirSync("public/editions").filter((n) => n.endsWith(".json") && !n.endsWith(".settled.json")).sort()) {
    const file = JSON.parse(readFileSync(`public/editions/${name}`, "utf8"));
    const { design, size, edition } = file;
    const decoded = decodeEdition(file);
    const shape = shapeOf(decoded.knitting);
    const current = manifest[design]?.[size]?.current === edition;
    if (current) {
      const built = buildSweater(sweaters.find((s) => s.id === design), size);
      if (shapeOf(built.knitting) !== shape) throw new Error(`${name}: decoded and built shapes differ`);
    }
    const kept = `public/editions/${design}--${size}--${edition}.settled.json`;
    const now = `src/data/sweaters/settled/${design}--${size}.json`;
    const source = existsSync(kept) ? kept : current && existsSync(now) ? now : undefined;
    if (!source) { later.push([editionKey(design, size, edition), shape]); continue; }
    const settled = JSON.parse(readFileSync(source, "utf8"));
    if (settled.deltas.length !== settledLength(decoded.stitches)) { console.log(`${name}: ${source} does not fit; left unsettled`); git("rm", "-q", source); continue; }
    if (existsSync(shapePath(shape))) git("rm", "-q", source); else git("mv", source, shapePath(shape));
    shapes[editionKey(design, size, edition)] = shape;
  }
  for (const [key, shape] of later) if (existsSync(shapePath(shape))) shapes[key] = shape; else console.log(`${key}: no settled sweater`);
  writeShapes(shapes);
  console.log(Object.keys(shapes).length, "editions,", new Set(Object.values(shapes)).size, "shapes");
});
