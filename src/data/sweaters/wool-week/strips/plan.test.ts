import { describe, expect, it } from "vitest";
import { measured } from "./design";
import { type Layout, planOf } from "./plan";

const years = Array.from({ length: 13 }, (_, i) => 2014 + i);
const layouts: Layout[] = [
  { kind: "lined", newestFirst: true },
  { kind: "lined", newestFirst: false },
  { kind: "once", order: "oldest" },
  { kind: "once", order: "newest" },
  { kind: "once", order: "easiest" },
];

describe.each(layouts)("the strip plan, $kind $newestFirst$order", (layout) => {
  it.each(measured)("puts every year in once, each strip about the same height, in $label", ({ finished }) => {
    const plan = planOf(finished, layout);
    const { yoke, body, sleeve } = plan.strips;
    // The thirteen strips: down the yoke and body when the sleeves line up with it, down all three when they don't.
    const thirteen = layout.kind === "lined" ? [...yoke, ...body] : [...yoke, ...body, ...sleeve];
    const order = thirteen.map((s) => s.year);
    expect([...order].sort()).toEqual(years);
    if (layout.kind === "lined") expect(order).toEqual(layout.newestFirst ? [...years].reverse() : years);
    if (layout.kind === "once" && layout.order !== "easiest") {
      expect(order).toEqual(layout.order === "newest" ? [...years].reverse() : years);
    }
    // Each strip within five per cent of its piece's average, give or take the round it is rounded to.
    for (const strips of [yoke, body, ...(layout.kind === "once" ? [sleeve] : [])]) {
      const average = strips.reduce((total, s) => total + s.height, 0) / strips.length;
      for (const s of strips) expect(Math.abs(s.height - average)).toBeLessThanOrEqual(0.05 * average + 0.5);
    }
    /*
     * And the pieces' averages near enough each other's that no year has much
     * more than another: the strips are fifteen rounds or so in a small size,
     * so a round or two either way is a good part of it, and a sleeve is longer
     * than a yoke can be made deep.
     */
    const average = thirteen.reduce((total, s) => total + s.height, 0) / 13;
    for (const s of thirteen) expect(Math.abs(s.height / average - 1)).toBeLessThan(0.2);
    // Every piece's rounds are its strips', and as deep as the piece.
    for (const piece of ["yoke", "body", "sleeve"] as const) {
      expect(plan.rows[piece]).toHaveLength(plan.depth[piece]);
      expect(plan.strips[piece].reduce((total, s) => total + s.height, 0)).toBe(plan.depth[piece]);
    }
    // Lined up: the sleeves knit the body's rounds, then carry its last year on.
    if (layout.kind === "lined") {
      expect(plan.rows.sleeve.slice(0, plan.rows.body.length)).toEqual(plan.rows.body);
      expect(new Set(plan.rows.sleeve.slice(plan.rows.body.length).map((r) => r.year))).toEqual(new Set([body[body.length - 1].year]));
    }
  });
});
