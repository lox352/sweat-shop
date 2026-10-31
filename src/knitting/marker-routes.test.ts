import { describe, expect, it } from "vitest";
import { buildSweater } from "./engine";
import { makeOnesAtMarkers, markerRoutes, markersPassed } from "./marker-routes";
import { raglanLine, testSweaterWithMarkers } from "./test-sweater";
import { seamLayout } from "./useSweater";
import { viewFor } from "./view";
import paulKlee from "../data/sweaters/paul-klee";
import { sweaters } from "../data/sweaters";
import { isStep } from "../types/Stitch";

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

describe("where a marker is reached part way along a round or a short row", () => {
  const design = sweaters.find((one) => one.id === "wool-week-strips-once-oldest")!;
  const built = buildSweater(design, "l");
  const { knitting, stitches } = built;
  const passed = markersPassed(built);
  const shortRows = knitting.rounds.filter((_, k) => knitting.roundKinds[k] === "right" || knitting.roundKinds[k] === "wrong");

  it("is where each short row after the first crosses the start of the round: in the L's third, after 23 of its 55", () => {
    expect(shortRows.map((row) => row.length)).toEqual([24, 47, 55, 63, 71, 79, 39]);
    // The first turns before the start of the round, and the last ends at it; every one between crosses it once.
    const crossings = shortRows.map((row) => row.filter((id) => passed.get(id) === "the start of the round"));
    expect(crossings.map((ids) => ids.length)).toEqual([0, 1, 1, 1, 1, 1, 0]);
    const third = shortRows[2].filter((id) => !isStep(stitches[id]));
    expect(third.indexOf(crossings[2][0])).toBe(22);
  });

  it("is beside the stitch at one edge of the chart cut at the beginning of the round, the stitch after it at the other", () => {
    const layout = seamLayout(built);
    for (const row of shortRows.slice(1, -1)) {
      const ids = row.filter((id) => !isStep(stitches[id]));
      const k = ids.findIndex((id) => passed.has(id));
      const [a, b] = [layout.cells.get(ids[k])!.column, layout.cells.get(ids[k + 1])!.column];
      expect(Math.abs(a - b)).toBeGreaterThan(layout.columns / 2);
    }
  });

  it("is drawn at the chart's other edge too, beside the short rows that cross it, as well as up its own", () => {
    const layout = seamLayout(built);
    const lines = viewFor(built, () => layout, undefined).markers.filter((one) => one.marker === "the start of the round");
    const [own, edge] = [lines.filter((one) => !one.edge), lines.filter((one) => one.edge)];
    expect(own.map((one) => one.after)).toEqual([0]);
    // One line, up the left-hand edge, a row for each short row that crosses it: the second to the sixth, one above another.
    expect(edge).toHaveLength(1);
    expect(edge[0].after).toBe(layout.columns);
    const rows = shortRows.slice(1, -1).map((row) => layout.cells.get(row[0])!.row);
    expect(edge[0].route.map((at) => at.row)).toEqual(rows);
    expect(edge[0].route.map((at) => at.passed)).toEqual(shortRows.slice(1, -1).map((row) => row.find((id) => passed.has(id))));
  });

  it("is between the same two stitches' descendants, for a marker that is not the start of the round", () => {
    const klee = buildSweater(paulKlee, "m1");
    const at = markersPassed(klee);
    for (const route of markerRoutes(klee)) {
      // Where two come off together, at the divide, the steps taking them off stop the run there already.
      for (const round of route.rounds.filter((one) => !one.atStart && !one.takenOff)) expect(at.get(round.before)).toBe(route.marker);
    }
  });
});
