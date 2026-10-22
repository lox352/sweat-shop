import type { Chart, ChartCell, RoundSpec, Section, ShapingOp } from "../../types";
import { decreaseEvenly, increaseEvenly } from "../../writing";
import { yearOf } from "../years";
import { lettersOf, solid } from "./cuts";
import { gauge, ribs, type Measured, type Plan, type Row } from "./plan";
import roleData from "./roles.json";
import { added, growing, increasesOf, tileOf } from "./shaping";
import { letterOf, plainSlot, trimSlot } from "./slots";

/**
 * A strip sampler's plan, knitted: its sections, charts and stated counts.
 *
 * - **The yoke** grows from the neck to the divide by its quanta (see
 *   shaping.ts): each quantum on a whole number of its repeat, some of its
 *   background columns doubled; growing in rounds of one yarn, at the start
 *   of a quantum, and inside one by doubling a column with no foreground in
 *   its chain of descendants.
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
const rowIsSolid = (r: Row) => !isPlain(r) && solid(lettersOf(r.year, r.chart)[r.row - 1]);
const slotOfRound = (r: Row): string => (isPlain(r) ? plainSlot(r.year, r.plain) : tileOf(r)[0]);

export interface Knitted {
  sections: Section[];
  charts: Chart[];
  checks: Record<string, number>;
}

/** Which columns a widened repeat doubles, for a chart's id: "6.18", or "12+" for a column doubled twice. */
const doubling = (map: number[]): string => {
  const n = new Map<number, number>();
  for (const x of map) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n].filter(([, k]) => k > 1).map(([x, k]) => `${x}${"+".repeat(k - 2)}`).join(".");
};
/** A round's ops, its new stitches at these places in the round it leaves. */
const madeAt = (to: number, at: number[]): ShapingOp[] => {
  const made = new Set(at);
  const ops: ShapingOp[] = [];
  let run = 0;
  for (let j = 0; j < to; j++) {
    if (!made.has(j)) {
      run++;
      continue;
    }
    if (run) ops.push({ work: "k", times: run });
    ops.push({ work: "m1" });
    run = 0;
  }
  if (run) ops.push({ work: "k", times: run });
  return ops;
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
    const doubled = map ? doubling(map) : "";
    const id = `${this.prefix}${String(year).slice(2)}${chart}${rows[0].row}-${rows[rows.length - 1].row}w${w}${doubled ? `x${doubled}` : ""}`;
    if (!this.charts.has(id)) {
      const cells = (r: ChartRow) => (map ? map.map((x) => tileOf(r)[x]) : tileOf(r)).map((slot) => ({ slot }));
      this.charts.set(id, { id, name: `${year} ${yearOf(year).name}`, rows: rows.map(cells) });
    }
    this.specs.push({ type: "chart", chart: id, rows: [1, rows.length] });
    this.run = null;
  }

  /** A row of a band, at the count on the needle: on the hat's repeat, or on its quantum's repeat, perhaps widened by doubling columns. */
  chart(r: ChartRow, map?: number[]) {
    const wide = map && (map.length !== r.w || map.some((x, q) => x !== q)) ? map : undefined;
    const key = `${r.year}${r.chart}${wide ? wide.length : r.w}${wide ? doubling(wide) : ""}`;
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
    const id = `${this.prefix}${String(r.year).slice(2)}${r.chart}${r.row}w${before.length}d${doubling(before) || "0"}-${doubling(after)}`;
    this.charts.set(id, { id, name: `${r.year} ${yearOf(r.year).name}`, rows: [cells] });
    this.specs.push({ type: "chart", chart: id, rows: [1, 1] });
  }

  plain(slot: string) {
    this.flush();
    const last = this.specs[this.specs.length - 1];
    if (last?.type === "rounds" && last.slot === slot && !last.sequence) this.specs[this.specs.length - 1] = { ...last, count: last.count + 1 };
    else this.specs.push({ type: "rounds", count: 1, slot });
  }

  /** A plain round, or a round of one colour, that takes the count from `from` to `to`: its new stitches at `at`, or spread evenly. */
  shape(slot: string, from: number, to: number, at?: number[]) {
    this.flush();
    this.specs.push({ type: "shaping", slot, ops: at && to > from ? madeAt(to, at) : to > from ? increaseEvenly(from, to) : decreaseEvenly(from, to), to });
  }

  /**
   * A band's row that changes the count itself: make-ones (or k2togs) spread
   * evenly round, each new stitch knitted in the colour the pattern has there.
   */
  transition(r: ChartRow, from: number, to: number, map?: number[], places?: number[]) {
    this.flush();
    const tile = map ? map.map((x) => tileOf(r)[x]) : tileOf(r);
    // The new stitches (or the k2togs) at these places, or evenly spaced among the round's `to`.
    const change = Math.abs(to - from);
    const at = new Set(places ?? Array.from({ length: change }, (_, k) => Math.floor(((k + 0.5) * to) / change)));
    const symbol = to > from ? "m1" : "k2tog";
    const cells: ChartCell[] = Array.from({ length: to }, (_, j) => (at.has(j) ? { slot: tile[j % tile.length], symbol } : { slot: tile[j % tile.length] }));
    const doubled = map ? doubling(map) : "";
    const id = `${this.prefix}${String(r.year).slice(2)}${r.chart}${r.row}t${from}-${to}${map ? `w${map.length}${doubled ? `x${doubled}` : ""}` : ""}`;
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
 * The yoke's rounds as its quanta grow it (see shaping): from the neck to
 * `to`, near the target. Returns the count it leaves.
 */
const grown = (w: Writer, rows: Row[], from: number, to: number, want: (i: number) => number): number => {
  const steps = growing(rows, { from, to, want });
  const places = increasesOf(steps, from);
  let count = from;
  let map: number[] | undefined;
  steps.forEach((s, i) => {
    const r = rows[i];
    if (!s.map) {
      // A round of one yarn: plain, or taking its make-ones.
      if (s.count !== count) w.shape(slotOfRound(r), count, s.count, places[i]);
      else w.plain(slotOfRound(r));
    } else if (s.kind === "double") w.double(r as ChartRow, map!, s.map);
    else if (s.count !== count) w.transition(r as ChartRow, count, s.count, s.map, places[i]);
    else w.chart(r as ChartRow, s.map);
    count = s.count;
    map = s.map;
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
  // The yoke from the neck to a multiple of four nearest what the divide wants, following a target straight from a quarter more than the neck to it, four rounds before the end.
  const target = (i: number) => first + (yokeTotal - first) * Math.min(1, (i + 4) / n);
  const yokeEnd = grown(yoke, plan.rows.yoke, neck, nearest(yokeTotal, 4), target);
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
