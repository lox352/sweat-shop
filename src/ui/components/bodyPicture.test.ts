import { describe, expect, it } from "vitest";
import paulKlee from "../../compiler/designs/paul-klee";
import hamefarin from "../../compiler/designs/hamefarin";
import { buildSweater } from "../../compiler/engine/engine";
import { isSpacer } from "../../pattern/knitted";
import { sweaters } from "../../compiler/designs";
import { worksInto } from "../../pattern/Stitch";
import { bodyRounds, frontPicture, frontScale, paintedRows } from "./bodyPicture";

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
  const { default: eachYearOnce } = await import("../../compiler/designs/wool-week-strips-once-oldest");
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
  const { default: eachYearOnce } = await import("../../compiler/designs/wool-week-strips-once-oldest");
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

describe.each(["feline-raglan", "feline-yoke"])("the front of %s", (id) => {
  const built = buildSweater(sweaters.find((sweater) => sweater.id === id)!, "xs");
  const { stitches, rounds, roundPieces } = built;
  const picture = frontPicture(built)!;
  const yokeCount = roundPieces.findIndex((piece) => piece !== roundPieces[0]);
  /** How many stitches stand side by side from a place, going one way. */
  const run = (at: Int32Array, from: number, step: 1 | -1) => {
    let length = 0;
    while (length < at.length && at[(((from + step * length) % at.length) + at.length) % at.length] >= 0) length++;
    return length;
  };

  it("runs from the yoke's first band to a little under the feline", () => {
    expect(picture.ground).toBe("A");
    expect(picture.rows.length).toBeGreaterThan(yokeCount);
    const slots = (row: (typeof picture.rows)[number]) => new Set([...row.at].filter((stitch) => stitch >= 0).map((stitch) => stitches[stitch].slot));
    expect(slots(picture.rows[0]).size).toBeGreaterThan(1);
    expect([...slots(picture.rows[picture.rows.length - 1])]).toEqual(["A"]);
  });

  it("has the middle of the front in the middle of every round", () => {
    // The yoke's rounds; the body's have the underarm's cast-on stitches on at one end.
    const first = rounds.indexOf(bodyRounds(rounds.slice(0, yokeCount), stitches)[0]);
    picture.rows.slice(0, yokeCount - first).forEach((row) => {
      const right = run(row.at, 0, 1);
      const left = run(row.at, -1, -1);
      // A round closed up all the way round has no ends to be the same distance from.
      if (right + left < row.period) expect(right).toBe(left);
    });
    // The feline, which is as far from the front's one edge as the other: its red is.
    const red = picture.rows.flatMap((row) => [...row.at].flatMap((stitch, place) => (stitch >= 0 && stitches[stitch].slot === "B" ? [place] : [])));
    const within = red.map((place) => (place > 200 ? place - picture.rows[picture.rows.length - 1].period : place)).filter((place) => Math.abs(place) < 70);
    expect(Math.abs(Math.max(...within) + Math.min(...within))).toBeLessThanOrEqual(8);
  });

  it("stands every stitch over the stitch it was worked into, but along a line", () => {
    let over = 0;
    let all = 0;
    picture.rows.forEach((row, y) => {
      const above = picture.rows[y - 1];
      if (!above || above.period !== row.period) return;
      row.at.forEach((stitch, place) => {
        if (stitch < 0) return;
        const [into] = worksInto(stitches[stitch]);
        if (into === undefined) return;
        all++;
        if (above.at[place] === into) over++;
      });
    });
    expect(over / all).toBeGreaterThan(id === "feline-raglan" ? 0.97 : 0.99);
  });

  it("leaves a raglan's panels whole, and closes a round yoke up", () => {
    const gaps = picture.rows.slice(0, 30).map((row) => [...row.at].filter((stitch, place) => stitch >= 0 && row.at[(place + 1) % row.period] < 0).length);
    // Four panels, with room between each two; or none, and each round at its own count.
    if (id === "feline-raglan") expect(new Set(gaps)).toEqual(new Set([4]));
    else {
      expect(new Set(gaps)).toEqual(new Set([0]));
      picture.rows.slice(0, 30).forEach((row, y) => expect(row.period).toBe(rounds[rounds.indexOf(bodyRounds(rounds.slice(0, yokeCount), stitches)[0]) + y].length));
    }
  });
});

it("shows only a picture down the front as a front", () => {
  expect(frontPicture(buildSweater(paulKlee, "m1"))).toBeUndefined();
  expect(frontPicture(buildSweater(hamefarin, "m"))).toBeUndefined();
});

it("shows the top of a front, a whole number of pixels a stitch", () => {
  // A phone's card, 96 pixels tall at three screen pixels each, and a desktop's, 160 at one.
  expect(frontScale(288, 154)).toBe(3);
  expect(frontScale(160, 154)).toBe(2);
  expect(frontScale(40, 154)).toBe(1);
});
