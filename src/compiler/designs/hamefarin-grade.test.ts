import { describe, expect, it } from "vitest";
import { type Graded, grade, measured } from "./hamefarin-grade";

/*
 * The sizes as they were graded and pasted into the design, before the
 * grading was a function there: what it must still give at the pattern's
 * tension.
 */
const published: Graded[] = [
  {
    id: "xs", label: "XS", toFitChestCm: 76,
    finished: { chestCm: 86, neckCm: 44, yokeDepthCm: 19, bodyLengthCm: 35, upperArmCm: 29, sleeveLengthCm: 43, cuffCm: 19 },
    grade: {
      neck: 124, shortRows: { first: 20, extend: 6, pairs: 3 }, first: 164, incs: [222, 264, 296, 336, 360],
      plain: [1, 1, 0, 0, 0], pad: 0,
      back: 110, front: 110, sleeve: 70, underarm: 10,
      bodyRounds: 85,
      firstDecrease: 8, decreases: [{ every: 7, times: 11 }, { every: 6, times: 3 }], sleeveTail: 8,
    },
  },
  {
    id: "s", label: "S", toFitChestCm: 86,
    finished: { chestCm: 96, neckCm: 45, yokeDepthCm: 20, bodyLengthCm: 36, upperArmCm: 31, sleeveLengthCm: 44, cuffCm: 19.5 },
    grade: {
      neck: 124, shortRows: { first: 20, extend: 6, pairs: 3 }, first: 168, incs: [228, 276, 356, 384, 396],
      plain: [1, 1, 1, 1, 1], pad: 0,
      back: 124, front: 124, sleeve: 74, underarm: 10,
      bodyRounds: 88,
      firstDecrease: 8, decreases: [{ every: 7, times: 14 }], sleeveTail: 8,
    },
  },
  {
    id: "m", label: "M", toFitChestCm: 96,
    finished: { chestCm: 106, neckCm: 46, yokeDepthCm: 21, bodyLengthCm: 37, upperArmCm: 33, sleeveLengthCm: 45, cuffCm: 20 },
    grade: {
      neck: 128, shortRows: { first: 20, extend: 6, pairs: 3 }, first: 176, incs: [240, 300, 348, 408, 432],
      plain: [1, 2, 2, 2, 1], pad: 0,
      back: 136, front: 136, sleeve: 80, underarm: 12,
      bodyRounds: 91,
      firstDecrease: 8, decreases: [{ every: 6, times: 11 }, { every: 5, times: 7 }], sleeveTail: 8,
    },
  },
  {
    id: "l", label: "L", toFitChestCm: 106,
    finished: { chestCm: 116, neckCm: 47, yokeDepthCm: 22, bodyLengthCm: 38, upperArmCm: 35.5, sleeveLengthCm: 46, cuffCm: 21 },
    grade: {
      neck: 132, shortRows: { first: 21, extend: 7, pairs: 3 }, first: 184, incs: [258, 324, 424, 456, 480],
      plain: [1, 2, 2, 2, 2], pad: 2,
      back: 150, front: 150, sleeve: 90, underarm: 12,
      bodyRounds: 95,
      firstDecrease: 8, decreases: [{ every: 5, times: 20 }, { every: 4, times: 1 }], sleeveTail: 8,
    },
  },
  {
    id: "xl", label: "XL", toFitChestCm: 116,
    finished: { chestCm: 126, neckCm: 48, yokeDepthCm: 23, bodyLengthCm: 39, upperArmCm: 38, sleeveLengthCm: 47, cuffCm: 22 },
    grade: {
      neck: 136, shortRows: { first: 22, extend: 7, pairs: 3 }, first: 188, incs: [258, 324, 428, 480, 504],
      plain: [1, 2, 2, 2, 2], pad: 6,
      back: 162, front: 162, sleeve: 90, underarm: 14,
      bodyRounds: 98,
      firstDecrease: 8, decreases: [{ every: 5, times: 19 }, { every: 4, times: 3 }], sleeveTail: 8,
    },
  },
  {
    id: "2xl", label: "2XL", toFitChestCm: 126,
    finished: { chestCm: 136, neckCm: 49, yokeDepthCm: 24, bodyLengthCm: 40, upperArmCm: 41, sleeveLengthCm: 47, cuffCm: 23 },
    grade: {
      neck: 136, shortRows: { first: 22, extend: 7, pairs: 3 }, first: 192, incs: [270, 336, 444, 504, 540],
      plain: [1, 2, 2, 2, 2], pad: 9,
      back: 174, front: 174, sleeve: 96, underarm: 16,
      bodyRounds: 101,
      firstDecrease: 8, decreases: [{ every: 5, times: 11 }, { every: 4, times: 13 }], sleeveTail: 8,
    },
  },
  {
    id: "3xl", label: "3XL", toFitChestCm: 136,
    finished: { chestCm: 146, neckCm: 50, yokeDepthCm: 25, bodyLengthCm: 41, upperArmCm: 44, sleeveLengthCm: 48, cuffCm: 24 },
    grade: {
      neck: 140, shortRows: { first: 22, extend: 7, pairs: 3 }, first: 200, incs: [282, 360, 468, 528, 588],
      plain: [1, 2, 2, 2, 2], pad: 12,
      back: 188, front: 188, sleeve: 106, underarm: 16,
      bodyRounds: 104,
      firstDecrease: 8, decreases: [{ every: 5, times: 3 }, { every: 4, times: 24 }], sleeveTail: 8,
    },
  },
  {
    id: "4xl", label: "4XL", toFitChestCm: 146,
    finished: { chestCm: 156, neckCm: 51, yokeDepthCm: 26, bodyLengthCm: 42, upperArmCm: 47, sleeveLengthCm: 48, cuffCm: 25 },
    grade: {
      neck: 144, shortRows: { first: 23, extend: 7, pairs: 3 }, first: 204, incs: [288, 360, 480, 528, 624],
      plain: [1, 2, 2, 2, 2], pad: 15,
      back: 200, front: 200, sleeve: 112, underarm: 18,
      bodyRounds: 107,
      firstDecrease: 8, decreases: [{ every: 4, times: 24 }, { every: 3, times: 5 }], sleeveTail: 8,
    },
  },
];

describe("grading Hamefarin", () => {
  it("gives the published sizes at the pattern's own tension", () => {
    expect(measured.map((size) => grade(size))).toEqual(published);
  });

  it("gives the same sweater in other counts at another tension", () => {
    const large = measured.find((size) => size.id === "l")!;
    const loose = grade(large, { stitches: 2.4, rounds: 2.8 }).grade;
    const tight = grade(large).grade;
    // Fewer stitches round, for the same chest; fewer rounds down, for the same body.
    expect(loose.back + loose.front + 2 * loose.underarm).toBeLessThan(tight.back + tight.front + 2 * tight.underarm);
    expect((loose.back + loose.front + 2 * loose.underarm) / 2.4).toBeCloseTo(116, -1);
    expect(loose.bodyRounds).toBeLessThan(tight.bodyRounds);
    expect(loose.incs[4] % 12).toBe(0);
  });
});
