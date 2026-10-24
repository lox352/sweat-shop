import type { Chart, ChartCell, RoundSpec, Section, ShapingOp } from "../../types";
import { decreaseEvenly, increaseEvenly } from "../../writing";
import { yearOf } from "../years";
import { lettersOf, solid } from "./cuts";
import { gauge, ribs, type Measured, type Plan, type Row } from "./plan";
import roleData from "./roles.json";
import { quantumOf } from "./quanta";
import { added, growing, increasesOf, narrowing, type Step, tileOf, unitsOf } from "./shaping";
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
 * - **The sleeves** narrow from the upper arm to the cuff by their quanta too,
 *   every round within 10% of a straight taper: each band seamless, on whole
 *   repeats all round, where that keeps it there, and otherwise seamed on the
 *   inner arm - its repeats meeting part-way at a seam stitch, two decreases
 *   at a time either side of it, the band slid round to where its seam
 *   touches the least foreground.
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

/**
 * A piece's rows, each chart row marked with its place in its band - a run of
 * the piece's rounds in one quantum, or in one chart where no quantum claims
 * the row: step 0 at the band's edges to 3 at its middle, and the centre round
 * of a band seven or more rounds deep. A shaded palette gives each step its
 * own shades (see slots' bandSlotsOfRow). Copies, so the rows the sleeves
 * carry on from the body stay the body's.
 */
const banded = (rows: Row[]): Row[] => {
  const keyOf = (r: Row) => {
    if (isPlain(r)) return null;
    const q = quantumOf(r.year, r.chart, r.row);
    return q ? `${r.year}${r.chart}${q.aligned ? `g${q.group}` : `${q.from}-${q.to}`}` : `${r.year}${r.chart}`;
  };
  const out = rows.map((r) => (isPlain(r) ? r : { ...r }));
  for (let i = 0; i < out.length; ) {
    const key = keyOf(out[i]);
    let j = i + 1;
    if (key) while (j < out.length && keyOf(out[j]) === key) j++;
    if (key) {
      for (let n = i; n < j; n++) {
        const t = j - i > 1 ? (n - i) / (j - i - 1) : 0;
        (out[n] as ChartRow).band = { step: Math.round((1 - Math.abs(2 * t - 1)) * 3), centre: j - i >= 7 && n - i === Math.floor((j - i) / 2) };
      }
    }
    i = j;
  }
  return out;
};
/** The shading of a chart's rows, for its id: each row's step, and "c" for a centre round. */
const bandsOf = (rows: ChartRow[]): string => (rows.some((r) => r.band) ? `b${rows.map((r) => (r.band ? `${r.band.step}${r.band.centre ? "c" : ""}` : "-")).join("")}` : "");

/** A cell of a widened repeat: a column's later copies only space the pattern out (see ChartCell.spacer). */
const cellOf = (slot: string, map: number[], q: number): ChartCell => (q > 0 && map[q - 1] === map[q] ? { slot, spacer: true } : { slot });

/** Which columns a widened repeat doubles, for a chart's id: "6.18", or "12+" for a column doubled twice. */
const doubling = (map: number[]): string => {
  const n = new Map<number, number>();
  for (const x of map) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n].filter(([, k]) => k > 1).map(([x, k]) => `${x}${"+".repeat(k - 2)}`).join(".");
};
/**
 * A seamed round of N stitches: the band centred on the round's middle, slid
 * round by `off`, the last stitch the seam's. Where the stitches either side of
 * the seam are one colour, it is knitted in the round's other, so the floats
 * either side never join into one.
 */
const seamCells = (r: ChartRow, N: number, off: number): ChartCell[] => {
  const tile = tileOf(r);
  const w = tile.length;
  const at = (j: number) => tile[(((j - Math.floor(N / 2) + off) % w) + w) % w];
  const cells: ChartCell[] = Array.from({ length: N - 1 }, (_, j) => ({ slot: at(j) }));
  const colours = [...new Set(tile)];
  const sides = [at(N - 2), at(0)];
  cells.push({ slot: sides[0] === sides[1] ? (colours.find((c) => c !== sides[0]) ?? sides[0]) : darkest(sides) });
  return cells;
};

/** A round's ops, its decreases (each a k2tog) making the stitches at these places in the round it leaves. */
const decreasedAt = (to: number, at: number[]): ShapingOp[] => {
  const made = new Set(at);
  const ops: ShapingOp[] = [];
  let run = 0;
  for (let j = 0; j < to; j++) {
    if (!made.has(j)) {
      run++;
      continue;
    }
    if (run) ops.push({ work: "k", times: run });
    ops.push({ work: "k2tog" });
    run = 0;
  }
  if (run) ops.push({ work: "k", times: run });
  return ops;
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
  private run: { key: string; year: number; chart: string; w: number; rows: ChartRow[]; map?: number[]; seam?: number } | null = null;

  constructor(
    private readonly prefix: string,
    /** Said after the hat's name, for a piece's charts: ", sleeve". */
    private readonly suffix = "",
  ) {}

  private nameOf(year: number) {
    return `${year} ${yearOf(year).name}${this.suffix}`;
  }

  private flush() {
    if (!this.run) return;
    const { year, chart, w, rows, map, seam } = this.run;
    if (seam !== undefined) {
      const id = `${this.prefix}${String(year).slice(2)}${chart}${rows[0].row}-${rows[rows.length - 1].row}s${w}o${seam}${bandsOf(rows)}`;
      if (!this.charts.has(id)) this.charts.set(id, { id, name: this.nameOf(year), rows: rows.map((r) => seamCells(r, w, seam)) });
      this.specs.push({ type: "chart", chart: id, rows: [1, rows.length], repeats: 1 });
      this.run = null;
      return;
    }
    const doubled = map ? doubling(map) : "";
    const id = `${this.prefix}${String(year).slice(2)}${chart}${rows[0].row}-${rows[rows.length - 1].row}w${w}${doubled ? `x${doubled}` : ""}${bandsOf(rows)}`;
    if (!this.charts.has(id)) {
      const cells = (r: ChartRow): ChartCell[] => (map ? map.map((x, q) => cellOf(tileOf(r)[x], map, q)) : tileOf(r).map((slot) => ({ slot })));
      this.charts.set(id, { id, name: this.nameOf(year), rows: rows.map(cells) });
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
   * each new stitch a make-one beside its twin, knitted in the twin's yarn.
   */
  double(r: ChartRow, before: number[], after: number[]) {
    this.flush();
    const tile = tileOf(r);
    const fresh = added(before, after);
    const cells: ChartCell[] = after.map((x, q) =>
      fresh.has(q) ? { ...cellOf(tile[x], after, q), symbol: "m1" } : cellOf(tile[x], after, q),
    );
    const id = `${this.prefix}${String(r.year).slice(2)}${r.chart}${r.row}w${before.length}d${doubling(before) || "0"}-${doubling(after)}${bandsOf([r])}`;
    this.charts.set(id, { id, name: this.nameOf(r.year), rows: [cells] });
    this.specs.push({ type: "chart", chart: id, rows: [1, 1] });
  }

  /**
   * A band's row where doubled columns end, the same in every repeat: each a
   * k2tog of its last two copies, both background.
   */
  merge(r: ChartRow, before: number[], after: number[]) {
    this.flush();
    const tile = tileOf(r);
    const had = new Map<number, number>();
    for (const x of before) had.set(x, (had.get(x) ?? 0) + 1);
    const has = new Map<number, number>();
    for (const x of after) has.set(x, (has.get(x) ?? 0) + 1);
    const cells: ChartCell[] = after.map((x, q) =>
      has.get(x)! < had.get(x)! && after[q + 1] !== x ? { ...cellOf(tile[x], after, q), symbol: "k2tog" } : cellOf(tile[x], after, q),
    );
    const id = `${this.prefix}${String(r.year).slice(2)}${r.chart}${r.row}w${before.length}m${doubling(before)}-${doubling(after) || "0"}${bandsOf([r])}`;
    this.charts.set(id, { id, name: this.nameOf(r.year), rows: [cells] });
    this.specs.push({ type: "chart", chart: id, rows: [1, 1] });
  }

  /**
   * A row of a seamed band, the whole round: the band centred on the round's
   * middle and slid round by `off`, its repeats meeting part-way at a seam
   * stitch, the round's last. Where it narrows by two, an ssk and a k2tog
   * either side of the seam; by more, k2togs spread round.
   */
  seamed(r: ChartRow, from: number, to: number, off: number) {
    const N = to === from - 2 || to === from ? from : to;
    const cells = seamCells(r, N, off);
    if (to === from) {
      // Rounds that keep their count go together in one chart, as a band's rows do.
      const key = `${r.year}${r.chart}s${to}o${off}`;
      const prev = this.run?.rows[this.run.rows.length - 1];
      if (this.run && (this.run.key !== key || prev!.row !== r.row + 1)) this.flush();
      if (!this.run) this.run = { key, year: r.year, chart: r.chart, w: to, rows: [], seam: off };
      this.run.rows.push(r);
      return;
    }
    this.flush();
    let row: ChartCell[];
    if (to === from - 2) row = [{ ...cells[1], symbol: "ssk" }, ...cells.slice(2, N - 3), { ...cells[N - 2], symbol: "k2tog" }, cells[N - 1]];
    else {
      const change = from - to;
      const at = new Set(Array.from({ length: change }, (_, k) => Math.floor(((k + 0.5) * (to - 1)) / change)));
      row = cells.map((c, j) => (at.has(j) ? { ...c, symbol: "k2tog" } : c));
    }
    const id = `${this.prefix}${String(r.year).slice(2)}${r.chart}${r.row}s${from}-${to}o${off}${bandsOf([r])}`;
    this.charts.set(id, { id, name: this.nameOf(r.year), rows: [row] });
    this.specs.push({ type: "chart", chart: id, rows: [1, 1], repeats: 1 });
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
    this.specs.push({ type: "shaping", slot, ops: at ? (to > from ? madeAt(to, at) : decreasedAt(to, at)) : to > from ? increaseEvenly(from, to) : decreaseEvenly(from, to), to });
  }

  /**
   * A band's row that changes the count itself: make-ones (or k2togs) spread
   * evenly round, each new stitch knitted in the colour the pattern has there.
   */
  transition(r: ChartRow, from: number, to: number, map?: number[], places?: number[]) {
    this.flush();
    const tile = map ? map.map((x) => tileOf(r)[x]) : tileOf(r);
    const cellAt = (j: number): ChartCell => (map ? cellOf(tile[j % tile.length], map, j % tile.length) : { slot: tile[j % tile.length] });
    // The new stitches (or the k2togs) at these places, or evenly spaced among the round's `to`.
    const change = Math.abs(to - from);
    const at = new Set(places ?? Array.from({ length: change }, (_, k) => Math.floor(((k + 0.5) * to) / change)));
    const symbol = to > from ? "m1" : "k2tog";
    const cells: ChartCell[] = Array.from({ length: to }, (_, j) => (at.has(j) ? { ...cellAt(j), symbol } : cellAt(j)));
    const doubled = map ? doubling(map) : "";
    const id = `${this.prefix}${String(r.year).slice(2)}${r.chart}${r.row}t${from}-${to}${map ? `w${map.length}${doubled ? `x${doubled}` : ""}` : ""}${bandsOf([r])}`;
    this.charts.set(id, { id, name: this.nameOf(r.year), rows: [cells] });
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

/** How far from its taper any round of a sleeve may be: where a band can't stay within it seamless, it is seamed. */
const SLEEVE_TOLERANCE = 0.1;

/**
 * Where each seamed band of a sleeve is slid round to, for each of its
 * rounds: centred on the top of the arm, the middle of its repeat half way
 * round from the seam, so the pattern sits square on the outside of the arm
 * and meets itself at the seam the same on both sides. A repeat's middle can
 * be half a stitch from its mirror line, so of the offsets within a stitch of
 * centred, the one under which the band is most nearly a mirror image about
 * its seam stitch.
 */
const seamOffsets = (rows: Row[], steps: Step[], top: number): Map<number, number> => {
  const out = new Map<number, number>();
  for (const u of unitsOf(rows)) {
    if (u.solid || !steps[u.rows[0]].seam) continue;
    const w = (rows[u.rows[0]] as ChartRow).w;
    const centred = Math.floor(w / 2);
    // How many stitches fail to mirror their partner across the seam stitch, the round's last, within a repeat of it.
    const unlike = (off: number) =>
      u.rows.reduce((total, i) => {
        const r = rows[i] as ChartRow;
        const before = i ? steps[i - 1].count : top;
        const to = steps[i].count;
        const N = to === before || to === before - 2 ? before : to;
        const tile = tileOf(r);
        const at = (j: number) => tile[(((j - Math.floor(N / 2) + off) % w) + w) % w];
        let n = 0;
        for (let d = 1; d <= Math.min(w, Math.floor((N - 1) / 2)); d++) if (at(N - 1 - d) !== at(d - 1)) n++;
        return total + n;
      }, 0);
    let best = centred;
    for (const off of [centred - 1, centred + 1]) if (unlike((off + w) % w) < unlike(best)) best = (off + w) % w;
    for (const i of u.rows) out.set(i, best);
  }
  return out;
};

export const knit = (size: Measured, given: Plan, prefix: string): Knitted => {
  const plan = { ...given, rows: { yoke: banded(given.rows.yoke), body: banded(given.rows.body), sleeve: banded(given.rows.sleeve) } };
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
  // A straight taper from the upper arm to the cuff, leaving the first few rounds and the last few at their counts.
  const from = Math.min(6, Math.floor(L / 6));
  const span = L - from - 3;
  const taper = (i: number) => top - (top - cuff) * Math.min(1, Math.max(0, (i - from + 0.5) / span));
  const steps = narrowing(rows, { from: top, to: cuff, want: taper, tolerance: SLEEVE_TOLERANCE });
  const offsets = seamOffsets(rows, steps, top);
  const sleeve = new Writer(`${prefix}s-`, ", sleeve");
  let count = top;
  let map: number[] | undefined;
  steps.forEach((s, i) => {
    const r = rows[i];
    if (s.count > count) throw new Error(`a sleeve widens at its round ${i + 1}`);
    const spread = (to: number, change: number) => [...new Set(Array.from({ length: change }, (_, k) => Math.floor(((k + 0.5) * to) / change)))];
    if (s.seam) sleeve.seamed(r as ChartRow, count, s.count, offsets.get(i)!);
    else if (!s.map) {
      if (s.count !== count) sleeve.shape(slotOfRound(r), count, s.count, spread(s.count, count - s.count));
      else sleeve.plain(slotOfRound(r));
    } else if (s.kind === "double" && map && s.count !== count) sleeve.merge(r as ChartRow, map, s.map);
    else if (s.count !== count) sleeve.transition(r as ChartRow, count, s.count, s.map, spread(s.count, count - s.count));
    else sleeve.chart(r as ChartRow, s.map);
    count = s.count;
    map = s.map;
  });
  // A last round on more than the cuff's count is taken in in a round of the trim before the rib.
  if (count !== cuff) sleeve.shape(trimSlot, count, cuff);
  const sleeveSpecs = sleeve.done();
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
    charts: [...yoke.charts.values(), ...bodyWriter.charts.values(), ...sleeve.charts.values()],
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
