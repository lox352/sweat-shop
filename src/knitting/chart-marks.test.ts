import { describe, expect, it } from "vitest";
import { buildSweater } from "./engine";
import { testSweater, testSweaterWithShortRows } from "./test-sweater";
import { type Face, faceAfter, holdsIn, markAt, needleChangesIn, otherFaceRows, turnsIn } from "./chart-marks";
import hamefarin from "../data/sweaters/hamefarin";
import { layOut } from "./layout";
import { castOnPartWayMark, markFor } from "../helpers/stitch-marks";

const { stitches, rounds, roundPieces } = buildSweater(testSweater, "one");
const piece = (id: string) => rounds.filter((_, index) => roundPieces[index] === id);

describe("where the sleeves go on hold", () => {
  it("stands each hold between the stitch before it and the underarm cast on after it", () => {
    const divide = rounds[6];
    expect(holdsIn(stitches, piece("body"), testSweater.pieces)).toEqual([
      { before: divide[7], after: divide[8], holder: "sleeve-right", count: 8, label: "Right sleeve" },
      { before: divide[27], after: divide[28], holder: "sleeve-left", count: 8, label: "Left sleeve" },
    ]);
    expect(stitches[divide[8]].type).toBe("castOn");
  });

  it("is no part of a chart without the dividing round", () => {
    expect(holdsIn(stitches, piece("yoke"))).toEqual([]);
    expect(holdsIn(stitches, piece("sleeve-left"))).toEqual([]);
  });
});

describe("where the needles change", () => {
  it("is ruled between rounds, and noted where held stitches are taken up onto other needles", () => {
    const knitting = buildSweater(hamefarin, "m");
    expect(needleChangesIn(knitting.stitches, knitting.rounds).map((change) => [change.to, change.takeUp ?? false])).toEqual([
      [3.25, false], // after the neck rib
      [2.75, false], // for the body's hem
      [3.25, true], // the left sleeve, taken up
      [2.75, false], // for its cuff
      [3.25, true], // the right sleeve
      [2.75, false], // for its cuff
    ]);
  });
});

describe("where the short rows turn", () => {
  const built = buildSweater(testSweaterWithShortRows(), "one");
  const yoke = built.rounds.filter((_, index) => built.roundPieces[index] === "yoke");

  it("marks the end of every row but the last, which goes on into the round", () => {
    const turns = turnsIn(built.stitches, yoke);
    expect(turns).toHaveLength(4);
    turns.forEach((turn, index) => {
      const row = yoke[3 + index];
      expect(turn.last).toBe(row[row.length - 1]);
      expect(turn.before).toBe(row[row.length - 2]);
    });
  });
});

describe("which side of the sweater is towards you", () => {
  const built = buildSweater(testSweaterWithShortRows(), "one");
  const turnIds = built.stitches.filter((stitch) => stitch.type === "turn").map((stitch) => stitch.id);
  const indices = built.rounds.map((_, index) => index).filter((index) => built.roundPieces[index] === "yoke");
  const kinds = indices.map((index) => built.roundKinds[index]);

  it("is the wrong side from each turn to a short row worked back until the next turn", () => {
    expect(turnIds).toHaveLength(4);
    expect(faceAfter(turnIds, 0)).toBe("right");
    expect(faceAfter(turnIds, turnIds[0] - 1)).toBe("right");
    expect(faceAfter(turnIds, turnIds[0])).toBe("wrong");
    expect(faceAfter(turnIds, turnIds[1] - 1)).toBe("wrong");
    expect(faceAfter(turnIds, turnIds[1])).toBe("right");
    expect(faceAfter(turnIds, turnIds[3])).toBe("right");
    expect(faceAfter(turnIds, built.stitches.length)).toBe("right");
  });

  it("hatches the rows purled back from the right side, and everything else from the wrong", () => {
    expect(kinds.slice(3, 8)).toEqual(["right", "wrong", "right", "wrong", "right"]);
    const rows = kinds.map((_, index) => index + 1);
    expect(otherFaceRows(rows, kinds, "right")).toEqual([[5, 5], [7, 7]]);
    expect(otherFaceRows(rows, kinds, "wrong")).toEqual([[1, 4], [6, 6], [8, kinds.length]]);
  });

  it("hatches nothing from the right side of a piece without short rows", () => {
    expect(otherFaceRows([1, 2, 3, 4, 5], [], "right")).toEqual([]);
    expect(otherFaceRows([1, 2, 3, 4, 5], [], "wrong")).toEqual([[1, 5]]);
  });
});

describe("a short row on the chart, from either side", () => {
  const built = buildSweater(testSweaterWithShortRows(), "one");
  const indices = built.rounds.map((_, index) => index).filter((index) => built.roundPieces[index] === "yoke");
  const yoke = indices.map((index) => built.rounds[index]);
  const layout = layOut(built.stitches, yoke, indices.map((index) => built.roundKinds[index]));
  const byId = new Map(built.stitches.map((stitch) => [stitch.id, stitch]));
  const markOf = (id: number, face: Face) => markAt(built.stitches[id], byId, layout, undefined, face);

  it("is knits from the right side, as the fabric round it is, though the rows back are purled", () => {
    const back = yoke[4];
    expect(back.every((id) => built.stitches[id].wrongSide && built.stitches[id].type === "k1")).toBe(true);
    [...yoke[3], ...back].forEach((id) => expect(markOf(id, "right")).toBeUndefined());
  });

  it("is purls from the wrong side, and every other stitch its pair from behind", () => {
    [...yoke[3], ...yoke[4]].forEach((id) => expect(markOf(id, "wrong")).toEqual(markFor("p1")));
    // The rib's purls are knits from behind, and its knits purls.
    yoke[1].forEach((id) =>
      expect(markOf(id, "wrong")).toEqual(built.stitches[id].type === "p1" ? undefined : markFor("p1")),
    );
    // A make-one is a make-one purlwise: its strokes, and a purl's dot.
    const increase = yoke.flat().find((id) => built.stitches[id].type === "m1")!;
    expect(markOf(increase, "wrong")?.strokes).toEqual(markOf(increase, "right")?.strokes);
    expect(markOf(increase, "wrong")?.dot).toBeDefined();
  });
});

describe("casting on, on the chart", () => {
  const byId = new Map(stitches.map((stitch) => [stitch.id, stitch]));
  const body = piece("body");
  const layout = layOut(stitches, body);

  it("marks an underarm cast on part way round apart from the neck's", () => {
    const underarm = body[0].filter((id) => stitches[id].type === "castOn");
    expect(underarm).toHaveLength(8);
    underarm.forEach((id) => expect(markAt(stitches[id], byId, layout)).toEqual(castOnPartWayMark));
    const neck = layOut(stitches, piece("yoke"));
    expect(markAt(stitches[1], byId, neck)).toEqual(markFor("castOn"));
  });
});
