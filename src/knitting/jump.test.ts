import { expect, it } from "vitest";
import { buildSweater } from "./engine";
import { progressBefore } from "./jump";
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
