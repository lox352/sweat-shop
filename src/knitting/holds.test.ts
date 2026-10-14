import { describe, expect, it } from "vitest";
import { buildSweater } from "./engine";
import { holdRegions, onHoldAt } from "./holds";
import { testSweater } from "./test-sweater";
import { indexRounds } from "./progress";
import hamefarin from "../data/sweaters/hamefarin";

const built = buildSweater(testSweater, "one");
const index = indexRounds(built.rounds, built.roundLabels, built.roundPieces, testSweater.pieces);
const roundsOf = (piece: string) => {
  const span = index.pieces.find((one) => one.id === piece)!;
  return built.rounds.slice(span.first - 1, span.last);
};
const yokeLast = roundsOf("yoke").at(-1)!;
/** The body's underarm cast-ons, the right sleeve's four and then the left's. */
const underarms = roundsOf("body")[0].filter((id) => built.stitches[id].type === "castOn");
const step = (type: string, holder: string) =>
  built.stitches.find((stitch) => stitch.type === type && stitch.holder === holder)!.id;

describe("stitches put on hold", () => {
  it("are recorded as runs of the round they were held from, with the edge cast on in their place and the steps that hold and take them up", () => {
    expect(built.holds).toEqual([
      {
        holder: "sleeve-right",
        stitches: yokeLast.slice(8, 16),
        edge: underarms.slice(0, 4),
        heldAt: step("hold", "sleeve-right"),
        resumedAt: step("resume", "sleeve-right"),
      },
      {
        holder: "sleeve-left",
        stitches: yokeLast.slice(32, 40),
        edge: underarms.slice(4, 8),
        heldAt: step("hold", "sleeve-left"),
        resumedAt: step("resume", "sleeve-left"),
      },
    ]);
  });

  it("are recorded so in every size of Hamefarin, a sleeve's worth each, with the underarm it picks up out of", () => {
    for (const size of hamefarin.sizes) {
      const knitting = buildSweater(hamefarin, size.id);
      expect(knitting.holds.map((held) => held.holder)).toEqual(["sleeve-right", "sleeve-left"]);
      for (const held of knitting.holds) {
        expect(held.stitches.length).toBe(knitting.stitches[held.heldAt].count);
        expect(held.resumedAt).toBeGreaterThan(held.heldAt);
        const pickedUp = knitting.stitches.filter((stitch) => stitch.type === "pickUp" && stitch.piece === held.holder);
        expect(pickedUp.map((stitch) => stitch.from).sort()).toEqual([...held.edge!].sort());
      }
    }
  });
});

describe("a region on hold", () => {
  const [right, left] = holdRegions(built.stitches, built.holds);
  const sleeve = roundsOf("sleeve-left");

  it("is the held stitches, those picked up out of the underarm to go round with them, and every stitch knitted from them: the whole sleeve", () => {
    const expected = [...yokeLast.slice(32, 40), ...sleeve.flat()];
    expect([...left.region].sort((a, b) => a - b)).toEqual(expected.sort((a, b) => a - b));
    expect([...right.region].sort((a, b) => a - b)).toEqual(
      [...yokeLast.slice(8, 16), ...roundsOf("sleeve-right").flat()].sort((a, b) => a - b),
    );
  });

  it("leaves out the underarm cast-on it picks up out of, which the body knits on from", () => {
    expect(left.edge).toHaveLength(4);
    left.edge!.forEach((id) => expect(left.region.has(id)).toBe(false));
    roundsOf("body").flat().forEach((id) => expect(left.region.has(id)).toBe(false));
    expect([...right.region].some((id) => left.region.has(id))).toBe(false);
  });

  it("is on hold from the step that holds it until the step that takes it up again", () => {
    const holding = (progress: number) => onHoldAt([right, left], progress).map((region) => region.holder);
    expect(holding(right.heldAt - 1)).toEqual([]);
    expect(holding(right.heldAt)).toEqual(["sleeve-right"]);
    expect(holding(left.heldAt)).toEqual(["sleeve-right", "sleeve-left"]);
    expect(holding(left.resumedAt! - 1)).toEqual(["sleeve-right", "sleeve-left"]);
    expect(holding(left.resumedAt!)).toEqual(["sleeve-right"]);
    expect(holding(right.resumedAt!)).toEqual([]);
    expect(holding(built.stitches.length)).toEqual([]);
  });

  it("stays on hold, with nothing to take it up yet", () => {
    const waiting = { ...left, resumedAt: undefined };
    expect(onHoldAt([waiting], built.stitches.length).map((region) => region.holder)).toEqual(["sleeve-left"]);
  });
});
