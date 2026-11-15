import { describe, expect, it } from "vitest";
import { asKnitted, per10cm, sameTension } from "./tension";

const finished = { chestCm: 116, neckCm: 47, yokeDepthCm: 23.5, bodyLengthCm: 41.5, upperArmCm: 35.5, sleeveLengthCm: 46, cuffCm: 21 };
const written = { stitchesPer10cm: 32, roundsPer10cm: 38 };

describe("what a pattern knits up to at another tension", () => {
  it("is as designed at the tension it was written for", () => {
    expect(asKnitted(finished, written, written)).toEqual(finished);
  });

  it("is wider by the stitches and longer by the rounds, to the half centimetre", () => {
    const mine = { stitchesPer10cm: per10cm(14, 6), roundsPer10cm: per10cm(50, 20) };
    expect(mine).toEqual({ stitchesPer10cm: 23.3, roundsPer10cm: 25 });
    const knitted = asKnitted(finished, written, mine);
    expect(knitted.chestCm).toBe(159.5);
    expect(knitted.upperArmCm).toBe(49);
    expect(knitted.yokeDepthCm).toBe(35.5);
    expect(knitted.bodyLengthCm).toBe(63);
  });

  it("calls two tensions the same within two per cent", () => {
    expect(sameTension(written, { stitchesPer10cm: 32.5, roundsPer10cm: 37.5 })).toBe(true);
    expect(sameTension(written, { stitchesPer10cm: 30, roundsPer10cm: 38 })).toBe(false);
  });
});

it("a bigger stitch takes more yarn, by its width and its height", async () => {
  const { yarnPerStitch } = await import("./tension");
  const written = { stitchesPer10cm: 32, roundsPer10cm: 38 };
  expect(yarnPerStitch(written, written)).toBe(1);
  expect(yarnPerStitch(written, { stitchesPer10cm: 16, roundsPer10cm: 19 })).toBe(2);
  expect(yarnPerStitch(written, { stitchesPer10cm: 23.3, roundsPer10cm: 25 })).toBeCloseTo(1.45, 1);
});
