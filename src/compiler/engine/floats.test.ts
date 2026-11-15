import { describe, expect, it } from "vitest";
import { sweaterById } from "../designs";
import { buildSweater } from "./engine";
import { floatCatches, longestFloat } from "./rules";
import type { Stitch } from "../../pattern/Stitch";

const round = (slots: string) =>
  [...slots].map((slot, k) => ({ id: k + 1, type: "k1", slot, piece: "yoke", links: [] }) as unknown as Stitch);

describe("catching the floats", () => {
  const caught = (slots: string, index = 0) => {
    const stitches = [{ id: 0, type: "castOn", slot: "A", piece: "yoke", links: [] } as unknown as Stitch, ...round(slots)];
    const rounds: number[][] = [];
    rounds[index] = stitches.slice(1).map((stitch) => stitch.id);
    return floatCatches(stitches, rounds, Array(index + 1).fill("round")).map((id) => slots[id - 1] + id);
  };

  it("catches a float longer than seven, inside it and never at either end, and leaves seven alone", () => {
    expect(caught("ABBBBBBBA")).toEqual([]);
    expect(caught("ABBBBBBBBA")).toEqual(["B5"]);
    // Sixteen: twice, as evenly as it divides.
    expect(caught("A" + "B".repeat(16) + "A")).toEqual(["B6", "B12"]);
  });

  it("a stitch along in every other round, so catches one above another do not line up", () => {
    expect(caught("ABBBBBBBBA", 1)).toEqual(["B6"]);
  });

  it("counts a float round the end of the round, and catches nothing in a round of one yarn", () => {
    expect(caught("BBBBBAAAB").length).toBe(0);
    expect(caught("BBBBBBBAAAB")).toHaveLength(1);
    expect(caught("AAAAAAAAAAAA")).toEqual([]);
  });

  it("leaves no float in a sampler longer than seven between catches", () => {
    const built = buildSweater(sweaterById("wool-week-strips-once-oldest")!, "l");
    built.rounds.forEach((ids, index) => {
      if (built.roundKinds[index] !== "round") return;
      // A caught stitch breaks its float in two: a different yarn, as far as the float is concerned.
      const pieces = built.stitches.map((stitch) => (stitch.catch ? { ...stitch, slot: `${stitch.slot}*${stitch.id}` } : stitch));
      expect(longestFloat(pieces, ids), built.roundLabels[index]).toBeLessThanOrEqual(8);
    });
    expect(built.stitches.some((stitch) => stitch.catch)).toBe(true);
  }, 120000);
});
