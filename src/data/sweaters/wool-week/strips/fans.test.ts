import { describe, expect, it } from "vitest";
import eachYearOnce from "../../wool-week-strips-once-oldest";
import { measured } from "./design";
import { fans } from "./fans";
import { gauge, planOf, type Row } from "./plan";

const nearest = (v: number, m: number) => Math.max(m, Math.round(v / m) * m);
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
};

/** Each round of the 2014 bands: the count it leaves, as the fans say, and the band's doubled columns after it. */
const walk = (rows: Row[], steps: (typeof fans)[string]) => {
  let count = 0;
  let band = "";
  let doubled: Record<number, number> = {};
  return steps.map((step, i) => {
    const r = rows[i];
    if ("plain" in r) {
      band = "";
      count = step as number;
      return { count, doubled: {}, w: 0, start: null as number[] | null };
    }
    if (`${r.year}${r.chart}` !== band) [band, doubled] = [`${r.year}${r.chart}`, {}];
    const before = r.w + Object.values(doubled).reduce((a, b) => a + b, 0);
    let start: number[] | null = null;
    if (typeof step === "object" && step && "start" in step) [count, start] = [step.start, step.at];
    else if (typeof step === "object" && step && "double" in step) {
      for (const x of step.double) doubled[x] = (doubled[x] ?? 0) + 1;
      count = (count / before) * (before + step.double.length);
    }
    return { count, doubled: { ...doubled }, w: r.w, start };
  });
};

describe("Each Year Once's yoke through the 2014 bands", () => {
  it.each(measured)("covers exactly the 2014 rounds at the top of the yoke, in $label", ({ id, finished }) => {
    const plan = planOf(finished, { kind: "refit" }, id);
    const n = fans[id].length;
    expect(plan.rows.yoke.slice(0, n).every((r) => r.year === 2014)).toBe(true);
    expect(plan.rows.yoke[n].year).toBe(2015);
  });

  it.each(measured)("keeps every repeat a mirror image of itself, and every repeat alike, in $label", ({ id, finished }) => {
    const plan = planOf(finished, { kind: "refit" }, id);
    for (const round of walk(plan.rows.yoke, fans[id])) {
      // Columns doubled in mirror-image pairs, x and w - x, or singly on a mirror line, 0 or w/2; a band's first make-ones too.
      const mirror = (x: number) => (round.w - x) % round.w;
      for (const [x, k] of Object.entries(round.doubled)) expect(round.doubled[mirror(+x)], `column ${x} of a ${round.w}-stitch band`).toBe(k);
      if (round.start) expect(round.start.map(mirror).sort((a, b) => a - b)).toEqual(round.start);
    }
  });

  it("works every increase in a band on its background: the lighter yarn in the 24-stitch band, the darker in the 28", () => {
    // Every size knitted first: a design's charts are gathered as its sizes are knitted.
    for (const size of eachYearOnce.sizes) void size.sections;
    const hex = Object.fromEntries(eachYearOnce.colourways[0].shades.map((s) => [s.slot, s.hex]));
    const shaped = eachYearOnce.charts.filter((c) => /-14[BC]\d+[ds]/.test(c.id));
    expect(shaped.length).toBeGreaterThan(20);
    for (const chart of shaped) {
      const band = chart.id.match(/-14([BC])\d+[ds]/)![1];
      const cells = chart.rows[0];
      const yarns = [...new Set(cells.map((c) => c.slot))].sort((a, b) => lum(hex[a]) - lum(hex[b]));
      const ground = band === "C" ? yarns[yarns.length - 1] : yarns[0];
      cells.forEach((cell, q) => {
        if (cell.symbol !== "m1") return;
        expect(cell.slot, `${chart.id}, stitch ${q + 1}`).toBe(ground);
        // A doubled column's new stitch comes out of the same stitch as its twin, just before it: one stitch made into two.
        if (/d/.test(chart.id.split("-").pop()!)) expect(cells[q - 1]).toEqual({ slot: cell.slot, symbol: "kfb" });
      });
    }
  });

  it.each(measured)("keeps the yoke near its target through the 2014 bands, in $label", ({ id, finished }) => {
    const plan = planOf(finished, { kind: "refit" }, id);
    // The yoke's target, as knit has it: from a quarter more than the neck, straight to the divide's count four rounds before the end.
    const neck = nearest(finished.neckCm * gauge.stitches, 4);
    const body = nearest(finished.chestCm * gauge.stitches, 4);
    const underarm = Math.min(24, Math.max(8, nearest(body * 0.04, 2)));
    const upperArm = nearest(finished.upperArmCm * gauge.stitches, 2);
    const total = body - 2 * underarm + 2 * (upperArm - underarm);
    const first = Math.round(neck * 1.25);
    const n = plan.rows.yoke.length;
    let lag = 0;
    walk(plan.rows.yoke, fans[id]).forEach(({ count }, i) => {
      const target = first + (total - first) * Math.min(1, (i + 4) / n);
      lag = Math.max(lag, (target - count) / target);
      expect(count, `round ${i + 1}`).toBeLessThanOrEqual(target * 1.125);
    });
    // The site's yoke fell a fifth behind here before the bands fanned out.
    expect(lag).toBeLessThan(0.1);
  });
});
