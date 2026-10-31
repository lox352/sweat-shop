import { describe, expect, it } from "vitest";
import { buildSweater } from "../knitting/engine";
import { testSweater } from "../knitting/test-sweater";
import { sweaterById } from "../data/sweaters";
import { pose } from "../physics/pose";
import { neighboursOf } from "./neighbours";
import { extremesOf } from "./framing";

it("finds something to measure every stitch of the test sweater against, both ways", () => {
  const built = buildSweater(testSweater, "one");
  expect(neighboursOf(built.stitches, built.rounds).pairs.every((id) => id >= 0)).toBe(true);
});

/*
 * Facing is a question of the pose too, and the test sweater's is no shape
 * to ask it of: see physics/pose.test.ts. The design's smallest and largest
 * sizes are.
 */
const cases = [
  ["Hamefarin, size XS", buildSweater(sweaterById("hamefarin")!, "xs")],
  ["Hamefarin, size 4XL", buildSweater(sweaterById("hamefarin")!, "4xl")],
] as const;

describe.each(cases)("how the stitches of %s face", (_, built) => {
  const { drawn, pairs } = neighboursOf(built.stitches, built.knitting.rounds);
  const { positions } = pose(built.knitting);
  const at = (id: number) => [positions[id * 3], positions[id * 3 + 1], positions[id * 3 + 2]];
  const minus = (a: number[], b: number[]) => a.map((value, axis) => value - b[axis]);

  it("finds something to measure every stitch against, both ways", () => {
    expect(pairs.every((id) => id >= 0)).toBe(true);
  });

  const normals = drawn.map((_, index) => {
    const across = minus(at(pairs[index * 4]), at(pairs[index * 4 + 1]));
    const up = minus(at(pairs[index * 4 + 2]), at(pairs[index * 4 + 3]));
    return [
      across[1] * up[2] - across[2] * up[1],
      across[2] * up[0] - across[0] * up[2],
      across[0] * up[1] - across[1] * up[0],
    ];
  });
  const dot = (a: number[], b: number[]) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);

  it("faces the body's stitches out from its middle", () => {
    const body = new Set(built.rounds.filter((_, index) => built.roundPieces[index] === "body").flat());
    let [outwards, count] = [0, 0];
    drawn.forEach((stitch, index) => {
      if (!body.has(stitch.id)) return;
      count++;
      const [x, , z] = at(stitch.id);
      if (dot(normals[index], [x, 0, z]) > 0) outwards++;
    });
    expect(outwards / count).toBeGreaterThan(0.99);
  });

  /*
   * Everywhere else, out of the sweater is not always out from the middle of
   * anything - the yoke curls in under the back of each armhole - but a
   * stitch turned inside out would face the other way from the stitch it
   * was worked into. Only a handful do, at real corners: where a sleeve's
   * underside, facing down, is picked up from the side of the body.
   */
  it("faces every stitch the way the one below it faces", () => {
    const place = new Map(drawn.map((stitch, index) => [stitch.id, index]));
    let [agreeing, count] = [0, 0];
    drawn.forEach((stitch, index) => {
      const below = place.get(pairs[index * 4 + 3]);
      if (pairs[index * 4 + 2] !== stitch.id || below === undefined) return;
      count++;
      if (dot(normals[index], normals[below]) > 0) agreeing++;
    });
    expect(agreeing / count).toBeGreaterThan(0.99);
  });

  // The back neck's short rows knitted back from the wrong side among them, turned about to face out as well.
  it("faces the stitches worked from the wrong side the way the ones below them face", () => {
    const place = new Map(drawn.map((stitch, index) => [stitch.id, index]));
    let [agreeing, count] = [0, 0];
    drawn.forEach((stitch, index) => {
      const below = place.get(pairs[index * 4 + 3]);
      if (!stitch.wrongSide || pairs[index * 4 + 2] !== stitch.id || below === undefined) return;
      count++;
      if (dot(normals[index], normals[below]) > 0) agreeing++;
    });
    expect(count).toBeGreaterThan(0);
    expect(agreeing / count).toBeGreaterThan(0.95);
  });
});

describe("the edges of the silhouette", () => {
  const built = buildSweater(sweaterById("hamefarin")!, "m");
  const { positions } = pose(built.knitting);
  const ids = built.rounds.flat();
  const extremes = extremesOf(positions, ids);

  it("are real stitches, the furthest each way", () => {
    expect(extremes).toHaveLength(26);
    const highest = Math.max(...extremes.map(([, y]) => y));
    const top = ids.reduce((best, id) => Math.max(best, positions[id * 3 + 1]), -Infinity);
    expect(highest).toBe(top);
    // The wearer's left reaches furthest at the end of the left sleeve.
    const furthest = extremes.reduce((best, point) => (point[0] > best[0] ? point : best));
    const cuff = built.rounds[built.roundPieces.lastIndexOf("sleeve-left")];
    const cuffX = Math.max(...cuff.map((id) => positions[id * 3]));
    expect(furthest[0]).toBeCloseTo(cuffX, 0);
  });

  it("are none at all for no stitches", () => {
    expect(extremesOf(positions, [])).toEqual([]);
  });
});
