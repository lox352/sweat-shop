import { describe, expect, it } from "vitest";
import { buildSweater } from "../knitting/engine";
import { testBandedSweater, testSweater } from "../knitting/test-sweater";
import { sweaterById, sweaters } from "../data/sweaters";
import { distance, pose } from "./pose";
import { ropesOf } from "./ropes";

const hamefarin = sweaterById("hamefarin")!;
const sizes = hamefarin.sizes.map((size) => [size.label, buildSweater(hamefarin, size.id)] as const);
const sizeCalled = (label: string) => sizes.find(([candidate]) => candidate === label)![1];
const everySize = sweaters.flatMap((sweater) =>
  sweater.sizes.map((size) => [`${sweater.name} in size ${size.label}`, buildSweater(sweater, size.id)] as const),
);
const paulKlee = sweaterById("paul-klee")!;

/*
 * Every size of every design starts within reach of its ropes. The test
 * sweater is left out of that: it is drawn to be counted by hand, not worn,
 * and its yoke of three rounds below the rib is far too shallow to reach
 * from its neck to its body, which no real yoke is.
 */
describe.each(everySize)("the pose of %s", (_, built) => {
  it("starts with the ropes at or near their length, so the physics has nothing to tear", () => {
    const { positions } = pose(built);
    const ropes = ropesOf(built.stitches, built.roundHeight);
    let over = 0;
    let most = 0;
    for (const rope of ropes) {
      const stretch = distance(positions, rope.a, rope.b) / rope.length;
      if (stretch > 1.2) over++;
      most = Math.max(most, stretch);
    }
    expect(over / ropes.length).toBeLessThan(0.001);
    // And nothing pulled out far anywhere.
    expect(most).toBeLessThan(1.5);
  });
});

const cases = [
  ["the test sweater", buildSweater(testSweater, "one")],
  ["the banded test sweater", buildSweater(testBandedSweater, "one")],
  ["Hamefarin, size M", sizeCalled("M")],
  ["Hamefarin, size 4XL", sizeCalled("4XL")],
  ["Paul Klee, size Kids 1", buildSweater(paulKlee, "k1")],
  ["Paul Klee, size M1", buildSweater(paulKlee, "m1")],
  ["Paul Klee, size 6XL", buildSweater(paulKlee, "6xl")],
] as const;

describe.each(cases)("the pose of %s", (_, built) => {
  const { positions, axes } = pose(built);
  const pieceOf = (id: number) => built.roundPieces[built.rounds.findIndex((round) => round.includes(id))];
  const roundsOf = (piece: string) => built.rounds.filter((_, index) => built.roundPieces[index] === piece);
  const meanOf = (piece: string, axis: 0 | 1 | 2) => {
    const ids = roundsOf(piece).flat();
    return ids.reduce((sum, id) => sum + positions[id * 3 + axis], 0) / ids.length;
  };

  it("puts every stitch somewhere", () => {
    expect(positions.every(Number.isFinite)).toBe(true);
  });

  it("puts the left sleeve on the wearer's left, and the right on the right", () => {
    // The wearer faces +z, so their left hand is at +x.
    expect(meanOf("sleeve-left", 0)).toBeGreaterThan(0);
    expect(meanOf("sleeve-right", 0)).toBeLessThan(0);
  });

  it("hangs the body below the yoke, and holds the arms out and down", () => {
    expect(meanOf("yoke", 1)).toBeGreaterThan(meanOf("body", 1));
    expect(meanOf("sleeve-left", 1)).toBeLessThan(meanOf("yoke", 1));
    const body = built.rounds[built.roundPieces.indexOf("body")];
    const radius = Math.hypot(positions[body[0] * 3], positions[body[0] * 3 + 2]);
    expect(Math.abs(meanOf("sleeve-left", 0))).toBeGreaterThan(radius);
    const arm = axes["sleeve-left"].direction;
    expect(arm[0]).toBeCloseTo(Math.SQRT1_2);
    expect(arm[1]).toBeCloseTo(-Math.SQRT1_2);
  });

  it("stands each armhole upright at the side of the body", () => {
    for (const piece of ["sleeve-left", "sleeve-right"]) {
      const armhole = roundsOf(piece)[0];
      const xs = armhole.map((id) => positions[id * 3]);
      const ys = armhole.map((id) => positions[id * 3 + 1]);
      // As upright as a round's own turn of the helix leaves it...
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(built.roundHeight * 1.5);
      // ...and as tall as it is round.
      const across = (armhole.length * 2) / Math.PI;
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(across * 0.9);
    }
  });

  it("starts the body at the middle of the back, and each sleeve at its underarm", () => {
    const body = built.rounds[built.roundPieces.indexOf("body")];
    expect(positions[body[0] * 3 + 2]).toBeLessThan(0);
    expect(Math.abs(positions[body[0] * 3])).toBeLessThan(2);
    const sleeve = built.rounds[built.roundPieces.indexOf("sleeve-left")];
    const first = built.stitches[sleeve[0]];
    expect(first.type).toBe("pickUp");
    expect(distance(positions, first.id, first.from!)).toBeLessThan(built.roundHeight * 1.3);
    expect(pieceOf(first.from!)).toBe("body");
  });
});
