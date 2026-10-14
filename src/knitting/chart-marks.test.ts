import { describe, expect, it } from "vitest";
import { buildSweater } from "./engine";
import { testSweater, testSweaterWithShortRows } from "./test-sweater";
import { faceAfter, holdsIn, markAt, otherFaceRounds, turnsIn } from "./chart-marks";
import { layOut } from "./layout";
import { markFor } from "../helpers/stitch-marks";

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
    expect(otherFaceRounds(kinds, kinds.length, "right")).toEqual([[5, 5], [7, 7]]);
    expect(otherFaceRounds(kinds, kinds.length, "wrong")).toEqual([[1, 4], [6, 6], [8, kinds.length]]);
  });

  it("hatches nothing from the right side of a piece without short rows", () => {
    expect(otherFaceRounds([], 5, "right")).toEqual([]);
    expect(otherFaceRounds([], 5, "wrong")).toEqual([[1, 5]]);
  });
});

describe("a short row worked back on the chart", () => {
  const built = buildSweater(testSweaterWithShortRows(), "one");
  const indices = built.rounds.map((_, index) => index).filter((index) => built.roundPieces[index] === "yoke");
  const yoke = indices.map((index) => built.rounds[index]);
  const layout = layOut(built.stitches, yoke, indices.map((index) => built.roundKinds[index]));
  const byId = new Map(built.stitches.map((stitch) => [stitch.id, stitch]));
  const markOf = (id: number) => markAt(built.stitches[id], byId, layout);

  it("is drawn as the purls it is worked as, where the right side's rows are knits", () => {
    const back = yoke[4];
    expect(back.every((id) => built.stitches[id].wrongSide && built.stitches[id].type === "k1")).toBe(true);
    back.forEach((id) => expect(markOf(id)).toEqual(markFor("p1")));
    yoke[3].forEach((id) => expect(markOf(id)).toBeUndefined());
  });
});
