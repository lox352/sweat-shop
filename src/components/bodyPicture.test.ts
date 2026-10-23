import { describe, expect, it } from "vitest";
import paulKlee from "../data/sweaters/paul-klee";
import hamefarin from "../data/sweaters/hamefarin";
import { buildSweater, isSpacer } from "../knitting/engine";
import { bodyRounds, paintedRows } from "./bodyPicture";

describe.each([
  ["Paul Klee, M1", buildSweater(paulKlee, "m1")],
  ["Hamefarin, M", buildSweater(hamefarin, "m")],
] as const)("the picture of %s's yoke", (_, { stitches, rounds, roundPieces }) => {
  const body = bodyRounds(rounds, stitches);
  const rows = paintedRows(body, stitches);
  const pieceOf = (y: number) => roundPieces[rounds.indexOf(body[y])];
  // A round that increases on the round before it in its piece - not a sleeve begun after the other.
  const increases = (y: number) => y > 0 && pieceOf(y) === pieceOf(y - 1) && body[y].length > body[y - 1].length;

  it("paints a round that increases in line with the round it was worked into", () => {
    expect(body.some((_round, y) => increases(y))).toBe(true);
    body.forEach((_round, y) => {
      if (!increases(y)) return;
      expect(rows[y]).toHaveLength(body[y - 1].length);
      // Each stitch painted is one of the round's own, under the stitch it grew out of.
      rows[y].forEach((id, x) => {
        expect(body[y]).toContain(id);
        expect(stitches[id].links[0]).toBe(body[y - 1][x]);
      });
    });
  });

  it("paints every other round as it is", () => {
    body.forEach((round, y) => {
      if (!increases(y)) expect(rows[y]).toBe(round);
    });
  });
});

it("keeps a Paul Klee band's blocks in line to its last round, where they increase", () => {
  const { stitches, rounds, roundLabels } = buildSweater(paulKlee, "m1");
  const body = bodyRounds(rounds, stitches);
  const rows = paintedRows(body, stitches);
  const slots = (row: number[]) => row.map((id) => stitches[id].slot);
  // Each band increases inside its blocks, k1, kfb, k2, in its last round.
  const lastRows = body.flatMap((round, y) =>
    /, row 5$/.test(roundLabels[rounds.indexOf(round)]) && round.length > body[y - 1].length ? [y] : []);
  expect(lastRows.length).toBeGreaterThan(3);
  for (const y of lastRows) expect(slots(rows[y])).toEqual(slots(body[y - 1]));
});

it("paints a Wool Week band that doubles columns at its own repeat, each stitch under the one it was knitted into", async () => {
  const { default: eachYearOnce } = await import("../data/sweaters/wool-week-strips-once-oldest");
  const { stitches, rounds } = buildSweater(eachYearOnce, "m");
  const body = bodyRounds(rounds, stitches);
  const rows = paintedRows(body, stitches);
  // A doubling round: its new stitches make-ones, each a copy beside its twin.
  const doublings = body.flatMap((round, y) => (round.some((id) => stitches[id].type === "m1" && isSpacer(stitches[id])) ? [y] : []));
  expect(doublings.length).toBeGreaterThan(2);
  for (const y of doublings) {
    // The round that doubles, and the one after it, painted as wide as the band was before.
    expect(rows[y]).toHaveLength(rows[y - 1].length);
    expect(rows[y + 1]).toHaveLength(rows[y].length);
    rows[y].forEach((id, x) => expect(stitches[id].links[0]).toBe(rows[y - 1][x]));
  }
  // Only the copies are left out, and every one of them is background: knitted in the yarn of the stitch beside it.
  for (const round of body) round.forEach((id, i) => isSpacer(stitches[id]) && expect(stitches[id].slot).toBe(stitches[round[i - 1]].slot));
}, 60000);

it("paints a Wool Week band begun on more stitches on its own layout, not in line with the round before it", async () => {
  const { default: eachYearOnce } = await import("../data/sweaters/wool-week-strips-once-oldest");
  const { stitches, rounds } = buildSweater(eachYearOnce, "xs");
  const body = bodyRounds(rounds, stitches);
  const rows = paintedRows(body, stitches);
  // A patterned round that grows by make-ones spread through it, not copies beside a twin: a band's first row.
  const begun = body.flatMap((round, y) =>
    y > 0 && round.length > body[y - 1].length && new Set(round.map((id) => stitches[id].slot)).size > 1 && round.some((id) => stitches[id].type === "m1" && !isSpacer(stitches[id])) ? [y] : [],
  );
  expect(begun.length).toBeGreaterThan(1);
  // Painted as it is, every stitch of it, so it lines up with the rest of its band below it.
  for (const y of begun) {
    expect(rows[y]).toEqual(body[y].filter((id) => !isSpacer(stitches[id])));
    expect(rows[y + 1]).toHaveLength(rows[y].length);
  }
}, 60000);
