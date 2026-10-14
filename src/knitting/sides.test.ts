import { describe, expect, it } from "vitest";
import { type ChartStitch, reverseOf, seenFrom, workedAs } from "./sides";
import { consumption, stepTypes, type StitchType } from "../types/StitchType";
import { type Mark, forkMark, makeOneMark, markFor } from "../helpers/stitch-marks";

const sweaterStitches = (Object.keys(consumption) as StitchType[]).filter((type) => !stepTypes.has(type));

describe("each stitch from the other side of the fabric", () => {
  it("is its pair, the stitch a key gives for the other side's rows", () => {
    const pairs: [StitchType, ChartStitch][] = [
      ["k1", "p1"],
      ["k1tbl", "p1tbl"],
      ["k2tog", "p2tog"],
      ["ssk", "ssp"],
      ["s2kp", "s2pp"],
      ["sk2p", "p2sps"],
      ["m1", "m1p"],
      ["kfb", "pfb"],
      ["pickUp", "pickUpPurl"],
      ["bindOff", "bindOffPurl"],
    ];
    for (const [stitch, pair] of pairs) {
      expect(reverseOf(stitch)).toBe(pair);
      expect(reverseOf(pair)).toBe(stitch);
    }
  });

  it("comes back to itself turned over twice, every stitch of a sweater", () => {
    for (const type of sweaterStitches) expect(reverseOf(reverseOf(type))).toBe(type);
  });

  it("leaves a cast-on and the steps as they are", () => {
    expect(reverseOf("castOn")).toBe("castOn");
    for (const step of stepTypes) expect(reverseOf(step)).toBe(step);
  });
});

describe("a stitch shown, and a stitch worked", () => {
  const back = { type: "k1" as const, wrongSide: true };
  const round = { type: "k2tog" as const };

  it("shows a short row purled back as the knits it makes from the right side, and purls from the wrong", () => {
    expect(seenFrom(back, "right")).toBe("k1");
    expect(seenFrom(back, "wrong")).toBe("p1");
    expect(seenFrom(round, "right")).toBe("k2tog");
    expect(seenFrom(round, "wrong")).toBe("p2tog");
  });

  it("works a short row back as purls, whichever side the chart shows", () => {
    expect(workedAs(back)).toBe("p1");
    expect(workedAs(round)).toBe("k2tog");
  });
});

/** How far a mark's dot stands clear of its strokes, less its radius. */
const clearance = (mark: Mark): number => {
  const dot = mark.dot!;
  let nearest = Infinity;
  for (const stroke of mark.strokes ?? []) {
    for (let i = 1; i < stroke.length; i++) {
      const [[ax, ay], [bx, by]] = [stroke[i - 1], stroke[i]];
      const [dx, dy] = [bx - ax, by - ay];
      const t = Math.max(0, Math.min(1, ((dot.x - ax) * dx + (dot.y - ay) * dy) / (dx * dx + dy * dy || 1)));
      nearest = Math.min(nearest, Math.hypot(dot.x - (ax + t * dx), dot.y - (ay + t * dy)));
    }
  }
  return nearest - dot.r;
};

describe("the symbols for the other side", () => {
  it("draws each as its pair's symbol and a purl's dot, clear of its strokes and inside its cell", () => {
    for (const type of sweaterStitches) {
      const pair = reverseOf(type);
      if (pair === type || type === "k1" || type === "p1" || type === "m1" || type === "kfb") continue;
      const [own, other] = [markFor(type)!, markFor(pair)!];
      expect(other.strokes, pair).toEqual(own.strokes);
      expect(other.dot, pair).toBeDefined();
      expect(clearance(other), pair).toBeGreaterThan(0.05);
      expect(other.dot!.y + other.dot!.r, pair).toBeLessThan(1);
    }
  });

  it("draws a knit's pair as a purl's dot, and a purl's as a plain knit", () => {
    expect(markFor("k1")).toBeUndefined();
    expect(markFor("p1")?.dot).toBeDefined();
  });

  it("dots a make-one purlwise and a PFB clear of their strokes, whichever way they go", () => {
    for (const lean of [undefined, "left", "right"] as const) {
      const purled = makeOneMark(lean, true)!;
      expect(purled.strokes).toEqual(makeOneMark(lean)!.strokes);
      expect(clearance(purled), String(lean)).toBeGreaterThan(0.05);
    }
    // The stitch a PFB makes is to its left, or to its right on a chart turned over.
    for (const made of [-0.5, 1.5]) expect(clearance(forkMark(0.5, [0.5, made], true))).toBeGreaterThan(0.05);
  });
});
