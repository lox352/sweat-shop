import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { withSite } from "./settlement-plan.mjs";

/**
 * Every size's knitting, named and frozen as an edition: see
 * src/data/sweaters/editions.
 *
 * An edition is named by a hash of its knitting, so a change to a size's
 * knitting makes a new one, and a change to anything else - a label, how a
 * stitch is drawn - does not. The current edition of every size is always
 * kept frozen, so that when a change supersedes it, the copy projects part
 * way through it will knit from is already there, made by the code that
 * built it. Superseded copies are never rewritten.
 *
 * And the catalogue: every design without its knitting, which is all the site
 * reads of a design. It is written here too, so that one command brings
 * everything the site is published from up to date with the designs.
 *
 *   npm run editions              name every size, freeze any new edition, and update the manifest
 *   npm run editions -- --check   fail if anything is out of date, and write nothing
 */
export const editionsDir = "src/data/sweaters/editions";
/** Served as they are, each at an address its name gives: see editions/index.ts. */
export const frozenDir = "public/editions";
export const manifestFile = `${editionsDir}/manifest.json`;

/** An edition's name, from its knitting: see format's hashable. */
export const nameOf = (hashable) => createHash("sha256").update(hashable).digest("hex").slice(0, 12);

/** Every design without its knitting, as the site reads them: see src/data/sweaters/catalogue. */
export const cataloguePath = "src/data/sweaters/catalogue/catalogue.json";

export const frozenPath = (design, size, edition) => `${frozenDir}/${design}--${size}--${edition}.json`;

/** Every size of every design, built now and named, with its frozen file as it would be written. */
export const editionsNow = async (load) => {
  const { sweaters } = await load("/src/data/sweaters/index.ts");
  const { buildSweater } = await load("/src/knitting/engine.ts");
  const { encodeEdition, hashable } = await load("/src/data/sweaters/editions/format.ts");
  const out = [];
  for (const sweater of sweaters) {
    for (const size of sweater.sizes) {
      const draft = encodeEdition(buildSweater(sweater, size.id), sweater.id, size.id, "");
      const edition = nameOf(hashable(draft));
      out.push({ design: sweater.id, size: size.id, edition, json: JSON.stringify({ ...draft, edition }) });
    }
  }
  return out;
};

const main = async () => {
  const check = process.argv.includes("--check");
  const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, "utf8")) : {};
  const { now, catalogue } = await withSite(async (load) => {
    const { sweaters } = await load("/src/data/sweaters/index.ts");
    const { encodeCatalogue } = await load("/src/data/sweaters/catalogue/format.ts");
    // After the editions: a sampler's yarns are those its sizes knit, known once they are knitted.
    const now = await editionsNow(load);
    return { now, catalogue: `${JSON.stringify(encodeCatalogue(sweaters))}\n` };
  });
  const stale = [];
  let wrote = 0;
  if (!existsSync(cataloguePath) || readFileSync(cataloguePath, "utf8") !== catalogue) {
    stale.push("the catalogue of designs");
    if (!check) writeFileSync(cataloguePath, catalogue);
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
    manifest[design][size] = { first: entry.first ?? edition, current: edition };
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
