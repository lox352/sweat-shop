import type { Chart, ChartCell, DivideSegment, RoundSpec, Section, ShapingOp } from "../types";
import { decreaseEvenly, increaseEvenly, underarmDecrease } from "../writing";
import { NECK_REPEAT, cuffEdges, cuffFeline, hemCreature, neckSpiral, neckTrim } from "./motifs";
import { type FelineId, GROUND, drawFeline } from "./raster";

/**
 * A feline jumper, knitted from the neck down: one of the tunic's felines on
 * the front, the other on the back, each as large as its piece has room for
 * and midway between a trim round the neck and the tunic's hem band round
 * the waist, where there is room for the band too; and the sleeve ends'
 * felines round each cuff.
 *
 * Two constructions:
 * - **Raglan.** The yoke grows at four raglan lines, each a stitch knitted
 *   plain with an increase either side of it, a KBF before it and a KFB
 *   after: the front and back every time the yoke has a body increase, the sleeves every time it has a sleeve
 *   increase, each spread evenly down the yoke. The front and back reach
 *   their full width only at the divide, so a feline rises into the yoke
 *   only as far as the front is wider than it, row by row.
 * - **Circular yoke.** The yoke grows in plain rounds, increased evenly all
 *   the way round, to its full count half way down, and then goes straight
 *   to the divide: a feline rises into that straight half of it, its front
 *   and back as wide there as below.
 *
 * Rows of a picture are knitted top first, from the neck down, and each round
 * runs left to right as the jumper is seen from the outside: so a feline's
 * top row is its first, and its stitches go on in the order they are seen.
 * The round begins at the middle of the back.
 *
 * Yarns: A the ground, B red, C cream, D gold.
 */

export type Construction = "raglan" | "yoke";

export interface Measured {
  chestCm: number;
  neckCm: number;
  yokeDepthCm: number;
  bodyLengthCm: number;
  upperArmCm: number;
  sleeveLengthCm: number;
  cuffCm: number;
}

/** Stitches and rounds a centimetre. */
export const gauge = { stitches: 3.2, rounds: 3.8 };
export const ribs = { neck: 9, hem: 14, cuff: 14 };
/** Which feline goes where: the tunic's left-hand one on the front, its right-hand one on the back. */
export const felineOn = { front: "left", back: "right" } as const satisfies Record<string, FelineId>;

const GROUND_SLOT = "A";
const RED_SLOT = "B";
const SLOT_OF = ["A", "B", "C"];
const MOTIF_SLOT: Record<string, string> = { o: "A", ".": "B", c: "C", G: "D" };

/** The hem band at the waist, and the gap between a feline and the rib where there is none. */
const HEM_ROWS = hemCreature.length;
const GAP_ABOVE_RIB = 6;
/** Stitches left plain either side of a feline, at the narrowest its piece is beside it. */
const MARGIN = 2;
/** A waist band only where the felines are left at least this share of their piece's width. */
const BAND_KEEPS = 0.72;
/** Plain rows at least between a feline and the trims either side of it. */
const MIN_GAP = 2;
/** The most a round yoke's increase round grows it by: a tenth, so that the yoke widens smoothly. */
const STEP = 1.1;
/**
 * How far down a round yoke it reaches its full count: half way, the felines
 * rising into the straight half below. A round yoke grows all the way round,
 * so its increases cannot go where a feline is; and a feline below them two
 * thirds of the way down would be far nearer the waist than the neck.
 */
const FULL_AT = 0.5;

const nearest = (v: number, m: number) => Math.max(m, Math.round(v / m) * m);

/** "the start of the round", and each sleeve's: as the strip samplers mark them. */
export const startOfRound = "the start of the round";
const sleeveStart = (piece: string) => `the start of the ${piece === "sleeve-left" ? "left" : "right"} sleeve's rounds`;

/** A round as knitted: each stitch's yarn, and a make-one before the stitch where marked. */
interface Row {
  slots: string[];
  /** For each stitch it leaves, whether it is a new one. */
  made?: boolean[];
  /**
   * Each new stitch made by working the stitch before it twice rather than as
   * a make-one from the bar: a KFB, or where marked here a KBF, its mirror,
   * whose new stitch stands to the right of it on the chart.
   */
  twice?: { kbf: boolean[] };
}

const plainRow = (n: number, slot = GROUND_SLOT): Row => ({ slots: Array(n).fill(slot) });
const isPlain = (row: Row) => !row.made?.some(Boolean) && row.slots.every((s) => s === row.slots[0]);

/** The counts a size is knitted to. */
export interface Counts {
  neck: number;
  body: number;
  underarm: number;
  /** The front's and the back's stitches, without the underarms. */
  half: number;
  /** Each sleeve's stitches at the divide. */
  held: number;
  upperArm: number;
  cuff: number;
  yokeRounds: number;
  bodyRounds: number;
  sleeveRounds: number;
}

export const countsOf = (size: Measured): Counts => {
  const g = gauge;
  const body = nearest(size.chestCm * g.stitches, 4);
  const underarm = Math.min(24, Math.max(8, nearest(body * 0.04, 2)));
  const upperArm = nearest(size.upperArmCm * g.stitches, 2);
  return {
    neck: nearest(size.neckCm * g.stitches, 2),
    body,
    underarm,
    half: (body - 2 * underarm) / 2,
    held: upperArm - underarm,
    upperArm,
    cuff: nearest(size.cuffCm * g.stitches, 2),
    yokeRounds: Math.round(size.yokeDepthCm * g.rounds) - ribs.neck,
    bodyRounds: Math.round(size.bodyLengthCm * g.rounds) - ribs.hem,
    sleeveRounds: Math.round(size.sleeveLengthCm * g.rounds) - ribs.cuff,
  };
};

/* ------------------------------------------------------------------ yokes */

/**
 * A yoke, before any feline or trim: each row's count, its increases, and
 * where its front and back are - for a raglan its panels, for a round yoke
 * the whole round.
 */
interface Yoke {
  neck: number;
  /** For each row, the count it leaves. */
  counts: number[];
  /** For a raglan, each row's panels: the back's and front's width, each sleeve's, and which of them it increases. */
  panels?: { back: number; front: number; sleeve: number; body: boolean; sleeves: boolean }[];
  /** The rows of the neck's trim. */
  trim: { from: number; count: number };
}

/** Rounds `from` to `to` (of `n`), the `k` of them with an increase spread as evenly as whole rounds allow. */
const spread = (k: number, n: number, from = 0, to = n): Set<number> => {
  const span = to - from;
  const out = new Set<number>();
  for (let i = 0; i < k; i++) out.add(from + Math.min(span - 1, Math.floor(((i + 0.5) * span) / k)));
  if (out.size !== k) throw new Error(`cannot spread ${k} increases over ${span} rounds`);
  return out;
};

/** A raglan's neck shared out: a third each to the front and back, a sixth each to the sleeves, less the four line stitches. */
const raglanNeck = (c: Counts) => {
  const lineStitches = 4;
  const sleeve0 = 2 * Math.round(c.neck / 12);
  const front0 = 2 * Math.round((c.neck - 2 * sleeve0 - lineStitches) / 4);
  return { sleeve0, front0, neck: 2 * front0 + 2 * sleeve0 + lineStitches, bodyIncreases: (c.half - front0) / 2, sleeveIncreases: (c.held - 2 - sleeve0) / 2 };
};

/**
 * How deep a raglan's yoke is: the size's, or deeper where that would put a
 * body increase in more than three rounds of four - a big size's chest is far
 * more than its neck, and a raglan can only grow at its four lines. The body
 * is as much shorter, so the jumper is as long.
 */
export const raglanDepth = (c: Counts): number => Math.max(c.yokeRounds, Math.ceil(raglanNeck(c).bodyIncreases / 0.75) + 1);

const raglanYoke = (c: Counts): Yoke => {
  const { sleeve0, front0, neck, bodyIncreases, sleeveIncreases } = raglanNeck(c);
  const n = c.yokeRounds;
  if (bodyIncreases > n || sleeveIncreases > n) throw new Error(`a raglan of ${bodyIncreases} increases has only ${n} rounds`);
  // The last round before the divide has none, so the divide knits straight on from it.
  const bodyAt = spread(bodyIncreases, n - 1);
  const sleeveAt = spread(sleeveIncreases, n - 1);
  const counts: number[] = [];
  const panels: NonNullable<Yoke["panels"]> = [];
  let [fr, sl] = [front0, sleeve0];
  for (let i = 0; i < n; i++) {
    const [body, sleeves] = [bodyAt.has(i), sleeveAt.has(i)];
    if (body) fr += 2;
    if (sleeves) sl += 2;
    panels.push({ back: fr, front: fr, sleeve: sl, body, sleeves });
    counts.push(2 * fr + 2 * sl + 4);
  }
  if (fr !== c.half || sl + 2 !== c.held) throw new Error("a raglan that does not reach its divide");
  return { neck, counts, panels, trim: { from: 0, count: neck } };
};

/**
 * A round yoke: a round to a whole number of the neck trim's repeats, the
 * trim, then increase rounds every few rounds, the counts growing by the
 * same factor each time - at most STEP - to the full count FULL_AT of the
 * way down.
 *
 * The trim keeps its count all its eleven rounds while the yoke under it
 * widens, as a cone does, from the neck to the shoulders; so it goes round
 * at nearly the count the yoke would have reached by its last round had it
 * grown evenly all the way down - nine tenths of it - which is an increase
 * of a fifth or so in the round after the neck's short rows. At the neck's
 * own count, the yoke would be pulled out round it by the time it ended.
 */
const circularYoke = (c: Counts): Yoke => {
  const total = 2 * c.half + 2 * c.held;
  const n = c.yokeRounds;
  const counts: number[] = [];
  const trimFrom = 1;
  const after = trimFrom + neckTrim.length + 1;
  const evenly = c.neck + ((total - c.neck) * after) / n;
  const trimCount = Math.max(Math.ceil(c.neck / NECK_REPEAT), Math.ceil((0.9 * evenly) / NECK_REPEAT)) * NECK_REPEAT;
  const steps = Math.ceil(Math.log(total / trimCount) / Math.log(STEP));
  const last = Math.round(n * FULL_AT);
  const at = [...spread(steps, last, after, last)].sort((a, b) => a - b);
  // The k-th increase round's count, the last the full count.
  const countAt = (k: number) => (k === steps - 1 ? total : 2 * Math.round((trimCount * (total / trimCount) ** ((k + 1) / steps)) / 2));
  let count = c.neck;
  for (let i = 0; i < n; i++) {
    if (i === 0) count = trimCount;
    const k = at.indexOf(i);
    if (k >= 0) count = countAt(k);
    counts.push(count);
  }
  if (count !== total) throw new Error(`a round yoke that leaves ${count}, not ${total}`);
  return { neck: c.neck, counts, trim: { from: trimFrom, count: trimCount } };
};

/* ------------------------------------------------------------- the felines */

interface Placed {
  width: number;
  height: number;
  /** The yoke row the felines' top row is knitted in, counting the body's rows on from the yoke's. */
  top: number;
  /** Rows of the feline above the divide, in the yoke. */
  inYoke: number;
  /** Plain rows between the neck's trim and a feline, and between it and the waist's (or the rib). */
  above: number;
  below: number;
  band: boolean;
  front: number[][];
  back: number[][];
}

/** How far a drawn feline reaches either side of its middle, row by row: for fitting it into a narrowing front. */
const reachOf = (grid: number[][]): number[] =>
  grid.map((row) => {
    const w = row.length;
    let reach = 0;
    row.forEach((v, x) => v !== GROUND && (reach = Math.max(reach, Math.abs(x + 0.5 - w / 2) + 0.5)));
    return reach;
  });

/** How many rows a feline drawn `width` stitches wide is. */
const heightOf = (id: FelineId, width: number) => drawFeline(id, width, gauge, true).height;

/**
 * The felines as large as fits, each midway between the neck's trim and the
 * waist's - as many plain rows above it as below, a row either way - and
 * within its front (and back) in every row: on a raglan, each row within the
 * front as wide as it is there; on a round yoke, below its last increase.
 * With the
 * waist band where that leaves the felines at least BAND_KEEPS of the width
 * they would have without it.
 */
const place = (c: Counts, yoke: Yoke, construction: Construction): Placed => {
  const trimEnd = yoke.trim.from + neckTrim.length;
  const fit = (band: boolean): Placed | undefined => {
    const below = c.bodyRounds - (band ? HEM_ROWS : GAP_ABOVE_RIB);
    const span = yoke.counts.length - trimEnd + below;
    const tryWidth = (width: number): Placed | undefined => {
      const height = heightOf(felineOn.front, width);
      if (height + 2 * MIN_GAP > span) return undefined;
      const above = Math.floor((span - height) / 2);
      const top = trimEnd + above;
      const inYoke = Math.max(0, yoke.counts.length - top);
      const front = drawFeline(felineOn.front, width, gauge).grid;
      const back = drawFeline(felineOn.back, width, gauge).grid;
      const [rf, rb] = [reachOf(front), reachOf(back)];
      for (let r = 0; r < inYoke; r++) {
        const y = top + r;
        if (construction === "raglan") {
          if (2 * (Math.max(rf[r], rb[r]) + MARGIN) > yoke.panels![y].front) return undefined;
        } else if (yoke.counts[y] !== (yoke.counts[y - 1] ?? yoke.neck)) {
          // A round yoke grows all the way round, so no increase where the felines are.
          return undefined;
        }
      }
      return { width, height, top, inYoke, above, below: span - height - above, band, front, back };
    };
    // The widest that fits, by halving: what fits is every width up to some.
    let [lo, hi] = [15, (c.half - 2 * MARGIN) / 2];
    let best = tryWidth(2 * lo);
    if (!best) return undefined;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const found = tryWidth(2 * mid);
      if (found) [lo, best] = [mid, found];
      else hi = mid - 1;
    }
    return best;
  };
  const without = fit(false)!;
  const withBand = fit(true);
  return withBand && withBand.width >= BAND_KEEPS * without.width ? withBand : without;
};

/* ------------------------------------------------------------ the rows */

/**
 * A round yoke's increases from `from` stitches to `to`, as a mark on each
 * stitch of the round it leaves: make-ones spread evenly, half in each half
 * of the round, so the front stays opposite the middle of the back.
 */
const madeAround = (from: number, to: number): boolean[] => {
  const k = to - from;
  if (k % 2) throw new Error(`an odd ${k} increases cannot be shared between the round's halves`);
  // Places a make-one can go, before the old stitch at each: between the back's middle and the front's.
  const [lo, hi] = [1, from / 2];
  if (k / 2 > hi - lo) throw new Error(`${k / 2} increases in ${hi - lo} places`);
  const before = new Set<number>();
  for (let t = 0; t < k / 2; t++) {
    const j = lo + Math.floor(((t + 0.5) * (hi - lo)) / (k / 2));
    before.add(j);
    before.add(from - j);
  }
  const made: boolean[] = [];
  for (let j = 0; j < from; j++) {
    if (before.has(j)) made.push(true);
    made.push(false);
  }
  if (made.length !== to) throw new Error(`increasing ${from} to ${to} made ${made.length}`);
  return made;
};

/** The neck trim's row `r` across a stretch `width` wide: its spirals `NECK_REPEAT` apart, centred, alternate ones mirrored, as many as fit `room`. */
const trimStretch = (r: number, width: number, room: number): string[] => {
  const out: string[] = Array(width).fill(MOTIF_SLOT[neckTrim[r]]);
  const spiral = neckSpiral(r);
  if (!spiral) return out;
  const w = spiral.length;
  const many = Math.max(0, Math.floor((room - 2) / NECK_REPEAT));
  for (let t = 0; t < many; t++) {
    const middle = width / 2 + (t - (many - 1) / 2) * NECK_REPEAT;
    const left = Math.round(middle - w / 2);
    const drawn = t % 2 ? [...spiral].reverse() : spiral;
    drawn.forEach((ch, x) => {
      if (left + x >= 0 && left + x < width) out[left + x] = MOTIF_SLOT[ch];
    });
  }
  return out;
};

/** A row's stitches laid onto a round from `at`, round past its end. */
const lay = (slots: string[], stretch: string[], at: number) => {
  const n = slots.length;
  stretch.forEach((s, x) => (slots[(((at + x) % n) + n) % n] = s));
};

/** The yoke's rows, each its yarns and its increases, the neck trim and the felines laid in. */
const yokeRows = (yoke: Yoke, placed: Placed, construction: Construction): Row[] => {
  const rows: Row[] = [];
  let count = yoke.neck;
  yoke.counts.forEach((to, i) => {
    let row: Row;
    if (construction === "raglan") {
      const p = yoke.panels![i];
      // The round from the middle of the back: half the back, a line, a sleeve, a line, the front, a line, a sleeve, a line, the back's other half.
      const parts: [number, boolean, boolean][] = [
        [p.back / 2, false, p.body],
        [1, false, false],
        [p.sleeve, p.sleeves, p.sleeves],
        [1, false, false],
        [p.front, p.body, p.body],
        [1, false, false],
        [p.sleeve, p.sleeves, p.sleeves],
        [1, false, false],
        [p.back / 2, p.body, false],
      ];
      // Each panel grows from its own stitches either side of a line, as Paul Klee's raglan does: a KBF in its last stitch before a line, a KFB in its first after one, the new stitches beside the line and leaning away from it.
      const [made, kbf]: boolean[][] = [[], []];
      for (const [w, first, last] of parts)
        for (let k = 0; k < w; k++) {
          made.push((first && k === 1) || (last && k === w - 1));
          kbf.push(last && k === w - 1);
        }
      row = { slots: Array(to).fill(GROUND_SLOT), made, twice: { kbf } };
      const r = i - yoke.trim.from;
      if (r >= 0 && r < neckTrim.length) {
        // The trim across each panel on its own, the lines and the new stitches at the panels' edges in its ground.
        const first = yoke.panels![yoke.trim.from];
        const ground = trimStretch(r, 1, 0)[0];
        row.slots.fill(ground);
        lay(row.slots, trimStretch(r, p.back, first.back), to - p.back / 2);
        lay(row.slots, trimStretch(r, p.sleeve, first.sleeve), p.back / 2 + 1);
        lay(row.slots, trimStretch(r, p.front, first.front), to / 2 - p.front / 2);
        lay(row.slots, trimStretch(r, p.sleeve, first.sleeve), to / 2 + p.front / 2 + 1);
      }
    } else {
      row = to === count ? plainRow(to) : { slots: Array(to).fill(GROUND_SLOT), made: madeAround(count, to) };
      const r = i - yoke.trim.from;
      if (r >= 0 && r < neckTrim.length) row.slots = trimStretch(r, to, to);
    }
    if (i >= placed.top) withFelines(row.slots, placed, i - placed.top);
    rows.push(row);
    count = to;
  });
  return rows;
};

/** A feline's row laid in, centred on the front and on the middle of the back: its stitches only, the ground between them left as it is. */
const withFelines = (slots: string[], placed: Placed, r: number) => {
  if (r < 0 || r >= placed.height) return;
  const n = slots.length;
  const w = placed.width;
  placed.front[r].forEach((v, x) => v !== GROUND && (slots[n / 2 - w / 2 + x] = SLOT_OF[v]));
  placed.back[r].forEach((v, x) => v !== GROUND && (slots[(n - w / 2 + x) % n] = SLOT_OF[v]));
};

/* ------------------------------------------------------------- the writing */

/** A chart's cells, one object for each yarn and symbol, shared: a jumper's charts have hundreds of thousands. */
const cells = new Map<string, ChartCell>();
const cellOf = (slot: string, symbol?: "m1" | "kfb" | "kbf"): ChartCell => {
  const key = `${slot}${symbol ?? ""}`;
  let cell = cells.get(key);
  if (!cell) cells.set(key, (cell = Object.freeze(symbol ? { slot, symbol } : { slot })));
  return cell;
};

/** Rounds as specs: plain runs as rounds, shaping rounds as shaping, the rest as one chart per run of patterned rounds. */
/** What the stitch before new stitch `j` is worked as, to make it. */
const forkOf = (r: Row, j: number): "kfb" | "kbf" => (r.twice?.kbf[j] ? "kbf" : "kfb");

class Writer {
  specs: RoundSpec[] = [];
  charts: Chart[] = [];
  private run: Row[] = [];
  constructor(
    private readonly id: string,
    private readonly name: string,
  ) {}

  private flush() {
    if (!this.run.length) return;
    const id = `${this.id}-${this.charts.length + 1}`;
    const rows: ChartCell[][] = this.run.map((r) =>
      r.slots.map((slot, j) => cellOf(slot, r.made?.[j] ? "m1" : r.twice && r.made?.[j + 1] ? forkOf(r, j + 1) : undefined)),
    );
    this.charts.push({ id, name: this.name, rows });
    this.specs.push({ type: "chart", chart: id, rows: [1, rows.length], repeats: 1 });
    this.run = [];
  }

  row(r: Row, from: number) {
    const to = r.slots.length;
    if (isPlain(r) && to === from) {
      this.flush();
      const last = this.specs[this.specs.length - 1];
      if (last?.type === "rounds" && last.slot === r.slots[0] && !last.sequence) this.specs[this.specs.length - 1] = { ...last, count: last.count + 1 };
      else this.specs.push({ type: "rounds", count: 1, slot: r.slots[0] });
    } else if (r.slots.every((s) => s === r.slots[0])) {
      this.flush();
      const ops: ShapingOp[] = [];
      let run = 0;
      const made = r.made!;
      for (let j = 0; j < made.length; j++) {
        // A KFB or KBF makes the stitch it works and the new one after it; a make-one only the new one.
        const fork = r.twice && made[j + 1];
        if (!made[j] && !fork) {
          run++;
          continue;
        }
        if (run) ops.push({ work: "k", times: run });
        run = 0;
        if (fork) {
          ops.push({ work: forkOf(r, j + 1) });
          j++;
        } else ops.push({ work: "m1" });
      }
      if (run) ops.push({ work: "k", times: run });
      this.specs.push({ type: "shaping", slot: r.slots[0], ops, to });
    } else this.run.push(r);
  }

  push(spec: RoundSpec) {
    this.flush();
    this.specs.push(spec);
  }

  done() {
    this.flush();
    return this.specs;
  }
}

export interface Knitted {
  sections: Section[];
  charts: Chart[];
  checks: Record<string, number>;
  /** What was laid out, for the tests and the story. */
  placed: Omit<Placed, "front" | "back">;
  counts: Counts;
  cuffBand: { count: number; repeats: number };
  /** Where the neck's trim is, in the yoke's rows after the short rows, and the count it goes round. */
  trim: Yoke["trim"];
}

/** The cuff band's count: whole repeats of the feline and a few stitches either side, near a quarter more than the cuff, an even number. */
export const cuffBandOf = (cuff: number): { count: number; repeats: number; gap: number } => {
  const w = cuffFeline[0].length;
  let best = { count: 0, repeats: 0, gap: 0 };
  for (const repeats of [2, 3, 4])
    for (let gap = 2; gap <= 10; gap++) {
      const count = repeats * (w + gap);
      if (count % 2) continue;
      if (!best.count || Math.abs(count - cuff * 1.25) < Math.abs(best.count - cuff * 1.25)) best = { count, repeats, gap };
    }
  return best;
};

export const knit = (size: Measured, construction: Construction, prefix: string): Knitted => {
  const graded = countsOf(size);
  const deeper = construction === "raglan" ? raglanDepth(graded) - graded.yokeRounds : 0;
  const c = { ...graded, yokeRounds: graded.yokeRounds + deeper, bodyRounds: graded.bodyRounds - deeper };
  const yoke = construction === "raglan" ? raglanYoke(c) : circularYoke(c);
  const placed = place(c, yoke, construction);

  /* ---------------------------------------------------------------- yoke */
  const yw = new Writer(`${prefix}yoke`, "Yoke");
  let count = yoke.neck;
  for (const row of yokeRows(yoke, placed, construction)) {
    yw.row(row, count);
    count = row.slots.length;
  }
  const yokeSpecs: RoundSpec[] = [
    { type: "castOn", count: yoke.neck, slot: RED_SLOT, fabric: "rib", check: "neck" },
    { type: "join" },
    { type: "rounds", count: ribs.neck, slot: RED_SLOT, sequence: ["k", "p"], fabric: "rib", markers: [{ after: 0, place: startOfRound }] },
    { type: "needles", to: "main" },
    { type: "shortRows", first: Math.round(yoke.neck * 0.16), extend: Math.round(yoke.neck * 0.05), pairs: 3, slot: GROUND_SLOT },
    ...yw.done(),
  ];
  yokeSpecs[yokeSpecs.length - 1] = { ...yokeSpecs[yokeSpecs.length - 1], check: "yoke" };

  /* ---------------------------------------------------------------- body */
  const bodyCount = 2 * c.half + 2 * c.underarm;
  // The body's rows from the divide down, the felines laid in, then the waist band.
  const bodyRows: Row[] = [];
  const bandStart = placed.band ? c.bodyRounds - HEM_ROWS : c.bodyRounds;
  const yokeLength = yoke.counts.length;
  for (let i = 0; i < c.bodyRounds; i++) {
    let row = plainRow(bodyCount);
    withFelines(row.slots, placed, yokeLength + i - placed.top);
    if (i >= bandStart) row = { slots: hemRow(i - bandStart, bodyCount, bodyCount / 2) };
    bodyRows.push(row);
  }
  // The divide round knits the first of them, its underarms cast on in the ground.
  const first = bodyRows[0].slots;
  const work = (from: number, n: number): DivideSegment => ({ work: n, slots: first.slice(from, from + n) });
  const bw = new Writer(`${prefix}body`, "Body");
  bodyRows.slice(1).forEach((row) => bw.row(row, bodyCount));
  const bodySpecs: RoundSpec[] = [
    {
      type: "divide",
      slot: GROUND_SLOT,
      segments: [
        work(0, c.half / 2),
        { hold: "sleeve-right", count: c.held, castOn: c.underarm },
        work(c.half / 2 + c.underarm, c.half),
        { hold: "sleeve-left", count: c.held, castOn: c.underarm },
        work(c.half / 2 + c.underarm + c.half + c.underarm, c.half / 2),
      ],
      check: "body",
    },
    ...bw.done(),
    { type: "needles", to: "rib" },
    { type: "rounds", count: ribs.hem, slot: RED_SLOT, sequence: ["k", "p"], fabric: "rib", check: "hem" },
    { type: "bindOff", slot: RED_SLOT, fabric: "rib", sequence: ["k", "p"] },
  ];

  /* ------------------------------------------------------------- sleeves */
  const band = cuffBandOf(c.cuff);
  const bandRows = cuffFeline.length + 2 * (cuffEdges.gold + cuffEdges.red);
  // After the pick-up round: the taper, the cuff band, and a round of red that gathers it in to the cuff's rib.
  const taper = c.sleeveRounds - 1 - bandRows - 1;
  const decreases = (c.upperArm - band.count) / 2;
  if (!Number.isInteger(decreases) || decreases < 0) throw new Error(`a sleeve of ${c.upperArm} cannot taper to a band of ${band.count}`);
  const decreaseAt = spread(decreases, taper - 4, Math.min(6, Math.floor(taper / 6)), taper - 4);
  const sw = new Writer(`${prefix}sleeve`, "Sleeve");
  let n = c.upperArm;
  for (let i = 0; i < taper; i++) {
    if (decreaseAt.has(i)) {
      n -= 2;
      sw.push({ type: "shaping", slot: GROUND_SLOT, ops: underarmDecrease, to: n });
    } else sw.row(plainRow(n), n);
  }
  const cuffChart: Chart = { id: `${prefix}cuff`, name: "Cuff band", rows: cuffRows(band.gap) };
  sw.push({ type: "chart", chart: cuffChart.id, rows: [1, cuffChart.rows.length] });
  if (band.count > c.cuff) sw.push({ type: "shaping", slot: RED_SLOT, ops: decreaseEvenly(band.count, c.cuff), to: c.cuff });
  else if (band.count < c.cuff) sw.push({ type: "shaping", slot: RED_SLOT, ops: increaseEvenly(band.count, c.cuff), to: c.cuff });
  else sw.push({ type: "rounds", count: 1, slot: RED_SLOT });
  const sleeveSpecs = sw.done();
  const sleeveSection = (piece: string, label: string): Section => {
    const [firstRound, ...rest] = sleeveSpecs;
    if (firstRound.type !== "rounds" && firstRound.type !== "shaping") throw new Error("a sleeve's second round is a round of stitches");
    return {
      label,
      piece,
      rounds: [
        { type: "piece", held: piece, before: c.underarm / 2, after: c.underarm / 2, slot: GROUND_SLOT, check: `${piece}:top` },
        { ...firstRound, markers: [{ after: 0, place: sleeveStart(piece) }] },
        ...rest,
        { type: "needles", to: "rib" },
        { type: "rounds", count: ribs.cuff, slot: RED_SLOT, sequence: ["k", "p"], fabric: "rib", check: `${piece}:cuff` },
        { type: "bindOff", slot: RED_SLOT, fabric: "rib", sequence: ["k", "p"] },
      ],
    };
  };

  const { front: _front, back: _back, ...summary } = placed;
  void _front;
  void _back;
  return {
    sections: [
      { label: "Yoke", piece: "yoke", rounds: yokeSpecs },
      { label: "Body", piece: "body", rounds: bodySpecs },
      sleeveSection("sleeve-left", "Left sleeve"),
      sleeveSection("sleeve-right", "Right sleeve"),
    ],
    charts: [...yw.charts, ...bw.charts, ...sw.charts, cuffChart],
    checks: {
      neck: yoke.neck,
      yoke: 2 * c.half + 2 * c.held,
      body: bodyCount,
      hem: bodyCount,
      "sleeve-left:top": c.upperArm,
      "sleeve-left:cuff": c.cuff,
      "sleeve-right:top": c.upperArm,
      "sleeve-right:cuff": c.cuff,
    },
    placed: summary,
    counts: c,
    cuffBand: { count: band.count, repeats: band.repeats },
    trim: yoke.trim,
  };
};

/**
 * A round of the hem band, `n` stitches: the creatures as many as fit 42
 * stitches apart, spread evenly round, one of them under the middle of the
 * front.
 */
const hemRow = (r: number, n: number, frontMiddle: number): string[] => {
  const row = hemCreature[r];
  const w = row.length;
  const creatures = Math.floor(n / 42);
  const out: string[] = Array(n).fill(MOTIF_SLOT[row[0]]);
  for (let k = 0; k < creatures; k++) {
    const start = Math.round(frontMiddle - w / 2 + (k * n) / creatures);
    for (let x = 0; x < w; x++) out[(((start + x) % n) + n) % n] = MOTIF_SLOT[row[x]];
  }
  return out;
};

/** The cuff band's rows, one repeat: the feline with `gap` stitches of red shared either side, between stripes of red and gold. */
const cuffRows = (gap: number): ChartCell[][] => {
  const w = cuffFeline[0].length + gap;
  const left = Math.floor(gap / 2);
  const solid = (slot: string, k: number) => Array.from({ length: k }, () => Array.from({ length: w }, () => cellOf(slot)));
  const feline = cuffFeline.map((line) => Array.from({ length: w }, (_, x) => cellOf(MOTIF_SLOT[line[x - left] ?? "."])));
  return [...solid("D", cuffEdges.gold), ...solid("B", cuffEdges.red), ...feline, ...solid("B", cuffEdges.red), ...solid("D", cuffEdges.gold)];
};

