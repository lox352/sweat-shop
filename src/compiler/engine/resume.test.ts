import { describe, expect, it } from "vitest";
import { sweaterById } from "../designs";
import type { SweaterPattern } from "../designs/types";
import { buildSweater, specEnds } from "./engine";

/** A design with one of its sizes' sections replaced by what is still to be knitted. */
const withRest = (pattern: SweaterPattern, sizeId: string, rest: SweaterPattern["sizes"][number]["sections"]): SweaterPattern => ({
  ...pattern,
  // The charts are read after the size is knitted in full, for a design that makes them as it goes.
  charts: pattern.charts,
  sizes: pattern.sizes.map((size) => (size.id === sizeId ? { ...size, id: size.id, sections: rest, checks: size.checks } : size)),
});

describe("carrying on from knitting already made", () => {
  const cases: [string, string][] = [
    ["hamefarin", "xs"],
    ["hamefarin", "m"],
    ["hamefarin", "4xl"],
    ["wool-week-strips-once-oldest", "s"],
    ["wool-week-strips-once-oldest", "l"],
    ["wool-week-strips-lined-oldest", "m"],
    ["feline-yoke", "m"],
  ];
  for (const [design, sizeId] of cases) {
    it(`${design} ${sizeId}: from after any whole round of the yoke, the same rest knits the same sweater`, () => {
      const pattern = sweaterById(design)!;
      const whole = buildSweater(pattern, sizeId);
      const charts = pattern.charts;
      const divide = whole.roundPieces.indexOf("body");
      // Between instructions, after a whole round, before the yoke divides.
      const cuts = specEnds(pattern, sizeId).filter(({ round }) => round > 0 && round < divide && whole.roundKinds[round - 1] === "round");
      expect(cuts.length).toBeGreaterThan(5);
      let tried = 0;
      for (const { round, rest } of cuts) {
        // A round the short rows leave part worked is no place to carry on from; nor is one after which rows are still to come.
        if (whole.roundKinds.slice(round).some((kind) => kind !== "round") && round < 12) continue;
        const again = buildSweater({ ...withRest(pattern, sizeId, rest), charts }, sizeId, { knitted: whole, round });
        expect(again.stitches.length, `after round ${round}`).toBe(whole.stitches.length);
        expect(again.stitches, `after round ${round}`).toEqual(whole.stitches);
        expect(again.rounds).toEqual(whole.rounds);
        expect(again.roundLabels).toEqual(whole.roundLabels);
        expect(again.roundKinds).toEqual(whole.roundKinds);
        expect(again.holds).toEqual(whole.holds);
        expect(again.needleChanges).toEqual(whole.needleChanges);
        expect(again.checks).toEqual(whole.checks);
        expect(again.knitting.rounds).toEqual(whole.knitting.rounds);
        expect(again.knitting.roundKinds).toEqual(whole.knitting.roundKinds);
        tried++;
      }
      expect(tried).toBeGreaterThan(5);
    }, 600000);
  }

  it("refuses a short row, a round with stitches on hold, and a round that is not there", () => {
    const pattern = sweaterById("hamefarin")!;
    const whole = buildSweater(pattern, "m");
    const row = whole.roundKinds.findIndex((kind) => kind !== "round") + 1;
    expect(() => buildSweater(pattern, "m", { knitted: whole, round: row })).toThrow(/no whole round/);
    const body = whole.roundPieces.indexOf("body") + 2;
    expect(() => buildSweater(pattern, "m", { knitted: whole, round: body })).toThrow(/on hold/);
    expect(() => buildSweater(pattern, "m", { knitted: whole, round: 100000 })).toThrow(/no whole round/);
  });
});
