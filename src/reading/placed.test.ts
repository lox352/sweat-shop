import { describe, expect, it } from "vitest";
import { sweaterById } from "../compiler/designs";
import { buildSweater } from "../compiler/engine/engine";
import { cutAfter, fit } from "../compiler/fit";
import type { Colourway } from "../pattern/design";
import { lit, placed, woolsAdded } from "./palette";

const once = "wool-week-strips-once-oldest";
const pattern = sweaterById(once)!;
const colourway = pattern.colourways.find((one) => one.id === "night-gentle-dark")!;
const steps = pattern.steps!["night-gentle-dark"];
const whole = buildSweater(pattern, "l");
const loose = { stitchesPer10cm: 23.3, roundsPer10cm: 25 };
const yarnOf = (on: Colourway, slot: string) => on.shades.find((shade) => shade.slot === slot)!.code;

describe("a colourway that steps down the sweater, placed on one laid out for one knitter", () => {
  it("says it steps, and has its yarns by place for every year", () => {
    expect(colourway.stepped).toBe(true);
    expect(pattern.colourways.find((one) => one.id === "naturals-dark")!.stepped).toBeUndefined();
    expect(Object.keys(steps.bands)).toHaveLength(13);
    expect(steps.at[0]).toBe(0);
    expect(steps.at[steps.at.length - 1]).toBe(1);
  });

  for (const option of ["every", "fewer"]) {
    it(`${option}: the planner says where each year planned afresh sits, a body year and the sleeve year level with it at one place`, () => {
      const round = cutAfter(once, whole, 60)!;
      const fitted = fit({ design: once, sizeId: "l", knitted: whole, round, tension: loose, option });
      const { places, trims } = fitted.placement!;
      // The years knitted, 2014 and 2015, are not placed again.
      expect(Object.keys(places).sort()[0]).toBe("2016");
      const years = Object.keys(places).map(Number).sort();
      const sleeveFrom = years.find((year, at) => at > 0 && places[year] < places[years[at - 1]])!;
      const body = years.filter((year) => year < sleeveFrom);
      const sleeve = years.filter((year) => year >= sleeveFrom);
      // Each piece goes down from the underarm to its edge, in order.
      for (const piece of [body, sleeve]) expect(piece.map((year) => places[year])).toEqual([...piece.map((year) => places[year])].sort((a, b) => a - b));
      expect(places[body[0]]).toBeGreaterThan(0.25);
      expect(Math.abs(places[body[0]] - places[sleeve[0]])).toBeLessThan(0.08);
      expect(places[body[body.length - 1]]).toBeGreaterThan(0.85);
      expect(places[sleeve[sleeve.length - 1]]).toBeGreaterThan(0.85);
      // The waist and wrists are ribbed beside the last years of each.
      expect(Object.values(trims!)).toEqual([[String(body[body.length - 1]), String(sleeve[sleeve.length - 1])]]);

      const on = placed(colourway, steps, fitted.placement!);
      // What is knitted keeps its wool.
      for (const slot of ["14A", "15D", "15B"]) expect(yarnOf(on, slot)).toBe(yarnOf(colourway, slot));
      // The last year of the body and the last of the sleeves are at the journey's end together: the yarns the published last years have.
      const end = (year: number) => steps.bands[year].slots.map((slots) => yarnOf(on, slots[0])).sort();
      const journeysEnd = steps.bands[2026].wools.map((wools) => steps.wools[wools[wools.length - 1]].code);
      expect(new Set([...end(body[body.length - 1]), ...end(sleeve[sleeve.length - 1])]).size).toBeLessThanOrEqual(new Set(journeysEnd).size + 6);
      // And the trim is one of the yarns of the years it is beside.
      const trim = Object.keys(trims!)[0];
      expect([...end(body[body.length - 1]), ...end(sleeve[sleeve.length - 1])]).toContain(yarnOf(on, trim));
      // Every shaded variant of a slot goes with it.
      expect(yarnOf(on, "16E/g0")).toBe(yarnOf(on, "16E"));
      // Every year placed takes the yarns for where it sits, which the pattern may not have listed. With fewer years, as they are now laid out, those are nearly all yarns it lists already.
      if (option === "every") expect(woolsAdded(colourway, on).length).toBeGreaterThan(0);
      else expect(woolsAdded(colourway, on).length).toBeLessThanOrEqual(2);
      expect(woolsAdded(colourway, colourway)).toEqual([]);
    });
  }

  /*
   * The underarm is one place in the journey whatever a knitter's yoke and
   * body come to: where the pattern has it for the size. Two years knitted
   * at the pattern's tension and the rest at a looser one is a yoke of two
   * years over a body of five, its underarm a smaller share of its rounds
   * than the pattern's is - and its body still begins the journey where the
   * pattern's body does, in the purples, not sixteen rounds short of them.
   */
  it("the body begins the journey where the pattern's body begins it, however deep the yoke is beside it", () => {
    const own = { stitchesPer10cm: 32, roundsPer10cm: 38 };
    const fresh = fit({ design: once, sizeId: "l", tension: own }).placement!.places;
    const round = cutAfter(once, whole, 60)!;
    const underarm = (fresh[2016] + fresh[2017]) / 2;
    expect(underarm).toBeGreaterThan(0.33);
    expect(underarm).toBeLessThan(0.39);
    for (const tension of [{ stitchesPer10cm: 27, roundsPer10cm: 27 }, loose, { stitchesPer10cm: 30, roundsPer10cm: 33 }]) {
      const fitted = fit({ design: once, sizeId: "l", knitted: whole, round, tension, option: "every" });
      const { places } = fitted.placement!;
      const { knitted } = fitted;
      // The years of a piece, by the yarns its rounds are knitted in.
      const yearsOf = (piece: string) =>
        [...new Set(knitted.rounds.flatMap((ids, r) => (knitted.roundPieces[r] === piece && r >= round ? ids.map((id) => /^(\d\d)[A-Z]/.exec(knitted.stitches[id].slot)?.[1]) : [])))]
          .flatMap((two) => (two ? [2000 + Number(two)] : []))
          .filter((year) => String(year) in places)
          .sort();
      const [yoke, body, sleeve] = [yearsOf("yoke"), yearsOf("body"), yearsOf("sleeve-left")];
      expect(body.length).toBeGreaterThan(1);
      expect(sleeve.length).toBeGreaterThan(1);
      // A year still to go round the yoke is above the pattern's underarm; every band of the body and the sleeves below it, the first of each just below.
      for (const year of yoke) expect(places[year]).toBeLessThan(underarm);
      for (const year of [...body, ...sleeve]) expect(places[year]).toBeGreaterThan(underarm);
      for (const first of [body[0], sleeve[0]]) expect(places[first]).toBeLessThan(underarm + 0.12);
      // And the body's first band, 2016 here, is knitted in what the pattern's first body band is: past the blues.
      if (tension.roundsPer10cm === 27) {
        expect(places[2016]).toBeGreaterThan(fresh[2017] - 0.01);
        const on = placed(colourway, steps, fitted.placement!);
        const blues = new Set(["655", "660", "134"]);
        const yarns = steps.bands[2016].slots.map((slots) => yarnOf(on, slots[0]));
        expect(yarns.filter((code) => blues.has(code!))).toEqual([]);
        expect(yarns).toContain("617");
      }
    }
  }, 600000);

  it("a year still to be knitted round the yoke shares the way to the underarm with the years knitted", () => {
    const first = cutAfter(once, whole, 1)!;
    const fresh = fit({ design: once, sizeId: "l", tension: { stitchesPer10cm: 32, roundsPer10cm: 38 } }).placement!.places;
    const { places } = fit({ design: once, sizeId: "l", knitted: whole, round: first, tension: { stitchesPer10cm: 34, roundsPer10cm: 42 }, option: "every" }).placement!;
    const underarm = (fresh[2016] + fresh[2017]) / 2;
    // 2015 and 2016 still go round the yoke at this tension, above the underarm; 2017 begins the body below it.
    expect(places[2015]).toBeLessThan(places[2016]);
    expect(places[2016]).toBeLessThan(underarm);
    expect(places[2017]).toBeGreaterThan(underarm);
  }, 600000);

  it("a pattern from the cast-on at its own tension has its years where they were", () => {
    const { places } = fit({ design: once, sizeId: "l", tension: { stitchesPer10cm: 32, roundsPer10cm: 38 } }).placement!;
    const round3 = (n: number) => Math.round(n * 1000) / 1000;
    expect(Object.fromEntries(Object.entries(places).map(([year, place]) => [year, round3(place)]))).toEqual({
      2014: 0.061, 2015: 0.167, 2016: 0.287, 2017: 0.414, 2018: 0.509, 2019: 0.615, 2020: 0.765, 2021: 0.925,
      2022: 0.444, 2023: 0.579, 2024: 0.695, 2025: 0.819, 2026: 0.94,
    });
  }, 600000);

  it("placed where the design has its years, a year has the yarns the design gives it, near enough", () => {
    const published = { 2017: 0.421, 2018: 0.528, 2019: 0.64, 2020: 0.773, 2021: 0.921, 2022: 0.422, 2023: 0.538, 2024: 0.662, 2025: 0.794, 2026: 0.928 };
    const on = placed(colourway, steps, { places: Object.fromEntries(Object.entries(published).map(([year, place]) => [year, place])) });
    const slots = Object.keys(published).flatMap((year) => steps.bands[year].slots.map((own) => own[0]));
    const same = slots.filter((slot) => yarnOf(on, slot) === yarnOf(colourway, slot)).length;
    // The table is worked out at forty places, so a year between two of them may take its neighbour's yarn for one of its letters.
    expect(same / slots.length).toBeGreaterThan(0.9);
  });
});

describe("a ball lit", () => {
  it("leaves its own yarns as they are and draws every other most of the way back to the paper", () => {
    const palette = { A: { name: "Black", hex: "#000000", approximate: false }, B: { name: "Red", hex: "#ff0000", approximate: false } };
    const shown = lit(palette, ["A"]);
    expect(shown.A).toBe(palette.A);
    expect(shown.B).toEqual({ ...palette.B, hex: "#f0a6a4" });
  });
});
