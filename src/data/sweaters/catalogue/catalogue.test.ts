import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sweaters } from "../index";
import { type CatalogueFile, aboutOf, decodeCatalogue, encodeCatalogue } from "./format";

const written = readFileSync("src/data/sweaters/catalogue/catalogue.json", "utf8");

describe("the catalogue", () => {
  it("is every design as it is now, without its knitting", () => {
    expect(written, "out of date: run npm run editions and commit what it writes").toBe(`${JSON.stringify(encodeCatalogue(sweaters))}\n`);
  }, 120000);

  it("reads back as the designs themselves, less their charts and each size's knitting", () => {
    const read = decodeCatalogue(JSON.parse(written) as CatalogueFile);
    expect(read.map((design) => design.id)).toEqual(sweaters.map((sweater) => sweater.id));
    read.forEach((design, at) => {
      expect(design).toEqual(aboutOf(sweaters[at]));
      expect(design).not.toHaveProperty("charts");
      for (const size of design.sizes) expect(size).not.toHaveProperty("sections");
      // Every yarn of every colourway, as the design has it.
      expect(design.colourways).toEqual(sweaters[at].colourways);
      expect(design.slots).toEqual(sweaters[at].slots);
    });
  }, 120000);

  it("writes a list of wools or a colourway two designs share once", () => {
    const file = JSON.parse(written) as CatalogueFile;
    const [once, lined] = ["wool-week-strips-once-oldest", "wool-week-strips-lined-oldest"].map((id) => file.designs.find((design) => design.id === id)!);
    expect(once.wools).toBe(lined.wools);
    expect(once.colourways.filter((n) => lined.colourways.includes(n)).length).toBeGreaterThan(30);
  });
});
