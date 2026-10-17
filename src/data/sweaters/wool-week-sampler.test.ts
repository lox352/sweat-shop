import { describe, expect, it } from "vitest";
import sampler from "./wool-week-sampler";
import ladder from "./wool-week/ladder.json";
import { blocks, slotFor } from "./wool-week/blocks";
import { gauge } from "./wool-week/grade";
import { hatChart, years } from "./wool-week/years";
import { consumes } from "./types";
import { crownAsIncrease, decreaseEvenly, increaseEvenly, rotated } from "./writing";
import { buildSweater } from "../../knitting/engine";

/** CIE L*a*b* of a hex colour, as scripts/ladder.mjs measures it. */
const lab = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [lin(n >> 16), lin((n >> 8) & 255), lin(n & 255)];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
};
const difference = (p: string, q: string) => {
  const [a, b] = [lab(p), lab(q)];
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
};

describe("the hats' charts, turned for a top-down jumper", () => {
  it("are turned through half a circle, not mirrored: turned twice, a chart is itself", () => {
    const sheep = hatChart(2015, "A", "sheep", "sheep");
    expect(rotated(rotated(sheep)).rows).toEqual(sheep.rows);
    const once = rotated(sheep);
    expect(once.rows[0][0]).toEqual(sheep.rows[sheep.rows.length - 1].at(-1));
  });

  it("work a crown from its point outwards, each row made out of the one before, the hat's colours cell for cell", () => {
    for (const [year, id] of [[2014, "D"], [2016, "B"], [2024, "E"], [2026, "Crown"]] as const) {
      const crown = hatChart(year, id, id, id);
      const up = crownAsIncrease(crown, 1, crown.rows.length, "up");
      expect(up.rows).toHaveLength(crown.rows.length);
      up.rows.forEach((row, k) => {
        const hat = crown.rows[crown.rows.length - 1 - k];
        // The row the hat knitted, turned, in its own colours; it works the one before it.
        expect(row.map((cell) => cell.slot)).toEqual([...hat].reverse().map((cell) => cell.slot));
        if (k > 0) expect(row.reduce((sum, cell) => sum + consumes(cell), 0)).toBe(up.rows[k - 1].length);
      });
    }
  });

  it("increase and decrease evenly to exactly the count asked for", () => {
    const count = (ops: ReturnType<typeof increaseEvenly>, from: number): number => {
      let made = 0;
      let used = 0;
      const walk = (op: (typeof ops)[number]) => {
        if ("repeat" in op) {
          for (let k = 0; k < ("times" in op ? op.times : 0); k++) op.repeat.forEach(walk);
          return;
        }
        if (op.work === "m1") made++;
        else if (op.work === "k2tog") {
          used += 2;
          made++;
        } else if (op.work === "k") {
          used += op.times;
          made += op.times;
        }
      };
      ops.forEach(walk);
      expect(used).toBe(from);
      return made;
    };
    expect(count(increaseEvenly(192, 252), 192)).toBe(252);
    expect(count(decreaseEvenly(104, 96), 104)).toBe(96);
    expect(count(decreaseEvenly(500, 336), 500)).toBe(336);
  });
});

describe("the ladder", () => {
  const colourways = ladder.colourways;

  it("puts each hat's yarns onto rungs in their own order of lightness", () => {
    for (const year of years) {
      const map = (ladder.maps as Record<string, Record<string, string>>)[year.year];
      const yarns = Object.keys(map).sort((a, b) => lab(year.colourway.shades[a].hex).L - lab(year.colourway.shades[b].hex).L);
      const rungs = yarns.map((slot) => map[slot]);
      expect(rungs, String(year.year)).toEqual([...rungs].sort());
      expect(new Set(rungs).size).toBe(rungs.length);
    }
  });

  it("keeps every colourway's rungs in order, darkest to lightest", () => {
    for (const colourway of colourways) {
      const lightness = colourway.shades.map((shade) => lab(shade.hex).L);
      lightness.slice(1).forEach((L, k) => expect(L, `${colourway.name}, rung ${k + 2}`).toBeGreaterThan(lightness[k]));
    }
  });

  it("keeps every row of every hat light where it was light and dark where it was dark, and apart where it relied on hue", () => {
    const failures: string[] = [];
    for (const year of years) {
      for (const [id, rows] of Object.entries(year.charts)) {
        rows.forEach((row, index) => {
          const slots = [...new Set((row.match(/../g) ?? []).map((pair) => pair[0]))];
          for (let i = 0; i < slots.length; i++) {
            for (let j = i + 1; j < slots.length; j++) {
              const [p, q] = [year.colourway.shades[slots[i]].hex, year.colourway.shades[slots[j]].hex];
              const hatLight = lab(p).L - lab(q).L;
              for (const colourway of colourways) {
                const shade = (slot: string) => colourway.shades.find((one) => one.slot === slotFor(year.year, slot))!.hex;
                const [P, Q] = [shade(slots[i]), shade(slots[j])];
                const light = lab(P).L - lab(Q).L;
                const where = `${year.year} ${id} row ${index + 1}, ${colourway.name}`;
                if (Math.abs(hatLight) >= 5 && Math.sign(light) !== Math.sign(hatLight)) failures.push(`${where}: turned over`);
                if (difference(P, Q) < Math.min(difference(p, q), 30) * 0.75 - 0.5) failures.push(`${where}: too close`);
              }
            }
          }
        });
      }
    }
    expect(failures).toEqual([]);
  });

  it("is the sampler's colourways", () => {
    expect(sampler.colourways.map((colourway) => colourway.id)).toEqual(colourways.map((colourway) => colourway.id));
    for (const colourway of sampler.colourways) expect(colourway.shades.map((shade) => shade.slot)).toEqual(sampler.slots);
  });
});

describe.each(sampler.sizes.map((size) => [size.id, size] as const))("the sampler in size %s", (_, size) => {
  const built = buildSweater(sampler, size.id);
  const charted = new Set(size.sections.flatMap((section) => section.rounds.flatMap((spec) => (spec.type === "chart" ? [spec.chart] : []))));

  it("knits every motif of every hat, in date order down the jumper", () => {
    const order: number[] = [];
    for (const section of size.sections.slice(0, 3)) {
      for (const spec of section.rounds) {
        const year = spec.type === "chart" ? /^y(\d\d)-/.exec(spec.chart)?.[1] : undefined;
        if (year && Number(year) + 2000 !== order.at(-1)) order.push(Number(year) + 2000);
      }
    }
    expect(order.filter((year) => year !== 2014 || order.indexOf(2014) === order.lastIndexOf(2014))).toEqual(years.map((year) => year.year));
    for (const block of blocks) {
      for (const part of block.parts.filter((one) => one.priority === undefined)) {
        for (const item of part.items) if (item.kind === "band") expect(charted.has(item.chart.id), `${block.year} ${part.label}`).toBe(true);
      }
    }
  });

  it("comes out at its yoke depth, body length and sleeve length", () => {
    const rounds = (piece: string) =>
      built.rounds.filter((_round, index) => built.roundPieces[index] === piece && built.roundKinds[index] === "round").length;
    const f = size.finished;
    // The yoke's rounds, the neck rib with them, and none of the short rows across the back of the neck.
    expect(rounds("yoke")).toBe(Math.round(f.yokeDepthCm * gauge.rounds));
    expect(rounds("body")).toBe(Math.round(f.bodyLengthCm * gauge.rounds));
    expect(rounds("sleeve-left")).toBe(Math.round(f.sleeveLengthCm * gauge.rounds));
  });

  it("is as wide as it says at the chest, the upper arm and the cuff", () => {
    const f = size.finished;
    expect(size.checks.body / gauge.stitches).toBeCloseTo(f.chestCm, -0.5);
    expect(size.checks["sleeve-left:top"] / gauge.stitches).toBeCloseTo(f.upperArmCm, -0.5);
    expect(size.checks["sleeve-left:cuff"] / gauge.stitches).toBeCloseTo(f.cuffCm, -0.5);
  });
});
