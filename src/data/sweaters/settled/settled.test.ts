import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSweater } from "../../../knitting/engine";
import { testSweater } from "../../../knitting/test-sweater";
import { pose } from "../../../physics/pose";
import { sweaterById, sweaters } from "../index";
import { currentEdition } from "../editions";
import { decodeEdition, type EditionFile } from "../editions/format";
import shapes from "./shapes.json";
// @ts-expect-error a script, with no types of its own
import { physicsFiles } from "../../../../scripts/shapes.mjs";
import { SettledFile, allPositions, decodeSettled, encodeSettled, fabricPositions, settledLength } from "./format";

/** How many rounds' height a settled waist may rise and fall by on its way round. */
const LEVEL_ROUNDS = 8;
const recorded = Object.entries(shapes as Record<string, string>);
const shapeFile = (shape: string) => `public/shapes/${shape}.json`;

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
  it("are each the shape of an edition, and every edition's shape is there", () => {
    const files = readdirSync("public/shapes").map((name) => name.replace(/\.json$/, "")).sort();
    expect(files).toEqual([...new Set(recorded.map(([, shape]) => shape))].sort());
  });

  it("are named by everything the settling runs on", () => {
    const physics = readdirSync("src/physics").filter((name) => name.endsWith(".ts") && !name.includes(".test.") && name !== "gauge.ts");
    for (const name of physics) expect(physicsFiles, `scripts/shapes.mjs does not name ${name}`).toContain(`src/physics/${name}`);
    for (const path of physicsFiles as string[]) expect(existsSync(path), path).toBe(true);
  });

  for (const [key, shape] of recorded) {
    const [sweaterId, sizeId, edition] = key.split("--");

    it(`${key} has a position for every stitch of its fabric`, () => {
      const frozen = JSON.parse(readFileSync(`public/editions/${key}.json`, "utf8")) as EditionFile;
      const settled = JSON.parse(readFileSync(shapeFile(shape), "utf8")) as SettledFile;
      expect(decodeSettled(settled).length).toBe(settledLength(decodeEdition(frozen).stitches));
    });

    if (currentEdition(sweaterId, sizeId) !== edition) continue;
    it(`${key} is sweater-shaped: the neck at the top, the body under it, a sleeve to each side`, () => {
      const sweater = sweaterById(sweaterId);
      expect(sweater, `no sweater is called ${sweaterId}`).toBeDefined();
      const built = buildSweater(sweater!, sizeId);
      const settled = JSON.parse(readFileSync(shapeFile(shape), "utf8")) as SettledFile;
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
      // The waist goes round level, an oval on one plane: nowhere, under the arms or anywhere else, more than a few rounds lower than elsewhere.
      const body = built.rounds.filter((_, index) => built.roundPieces[index] === "body");
      const heights = body[body.length - 1].map((id) => positions[id * 3 + 1]);
      expect((Math.max(...heights) - Math.min(...heights)) / built.knitting.roundHeight).toBeLessThan(LEVEL_ROUNDS);
    });
  }
});
