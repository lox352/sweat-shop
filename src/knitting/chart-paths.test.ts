import { describe, expect, it } from "vitest";
import { buildSweater } from "./engine";
import { layOutBanded } from "./layout";
import { gridPaths, numberedRounds, progressPath } from "./chart-paths";
import { needleChangesIn } from "./chart-marks";
import { testSweater } from "./test-sweater";

const cell = 13;
const { stitches, rounds, roundPieces } = buildSweater(testSweater, "one");
const yoke = rounds.filter((_, index) => roundPieces[index] === "yoke");
const layout = layOutBanded(yoke);

describe("the change of needles on the chart", () => {
  const changes = needleChangesIn(stitches, yoke).map((change) => change.after);

  it("falls between the rib and the yoke", () => {
    expect(changes).toEqual([3]);
  });

  it("takes that boundary out of the counting lines, dashed", () => {
    const y = (layout.rounds - 3) * cell;
    const marked = gridPaths(layout, cell, changes);
    expect(marked.needles).not.toBe("");
    marked.needles
      .split("M")
      .filter(Boolean)
      .forEach((stroke) => expect(Number(stroke.split(" ")[1].split("h")[0])).toBe(y));
    const plain = gridPaths(layout, cell);
    expect(plain.needles).toBe("");
  });

  it("numbers both rounds it falls between, so it can be named", () => {
    const numbers = numberedRounds(layout, changes);
    expect(numbers).toContain(3);
    expect(numbers).toContain(4);
    expect(numbers).toEqual([...new Set(numbers)].sort((a, b) => a - b));
  });
});

describe("the knitting done so far", () => {
  it("veils a round at a time, up to the last stitch worked", () => {
    expect(progressPath(layout, yoke, 0, cell)).toBe("");
    // The whole cast-on and half the first rib round: two rectangles.
    const halfway = yoke[1][11];
    expect(progressPath(layout, yoke, halfway, cell).match(/M/g)).toHaveLength(2);
  });
});
