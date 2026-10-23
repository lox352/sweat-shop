import { lettersOf } from "./cuts";
import roleData from "./roles.json";

/**
 * The hats' patterns as quanta: the pieces a strip is made of, which can't be
 * cut and whose foreground can't be altered, only spaced.
 *
 * - **A quantum** is a run of a chart's rows that goes together: a band of
 *   stars, a row of sheep, a peerie. Between quanta the count may change
 *   freely, and each is laid out on its own count, a whole number of its
 *   repeat, with nothing shared with the quanta either side.
 * - **Its kind.** A *free* quantum - a peerie, a seed round, a row of houses -
 *   can be put in or left out on its own. A *core* may have *frames*: borders
 *   that come in pairs, one either side, both or neither, and whole; frames
 *   nest outwards, each pair's level one more than the pair inside it.
 * - **Aligned or drifting.** Most frames drift: each is its own quantum. The
 *   frames of 2014's stars, 2021's lattice and 2026's centre band are
 *   aligned with their core: kept, they are knitted on the core's count and
 *   layout, so core and frames together are one quantum.
 * - **Foreground and background**, stitch by stitch: mostly by yarn, as each
 *   hat's yarns are ground or figure (roles.json); 2014's bands row by row;
 *   2025's by where a stitch lies, light yarns the ground inside its big
 *   diamonds and dark yarns outside them.
 *
 * And the one rule for shaping (see shaping.ts): **a column may be doubled
 * where no foreground stitch is in its chain of descendants** - knitted from
 * the top down, the column below it, to the end of its quantum. Read the
 * other way, for decreases, the chain is the column's ancestors, from the top
 * of its quantum down. In a mirror image a column goes with its mirror partner.
 */

export type Kind = "free" | "core" | "frame";

export interface Quantum {
  year: number;
  chart: string;
  /** Its rows, in the chart's own numbering, row 1 at the brim. */
  from: number;
  to: number;
  kind: Kind;
  name: string;
  /** A frame's nesting, 1 innermost; a core's is 0, a free quantum's too. */
  level: number;
  /** Which core a frame or core belongs with, where a hat has more than one. */
  group: string;
  /** Kept with its core on one count and layout (see above). */
  aligned: boolean;
}

type Entry = [kind: Kind, chart: string, from: number, to: number, name: string, level?: number, group?: string];

/** Each hat's quanta, from the brim up, as settled with the knitter. */
const TABLE: Record<number, Entry[]> = {
  2014: [
    ["free", "A", 1, 4, "Peerie"],
    ["frame", "B", 1, 3, "Border, below", 1, "B"],
    ["core", "B", 4, 10, "28-stitch stars", 0, "B"],
    ["frame", "B", 11, 13, "Border, above", 1, "B"],
    ["frame", "C", 1, 3, "Border, below", 1, "C"],
    ["core", "C", 4, 10, "24-stitch stars", 0, "C"],
    ["frame", "C", 11, 13, "Border, above", 1, "C"],
  ],
  2015: [
    ["free", "A", 2, 2, "Seeds"],
    ["free", "A", 4, 4, "Seeds"],
    ["free", "A", 6, 15, "Sheep"],
    ["free", "A", 17, 17, "Snow"],
    ["free", "A", 19, 19, "Snow"],
    ["free", "A", 21, 21, "Snow"],
    ["free", "A", 24, 24, "Snow"],
  ],
  2016: [
    ["free", "A", 10, 10, "Seed round"],
    ["free", "A", 12, 18, "Blue houses"],
    ["free", "A", 20, 20, "Seed round"],
    ["free", "A", 22, 28, "Brown houses"],
    ["free", "A", 30, 30, "Seed round"],
    ["free", "A", 32, 38, "Blue houses"],
    ["free", "A", 40, 40, "Seed round"],
  ],
  2017: [
    ["free", "A", 1, 7, "Zigzag, blue"],
    ["free", "A", 8, 14, "Zigzag, teal"],
  ],
  2018: [
    ["free", "B", 1, 3, "Plusses, the hat's border"],
    ["free", "B", 5, 13, "Dancers"],
    ["free", "B", 15, 23, "Plusses"],
    ["free", "B", 25, 33, "Dancers"],
  ],
  2019: [
    ["free", "B", 3, 3, "Seeds"],
    ["free", "C", 3, 14, "Sheep on the roadside"],
    ["free", "D", 1, 3, "Peerie"],
    ["free", "D", 4, 5, "Peerie"],
    ["free", "D", 6, 7, "Peerie"],
    ["free", "E", 1, 9, "Boat"],
    ["free", "E", 12, 12, "Seed round"],
  ],
  2020: [
    ["frame", "B", 3, 5, "Peerie", 1, "1"],
    ["core", "B", 7, 15, "Stars", 0, "1"],
    ["frame", "B", 17, 19, "Peerie", 1, "1"],
    ["frame", "B", 22, 24, "Zigzag", 1, "2"],
    ["core", "B", 26, 34, "Large stars", 0, "2"],
    ["frame", "B", 36, 38, "Zigzag", 1, "2"],
  ],
  2021: [
    ["frame", "B", 3, 7, "Border", 1],
    ["core", "B", 10, 26, "Lattice and crosses"],
    ["frame", "B", 29, 33, "Border", 1],
  ],
  2022: [
    ["frame", "B", 2, 6, "Peerie on A", 2],
    ["frame", "B", 9, 13, "Peerie on E", 1],
    ["core", "C", 2, 12, "Anchor"],
    ["frame", "D", 2, 6, "Peerie on E", 1],
    ["frame", "D", 9, 13, "Peerie on A", 2],
  ],
  2023: [
    ["frame", "B", 1, 4, "Peerie", 1],
    ["core", "C", 1, 25, "Buggiflooer"],
    ["frame", "D", 1, 4, "Peerie", 1],
  ],
  2024: [
    ["frame", "B", 1, 11, "Waves", 1],
    ["core", "C", 2, 14, "Ram"],
    ["frame", "D", 1, 11, "Waves, upside down", 1],
  ],
  2025: [["free", "A", 1, 16, "Allover"]],
  2026: [
    ["frame", "Body", 3, 10, "Outer bands", 3],
    ["frame", "Body", 11, 14, "Second band", 2],
    ["frame", "Body", 15, 18, "First band", 1],
    ["core", "Body", 19, 22, "Centre"],
    ["frame", "Body", 23, 26, "First band", 1],
    ["frame", "Body", 27, 30, "Second band", 2],
    ["frame", "Body", 31, 40, "Outer bands", 3],
  ],
};

/** The hats whose frames stay aligned with their core. */
const ALIGNED = new Set([2014, 2021, 2026]);

export const quanta: Quantum[] = Object.entries(TABLE).flatMap(([y, entries]) =>
  entries.map(([kind, chart, from, to, name, level = 0, group = ""]) => ({
    year: Number(y),
    chart,
    from,
    to,
    kind,
    name,
    level,
    group,
    aligned: ALIGNED.has(Number(y)) && kind !== "free",
  })),
);

/** The quantum a row of a hat's chart belongs to, if any: a row all of one yarn, between quanta, belongs to none. */
export const quantumOf = (year: number, chart: string, row: number): Quantum | undefined =>
  quanta.find((q) => q.year === year && q.chart === chart && q.from <= row && row <= q.to);

const roles = roleData as Record<string, { ground: string[] }>;

/** Each chart's letters, read once. */
const charts = new Map<string, string[][]>();
const chartOf = (year: number, chart: string): string[][] => {
  const key = `${year}${chart}`;
  let rows = charts.get(key);
  if (!rows) charts.set(key, (rows = lettersOf(year, chart)));
  return rows;
};

/** 2025's light yarns, which are its big diamonds. */
const LIGHT_2025 = new Set(["B", "D", "F", "H"]);

/**
 * Is stitch x of a row of a hat's chart background? x counts as the chart is
 * stored, the first stitch worked first.
 */
export const background = (year: number, chart: string, row: number, x: number): boolean => {
  const letters = chartOf(year, chart)[row - 1];
  const l = letters[x % letters.length];
  const edge = row <= 3 || row >= 11;
  if (year === 2014) {
    // The stars' light yarns are their motif, the points of the stars, on the dark around them; their borders'
    // points and sprinkles on the borders' ground; the peerie on the hat's ground.
    if (chart === "C") return edge ? l === "A" : l !== "D";
    if (chart === "B") return edge ? l === "C" : l !== "B" && l !== "D";
    return l === "B";
  }
  if (year === 2025) {
    // Light diamonds centred on stitch 9 and row 7, every 16 rows and 18 stitches, the dark between them.
    const dx = Math.min(Math.abs((x % 18) - 9), 18 - Math.abs((x % 18) - 9));
    const m = (((row - 7) % 16) + 16) % 16;
    const dy = Math.min(m, 16 - m);
    const inside = dx / 9 + dy / 8 <= 1 + 1e-9;
    return LIGHT_2025.has(l) === inside;
  }
  const ground = roles[year].ground;
  // A seed round of the hat's two skies is all sky.
  if ((year === 2016 || year === 2019) && new Set(letters).size === 2 && letters.every((c) => ground.includes(c))) return true;
  return ground.includes(l);
};

/**
 * Hats whose quanta, knitted one against the other with no plain round
 * between, go together as the knitter settled: 2017's two zigzags, and 2019's
 * small peerie bands and the waves the boat sails on.
 */
const TOGETHER: Record<number, string[]> = { 2017: ["A"], 2019: ["D", "E"] };

/**
 * Must a plain round go between these two rows of a hat, knitted one after
 * the other? Yes where they are two quanta that don't belong together - a
 * peerie against a band of stars, two separate bands - and neither is a round
 * all of one yarn already: without one, the two run into each other. Not
 * within a quantum, a core and its aligned frames, or quanta that go together.
 */
export const plainBetween = (year: number, a: { chart: string; row: number }, b: { chart: string; row: number }): boolean => {
  const plain = (r: { chart: string; row: number }) => new Set(chartOf(year, r.chart)[r.row - 1]).size === 1;
  if (plain(a) || plain(b)) return false;
  const qa = quantumOf(year, a.chart, a.row);
  const qb = quantumOf(year, b.chart, b.row);
  if (!qa || !qb || qa === qb) return false;
  if (qa.aligned && qb.aligned && qa.chart === qb.chart && qa.group === qb.group) return false;
  const together = TOGETHER[year];
  return !(together?.includes(a.chart) && together.includes(b.chart));
};
