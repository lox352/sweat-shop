import { describe, expect, it } from "vitest";
import eachYearOnce from "../../wool-week-strips-once-oldest";
import thirteenStrips from "../../wool-week-strips-lined-oldest";
import { letterOf, yearOfSlot } from "./slots";

describe.each([eachYearOnce, thirteenStrips])("the light and dark colourways of $name", (design) => {
  // Every chart of size M, knitted: its sections are read before its charts.
  void design.sizes.find((s) => s.id === "m")!.sections;
  const grounded = design.colourways.filter((c) => /-(light-yoke|dark|light|turns)$/.test(c.id));

  it("has every palette with every way of setting its grounds", () => {
    expect(grounded.map((c) => c.id)).toEqual(
      ["classic", "undyed", "simmer", "own"].flatMap((p) => ["dark", "light-yoke", "light", "turns"].map((m) => `${p}-${m}`)),
    );
    // All dark, in Aa ae colour: classic, is the design's default.
    expect(design.colourways[0].id).toBe("classic-dark");
  });

  it.each(grounded.map((c) => [c.name, c] as const))("knits the Baa-ble Hat's sheep as white sheep, in %s", (_, colourway) => {
    // Their bodies (B) the lightest of the year's yarns, well clear of the sky (D) and the field (A); their faces and legs (C) the darkest,
    // which a night sky may share - the two never meet.
    const hexOf = (letter: string) => colourway.shades.find((s) => s.slot === `15${letter}`)!.hex;
    const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
    const [sheep, faces, sky, field] = ["B", "C", "D", "A"].map((l) => lum(hexOf(l)));
    expect(sheep).toBeGreaterThan(Math.max(sky, field) + 25);
    expect(faces).toBeLessThanOrEqual(sky);
    expect(faces).toBeLessThan(field);
  });

  it.each(grounded.map((c) => [c.name, c] as const))("never knits two yarns that meet in a round in one, in %s", (_, colourway) => {
    const yarnOf = new Map(colourway.shades.map((s) => [s.slot, s.code]));
    const clashes: string[] = [];
    for (const chart of design.charts) {
      for (const row of chart.rows) {
        const slots = [...new Set(row.map((cell) => cell.slot))];
        for (let i = 0; i < slots.length; i++) {
          for (let j = i + 1; j < slots.length; j++) {
            // Slots of one hat's yarn - 2026's two printings - are meant to share.
            const same = yearOfSlot(slots[i]) === yearOfSlot(slots[j]) && letterOf(slots[i]) === letterOf(slots[j]);
            if (!same && yarnOf.get(slots[i]) === yarnOf.get(slots[j])) clashes.push(`${chart.id}: ${slots[i]} and ${slots[j]}`);
          }
        }
      }
    }
    expect(clashes.slice(0, 5)).toEqual([]);
  });

  it("puts every ground of a dark year on the palette's darkest yarn, in Aa ae colour: classic", () => {
    const dark = design.colourways.find((c) => c.id === "classic-dark")!;
    // 2026's bands: B, D and E are its grounds, and all go to Admiral Navy.
    for (const letter of ["B", "D", "E"]) {
      const shades = dark.shades.filter((s) => yearOfSlot(s.slot) === 2026 && letterOf(s.slot) === letter);
      expect(new Set(shades.map((s) => s.code))).toEqual(new Set(["727"]));
    }
  });
});
