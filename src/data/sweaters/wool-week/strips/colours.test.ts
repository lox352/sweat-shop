import { describe, expect, it } from "vitest";
import eachYearOnce from "../../wool-week-strips-once-oldest";
import thirteenStrips from "../../wool-week-strips-lined-oldest";
import { trimIdOf, trimmed } from "../../../../knitting/palette";
import roles from "./roles.json";
import { letterOf, trimSlot, yearOfSlot } from "./slots";

/** CIE L*, how light a colour looks. */
const lightness = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const y = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return 116 * (y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116) - 16;
};
const roleOf = (slot: string): string => {
  const r = (roles as Record<string, { ground: string[]; middle?: string[]; figure: string[] }>)[yearOfSlot(slot)];
  const l = letterOf(slot);
  return r.ground.includes(l) ? "ground" : r.middle?.includes(l) ? "middle" : "figure";
};

describe.each([eachYearOnce, thirteenStrips])("the colourways of $name", (design) => {
  // Every chart of size M, knitted: its sections are read before its charts.
  void design.sizes.find((s) => s.id === "m")!.sections;

  it("has six palettes, each all dark and all light, all dark in Shetland naturals first", () => {
    expect(design.colourways.map((c) => c.id)).toEqual(
      ["naturals", "early", "twenties", "vintage", "selbu", "marius"].flatMap((p) => [`${p}-dark`, `${p}-light`]),
    );
  });

  it.each(design.colourways.map((c) => [c.name, c] as const))("knits the sheep white, in %s", (_, colourway) => {
    const L = (slot: string) => lightness(colourway.shades.find((s) => s.slot === slot)!.hex);
    const lightest = Math.max(...colourway.shades.map((s) => lightness(s.hex)));
    // 2015's bodies and 2019's sheep the palette's lightest, 2015's faces and legs its darkest.
    expect(L("15B")).toBe(lightest);
    expect(L("19F")).toBe(lightest);
    expect(L("15C")).toBe(Math.min(...colourway.shades.map((s) => lightness(s.hex))));
  });

  it.each(design.colourways.map((c) => [c.name, c] as const))("keeps every two yarns that meet in a round apart, in %s", (_, colourway) => {
    const L = new Map(colourway.shades.map((s) => [s.slot, lightness(s.hex)]));
    const close: string[] = [];
    for (const chart of design.charts) {
      for (const row of chart.rows) {
        const slots = [...new Set(row.map((cell) => cell.slot))];
        for (let i = 0; i < slots.length; i++) {
          for (let j = i + 1; j < slots.length; j++) {
            const [a, b] = [slots[i], slots[j]];
            // Slots of one hat's yarn - 2026's two printings - are meant to share.
            if (yearOfSlot(a) === yearOfSlot(b) && letterOf(a) === letterOf(b)) continue;
            // Twenty L* between a ground and its figure, eight between two grounds or two figures, as a ground is shaded.
            const need = roleOf(a) === roleOf(b) ? 8 : 20;
            if (Math.abs(L.get(a)! - L.get(b)!) < need) close.push(`${chart.id}: ${a} and ${b}`);
          }
        }
      }
    }
    expect(close.slice(0, 5)).toEqual([]);
  });

  it.each(design.colourways.map((c) => [c.name, c] as const))("puts the grounds light or dark as it says, in %s", (_, colourway) => {
    const dark = colourway.id.endsWith("-dark");
    // Every year's ground against the figure drawn on it - not the two pictures of sheep, which stay white whatever the sky.
    for (const year of Object.keys(roles).filter((y) => y !== "2015" && y !== "2019")) {
      const shades = colourway.shades.filter((s) => s.slot !== trimSlot && yearOfSlot(s.slot) === +year);
      const ground = shades.filter((s) => roleOf(s.slot) === "ground").map((s) => lightness(s.hex));
      const figure = shades.filter((s) => roleOf(s.slot) === "figure").map((s) => lightness(s.hex));
      const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
      if (figure.length === 0) continue;
      expect(dark ? mean(ground) < mean(figure) : mean(ground) > mean(figure), `${year}`).toBe(true);
    }
  });

  it.each(design.colourways.map((c) => [c.name, c] as const))("ribs the neck, waist and wrists in the trim, the palette's ground, in %s", (_, colourway) => {
    const ribs = design.sizes.flatMap((size) => size.sections.flatMap((s) => s.rounds))
      .filter((r) => "fabric" in r && r.fabric === "rib" && "slot" in r).map((r) => (r as { slot: string }).slot);
    expect(new Set(ribs)).toEqual(new Set([trimSlot]));
    // By default the yarn of the ground the most hats take.
    const trim = colourway.shades.find((s) => s.slot === trimSlot)!;
    const mains = Object.entries(roles).map(([year, r]) => colourway.shades.find((s) => s.slot.startsWith(`${year.slice(2)}${r.ground[0]}`))!.code);
    const commonest = [...new Set(mains)].sort((a, b) => mains.filter((m) => m === b).length - mains.filter((m) => m === a).length)[0];
    expect(trim.code).toBe(commonest);
  });

  it.each(design.colourways.map((c) => [c.name, c] as const))("offers every yarn of the palette for the trim, and changes only the trim, in %s", (_, colourway) => {
    const trims = colourway.trims!;
    const used = new Set(colourway.shades.filter((s) => s.slot !== trimSlot).map((s) => s.code));
    // The palette's every yarn, which takes in every yarn the colourway knits.
    for (const code of used) expect(trims.map((t) => t.code)).toContain(code);
    expect(trims.every((t) => t.slot === trimSlot)).toBe(true);
    for (const option of trims) {
      const changed = trimmed(colourway, trimIdOf(option));
      expect(changed.shades.find((s) => s.slot === trimSlot)).toEqual(option);
      expect(changed.shades.filter((s) => s.slot !== trimSlot)).toEqual(colourway.shades.filter((s) => s.slot !== trimSlot));
    }
    // A trim no longer among them, and none, leave the colourway as it is.
    expect(trimmed(colourway, "not-a-yarn")).toBe(colourway);
    expect(trimmed(colourway, undefined)).toBe(colourway);
  });
});
