import { describe, expect, it } from "vitest";
import { lettersOf } from "./cuts";
import { plainBetween } from "./quanta";
import { measured } from "./design";
import { type Row, budgets, gauge, planOf, ribsAt } from "./plan";

const years = Array.from({ length: 13 }, (_, i) => 2014 + i);
const lettersOfRow = (r: Row) => ("plain" in r ? [r.plain] : lettersOf(r.year, r.chart)[r.row - 1]);

describe("the lined-up plan, oldest at the neck", () => {
  it.each(measured)("puts every year in once, each strip about the same height, in $label", ({ finished }) => {
    const plan = planOf(finished, { kind: "lined" });
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
      // Every piece begins with a plain round, as Each Year Once's do: the body's is the dividing round, the sleeve's the round it is taken up in.
      expect(new Set(lettersOfRow(plan.rows[piece][0])).size).toBe(1);
    }
    // The divide falls between two years, within two centimetres of the yoke's depth.
    expect(Math.abs(plan.depth.yoke - budgets(finished).yoke)).toBeLessThanOrEqual(8);
    // The sleeves knit the body's strips round for round, then its last year again, cut fuller: as tall as takes the sleeve to the cuff.
    const last = body[body.length - 1];
    const before = plan.rows.body.length - last.height;
    expect(plan.rows.sleeve.slice(0, before)).toEqual(plan.rows.body.slice(0, before));
    expect(new Set(plan.rows.sleeve.slice(before).map((r) => r.year))).toEqual(new Set([last.year]));
    expect(plan.rows.sleeve.length - before).toBeGreaterThan(last.height);
    expect(Math.abs(plan.depth.sleeve - 1 - budgets(finished).sleeve)).toBeLessThanOrEqual(2);
    const patterned = (rows: Row[]) => rows.filter((r) => !("plain" in r)).length;
    expect(patterned(plan.rows.sleeve.slice(before))).toBeGreaterThan(patterned(plan.rows.body.slice(before)));
  });

  it("is laid out by Each Year Once's own rules: a year in a strip is that year as a piece of its own", () => {
    const plan = planOf(measured.find((m) => m.id === "l")!.finished, { kind: "lined" });
    // 2014 in its 15 rounds: a plain round, where the first increases go, and its star between its two peeries cut to fit.
    const rows = plan.rows.yoke.filter((r) => r.year === 2014).map((r) => ("plain" in r ? `plain ${r.plain}` : `${r.chart}${r.row}`));
    expect(rows).toHaveLength(plan.strips.yoke[0].height);
    expect(rows[0]).toMatch(/^plain /);
    expect(rows.filter((r) => r.startsWith("C"))).toEqual(Array.from({ length: 13 }, (_, i) => `C${13 - i}`));
  });
});

describe("Each Year Once, refitted", () => {
  it.each(measured)("puts the years in date order, each piece as deep as its depth, in $label", ({ finished }) => {
    const plan = planOf(finished, { kind: "refit" });
    expect(plan.strips.yoke.map((s) => s.year)).toEqual([2014, 2015, 2016]);
    expect(plan.strips.body.map((s) => s.year)).toEqual([2017, 2018, 2019, 2020, 2021]);
    expect(plan.strips.sleeve.map((s) => s.year)).toEqual([2022, 2023, 2024, 2025, 2026]);
    for (const piece of ["yoke", "body", "sleeve"] as const) {
      expect(plan.rows[piece]).toHaveLength(plan.depth[piece]);
      expect(plan.strips[piece].reduce((total, s) => total + s.height, 0)).toBe(plan.depth[piece]);
      // Every piece begins with a plain round, where its first shaping or its divide goes: one beside its first band, or that band's own plain row.
      expect(new Set(lettersOfRow(plan.rows[piece][0])).size).toBe(1);
    }
  });

  it.each(measured)("frames every quantum alike, as many plain rounds above it as below, each in the background beside it, in $label", ({ finished }) => {
    const plan = planOf(finished, { kind: "refit" });
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
    const plan = planOf(measured.find((m) => m.id === "m")!.finished, { kind: "refit" });
    const rows = plan.rows.yoke.filter((r) => r.year === 2014).map((r) => ("plain" in r ? r.plain : `${r.chart}${r.row}`));
    // A round of the peerie's background above and below each peerie, and one of the star's either side of the star.
    expect(rows).toEqual(["B", "A4", "A3", "A2", "A1", "B", "A", ...Array.from({ length: 13 }, (_, i) => `C${13 - i}`), "A", "B", "A4", "A3", "A2", "A1", "B"]);
  });

  it("gives the houses their seed borders, and the sheep all but three rows of sky and two of field, each from a plain row of the hat's to another, in L", () => {
    const plan = planOf(measured.find((m) => m.id === "l")!.finished, { kind: "refit" });
    const houses = plan.rows.yoke.filter((r) => r.year === 2016 && !("plain" in r)) as Exclude<Row, { plain: string }>[];
    expect([houses[0].row, houses[houses.length - 1].row]).toEqual([41, 9]);
    const sheep = plan.rows.yoke.filter((r) => r.year === 2015 && !("plain" in r)) as Exclude<Row, { plain: string }>[];
    expect(sheep.map((r) => r.row)).toEqual(Array.from({ length: 20 }, (_, i) => 22 - i));
  });

  it("keeps 2014's two stars whole with the peerie between them, each framed in its own background, in 4XL", () => {
    const plan = planOf(measured.find((m) => m.id === "4xl")!.finished, { kind: "refit" });
    const rows = plan.rows.yoke.filter((r) => r.year === 2014).map((r) => ("plain" in r ? `plain ${r.plain}` : `${r.chart}${r.row}`));
    const down = (chart: string, from: number) => Array.from({ length: from }, (_, i) => `${chart}${from - i}`);
    // 2014's yarn A round the first star, B round the peerie, C round the second.
    expect(rows).toEqual(["plain A", ...down("C", 13), "plain A", "plain B", ...down("A", 4), "plain B", "plain C", ...down("B", 13), "plain C"]);
  });
});

describe("both layouts", () => {
  const layouts = [{ kind: "lined" }, { kind: "refit" }] as const;
  const cases = layouts.flatMap((layout) => measured.map((m) => ({ ...m, layout, kind: layout.kind })));

  it.each(cases)("colour every plain round from the pattern beside it: $kind, $label", ({ finished, layout }) => {
    const plan = planOf(finished, layout);
    for (const piece of ["yoke", "body", "sleeve"] as const) {
      const rows = plan.rows[piece];
      rows.forEach((r) => {
        if (!("plain" in r)) return;
        // A plain round's yarn is one its own year knits: never a stripe from elsewhere.
        const near = rows.filter((x) => x.year === r.year && !("plain" in x));
        if (near.length) expect(near.some((x) => lettersOfRow(x).includes(r.plain))).toBe(true);
      });
    }
  });

  it.each(cases)("frame every quantum alike, as many plain rounds above it as below: $kind, $label", ({ finished, layout }) => {
    const plan = planOf(finished, layout);
    for (const piece of ["yoke", "body", "sleeve"] as const) for (const f of plan.frames![piece]) expect(f.above, `${piece}, ${f.year}`).toBe(f.below);
  });
});

describe("a plain round between quanta that don't go together", () => {
  const layouts = [{ kind: "lined" }, { kind: "refit" }] as const;
  it.each(layouts.flatMap((layout) => measured.map((m) => ({ ...m, layout, kind: layout.kind }))))(
    "never knits two such rows one after the other: $kind, $label",
    ({ finished, layout }) => {
      const plan = planOf(finished, layout);
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
    const plan = planOf(measured.find((m) => m.id === "m")!.finished, { kind: "refit" });
    const rows = plan.rows.yoke.filter((r) => r.year === 2014).map((r) => ("plain" in r ? "plain" : `${r.chart}${r.row}`));
    const at = (row: string) => rows.indexOf(row);
    expect(rows[at("A1") + 1]).toBe("plain");
    expect(rows[at("C1") + 1]).toBe("plain");
  });
});

describe("a sampler's rounds at another tension", () => {
  const large = measured.find((m) => m.id === "l")!.finished;

  it("are the same lengths in fewer rounds where the knitting is looser, the ribs with them", () => {
    const own = budgets(large);
    const loose = budgets(large, { stitches: 2.33, rounds: 2.5 });
    expect(ribsAt(gauge)).toEqual({ neck: 9, hem: 14, cuff: 14 });
    expect(ribsAt({ stitches: 2.33, rounds: 2.5 })).toEqual({ neck: 6, hem: 9, cuff: 9 });
    // 41.5cm of body: 158 rounds at 38 to 10cm, 104 at 25, less the hem's rib and two.
    expect(own.body).toBe(158 - 14 - 2);
    expect(loose.body).toBe(104 - 9 - 2);
    expect(loose.yoke).toBeLessThan(own.yoke);
    expect(loose.sleeve).toBeLessThan(own.sleeve);
  });
});
