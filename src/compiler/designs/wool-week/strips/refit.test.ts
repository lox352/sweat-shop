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
    rounds: [72, 126, 147],
    yoke: ["2014 Chart C between peeries (21)", "2015 Sheep, 8 sky and 4 field rows off (13)", "2016 Three strips (29)"],
    body: ["2017 Two bands (14)", "2018 Dancers and plusses (21)", "2019 Sheep and boat, a round between (24)", "2020 Both star bands (30)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors and waves (27)", "2023 Flowers (25)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 28 (28)"],
  },
  s: {
    split: "3/5/5",
    rounds: [75, 132, 151],
    yoke: ["2014 Chart C between peeries (21)", "2015 Sheep, 6 sky and 3 field rows off (16)", "2016 Three strips (29)"],
    body: ["2017 Three bands (21)", "2018 Dancers and plusses, plain edges off (19)", "2019 Sheep and boat, a round between (24)", "2020 Both star bands (30)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors and waves (27)", "2023 Flowers (25)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 28 (28)"],
  },
  m: {
    split: "3/5/5",
    rounds: [78, 136, 155],
    yoke: ["2014 Chart C between peeries (21)", "2015 Sheep, 4 sky and 2 field rows off (19)", "2016 Three strips (29)"],
    body: ["2017 Three bands (21)", "2018 Dancers and plusses (21)", "2019 Sheep and boat, a round between (24)", "2020 Both star bands (30)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors and waves (27)", "2023 Flowers (25)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 32 (32)"],
  },
  l: {
    split: "3/5/5",
    rounds: [80, 141, 159],
    yoke: ["2014 Chart C between peeries (21)", "2015 Sheep, 2 sky and 1 field rows off (22)", "2016 Three strips (29)"],
    body: ["2017 Three bands (21)", "2018 Dancers and plusses (21)", "2019 Sheep and boat, a round between (24)", "2020 As the hat (38)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors and waves (27)", "2023 Flowers between peeries (33)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 28 (28)"],
  },
  xl: {
    split: "3/5/5",
    rounds: [84, 146, 163],
    yoke: ["2014 Chart C between peeries (21)", "2015 As the hat, all the sky (25)", "2016 Three strips (29)"],
    body: ["2017 Three bands (21)", "2018 Dancers and plusses (21)", "2019 Sheep and boat, a round between (24)", "2020 As the hat (38)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors and waves (27)", "2023 Flowers between peeries (33)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 32 (32)"],
  },
  "2xl": {
    split: "3/5/5",
    rounds: [87, 149, 163],
    yoke: ["2014 Chart C between peeries (21)", "2015 As the hat, all the sky (25)", "2016 Three strips with seed borders (33)"],
    body: ["2017 Four bands (28)", "2018 Dancers and plusses (21)", "2019 Sheep and boat, a round between (24)", "2020 As the hat (38)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors and waves (27)", "2023 Flowers between peeries (33)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 32 (32)"],
  },
  "3xl": {
    split: "3/5/5",
    rounds: [90, 155, 166],
    yoke: ["2014 Chart C between peeries (21)", "2015 As the hat, all the sky (25)", "2016 Three strips with seed borders (33)"],
    body: ["2017 Three bands (21)", "2018 Dancers, plusses, dancers (31)", "2019 Sheep and boat, a round between (24)", "2020 As the hat (38)", "2021 With its borders (31)"],
    sleeve: ["2022 Anchors and waves (27)", "2023 Flowers between peeries (33)", "2024 Rams between zigzags (29)", "2025 Twice, dotted strip between (29)", "2026 Cropped to 36 (36)"],
  },
  "4xl": {
    split: "3/5/5",
    rounds: [94, 158, 166],
    yoke: ["2014 Both stars, peerie between (30)", "2015 As the hat, all the sky (25)", "2016 Three strips with seed borders (33)"],
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
    expect(cutInto(2018, [["B", 5, 23]])).toBe(false);
    expect(cutInto(2018, [["B", 1, 17]])).toBe(false);
  });

  it("2017 and 2018 are never cut into, in any size from the cast-on, however few rounds the knitter's tension leaves", () => {
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
        }
      }
    }
  }, 120000);

  it("for a knitter at the end of 2015 in L, at 26 rounds to 10cm: three bands of 2017 whole, where a row came off each side", () => {
    // What is left there: the yoke a round over its depth, and the body and sleeves their lengths in the knitter's rounds (see fit's plan).
    const g = { stitches: 2.6, rounds: 2.6 };
    const { body, sleeve } = budgets(measured.find((size) => size.id === "l")!.finished, g);
    expect([body, sleeve]).toEqual([96, 108]);
    const laid = laidOut(Array.from({ length: 11 }, (_, i) => 2016 + i), { yoke: -1, body, sleeve }, reachAt(g))!;
    expect(cuts(laid.yoke)).toEqual([]);
    expect(cuts(laid.body)).toEqual(["2016 Two strips (19)", "2017 Three bands (21)", "2018 Dancers between two plus rows (17)", "2019 Sheep (12)", "2020 First stars with their peeries (17)"]);
    expect(cuts(laid.sleeve)).toEqual(["2021 Centre with one-colour rounds (21)", "2022 Anchors (13)", "2023 Flowers, cropped to 15 (15)", "2024 Rams (15)", "2025 With the dotted strip (16)", "2026 Cropped to 22 (22)"]);
  });

  it("two bands of 2017 where three will not go, and only where they will not however the piece is framed", () => {
    // XS's body has no room for three: two, and 2018's dancers and plusses whole beside them.
    expect(chosen(measured.find((size) => size.id === "xs")!.finished).body.slice(0, 2)).toEqual(["2017 Two bands (14)", "2018 Dancers and plusses (21)"]);
    // S's has, with the round between 2019's boat and sheep framing both.
    expect(chosen(measured.find((size) => size.id === "s")!.finished).body.slice(0, 2)).toEqual(["2017 Three bands (21)", "2018 Dancers and plusses, plain edges off (19)"]);
  });
});
