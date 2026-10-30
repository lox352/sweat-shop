import { yearOf } from "../years";
import { plainBetween } from "./quanta";

/**
 * Each hat's body pattern as the building blocks of a strip: the ways it can
 * be cut, from a motif alone up to the hat's whole sequence, and the rows
 * each takes. A part is [chart, from, to] in the hat chart's own numbering,
 * row 1 at the brim; a cut's parts run from the bottom of the hat up, and on
 * the jumper read the same way up.
 *
 * Where a pattern mirrors about a centre line - 2021's, 2023's, 2025's and
 * 2026's - any even cut about the centre is a cut too (see cutsOf), so those
 * can be any height their strip needs.
 */
export type Part = [chart: string, from: number, to: number];

export interface Option {
  label: string;
  parts: Part[];
}

export interface Pattern {
  year: number;
  options: Option[];
  /** The hat's own sequence, which a sleeve carries on through below the body's cut. */
  full?: Part[];
  /** Cropped evenly about a centre: the chart, the centre (a row, or between two), the most rows each side, and the rows the neatest cuts start at. */
  centred?: { chart: string; centre: number; most: number; neat: number[] };
}

export const patterns: Pattern[] = [
  {
    year: 2014,
    full: [["A", 1, 4], ["B", 1, 13], ["A", 1, 4], ["C", 1, 13], ["A", 1, 4]],
    options: [
      { label: "Chart C, the whole star", parts: [["C", 1, 13]] },
      { label: "Chart C between peeries", parts: [["A", 1, 4], ["C", 1, 13], ["A", 1, 4]] },
      { label: "Both stars", parts: [["B", 1, 13], ["C", 1, 13]] },
      { label: "Both stars, peerie between", parts: [["B", 1, 13], ["A", 1, 4], ["C", 1, 13]] },
      { label: "As the hat", parts: [["A", 1, 4], ["B", 1, 13], ["A", 1, 4], ["C", 1, 13], ["A", 1, 4]] },
    ],
  },
  {
    year: 2015,
    options: [
      { label: "Sheep", parts: [["A", 6, 15]] },
      { label: "Sheep between checks", parts: [["A", 3, 18]] },
      { label: "With seeds and the first snow", parts: [["A", 1, 20]] },
      { label: "As the hat, all the sky", parts: [["A", 1, 25]] },
    ],
  },
  {
    year: 2016,
    options: [
      { label: "One strip of houses", parts: [["A", 21, 29]] },
      { label: "One strip between seed rounds", parts: [["A", 19, 31]] },
      { label: "Two strips", parts: [["A", 11, 29]] },
      { label: "Three strips", parts: [["A", 11, 39]] },
      { label: "Three strips with seed borders", parts: [["A", 9, 41]] },
    ],
  },
  {
    year: 2017,
    options: [
      { label: "One band", parts: [["A", 1, 7]] },
      { label: "Two bands", parts: [["A", 1, 14]] },
      { label: "Three bands", parts: [["A", 1, 14], ["A", 1, 7]] },
      { label: "Four bands", parts: [["A", 1, 14], ["A", 1, 14]] },
      { label: "Five bands", parts: [["A", 1, 14], ["A", 1, 14], ["A", 1, 7]] },
      { label: "Seven bands, as the hat", parts: [["A", 1, 14], ["A", 1, 14], ["A", 1, 14], ["A", 1, 7]] },
    ],
  },
  {
    year: 2018,
    options: [
      { label: "Dancers", parts: [["B", 4, 14]] },
      { label: "Plusses", parts: [["B", 14, 24]] },
      { label: "Dancers between two plus rows", parts: [["B", 1, 17]] },
      { label: "Dancers and plusses", parts: [["B", 4, 24]] },
      { label: "Dancers, plusses, dancers", parts: [["B", 4, 34]] },
      { label: "As the hat", parts: [["B", 1, 34]] },
    ],
  },
  {
    year: 2019,
    options: [
      { label: "Sheep", parts: [["C", 3, 14]] },
      { label: "Sheep with their one-colour rounds", parts: [["C", 1, 16]] },
      { label: "Boat on the waves", parts: [["D", 1, 7], ["E", 1, 12]] },
      { label: "Sheep and boat", parts: [["C", 3, 14], ["E", 1, 12]] },
      { label: "As the hat", parts: [["B", 1, 3], ["C", 1, 16], ["D", 1, 7], ["E", 1, 12]] },
    ],
  },
  {
    year: 2020,
    options: [
      { label: "First stars", parts: [["B", 6, 16]] },
      { label: "First stars with their peeries", parts: [["B", 3, 19]] },
      { label: "Second stars with their peeries", parts: [["B", 22, 38]] },
      { label: "Both star bands", parts: [["B", 6, 35]] },
      { label: "As the hat", parts: [["B", 1, 40]] },
    ],
  },
  {
    year: 2021,
    centred: { chart: "B", centre: 18, most: 8, neat: [16, 13, 10] },
    options: [
      { label: "Centre, inmost", parts: [["B", 16, 20]] },
      { label: "Centre, middle", parts: [["B", 13, 23]] },
      { label: "Centre", parts: [["B", 10, 26]] },
      { label: "Centre with one-colour rounds", parts: [["B", 8, 28]] },
      { label: "With its borders", parts: [["B", 3, 33]] },
    ],
  },
  {
    year: 2022,
    options: [
      { label: "Anchors", parts: [["C", 1, 13]] },
      { label: "Anchors and waves", parts: [["B", 8, 14], ["C", 1, 13], ["D", 1, 7]] },
      { label: "Anchors, waves and ropes", parts: [["B", 1, 14], ["C", 1, 13], ["D", 1, 14]] },
    ],
  },
  {
    year: 2023,
    centred: { chart: "C", centre: 13, most: 12, neat: [10, 6, 4, 1] },
    options: [
      { label: "Flower centres", parts: [["C", 10, 16]] },
      { label: "Flowers, cropped", parts: [["C", 6, 20]] },
      { label: "Flowers", parts: [["C", 1, 25]] },
      { label: "Flowers between peeries", parts: [["B", 1, 4], ["C", 1, 25], ["D", 1, 4]] },
    ],
  },
  {
    year: 2024,
    options: [
      { label: "Rams", parts: [["C", 1, 15]] },
      { label: "Rams between zigzags", parts: [["B", 5, 11], ["C", 1, 15], ["D", 1, 7]] },
      { label: "As the hat", parts: [["B", 1, 11], ["C", 1, 15], ["D", 1, 12]] },
    ],
  },
  {
    year: 2025,
    centred: { chart: "A", centre: 7, most: 6, neat: [6, 4, 1] },
    options: [
      { label: "Three strips", parts: [["A", 1, 13]] },
      { label: "With the dotted strip", parts: [["A", 1, 16]] },
      { label: "Twice, dotted strip between", parts: [["A", 1, 16], ["A", 1, 13]] },
      { label: "As the hat", parts: [["A", 1, 16], ["A", 1, 16], ["A", 1, 13]] },
    ],
  },
  {
    year: 2026,
    full: [["Body", 1, 40]],
    centred: { chart: "Body", centre: 20.5, most: 13, neat: [19, 15, 11, 7] },
    options: [
      { label: "Cropped to 28", parts: [["Body", 7, 34]] },
      { label: "As the hat", parts: [["Body", 3, 40]] },
    ],
  },
];

export const patternOf = (year: number): Pattern => {
  const found = patterns.find((p) => p.year === year);
  if (!found) throw new Error(`no cuts for ${year}`);
  return found;
};

/**
 * Misprints in a hat's chart, put right: by year, chart, row and stitch,
 * counted as the charts are, and the yarn the stitch is knitted in. The
 * year files keep each chart as it is printed. 2014's chart B prints one
 * stitch a repeat of row 7 white, Yarn D; but its own table gives that row
 * only Yarns A and B, and the stitch's mirror in the row, its first, is B.
 * Taken as printed, it was the only row of all thirteen hats in three yarns,
 * and in the samplers' colourways often a dark spot in a pale round.
 */
const inTwoYarns: { year: number; chart: string; row: number; stitch: number; yarn: string }[] = [
  { year: 2014, chart: "B", row: 7, stitch: 27, yarn: "B" },
];

/** A hat chart's rows as yarn letters, bottom row first, each row's first stitch first: in its first printing, or another. */
export const lettersOf = (year: number, chart: string, printing?: string): string[][] => {
  const y = yearOf(year);
  if (printing) {
    const rows = y.printings?.[printing]?.[chart];
    if (!rows) throw new Error(`${year} has no chart ${chart} in printing ${printing}`);
    return rows.map((row) => [...row]);
  }
  const rows = y.charts[chart];
  if (!rows) throw new Error(`${year} has no chart ${chart}`);
  const letters = rows.map((row) => (row.match(/../g) ?? []).map((pair) => pair[0]));
  for (const at of inTwoYarns) if (at.year === year && at.chart === chart) letters[at.row - 1][at.stitch - 1] = at.yarn;
  return letters;
};

export const solid = (row: string[]): boolean => new Set(row).size === 1;

/** The true repeat of these rows of a chart: the shortest every row repeats in. */
export const periodOf = (year: number, chart: string, from: number, to: number): number => {
  const rows = lettersOf(year, chart).slice(from - 1, to);
  const w = rows[0].length;
  for (let p = 1; p < w; p++) if (w % p === 0 && rows.every((r) => r.every((c, j) => c === r[j % p]))) return p;
  return w;
};

export interface Cut extends Option {
  height: number;
  /** Rows without the one-colour rounds at its edges, which can be taken off. */
  core: number;
  edgeTop: number;
  edgeBottom: number;
  /** One of the neat cuts: a whole block, or a centred cut at a colour band's edge. */
  neat: boolean;
}

/** Every cut of a year, with the even crops about its centre added. */
export const cutsOf = (year: number): Cut[] => {
  const p = patternOf(year);
  const options: (Option & { neat: boolean })[] = p.options.map((o) => ({ ...o, neat: true }));
  if (p.centred) {
    const { chart, centre, most, neat } = p.centred;
    for (let k = 1; k <= most; k++) {
      // About a line between two rows, k rows each side; about a row, that row and k each side.
      const from = centre % 1 ? centre + 0.5 - k : centre - k;
      const to = centre % 1 ? centre - 0.5 + k : centre + k;
      if (options.some((o) => o.parts.length === 1 && o.parts[0][1] === from && o.parts[0][2] === to)) continue;
      options.push({ label: `Cropped to ${to - from + 1}`, parts: [[chart, from, to]], neat: neat.includes(from) });
    }
  }
  return options.map((o) => measured(year, o));
};

/**
 * A cut of a year with its heights worked out: all its rows, and those between
 * its one-colour edge rounds - each with the plain rounds that must go between
 * two of its quanta that meet (see quanta's plainBetween).
 */
export const measured = (year: number, o: Option & { neat: boolean }): Cut => {
  const rows = o.parts.flatMap(([c, a, b]) => lettersOf(year, c).slice(a - 1, b));
  let a = 0;
  let b = rows.length;
  while (a < b && solid(rows[a])) a++;
  while (b > a && solid(rows[b - 1])) b--;
  const seams = seamsOf(year, topDown(year, o.parts)).length;
  return { ...o, height: rows.length + seams, core: b - a + seams, edgeBottom: a, edgeTop: rows.length - b };
};

/** Where a cut's rows, from the top down, need a plain round put between them: before each of these. */
export const seamsOf = (year: number, rows: CutRow[]): number[] => rows.flatMap((r, k) => (k > 0 && plainBetween(year, rows[k - 1], r) ? [k] : []));

/** The cut whose height comes nearest `motif` rounds, by plain rounds added or one-colour edge rounds taken off. */
export const choose = (cuts: Cut[], motif: number, wantLonger = false): Cut => {
  let best: Cut | undefined;
  let cost = Infinity;
  for (const o of cuts) {
    let c: number;
    if (motif >= o.height) c = (motif - o.height) * (wantLonger ? 0.6 : 1);
    else if (motif >= o.core) c = (o.height - motif) * 0.4;
    else c = Infinity;
    if (!o.neat) c += 1.5;
    if (c < cost) {
      cost = c;
      best = o;
    }
  }
  if (!best) throw new Error(`no cut of ${motif} rounds`);
  return best;
};

/** A row of a cut, as the jumper knits it: from the top of the hat down. */
export interface CutRow {
  chart: string;
  row: number;
  /** The repeat this row is worked on. */
  w: number;
}

export const topDown = (year: number, parts: Part[]): CutRow[] =>
  [...parts].reverse().flatMap(([chart, a, b]) => {
    const w = periodOf(year, chart, a, b);
    return Array.from({ length: b - a + 1 }, (_, k) => ({ chart, row: b - k, w }));
  });

/** A cut's ground: its commonest yarn. */
export const groundOf = (year: number, parts: Part[]): string => {
  const n = new Map<string, number>();
  for (const [c, a, b] of parts) for (const r of lettersOf(year, c).slice(a - 1, b)) for (const x of r) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n].sort((p, q) => q[1] - p[1])[0][0];
};

/** A round while a strip is being laid out: a row of one of its year's charts, or plain in one of its yarns. */
export type Round = ({ year: number } & CutRow) | { year: number; plain: string };

export const lettersOfRound = (r: Round): string[] => ("plain" in r ? [r.plain] : lettersOf(r.year, r.chart)[r.row - 1]);
export const isPlain = (r: Round) => solid(lettersOfRound(r));

/** A pattern's background at an edge: the commonest yarn over the three rows nearest it, how much of them it is, and whether the edge row is plain. */
export const edgeOf = (rows: Round[], top: boolean) => {
  const near = (top ? rows.slice(0, 3) : rows.slice(-3)).map(lettersOfRound);
  const n = new Map<string, number>();
  let all = 0;
  for (const r of near) {
    for (const c of r) {
      n.set(c, (n.get(c) ?? 0) + 1 / r.length);
      all += 1 / r.length;
    }
  }
  const [letter, count] = [...n].sort((a, b) => b[1] - a[1])[0];
  return { letter, share: count / all, plain: isPlain(top ? rows[0] : rows[rows.length - 1]) };
};
