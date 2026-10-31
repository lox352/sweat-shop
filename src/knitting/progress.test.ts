import { describe, expect, it } from "vitest";
import { buildSweater } from "./engine";
import { testSweater, testSweaterWithShortRows } from "./test-sweater";
import hamefarin from "../data/sweaters/hamefarin";
import { sweaters } from "../data/sweaters";
import { countedAt, sweaterStitches } from "./useSweater";
import {
  currentRun,
  endOfRound,
  indexRounds,
  positionOf,
  roundNames,
  roundParts,
  roundWhats,
  runInstruction,
  totals,
  upcomingRuns,
  whereYouAre,
} from "./progress";

const { stitches, rounds, roundLabels, roundPieces } = buildSweater(testSweater, "one");
const index = indexRounds(rounds, roundLabels, roundPieces, testSweater.pieces);
const firstOf = (round: number) => rounds[round - 1][0];
const lastOf = (round: number) => rounds[round - 1][rounds[round - 1].length - 1];

describe("the pieces", () => {
  it("knows which rounds each piece takes up, which row of the chart it ends in, and calls it by its name", () => {
    expect(index.pieces).toEqual([
      { id: "yoke", label: "Yoke", first: 1, last: 6, lastRow: 6 },
      { id: "body", label: "Body", first: 7, last: 11, lastRow: 11 },
      { id: "sleeve-left", label: "Left sleeve", first: 12, last: 15, lastRow: 10 },
      { id: "sleeve-right", label: "Right sleeve", first: 16, last: 19, lastRow: 10 },
    ]);
  });
});

describe("what each round is called", () => {
  const names = roundNames(index);
  const whats = roundWhats(index);

  it("by its piece and its row of the chart, counted on from the neck, and beside that, what the pattern calls it", () => {
    // The yoke is six rounds; the body and each sleeve carry on from its last, side by side.
    expect([names[6], whats[6]]).toEqual(["Body, round 7", "dividing round"]);
    expect([names[7], whats[7]]).toEqual(["Body, round 8", "plain round"]);
    expect([names[4], whats[4]]).toEqual(["Yoke, round 5", "Band, row 1"]);
    expect([names[11], whats[11]]).toEqual(["Left sleeve, round 7", "pick-up round"]);
    expect([names[13], whats[13]]).toEqual(["Left sleeve, round 9", "shaping round"]);
  });

  it("is never numbered a second time, against its name, in any size of Hamefarin", () => {
    for (const size of hamefarin.sizes) {
      const knitting = buildSweater(hamefarin, size.id);
      const sizeIndex = indexRounds(knitting.rounds, knitting.roundLabels, knitting.roundPieces, hamefarin.pieces, knitting.roundKinds);
      expect(roundWhats(sizeIndex).filter((what) => /\bround \d/.test(what))).toEqual([]);
    }
  });

  it("is all in the name, for a short row", () => {
    const built = buildSweater(testSweaterWithShortRows(), "one");
    const rowsIndex = indexRounds(built.rounds, built.roundLabels, built.roundPieces, testSweater.pieces, built.roundKinds);
    expect(roundNames(rowsIndex)[3]).toBe("Yoke, short row 1, right side");
    expect(roundWhats(rowsIndex)[3]).toBe("");
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

  it("knits into the dividing round, then stops to put the right sleeve on hold", () => {
    const divide = rounds[6];
    expect(runInstruction(currentRun(stitches, divide[0] - 1, index)!)).toBe("Knit 8");
    const position = positionOf(stitches, divide[7], index);
    expect(position).toMatchObject({
      round: 7,
      stitchInRound: 8,
      piece: { id: "body", lastRow: 11 },
      row: 7,
      holdNext: { holder: "sleeve-right", count: 8 },
    });
    // The end of the round is no further than the step.
    expect(endOfRound(divide[0] - 1, index, stitches)).toBe(divide[7]);
    // And straight after the step, the underarm.
    expect(runInstruction(currentRun(stitches, divide[7] + 1, index)!)).toBe("Cast on 4");
  });

  it("writes the dividing round out whole, its sleeves going on hold in their places", () => {
    const parts = roundParts(stitches, rounds[6], index).map((part) =>
      "run" in part ? runInstruction(part.run) : `${part.step.type} ${part.step.holder}`,
    );
    expect(parts).toEqual([
      "Knit 8", "hold sleeve-right", "Cast on 4", "Knit 16", "hold sleeve-left", "Cast on 4", "Knit 8",
    ]);
  });

  it("binds off the body, then takes up the left sleeve's held stitches", () => {
    expect(runInstruction(currentRun(stitches, firstOf(11) - 1, index)!)).toBe("Bind off 40");
    expect(positionOf(stitches, lastOf(11), index)).toMatchObject({
      round: 12,
      stitchInRound: 0,
      piece: { id: "sleeve-left", label: "Left sleeve" },
      row: 7,
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

describe("short rows", () => {
  const built = buildSweater(testSweaterWithShortRows(), "one");
  const rowsIndex = indexRounds(built.rounds, built.roundLabels, built.roundPieces, testSweater.pieces, built.roundKinds);
  const row = (n: number) => built.rounds[2 + n];
  const last = (ids: number[]) => ids[ids.length - 1];

  it("stops at the end of each row to turn, and says which side comes next", () => {
    const position = positionOf(built.stitches, last(row(1)), rowsIndex);
    expect(position.turnNext).toEqual({ side: "wrong" });
    expect(whereYouAre(position)).toBe("Yoke, short row 1, right side");
    expect(endOfRound(row(1)[0] - 1, rowsIndex, built.stitches)).toBe(last(row(1)));
  });

  it("purls back from the wrong side, where knits become purls", () => {
    const run = currentRun(built.stitches, row(2)[0] - 1, rowsIndex)!;
    expect(runInstruction(run)).toBe("Purl 7");
    const position = positionOf(built.stitches, row(2)[0] - 1, rowsIndex);
    expect(whereYouAre(position)).toBe("Yoke, short row 2, wrong side");
    expect(position.kind).toBe("wrong");
  });

  it("knits on from the last turn to the end of the round without turning again", () => {
    const position = positionOf(built.stitches, last(row(5)), rowsIndex);
    expect(position.turnNext).toBeUndefined();
    expect(runInstruction(currentRun(built.stitches, row(5)[0] - 1, rowsIndex)!)).toBe("Knit 5");
  });
});

describe("a run up to a marker", () => {
  // Each Year Once in an L, its third short row: 55 stitches, the start of the round passed after 23.
  const design = sweaters.find((one) => one.id === "wool-week-strips-once-oldest")!;
  const built = sweaterStitches(design, "l");
  const { index } = countedAt(design, built, 0);
  const row = built.knitting.rounds.filter((_, k) => built.knitting.roundKinds[k] === "right" || built.knitting.roundKinds[k] === "wrong")[2];

  it("stops at it, says which it is, and goes on from it", () => {
    const [first, then] = upcomingRuns(built.stitches, row[0] - 1, index, 2);
    expect(first.length).toBe(23);
    expect(first.marker).toBe("the start of the round");
    expect(then.length).toBe(32);
    expect(then.marker).toBeUndefined();
    expect(then.endId).toBe(row[row.length - 1]);
  });

  it("stops there however far along the run is begun", () => {
    const run = currentRun(built.stitches, row[10], index)!;
    expect(run.length).toBe(12);
    expect(run.marker).toBe("the start of the round");
  });

  it("runs on past a marker with nothing to stop it where the index knows of none", () => {
    const bare = indexRounds(built.knitting.rounds);
    expect(currentRun(built.stitches, row[0] - 1, bare)!.length).toBe(55);
  });
});
