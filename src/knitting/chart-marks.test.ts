import { describe, expect, it } from "vitest";
import { buildSweater } from "./engine";
import { testSweater } from "./test-sweater";
import { holdsIn } from "./chart-marks";

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
