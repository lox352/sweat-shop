import { describe, expect, it } from "vitest";
import { lettersOf } from "./cuts";
import { background, quanta, quantumOf } from "./quanta";

describe("the hats' quanta", () => {
  it("lie within their charts, each row in at most one", () => {
    for (const q of quanta) {
      const rows = lettersOf(q.year, q.chart).length;
      expect(q.from, `${q.year} ${q.name}`).toBeGreaterThanOrEqual(1);
      expect(q.to, `${q.year} ${q.name}`).toBeLessThanOrEqual(rows);
      for (let r = q.from; r <= q.to; r++) expect(quantumOf(q.year, q.chart, r)).toBe(q);
    }
  });

  it("put a frame either side of its core, both or neither, nesting outwards", () => {
    const groups = new Map<string, typeof quanta>();
    for (const q of quanta.filter((x) => x.kind !== "free")) {
      const key = `${q.year}:${q.group}`;
      groups.set(key, [...(groups.get(key) ?? []), q]);
    }
    for (const [key, qs] of groups) {
      expect(qs.filter((q) => q.kind === "core"), key).toHaveLength(1);
      const levels = [...new Set(qs.filter((q) => q.kind === "frame").map((q) => q.level))].sort();
      levels.forEach((level, i) => {
        expect(level, key).toBe(i + 1);
        expect(qs.filter((q) => q.kind === "frame" && q.level === level), `${key} level ${level}`).toHaveLength(2);
      });
    }
  });

  it("keep 2014's, 2021's and 2026's frames aligned with their cores, and let the rest drift", () => {
    for (const q of quanta) expect(q.aligned, `${q.year} ${q.name}`).toBe(q.kind !== "free" && [2014, 2021, 2026].includes(q.year));
  });

  it("know the foreground the knitter pointed out", () => {
    const letters = (year: number, chart: string, row: number) => lettersOf(year, chart)[row - 1];
    // 2014: the star points and sprinkles in the borders are foreground, the borders' ground background.
    const b12 = letters(2014, "B", 12);
    b12.forEach((l, x) => expect(background(2014, "B", 12, x)).toBe(l === "C"));
    expect(b12).toContain("D");
    // The 2014 peerie is dark on the hat's light ground.
    letters(2014, "A", 2).forEach((l, x) => expect(background(2014, "A", 2, x)).toBe(l === "B"));
    // 2019's sheep, in white, are foreground.
    const sheep = letters(2019, "C", 8);
    sheep.forEach((l, x) => l === "F" && expect(background(2019, "C", 8, x)).toBe(false));
    // 2016's seed rounds are all sky.
    letters(2016, "A", 20).forEach((_, x) => expect(background(2016, "A", 20, x)).toBe(true));
  });

  it("read 2025 by its diamonds: light yarn is ground inside one, dark outside", () => {
    // The middle of a diamond, stitch 9 of row 7, is inside; its corner, stitch 0 of row 15, outside.
    const at = (x: number, row: number) => lettersOf(2025, "A")[row - 1][x];
    const light = (l: string) => "BDFH".includes(l);
    expect(background(2025, "A", 7, 9)).toBe(light(at(9, 7)));
    expect(background(2025, "A", 15, 0)).toBe(!light(at(0, 15)));
  });
});
