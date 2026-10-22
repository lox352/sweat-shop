import type { Chart, ChartCell, RoundSpec, Section } from "../../types";
import { decreaseEvenly, increaseEvenly } from "../../writing";
import { yearOf } from "../years";
import { lettersOf, solid } from "./cuts";
import type { Fan } from "./fans";
import { gauge, ribs, type Measured, type Plan, type Row } from "./plan";
import roleData from "./roles.json";
import { letterOf, plainSlot, slotsOfRow, trimSlot } from "./slots";

/**
 * A strip sampler's plan, knitted: its sections, charts and stated counts.
 *
 * - **The yoke** grows from the neck to the divide, every band on a whole
 *   number of its repeats. It may grow at any plain round, at any round of a
 *   band knitted all in one colour, and - where a band of another repeat
 *   starts with no plain round before it - in that band's first round, with
 *   its make-ones worked in pattern. A plan may say how its first rounds
 *   grow instead (see fans): bands that fan out, a column doubled at a time.
 * - **The body** stays at the chest, every band on a whole number of its
 *   repeats, changing where it must in the same ways.
 * - **The sleeves** taper evenly, two stitches at a time either side of a
 *   seam stitch under the arm, from the upper arm to the cuff. A band on a
 *   sleeve need not fit its repeat: each is centred on the top of the arm,
 *   and its repeats meet part-way at the seam. So each sleeve strip is one
 *   chart the width of the whole round, its decreases charted at the seam.
 */

/** Each hat's yarns as ground, figure or middle: see scripts/strip-colourways.mjs. */
const roles = roleData as Record<string, { ground: string[] }>;

const nearest = (v: number, m: number) => Math.max(m, Math.round(v / m) * m);

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
};
/** How light a slot's yarn is in its hat's first colourway: for choosing the darkest yarn of a round or a year. */
const lightness = (slot: string): number => {
  const year = 2000 + Number(slot.slice(0, 2));
  return lum(yearOf(year).colourway.shades[letterOf(slot)].hex);
};
const darkest = (slots: string[]) => slots.reduce((d, s) => (lightness(s) < lightness(d) ? s : d));

type ChartRow = Exclude<Row, { plain: string }>;
const isPlain = (r: Row): r is { year: number; plain: string } => "plain" in r;
/** A chart row's slots on its repeat, as knitted: right to left. */
const tileOf = (r: ChartRow): string[] => slotsOfRow(r.year, r.chart, r.row).slice(0, r.w).reverse();
const rowIsSolid = (r: Row) => !isPlain(r) && solid(lettersOf(r.year, r.chart)[r.row - 1]);
const slotOfRound = (r: Row): string => (isPlain(r) ? plainSlot(r.year, r.plain) : tileOf(r)[0]);

export interface Knitted {
  sections: Section[];
  charts: Chart[];
  checks: Record<string, number>;
}

/** A band's repeat with columns doubled: each of the hat's columns, as many times as it now has. */
const widened = (w: number, doubled: Record<number, number>): number[] =>
  Array.from({ length: w }, (_, x) => Array<number>(1 + (doubled[x] ?? 0)).fill(x)).flat();
/** Which columns a widened repeat doubles, for a chart's id: "6.18", or "12+" for a column doubled twice. */
const doubling = (map: number[]): string => {
  const n = new Map<number, number>();
  for (const x of map) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n].filter(([, k]) => k > 1).map(([x, k]) => `${x}${"+".repeat(k - 2)}`).join(".");
};
/** The places in a widened repeat that are new: each copy of a column after those it had. */
const added = (before: number[], after: number[]): Set<number> => {
  const fresh = new Set<number>();
  let i = 0;
  after.forEach((x, q) => (i < before.length && before[i] === x ? i++ : fresh.add(q)));
  return fresh;
};

/** Specs for rounds worked on a whole number of repeats, gathering a band's rows into one chart. */
class Writer {
  specs: RoundSpec[] = [];
  charts = new Map<string, Chart>();
  private run: { key: string; year: number; chart: string; w: number; rows: ChartRow[]; map?: number[] } | null = null;

  constructor(private readonly prefix: string) {}

  private flush() {
    if (!this.run) return;
    const { year, chart, w, rows, map } = this.run;
    const id = `${this.prefix}${String(year).slice(2)}${chart}${rows[0].row}-${rows[rows.length - 1].row}w${w}${map ? `x${doubling(map)}` : ""}`;
    if (!this.charts.has(id)) {
      const cells = (r: ChartRow) => (map ? map.map((x) => tileOf(r)[x]) : tileOf(r)).map((slot) => ({ slot }));
      this.charts.set(id, { id, name: `${year} ${yearOf(year).name}`, rows: rows.map(cells) });
    }
    this.specs.push({ type: "chart", chart: id, rows: [1, rows.length] });
    this.run = null;
  }

  /** A row of a band, at the count on the needle: on the hat's repeat, or on one widened by doubling columns. */
  chart(r: ChartRow, map?: number[]) {
    const wide = map && map.length !== r.w ? map : undefined;
    const key = `${r.year}${r.chart}${r.w}${wide ? doubling(wide) : ""}`;
    const prev = this.run?.rows[this.run.rows.length - 1];
    if (this.run && (this.run.key !== key || prev!.row !== r.row + 1)) this.flush();
    if (!this.run) this.run = { key, year: r.year, chart: r.chart, w: wide ? wide.length : r.w, rows: [], map: wide };
    this.run.rows.push(r);
  }

  /**
   * A band's row that doubles columns of its repeat, the same in every repeat:
   * each new stitch knitted out of the stitch below its twin, a KFB and its
   * second loop - one stitch made into two.
   */
  double(r: ChartRow, before: number[], after: number[]) {
    this.flush();
    const tile = tileOf(r);
    const fresh = added(before, after);
    const cells: ChartCell[] = after.map((x, q) =>
      fresh.has(q) ? { slot: tile[x], symbol: "m1" } : fresh.has(q + 1) ? { slot: tile[x], symbol: "kfb" } : { slot: tile[x] },
    );
    const id = `${this.prefix}${String(r.year).slice(2)}${r.chart}${r.row}d${doubling(before) || "0"}-${doubling(after)}`;
    this.charts.set(id, { id, name: `${r.year} ${yearOf(r.year).name}`, rows: [cells] });
    this.specs.push({ type: "chart", chart: id, rows: [1, 1] });
  }

  /** A band's first row on more stitches than the round below: make-ones at these columns of every repeat, in pattern. */
  start(r: ChartRow, at: number[]) {
    this.flush();
    const cells: ChartCell[] = tileOf(r).map((slot, x) => (at.includes(x) ? { slot, symbol: "m1" } : { slot }));
    const id = `${this.prefix}${String(r.year).slice(2)}${r.chart}${r.row}s${at.join(".")}`;
    this.charts.set(id, { id, name: `${r.year} ${yearOf(r.year).name}`, rows: [cells] });
    this.specs.push({ type: "chart", chart: id, rows: [1, 1] });
  }

  plain(slot: string) {
    this.flush();
    const last = this.specs[this.specs.length - 1];
    if (last?.type === "rounds" && last.slot === slot && !last.sequence) this.specs[this.specs.length - 1] = { ...last, count: last.count + 1 };
    else this.specs.push({ type: "rounds", count: 1, slot });
  }

  /** A plain round, or a round of one colour, that takes the count from `from` to `to`. */
  shape(slot: string, from: number, to: number) {
    this.flush();
    this.specs.push({ type: "shaping", slot, ops: to > from ? increaseEvenly(from, to) : decreaseEvenly(from, to), to });
  }

  /**
   * A band's row that changes the count itself: make-ones (or k2togs) spread
   * evenly round, each new stitch knitted in the colour the pattern has there.
   */
  transition(r: ChartRow, from: number, to: number) {
    this.flush();
    const tile = tileOf(r);
    // The new stitches (or the k2togs) at evenly spaced places among the round's `to`.
    const change = Math.abs(to - from);
    const at = new Set(Array.from({ length: change }, (_, k) => Math.floor(((k + 0.5) * to) / change)));
    const symbol = to > from ? "m1" : "k2tog";
    const cells: ChartCell[] = Array.from({ length: to }, (_, j) => (at.has(j) ? { slot: tile[j % tile.length], symbol } : { slot: tile[j % tile.length] }));
    const id = `${this.prefix}${String(r.year).slice(2)}${r.chart}${r.row}t${from}-${to}`;
    this.charts.set(id, { id, name: `${r.year} ${yearOf(r.year).name}`, rows: [cells] });
    this.specs.push({ type: "chart", chart: id, rows: [1, 1], repeats: 1 });
  }

  done() {
    this.flush();
    return this.specs;
  }
}

/** The count a band of repeat `w` goes at, nearest `want`; on the yoke never less than the needle has, nor more than twice. */
const countFor = (w: number, want: number, now: number, growing: boolean): number => {
  let n = nearest(want, w);
  if (growing) {
    if (n < now) n += w * Math.ceil((now - n) / w);
    while (n > 2 * now) n -= w;
  } else {
    while (n > 2 * now) n -= w;
    while (2 * (now - n) > now) n += w;
  }
  return n;
};

/**
 * How far behind a growing yoke may fall - for how many rounds, and by what
 * part of its count - before it increases in pattern rather than wait for a
 * round between strips.
 */
const STRAIN = { rounds: 8, behind: 0.25 };

/**
 * Rounds worked on whole repeats, at the count `want` asks for: shaping where
 * a round is plain or one colour, in pattern where a band must change and
 * cannot wait. A yoke that goes STRAIN rounds of one band unshaped while it
 * falls well behind increases in pattern too: otherwise a tall band
 * at the neck, as 2026's is when the newest year comes first, is a tube where
 * the yoke should spread. The last round leaves `last(count)`.
 */
const tiled = (w: Writer, rows: Row[], start: number, want: (i: number) => number, growing: boolean, last: (n: number) => number): number => {
  let count = start;
  let since = 0;
  rows.forEach((r, i) => {
    const repeat = isPlain(r) ? (rows.slice(i).find((x) => !isPlain(x)) as ChartRow | undefined)?.w ?? 1 : r.w;
    const shapeable = isPlain(r) || rowIsSolid(r);
    let to = count;
    if (i === rows.length - 1) to = last(count);
    else if (shapeable) to = countFor(repeat, want(i), count, growing);
    else if (count % repeat !== 0) to = countFor(repeat, count, count, growing);
    else if (growing && since >= STRAIN.rounds && want(i) >= count * (1 + STRAIN.behind) && want(i) >= count + repeat) to = countFor(repeat, want(i), count, growing);
    since = to === count ? since + 1 : 0;
    if (to !== count && shapeable) w.shape(slotOfRound(r), count, to);
    else if (to !== count) w.transition(r as ChartRow, count, to);
    else if (isPlain(r)) w.plain(plainSlot(r.year, r.plain));
    else w.chart(r);
    count = to;
  });
  return count;
};

/**
 * A plan's first yoke rounds, grown as its fans say: plain rounds to their
 * counts, and bands that widen a doubled column at a time. Returns the count
 * they leave.
 */
const fanned = (w: Writer, rows: Row[], start: number, steps: Fan[]): number => {
  let count = start;
  let band = "";
  let doubled: Record<number, number> = {};
  steps.forEach((step, i) => {
    const r = rows[i];
    if (isPlain(r)) {
      if (typeof step !== "number") throw new Error(`round ${i + 1} of the yoke is plain, and its fan is not a count`);
      if (step !== count) w.shape(plainSlot(r.year, r.plain), count, step);
      else w.plain(plainSlot(r.year, r.plain));
      count = step;
      band = "";
      return;
    }
    if (typeof step === "number") throw new Error(`round ${i + 1} of the yoke is ${r.year}'s chart ${r.chart}, and its fan is a count`);
    if (`${r.year}${r.chart}` !== band) {
      band = `${r.year}${r.chart}`;
      doubled = {};
    }
    if (step && "start" in step) {
      if (step.start - count !== (step.start / r.w) * step.at.length) throw new Error(`${r.year}'s chart ${r.chart} can't start on ${step.start} from ${count}`);
      w.start(r, step.at);
      count = step.start;
      return;
    }
    const before = widened(r.w, doubled);
    if (count % before.length) throw new Error(`${r.year}'s chart ${r.chart} row ${r.row} won't go on ${count} stitches`);
    if (step && "double" in step) {
      for (const x of step.double) doubled[x] = (doubled[x] ?? 0) + 1;
      const after = widened(r.w, doubled);
      w.double(r, before, after);
      count = (count / before.length) * after.length;
      return;
    }
    w.chart(r, before);
  });
  return count;
};

export const knit = (size: Measured, plan: Plan, prefix: string, sizeId: string): Knitted => {
  const g = gauge;
  const neck = nearest(size.neckCm * g.stitches, 4);
  const body = nearest(size.chestCm * g.stitches, 4);
  const underarm = Math.min(24, Math.max(8, nearest(body * 0.04, 2)));
  const upperArm = nearest(size.upperArmCm * g.stitches, 2);
  const cuff = nearest(size.cuffCm * g.stitches, 4);
  const yokeTotal = body - 2 * underarm + 2 * (upperArm - underarm);
  // The ribs in the trim, which a colourway gives the palette's ground and a knitter may change (see colours); the back neck's short rows in the first hat's ground.
  const firstYear = plan.rows.yoke[0].year;
  const neckSlot = plainSlot(firstYear, roles[firstYear].ground[0]);

  /* ---------------------------------------------------------------- yoke */
  const yoke = new Writer(prefix);
  const first = Math.round(neck * 1.25);
  const n = plan.rows.yoke.length;
  // The yoke's first rounds as the plan's fans say, where it has them; then on, its last round leaving a multiple of four, near what the divide wants.
  const fanRounds = plan.fans?.length ?? 0;
  const fannedTo = plan.fans ? fanned(yoke, plan.rows.yoke.slice(0, fanRounds), neck, plan.fans) : neck;
  const target = (i: number) => first + (yokeTotal - first) * Math.min(1, (i + 4) / n);
  const yokeEnd = tiled(yoke, plan.rows.yoke.slice(fanRounds), fannedTo, (i) => target(i + fanRounds), true, (now) => (nearest(yokeTotal, 4) >= now ? nearest(yokeTotal, 4) : Math.ceil(now / 4) * 4));
  const yokeSpecs: RoundSpec[] = [
    { type: "castOn", count: neck, slot: trimSlot, fabric: "rib", check: "neck" },
    { type: "join" },
    { type: "rounds", count: ribs.neck, slot: trimSlot, sequence: ["k", "p"], fabric: "rib" },
    { type: "needles", to: "main" },
    { type: "shortRows", first: Math.round(neck * 0.16), extend: Math.round(neck * 0.05), pairs: 3, slot: neckSlot },
    ...yoke.done(),
  ];
  yokeSpecs[yokeSpecs.length - 1] = { ...yokeSpecs[yokeSpecs.length - 1], check: "yoke" };
  // The sleeves take what the body leaves: each sleeve's held stitches, and the underarm cast on beside them.
  const held = (yokeEnd - (body - 2 * underarm)) / 2;
  const top = held + underarm;
  const half = (body - 2 * underarm) / 2;

  /* ---------------------------------------------------------------- body */
  const bodyWriter = new Writer(prefix);
  const hemCount = nearest(body, 4);
  tiled(bodyWriter, plan.rows.body, body, () => body, false, () => hemCount);
  const bodySpecs: RoundSpec[] = [
    {
      type: "divide",
      slot: slotOfRound(plan.rows.body[0]),
      segments: [
        { work: half / 2 },
        { hold: "sleeve-right", count: held, castOn: underarm },
        { work: half },
        { hold: "sleeve-left", count: held, castOn: underarm },
        { work: half / 2 },
      ],
      check: "body",
    },
    ...bodyWriter.done(),
    { type: "needles", to: "rib" },
    { type: "rounds", count: ribs.hem, slot: trimSlot, sequence: ["k", "k", "p", "p"], fabric: "rib", check: "hem" },
    { type: "bindOff", slot: trimSlot, fabric: "rib", sequence: ["k", "k", "p", "p"] },
  ];

  /* ------------------------------------------------------------- sleeves */
  const rows = plan.rows.sleeve;
  const L = rows.length;
  const decreases = (top - cuff) / 2;
  if (!Number.isInteger(decreases) || decreases < 0) throw new Error(`a sleeve of ${top} will not taper to a cuff of ${cuff}`);
  // Decrease rounds spread evenly, leaving the first few and the last few plain.
  const from = Math.min(6, Math.floor(L / 6));
  const span = L - from - 3;
  const decreaseAt = new Set<number>();
  for (let k = 0; k < decreases; k++) decreaseAt.add(from + Math.floor(((k + 0.5) * span) / decreases));
  const sleeveCharts = new Map<string, Chart>();
  const sleeveSpecs: RoundSpec[] = [];
  let count = top;
  let start = 0;
  // One chart for each strip of the sleeve: a year's consecutive rounds.
  for (let i = 1; i <= L; i++) {
    if (i < L && rows[i].year === rows[start].year) continue;
    const strip = rows.slice(start, i);
    const chartRows: ChartCell[][] = [];
    strip.forEach((r, k) => {
      const N = count;
      const tile = isPlain(r) ? [plainSlot(r.year, r.plain)] : tileOf(r);
      const w = tile.length;
      // Centred on the top of the arm, half way round from the seam.
      const at = (j: number) => tile[(((j - Math.floor(N / 2) + Math.floor(w / 2)) % w) + w) % w];
      /*
       * The seam stitch: where the stitches either side of it are one colour,
       * it is knitted in the round's other, so that the floats either side of
       * the seam - where the repeats meet part-way - never join into one.
       */
      const colours = [...new Set(tile)];
      const sides = [at(N - 2), at(0)];
      const seam = sides[0] === sides[1] ? colours.find((c) => c !== sides[0]) ?? sides[0] : darkest(sides);
      const cells: ChartCell[] = [];
      if (decreaseAt.has(start + k)) {
        cells.push({ slot: at(1), symbol: "ssk" });
        for (let j = 2; j <= N - 4; j++) cells.push({ slot: at(j) });
        cells.push({ slot: at(N - 2), symbol: "k2tog" });
        cells.push({ slot: seam });
        count -= 2;
      } else {
        for (let j = 0; j < N - 1; j++) cells.push({ slot: at(j) });
        cells.push({ slot: seam });
      }
      chartRows.push(cells);
    });
    const id = `${prefix}${sizeId}-sleeve${start}`;
    sleeveCharts.set(id, { id, name: `${rows[start].year} ${yearOf(rows[start].year).name}, sleeve`, rows: chartRows });
    sleeveSpecs.push({ type: "chart", chart: id, rows: [1, chartRows.length], repeats: 1 });
    start = i;
  }
  if (count !== cuff) throw new Error(`a sleeve tapered to ${count}, not ${cuff}`);
  const sleeveSection = (piece: string, label: string): Section => ({
    label,
    piece,
    rounds: [
      { type: "piece", held: piece, before: underarm / 2, after: underarm / 2, slot: slotOfRound(rows[0]), check: `${piece}:top` },
      ...sleeveSpecs,
      { type: "needles", to: "rib" },
      { type: "rounds", count: ribs.cuff, slot: trimSlot, sequence: ["k", "k", "p", "p"], fabric: "rib", check: `${piece}:cuff` },
      { type: "bindOff", slot: trimSlot, fabric: "rib", sequence: ["k", "k", "p", "p"] },
    ],
  });

  return {
    sections: [
      { label: "Yoke", piece: "yoke", rounds: yokeSpecs },
      { label: "Body", piece: "body", rounds: bodySpecs },
      sleeveSection("sleeve-left", "Left sleeve"),
      sleeveSection("sleeve-right", "Right sleeve"),
    ],
    charts: [...yoke.charts.values(), ...bodyWriter.charts.values(), ...sleeveCharts.values()],
    checks: {
      neck,
      yoke: yokeEnd,
      body,
      hem: hemCount,
      "sleeve-left:top": top,
      "sleeve-left:cuff": cuff,
      "sleeve-right:top": top,
      "sleeve-right:cuff": cuff,
    },
  };
};
