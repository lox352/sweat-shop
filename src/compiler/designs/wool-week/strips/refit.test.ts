import { describe, expect, it } from "vitest";
import { type Part, lettersOf } from "./cuts";
import { measured } from "./design";
import { budgets } from "./plan";
import { background } from "./quanta";
import { chosen, laidOut, reachAt } from "./refit";

/**
 * What Each Year Once's layout chooses for each published size: how its years
 * are shared between the yoke, the body and the sleeves, the rounds each
 * piece has, and each year's cut with its rounds of pattern. A change to the
 * planner that changes any size's pattern shows here as the cut that changed,
 * before it shows as an edition's name.
 */
const published: Record<string, { split: string; rounds: [number, number, number]; yoke: string[]; body: string[]; sleeve: string[] }> = {
  xs: {
    split: "3/5/5",
    rounds: [72, 127, 148],
    yoke: ["2014 Chart C between peeries (21)", "2015 Sheep, 7 sky and 2 field rows off (16)", "2016 Three strips (29)"],
    body: ["2017 Two bands (14)", "2018 Dancers between two plus rows (17)", "2019 Sheep and boat, a round between (24)", "2020 Both star bands (30)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors and waves (27)", "2023 Flowers, peerie below (29)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 24 (24)"],
  },
  s: {
    split: "3/5/5",
    rounds: [75, 133, 152],
    yoke: ["2014 Chart C between peeries (21)", "2015 Sheep, 5 sky and 2 field rows off (18)", "2016 Three strips (29)"],
    body: ["2017 Three bands (21)", "2018 Dancers between two plus rows (17)", "2019 Sheep and boat, a round between (24)", "2020 Both star bands (30)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors and waves (27)", "2023 Flowers, peerie below (29)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 28 (28)"],
  },
  m: {
    split: "3/5/5",
    rounds: [78, 137, 156],
    yoke: ["2014 Chart C between peeries (21)", "2015 Sheep, 3 sky rows off (22)", "2016 Three strips (29)"],
    body: ["2017 Three bands (21)", "2018 Dancers between two plus rows (17)", "2019 Sheep and boat, a round between (24)", "2020 Both star bands, peerie below (34)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors and waves (27)", "2023 Flowers, peerie below (29)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 32 (32)"],
  },
  l: {
    split: "3/5/5",
    rounds: [80, 142, 160],
    yoke: ["2014 Chart C between peeries (21)", "2015 Sheep, 3 sky and 2 field rows off (20)", "2016 Three strips with seed borders (33)"],
    body: ["2017 Three bands (21)", "2018 Dancers between two plus rows (17)", "2019 Sheep and boat, a round between (24)", "2020 As the hat (38)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors, waves and ropes (41)", "2023 Flowers (25)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 28 (28)"],
  },
  xl: {
    split: "3/5/5",
    rounds: [84, 147, 164],
    yoke: ["2014 Chart C between peeries (21)", "2015 As the hat, all the sky (25)", "2016 Three strips, seed border below (31)"],
    body: ["2017 Four bands (28)", "2018 Dancers and plusses (21)", "2019 Sheep and boat, a round between (24)", "2020 Both star bands, peerie below (34)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors, waves and ropes (41)", "2023 Flowers (25)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 32 (32)"],
  },
  "2xl": {
    split: "3/5/5",
    rounds: [87, 150, 164],
    yoke: ["2014 Both stars, peerie between (30)", "2015 Sheep, 3 sky rows off (22)", "2016 Three strips (29)"],
    body: ["2017 Four bands (28)", "2018 Dancers and plusses (21)", "2019 Sheep and boat, a round between (24)", "2020 As the hat (38)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors, waves and ropes (41)", "2023 Flowers (25)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 32 (32)"],
  },
  "3xl": {
    split: "3/5/5",
    rounds: [92, 153, 167],
    yoke: ["2014 Both stars, peerie between (30)", "2015 As the hat, all the sky (25)", "2016 Three strips, seed border below (31)"],
    body: ["2017 Three bands (21)", "2018 Dancers, plusses, dancers (31)", "2019 Sheep and boat, a round between (24)", "2020 As the hat (38)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors and waves (27)", "2023 Flowers between peeries (33)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 36 (36)"],
  },
  "4xl": {
    split: "3/5/5",
    rounds: [93, 161, 167],
    yoke: ["2014 Both stars, peerie between (30)", "2015 As the hat, all the sky (25)", "2016 Three strips, seed border below (31)"],
    body: ["2017 Four bands (28)", "2018 Dancers, plusses, dancers (31)", "2019 Sheep and boat, a round between (24)", "2020 As the hat (38)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors and waves (27)", "2023 Flowers between peeries (33)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 36 (36)"],
  },
};

describe("what Each Year Once's layout chooses", () => {
  for (const size of measured) {
    it(`for ${size.id}`, () => {
      expect(chosen(size.finished)).toEqual(published[size.id]);
    });
  }
});

/**
 * A pattern is not cut into while its year has a shorter cut that keeps it
 * whole, and 2017's zigzags and 2018's dancers and plusses always have: fewer
 * bands, each of them whole. A cut goes into a pattern where a figure runs on
 * across its edge - a stitch of the edge row touching, corners included, one
 * of the same yarn in the chart's next row, neither of them background.
 */
describe("a pattern kept whole while it can be", () => {
  const cutInto = (year: number, parts: Part[]): boolean =>
    parts.some(([chart, from, to]) => {
      const rows = lettersOf(year, chart);
      const runsOn = (inside: number, outside: number) =>
        outside >= 1 &&
        outside <= rows.length &&
        rows[inside - 1].some(
          (yarn, x) =>
            !background(year, chart, inside, x) &&
            [-1, 0, 1].some((aside) => {
              const y = (x + aside + rows[outside - 1].length) % rows[outside - 1].length;
              return rows[outside - 1][y] === yarn && !background(year, chart, outside, y);
            }),
        );
      return runsOn(from, from - 1) || runsOn(to, to + 1);
    });
  const cuts = (piece: { placed: { year: number; state: { label: string }; rounds: unknown[] }[] }) => piece.placed.map((p) => `${p.year} ${p.state.label} (${p.rounds.length})`);

  it("knows a row off each side for a cut, and fewer bands whole for none", () => {
    expect(cutInto(2017, [["A", 2, 14], ["A", 1, 6]])).toBe(true);
    expect(cutInto(2018, [["B", 6, 22]])).toBe(true);
    expect(cutInto(2017, [["A", 1, 14], ["A", 1, 7]])).toBe(false);
    expect(cutInto(2017, [["A", 1, 14]])).toBe(false);
    expect(cutInto(2018, [["B", 1, 17]])).toBe(false);
  });

  it("2017 and 2018 are never cut into, and every band begins and ends with a plain round of its own, in any size from the cast-on, however few rounds the knitter's tension leaves", () => {
    const years = Array.from({ length: 13 }, (_, i) => 2014 + i);
    for (const size of measured) {
      for (let rounds = 23; rounds <= 41; rounds += 3) {
        const g = { stitches: 3.2, rounds: rounds / 10 };
        const laid = laidOut(years, budgets(size.finished, g), reachAt(g));
        expect(laid, `${size.id} at ${rounds} rounds`).toBeDefined();
        for (const piece of [laid!.yoke, laid!.body, laid!.sleeve]) {
          for (const p of piece.placed) {
            if (p.year === 2017 || p.year === 2018) expect(cutInto(p.year, p.state.parts), `${size.id} at ${rounds} rounds: ${p.year} ${p.state.label}`).toBe(false);
          }
          // Every quantum has a plain round of its own above it and below it.
          for (const frame of piece.frames) expect(Math.min(frame.above, frame.below), `${size.id} at ${rounds} rounds: ${frame.year}'s plain rounds`).toBeGreaterThanOrEqual(1);
          // So every year's first and last rounds are plain, in its own yarn or its pattern's own plain rows.
          for (const year of new Set(piece.rows.map((row) => row.year))) {
            const own = piece.rows.filter((row) => row.year === year);
            for (const row of [own[0], own[own.length - 1]]) {
              expect("plain" in row || new Set(lettersOf(year, row.chart)[row.row - 1]).size === 1, `${size.id} at ${rounds} rounds: ${year} begins and ends plain`).toBe(true);
            }
          }
        }
      }
    }
  }, 120000);

  it("for a knitter at the end of 2015 in L, at 26 rounds to 10cm: every pattern whole, and one plain round of its own above and below every band", () => {
    // What is left there: the yoke a round over its depth, and the body and sleeves their lengths in the knitter's rounds (see fit's plan).
    const g = { stitches: 2.6, rounds: 2.6 };
    const { body, sleeve } = budgets(measured.find((size) => size.id === "l")!.finished, g);
    expect([body, sleeve]).toEqual([96, 108]);
    const laid = laidOut(Array.from({ length: 11 }, (_, i) => 2016 + i), { yoke: -1, body, sleeve }, reachAt(g))!;
    expect(cuts(laid.yoke)).toEqual([]);
    // 2017 in three bands, each whole, and 2019's sheep without their boat, not the boat without them.
    expect(cuts(laid.body)).toEqual(["2016 Two strips (19)", "2017 Three bands (21)", "2018 Dancers and plusses (21)", "2019 Sheep (12)", "2020 First stars with their peeries (17)"]);
    // The flowers whole, where they were cropped to fifteen rounds: the lattice has given up bands for them, and 2025 has a dotted strip on both sides.
    expect(cuts(laid.sleeve)).toEqual(["2021 Centre (17)", "2022 Anchors (13)", "2023 Flowers (25)", "2024 Rams (15)", "2025 Between dotted strips (19)", "2026 Three bands (12)"]);
    // Every band of the body and of the sleeves has one plain round of its own above it and one below, and no more: no round is padding.
    for (const frame of [...laid.body.frames, ...laid.sleeve.frames]) expect([frame.above, frame.below], String(frame.year)).toEqual([1, 1]);
    // Each piece is every round it was given and the one that opens it - the dividing round, and the round a sleeve is taken up in - the body less the round the yoke is over.
    expect([laid.body.rows.length, laid.sleeve.rows.length]).toEqual([96, 109]);
  });

  it("2018's dancers between two rows of plusses, which have no plain row at either end, are given one", () => {
    // XS from the cast-on at 25 rounds to 10cm has them on its body.
    const g = { stitches: 3.2, rounds: 2.5 };
    const laid = laidOut(Array.from({ length: 13 }, (_, i) => 2014 + i), budgets(measured.find((size) => size.id === "xs")!.finished, g), reachAt(g))!;
    expect(cuts(laid.body)).toContain("2018 Dancers between two plus rows (17)");
    const own = laid.body.rows.filter((row) => row.year === 2018);
    expect(own.map((row) => ("plain" in row ? "plain" : `${row.chart}${row.row}`))).toEqual(["plain", ...Array.from({ length: 17 }, (_, i) => `B${17 - i}`), "plain"]);
  });

  it("two bands of 2017 where three will not go: XS's body, with 2018's dancers between two rows of plusses, so no neighbour gives up its trimmings", () => {
    const body = (id: string) => chosen(measured.find((size) => size.id === id)!.finished).body;
    expect(body("xs").slice(0, 2)).toEqual(["2017 Two bands (14)", "2018 Dancers between two plus rows (17)"]);
    expect(body("l").slice(0, 4)).toEqual(["2017 Three bands (21)", "2018 Dancers between two plus rows (17)", "2019 Sheep and boat, a round between (24)", "2020 As the hat (38)"]);
  });
});

/**
 * Rounds go into pattern before they go between patterns: a band has one
 * plain round of its own above it and one below, and a piece's years are cut
 * so that as few rounds as can be are left over to pad them.
 */
describe("as few plain rounds as can be", () => {
  const years = Array.from({ length: 13 }, (_, i) => 2014 + i);
  const cuts = (piece: { placed: { year: number; state: { label: string }; rounds: unknown[] }[] }) => piece.placed.map((p) => `${p.year} ${p.state.label} (${p.rounds.length})`);
  const solid = (row: { year: number; plain: string } | { year: number; chart: string; row: number }) => "plain" in row || new Set(lettersOf(row.year, row.chart)[row.row - 1]).size === 1;

  it.each(measured)("in $label, every quantum of every piece has one plain round above it and one below, and none is padded", ({ finished }) => {
    const laid = laidOut(years, budgets(finished), reachAt())!;
    for (const piece of [laid.yoke, laid.body, laid.sleeve]) for (const frame of piece.frames) expect([frame.above, frame.below], String(frame.year)).toEqual([1, 1]);
  });

  it("a piece begins with one plain round and the body and sleeves end with one: a cut's own plain row, or a round beside it, never both", () => {
    for (const size of measured) {
      const laid = laidOut(years, budgets(size.finished), reachAt())!;
      for (const piece of [laid.yoke, laid.body, laid.sleeve]) {
        expect(solid(piece.rows[0]) && !solid(piece.rows[1]), `${size.id}: ${piece.years[0]} begins`).toBe(true);
      }
      for (const piece of [laid.body, laid.sleeve]) {
        expect(solid(piece.rows[piece.rows.length - 1]) && !solid(piece.rows[piece.rows.length - 2]), `${size.id}: ${piece.years[piece.years.length - 1]} ends`).toBe(true);
      }
    }
  });

  it("however few rounds a knitter's tension leaves, a band is framed alike above and below, and seldom by more than a round", () => {
    let [quanta, padded] = [0, 0];
    for (const size of measured) {
      for (let rounds = 23; rounds <= 41; rounds += 3) {
        const g = { stitches: 3.2, rounds: rounds / 10 };
        const laid = laidOut(years, budgets(size.finished, g), reachAt(g))!;
        for (const piece of [laid.yoke, laid.body, laid.sleeve]) {
          for (const frame of piece.frames) {
            expect(frame.above, `${size.id} at ${rounds} rounds: ${frame.year}`).toBe(frame.below);
            quanta++;
            if (frame.above > 1) padded++;
          }
        }
      }
    }
    // One quantum in a dozen, where rounds are left that no cut of its piece's years can take.
    expect(padded / quanta).toBeLessThan(0.1);
  }, 120000);

  it("2019 keeps its sheep where there is no room for its boat as well, and never the boat without them", () => {
    for (const size of measured) {
      for (let rounds = 23; rounds <= 29; rounds += 3) {
        const g = { stitches: 3.2, rounds: rounds / 10 };
        const laid = laidOut(years, budgets(size.finished, g), reachAt(g))!;
        const found = [laid.yoke, laid.body, laid.sleeve].flatMap(cuts).find((cut) => cut.startsWith("2019"));
        expect(found, `${size.id} at ${rounds} rounds`).toMatch(/^2019 Sheep/);
      }
    }
  }, 120000);

  it("2023's flowers are whole wherever 2026's lattice has a band left to give, and 2025's dotted strip is on both sides of its motif or neither", () => {
    for (const size of measured) {
      for (let rounds = 23; rounds <= 41; rounds += 3) {
        const g = { stitches: 3.2, rounds: rounds / 10 };
        const laid = laidOut(years, budgets(size.finished, g), reachAt(g))!;
        const all = [laid.yoke, laid.body, laid.sleeve].flatMap(cuts);
        const [flowers, lattice, strips] = [2023, 2026, 2025].map((year) => all.find((cut) => cut.startsWith(String(year)))!);
        if (/cropped/i.test(flowers)) expect(lattice, `${size.id} at ${rounds} rounds: ${flowers}`).toMatch(/Two bands|Cropped to [2468] /);
        expect(strips, `${size.id} at ${rounds} rounds`).not.toBe("2025 With the dotted strip (16)");
      }
    }
  }, 120000);
});
