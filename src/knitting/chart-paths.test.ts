import { describe, expect, it } from "vitest";
import { buildSweater } from "./engine";
import { layOut, layOutSweater } from "./layout";
import { gridPaths, numberedRows, progressPath } from "./chart-paths";
import { needleChangesIn } from "./chart-marks";
import { testSweater } from "./test-sweater";

const cell = 13;
const { stitches, rounds, roundPieces } = buildSweater(testSweater, "one");
const yoke = rounds.filter((_, index) => roundPieces[index] === "yoke");
const layout = layOut(stitches, yoke);

describe("the change of needles on the chart", () => {
  const changes = needleChangesIn(stitches, yoke).map((change) => ({ after: change.after, piece: "yoke" }));

  it("falls between the rib and the yoke", () => {
    expect(changes.map((change) => change.after)).toEqual([3]);
  });

  it("is dashed across that boundary", () => {
    const y = (layout.rows - 3) * cell;
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
    const numbers = numberedRows(layout, changes);
    expect(numbers).toContain(3);
    expect(numbers).toContain(4);
    expect(numbers).toEqual([...new Set(numbers)].sort((a, b) => a - b));
  });
});

describe("the round numbers down the edge", () => {
  it("number the row every piece after the yoke begins in, the yoke's last plus one, as well as every fifth", () => {
    const built = buildSweater(testSweater, "one");
    const whole = layOutSweater(built.stitches, built.rounds, built.roundKinds, built.roundPieces);
    // A yoke of six rounds, the body's five above it and the sleeves' four beside them.
    expect(numberedRows(whole)).toEqual([1, 5, 7, 10, 11]);
  });
});

describe("the knitting done so far", () => {
  it("veils a round at a time, up to the last stitch worked, a rectangle to each unbroken run", () => {
    expect(progressPath(layout, yoke, 0, cell)).toBe("");
    // Under the yoke's make-ones the neck's stitches stand apart: the cast-on and half the first rib round, a rectangle each.
    const halfway = yoke[1][11];
    expect(progressPath(layout, yoke, halfway, cell).match(/M/g)).toHaveLength(24 + 12);
    // And the round that fills the gaps in, side by side, is one.
    const increased = yoke[3].at(-1)!;
    expect(progressPath(layout, yoke, increased, cell).match(/M/g)).toHaveLength(24 * 3 + 1);
  });
});
