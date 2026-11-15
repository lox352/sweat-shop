import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it, vi } from "vitest";
import { currentEdition, forgetEditions, loadEdition } from "./index";
import { dropEditionsBut, keepEdition, ownEdition } from "./own";

const here = dirname(fileURLToPath(import.meta.url));
const design = "hamefarin";
const size = "m";
/** Knitting no published file holds: the size's own, under a name of its own. */
const own = () => ({ ...JSON.parse(readFileSync(join(here, `../../../public/editions/${design}--${size}--${currentEdition(design, size)}.json`), "utf8")), edition: "0a0b0c0d0e0f" });

afterEach(() => {
  localStorage.clear();
  forgetEditions();
  vi.unstubAllGlobals();
});

it("an edition kept on the device is knitted from there, and the network never asked", async () => {
  const fetching = vi.fn();
  vi.stubGlobal("fetch", fetching);
  expect(keepEdition(own())).toBe(true);
  expect(ownEdition(design, size, "0a0b0c0d0e0f")?.edition).toBe("0a0b0c0d0e0f");
  const knitted = await loadEdition(design, size, "0a0b0c0d0e0f");
  expect(knitted.stitches.length).toBeGreaterThan(1000);
  expect(fetching).not.toHaveBeenCalled();
});

it("one kept under another's name is not taken for it", () => {
  keepEdition(own());
  localStorage.setItem(`edition-${design}--${size}--ffffffffffff`, localStorage.getItem(`edition-${design}--${size}--0a0b0c0d0e0f`)!);
  expect(ownEdition(design, size, "ffffffffffff")).toBeUndefined();
});

it("is dropped once no project knits it", () => {
  keepEdition(own());
  dropEditionsBut([{ sweaterId: design, sizeId: size, edition: "0a0b0c0d0e0f" }]);
  expect(ownEdition(design, size, "0a0b0c0d0e0f")).toBeDefined();
  dropEditionsBut([{ sweaterId: design, sizeId: size }]);
  expect(ownEdition(design, size, "0a0b0c0d0e0f")).toBeUndefined();
});
