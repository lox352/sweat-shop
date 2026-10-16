import { describe, expect, it } from "vitest";
import paulKlee, { newBeginning, raglanLines } from "./paul-klee";
import { buildSweater } from "../../knitting/engine";
import { layOutSweater } from "../../knitting/layout";
import { isFabric } from "../../types/Stitch";

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
  // The raglan's set-up round, "Sts between markers": half the back, a sleeve, the front.
  setUp: [
    [33, 46, 66], [34, 44, 68], [39, 50, 78], [39, 50, 78], [41, 62, 82], [42, 60, 84], [43, 58, 86], [44, 56, 88],
    [45, 54, 90], [54, 72, 108], [55, 70, 110], [56, 68, 112], [66, 84, 132], [66, 84, 132], [67, 82, 134], [68, 80, 136],
  ],
};

describe.each(paulKlee.sizes.map((size, at) => [size.label, size, at] as const))("Paul Klee in size %s", (_, size, at) => {
  const built = buildSweater(paulKlee, size.id);
  const { stitches, rounds, roundLabels, roundPieces, roundKinds } = built;
  const labelled = (pattern: RegExp) => rounds.filter((_round, index) => pattern.test(roundLabels[index]));
  const perCm = size.stitchesPer10cm / 10;
  const markers = stitches.filter((stitch) => stitch.type === "marker");
  const placed = (name: string) => markers.find((step) => step.marker === name && !step.removed)!;
  const takenOff = (name: string) => markers.find((step) => step.marker === name && step.removed)!;
  /** The round a step falls in, and how many of its stitches come before the step. */
  const placeOf = (id: number) => {
    const index = rounds.findIndex((round) => round[0] < id && id < round[round.length - 1]);
    return { label: roundLabels[index], after: rounds[index].filter((one) => one < id).length };
  };

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

  it("places one band's markers after every fifth block, and takes them off in the first plain round after the colourwork", () => {
    const sections = markers.filter((step) => step.marker?.startsWith("section "));
    const on = sections.filter((step) => !step.removed);
    const round = rounds.find((one) => one[0] < on[0].id && on[0].id < one[one.length - 1])!;
    // Every five blocks are 24 stitches as charted: a marker after each 24 but the last, the beginning of the round.
    expect(on.map((step) => placeOf(step.id).after)).toEqual(Array.from({ length: round.length / 24 - 1 }, (_, k) => 24 * (k + 1)));
    expect(new Set(on.map((step) => placeOf(step.id).label)).size).toBe(1);
    expect(placeOf(on[0].id).label).toMatch(/^Colour \d+, row 5$/);
    expect(sections.filter((step) => step.removed).map((step) => placeOf(step.id).label)).toEqual(on.map(() => "Raglan · plain round"));
  });

  it("places the raglan's four markers in its set-up round, as the pattern divides it", () => {
    const [back, sleeve, front] = stated.setUp[at];
    expect(raglanLines.map((name) => placeOf(placed(name).id))).toEqual(
      [back, back + sleeve, back + sleeve + front, back + 2 * sleeve + front].map((after) => ({ label: "Raglan · plain round", after })),
    );
  });

  it("takes every marker off between the same two columns of the chart it was placed between", () => {
    const { cells } = layOutSweater(stitches, built.knitting.rounds, built.knitting.roundKinds, built.knitting.roundPieces);
    const before = (id: number) => {
      let at = id;
      while (!isFabric(stitches[at])) at--;
      return cells.get(at)!.column;
    };
    for (const step of markers.filter((one) => !one.removed && one.marker?.startsWith("section "))) {
      expect(before(takenOff(step.marker!).id), step.marker).toBe(before(step.id));
    }
    // A raglan line comes off at the divide, where its sleeve goes on hold: in every round between, its KBF just before it and its KFB after it.
    const lines = raglanLines.map((name) => before(placed(name).id));
    labelled(/^Raglan · shaping round$/).forEach((round) => {
      const kbf = round.filter((id) => stitches[id].type === "kbf");
      const kfb = round.filter((id) => stitches[id].type === "kfb");
      const columns = (id: number) => [id, id + 1].map((one) => cells.get(one)!.column);
      lines.forEach((line, k) => {
        // Each with the second loop it makes, straight after it.
        expect(Math.max(...columns(kbf[k]))).toBe(line);
        expect(Math.min(...columns(kfb[k]))).toBeGreaterThan(line);
      });
    });
  });

  it("divides at the underarms, casting on with one passed over, and places the new beginning of the round half way along the right one", () => {
    const divide = labelled(/^Body · dividing round$/)[0];
    const castOn = divide.filter((id) => stitches[id].type === "castOn");
    expect(divide.filter((id) => stitches[id].type === "sl1po")).toHaveLength(2);
    // Each underarm casts on one more than stays, the last passed over the stitch after it.
    const right = built.holds.find((held) => held.holder === "sleeve-right")!.edge!;
    expect(right).toHaveLength(castOn.length / 2 - 1);
    const step = placed(newBeginning);
    expect(step.begins).toBe(true);
    expect(right.indexOf(step.id + 1)).toBe(right.length / 2);
    // "K to marker, RM", wrap and hold the sleeve, "RM", cast on: the raglan's markers come off either side of each sleeve.
    const order = stitches
      .filter((one) => one.id > divide[0] && one.id < divide[divide.length - 1] && (one.type === "marker" || one.type === "hold"))
      .map((one) => (one.type === "hold" ? `hold ${one.holder}` : `${one.removed ? "off" : "on"} ${one.marker}`));
    expect(order).toEqual([
      `off ${raglanLines[0]}`,
      "hold sleeve-right",
      `off ${raglanLines[1]}`,
      `on ${newBeginning}`,
      `off ${raglanLines[2]}`,
      "hold sleeve-left",
      `off ${raglanLines[3]}`,
    ]);
  });

  it("knits on from the old beginning of the round to the new, a quarter of the way round, and the body from there", () => {
    const divide = labelled(/^Body · dividing round$/)[0];
    const step = placed(newBeginning);
    const index = roundLabels.indexOf("Body · to the new beginning of the round");
    const walk = rounds[index];
    // The old beginning comes off as the walk sets out from it, at the middle of the back.
    expect(stitches[walk[0] - 1]).toMatchObject({ type: "marker", marker: "the beginning of the round", removed: true });
    // Half the back and the underarm's stitches to the new beginning, each over the stitch it knits.
    const [back] = stated.setUp[at];
    const increases = labelled(/^Raglan · shaping round$/).length;
    const right = built.holds.find((held) => held.holder === "sleeve-right")!.edge!;
    expect(walk).toHaveLength(back + increases + right.length / 2);
    expect(walk.map((id) => stitches[id].links[0])).toEqual(divide.slice(0, walk.length));
    expect(divide[walk.length]).toBe(step.id + 1);
    // Every round after it begins at the new beginning, the hem's rib and its bind-off too.
    const inDivide = new Set(divide);
    const down = (id: number) => {
      let at = id;
      while (!inDivide.has(at)) at = stitches[at].links[0];
      return at;
    };
    const body = rounds.slice(index + 1).filter((_round, k) => roundPieces[index + 1 + k] === "body");
    expect(body.length).toBeGreaterThan(0);
    for (const round of body) {
      expect(down(round[0])).toBe(step.id + 1);
      expect(round).toHaveLength(size.checks.body);
    }
    expect(stitches[body[body.length - 1][0]].type).toBe("bindOff");
    expect(body.some((round) => stitches[round[1]].type === "p1")).toBe(true);
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
