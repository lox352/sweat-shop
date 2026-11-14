import { lettersOf, patterns, topDown } from "./cuts";
import { background } from "./quanta";
import roleData from "./roles.json";

/**
 * The strip samplers' yarn slots: one for each yarn of each hat, named for
 * its year and the hat's own letter - "14A", "25H". A colourway is then just
 * a yarn for every slot: a six-yarn colourway puts one yarn in many slots, a
 * collection of the hats' own colourways gives each slot its own hat's.
 *
 * 2026 is charted in parts, a ground and a motif to each row, and its two
 * printings put different yarns in them row by row. So its slots are named
 * for what a cell is in both: "26DA" is a cell knitted in D in colourways 1
 * and 2 and in A in 3 and 4.
 */

const PRINTED = 2026;
const OTHER = "3-4";

const yy = (year: number) => String(year).slice(2);

/** A row of a hat chart as slots, each row's first stitch first. */
export const slotsOfRow = (year: number, chart: string, row: number): string[] => {
  const first = lettersOf(year, chart)[row - 1];
  if (year !== PRINTED) return first.map((letter) => yy(year) + letter);
  const other = lettersOf(year, chart, OTHER)[row - 1];
  return first.map((letter, i) => yy(year) + letter + other[i]);
};

/**
 * Where a round stands in its band, for a palette that shades its bands as
 * Fair Isle does: `step` 0 at the band's edges to 3 at its centre, and
 * whether it is the centre round of a band deep enough to make one special.
 */
export interface Band {
  step: number;
  centre: boolean;
}

/**
 * A slot as it stands in a round of a shaded band: the hat's yarn, then "/"
 * and what it is in that round with the round's step - "g" the round's main
 * ground, "h" a second ground, "f" its main figure, "m" another figure, each
 * 0 to 3 - or "c", the one figure of a centre round. "14D/f2". A palette that
 * shades gives each its own yarn; every other gives them all its yarn for the
 * slot itself, so the knitting is the same whatever the colourway.
 */
export const SHADE_VARIANTS = [..."ghfm"].flatMap((k) => [0, 1, 2, 3].map((i) => `${k}${i}`)).concat("c");

/** The hat's yarn a slot is, without any shade: "14D" for "14D/f2". */
export const baseSlot = (slot: string): string => slot.split("/")[0];

/** The hat's own letter for a slot, in a printing: "1-2" or "3-4" for 2026. */
export const letterOf = (slot: string, printing?: string): string => {
  const base = baseSlot(slot);
  return base.length === 4 ? (printing && printing !== "1-2" ? base[3] : base[2]) : base[2];
};

const pins = (year: number): Record<string, string> => (roleData as Record<string, { pins?: Record<string, string> }>)[year]?.pins ?? {};
const shaded = new Map<string, string[]>();

/**
 * A row of a hat chart as slots in a round of a shaded band: each yarn
 * marked for what it is in this row - ground or figure by the foreground map,
 * main or not by how much of the row it is (the pinned sheep and their faces
 * aside) - and the round's place in the band. Without a band, the plain slots.
 */
export const bandSlotsOfRow = (year: number, chart: string, row: number, band?: Band): string[] => {
  const slots = slotsOfRow(year, chart, row);
  if (!band) return slots;
  const key = `${year}${chart}${row}:${band.step}${band.centre ? "c" : ""}`;
  const hit = shaded.get(key);
  if (hit) return hit;
  const letters = lettersOf(year, chart)[row - 1];
  const tally = new Map<string, [number, number]>();
  letters.forEach((l, x) => {
    const t = tally.get(l) ?? [0, 0];
    t[background(year, chart, row, x) ? 0 : 1]++;
    tally.set(l, t);
  });
  const ranked = [...tally.keys()].filter((l) => !pins(year)[l]).sort((a, b) => tally.get(b)![0] + tally.get(b)![1] - (tally.get(a)![0] + tally.get(a)![1]));
  const isGround = (l: string) => tally.get(l)![0] >= tally.get(l)![1];
  const grounds = ranked.filter(isGround);
  const figures = ranked.filter((l) => !isGround(l));
  const kind = (l: string): string => {
    if (isGround(l)) return `${grounds.indexOf(l) <= 0 ? "g" : "h"}${band.step}`;
    // A centre round's one figure takes the bright; a centre round of two figures shades as any other.
    if (band.centre && figures.length === 1 && figures[0] === l && grounds.length) return "c";
    return `${figures.indexOf(l) <= 0 ? "f" : "m"}${band.step}`;
  };
  const out = slots.map((slot, x) => `${slot}/${kind(letters[x])}`);
  shaded.set(key, out);
  return out;
};

/** The ribbing's slot - the neck, the hem and the cuffs - which is no hat's: see colours. */
export const trimSlot = "trim";

/**
 * The trim for one part of the ribbing, named for the years it is knitted
 * beside, whose darkest yarn it takes by default (see colours): "trim/14" for
 * the neck's beside 2014, "trim/21+26" for the waist's and the wrists' beside
 * 2021 and 2026. A trim the knitter chooses goes in every one.
 */
export const trimOf = (years: number[]): string => `${trimSlot}/${[...new Set(years)].sort().map(yy).join("+")}`;

/** The years a trim's slot is named for. */
export const yearsOfTrim = (slot: string): number[] => slot.split("/")[1].split("+").map((y) => 2000 + Number(y));

export const yearOfSlot = (slot: string): number => 2000 + Number(slot.slice(0, 2));

/** Every hat's yarn any cut of any year knits, in year order. */
export const baseSlots: string[] = (() => {
  const seen = new Set<string>();
  for (const p of patterns) {
    const parts = [...p.options.flatMap((o) => o.parts), ...(p.full ?? [])];
    if (p.centred) parts.push([p.centred.chart, 1, lettersOf(p.year, p.centred.chart).length]);
    for (const r of topDown(p.year, parts)) for (const s of slotsOfRow(p.year, r.chart, r.row)) seen.add(s);
  }
  return [...seen].sort();
})();

/** Every slot any cut of any year knits: each hat's yarn, then its shades in a shaded band. */
export const allSlots: string[] = baseSlots.flatMap((slot) => [slot, ...SHADE_VARIANTS.map((v) => `${slot}/${v}`)]);

/** Every trim a sampler may knit: beside one year, or beside two. */
export const allTrims: string[] = (() => {
  const years = [...new Set(baseSlots.map(yearOfSlot))];
  return [...years.map((y) => trimOf([y])), ...years.flatMap((a, i) => years.slice(i + 1).map((b) => trimOf([a, b])))];
})();

/** The commonest slot of a hat's yarn letter, for a round knitted plain in it. */
export const plainSlot = (year: number, letter: string): string => {
  if (year !== PRINTED) return yy(year) + letter;
  const counts = new Map<string, number>();
  for (const p of patterns.filter((x) => x.year === year)) {
    for (const r of topDown(year, p.full ?? [])) for (const s of slotsOfRow(year, r.chart, r.row)) if (s[2] === letter) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? yy(year) + letter + letter;
};
