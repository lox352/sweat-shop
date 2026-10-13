import { describe, expect, it } from "vitest";
import { buildSweater } from "./engine";
import { testSweater } from "./test-sweater";
import {
  currentRun,
  endOfRound,
  indexRounds,
  positionOf,
  runInstruction,
  totals,
  upcomingRuns,
} from "./progress";

const { stitches, rounds, roundLabels, roundPieces } = buildSweater(testSweater, "one");
const index = indexRounds(rounds, roundLabels, roundPieces, testSweater.pieces);
const firstOf = (round: number) => rounds[round - 1][0];
const lastOf = (round: number) => rounds[round - 1][rounds[round - 1].length - 1];

describe("the pieces", () => {
  it("knows which rounds each piece takes up, and calls it by its name", () => {
    expect(index.pieces).toEqual([
      { id: "yoke", label: "Yoke", first: 1, last: 6 },
      { id: "body", label: "Body", first: 7, last: 11 },
      { id: "sleeve-left", label: "Left sleeve", first: 12, last: 15 },
      { id: "sleeve-right", label: "Right sleeve", first: 16, last: 19 },
    ]);
  });
});

describe("what to work next", () => {
  it("says to cast on the cast-on round, then stops to join it", () => {
    const run = currentRun(stitches, 0, index)!;
    expect(runInstruction(run)).toBe("Cast on 24");
    expect(positionOf(stitches, lastOf(1), index)).toMatchObject({
      round: 1,
      joinNext: "castOn",
      piece: { id: "yoke" },
    });
    expect(currentRun(stitches, lastOf(1), index)).toBeUndefined();
  });

  it("stops a run where the stitch changes, not only where the yarn does", () => {
    const runs = upcomingRuns(stitches, firstOf(2) - 1, index, 4);
    expect(runs.map(runInstruction)).toEqual(["Knit 2", "Purl 2", "Knit 2", "Purl 2"]);
    expect(runs.map((run) => run.slot)).toEqual(["B", "A", "B", "A"]);
  });

  it("stops for the change of needles between the rib and the yoke", () => {
    expect(positionOf(stitches, lastOf(3), index)).toMatchObject({ round: 3, needlesNext: 3.25 });
  });

  it("knits into the dividing round, then stops to put the left sleeve on hold", () => {
    const divide = rounds[6];
    expect(runInstruction(currentRun(stitches, divide[0] - 1, index)!)).toBe("Knit 8");
    const position = positionOf(stitches, divide[7], index);
    expect(position).toMatchObject({
      round: 7,
      stitchInRound: 8,
      piece: { id: "body" },
      pieceRound: 1,
      holdNext: { holder: "sleeve-left", count: 8 },
    });
    // The end of the round is no further than the step.
    expect(endOfRound(divide[0] - 1, index, stitches)).toBe(divide[7]);
    // And straight after the step, the underarm.
    expect(runInstruction(currentRun(stitches, divide[7] + 1, index)!)).toBe("Cast on 4");
  });

  it("binds off the body, then takes up the left sleeve's held stitches", () => {
    expect(runInstruction(currentRun(stitches, firstOf(11) - 1, index)!)).toBe("Bind off 40");
    expect(positionOf(stitches, lastOf(11), index)).toMatchObject({
      round: 12,
      stitchInRound: 0,
      piece: { id: "sleeve-left", label: "Left sleeve" },
      pieceRound: 1,
      resumeNext: { holder: "sleeve-left", count: 8 },
    });
  });

  it("picks up the sleeve's underarm, knits its held stitches, and decreases", () => {
    const runs = upcomingRuns(stitches, firstOf(12) - 1, index, 3);
    expect(runs.map(runInstruction)).toEqual(["Pick up and knit 2", "Knit 8", "Pick up and knit 2"]);
    const decreases = upcomingRuns(stitches, firstOf(14) - 1, index, 5).map(runInstruction);
    expect(decreases).toEqual(["Knit 1", "K2tog", "Knit 6", "Ssk", "Knit 1"]);
  });

  it("counts every stitch once, and is finished after the last bind-off", () => {
    const last = stitches[stitches.length - 1].id;
    expect(totals(index, last)).toMatchObject({ worked: index.worked.length, percent: 100 });
    expect(positionOf(stitches, last, index).finished).toBe(true);
    expect(index.worked.length).toBe(rounds.flat().length);
  });
});
