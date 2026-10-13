import { describe, expect, it } from "vitest";
import { sweaterById } from "../data/sweaters";
import { buildSweater } from "./engine";
import { keyEntryAt, stitchKey } from "./stitch-key";
import { testSweater } from "./test-sweater";

const hamefarin = sweaterById("hamefarin")!;
const built = buildSweater(hamefarin, "m");
const key = stitchKey(built.stitches, hamefarin.stitchNotes);

describe("the stitch-symbol key", () => {
  it("lists the stitches the sweater uses, in the key's order", () => {
    expect(key.map((entry) => entry.id)).toEqual([
      "castOn", "join", "k1", "p1", "m1", "k2tog", "ssk", "pickUp", "bindOff",
    ]);
  });

  it("carries what the design says about its own stitches", () => {
    const m1 = key.find((entry) => entry.id === "m1")!;
    expect(m1.abbreviation).toBe("M1L");
    expect(m1.lean).toBe("left");
    expect(key.find((entry) => entry.id === "pickUp")?.how).toMatch(/underarm/);
  });

  it("explains the join as one cast on and lifted over", () => {
    expect(key.find((entry) => entry.id === "join")?.how).toMatch(/cast on one more stitch/);
  });

  it("has no entry for a step a knitter takes between stitches", () => {
    const { stitches } = buildSweater(testSweater, "one");
    const hold = stitches.find((stitch) => stitch.type === "hold")!;
    expect(keyEntryAt(stitches, hold.id)).toBeUndefined();
    const pickUp = stitches.find((stitch) => stitch.type === "pickUp")!;
    expect(keyEntryAt(stitches, pickUp.id)?.label).toBe("Pick up and knit");
  });
});
