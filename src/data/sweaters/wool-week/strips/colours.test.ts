import { describe, expect, it } from "vitest";
import eachYearOnce from "../../wool-week-strips-once-oldest";
import thirteenStrips from "../../wool-week-strips-lined-oldest";
import { trimIdOf, trimmed } from "../../../../knitting/palette";
import roles from "./roles.json";
import { letterOf, trimSlot, yearOfSlot, yearsOfTrim } from "./slots";
import { lettersOf } from "./cuts";
import { yearOf, years } from "../years";

/** CIE L*, how light a colour looks. */
const lightness = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const y = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return 116 * (y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116) - 16;
};
const isTrim = (slot: string) => slot.split("/")[0] === trimSlot;
const roleOf = (slot: string): string => {
  const r = (roles as Record<string, { ground: string[]; middle?: string[]; figure: string[] }>)[yearOfSlot(slot)];
  const l = letterOf(slot);
  return r.ground.includes(l) ? "ground" : r.middle?.includes(l) ? "middle" : "figure";
};

const MANY = ["journey-light", "night-journey-dark", "journey-in-step-light", "journey-gentle-light", "night-in-step-dark", "night-gentle-dark", "landscape-light", "undyed-grounds-light", "shaded-light", "hats-hues-light", "bohus-heathers-light", "muhu-stockings-dark", "seasons-light"];

describe.each([eachYearOnce, thirteenStrips])("the colourways of $name", (design) => {
  // Every chart of size M, knitted: its sections are read before its charts.
  void design.sizes.find((s) => s.id === "m")!.sections;
  // The fifteen palettes after the traditions, each all dark and all light.
  const traditions = design.colourways.filter((c) => !MANY.includes(c.id));
  const many = design.colourways.filter((c) => MANY.includes(c.id));

  it("has fifteen palettes, each all dark and all light, all dark in Shetland naturals first; then thirteen of many colours", () => {
    expect(design.colourways.map((c) => c.id)).toEqual([
      ...["naturals", "early", "twenties", "vintage", "lopi", "selbu", "marius", "bohus", "muhu", "latvia", "andes", "sanquhar", "buggiflooer", "anemone", "classic"].flatMap((p) => [
        `${p}-dark`,
        `${p}-light`,
      ]),
      ...MANY,
    ]);
  });

  it.each(many.map((c) => [c.name, c] as const))("knits tens of yarns, in %s", (_, colourway) => {
    const used = new Set(colourway.shades.filter((s) => !isTrim(s.slot)).map((s) => s.code));
    expect(used.size).toBeGreaterThanOrEqual(24);
    expect(colourway.family).toBe("Many colours");
  });

  it("shades a band round by round in Shaded Fair Isle, and in no other colourway", () => {
    const shadeOf = (c: (typeof design.colourways)[number], slot: string) => c.shades.find((s) => s.slot === slot)!.code;
    const shaded = many.find((c) => c.id === "shaded-light")!;
    // 2018's ground, from a band's edge to its centre: four shades.
    expect(new Set([0, 1, 2, 3].map((i) => shadeOf(shaded, `18A/g${i}`))).size).toBe(4);
    // And the charts knit those shades: some row of some chart in each step.
    const used = new Set(design.charts.flatMap((chart) => chart.rows.flatMap((row) => row.map((cell) => cell.slot))));
    for (const i of [0, 1, 2, 3]) expect([...used].some((slot) => slot.endsWith(`/g${i}`))).toBe(true);
    // Every other colourway knits a shade in its yarn's own colour.
    for (const c of design.colourways.filter((c) => c !== shaded)) {
      for (const slot of ["18A/g0", "18A/g3", "14D/f2", "23B/c"]) expect(shadeOf(c, slot), `${c.id} ${slot}`).toBe(shadeOf(c, slot.split("/")[0]));
    }
  });

  it("groups its colourways by tradition, each group together", () => {
    const families = design.colourways.map((c) => c.family);
    expect(families.every(Boolean)).toBe(true);
    // Each tradition's colourways one after another, never split.
    const runs = families.filter((f, i) => f !== families[i - 1]);
    expect(new Set(runs).size).toBe(runs.length);
    expect(runs[0]).toBe("Shetland and Fair Isle");
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
            // Twenty L* between a ground and its figure (Bohus's soft heathers seventeen), eight between two grounds or two figures, as a ground is shaded.
            const need = roleOf(a) === roleOf(b) ? 8 : colourway.id.startsWith("bohus-") ? 17 : 20;
            if (Math.abs(L.get(a)! - L.get(b)!) < need) close.push(`${chart.id}: ${a} and ${b}`);
          }
        }
      }
    }
    expect(close.slice(0, 5)).toEqual([]);
  });

  it.each(traditions.map((c) => [c.name, c] as const))("puts the grounds light or dark as it says, in %s", (_, colourway) => {
    const dark = colourway.id.endsWith("-dark");
    // Every year's ground against the figure drawn on it - not the two pictures of sheep, which stay white whatever the sky.
    for (const year of Object.keys(roles).filter((y) => y !== "2015" && y !== "2019")) {
      const shades = colourway.shades.filter((s) => !isTrim(s.slot) && yearOfSlot(s.slot) === +year);
      const ground = shades.filter((s) => roleOf(s.slot) === "ground").map((s) => lightness(s.hex));
      const figure = shades.filter((s) => roleOf(s.slot) === "figure").map((s) => lightness(s.hex));
      const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
      if (figure.length === 0) continue;
      expect(dark ? mean(ground) < mean(figure) : mean(ground) > mean(figure), `${year}`).toBe(true);
    }
  });

  it("ribs the neck in the trim of the year beside it, the waist and wrists in one of the years beside them", () => {
    const ribs = design.sizes.flatMap((size) => size.sections.flatMap((s) => s.rounds))
      .filter((r) => "fabric" in r && r.fabric === "rib" && "slot" in r).map((r) => (r as { slot: string }).slot);
    // The yoke's first year is 2014 in every size; the body ends in 2021 or 2026, the sleeves in 2026.
    const low = design.id.includes("once") ? "trim/21+26" : "trim/26";
    expect(new Set(ribs)).toEqual(new Set(["trim/14", low]));
  });

  it("knits the back neck's short rows in the first band's background, not the trim, so that only the ribbing stands out", () => {
    for (const size of design.sizes) {
      const rounds = size.sections.flatMap((s) => s.rounds);
      const at = rounds.findIndex((r) => r.type === "shortRows");
      const short = rounds[at] as { slot: string };
      // The first round of the yoke after them, which opens the first band in its background yarn.
      const next = rounds.slice(at + 1).find((r) => "slot" in r || r.type === "chart") as { slot?: string };
      expect(isTrim(short.slot), size.id).toBe(false);
      expect(short.slot.split("/")[0], size.id).toBe(next.slot?.split("/")[0] ?? short.slot.split("/")[0]);
      expect(yearOfSlot(short.slot), size.id).toBe(2014);
    }
  });

  it.each(design.colourways.map((c) => [c.name, c] as const))("trims by default in the darkest yarn of the years beside it, in %s", (_, colourway) => {
    for (const trim of colourway.shades.filter((s) => isTrim(s.slot))) {
      const years = yearsOfTrim(trim.slot);
      const darkest = Math.min(...colourway.shades.filter((s) => !isTrim(s.slot) && years.includes(yearOfSlot(s.slot))).map((s) => lightness(s.hex)));
      expect(lightness(trim.hex), trim.slot).toBe(darkest);
    }
  });

  it("trims Night journey, in step, gentler in Dark Navy at the neck, and Black at the waist and wrists", () => {
    const night = design.colourways.find((c) => c.id === "night-gentle-dark")!;
    // Only the trims the layout knits.
    expect(night.shades.filter((s) => isTrim(s.slot)).map((s) => [s.slot, s.name])).toEqual([
      ["trim/14", "Dark Navy"],
      [design.id.includes("once") ? "trim/21+26" : "trim/26", "Black"],
    ]);
  });

  it.each(design.colourways.map((c) => [c.name, c] as const))("offers yarns of the palette for the trim, and changes only the trim, in %s", (_, colourway) => {
    const trims = colourway.trims!;
    const used = new Set(colourway.shades.filter((s) => !isTrim(s.slot)).map((s) => s.code));
    if (MANY.includes(colourway.id)) {
      // A dozen at most of its many.
      expect(trims.length).toBeLessThanOrEqual(12);
    } else {
      // The palette's every yarn, which takes in every yarn the colourway knits.
      for (const code of used) expect(trims.map((t) => t.code)).toContain(code);
    }
    expect(trims.every((t) => t.slot === trimSlot)).toBe(true);
    for (const option of trims) {
      // Every part of the trim in the one yarn, under its own slot.
      const changed = trimmed(colourway, trimIdOf(option));
      for (const shade of changed.shades.filter((s) => isTrim(s.slot))) expect(shade).toEqual({ ...option, slot: shade.slot });
      expect(changed.shades.filter((s) => !isTrim(s.slot))).toEqual(colourway.shades.filter((s) => !isTrim(s.slot)));
    }
    // A trim no longer among them, and none, leave the colourway as it is.
    expect(trimmed(colourway, "not-a-yarn")).toBe(colourway);
    expect(trimmed(colourway, undefined)).toBe(colourway);
  });
});

describe("the hats' charts, as the samplers knit them", () => {
  it("have every row in two yarns at most: the Shwook Hat's misprinted white stitch in the Yarn B its row's table and its mirror give it", () => {
    for (const { year, charts } of years) {
      for (const chart of Object.keys(charts)) {
        lettersOf(year, chart).forEach((row, k) => {
          expect(new Set(row).size, `${year}, chart ${chart}, row ${k + 1}`).toBeLessThanOrEqual(2);
        });
      }
    }
    // Chart B's row 7, Yarns A and B by its table, printed white at its 27th stitch, which mirrors its first.
    const row = lettersOf(2014, "B")[6];
    expect(row[26]).toBe("B");
    expect(row[26]).toBe(row[0]);
    expect(yearOf(2014).charts.B[6].match(/../g)![26][0]).toBe("D");
  });
});
