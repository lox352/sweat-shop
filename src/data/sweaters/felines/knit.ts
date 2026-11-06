import type { Chart, ChartCell, DivideSegment, RoundSpec, Section, ShapingOp } from "../types";
import { decreaseEvenly, increaseEvenly, underarmDecrease } from "../writing";
import { cuffEdges, cuffFeline, hemCreature } from "./motifs";
import { type FelineId, GROUND, drawFeline } from "./raster";

/**
 * A feline jumper, knitted from the neck down: one of the tunic's felines on
 * the front, the other on the back, each as large as its piece has room for;
 * the tunic's hem band round the waist where there is room for that too; and
 * the sleeve ends' felines round each cuff.
 *
 * Two constructions:
 * - **Raglan.** The yoke grows at four raglan lines, each a stitch knitted
 *   plain with a make-one either side of it: the front and back every time
 *   the yoke has a body increase, the sleeves every time it has a sleeve
 *   increase, each spread evenly down the yoke. The front and back reach
 *   their full width only at the divide, so a feline rises into the yoke
 *   only as far as the front is wider than it, row by row.
 * - **Circular yoke.** The yoke grows in plain rounds, increased evenly all
 *   the way round, to its full count by about two thirds of its depth, and
 *   then goes straight to the divide: a feline rises into that straight part
 *   of it, its front and back as wide there as below.
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

const nearest = (v: number, m: number) => Math.max(m, Math.round(v / m) * m);

/** "the start of the round", and each sleeve's: as the strip samplers mark them. */
export const startOfRound = "the start of the round";
const sleeveStart = (piece: string) => `the start of the ${piece === "sleeve-left" ? "left" : "right"} sleeve's rounds`;

/** A round as knitted: each stitch's yarn, and a make-one before the stitch where marked. */
interface Row {
  slots: string[];
  /** For each stitch it leaves, whether it is a make-one. */
  made?: boolean[];
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
 * A yoke, before any feline: each round's count, and for a raglan where its
 * make-ones go - the front, back and sleeve panels' widths round by round.
 */
interface Yoke {
  neck: number;
  /** Rows of the yoke after the short rows, each with its count and make-ones; the feline is laid into them later. */
  rows: Row[];
  /** For each row, how wide the front (and the back) is, and where it begins in the round. */
  front: { width: number; at: number }[];
  /** The rows a feline may not reach into: those with increases spread round them. */
  firstFree: number;
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
  const rows: Row[] = [];
  const front: Yoke["front"] = [];
  let [back, fr, sl] = [front0, front0, sleeve0];
  for (let i = 0; i < n; i++) {
    const b = bodyAt.has(i) ? 1 : 0;
    const s = sleeveAt.has(i) ? 1 : 0;
    [back, fr, sl] = [back + 2 * b, fr + 2 * b, sl + 2 * s];
    // The round from the middle of the back: half the back, a line, a sleeve, a line, the front, a line, a sleeve, a line, the back's other half.
    const parts: [number, boolean, boolean][] = [
      [back / 2, false, !!b],
      [1, false, false],
      [sl, !!s, !!s],
      [1, false, false],
      [fr, !!b, !!b],
      [1, false, false],
      [sl, !!s, !!s],
      [1, false, false],
      [back / 2, !!b, false],
    ];
    const made: boolean[] = [];
    for (const [w, first, last] of parts) for (let k = 0; k < w; k++) made.push((first && k === 0) || (last && k === w - 1));
    rows.push({ slots: Array(made.length).fill(GROUND_SLOT), made });
    front.push({ width: fr, at: back / 2 + 1 + sl + 1 });
  }
  if (fr !== c.half || sl + 2 !== c.held) throw new Error("a raglan that does not reach its divide");
  return { neck, rows, front, firstFree: 0 };
};

const circularYoke = (c: Counts): Yoke => {
  const total = 2 * c.half + 2 * c.held;
  const n = c.yokeRounds;
  // Five or six increase rounds, the counts growing by the same factor each time, the last two thirds of the way down.
  const steps = Math.max(4, Math.ceil(Math.log(total / c.neck) / Math.log(1.3)));
  const last = Math.round(n * 0.66);
  const at = [...spread(steps, last, 1, last)].sort((a, b) => a - b);
  const counts = at.map((_, k) => (k === steps - 1 ? total : 2 * Math.round((c.neck * (total / c.neck) ** ((k + 1) / steps)) / 2)));
  const rows: Row[] = [];
  let count = c.neck;
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (at[k] === i) {
      const to = counts[k++];
      const made = madeEvenly(count, to);
      rows.push({ slots: Array(to).fill(GROUND_SLOT), made });
      count = to;
    } else rows.push(plainRow(count));
  }
  const front = rows.map(() => ({ width: c.half, at: c.half / 2 + c.held }));
  return { neck: c.neck, rows, front, firstFree: last + 2 };
};

/** Where increaseEvenly puts its make-ones, as a mark on each stitch of the round it leaves. */
const madeEvenly = (from: number, to: number): boolean[] => {
  const made: boolean[] = [];
  const walk = (ops: ShapingOp[]) => {
    for (const op of ops) {
      if ("repeat" in op) for (let t = 0; t < ("times" in op ? op.times : 0); t++) walk(op.repeat);
      else if (op.work === "m1") made.push(true);
      else if (op.work === "k") for (let t = 0; t < op.times; t++) made.push(false);
    }
  };
  walk(increaseEvenly(from, to));
  if (made.length !== to) throw new Error(`increasing ${from} to ${to} made ${made.length}`);
  return made;
};

/* ------------------------------------------------------------- the felines */

interface Placed {
  width: number;
  height: number;
  /** Rows of the feline above the divide, in the yoke. */
  inYoke: number;
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

/**
 * The felines as large as the front and back have room for: as wide as the
 * front less a margin, as tall as the body from the divide to the waist band
 * (or near the rib) and as far up into the yoke as the front is wide enough
 * there, row by row. With the waist band where that leaves the felines at
 * least BAND_KEEPS of the width they would have without it.
 */
const place = (c: Counts, yoke: Yoke): Placed => {
  const fit = (band: boolean): Placed | undefined => {
    const below = c.bodyRounds - (band ? HEM_ROWS : GAP_ABOVE_RIB);
    const tryWidth = (width: number): Placed | undefined => {
      const height = heightOf(felineOn.front, width);
      const inYoke = height - below;
      if (inYoke > yoke.rows.length - yoke.firstFree) return undefined;
      const front = drawFeline(felineOn.front, width, gauge).grid;
      const back = drawFeline(felineOn.back, width, gauge).grid;
      const [rf, rb] = [reachOf(front), reachOf(back)];
      // Each row in the yoke within its front (and back), a margin either side.
      for (let r = 0; r < inYoke; r++) {
        const yokeRow = yoke.rows.length - inYoke + r;
        if (2 * (Math.max(rf[r], rb[r]) + MARGIN) > yoke.front[yokeRow].width) return undefined;
      }
      return { width, height, inYoke: Math.max(0, inYoke), band, front, back };
    };
    // The widest that fits, by halving: a wider feline is taller and reaches further into the narrowing yoke, so what fits is every width up to some.
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

/** How many rows a feline drawn `width` stitches wide is. */
const heightOf = (id: FelineId, width: number) => drawFeline(id, width, gauge, true).height;

/** A feline's row laid into a front or back `width` wide, centred, as yarns. */
const laid = (row: number[], width: number): string[] => {
  const out: string[] = Array(width).fill(GROUND_SLOT);
  const left = Math.floor((width - row.length) / 2);
  row.forEach((v, x) => (out[left + x] = SLOT_OF[v]));
  return out;
};

/* ------------------------------------------------------------- the writing */

/** A chart's cells, one object for each yarn and make-one or not, shared: a jumper's charts have hundreds of thousands. */
const cells = new Map<string, ChartCell>();
const cellOf = (slot: string, made = false): ChartCell => {
  const key = `${slot}${made ? "+" : ""}`;
  let cell = cells.get(key);
  if (!cell) cells.set(key, (cell = Object.freeze(made ? { slot, symbol: "m1" as const } : { slot })));
  return cell;
};

/** Rounds as specs: plain runs as rounds, shaping rounds as shaping, the rest as one chart per run of patterned rounds. */
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
    const rows: ChartCell[][] = this.run.map((r) => r.slots.map((slot, j) => cellOf(slot, !!r.made?.[j])));
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
      r.made!.forEach((m) => {
        if (!m) return void run++;
        if (run) ops.push({ work: "k", times: run });
        ops.push({ work: "m1" });
        run = 0;
      });
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
  const placed = place(c, yoke);
  const { height, inYoke } = placed;

  // The felines' rows, top first, each as laid into its front or back.
  // The back, seen from outside, is the round's last stitches then its first: its left half ends the round and its right half begins it.
  const withFelines = (row: Row, r: number, front: { width: number; at: number }): Row => {
    const n = row.slots.length;
    const slots = [...row.slots];
    laid(placed.front[r], front.width).forEach((s, x) => (slots[front.at + x] = s));
    laid(placed.back[r], front.width).forEach((s, x) => (slots[(n - front.width / 2 + x) % n] = s));
    return { ...row, slots };
  };

  /* ---------------------------------------------------------------- yoke */
  const yw = new Writer(`${prefix}yoke`, "Yoke");
  let count = yoke.neck;
  yoke.rows.forEach((row, i) => {
    const r = i - (yoke.rows.length - inYoke);
    const laidRow = r >= 0 ? withFelines(row, r, yoke.front[i]) : row;
    yw.row(laidRow, count);
    count = laidRow.slots.length;
  });
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
  const frontAt = c.half / 2 + c.underarm;
  // The body's rows from the divide down, the felines laid in, then the waist band.
  const bodyRows: Row[] = [];
  const bandStart = placed.band ? c.bodyRounds - HEM_ROWS : c.bodyRounds;
  const felineStart = (placed.band ? bandStart : c.bodyRounds - GAP_ABOVE_RIB) - (height - inYoke);
  for (let i = 0; i < c.bodyRounds; i++) {
    let row = plainRow(bodyCount);
    // The felines' top rows are in the yoke: the body's first is the row after them.
    const r = i - felineStart + inYoke;
    if (r >= inYoke && r < height) row = withFelines(row, r, { width: c.half, at: frontAt });
    if (i >= bandStart) row = { slots: hemRow(i - bandStart, bodyCount, frontAt + c.half / 2) };
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

  const summary = { width: placed.width, height: placed.height, inYoke: placed.inYoke, band: placed.band };
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

