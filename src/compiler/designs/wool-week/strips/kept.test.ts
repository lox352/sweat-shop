import { describe, expect, it } from "vitest";
import { sweaterById } from "../..";
import { buildSweater } from "../../../engine/engine";
import { isStepKind } from "../../../../pattern/kinds";
import { cutAfter } from "../../../fit";
import { isSolidRound, restOfBand } from "./kept";
import { keptSolid } from "./plan";

const once = "wool-week-strips-once-oldest";

describe("the rest of a band part knitted, read off the pattern in hand", () => {
  const whole = buildSweater(sweaterById(once)!, "l");
  /** A round as it is knitted: each stitch's yarn, and whether it is made. */
  const said = (round: number) =>
    whole.rounds[round - 1].filter((id) => !isStepKind(whole.stitches[id].type)).map((id) => `${whole.stitches[id].slot}${whole.stitches[id].type === "m1" ? "+" : ""}`);
  // The last rounds of the years on the yoke: 2014's, 2015's and 2016's.
  const ends: number[] = [];
  for (let round = cutAfter(once, whole, 1); round !== undefined; round = cutAfter(once, whole, round + 1)) ends.push(round);

  it("reads every round of every year back as it is knitted: one repeat of it, so many times, and its new stitches where they are made", () => {
    expect(ends).toEqual([44, 64, 97]);
    let read = 0;
    for (const [nth, end] of ends.entries()) {
      // From the first whole round of the year's own to the round before its last.
      for (let from = nth === 0 ? 18 : ends[nth - 1] + 1; from < end; from++) {
        const rows = restOfBand(whole, from, end)!;
        expect(rows, `from ${from}`).toHaveLength(end - from);
        rows.forEach((row, i) => {
          const round = from + 1 + i;
          const { cells, reps, places } = row.kept;
          const made = new Set(places);
          // What the kept round says of the round: its repeat that many times, or, where its new stitches are not its repeat's own, at their places.
          const back = Array.from({ length: reps }, () => cells.map((cell) => `${cell.slot}${cell.symbol === "m1" ? "+" : ""}`))
            .flat()
            .map((one, j) => (made.has(j) ? `${one}+` : one));
          expect(back, `round ${round} from ${from}`).toEqual(said(round));
          expect(keptSolid(row)).toBe(isSolidRound(whole, round));
          expect(row.year).toBe(2014 + nth);
          read++;
        });
      }
    }
    expect(read).toBeGreaterThan(1000);
  });

  it("keeps the rounds of a run on one number of repeats, the smallest repeat they all share", () => {
    // 2015's sheep, rounds 52 to 61: twelve repeats of thirty stitches, then of thirty-one and thirty-two where a column of the band is doubled.
    const rows = restOfBand(whole, 51, 64)!;
    const sheep = rows.slice(0, 10);
    expect(new Set(sheep.map((row) => row.kept.run)).size).toBe(1);
    expect(sheep.map((row) => row.kept.reps)).toEqual(Array(10).fill(12));
    expect(sheep.map((row) => row.kept.cells.length)).toEqual([30, 30, 30, 30, 30, 31, 31, 31, 32, 32]);
    // The rounds that double a column make one stitch in every repeat.
    expect(sheep.map((row) => row.kept.cells.filter((cell) => cell.symbol === "m1").length)).toEqual([0, 0, 0, 0, 0, 1, 0, 0, 1, 0]);
    // Then a round of one yarn, which the pattern in hand shapes in; a round of dots, a run of its own on a repeat of two; and a plain round.
    const [shaping, dots, plain] = rows.slice(10);
    expect(keptSolid(shaping)).toBe(true);
    expect(shaping.kept.places).toHaveLength(412 - 384);
    expect(dots.kept.cells).toHaveLength(2);
    expect(dots.kept.reps).toBe(206);
    expect(dots.kept.run).not.toBe(sheep[0].kept.run);
    expect(keptSolid(plain)).toBe(true);
    expect(plain.kept.places).toBeUndefined();
  });

  it("says a run is carried where it was begun in a round already knitted, and not where it begins after a round of one yarn", () => {
    // Round 51 is one yarn and the sheep begin in 52: read from 51 they are a run to begin; from 55, part way down them, one to go on with.
    expect(restOfBand(whole, 51, 64)![0].kept.carried).toBeUndefined();
    const from55 = restOfBand(whole, 55, 64)!;
    expect(from55.slice(0, 6).every((row) => row.kept.carried)).toBe(true);
    expect(from55.slice(6).some((row) => row.kept.carried)).toBe(false);
  });

  it("can't read a round that is no whole round of knit stitches: the ribbing, the short rows", () => {
    expect(restOfBand(whole, 2, 12)).toBeUndefined();
    expect(restOfBand(whole, 12, 20)).toBeUndefined();
  });
});
