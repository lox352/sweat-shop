import { describe, expect, it } from "vitest";
import { buildSweater } from "./engine";
import { makeOnesAtMarkers, markerRoutes } from "./marker-routes";
import { raglanLine, testSweaterWithMarkers } from "./test-sweater";
import { seamLayout } from "./useSweater";
import { viewFor } from "./view";
import paulKlee from "../data/sweaters/paul-klee";

describe("where a marker goes, round by round", () => {
  it("follows the stitches either side of it: Paul Klee's eleven, each between the same two columns all the way up", () => {
    const built = buildSweater(paulKlee, "m1");
    const routes = markerRoutes(built);
    expect(routes).toHaveLength(11);
    const lines = viewFor(built, () => seamLayout(built), undefined).markers;
    for (const line of lines) {
      expect(new Set(line.route.map((at) => at.after))).toEqual(new Set([line.after]));
      // A row for every round it is on the needles, the first where it is placed.
      expect(line.route.map((at) => at.row)).toEqual(Array.from({ length: line.to - line.from + 1 }, (_, k) => line.from + k));
      expect(line.route[0].passed).toBe(line.placed);
    }
    // The raglan lines go as far as the divide, where they come off; nothing is made at any of them.
    const raglans = lines.filter((line) => line.marker.endsWith("raglan line"));
    expect(raglans.map((line) => [line.from, line.to])).toEqual(Array(4).fill([85, 107]));
    expect(makeOnesAtMarkers(built).size).toBe(0);
  });

  it("puts a make-one lifted from the bar under the marker before it, and steps across to stand beside it", () => {
    // The test sweater's raglan line, with a round after the band making one at it - and taking one away elsewhere, so the divide still has its 48.
    const pattern = testSweaterWithMarkers();
    const yoke = pattern.sizes[0].sections[1];
    const band = yoke.rounds.findIndex((spec) => spec.type === "chart" && spec.chart === "band");
    yoke.rounds.splice(band + 1, 0, {
      type: "shaping",
      slot: "A",
      to: 48,
      ops: [{ work: "k", times: 12 }, { work: "m1" }, { work: "k", times: 34 }, { work: "k2tog" }],
    });
    const built = buildSweater(pattern, "one");
    const route = markerRoutes(built).find((one) => one.marker === raglanLine)!;
    const made = route.rounds.find((round) => round.makeOne !== undefined)!;
    expect(built.stitches[made.makeOne!].type).toBe("m1");
    expect(made.before).toBe(made.makeOne);
    expect(built.stitches[made.after].links[0]).toBe(route.rounds[route.rounds.indexOf(made) - 1].after);
    expect(makeOnesAtMarkers(built)).toEqual(new Map([[made.makeOne!, raglanLine]]));
    // On the chart it steps across, from beside the stitch before the make-one to beside the make-one.
    const line = viewFor(built, () => seamLayout(built), undefined).markers.find((one) => one.marker === raglanLine)!;
    expect(new Set(line.route.map((at) => at.after)).size).toBe(2);
  });
});
