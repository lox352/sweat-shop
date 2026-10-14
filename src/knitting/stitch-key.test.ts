import { describe, expect, it } from "vitest";
import { sweaterById } from "../data/sweaters";
import { buildSweater } from "./engine";
import { keyEntryAt, stitchKey } from "./stitch-key";
import { testSweater, testSweaterWithShortRows } from "./test-sweater";

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

  it("keys a short row worked back as the purls it is worked as, and as the chart shows it from each side", () => {
    const pattern = testSweaterWithShortRows();
    // A rib of knits alone, so the only purls are the rows back.
    pattern.charts[0].rows[0] = pattern.charts[0].rows[0].map(({ slot }) => ({ slot }));
    const { stitches } = buildSweater(pattern, "one");
    const back = stitches.find((stitch) => stitch.wrongSide)!;
    expect(back.type).toBe("k1");
    // What to do: purl it.
    expect(keyEntryAt(stitches, back.id)?.id).toBe("p1");
    expect(stitchKey(stitches).map((entry) => entry.id)).toContain("p1");
    // What the chart shows: a knit from the right side, like the rest, and a purl from the wrong.
    expect(keyEntryAt(stitches, back.id, {}, "right")?.id).toBe("k1");
    expect(keyEntryAt(stitches, back.id, {}, "wrong")?.id).toBe("p1");
    expect(stitchKey(stitches, {}, "right").map((entry) => entry.id)).not.toContain("p1");
  });

  it("keys every stitch as its pair from behind, from the wrong side, in the design's words where they hold", () => {
    const wrong = stitchKey(built.stitches, hamefarin.stitchNotes, "wrong");
    expect(wrong.map((entry) => entry.id)).toEqual([
      "castOn", "join", "k1", "p1", "m1p", "p2tog", "ssp", "pickUpPurl", "bindOffPurl",
    ]);
    const m1p = wrong.find((entry) => entry.id === "m1p")!;
    expect(m1p.label).toBe("Make one purlwise");
    expect(m1p.abbreviation).toBe("M1LP");
    expect(m1p.lean).toBe("left");
    // The design's pick-up says how to knit one up from the underarm, which a purled one is not.
    expect(wrong.find((entry) => entry.id === "pickUpPurl")?.how).not.toMatch(/underarm/);
  });
});
