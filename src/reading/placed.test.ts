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
      // Every year placed takes the yarns for where it sits, which the pattern may not have listed. With fewer years, as they are now laid out, those are all yarns it lists already.
      if (option === "every") expect(woolsAdded(colourway, on).length).toBeGreaterThan(0);
      else expect(woolsAdded(colourway, on)).toEqual([]);
      expect(woolsAdded(colourway, colourway)).toEqual([]);
    });
  }

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
