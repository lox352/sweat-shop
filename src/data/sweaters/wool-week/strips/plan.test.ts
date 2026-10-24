import { describe, expect, it } from "vitest";
import { lettersOf } from "./cuts";
import { plainBetween } from "./quanta";
import { measured } from "./design";
import { type Row, planOf } from "./plan";

const years = Array.from({ length: 13 }, (_, i) => 2014 + i);
const lettersOfRow = (r: Row) => ("plain" in r ? [r.plain] : lettersOf(r.year, r.chart)[r.row - 1]);

describe("the lined-up plan, oldest at the neck", () => {
  it.each(measured)("puts every year in once, each strip about the same height, in $label", ({ id, finished }) => {
    const plan = planOf(finished, { kind: "lined", newestFirst: false }, id);
    const { yoke, body } = plan.strips;
    const thirteen = [...yoke, ...body];
    expect(thirteen.map((s) => s.year)).toEqual(years);
    // Each strip within five per cent of its piece's average, give or take the round it is rounded to.
    for (const strips of [yoke, body]) {
      const average = strips.reduce((total, s) => total + s.height, 0) / strips.length;
      for (const s of strips) expect(Math.abs(s.height - average)).toBeLessThanOrEqual(0.05 * average + 0.5);
    }
    for (const piece of ["yoke", "body", "sleeve"] as const) {
      expect(plan.rows[piece]).toHaveLength(plan.depth[piece]);
      expect(plan.strips[piece].reduce((total, s) => total + s.height, 0)).toBe(plan.depth[piece]);
    }
    // The sleeves knit the body's rounds, then carry its last year on.
    expect(plan.rows.sleeve.slice(0, plan.rows.body.length)).toEqual(plan.rows.body);
    expect(new Set(plan.rows.sleeve.slice(plan.rows.body.length).map((r) => r.year))).toEqual(new Set([body[body.length - 1].year]));
  });
});

describe("Each Year Once, refitted", () => {
  it.each(measured)("puts the years in date order, each piece as deep as its depth, in $label", ({ id, finished }) => {
    const plan = planOf(finished, { kind: "refit" }, id);
    expect(plan.strips.yoke.map((s) => s.year)).toEqual([2014, 2015, 2016]);
    expect(plan.strips.body.map((s) => s.year)).toEqual([2017, 2018, 2019, 2020, 2021]);
    expect(plan.strips.sleeve.map((s) => s.year)).toEqual([2022, 2023, 2024, 2025, 2026]);
    for (const piece of ["yoke", "body", "sleeve"] as const) {
      expect(plan.rows[piece]).toHaveLength(plan.depth[piece]);
      expect(plan.strips[piece].reduce((total, s) => total + s.height, 0)).toBe(plan.depth[piece]);
      // Every piece begins with a plain round, where its first shaping or its divide goes.
      expect("plain" in plan.rows[piece][0]).toBe(true);
    }
  });

  it.each(measured)("colours every plain round from the pattern beside it, in $label", ({ id, finished }) => {
    const plan = planOf(finished, { kind: "refit" }, id);
    for (const piece of ["yoke", "body", "sleeve"] as const) {
      const rows = plan.rows[piece];
      rows.forEach((r, i) => {
        if (!("plain" in r)) return;
        // A plain round's yarn is one its own year knits in the rows nearby: never a stripe from elsewhere.
        const near = rows.slice(Math.max(0, i - 4), i + 5).filter((x) => x.year === r.year && !("plain" in x));
        if (near.length) expect(near.some((x) => lettersOfRow(x).includes(r.plain))).toBe(true);
      });
    }
  });

  it("gives the houses a plain row at both ends, and 2014's two stars whole with a round between, in L", () => {
    const plan = planOf(measured.find((m) => m.id === "l")!.finished, { kind: "refit" }, "l");
    const houses = plan.rows.yoke.filter((r) => r.year === 2016 && !("plain" in r)) as Exclude<Row, { plain: string }>[];
    expect([houses[0].row, houses[houses.length - 1].row]).toEqual([39, 11]);
    // Every row of both stars, a plain round between them, framed alike above and below; the sheep giving up rows of sky and field for it.
    const stars = plan.rows.yoke.filter((r) => r.year === 2014).map((r) => ("plain" in r ? "plain" : `${r.chart}${r.row}`));
    expect(stars).toEqual(["plain", "plain", ...Array.from({ length: 13 }, (_, i) => `C${13 - i}`), "plain", ...Array.from({ length: 13 }, (_, i) => `B${13 - i}`), "plain", "plain"]);
    const sheep = plan.rows.yoke.filter((r) => r.year === 2015 && !("plain" in r)) as Exclude<Row, { plain: string }>[];
    expect(sheep.map((r) => r.row)).toEqual(Array.from({ length: 19 }, (_, i) => 21 - i));
  });

  it.each(measured)("frames every year alike, as many plain rounds above it as below, in $label", ({ id, finished }) => {
    const plan = planOf(finished, { kind: "refit" }, id);
    for (const piece of ["yoke", "body", "sleeve"] as const) {
      const rows = plan.rows[piece];
      for (const year of new Set(rows.map((r) => r.year))) {
        // A year's rounds, and how many at each end are plain: rounds in its yarn, or its pattern's own plain rows.
        const own = rows.filter((r) => r.year === year);
        const plain = (r: Row) => "plain" in r || new Set(lettersOfRow(r)).size === 1;
        const run = (rs: Row[]) => rs.findIndex((r) => !plain(r));
        expect(run(own), `${piece}, ${year}`).toBe(run([...own].reverse()));
      }
    }
  });
});

describe("a plain round between quanta that don't go together", () => {
  const layouts = [{ kind: "lined", newestFirst: false }, { kind: "refit" }] as const;
  it.each(layouts.flatMap((layout) => measured.map((m) => ({ ...m, layout, kind: layout.kind }))))(
    "never knits two such rows one after the other: $kind, $label",
    ({ id, finished, layout }) => {
      const plan = planOf(finished, layout, id);
      for (const piece of ["yoke", "body", "sleeve"] as const) {
        plan.rows[piece].forEach((r, i) => {
          const above = plan.rows[piece][i - 1];
          if (!above || "plain" in r || "plain" in above || above.year !== r.year) return;
          expect(plainBetween(r.year, above, r), `${piece} round ${i + 1}: ${r.year} ${above.chart}${above.row} then ${r.chart}${r.row}`).toBe(false);
        });
      }
    },
  );

  it("parts the peeries from 2014's stars, in M", () => {
    const plan = planOf(measured.find((m) => m.id === "m")!.finished, { kind: "refit" }, "m");
    const rows = plan.rows.yoke.filter((r) => r.year === 2014).map((r) => ("plain" in r ? "plain" : `${r.chart}${r.row}`));
    const at = (row: string) => rows.indexOf(row);
    expect(rows[at("A1") + 1]).toBe("plain");
    expect(rows[at("C1") + 1]).toBe("plain");
  });
});
