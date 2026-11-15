import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sweaterById } from "../compiler/designs";
import { buildSweater } from "../compiler/engine/engine";
import { shapeNameOf } from "./naming";
import { progressOf } from "./settling";

describe("a sweater settled on the device", () => {
  it("is named as scripts/shapes.mjs names the shape it settles: the published name of a published size's fabric", async () => {
    const editions = JSON.parse(readFileSync("src/library/editions/manifest.json", "utf8")) as Record<string, Record<string, { current: string }>>;
    const shapes = JSON.parse(readFileSync("src/library/settled/shapes.json", "utf8")) as Record<string, string>;
    for (const [design, size] of [["hamefarin", "m"], ["wool-week-strips-once-oldest", "xs"]]) {
      const published = shapes[`${design}--${size}--${editions[design][size].current}`];
      expect(published).toMatch(/^[0-9a-f]{12}$/);
      expect(await shapeNameOf(buildSweater(sweaterById(design)!, size).knitting)).toBe(published);
    }
  });

  it("says how far it has got by how far its stitches still move, and never more than done", () => {
    expect(progressOf(3, { steps: 1, moved: 3 })).toBe(0);
    expect(progressOf(3, { steps: 9, moved: 0.003 })).toBe(1);
    expect(progressOf(3, { steps: 9, moved: 0.0001 })).toBe(1);
    const half = progressOf(3, { steps: 5, moved: Math.sqrt(3 * 0.003) });
    expect(half).toBeCloseTo(0.5, 5);
    // Moving more than the most so far is no progress, not less than none.
    expect(progressOf(3, { steps: 2, moved: 5 })).toBe(0);
  });
});
