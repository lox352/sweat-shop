import { describe, expect, it } from "vitest";
import { buildSweater } from "./engine";
import { testSweater, testSweaterWithShortRows } from "./test-sweater";
import { holdsIn, turnsIn } from "./chart-marks";
import { layOutBanded } from "./layout";

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

describe("laying out short rows on the chart", () => {
  const built = buildSweater(testSweaterWithShortRows(), "one");
  const pieceOf = (id: string) => built.rounds.map((_, index) => index).filter((index) => built.roundPieces[index] === id);
  const indices = pieceOf("yoke");
  const yoke = indices.map((index) => built.rounds[index]);
  const kinds = indices.map((index) => built.roundKinds[index]);
  const layout = layOutBanded(yoke, { kinds, stitches: built.stitches });

  it("stands every stitch of a short row over the stitch it was worked into", () => {
    for (const row of yoke.slice(3, 8)) {
      for (const id of row) {
        expect(layout.cells.get(id)!.column).toBe(layout.cells.get(built.stitches[id].links[0])!.column);
      }
    }
  });

  it("is as wide as the widest round, the short rows taking up no width of their own", () => {
    expect(layout.columns).toBe(48);
    expect(layout.rounds).toBe(yoke.length);
  });
});
