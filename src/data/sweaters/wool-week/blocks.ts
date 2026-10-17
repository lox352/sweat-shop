import type { Chart, SlotId } from "../types";
import { recoloured, rotated, rowsOf } from "../writing";
import ladder from "./ladder.json";
import { hatChart, yearOf } from "./years";

/**
 * Each year of the sampler as a block of knitting: the hat's bands in the
 * order a top-down jumper meets them, in the jumper's yarns.
 *
 * A hat is knitted from its brim up, and a jumper from its neck down, so a
 * year's block is its hat turned through half a circle: the crown end first,
 * every chart turned (see writing's rotated), so that the sheep, the houses,
 * the ram and the boat all stand the right way up on the jumper as worn.
 *
 * A block is parts, and a part is either one of the hat's own motifs - which
 * every size knits - or an extra: a peerie, the coloured stripes between the
 * bands, the rows where a chart repeats or mirrors itself, a crown. Extras are
 * what grade the sizes (see grade.ts): a bigger jumper is longer, and the
 * rounds it has over are filled with them, the lowest priority first.
 */

/** The jumper's yarn for a hat's: see ladder.json and scripts/ladder.mjs. */
export const slotFor = (year: number, slot: SlotId): SlotId => {
  const map = (ladder.maps as Record<string, Record<string, string>>)[String(year)];
  const found = map?.[slot];
  if (!found) throw new Error(`${year}'s yarn ${slot} is not on the ladder`);
  return found;
};

export type Item =
  /** A band of a chart, knitted at a whole number of its repeats. */
  | { kind: "band"; chart: Chart }
  /** Plain rounds in one yarn. */
  | { kind: "plain"; slot: SlotId; rows: number }
  /**
   * A slice of the hat's crown, cut to whatever the size needs (see grade.ts):
   * worked "up" on the yoke - from its point, increasing, as it sits on the
   * hat - or "down" on a sleeve, decreasing as the hat knits it, its point
   * towards the cuff.
   */
  | { kind: "crown"; crown: Chart; way: "up" | "down" };

export interface Part {
  label: string;
  items: Item[];
  /** Left out, an extra: the lower its priority, the sooner a size with rounds to spare puts it back. */
  priority?: 1 | 2;
}

export interface Block {
  year: number;
  name: string;
  parts: Part[];
}

const hatName = (year: number) => `${year} ${yearOf(year).name}`;

/** Rows of a hat chart, turned for knitting top down and in the jumper's yarns. */
const band = (year: number, chart: string, from: number, to: number, what: string): Item => {
  const hat = hatChart(year, chart, `${year}-${chart}`, hatName(year));
  const map = Object.fromEntries(
    [...new Set(hat.rows.flat().map((cell) => cell.slot))].map((slot) => [slot, slotFor(year, slot)]),
  );
  const id = `y${year % 100}-${chart}-${from}-${to}`;
  return { kind: "band", chart: rotated(recoloured(rowsOf(hat, from, to, id), map), id, `${hatName(year)}, ${what}`) };
};

const plain = (year: number, slot: SlotId, rows: number): Item => ({ kind: "plain", slot: slotFor(year, slot), rows });

const crown = (year: number, chart: string, way: "up" | "down"): Item => {
  const hat = hatChart(year, chart, `y${year % 100}-${chart}`, `${hatName(year)}, crown`);
  const map = Object.fromEntries(
    [...new Set(hat.rows.flat().map((cell) => cell.slot))].map((slot) => [slot, slotFor(year, slot)]),
  );
  return { kind: "crown", crown: recoloured(hat, map), way };
};

/*
 * The years, top down. Each says which rows are its motifs and which are
 * extras; where a chart repeats or mirrors itself, the repeat is an extra,
 * so every motif is still there in the smallest size.
 */
export const blocks: Block[] = [
  {
    year: 2014,
    name: hatName(2014),
    parts: [
      { label: "crown", items: [crown(2014, "D", "up")], priority: 2 },
      { label: "stripes", items: [plain(2014, "A", 2)], priority: 1 },
      { label: "Chart C", items: [band(2014, "C", 1, 13, "chart C")] },
      { label: "peerie", items: [plain(2014, "A", 1), plain(2014, "B", 2), band(2014, "A", 1, 4, "peerie"), plain(2014, "B", 2)], priority: 2 },
      { label: "stripes", items: [plain(2014, "C", 2)], priority: 1 },
      { label: "Chart B", items: [band(2014, "B", 1, 13, "chart B")] },
      { label: "stripes", items: [plain(2014, "C", 2)], priority: 1 },
      { label: "peerie", items: [plain(2014, "B", 2), band(2014, "A", 1, 4, "peerie"), plain(2014, "B", 2), plain(2014, "A", 1)], priority: 2 },
    ],
  },
  {
    year: 2015,
    name: hatName(2015),
    parts: [
      { label: "crown", items: [crown(2015, "A", "up")], priority: 2 },
      { label: "sky", items: [band(2015, "A", 19, 25, "the snowy sky")], priority: 1 },
      { label: "sheep", items: [band(2015, "A", 1, 18, "the sheep")] },
    ],
  },
  {
    year: 2016,
    name: hatName(2016),
    parts: [
      { label: "crown", items: [crown(2016, "B", "up")], priority: 2 },
      { label: "houses again", items: [band(2016, "A", 30, 41, "the houses again")], priority: 1 },
      { label: "houses", items: [band(2016, "A", 11, 29, "the crofthooses")] },
      { label: "seeds", items: [band(2016, "A", 9, 10, "seeds")], priority: 2 },
    ],
  },
  {
    year: 2017,
    name: hatName(2017),
    parts: [
      { label: "all-over", items: [band(2017, "A", 1, 14, "the all-over pattern")] },
      { label: "all-over again", items: [band(2017, "A", 1, 14, "the all-over pattern")], priority: 2 },
    ],
  },
  {
    year: 2018,
    name: hatName(2018),
    parts: [
      { label: "dancers again", items: [band(2018, "B", 24, 34, "the dancers again")], priority: 1 },
      { label: "dancers", items: [band(2018, "B", 1, 23, "the merrie dancers")] },
    ],
  },
  {
    year: 2019,
    name: hatName(2019),
    parts: [
      { label: "boat", items: [band(2019, "E", 1, 12, "the boat")] },
      { label: "peerie", items: [band(2019, "D", 1, 7, "peerie")], priority: 2 },
      { label: "sheep", items: [band(2019, "C", 1, 16, "the sheep")] },
      { label: "seeds", items: [band(2019, "B", 1, 3, "seeds")], priority: 2 },
    ],
  },
  {
    year: 2020,
    name: hatName(2020),
    parts: [
      { label: "outer band", items: [band(2020, "B", 36, 40, "the outer band")], priority: 1 },
      { label: "stars", items: [band(2020, "B", 6, 35, "the stars")] },
      { label: "outer band", items: [band(2020, "B", 1, 5, "the outer band")], priority: 1 },
    ],
  },
  {
    year: 2021,
    name: hatName(2021),
    parts: [
      { label: "outer band", items: [band(2021, "B", 29, 35, "the outer band")], priority: 1 },
      { label: "lattice", items: [band(2021, "B", 1, 28, "the lattice")] },
    ],
  },
  {
    year: 2022,
    name: hatName(2022),
    parts: [
      { label: "chart D", items: [band(2022, "D", 1, 14, "chart D")], priority: 1 },
      { label: "chart C", items: [band(2022, "C", 1, 13, "chart C")] },
      { label: "chart B", items: [band(2022, "B", 1, 14, "chart B")] },
      { label: "crown", items: [crown(2022, "E", "down")], priority: 2 },
    ],
  },
  {
    year: 2023,
    name: hatName(2023),
    parts: [
      { label: "peerie", items: [band(2023, "D", 1, 4, "peerie")], priority: 2 },
      { label: "flowers", items: [band(2023, "C", 1, 25, "the buggiflooers")] },
      { label: "peerie", items: [band(2023, "B", 1, 4, "peerie")], priority: 2 },
      { label: "crown", items: [crown(2023, "E", "down")], priority: 2 },
    ],
  },
  {
    year: 2024,
    name: hatName(2024),
    parts: [
      { label: "waves", items: [band(2024, "D", 1, 12, "the waves")], priority: 1 },
      { label: "ram", items: [band(2024, "C", 1, 15, "the ram")] },
      { label: "waves", items: [band(2024, "B", 1, 11, "the waves")] },
      { label: "crown", items: [crown(2024, "E", "down")], priority: 2 },
    ],
  },
  {
    year: 2025,
    name: hatName(2025),
    parts: [
      { label: "all-over", items: [band(2025, "A", 1, 16, "the all-over pattern")] },
      { label: "all-over again", items: [band(2025, "A", 1, 16, "the all-over pattern")], priority: 2 },
      { label: "crown", items: [crown(2025, "B", "down")], priority: 2 },
    ],
  },
  {
    year: 2026,
    name: hatName(2026),
    parts: [
      { label: "lattice", items: [band(2026, "Body", 3, 40, "the lattice")] },
      { label: "edge", items: [band(2026, "Body", 1, 2, "plain")], priority: 1 },
      { label: "crown", items: [crown(2026, "Crown", "down")], priority: 2 },
    ],
  },
];

/** A brim, as a hem or cuff: its rows turned for top-down, so the hat's first row comes last, at the edge. */
export const brim = (year: number, chart: string, from: number, to: number, id: string): Chart => {
  const hat = hatChart(year, chart, id, `${hatName(year)}, brim`);
  const map = Object.fromEntries(
    [...new Set(hat.rows.flat().map((cell) => cell.slot))].map((slot) => [slot, slotFor(year, slot)]),
  );
  return { ...rotated(recoloured(rowsOf(hat, from, to, id), map), id), fabric: "rib" };
};
