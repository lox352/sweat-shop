import { describe, expect, it } from "vitest";
import paulKlee from "../../compiler/designs/paul-klee";
import hamefarin from "../../compiler/designs/hamefarin";
import { buildSweater } from "../../compiler/engine/engine";
import { isSpacer } from "../../pattern/knitted";
import { sweaters } from "../../compiler/designs";
import { worksInto } from "../../pattern/Stitch";
import { bodyRounds, cardPicture, frontPicture, frontScale, paintedRows, stitchAcross, stitchAt, yokePicture } from "./bodyPicture";

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

  /** The yoke's first patterned round, which is the picture's first row. */
  const first = rounds.indexOf(bodyRounds(rounds.slice(0, yokeCount), stitches)[0]);

  it("closes a raglan's band up to one width with nothing between its panels, and a round yoke up round by round", () => {
    const band = picture.rows.slice(0, 30);
    if (id === "feline-raglan") {
      // The first row of spirals: eleven rounds, each a stitch wider at each side of each line, drawn at the last's width.
      const spirals = picture.rows.slice(0, 11);
      expect(new Set(spirals.map((row) => row.period))).toEqual(new Set([rounds[first + 10].length]));
      expect(rounds[first + 10].length - rounds[first].length).toBe(80);
      // And no place in the band is left to the ground: each holds its round's stitch, or one lent to it.
      for (const row of band) for (let place = 0; place < row.period; place++) expect(stitchAt(row, place)).toBeGreaterThanOrEqual(0);
      expect(spirals[0].lent).toBeDefined();
      expect(spirals[10].lent).toBeUndefined();
    } else {
      // Each round at its own count, and nothing lent.
      band.forEach((row, y) => {
        expect(row.period).toBe(rounds[first + y].length);
        expect(row.lent).toBeUndefined();
        expect([...row.at].every((stitch) => stitch >= 0)).toBe(true);
      });
    }
  });

  it("runs left to right across the front, as worn", () => {
    // A round is knitted left to right as the jumper is seen from outside, so the stitches of a round come in its order across the picture.
    // Twenty stitches either side of the middle: within the front's panel in every round.
    const half = 20;
    picture.rows.slice(0, yokeCount - first).forEach((row, y) => {
      const order = Array.from({ length: 2 * half }, (_, x) => rounds[first + y].indexOf(stitchAcross(row, x, half)));
      expect(order.every((at, x) => x === 0 || at === order[x - 1] + 1)).toBe(true);
    });
  });
});

describe("a raglan's line, folded out", () => {
  const built = buildSweater(sweaters.find((sweater) => sweater.id === "feline-raglan")!, "xs");
  const { stitches, rounds, roundPieces } = built;
  const picture = frontPicture(built)!;
  const yokeCount = roundPieces.findIndex((piece) => piece !== roundPieces[0]);
  const first = rounds.indexOf(bodyRounds(rounds.slice(0, yokeCount), stitches)[0]);
  /**
   * Where the front's panel ends in a row of the first band, going right from
   * the middle, and where the sleeve's begins: the front is a stitch wider at
   * each end every round, and the band's eleventh round has no room left.
   */
  const widest = (() => {
    const { at } = picture.rows[0];
    let end = 0;
    while (at[end] >= 0) end++;
    return end;
  })();
  const frontEnds = (y: number) => ({ end: widest + y, next: widest + y + 2 * (10 - y) });

  it("fills the room beyond a panel with the stitches knitted round the corner", () => {
    // The place k beyond the front's end is knitted by the sleeve, k rounds further down and k stitches in from the line.
    for (const y of [0, 3, 7]) {
      const { end, next } = frontEnds(y);
      const { at, lent } = picture.rows[y];
      // The room is where the round has no stitch, and nowhere else.
      for (let place = end - 3; place < next + 3; place++) expect(at[place] < 0).toBe(place >= end && place < next);
      for (let k = 1; k <= (next - end) / 2; k++) {
        const below = picture.rows[y + k];
        expect(lent![end + k - 1]).toBe(below.at[frontEnds(y + k).next + k]);
        expect(rounds[first + y + k]).toContain(lent![end + k - 1]);
        // And from the sleeve's side, the front's: k stitches in from the line, k rounds down.
        expect(lent![next - k]).toBe(below.at[frontEnds(y + k).end - 1 - k]);
      }
    }
  });

  it("draws the line's own stitch wide where the line is too slow to fold, which on the feline is ground on ground", () => {
    const under = picture.rows.slice(24, yokeCount - first);
    const lent = under.flatMap((row) => (row.lent ? [...row.lent].filter((stitch) => stitch >= 0) : []));
    expect(lent.length).toBeGreaterThan(0);
    expect(new Set(lent.map((stitch) => stitches[stitch].slot))).toEqual(new Set([picture.ground]));
    // Each is a stitch of its own round: nothing is brought up from the rounds below.
    under.forEach((row, y) => row.lent?.forEach((stitch) => stitch >= 0 && expect(rounds[first + 24 + y]).toContain(stitch)));
  });

  it("is what a strip of its yoke shows too, all of it", () => {
    const strip = yokePicture(built)!;
    expect(strip.shown).toBe("all");
    expect(picture.shown).toBe("top");
    expect(strip.rows).toHaveLength(yokeCount - first);
    strip.rows.forEach((row, y) => {
      expect(row.period).toBe(picture.rows[y].period);
      expect([...row.at]).toEqual([...picture.rows[y].at]);
    });
    expect(cardPicture(built)).toBe(picture);
  });
});

it("places the yoke of a picture down the front about its middle too, though nothing in it leans", () => {
  const built = buildSweater(sweaters.find((sweater) => sweater.id === "feline-yoke")!, "xs");
  const strip = yokePicture(built)!;
  const whole = frontPicture(built)!;
  expect(strip.shown).toBe("all");
  // The front's own rows, as far as the yoke goes: every round closed up at its own count from the middle of the front.
  expect(strip.rows.length).toBeLessThan(whole.rows.length);
  strip.rows.forEach((row, y) => {
    expect(row.lent).toBeUndefined();
    expect([...row.at]).toEqual([...whole.rows[y].at]);
  });
});

it("leaves a yoke with no band that grows along lines to its strip", async () => {
  // A round yoke's bands; and Paul Klee's last, between lines that do not grow in it.
  expect(yokePicture(buildSweater(paulKlee, "m1"))).toBeUndefined();
  expect(yokePicture(buildSweater(paulKlee, "k1"))).toBeUndefined();
  expect(yokePicture(buildSweater(hamefarin, "m"))).toBeUndefined();
  for (const name of ["wool-week-strips-once-oldest", "wool-week-strips-lined-oldest"]) {
    const sweater = sweaters.find((each) => each.id === name)!;
    for (const size of [sweater.sizes[0].id, "m"]) expect(yokePicture(buildSweater(sweater, size))).toBeUndefined();
  }
}, 120000);

it("shows only a picture down the front as a front", () => {
  expect(frontPicture(buildSweater(paulKlee, "m1"))).toBeUndefined();
  expect(frontPicture(buildSweater(hamefarin, "m"))).toBeUndefined();
  expect(cardPicture(buildSweater(hamefarin, "m"))).toBeUndefined();
});

it("shows the top of a front, a whole number of pixels a stitch", () => {
  // A phone's card, 96 pixels tall at three screen pixels each, and a desktop's, 160 at one.
  expect(frontScale(288, 154)).toBe(3);
  expect(frontScale(160, 154)).toBe(2);
  expect(frontScale(40, 154)).toBe(1);
});
