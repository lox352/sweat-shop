import { describe, expect, it } from "vitest";
import { buildSweater } from "./engine";
import { testBandedSweater } from "./test-sweater";
import { currentRun, indexRounds, positionOf, roundNames, runInstruction } from "./progress";
import { holdRegions } from "./holds";
import { workedAs } from "./sides";
import { keyEntryAt } from "./stitch-key";
import { isStep } from "../types/Stitch";

const built = buildSweater(testBandedSweater, "one");
const { stitches, rounds, roundLabels, roundKinds } = built;
const index = indexRounds(rounds, roundLabels, built.roundPieces, testBandedSweater.pieces, roundKinds);
const names = roundNames(index);
const round = (label: string) => rounds[roundLabels.indexOf(label)];
const types = (ids: number[]) => ids.map((id) => stitches[id].type);
const runAt = (ids: number[]) => runInstruction(currentRun(stitches, ids[0] - 1, index)!);

describe("a yoke of two-colour bands, increased in its bands and along raglan lines", () => {
  it("knits every count its pattern states", () => {
    expect(built.checks).toEqual(testBandedSweater.sizes[0].checks);
  });

  it("works its neck in k1 p1 rib, read as a pattern writes it", () => {
    expect(types(rounds[1])).toEqual(Array.from({ length: 24 }, (_, i) => (i % 2 ? "p1" : "k1")));
    expect(runAt(rounds[1])).toBe("(K1, p1) x 12");
  });

  it("increases on the last short row back, as a PFB from the wrong side, and on the row to the end of the round", () => {
    const back = round("Yoke · short row 4, wrong side");
    const on = round("Yoke · short rows, to the end of the round");
    expect(types(back).slice(0, 6)).toEqual(["k1", "k1", "kfb", "m1", "k1", "k1"]);
    expect(workedAs(stitches[back[2]])).toBe("pfb");
    expect(runAt(back.slice(2))).toBe("PFB");
    expect(types(on)).toEqual(["k1", "k1", "kfb", "m1", "k1", "k1"]);
    // The last pair reached 3 further than the first, as asked.
    expect(round("Yoke · short row 3, right side")).toHaveLength(8);
    expect(back).toHaveLength(12);
  });

  it("increases in a band's blocks with a KFB cell and its second loop, held by the same stitch", () => {
    const increasing = round("Band 1, row 2");
    expect(types(increasing).slice(0, 5)).toEqual(["k1", "kfb", "m1", "k1", "k1"]);
    const [kfb, m1] = [stitches[increasing[1]], stitches[increasing[2]]];
    expect(m1.links[0]).toBe(kfb.links[0]);
    expect(stitches[increasing[0]].slot).toBe("1A");
    expect(stitches[increasing[5]].slot).toBe("1B");
  });

  it("knits the bands on the colourwork's needles, and the rest on the main and the rib's", () => {
    expect(stitches[round("Band 1, row 1")[0]].needles).toBe(3.75);
    expect(stitches[round("Yoke · plain round")[0]].needles).toBe(3);
    expect(stitches[rounds[1][0]].needles).toBe(2.75);
  });

  it("works a raglan round with a KBF and a KFB either side of each line", () => {
    const raglan = rounds[roundLabels.lastIndexOf("Yoke · shaping round")];
    expect(types(raglan).slice(4, 8)).toEqual(["kbf", "m1", "kfb", "m1"]);
    expect(runAt(raglan.slice(4))).toBe("KBF");
    expect(keyEntryAt(stitches, raglan[5])?.id).toBe("kbf");
  });
});

describe("a body divided with the round moved to the underarm", () => {
  const divide = round("Body · dividing round");
  const part = round("Body · on to the new beginning of the round");

  it("wraps the first stitch of each sleeve before it goes on hold", () => {
    const holds = stitches.filter((stitch) => stitch.type === "hold");
    expect(holds.map((hold) => [hold.holder, hold.wrap])).toEqual([
      ["sleeve-right", true],
      ["sleeve-left", true],
    ]);
    expect(positionOf(stitches, holds[0].id - 1, index).holdNext).toEqual({ holder: "sleeve-right", count: 10, wrap: true });
  });

  it("casts on one more at each underarm and passes it over the next stitch, slipped, to close up", () => {
    expect(types(divide).slice(6, 10)).toEqual(["castOn", "castOn", "castOn", "sl1po"]);
    expect(stitches[divide[9]].links).toEqual([expect.any(Number), divide[8]]);
    // The stitch passed over is bound off: the body has 6 + 2 + 16 + 2 + 6.
    expect(built.checks.body).toBe(32);
    expect(keyEntryAt(stitches, divide[9])?.id).toBe("sl1po");
  });

  it("knits on to the new beginning of the round, part of a round, and begins every round after there", () => {
    expect(part).toHaveLength(7);
    expect(roundKinds[roundLabels.indexOf("Body · on to the new beginning of the round")]).toBe("part");
    expect(names[roundLabels.indexOf("Body · on to the new beginning of the round")]).toBe(
      "Body, on to the new beginning of the round",
    );
    // The next round begins after the first stitch cast on at the right underarm.
    const next = round("Body · plain round");
    expect(stitches[next[0]].links[0]).toBe(divide[7]);
    expect(stitches[next[next.length - 1]].links[0]).toBe(part[part.length - 1]);
  });

  it("binds the rib off in pattern", () => {
    const bindOff = round("Body · bind off");
    expect(types(bindOff).slice(0, 4)).toEqual(["bindOff", "bindOffPurl", "bindOff", "bindOffPurl"]);
    expect(runAt(bindOff)).toBe("Bind off 32 in pattern");
  });
});

describe("a sleeve picking up more than its underarm cast on", () => {
  const pickUp = round("Left sleeve · pick-up round");
  const [left] = holdRegions(stitches, built.holds).filter((region) => region.holder === "sleeve-left");

  it("picks the rest up at the corners", () => {
    const from = pickUp.filter((id) => stitches[id].type === "pickUp").map((id) => stitches[id].from);
    expect(from).toHaveLength(4);
    expect(new Set(from)).toEqual(new Set(left.edge));
    // One from each stitch cast on, and one more from each at its corner.
    expect(from[0]).toBe(from[1]);
    expect(from[2]).toBe(from[3]);
  });

  it("is on hold whole, picked-up stitches and all, until it is begun", () => {
    const sleeve = rounds.filter((_, at) => built.roundPieces[at] === "sleeve-left").flat();
    expect(sleeve.every((id) => left.region.has(id))).toBe(true);
    expect(left.edge!.some((id) => left.region.has(id))).toBe(false);
  });

  it("begins on the main needles", () => {
    const resume = stitches.find((stitch) => stitch.type === "resume" && stitch.holder === "sleeve-left")!;
    expect(resume.needles).toBe(3);
    expect(stitches.filter((stitch) => isStep(stitch) && stitch.type === "needles").map((step) => step.needles)).toEqual([
      3, 3.75, 3, 2.75, 2.75, 2.75,
    ]);
  });
});
