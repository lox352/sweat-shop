import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { withSite } from "./settlement-plan.mjs";
import { editionKey, nameOf, readShapes, shapeNamer, shapePath, writeShapes } from "./shapes.mjs";

export { nameOf };

/**
 * Every size's knitting, named and frozen as an edition: see
 * src/library/editions.
 *
 * An edition is named by a hash of its knitting, so a change to a size's
 * knitting makes a new one, and a change to anything else - a label, how a
 * stitch is drawn - does not. The current edition of every size is always
 * kept frozen, so that when a change supersedes it, the copy projects part
 * way through it will knit from is already there, made by the code that
 * built it. Superseded copies are never rewritten.
 *
 * And each size's written pattern, a round a line (docs/written), so that a
 * change to its knitting reads in review as the lines that changed. And which
 * shape each has, where that is settled already (see shapes.mjs),
 * so that a recoloured size keeps its settled sweater. And the catalogue: every design without its knitting, which is all the site
 * reads of a design. It is written here too, so that one command brings
 * everything the site is published from up to date with the designs.
 *
 *   npm run editions              name every size, freeze any new edition, and update the manifest
 *   npm run editions -- --check   fail if anything is out of date, and write nothing
 */
export const editionsDir = "src/library/editions";
/** Served as they are, each at an address its name gives: see library/editions/index.ts. */
export const frozenDir = "public/editions";
export const manifestFile = `${editionsDir}/manifest.json`;


/** Every design without its knitting, as the site reads them: see src/library/catalogue. */
export const cataloguePath = "src/library/catalogue/catalogue.json";

export const frozenPath = (design, size, edition) => `${frozenDir}/${design}--${size}--${edition}.json`;

/** A stepped colourway's yarns by place, served as they are: see src/library/colourways. */
export const stepsDir = "public/colourways";
export const stepsPath = (colourway) => `${stepsDir}/${colourway}.json`;

/** Each size's written pattern, as a printed pattern words it: see compiler/designs/written. For people to read, in review. */
export const writtenDir = "docs/written";
export const writtenPath = (design, size) => `${writtenDir}/${design}--${size}.txt`;

/** Every size of every design, built now and named, with its frozen file as it would be written. */
export const editionsNow = async (load) => {
  const { sweaters } = await load("/src/compiler/designs/index.ts");
  const { buildSweater } = await load("/src/compiler/engine/engine.ts");
  const { encodeEdition, hashable } = await load("/src/library/editions/format.ts");
  const { writtenPattern } = await load("/src/compiler/designs/written.ts");
  const shapeOf = await shapeNamer(load);
  const out = [];
  for (const sweater of sweaters) {
    for (const size of sweater.sizes) {
      const built = buildSweater(sweater, size.id);
      const draft = encodeEdition(built, sweater.id, size.id, "");
      const edition = nameOf(hashable(draft));
      out.push({
        design: sweater.id,
        size: size.id,
        edition,
        shape: shapeOf(built.knitting),
        json: JSON.stringify({ ...draft, edition }),
        written: writtenPattern(sweater, size.id, built.checks),
      });
    }
  }
  return out;
};

const main = async () => {
  const check = process.argv.includes("--check");
  const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, "utf8")) : {};
  const { now, catalogue, steps } = await withSite(async (load) => {
    const { sweaters } = await load("/src/compiler/designs/index.ts");
    const { encodeCatalogue } = await load("/src/library/catalogue/format.ts");
    // After the editions: a sampler's yarns are those its sizes knit, known once they are knitted.
    const now = await editionsNow(load);
    // Each stepped colourway's yarns by place, a file a colourway: see src/library/colourways.
    const steps = Object.assign({}, ...sweaters.map((sweater) => sweater.steps ?? {}));
    return { now, catalogue: `${JSON.stringify(encodeCatalogue(sweaters))}\n`, steps };
  });
  const stale = [];
  let wrote = 0;
  if (!existsSync(cataloguePath) || readFileSync(cataloguePath, "utf8") !== catalogue) {
    stale.push("the catalogue of designs");
    if (!check) writeFileSync(cataloguePath, catalogue);
  }
  for (const [colourway, table] of Object.entries(steps)) {
    const path = stepsPath(colourway);
    const json = `${JSON.stringify(table)}\n`;
    if (existsSync(path) && readFileSync(path, "utf8") === json) continue;
    stale.push(`${colourway}: its yarns by place`);
    if (!check) {
      mkdirSync(stepsDir, { recursive: true });
      writeFileSync(path, json);
    }
  }
  // An edition whose shape is settled already - a recolouring of one that was - has it from the start: see shapes.mjs.
  const shapes = readShapes();
  for (const { design, size, edition, shape } of now) {
    const key = editionKey(design, size, edition);
    if (shapes[key] === shape || !existsSync(shapePath(shape))) continue;
    stale.push(`${design} ${size}: its shape, ${shape}, is settled and not recorded`);
    shapes[key] = shape;
  }
  if (!check) writeShapes(shapes);
  for (const { design, size, written } of now) {
    const path = writtenPath(design, size);
    if (existsSync(path) && readFileSync(path, "utf8") === written) continue;
    stale.push(`${design} ${size}: its written pattern`);
    if (!check) {
      mkdirSync(writtenDir, { recursive: true });
      writeFileSync(path, written);
    }
  }
  for (const { design, size, edition, json } of now) {
    const entry = (manifest[design] ??= {})[size] ?? {};
    const path = frozenPath(design, size, edition);
    const changed = entry.current !== edition;
    if (changed) stale.push(`${design} ${size}: ${entry.current ?? "none"} → ${edition}`);
    else if (!existsSync(path)) stale.push(`${design} ${size}: ${edition} has no frozen copy`);
    if (check) continue;
    // The current edition's copy is kept fresh while it is current - its labels, say - and left alone once it is not.
    if (!existsSync(path) || readFileSync(path, "utf8") !== json) {
      mkdirSync(frozenDir, { recursive: true });
      writeFileSync(path, json);
      wrote++;
    }
    // What an edition corrects stays with it, and goes once it is superseded: see editions/index.ts.
    manifest[design][size] = { current: edition, ...(changed || !entry.errata ? {} : { errata: entry.errata }) };
  }
  if (check) {
    if (stale.length) {
      console.error(`Editions out of date - run npm run editions:\n  ${stale.join("\n  ")}`);
      process.exitCode = 1;
    } else console.log(`Every size's edition is current (${now.length} sizes).`);
    return;
  }
  const sorted = Object.fromEntries(
    Object.keys(manifest).sort().map((design) => [design, Object.fromEntries(Object.keys(manifest[design]).sort().map((size) => [size, manifest[design][size]]))]),
  );
  writeFileSync(manifestFile, `${JSON.stringify(sorted, null, 1)}\n`);
  console.log(`${now.length} sizes; ${stale.length} change(s); ${wrote} frozen file(s) written.`);
  for (const line of stale) console.log(`  ${line}`);
};

if (import.meta.url === `file://${process.argv[1]}`) await main();
