import { expect, it } from "vitest";
import { buildSweater } from "./engine";
import { progressBefore, stitchAtPoint } from "./jump";
import { layOutBanded } from "./layout";
import { cellAt } from "./draw-chart";
import { testSweater } from "./test-sweater";

const { stitches, rounds, roundPieces } = buildSweater(testSweater, "one");

it("jumps to the requested next stitch and validates bounds", () => {
  expect(progressBefore(stitches, rounds, 1, 1)).toBe(0);
  expect(progressBefore(stitches, rounds, 2, 1)).toBe(rounds[1][0] - 1);
  expect(() => progressBefore(stitches, rounds, 0, 1)).toThrow();
  expect(() => progressBefore(stitches, rounds, 2, 100000)).toThrow();
  expect(() => progressBefore(stitches, rounds, 1.5, 1)).toThrow();
});

it("jumps within one piece's rounds to the sweater's own stitch", () => {
  const sleeve = rounds.filter((_, index) => roundPieces[index] === "sleeve-left");
  // The sleeve's first stitch comes after the step that takes up its held stitches.
  expect(progressBefore(stitches, sleeve, 1, 1)).toBe(sleeve[0][0] - 1);
  expect(stitches[sleeve[0][0] - 1].type).toBe("resume");
});

it("finds the stitch drawn under a point on the chart", () => {
  const body = rounds.filter((_, index) => roundPieces[index] === "body");
  const layout = layOutBanded(body);
  const cell = 16;
  for (const id of [body[0][0], body[2][5], body.at(-1)![0]]) {
    const at = layout.cells.get(id)!;
    const { x, y } = cellAt(layout, at.round, at.column, cell);
    expect(stitchAtPoint(layout, body, cell, x + cell / 2, y + cell / 2)).toBe(id);
  }
  expect(stitchAtPoint(layout, body, cell, -5, 5)).toBeUndefined();
});
