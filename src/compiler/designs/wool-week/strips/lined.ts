import { patterns } from "./cuts";
import { type Gauge, type Measured, type Plan, budgets } from "./plan";
import { type Piece, pieceOf, reachAt } from "./refit";

/**
 * Lined up: these years, in order, from the yoke down the body, each in a
 * strip of about the same height, and the same strips down each sleeve round
 * for round, with the last carried on to the cuff - a whole sweater's
 * thirteen, or what is left of one part knitted.
 *
 * A strip is a year laid out by Each Year Once's rules (see refit): cut down
 * its ladder to the height it is given, and framed alike, a plain round of
 * its own above its pattern where any shaping goes. So a strip is a piece of
 * one year, and a piece is its strips one after another: every strip begins
 * with a round of one yarn, and the body's first is the dividing round (see
 * Plan).
 *
 * - **About the same height.** Every strip within 5% of the average of its
 *   piece's, where they will go so; and where they will not - a year has no
 *   cut that short - within the least more that they will. The yoke's
 *   strips and the body's are within as much of the average of them all.
 * - **The divide falls between two strips**, as near the yoke's depth as the
 *   strips' heights let it, and no more than `reach` rounds from it. A yoke
 *   with too little left for a strip has none, and the body is as much
 *   longer, or shorter, as the yoke is not.
 * - **The sleeves** are the body's strips, and its last year again as tall as
 *   takes the sleeve to its length: the same hat cut fuller.
 */

/** How far a strip may be from the average of them all: the least of these that the years will go at. */
const BANDS = [0.05, 0.1, 0.15, 0.25, 0.4, 0.6];

/** A plain round left out of a piece, against a plain round more than one at a quantum's edge. */
const SHORTER = 6;

/** What a strip costs: how far down its year's ladder it had to go, and every plain round more than one at a quantum's edge. */
const costOf = (piece: Piece) => 2 * piece.depth + piece.frames.reduce((t, f) => t + Math.max(0, f.above - 1) + Math.max(0, f.below - 1), 0);

/** A year as a strip of exactly `height` rounds: one that begins a piece or goes on down it, or the `last` of a body, with a plain round below it too. */
const stripOf = (year: number, height: number, last: boolean): Piece | undefined => {
  const piece = pieceOf(last ? "body" : "yoke", [year], height);
  return piece && piece.rows.length === height ? piece : undefined;
};

const joined = (strips: Piece[], total: number): Piece => ({
  years: strips.flatMap((s) => s.years),
  total,
  depth: Math.max(0, ...strips.map((s) => s.depth)),
  placed: strips.flatMap((s) => s.placed),
  rows: strips.flatMap((s) => s.rows),
  strips: strips.flatMap((s) => s.strips),
  frames: strips.flatMap((s) => s.frames),
});

const settled = new Map<string, { strips: Piece[]; cost: number } | null>();
/**
 * These years as strips in `total` rounds, each within `band` of their
 * average: the heights that cost least, the piece as many rounds shorter as
 * it must be, to three - a strip's pattern is framed alike only at every
 * other height, and the band may not reach. The last is a body's last where
 * `ends`.
 */
const settle = (years: number[], total: number, band: number, ends: boolean): { strips: Piece[]; cost: number } | null => {
  if (years.length === 0) return { strips: [], cost: 0 };
  const key = `${years.join(",")} ${total} ${band} ${ends}`;
  const known = settled.get(key);
  if (known !== undefined) return known;
  let best: { strips: Piece[]; cost: number } | null = null;
  for (let d = 0; d <= 3; d++) {
    const mean = (total - d) / years.length;
    const lo = Math.max(1, Math.round((1 - band) * mean));
    const hi = Math.round((1 + band) * mean);
    // The cheapest way to lay out the first i strips in t rounds.
    let row = new Map<number, { cost: number; strips: Piece[] }>([[0, { cost: 0, strips: [] }]]);
    years.forEach((year, i) => {
      const next = new Map<number, { cost: number; strips: Piece[] }>();
      for (const [t, was] of row) {
        for (let h = lo; h <= hi && t + h <= total - d; h++) {
          const strip = stripOf(year, h, ends && i === years.length - 1);
          if (!strip) continue;
          const cost = was.cost + costOf(strip);
          const at = next.get(t + h);
          if (!at || cost < at.cost) next.set(t + h, { cost, strips: [...was.strips, strip] });
        }
      }
      row = next;
    });
    const done = row.get(total - d);
    if (done && (!best || done.cost + SHORTER * d < best.cost)) best = { strips: done.strips, cost: done.cost + SHORTER * d };
  }
  if (settled.size > 4000) settled.clear();
  settled.set(key, best);
  return best;
};

/** The strips' rounds each piece comes to, and its last strip's on the sleeve. */
export interface Lined {
  yoke: Piece;
  body: Piece;
  sleeve: Piece;
}

export const linedUp = (years: number[], left: { yoke: number; body: number; sleeve: number }, reach: number): Lined | undefined => {
  const n = years.length;
  if (n === 0) return undefined;
  // The rounds the strips have between them: the yoke's, and the body's with its dividing round.
  const all = Math.max(0, left.yoke) + left.body + 1;
  const mean = all / n;
  // A yoke with half a strip's rounds left or more has a strip, if the years will go that way at all: the divide is then nearer its depth than without.
  const room = left.yoke >= 0.5 * mean;
  for (const on of room ? [true, false] : [false]) {
    for (const band of BANDS) {
      const lo = Math.max(1, Math.round((1 - band) * mean));
      const hi = Math.round((1 + band) * mean);
      // How many strips on the yoke, and the depth for each that leaves every strip about its height either side of the divide: nearest the yoke's own first.
      const near = Math.round(left.yoke / mean);
      const splits = (on ? [near, near - 1, near + 1] : [0])
        .filter((k) => k >= (on ? 1 : 0) && k <= n - 1)
        .flatMap((k) => {
          if (k === 0) return [{ k, depth: 0, off: 0 }];
          const least = Math.max(k * lo, all - (n - k) * hi);
          const most = Math.min(k * hi, all - (n - k) * lo);
          if (least > most) return [];
          const depth = Math.max(least, Math.min(most, left.yoke));
          return [{ k, depth, off: Math.abs(depth - left.yoke) }];
        })
        .sort((a, b) => a.off - b.off);
      let best: (Lined & { cost: number; off: number }) | undefined;
      for (const { k, depth, off } of splits) {
        // A divide further from the yoke's depth only where none nearer will go.
        if (best && off > best.off) break;
        // The divide moved a round or two, if that frames the strips better than taking rounds out; and further, as far as it may go, only where
        // the strips will go no nearer.
        let found = false;
        for (const dy of k > 0 ? Array.from({ length: 2 * reach + 1 }, (_, i) => (i % 2 ? -1 : 1) * Math.ceil(i / 2)) : [0]) {
          if (found && Math.abs(dy) > 2) break;
          if (k > 0 && Math.abs(depth + dy - left.yoke) > Math.max(reach, off)) continue;
          const above = settle(years.slice(0, k), depth + dy, band, false);
          if (!above) continue;
          const yoke = joined(above.strips, depth + dy);
          const below = settle(years.slice(k), all - yoke.rows.length, band, true);
          if (!below) continue;
          // The sleeve: the body's strips, and its last year as tall as takes the sleeve to its length, a round or two either way if it must be.
          const before = below.strips.slice(0, -1);
          const rest = left.sleeve + 1 - before.reduce((t, s) => t + s.rows.length, 0);
          const onward = [0, -1, 1, -2, 2].map((d) => pieceOf("sleeve", [years[n - 1]], rest + d)).find((piece) => piece !== undefined);
          if (!onward) continue;
          found = true;
          const cost = above.cost + below.cost + (k > 0 ? 1.5 * Math.abs(yoke.rows.length - depth) : 0);
          if (best && cost >= best.cost) continue;
          best = { yoke, body: joined(below.strips, all - yoke.rows.length), sleeve: joined([...before, onward], left.sleeve + 1), cost, off };
        }
      }
      if (best) return { yoke: best.yoke, body: best.body, sleeve: best.sleeve };
    }
  }
  return undefined;
};

const YEARS = patterns.map((p) => p.year);

/** A whole size: every year, from the neck to the hem. */
export const lined = (size: Measured, g?: Gauge): Plan => {
  const laid = linedUp(YEARS, budgets(size, g), reachAt(g));
  if (!laid) throw new Error("the years will not go in this size");
  const { yoke, body, sleeve } = laid;
  return {
    strips: { yoke: yoke.strips, body: body.strips, sleeve: sleeve.strips },
    rows: { yoke: yoke.rows, body: body.rows, sleeve: sleeve.rows },
    depth: { yoke: yoke.rows.length, body: body.rows.length, sleeve: sleeve.rows.length },
    frames: { yoke: yoke.frames, body: body.frames, sleeve: sleeve.frames },
  };
};
