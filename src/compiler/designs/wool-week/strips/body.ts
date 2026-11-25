import type { SweaterStitches } from "../../../../pattern/knitted";
import { isStepKind, kinds } from "../../../../pattern/kinds";
import data from "./bodies.json";

/**
 * Where a yoke's increases go so that it lies evenly on a body: the shaped
 * samplers' (see design.ts). A round yoke that increases evenly has too many
 * stitches down the middle of the back and too few over the shoulders; this
 * puts each round's new stitches where bodies have the room.
 *
 * - **The bodies.** For each size, three men of different heights and a
 *   woman, each as big round the chest as the size is to fit: bodies of Anny
 *   (NAVER Labs' parametric body model; code Apache 2.0, shapes from MakeHuman
 *   under CC0), their arms let down, and filled in as a ball of 5cm rolled
 *   over them would leave them, since knitting lies across a body's hollows.
 *   bodies.json has what they give, worked out once (see scripts/bodies): the
 *   room each sector of the round has at each depth below the cast-on, the
 *   mean of the four.
 * - **Sectors.** The way round the neck in SECTORS equal parts, the first
 *   centred on the middle of the back, where the round begins. A column of
 *   knitting runs straight down from where it starts at the neck, as seen
 *   from above, and a round lies where every column has come the same number
 *   of rows down, so a sector's room at a depth is the width between the
 *   lines down from its edges. The neck's ring is tilted so that the back
 *   wants the short rows the pattern gives it, and no more.
 * - **Where a stitch is.** Every round divides the way round the neck between
 *   its stitches: a stitch worked into another has what that one had, and a
 *   stitch made between two pushes its neighbours aside over about five
 *   centimetres (respread). Round the body a column lies along the line down
 *   from its place at the neck, evened out sideways over a few stitches
 *   (layout).
 * - **A round's increases** go to the sectors shortest of stitches for their
 *   room, spaced evenly in each, and the same either side of the line from
 *   the middle of the back to the middle of the front. Only where they go is
 *   decided here: how many a round makes, and every band's own doubled
 *   columns, are the pattern's as ever (see shaping.ts).
 * - **A rule of what is knitted.** Where a round's increases go depends on
 *   nothing but the stitches above it - which were made, round by round - the
 *   tension and the size. A Shaper is told each round as it is planned, or
 *   reads them from knitting already done (shaperFrom), and comes to the same
 *   either way: the rest of a yoke planned from part of it knitted is the
 *   rest of that yoke as it was planned whole.
 */

export const SECTORS = data.sectors;
const HALF = SECTORS / 2;

export interface Body {
  /** Depth below the cast-on between one row of `room` and the next, in centimetres. */
  stepCm: number;
  /** At each depth, the room of each sector from the middle of the back (0) round to the middle of the front (SECTORS / 2), the same on both sides: in any unit, as only its shares matter. */
  room: number[][];
}

/** The table keeps each depth after the first as what it is more than the depth above, which is little: added up again here. */
const bodies = Object.values(data.sizes as Record<string, { chestCm: number; room: number[][] }>).map(({ chestCm, room }) => {
  const rows: number[][] = [];
  for (const row of room) rows.push(rows.length ? row.map((more, t) => rows[rows.length - 1][t] + more) : row);
  return { chestCm, room: rows };
});

/** The bodies of the size whose chest is nearest. */
export const bodyFor = (toFitChestCm: number): Body => {
  const nearest = bodies.reduce((best, b) => (Math.abs(b.chestCm - toFitChestCm) < Math.abs(best.chestCm - toFitChestCm) ? b : best));
  return { stepCm: data.stepCm, room: nearest.room };
};

/** The back neck's short rows: how far each pair reaches either side of the beginning of the round, in stitches of the neck. */
export interface ShortRows {
  first: number;
  extend: number;
  pairs: number;
}

/** How far a made stitch pushes its neighbours aside, and how far a column gives sideways to lie evenly, in stitches either way. */
const SPREAD = 16;
const REACH = 12;
const spreadWeights = Array.from({ length: 2 * SPREAD + 1 }, (_, i) => SPREAD + 1 - Math.abs(i - SPREAD));
const spreadTotal = spreadWeights.reduce((a, b) => a + b, 0);

/** A round's division of the way round the neck: stitch i has from B[i] to B[i + 1], and B[n] is B[0] + 1. */
type Division = Float64Array;

export const uniform = (n: number): Division => Float64Array.from({ length: n + 1 }, (_, i) => i / n);

/** A round's division, from the round before's and which of its stitches are made in it. */
export const respread = (B: Division, made: ArrayLike<boolean | number>): Division => {
  const n1 = made.length;
  const n0 = B.length - 1;
  const Xb = new Float64Array(n1 + 1);
  let any = false;
  for (let y = 0; y < n1; y++) {
    Xb[y + 1] = Xb[y] + (made[y] ? 0 : 1);
    if (made[y]) any = true;
  }
  if (Xb[n1] !== n0) throw new Error(`a round of ${n1} with ${n1 - Xb[n1]} made does not follow one of ${n0}`);
  if (!any) return B;
  const U = (x: number) => {
    const q = Math.floor(x / n0);
    const r = x - q * n0;
    const i = Math.min(n0 - 1, Math.floor(r));
    return B[i] + (r - i) * (B[i + 1] - B[i]) + q;
  };
  const xb = (y: number) => {
    const q = Math.floor(y / n1);
    return Xb[y - q * n1] + q * n0;
  };
  const out = new Float64Array(n1 + 1);
  for (let y = 0; y <= n1; y++) {
    let x = 0;
    for (let k = -SPREAD; k <= SPREAD; k++) x += spreadWeights[k + SPREAD] * xb(y + k);
    out[y] = U(x / spreadTotal);
  }
  return out;
};

/** Each sector's share of the way round the body, and where each begins: the first from half of itself before the middle of the back. */
interface Shares {
  share: number[];
  edge: Float64Array;
}

const sharesOf = (room: number[]): Shares => {
  const total = room.reduce((a, b) => a + b, 0);
  const share = room.map((x) => x / total);
  const edge = new Float64Array(SECTORS + 1);
  edge[0] = -share[0] / 2;
  for (let s = 0; s < SECTORS; s++) edge[s + 1] = edge[s] + share[s];
  return { share, edge };
};

/** Where a round's stitches lie round the body, as parts of the way round at its depth: a column on the line down from its place at the neck, evened out over REACH stitches either side. */
const layout = (B: Division, { share, edge }: Shares): Float64Array => {
  const n = B.length - 1;
  const S = (u: number) => {
    const v = u * SECTORS + 0.5;
    const f = Math.floor(v);
    const s = ((f % SECTORS) + SECTORS) % SECTORS;
    return (f - s) / SECTORS + edge[s] + share[s] * (v - f);
  };
  const off = new Float64Array(n);
  for (let i = 0; i < n; i++) off[i] = S(B[i]) - i / n;
  const reach = Math.min(REACH, Math.floor(n / 6));
  let total = 0;
  for (let k = -reach; k <= reach; k++) total += reach + 1 - Math.abs(k);
  const p = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    let t = 0;
    for (let k = -reach; k <= reach; k++) t += (reach + 1 - Math.abs(k)) * off[(((i + k) % n) + n) % n];
    p[i] = i / n + t / total;
  }
  p[n] = p[0] + 1;
  return p;
};

/** The sector a place round the body is in. */
const sectorAt = (edge: Float64Array, at: number): number => {
  const a = at - Math.floor(at - edge[0]);
  let lo = 0;
  let hi = SECTORS;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (edge[m] <= a) lo = m;
    else hi = m;
  }
  return lo;
};

/** How many stitches, in parts of stitches, each sector holds. */
const holds = (p: Float64Array, edge: Float64Array): Float64Array => {
  const have = new Float64Array(SECTORS);
  for (let i = 0; i + 1 < p.length; i++) {
    const width = p[i + 1] - p[i];
    if (width <= 0) continue;
    let a = p[i];
    const b = p[i + 1];
    while (a < b - 1e-12) {
      const s = sectorAt(edge, a + 1e-12);
      const turns = Math.floor(a + 1e-12 - edge[0]);
      const end = Math.min(b, edge[s + 1] + turns);
      have[s] += (end - a) / width;
      a = end;
    }
  }
  return have;
};

/** A sector's place from the middle of the back round to the middle of the front, either way round. */
const fromBack = (s: number) => Math.min(s, SECTORS - s);

/** How many rounds back an increase still keeps a later one from falling under it, and the places in a sector's stretch tried for its increases. */
const LOOK = 4;
const PHASES = [0.5, 0.2, 0.8, 0.35, 0.65];
/** How many stitches a round's increases may carry any stitch round from where an even round would leave it. */
export const LEAN = 4;

export interface ShaperSetup {
  body: Body;
  /** The neck's stitches. */
  neck: number;
  /** Rounds to a centimetre, at the knitter's tension. */
  roundsPerCm: number;
  shortRows: ShortRows;
}

/**
 * A yoke as it is knitted, for where its next round's increases go. Told every
 * round in order from the cast-on: `knit` a round as it is, `place` to ask
 * where a round's new stitches are to be.
 */
export class Shaper {
  private B: Division;
  /** Rounds knitted, the cast-on one of them. */
  private rounds = 0;
  /** The last few increasing rounds' new stitches, each where it is round the neck. */
  private recent: number[][] = [];

  constructor(private readonly setup: ShaperSetup) {
    this.B = uniform(setup.neck);
  }

  /** The way round the neck as the last round told divides it between its stitches: stitch i from the i-th to the next. */
  division(): Float64Array {
    return Float64Array.from(this.B);
  }

  /** The rows more a place round the neck has from the back neck's short rows. */
  private extra(u: number): number {
    const { first, extend, pairs } = this.setup.shortRows;
    const away = Math.min(u, 1 - u) * this.setup.neck;
    let rows = 0;
    for (let pair = 0; pair < pairs; pair++) if (away < first + pair * extend) rows += 2;
    return rows;
  }

  /** Each sector's share of the next round, at the depth the round is at there. */
  private shares(): Shares {
    const { body, roundsPerCm } = this.setup;
    const last = body.room.length - 1;
    const room = Array.from({ length: SECTORS }, (_, s) => {
      const at = (this.rounds + this.extra(s / SECTORS) + 0.5) / roundsPerCm / body.stepCm;
      const lo = Math.min(last, Math.floor(at));
      const hi = Math.min(last, lo + 1);
      const t = Math.min(1, at - lo);
      return body.room[lo][fromBack(s)] * (1 - t) + body.room[hi][fromBack(s)] * t;
    });
    return sharesOf(room);
  }

  /**
   * How far the round is from lying evenly round the body at its depth: over
   * its stitches, the root of the mean square of the logarithm of the room a
   * stitch's sector has for each of the stitches in it against the room a
   * stitch has round the whole round. Nought is every stitch as wide as every other.
   */
  unevenness(): number {
    const shares = this.shares();
    const have = holds(layout(this.B, shares), shares.edge);
    const n = this.B.length - 1;
    let sum = 0;
    for (let s = 0; s < SECTORS; s++) if (have[s] > 0) sum += have[s] * Math.log((shares.share[s] * n) / have[s]) ** 2;
    return Math.sqrt(sum / n);
  }

  /** A round, knitted: which of its stitches are made in it. */
  knit(made: ArrayLike<boolean | number>): void {
    const n0 = this.B.length - 1;
    this.B = respread(this.B, made);
    if (made.length > n0) {
      const at: number[] = [];
      for (let i = 0; i < made.length; i++) if (made[i]) at.push((this.B[i] + this.B[i + 1]) / 2);
      this.recent.push(at);
      if (this.recent.length > LOOK) this.recent.shift();
    }
    this.rounds++;
  }

  /** A round that has `count` stitches, its new ones at `places` in it. */
  knitAt(count: number, places: number[]): void {
    const made = new Uint8Array(count);
    for (const p of places) made[p] = 1;
    this.knit(made);
  }

  /**
   * Where the next round's new stitches go, for it to have `count`: their
   * places in it, in order. Decided for the half from the middle of the back
   * round to the middle of the front, a sector and its mirror image together -
   * as many as they are short of, spaced evenly along the sector - and mirrored
   * for the other half.
   */
  place(count: number): number[] {
    const n0 = this.B.length - 1;
    const add = count - n0;
    if (add <= 0) return [];
    const shares = this.shares();
    const p = layout(this.B, shares);
    const have = holds(p, shares.edge);
    // The half's stitches, each in its sector from the back: in order round, as stitches are.
    const half = Math.floor(n0 / 2);
    const zone: number[] = [];
    for (let i = 0; i < half; i++) zone.push(Math.max(zone[i - 1] ?? 0, fromBack(sectorAt(shares.edge, (p[i] + p[i + 1]) / 2))));
    const short = new Array<number>(HALF + 1).fill(0);
    for (let s = 0; s < SECTORS; s++) short[fromBack(s)] += (shares.share[s] * count - have[s]) / 2;
    const length = new Array<number>(HALF + 1).fill(0);
    const from = new Array<number>(HALF + 1).fill(-1);
    zone.forEach((z, i) => {
      length[z]++;
      if (from[z] < 0) from[z] = i;
    });
    // A pair at a time, to the sector shortest of them that has a bar left to take one.
    const given = new Array<number>(HALF + 1).fill(0);
    for (let left = Math.floor(add / 2); left > 0; left--) {
      let best = -1;
      let gap = -Infinity;
      for (let z = 0; z <= HALF; z++) {
        if (given[z] >= length[z] - 1) continue;
        const g = short[z] - given[z];
        if (g > gap) {
          gap = g;
          best = z;
        }
      }
      if (best < 0) break;
      given[best]++;
    }
    /*
     * And no round leans its stitches far. New stitches push those beside them
     * round: counted from the middle of the back, up to any place the round has
     * no more than LEAN more of them, nor fewer, than it would have, made evenly.
     * So a column of the pattern is never carried more than that many stitches
     * to one side in a round, and what a place is short of beyond that is left
     * to the rounds that follow.
     */
    const pairs = given.reduce((a, b) => a + b, 0);
    let [run, kept, upTo] = [0, 0, 0];
    for (let z = 0; z <= HALF; z++) {
      run += given[z];
      upTo += length[z];
      const even = (pairs * upTo) / Math.max(half, 1);
      const to = Math.min(Math.max(run, Math.ceil(even - LEAN)), Math.max(Math.floor(even + LEAN), 0));
      given[z] = Math.max(0, Math.min(to - kept, length[z] - 1));
      kept += given[z];
    }
    // A new stitch before stitch g of the round as it is, and its mirror image before stitch n0 - g. Along a sector, at the spacing's turn farthest from the last rounds' increases, so they do not line up into a seam.
    const gaps = new Set<number>();
    const recent = this.recent.flatMap((at, age) => at.map((u) => ({ u, weight: 1 + 0.6 * (this.recent.length - 1 - age) })));
    const apart = (gs: number[]) => {
      let least = Infinity;
      for (const g of gs) {
        const u = this.B[g];
        for (const r of recent) {
          const d = Math.abs(u - r.u) % 1;
          least = Math.min(least, Math.min(d, 1 - d) * n0 * r.weight);
        }
      }
      return least;
    };
    for (let z = 0; z <= HALF; z++) {
      if (!given[z]) continue;
      let chosen: number[] = [];
      let far = -Infinity;
      for (const phase of PHASES) {
        const gs = [...new Set(Array.from({ length: given[z] }, (_, q) => Math.max(1, from[z] + Math.floor(((q + phase) * length[z]) / given[z]))))];
        if (gs.length !== given[z] || gs.some((g) => gaps.has(g) || g >= n0 - g)) continue;
        const d = apart(gs);
        if (d > far) {
          far = d;
          chosen = gs;
        }
      }
      for (const g of chosen) {
        gaps.add(g);
        gaps.add(n0 - g);
      }
    }
    // What is left - an odd one, or more than the sectors had bars for - on the middle line of the front, then wherever is free from there back.
    for (let g = Math.ceil(n0 / 2); gaps.size < add && g >= 1; g--) {
      if (!gaps.has(g)) gaps.add(g);
      if (gaps.size < add && !gaps.has(n0 - g) && n0 - g > 0) gaps.add(n0 - g);
    }
    if (gaps.size !== add) throw new Error(`a round of ${n0} has no room for ${add} more`);
    const places: number[] = [];
    let before = 0;
    for (let i = 0; i < n0; i++) {
      if (gaps.has(i)) places.push(i + before++);
    }
    return places;
  }
}

/** A stitch that takes nothing from the needle and is not a step: one made. */
const isMade = (type: string): boolean => kinds[type as keyof typeof kinds]?.family === "increase";

/**
 * The Shaper of a yoke knitted to a round: told its rounds as they are, its
 * short rows left out (they are in its setup).
 */
export const shaperFrom = (knitted: SweaterStitches, round: number, setup: ShaperSetup): Shaper => {
  const shaper = new Shaper(setup);
  for (let r = 0; r < round; r++) {
    if (knitted.roundKinds[r] !== "round") continue;
    const real = knitted.rounds[r].filter((id) => !isStepKind(knitted.stitches[id].type));
    shaper.knit(real.map((id) => (r > 0 && isMade(knitted.stitches[id].type) ? 1 : 0)));
  }
  return shaper;
};
