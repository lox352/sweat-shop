import { lettersOf, patterns, topDown } from "./cuts";

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

/** The hat's own letter for a slot, in a printing: "1-2" or "3-4" for 2026. */
export const letterOf = (slot: string, printing?: string): string =>
  slot.length === 4 ? (printing && printing !== "1-2" ? slot[3] : slot[2]) : slot[2];

export const yearOfSlot = (slot: string): number => 2000 + Number(slot.slice(0, 2));

/** Every slot any cut of any year knits, in year order. */
export const allSlots: string[] = (() => {
  const seen = new Set<string>();
  for (const p of patterns) {
    const parts = [...p.options.flatMap((o) => o.parts), ...(p.full ?? [])];
    if (p.centred) parts.push([p.centred.chart, 1, lettersOf(p.year, p.centred.chart).length]);
    for (const r of topDown(p.year, parts)) for (const s of slotsOfRow(p.year, r.chart, r.row)) seen.add(s);
  }
  return [...seen].sort();
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
