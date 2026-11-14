import { describe, expect, it } from "vitest";
import { sweaters } from "../..";
import { sweaterStitches } from "../../../../library/knitting";
import { seamLayout, viewChart } from "../../../../reading/counted";
import { viewFor } from "../../../../reading/view";
import { chartViews } from "../../../../reading/views";
import { sleeveStart, startOfRound } from "./knit";

const samplers = sweaters.filter((one) => one.id.startsWith("wool-week-strips-"));

describe("the strip samplers' stitch markers", () => {
  it("place the start of the round as the neck's rib begins, and each sleeve's as its first round comes back round to the underarm", () => {
    for (const pattern of samplers) {
      for (const size of pattern.sizes) {
        const { stitches, knitting } = sweaterStitches(pattern, size.id);
        const markers = stitches.filter((one) => one.type === "marker");
        expect(markers.map((one) => one.marker)).toEqual([startOfRound, sleeveStart("sleeve-left"), sleeveStart("sleeve-right")]);
        expect(markers.every((one) => !one.removed && !one.begins)).toBe(true);
        // Straight after the join, before the rib's first stitch.
        expect(stitches[markers[0].id - 1].type).toBe("join");
        // Between a sleeve's first round and its second.
        for (const [piece, step] of [["sleeve-left", markers[1]], ["sleeve-right", markers[2]]] as const) {
          const rounds = knitting.rounds.filter((_, k) => knitting.roundPieces[k] === piece);
          expect(rounds[0].at(-1)).toBe(step.id - 1);
          expect(rounds[1][0]).toBe(step.id + 1);
        }
      }
    }
  }, 120_000);

  it("draw each up the chart's right-hand edge, the round's from the neck to the hem and each sleeve's in its own view", () => {
    const pattern = samplers[0];
    const built = sweaterStitches(pattern, "m");
    const counted = viewFor(built, () => seamLayout(built), undefined);
    const views = chartViews(built, pattern.pieces);
    const lineIn = (label: string, marker: string) => viewChart(built, counted, views.find((one) => one.label === label && !one.stageOf)!).markers.find((one) => one.marker === marker);
    for (const label of ["From the neck", "Body"]) {
      const line = lineIn(label, startOfRound)!;
      expect(new Set(line.route.map((row) => row.after))).toEqual(new Set([0]));
      expect(line.to - line.from + 1).toBe(line.route.length);
    }
    for (const [label, piece] of [["Left sleeve", "sleeve-left"], ["Right sleeve", "sleeve-right"]]) {
      const line = lineIn(label, sleeveStart(piece))!;
      expect(new Set(line.route.map((row) => row.after))).toEqual(new Set([0]));
      expect(line.to - line.from + 1).toBe(line.route.length);
    }
  }, 120_000);

});
