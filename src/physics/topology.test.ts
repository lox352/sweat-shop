import { describe, expect, it } from "vitest";
import { buildSweater } from "../compiler/engine/engine";
import { type SweaterStitches } from "../pattern/knitted";
import { testBandedSweater, testSweater } from "../compiler/engine/test-sweater";
import { pose } from "./pose";
import { settle } from "./solver";
import { fabricPositions } from "../library/settled/format";
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
