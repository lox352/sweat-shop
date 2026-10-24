import { type Cut, type CutRow, type Round, cutsOf, edgeOf, groundOf, isPlain, patterns, patternOf, seamsOf, topDown } from "./cuts";
import { refit } from "./refit";
import type { Band } from "./slots";

/**
 * Where each year goes on a strip sampler, and how many rounds it has.
 *
 * Two layouts:
 * - **Lined up**: all thirteen years from the neck to the hem, and the same
 *   strips again down each sleeve, round for round, so they line up when the
 *   arms hang down; the last year carries on down the sleeve, through the
 *   rest of its hat's sequence, to the cuff. Every strip is within five
 *   percent of its piece's average height, to the nearest round: one plain
 *   round (where any shaping goes) and a cut of the year's pattern, with
 *   plain rounds to make up the height, or its one-colour edge rounds taken
 *   off - framed alike, as many plain rounds in its yarn above it as below,
 *   as Each Year Once's are (see framingsOf).
 * - **Each year once, refitted**: 2014 to 2016 round the yoke, 2017 to 2021
 *   down the body, 2022 to 2026 down both sleeves, each cut as full as there
 *   is room for; see refit.ts.
 */

export const gauge = { stitches: 3.2, rounds: 3.8 };
export const ribs = { neck: 9, hem: 14, cuff: 14 };

export interface Measured {
  chestCm: number;
  neckCm: number;
  yokeDepthCm: number;
  bodyLengthCm: number;
  upperArmCm: number;
  sleeveLengthCm: number;
  cuffCm: number;
}

/**
 * A round of a strip before any counts: plain in one of the year's yarns, or
 * a row of one of its charts - and, once a piece is being knitted, where that
 * row stands in its band (see knit's banded).
 */
export type Row = { year: number; plain: string } | ({ year: number; band?: Band } & CutRow);

export interface Strip {
  year: number;
  height: number;
  cut: Cut;
  ground: string;
}

export interface Plan {
  strips: { yoke: Strip[]; body: Strip[]; sleeve: Strip[] };
  rows: { yoke: Row[]; body: Row[]; sleeve: Row[] };
  /** Rounds of colourwork on each piece. */
  depth: { yoke: number; body: number; sleeve: number };
  /** For a lined-up layout: how the last year carries on down the sleeve. */
  onward?: { year: number; pattern: number; plain: number };
}

export type Layout = { kind: "lined"; newestFirst: boolean } | { kind: "refit" };

const years = patterns.map((p) => p.year);

/** Colourwork rounds each piece has, before any year is placed. */
const budgets = (size: Measured) => ({
  yoke: Math.round(size.yokeDepthCm * gauge.rounds) - ribs.neck - 1,
  body: Math.round(size.bodyLengthCm * gauge.rounds) - ribs.hem - 2,
  sleeve: Math.round(size.sleeveLengthCm * gauge.rounds) - ribs.cuff - 2,
});

/** A strip laid out: its rounds, the cut's rows it keeps, and what the layout costs. */
interface Framed {
  strip: Strip;
  rows: Row[];
  kept: CutRow[];
  /** Plain rounds in its own yarn above it: its plain round, padding, and its pattern's own plain top rows. */
  above: number;
  cost: number;
}

const solidRow = (year: number, r: CutRow) => isPlain({ year, ...r });

/** How many of these rows, from the first, are one colour. */
const leadingSolid = (year: number, rows: CutRow[]) => {
  let n = 0;
  while (n < rows.length && solidRow(year, rows[n])) n++;
  return n;
};

/**
 * A run of a cut's rows with its plain rounds, by the rules Each Year Once
 * keeps (see refit): a plain round wherever two of its quanta meet that don't
 * go together, and wherever the repeat changes inside it if `joins` of those
 * are wanted, in the stronger neighbour's background; `above` plain rounds
 * (its plain round and padding) in its top edge's background and `below` in
 * its bottom edge's.
 */
const lay = (year: number, kept: CutRow[], sep: number, above: number, joins: number, below: number): Row[] => {
  const rows: Row[] = [];
  const top = edgeOf(kept.map((r) => ({ year, ...r })), true).letter;
  const bottom = edgeOf(kept.map((r) => ({ year, ...r })), false).letter;
  for (let k = 0; k < sep + above; k++) rows.push({ year, plain: top });
  const seams = new Set(seamsOf(year, kept));
  let atJoins = joins;
  kept.forEach((r, k) => {
    const join = k > 0 && r.w !== kept[k - 1].w && !seams.has(k) && atJoins > 0;
    if (seams.has(k) || join) {
      const upper = edgeOf(rows.filter((x) => !("plain" in x)) as Round[], false);
      const lower = edgeOf(kept.slice(k).map((x) => ({ year, ...x })), true);
      rows.push({ year, plain: (lower.share > upper.share ? lower : upper).letter });
      if (join) atJoins--;
    }
    rows.push({ year, ...r });
  });
  for (let k = 0; k < below; k++) rows.push({ year, plain: bottom });
  return rows;
};

/** Where the repeat changes inside these rows, other than where a plain round must go anyway. */
const joinsOf = (year: number, kept: CutRow[]) => {
  const seams = new Set(seamsOf(year, kept));
  return kept.filter((r, k) => k > 0 && r.w !== kept[k - 1].w && !seams.has(k)).length;
};

/**
 * A strip of `h` rounds framed alike, as Each Year Once's are: as many plain
 * rounds in its own yarn above its pattern as below - its plain round, its
 * padding, and its pattern's own one-colour edge rows. Its plain round goes
 * above it, where any shaping goes; beside a pattern whose own top row is one
 * colour it may be left out, that row taking the shaping, unless the strip
 * begins its piece. Every cut and every way of taking its edge rows off that
 * frames it alike, the one with the most pattern first.
 */
const framingsOf = (year: number, h: number, first: boolean): Framed[] => {
  const all: Framed[] = [];
  for (const cut of cutsOf(year)) {
    const flat = topDown(year, cut.parts);
    for (let tT = 0; tT <= cut.edgeTop; tT++) {
      for (let tB = 0; tB <= cut.edgeBottom; tB++) {
        const kept = flat.slice(tT, flat.length - tB);
        if (!kept.length) continue;
        const lead = leadingSolid(year, kept);
        const trail = leadingSolid(year, [...kept].reverse());
        const joins = joinsOf(year, kept);
        const free = h - kept.length - seamsOf(year, kept).length;
        for (const sep of first || !lead ? [1] : [1, 0]) {
          for (let j = Math.min(joins, Math.max(0, free - sep)); j >= 0; j--) {
            const rest = free - sep - j;
            if (rest < 0 || (rest + trail - lead - sep) % 2) continue;
            const above = (rest + trail - lead - sep) / 2;
            const below = rest - above;
            if (above < 0 || below < 0) continue;
            // A plain round costs a round of pattern; an edge row taken off, less; a round where the repeat changes, less again.
            const cost = (cut.neat ? 0 : 1.5) + sep + above + below + 0.7 * j + 0.4 * (tT + tB) + (sep ? 0 : 0.3);
            const rows = lay(year, kept, sep, above, j, below);
            all.push({ strip: { year, height: h, cut, ground: groundOf(year, cut.parts) }, rows, kept, above: sep + above + lead, cost });
          }
        }
      }
    }
  }
  return all.sort((a, b) => a.cost - b.cost);
};

const framings = new Map<string, Framed | null>();
const framed = (year: number, h: number, first: boolean): Framed | null => {
  const key = `${year} ${h} ${first}`;
  if (!framings.has(key)) framings.set(key, framingsOf(year, h, first)[0] ?? null);
  return framings.get(key)!;
};

/** A plain round left out of a piece, against the plain rounds a layout costs (see framingsOf). */
const SHORTER = 6;

/**
 * The strips of a piece, each framed alike and within 5% of their average:
 * the heights that cost least, with the piece as many rounds shorter as it
 * must be - a strip's pattern can be framed alike only at every other height,
 * and the 5% may not reach.
 */
const settle = (years: number[], total: number): { framed: Framed[]; cost: number } | null => {
  let best: { framed: Framed[]; cost: number } | null = null;
  for (let d = 0; d <= 3; d++) {
    const mean = (total - d) / years.length;
    const lo = Math.round(0.95 * mean);
    const hi = Math.round(1.05 * mean);
    // The cheapest way to lay out the first i strips in t rounds.
    let row = new Map<number, { cost: number; framed: Framed[] }>([[0, { cost: 0, framed: [] }]]);
    years.forEach((year, i) => {
      const next = new Map<number, { cost: number; framed: Framed[] }>();
      for (const [t, was] of row) {
        for (let h = lo; h <= hi; h++) {
          const f = framed(year, h, i === 0);
          if (!f) continue;
          const at = next.get(t + h);
          if (!at || was.cost + f.cost < at.cost) next.set(t + h, { cost: was.cost + f.cost, framed: [...was.framed, f] });
        }
      }
      row = next;
    });
    const done = row.get(total - d);
    if (done && (!best || done.cost + SHORTER * d < best.cost)) best = { framed: done.framed, cost: done.cost + SHORTER * d };
  }
  return best;
};

/* ---------------------------------------------------------------- lined up */

const lined = (size: Measured, newestFirst: boolean): Plan => {
  const b = budgets(size);
  const P = b.yoke + b.body;
  const T = P / 13;
  const lo = Math.round(0.95 * T);
  const hi = Math.round(1.05 * T);
  const order = [...years].sort((p, q) => (newestFirst ? q - p : p - q));
  // How many strips on the yoke, and the depth that puts the divide between two years.
  let plan: { k: number; yoke: number; off: number } | undefined;
  for (const k of [Math.round(b.yoke / T) - 1, Math.round(b.yoke / T), Math.round(b.yoke / T) + 1]) {
    const min = Math.max(k * lo, P - (13 - k) * hi);
    const max = Math.min(k * hi, P - (13 - k) * lo);
    if (min > max) continue;
    const yoke = Math.max(min, Math.min(max, b.yoke));
    const off = Math.abs(yoke - b.yoke);
    if (!plan || off < plan.off) plan = { k, yoke, off };
  }
  if (!plan) throw new Error("no way to divide the yoke between two years");
  // The divide moved a round or two, if that frames the strips better than taking rounds out.
  let split: { yoke: Framed[]; body: Framed[]; cost: number } | undefined;
  for (let dy = -2; dy <= 2; dy++) {
    const y = settle(order.slice(0, plan.k), plan.yoke + dy);
    const bo = settle(order.slice(plan.k), P - plan.yoke - dy);
    if (!y || !bo) continue;
    const cost = y.cost + bo.cost + 1.5 * Math.abs(dy);
    if (!split || cost < split.cost) split = { yoke: y.framed, body: bo.framed, cost };
  }
  if (!split) throw new Error("no way to frame every strip alike");
  const { yoke, body } = split;
  const yokeRows = yoke.flatMap((f) => f.rows);
  // The sleeves: the body's strips, and the last year's carried on down to the cuff.
  const extra = b.sleeve - b.body;
  const last = body[body.length - 1];
  const onward = onwardOf(last, last.strip.height + extra);
  if (!onward) throw new Error(`${last.strip.year} can't carry on down the sleeve`);
  const bodyRows = body.flatMap((f) => f.rows);
  const sleeveRows: Row[] = [...body.slice(0, -1).flatMap((f) => f.rows), ...onward.rows];
  const strips = (fs: Framed[]) => fs.map((f) => f.strip);
  return {
    strips: { yoke: strips(yoke), body: strips(body), sleeve: [...strips(body.slice(0, -1)), { ...last.strip, height: onward.rows.length }] },
    rows: { yoke: yokeRows, body: bodyRows, sleeve: sleeveRows },
    depth: { yoke: yokeRows.length, body: bodyRows.length, sleeve: sleeveRows.length },
    onward: { year: last.strip.year, pattern: onward.pattern, plain: onward.plain },
  };
};

/**
 * The last strip down a sleeve, `length` rounds: the body's, its pattern
 * carried on through the rest of its hat's sequence, and framed alike - its
 * pattern beginning on the same round as on the body, if it can, and ending
 * where a part of the hat ends, if one ends near; the sleeve a round longer or
 * shorter if that's the only way.
 */
const onwardOf = (last: Framed, length: number): { rows: Row[]; pattern: number; plain: number; cost: number } | undefined => {
  const year = last.strip.year;
  const p = patternOf(year);
  const full = topDown(year, p.full ?? p.options[p.options.length - 1].parts);
  const kept = last.kept;
  let from = full.findIndex((_, i) => kept.every((r, k) => full[i + k]?.chart === r.chart && full[i + k]?.row === r.row));
  if (from < 0) from = full.length;
  const lead = leadingSolid(year, kept);
  // The plain round and padding above the pattern on the body.
  const top = last.above - lead;
  let best: { rows: Row[]; pattern: number; plain: number; cost: number } | undefined;
  for (let take = 0; from + kept.length + take <= full.length; take++) for (const dh of [0, -1, 1]) {
    const h = length + dh;
    const rows = full.slice(from, from + kept.length + take);
    const trail = leadingSolid(year, [...rows].reverse());
    const free = h - rows.length - seamsOf(year, rows).length;
    const joins = joinsOf(year, rows);
    for (let j = Math.min(joins, Math.max(0, free - 1)); j >= 0; j--) {
      // Plain rounds above and below, the plain round among them, framed alike.
      const ends = free - j;
      if (ends < 1 || (ends + trail - lead) % 2) continue;
      const aboveAll = (ends + trail - lead) / 2;
      const below = ends - aboveAll;
      if (aboveAll < 1 || below < 0) continue;
      const ending = from + rows.length === full.length || full[from + rows.length].chart !== rows[rows.length - 1].chart;
      const cost = 2 * Math.abs(aboveAll - top) + ends + 0.7 * j + (ending ? 0 : 3) + SHORTER * Math.abs(dh);
      if (best && cost >= best.cost) continue;
      best = { rows: lay(year, rows, 1, aboveAll - 1, j, below), pattern: take, plain: ends, cost };
    }
  }
  return best;
};

/* --------------------------------------------------------- each year once */

/** How many years on each piece, and the yoke's depth, for the most even lengths. */
export const splitOf = (size: Measured) => {
  const b = budgets(size);
  const T = (b.yoke + b.body + b.sleeve) / 13;
  let best: { k: number; m: number; n: number; yoke: number; body: number; sleeve: number; T: number; dev: number } | undefined;
  for (let k = 2; k <= 5; k++) {
    for (let m = 3; m <= 7; m++) {
      const n = 13 - k - m;
      if (n < 3) continue;
      for (let dy = -8; dy <= 8; dy++) {
        const h = [(b.yoke + dy) / k, (b.body - dy) / m, b.sleeve / n];
        const dev = Math.max(...h.map((x) => Math.abs(x / T - 1)));
        if (!best || dev < best.dev - 1e-9) best = { k, m, n, yoke: b.yoke + dy, body: b.body - dy, sleeve: b.sleeve, T, dev };
      }
    }
  }
  return best!;
};

export const planOf = (size: Measured, layout: Layout, sizeId: string): Plan =>
  layout.kind === "lined" ? lined(size, layout.newestFirst) : refit(size, sizeId);
