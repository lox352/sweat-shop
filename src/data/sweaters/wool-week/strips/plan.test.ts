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
    // The sleeves knit the body's strips round for round, then carry its last year on, its pattern begun within a round or three of the body's:
    // the hat's sequence runs out before the cuff, and its plain rounds are shared above and below.
    const last = body[body.length - 1];
    const before = plan.rows.body.length - last.height;
    expect(plan.rows.sleeve.slice(0, before)).toEqual(plan.rows.body.slice(0, before));
    expect(new Set(plan.rows.sleeve.slice(before).map((r) => r.year))).toEqual(new Set([last.year]));
    const firstRow = (rows: Row[]) => rows.findIndex((r, i) => i >= before && !("plain" in r));
    expect(firstRow(plan.rows.sleeve) - firstRow(plan.rows.body)).toBeGreaterThanOrEqual(0);
    expect(firstRow(plan.rows.sleeve) - firstRow(plan.rows.body)).toBeLessThanOrEqual(3);
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

  it.each(measured)("frames every quantum alike, as many plain rounds above it as below, each in the background beside it, in $label", ({ id, finished }) => {
    const plan = planOf(finished, { kind: "refit" }, id);
    for (const piece of ["yoke", "body", "sleeve"] as const) {
      for (const f of plan.frames![piece]) expect(f.above, `${piece}, ${f.year}`).toBe(f.below);
      // Every plain round's yarn is knitted in the three pattern rows of its own year nearest it, on one side or the other: the background beside it.
      const rows = plan.rows[piece];
      rows.forEach((r, i) => {
        if (!("plain" in r)) return;
        const near = (step: number) => {
          const out: Row[] = [];
          for (let k = i + step; k >= 0 && k < rows.length && rows[k].year === r.year && out.length < 3; k += step) if (!("plain" in rows[k])) out.push(rows[k]);
          return out;
        };
        const sides = [near(-1), near(1)].filter((x) => x.length);
        if (sides.length) expect(sides.some((x) => x.some((y) => lettersOfRow(y).includes(r.plain))), `${piece} round ${i + 1}`).toBe(true);
      });
    }
  });

  it("frames the peeries either side of 2014's star alike, in M", () => {
    const plan = planOf(measured.find((m) => m.id === "m")!.finished, { kind: "refit" }, "m");
    const rows = plan.rows.yoke.filter((r) => r.year === 2014).map((r) => ("plain" in r ? r.plain : `${r.chart}${r.row}`));
    // A round of the peerie's background above and below each peerie, and two of the star's either side of the star.
    expect(rows).toEqual(["B", "A4", "A3", "A2", "A1", "B", "A", "A", ...Array.from({ length: 13 }, (_, i) => `C${13 - i}`), "A", "A", "B", "A4", "A3", "A2", "A1", "B"]);
  });

  it("gives the houses a plain row at both ends, and 2014's two stars whole with a round between, in L", () => {
    const plan = planOf(measured.find((m) => m.id === "l")!.finished, { kind: "refit" }, "l");
    const houses = plan.rows.yoke.filter((r) => r.year === 2016 && !("plain" in r)) as Exclude<Row, { plain: string }>[];
    expect([houses[0].row, houses[houses.length - 1].row]).toEqual([39, 11]);
    // Every row of both stars, each framed alike above and below; the sheep giving up rows of sky and field for it.
    const stars = plan.rows.yoke.filter((r) => r.year === 2014).map((r) => ("plain" in r ? "plain" : `${r.chart}${r.row}`));
    expect(stars).toEqual(["plain", ...Array.from({ length: 13 }, (_, i) => `C${13 - i}`), "plain", "plain", ...Array.from({ length: 13 }, (_, i) => `B${13 - i}`), "plain"]);
    // Each star framed in its own background: 2014's yarn A round the first, C round the second; and the sky's yarn above the sheep.
    const plains = plan.rows.yoke.filter((r) => r.year === 2014 && "plain" in r).map((r) => ("plain" in r ? r.plain : ""));
    expect(plains).toEqual(["A", "A", "C", "C"]);
    const sky = plan.rows.yoke.find((r) => r.year === 2015);
    expect(sky).toEqual({ year: 2015, plain: "D" });
    const sheep = plan.rows.yoke.filter((r) => r.year === 2015 && !("plain" in r)) as Exclude<Row, { plain: string }>[];
    expect(sheep.map((r) => r.row)).toEqual(Array.from({ length: 19 }, (_, i) => 21 - i));
  });
});

describe("both layouts", () => {
  const layouts = [{ kind: "lined", newestFirst: false }, { kind: "refit" }] as const;
  const cases = layouts.flatMap((layout) => measured.map((m) => ({ ...m, layout, kind: layout.kind })));

  it.each(cases)("colour every plain round from the pattern beside it: $kind, $label", ({ id, finished, layout }) => {
    const plan = planOf(finished, layout, id);
    for (const piece of ["yoke", "body", "sleeve"] as const) {
      const rows = plan.rows[piece];
      rows.forEach((r, i) => {
        if (!("plain" in r)) return;
        // A plain round's yarn is one its own year knits - in Thirteen Strips, in the three pattern rows nearest it either side; in Each Year
        // Once, which frames each year in one yarn above and below, anywhere: never a stripe from elsewhere.
        const patterned = (rs: Row[]) => rs.filter((x) => x.year === r.year && !("plain" in x));
        const near = layout.kind === "refit" ? patterned(rows) : [...patterned(rows.slice(0, i)).slice(-3), ...patterned(rows.slice(i + 1)).slice(0, 3)];
        if (near.length) expect(near.some((x) => lettersOfRow(x).includes(r.plain))).toBe(true);
      });
    }
  });

  // Each Year Once frames each quantum alike rather than each year (see above).
  it.each(cases.filter((c) => c.kind === "lined"))("frame every year alike, as many plain rounds above it as below: $kind, $label", ({ id, finished, layout }) => {
    const plan = planOf(finished, layout, id);
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
