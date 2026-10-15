import { describe, expect, it } from "vitest";
import paulKlee from "./paul-klee";
import { buildSweater } from "../../knitting/engine";

/**
 * The Paul Klee Sweater, held to what its pattern says beyond its stitch
 * counts, which every design's tests check already: how many rounds its yoke
 * takes, how many colours each size knits, what it measures, and how its
 * neck, divide and sleeves are worked.
 */

/* What the pattern states, size by size, in its order of sizes. */
const stated = {
  // "You will have (45, 49, 50, 54)... yoke rounds (= color work + plain + set up + raglan increase) in total."
  yokeRounds: [45, 49, 50, 54, 59, 63, 67, 71, 75, 75, 75, 79, 79, 80, 86, 94],
  // "You will need (14, 14, 16, 16)... colors", and the main colour.
  colours: [14, 14, 16, 16, 18, 18, 18, 18, 18, 22, 22, 22, 24, 24, 24, 24],
  // The sleeve: "Work next (38, 54, 72, 88)... rounds", after picking up and before the cuff.
  sleeveRounds: [38, 54, 72, 88, 124, 121, 116, 112, 108, 108, 108, 108, 108, 108, 108, 108],
  // The short rows across the back: 11, 13, 15 or 17 rows.
  shortRows: [11, 11, 11, 11, 13, 13, 13, 13, 13, 15, 15, 15, 15, 15, 15, 17],
};

describe.each(paulKlee.sizes.map((size, at) => [size.label, size, at] as const))("Paul Klee in size %s", (_, size, at) => {
  const built = buildSweater(paulKlee, size.id);
  const { stitches, rounds, roundLabels, roundPieces, roundKinds } = built;
  const labelled = (pattern: RegExp) => rounds.filter((_round, index) => pattern.test(roundLabels[index]));
  const perCm = size.stitchesPer10cm / 10;

  it("takes as many rounds for its yoke as the pattern says", () => {
    const first = roundLabels.findIndex((label) => label.startsWith("Colour "));
    const last = roundLabels.lastIndexOf("Raglan · shaping round");
    expect(last - first + 1).toBe(stated.yokeRounds[at]);
  });

  it("knits as many colours as the pattern says, two to a band, and the main colour", () => {
    const used = new Set(rounds.flat().map((id) => stitches[id].slot));
    expect(used.size).toBe(stated.colours[at] + 1);
    expect(used.has("MC")).toBe(true);
  });

  it("works its short rows across the back of the neck, reaching five past the middle and four further each row", () => {
    const rows = rounds.filter((_round, index) => roundKinds[index] === "right" || roundKinds[index] === "wrong");
    expect(rows).toHaveLength(stated.shortRows[at]);
    expect(rows.slice(0, 4).map((row) => row.length)).toEqual([5, 9, 13, 17]);
  });

  it("begins every band's blocks afresh, four of colour A and four of colour B", () => {
    labelled(/^Colour \d+, row 1$/).forEach((round, band) => {
      const slots = round.slice(0, 8).map((id) => stitches[id].slot);
      expect(slots).toEqual([...Array(4).fill(`${band + 1}A`), ...Array(4).fill(`${band + 1}B`)]);
    });
  });

  it("measures what the pattern says round the bust and the upper arm, and near it round the neck and cuff", () => {
    const { finished } = size;
    const within = (got: number, wanted: number, what: string, by = 1) =>
      expect(Math.abs(got - wanted), `${what}: ${got.toFixed(1)}cm against ${wanted}cm`).toBeLessThanOrEqual(by);
    within(size.checks.body / perCm, finished.chestCm, "bust");
    within(size.checks["sleeve-left:top"] / perCm, finished.upperArmCm, "upper arm");
    // The k1, p1 rib pulls in: its stitches are narrower than the stocking stitch's.
    const rib = paulKlee.tensions!.rib.stitch!;
    within((size.checks.neck * rib) / perCm, finished.neckCm, "neck", 3);
    within((size.checks["sleeve-left:cuff"] * rib) / perCm, finished.cuffCm, "cuff", 3);
  });

  it("divides at the underarms, casting on with one passed over, and moves the round to the middle of the right underarm", () => {
    const divide = labelled(/^Body · dividing round$/)[0];
    const castOn = divide.filter((id) => stitches[id].type === "castOn");
    expect(divide.filter((id) => stitches[id].type === "sl1po")).toHaveLength(2);
    // Each underarm casts on one more than stays, the last passed over the stitch after it.
    const right = built.holds.find((held) => held.holder === "sleeve-right")!.edge!;
    expect(right).toHaveLength(castOn.length / 2 - 1);
    // The round now begins half way along the right underarm's: the part round ends there, and the next begins after it.
    const partAt = roundLabels.indexOf("Body · on to the new beginning of the round");
    const part = rounds[partAt];
    expect(roundKinds[partAt]).toBe("part");
    expect(stitches[part[part.length - 1]].links[0]).toBe(right[right.length / 2 - 1]);
    expect(stitches[rounds[partAt + 1][0]].links[0]).toBe(right[right.length / 2]);
  });

  it("works each sleeve as many rounds as the pattern says, picking up one more than its underarm has at each corner", () => {
    for (const piece of ["sleeve-left", "sleeve-right"]) {
      const sleeve = rounds.filter((_round, index) => roundPieces[index] === piece);
      // After the round that picks up, until the cuff begins on the rib's needles.
      const cuff = sleeve.findIndex((round) => stitches[round[0]].needles === size.ribNeedlesMm);
      expect(cuff - 1).toBe(stated.sleeveRounds[at]);
      const pickedUp = sleeve[0].filter((id) => stitches[id].type === "pickUp");
      const edge = new Set(pickedUp.map((id) => stitches[id].from));
      expect(pickedUp.length).toBe(edge.size + 2);
    }
  });
});
