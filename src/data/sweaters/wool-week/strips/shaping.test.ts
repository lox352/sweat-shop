import { describe, expect, it } from "vitest";
import { measured } from "./design";
import { gauge, planOf, type Layout } from "./plan";
import { growing, mapOf, type Step, unitsOf } from "./shaping";

const nearest = (v: number, m: number) => Math.max(m, Math.round(v / m) * m);

/** A size's yoke as knit shapes it: its rounds, their target, and the steps the search takes. */
const yokeOf = (finished: (typeof measured)[number]["finished"], layout: Layout, id: string) => {
  const plan = planOf(finished, layout, id);
  const rows = plan.rows.yoke;
  const neck = nearest(finished.neckCm * gauge.stitches, 4);
  const body = nearest(finished.chestCm * gauge.stitches, 4);
  const underarm = Math.min(24, Math.max(8, nearest(body * 0.04, 2)));
  const upperArm = nearest(finished.upperArmCm * gauge.stitches, 2);
  const total = body - 2 * underarm + 2 * (upperArm - underarm);
  const first = Math.round(neck * 1.25);
  const want = (i: number) => first + (total - first) * Math.min(1, (i + 4) / rows.length);
  const end = nearest(total, 4);
  return { rows, neck, end, want, steps: growing(rows, { from: neck, to: end, want }) };
};

/** How many of each column a round's repeat has. */
const copies = (s: Step) => {
  const n = new Map<number, number>();
  for (const x of s.map ?? []) n.set(x, (n.get(x) ?? 0) + 1);
  return n;
};

const cases = (["refit", "lined"] as const).flatMap((kind) =>
  measured.map((m) => ({ ...m, kind, layout: (kind === "refit" ? { kind } : { kind, newestFirst: false }) as Layout })),
);

describe("a yoke grown by its quanta", () => {
  it.each(cases)("never doubles a column with foreground below it in its quantum: $kind, $label", ({ id, finished, layout }) => {
    const { rows, steps } = yokeOf(finished, layout, id);
    for (const u of unitsOf(rows)) {
      if (u.solid) continue;
      u.rows.forEach((i, p) => {
        const now = copies(steps[i]);
        const before = p ? copies(steps[i - 1]) : new Map(Array.from({ length: u.w }, (_, x) => [x, 1]));
        for (const [x, k] of now) {
          if (k <= (before.get(x) ?? 1)) continue;
          // Doubled here: background from here to the end of its quantum.
          for (let q = p; q < u.rows.length; q++) expect(u.bg[q][x], `round ${i + 1}, column ${x}, its quantum's round ${q + 1}`).toBe(true);
        }
      });
    }
  });

  it.each(cases)("doubles a mirror image's columns in mirror pairs, every repeat alike: $kind, $label", ({ id, finished, layout }) => {
    const { rows, steps } = yokeOf(finished, layout, id);
    for (const u of unitsOf(rows)) {
      if (u.solid) continue;
      const pairOf = new Map(u.slots.flatMap((s) => s.map((x) => [x, s] as const)));
      for (const i of u.rows) {
        const n = copies(steps[i]);
        for (const [x, k] of n) for (const y of pairOf.get(x)!) expect(n.get(y), `round ${i + 1}, columns ${x} and ${y}`).toBe(k);
        // A whole number of the layout's repeats.
        expect(steps[i].count % steps[i].map!.length).toBe(0);
        expect(steps[i].map).toEqual(mapOf(u.w, [...n].filter(([, k]) => k > 1).map(([x, k]) => [x, k - 1])));
      }
    }
  });

  it.each(cases)("keeps near its target, and never shrinks: $kind, $label", ({ id, finished, layout }) => {
    const { neck, end, want, steps } = yokeOf(finished, layout, id);
    let count = neck;
    let lag = 0;
    steps.forEach((s, i) => {
      expect(s.count, `round ${i + 1}`).toBeGreaterThanOrEqual(count);
      expect(s.count, `round ${i + 1}`).toBeLessThanOrEqual(Math.max(want(i) * 1.125, i === steps.length - 1 ? end : 0));
      lag = Math.max(lag, (want(i) - s.count) / want(i));
      count = s.count;
    });
    expect(count).toBe(end);
    // The site's yoke fell a fifth behind before it grew by its quanta.
    expect(lag).toBeLessThan(0.1);
  });

  it.each(cases)("keeps its increase rounds apart: $kind, $label", ({ id, finished, layout }) => {
    const { neck, steps } = yokeOf(finished, layout, id);
    const at = steps.map((s, i) => (s.count > (i ? steps[i - 1].count : neck) ? i : -1)).filter((i) => i >= 0);
    // No doubling round straight after another increase.
    at.forEach((i, k) => k && steps[i].kind === "double" && expect(i - at[k - 1], `round ${i + 1}`).toBeGreaterThan(2));
  });
});
