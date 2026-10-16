import { describe, expect, it } from "vitest";
import { type SweaterStitches, buildSweater } from "../../../knitting/engine";
import { testBandedSweater, testSweater } from "../../../knitting/test-sweater";
import { pose } from "../../../physics/pose";
import { settle } from "../../../physics/solver";
import { fabricPositions } from "./format";
import { topologyOf } from "./topology";

/**
 * The test sweater with a change to the rib's needles after its divide: a
 * step more, and every stitch after it numbered one on. (A change to the
 * needles already in hand is no step at all.)
 */
const withStep = () => {
  const pattern = structuredClone(testSweater);
  const body = pattern.sizes[0].sections.find((section) => section.piece === "body")!;
  body.rounds.splice(1, 0, { type: "needles", to: "rib" });
  return pattern;
};

const key = (built: SweaterStitches) => JSON.stringify(topologyOf(built.knitting));

describe("what the settling sees of the knitting", () => {
  const plain = buildSweater(testSweater, "one");
  const stepped = buildSweater(withStep(), "one");

  it("is the same with a step more, though every stitch after it has a new id", () => {
    expect(stepped.stitches.length).toBe(plain.stitches.length + 1);
    expect(key(stepped)).toBe(key(plain));
  });

  it("is right to be: the pose and the settling put the fabric in the same place either way", () => {
    const settled = (built: SweaterStitches) =>
      fabricPositions(built.stitches, settle(built.knitting, pose(built.knitting)).positions);
    expect(settled(stepped)).toEqual(settled(plain));
  });

  it("changes with the fabric", () => {
    expect(key(buildSweater(testBandedSweater, "one"))).not.toBe(key(plain));
  });
});
