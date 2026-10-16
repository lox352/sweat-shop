import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildSweater } from "../../../knitting/engine";
import { testSweater } from "../../../knitting/test-sweater";
import { pose } from "../../../physics/pose";
import { sweaterById, sweaters } from "../index";
import { loadSettled } from "./index";
import { SettledFile, allPositions, decodeSettled, encodeSettled, fabricPositions, settledLength } from "./format";

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((name) => name.endsWith(".json"));

describe("the settled file format", () => {
  it("gives back every position to the nearest tenth", () => {
    const positions = Float32Array.from([1.23, -4.56, 7.89, 1.2, -4.5, 7.9, -100.04, 0, 3.15]);
    const back = decodeSettled(encodeSettled(positions));
    positions.forEach((value, index) => expect(back[index]).toBeCloseTo(Math.round(value * 10) / 10, 5));
  });

  it("holds the fabric alone, and puts the steps and the phantom stitch back where the pose puts them", () => {
    const { stitches, knitting } = buildSweater(testSweater, "one");
    const { positions } = pose(knitting);
    const fabric = fabricPositions(stitches, positions);
    expect(fabric.length).toBe(settledLength(stitches));
    expect(fabric.length).toBeLessThan(positions.length);
    expect(allPositions(stitches, fabric)).toEqual(positions);
  });

  it("reads no file of an older version, which had a position for every step", () => {
    expect(() => decodeSettled({ version: 1, scale: 10, deltas: [] } as unknown as SettledFile)).toThrow();
  });
});

describe("the settled sweaters", () => {
  for (const sweater of sweaters) {
    for (const size of sweater.sizes) {
      it(`has ${sweater.id} in size ${size.label}, with a position for every stitch of its fabric`, async () => {
        const positions = await loadSettled(sweater.id, size.id);
        expect(positions, "Run npm run settle for the missing size").toBeDefined();
        expect(positions!.length).toBe(settledLength(buildSweater(sweater, size.id).stitches));
      });
    }
  }

  for (const file of files) {
    const [sweaterId, sizeId] = file.replace(/\.json$/, "").split("--");

    it(`${file} is a sweater and size the site knows`, () => {
      const sweater = sweaterById(sweaterId);
      expect(sweater, `no sweater is called ${sweaterId}`).toBeDefined();
      expect(sweater!.sizes.some((size) => size.id === sizeId), `no size ${sizeId}`).toBe(true);
    });

    it(`${file} is sweater-shaped: the neck at the top, the body under it, a sleeve to each side`, () => {
      const sweater = sweaterById(sweaterId);
      if (!sweater) return;
      const built = buildSweater(sweater, sizeId);
      const settled = JSON.parse(readFileSync(join(here, file), "utf8")) as SettledFile;
      const positions = allPositions(built.stitches, decodeSettled(settled));
      expect(positions.every(Number.isFinite)).toBe(true);
      const mean = (piece: string, axis: number) => {
        const ids = built.rounds.filter((_, index) => built.roundPieces[index] === piece).flat();
        return ids.reduce((sum, id) => sum + positions[id * 3 + axis], 0) / ids.length;
      };
      const neck = Math.min(...built.rounds[0].map((id) => positions[id * 3 + 1]));
      expect(neck).toBeGreaterThan(mean("yoke", 1));
      expect(mean("body", 1)).toBeLessThan(mean("yoke", 1));
      expect(mean("sleeve-left", 0)).toBeGreaterThan(0);
      expect(mean("sleeve-right", 0)).toBeLessThan(0);
    });
  }
});
