import { describe, expect, it } from "vitest";
import { buildSweater } from "./engine";
import { layOutSweater } from "./layout";
import { consumption } from "../types/StitchType";
import { newBeginning, raglanLine, testSweaterWithMarkers } from "./test-sweater";
import { beginningAt, cutAt, turned, viewAt } from "./view";

describe("cutting the knitting at a beginning of the round", () => {
  /*
   * Ten stitches a round and twenty in all, two rounds from the seam: stitch
   * n at column ((n - 1) mod 10) + 1. With the marker after stitch 5, the
   * same stitches are three rounds.
   */
  const ids = Array.from({ length: 20 }, (_, k) => k + 1);
  const columnOf = (id: number) => ((id - 1) % 10) + 1;
  const seam = [
    { ids: ids.slice(0, 10), turned: false },
    { ids: ids.slice(10), turned: false },
  ];

  it("cuts at the seam into the rounds as they are", () => {
    expect(cutAt(seam, columnOf, 0, 10)).toEqual([ids.slice(0, 10), ids.slice(10)]);
  });

  it("cuts after stitch 5 into rounds of 5, 10 and 5", () => {
    const rounds = cutAt(seam, columnOf, 5, 10);
    expect(rounds).toEqual([ids.slice(0, 5), ids.slice(5, 15), ids.slice(15)]);
    // Turned so the marker is the right-hand edge: the first round on the left of the chart, the last on the right.
    expect(rounds[0].map((id) => turned(columnOf(id), 5, 10))).toEqual([6, 7, 8, 9, 10]);
    expect(rounds[1].map((id) => turned(columnOf(id), 5, 10))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(rounds[2].map((id) => turned(columnOf(id), 5, 10))).toEqual([1, 2, 3, 4, 5]);
  });

  it("leaves a short row whole, wherever the marker is", () => {
    const rows = [
      { ids: ids.slice(0, 10), turned: false },
      { ids: [11, 12, 13], turned: true },
      { ids: ids.slice(13), turned: false },
    ];
    expect(cutAt(rows, columnOf, 2, 10)).toEqual([[1, 2], [3, 4, 5, 6, 7, 8, 9, 10], [11, 12, 13], [14, 15, 16, 17, 18, 19, 20]]);
  });
});

describe("the view of the test sweater with markers", () => {
  const built = buildSweater(testSweaterWithMarkers(), "one");
  const { stitches, knitting } = built;
  const layout = layOutSweater(stitches, knitting.rounds, knitting.roundKinds, knitting.roundPieces);
  const step = stitches.find((stitch) => stitch.type === "marker" && stitch.begins)!;
  const before = viewAt(built, layout, step.id - 1);
  const after = viewAt(built, layout, step.id);
  const worked = (id: number) => stitches[id].links.slice(0, consumption[stitches[id].type]);

  it("is the rounds from the seam until the new beginning is placed, and again once that is undone", () => {
    expect(beginningAt(built, step.id - 1)).toBeUndefined();
    expect(before.rounds).toBe(knitting.rounds);
    expect(before.layout).toBe(layout);
    expect(beginningAt(built, step.id)).toBe(step.id);
  });

  it("from then on cuts the whole chart at the new beginning, from the cast-on up", () => {
    const { rounds, layout: turnedLayout } = after;
    const cell = (id: number) => turnedLayout.cells.get(id)!;
    // The stitch after the new beginning is the chart's right-hand edge.
    expect(cell(step.id + 1).column).toBe(1);
    // The first round is the part of the cast-on before the new beginning: on the left of the chart, and no more than a round.
    const castOn = knitting.rounds[0];
    expect(rounds[0].length).toBeLessThan(castOn.length);
    expect(rounds[0]).toEqual(castOn.slice(0, rounds[0].length));
    // The round just finished ends at the new beginning; the next runs on past the old beginning, and the walk ends it.
    const at = rounds.findIndex((round) => round.includes(step.id - 1));
    expect(rounds[at].at(-1)).toBe(step.id - 1);
    const walk = built.rounds[built.roundLabels.findIndex((label) => label.endsWith("to the new beginning of the round"))];
    expect(rounds[at + 1].at(-1)).toBe(walk.at(-1));
    // Every stitch in it once.
    expect(rounds.flat().sort((a, b) => a - b)).toEqual(knitting.rounds.flat().sort((a, b) => a - b));
  });

  it("keeps every stitch over what it was worked into, and no two in a cell", () => {
    const cells = after.layout.cells;
    const taken = new Set<string>();
    for (const [id, cell] of cells) {
      const key = `${cell.row}|${cell.column}`;
      expect(taken.has(key), `two stitches in row ${cell.row}, column ${cell.column}`).toBe(false);
      taken.add(key);
      const below = worked(id);
      if (below.length !== 1 || !cells.has(below[0])) continue;
      const parent = cells.get(below[0])!;
      if (stitches[id].type !== "k1" && stitches[id].type !== "bindOff") continue;
      expect(cell.column).toBeCloseTo(parent.column, 6);
      expect(cell.row).toBeGreaterThan(parent.row);
    }
  });

  it("draws the raglan line straight up between the same two columns, from where it is placed to where it comes off", () => {
    const line = after.markers.find((one) => one.marker === raglanLine)!;
    const placed = stitches.find((stitch) => stitch.type === "marker" && stitch.marker === raglanLine && !stitch.removed)!;
    const removed = stitches.find((stitch) => stitch.type === "marker" && stitch.marker === raglanLine && stitch.removed)!;
    expect(line.from).toBe(after.layout.cells.get(placed.id + 1)!.row);
    expect(line.to).toBe(after.layout.cells.get(removed.id - 1)!.row);
    expect(line.after).toBe(after.layout.cells.get(placed.id - 1)!.column);
    // And the same line, turned, as before the new beginning.
    const was = before.markers.find((one) => one.marker === raglanLine)!;
    expect(turned(was.after, Math.round(layout.cells.get(step.id - 1)!.column), layout.columns)).toBe(line.after);
    // The new beginning is the chart's edge, not a line up it.
    expect(after.markers.some((one) => one.marker === newBeginning)).toBe(false);
  });
});
