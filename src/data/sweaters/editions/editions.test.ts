import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildSweater } from "../../../knitting/engine";
import { isSpacer } from "../../../knitting/knitted";
import { sweaterById, sweaters } from "../index";
import { EditionFile, decodeEdition, encodeEdition, hashable } from "./format";

const here = dirname(fileURLToPath(import.meta.url));
const frozen = join(here, "../../../../public/editions");
const nameOf = (file: EditionFile) => createHash("sha256").update(hashable(file)).digest("hex").slice(0, 12);
const entries = JSON.parse(readFileSync(join(here, "manifest.json"), "utf8")) as Record<string, Record<string, { first: string; current: string }>>;
const stale = "out of date: run npm run editions and commit what it writes";

describe("every size's edition", () => {
  // Building every size of every design takes a while; one test a design keeps the reporting readable.
  for (const sweater of sweaters) {
    it(`of ${sweater.id} is the knitting the site builds now, frozen`, () => {
      for (const size of sweater.sizes) {
        const built = buildSweater(sweater, size.id);
        const draft = encodeEdition(built, sweater.id, size.id, "");
        const current = entries[sweater.id]?.[size.id]?.current;
        expect(nameOf(draft), `${sweater.id} ${size.id}: ${stale}`).toBe(current);
        const path = join(frozen, `${sweater.id}--${size.id}--${current}.json`);
        expect(existsSync(path), `${sweater.id} ${size.id}: no frozen copy; ${stale}`).toBe(true);
        // Knitting is all a name covers; the copy of the current edition carries today's labels too.
        expect(JSON.parse(readFileSync(path, "utf8")), `${sweater.id} ${size.id}: ${stale}`).toEqual({ ...draft, edition: current });
      }
    }, 300000);
  }
});

describe("the frozen editions", () => {
  // Beside them, the settled sweaters of editions since superseded: see settled/keep.
  const files = readdirSync(frozen).filter((name) => name.endsWith(".json") && !name.endsWith(".settled.json"));

  it("each knit what their name says, and never change", () => {
    for (const name of files) {
      const raw = readFileSync(join(frozen, name), "utf8");
      const file = JSON.parse(raw) as EditionFile;
      expect(name).toBe(`${file.design}--${file.size}--${file.edition}.json`);
      expect(nameOf(file), name).toBe(file.edition);
      // Decoded and encoded again, character for character: nothing is lost on the way in.
      expect(JSON.stringify(encodeEdition(decodeEdition(file), file.design, file.size, file.edition)), name).toBe(raw);
    }
  }, 300000);

  it("include the first and the current edition of every size the manifest names", () => {
    for (const [design, sizes] of Object.entries(entries)) {
      for (const [size, { first, current }] of Object.entries(sizes)) {
        expect(files, `${design} ${size}`).toContain(`${design}--${size}--${first}.json`);
        expect(files, `${design} ${size}`).toContain(`${design}--${size}--${current}.json`);
      }
    }
  });

  // Field for field, as the engine built them: short rows, KFBs and KBFs, a closing slip and wrapped holds, doubled columns.
  for (const [design, size] of [
    ["hamefarin", "m"],
    ["paul-klee", "m2"],
    ["feline-raglan", "xl"],
    ["wool-week-strips-once-oldest", "l"],
    ["wool-week-strips-lined-oldest", "s"],
  ] as const) {
    it(`decode to exactly the sweater built: ${design} ${size}`, () => {
      const built = buildSweater(sweaterById(design)!, size);
      const current = entries[design][size].current;
      const back = decodeEdition(JSON.parse(readFileSync(join(frozen, `${design}--${size}--${current}.json`), "utf8")));
      expect(back).toStrictEqual(built);
      expect(back.stitches.map(isSpacer)).toEqual(built.stitches.map(isSpacer));
      expect(back.knitting.stitches).toBe(back.stitches);
    }, 120000);
  }
});

describe("an edition's name", () => {
  const built = buildSweater(sweaterById("hamefarin")!, "m");
  const file = encodeEdition(built, "hamefarin", "m", "");

  it("changes with the knitting", () => {
    const changed = structuredClone(file);
    changed.stitches.slots[1] = `${changed.stitches.slots[1]}x`;
    expect(nameOf(changed)).not.toBe(nameOf(file));
  });

  it("does not change with a round's label or how wide a stitch is drawn", () => {
    const relabelled = structuredClone(file);
    relabelled.roundLabels[0] = "Renamed";
    relabelled.stitches.fabrics = relabelled.stitches.fabrics.map((fabric) => `${fabric}0`);
    expect(nameOf(relabelled)).toBe(nameOf(file));
  });
});
