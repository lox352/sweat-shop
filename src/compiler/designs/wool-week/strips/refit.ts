import { type Part, type Round, cutsOf, edgeOf as edge, groundOf, isPlain, lettersOfRound, measured, seamsOf, topDown } from "./cuts";
import { type Frame, type Gauge, type Measured, type Plan, type Row, type Strip, budgets, gauge } from "./plan";
import { background } from "./quanta";

/**
 * Each Year Once, refitted: 2014 to 2016 round the yoke, 2017 to 2021 down
 * the body, 2022 to 2026 down both sleeves, each year cut as full as its
 * piece has room for, by these rules:
 *
 * 1. A plain round outside a pattern carries on the background of the
 *    quantum beside it - the commonest yarn among the background stitches
 *    (see quanta's background) of the three rows nearest that edge - never a
 *    colour from elsewhere. A round between two strips is the stronger
 *    neighbour's, or, where one neighbour's edge row is already plain, the
 *    other's, and carries on its background.
 * 2. A pattern's own plain first or last row is its increase round: no round
 *    goes beside it. Where neither neighbour has one, one plain round goes
 *    between them; each piece begins with one, and the body and sleeves end
 *    with one.
 * 3. A cut's plain edge rows are kept or dropped in pairs, so a band is
 *    framed alike top and bottom.
 * 4. Where two of the hat's quanta meet that don't go together - a peerie
 *    against a band of stars, 2014's two stars, 2019's boat and sheep - a
 *    plain round goes between them, the stronger one's, so they don't run
 *    into each other (see quanta's plainBetween). Each such run of rows that
 *    go together is laid out as a quantum of its own.
 * 5. Padding goes to quanta a pair at a time, a round above and a round
 *    below, patterned quanta first, up to two pairs each, strongest
 *    background first; past that to any. An odd round over is left out: the
 *    piece is a round shorter.
 * 7. Every quantum is framed, and alike: a plain round of its own above it
 *    and below it at the least, and as many above as below -
 *    its own plain edge rows, the round between it and its neighbour where
 *    that is its own, and its padding. Where one side has more, rounds go on
 *    the other. So 2014's two stars each have a round of their own
 *    background above and below, not the year as a whole.
 * 8. Each of those plain rounds is in the background of the quantum's edge it
 *    is beside (rule 1): 2026's lattice, a ground round above and below;
 *    2015's sheep, sky above.
 * 6. Each year's cuts are a ladder from fullest down, and each step down a
 *    ladder has a rank, how readily it is taken (see ladders). A piece starts
 *    each of its years at the top, takes their steps in rank order until it
 *    fits, and takes back any that a later, bigger step made room for again.
 *    A pattern is cut into only where its year has no shorter cut that keeps
 *    it whole.
 *
 * How many years each piece has, and where the yoke divides, is whatever
 * keeps a year most nearly the same height on all three (see laidOut).
 */

interface State {
  label: string;
  parts: Part[];
}
const st = (label: string, parts: Part[]): State => ({ label, parts });

/**
 * Rule 6: each year's ladder, the fullest cut first, each with its rank - how
 * readily a piece steps down to it, the least missed first. The order is its
 * knitter's, who looks for these in a cut:
 * - **A pattern is not cut into.** No step takes rows off a pattern whose
 *   year has a shorter cut that keeps it whole. 2017's zigzags go a band at a
 *   time, and below 2018's dancers and plusses stand its dancers between two
 *   rows of plusses, and its dancers alone (see wholeOf): neither is had
 *   with "a row off each side". Only 2023's flowers have nothing shorter
 *   than themselves, and are cropped; that is ranked after every step that
 *   keeps the patterns whole (CUT), so it is taken only when those have all
 *   been. (Rows of sky over the sheep are not the sheep; a plain edge is no
 *   pattern; the lattice is cropped where its frames end.)
 * - **Twice is company, four times is dull.** 2017's band is one motif,
 *   turned about row by row: three of it before four, the first step taken;
 *   and where three will not go, two whole, which turn about each other
 *   still - the last step that cuts nothing, and no great loss.
 * - **A core wants its trimmings.** 2014's one star between two peeries
 *   before its two stars side by side; and 2020's two stars each framed
 *   either side (as the hat) kept longer than any step but that.
 * - **A piece is balanced.** Otherwise a year gives up a trimming before its
 *   neighbour gives up two: the sheep's sky two rows at a time, the sleeves'
 *   years turn about.
 * - **A band begins and ends plain.** Every quantum has a plain round of its
 *   own at each end, one if it can be and not more (see layout): so 2018's
 *   plain edge rows are no step to take, and its dancers between two rows of
 *   plusses, two rounds shorter than its dancers and plusses, are taken
 *   before a neighbour gives up its trimmings and has rounds to spare.
 */
const CUT = 30;
type Rung = [rank: number, state: State];
const ladders: Record<number, Rung[]> = {
  2014: [
    [0, st("Both stars, peerie between", [["B", 1, 13], ["A", 1, 4], ["C", 1, 13]])],
    [1, st("Chart C between peeries", [["A", 1, 4], ["C", 1, 13], ["A", 1, 4]])],
  ],
  // The sheep's sky (rows 16-25) and field (1-5), taken off two rows to one.
  2015: [[0, 0, 1, 25], [3, 3, 2, 23], [4, 6, 3, 21], [6, 9, 4, 19], [7, 12, 5, 17]].map(([rank, off, a, b]) => [
    rank,
    st(off ? `Sheep, ${(off * 2) / 3} sky and ${off / 3} field rows off` : "As the hat, all the sky", [["A", a, b]]),
  ]),
  2016: [
    [0, st("Three strips with seed borders", [["A", 9, 41]])],
    [2, st("Three strips", [["A", 11, 39]])],
  ],
  2017: [
    [0, st("Four bands", [["A", 1, 14], ["A", 1, 14]])],
    [1, st("Three bands", [["A", 1, 14], ["A", 1, 7]])],
    [25, st("Two bands", [["A", 1, 14]])],
  ],
  2018: [
    [0, st("Dancers, plusses, dancers", [["B", 4, 34]])],
    [6, st("Dancers and plusses", [["B", 4, 24]])],
    [10, st("Dancers between two plus rows", [["B", 1, 17]])],
  ],
  2019: [[0, st("Sheep and boat, a round between", [["C", 3, 14], ["E", 1, 12]])]],
  2020: [
    [0, st("As the hat", [["B", 2, 39]])],
    [20, st("Both star bands", [["B", 6, 35]])],
  ],
  2021: [[0, st("With its borders", [["B", 3, 33]])]],
  2022: [
    [0, st("Anchors, waves and ropes", [["B", 1, 14], ["C", 1, 13], ["D", 1, 14]])],
    [2, st("Anchors and waves", [["B", 8, 14], ["C", 1, 13], ["D", 1, 7]])],
    [12, st("Anchors", [["C", 1, 13]])],
  ],
  2023: [
    [0, st("Flowers between peeries", [["B", 1, 4], ["C", 1, 25], ["D", 1, 4]])],
    [6, st("Flowers", [["C", 1, 25]])],
    [CUT + 9, st("Flowers, cropped to 21", [["C", 3, 23]])],
    [CUT + 10, st("Flowers, cropped to 15", [["C", 6, 20]])],
  ],
  2024: [
    [0, st("As the hat", [["B", 1, 11], ["C", 1, 15], ["D", 1, 12]])],
    [3, st("Rams between zigzags", [["B", 5, 11], ["C", 1, 15], ["D", 1, 7]])],
    [11, st("Rams", [["C", 1, 15]])],
  ],
  2025: [
    [0, st("As the hat", [["A", 1, 16], ["A", 1, 16], ["A", 1, 13]])],
    [1, st("Twice, dotted strip between", [["A", 1, 16], ["A", 1, 13]])],
    [8, st("With the dotted strip", [["A", 1, 16]])],
  ],
  2026: [
    [0, st("Cropped to 36", [["Body", 3, 38]])],
    [4, st("Cropped to 32", [["Body", 5, 36]])],
    [5, st("Cropped to 28", [["Body", 7, 34]])],
    [7, st("Cropped to 24", [["Body", 9, 32]])],
  ],
};

/* A round while it's being laid out: a chart row, or plain in a year's yarn. */
type R = Round;

/**
 * A cut's quanta from the neck down, each run of rows that go together: a new
 * one wherever two of the hat's quanta meet that don't (rule 4).
 */
const blocksOfState = (year: number, s: State): R[][] => {
  const cut = topDown(year, s.parts);
  const rows: R[] = cut.map((r) => ({ year, ...r }));
  const seams = [0, ...seamsOf(year, cut), rows.length];
  return seams.slice(1).map((end, k) => rows.slice(seams[k], end));
};

interface Placed {
  year: number;
  state: State;
  /** Its quanta, each a run of rows that go together. */
  blocks: R[][];
  /** All its rows, the quanta one after another. */
  rounds: R[];
}
interface Ends {
  top: boolean;
  bottom: boolean;
}

/**
 * A pattern's background at an edge: the commonest yarn among the stitches of
 * the three rows nearest it that are background (see quanta's background), or
 * of all their stitches if none is.
 */
const backgroundAt = (rows: R[], top: boolean): string => {
  const near = top ? rows.slice(0, 3) : rows.slice(-3);
  const n = new Map<string, number>();
  for (const r of near) {
    const letters = lettersOfRound(r);
    letters.forEach((c, x) => {
      if ("plain" in r || background(r.year, r.chart, r.row, x)) n.set(c, (n.get(c) ?? 0) + 1 / letters.length);
    });
  }
  return n.size ? [...n].sort((p, q) => q[1] - p[1])[0][0] : edge(rows, top).letter;
};

/** How many of a quantum's rows, from its edge, are one colour. */
const leading = (rounds: R[]) => {
  let n = 0;
  while (n < rounds.length && isPlain(rounds[n])) n++;
  return n;
};

/** A quantum in a piece: which strip, which of its quanta. */
interface Spot {
  i: number;
  j: number;
}

/**
 * How a piece's rounds go round its strips' quanta: the rounds rule 2 puts
 * between strips, and above and below them, and rule 4 between two quanta of a
 * strip, each owned by the quantum beside it whose background is stronger; the
 * rounds each quantum needs above and below to be framed alike (rule 7); and
 * what's left over.
 */
/**
 * How strictly a piece is framed: `mirror`, the quanta either side of a core
 * framed alike, as well as each quantum alike above and below (rule 7); and
 * `share`, where a piece has no room for a round each, the one round between
 * two quanta of a strip framing both.
 */
interface Mode {
  mirror: boolean;
  share: boolean;
}
const STRICT: Mode = { mirror: true, share: false };

/** A strip's quanta paired either side of its core: the first with the last, and so on in, where there is a core between and they are as tall. */
const partners = (s: Placed): Map<number, number> => {
  const m = s.blocks.length;
  const out = new Map<number, number>();
  if (m < 3 || m % 2 === 0) return out;
  for (let j = 0; j < (m - 1) / 2; j++) {
    if (s.blocks[j].length !== s.blocks[m - 1 - j].length) continue;
    out.set(j, m - 1 - j);
    out.set(m - 1 - j, j);
  }
  return out;
};

const layout = (strips: Placed[], total: number, ends: Ends, mode: Mode = STRICT) => {
  const { share } = mode;
  const spots: Spot[] = strips.flatMap((s, i) => s.blocks.map((_, j) => ({ i, j })));
  const block = ({ i, j }: Spot) => strips[i].blocks[j];
  // The round between two quanta, or at a piece's edge beside one: which side owns it, or none where one edge is already plain. Between two
  // quanta of a strip there is always one.
  const owner = (a: Spot | null, b: Spot | null, inside: boolean): Spot | null | undefined => {
    const upper = a ? edge(block(a), false) : null;
    const lower = b ? edge(block(b), true) : null;
    if (!inside && upper && lower && (upper.plain || lower.plain)) return undefined;
    if (!upper) return b;
    if (!lower) return a;
    if (!inside && lower.plain && !upper.plain) return a;
    if (!inside && upper.plain && !lower.plain) return b;
    return lower.share > upper.share ? b : a;
  };
  // Between each spot and the next: the owner of the round there, if there is one.
  const gaps: (Spot | null | undefined)[] = [ends.top ? owner(null, spots[0], false) : undefined];
  for (let k = 1; k < spots.length; k++) gaps.push(owner(spots[k - 1], spots[k], spots[k].i === spots[k - 1].i));
  gaps.push(ends.bottom ? owner(spots[spots.length - 1], null, false) : undefined);
  // Rule 7: each quantum's plain rounds above and below it, and the rounds that even them up.
  const framing = spots.map((sp, k) => {
    const above = framedBy(gaps, spots, k, k, share) + leading(block(sp));
    const below = framedBy(gaps, spots, k + 1, k, share) + leading([...block(sp)].reverse());
    return { top: Math.max(0, below - above), bottom: Math.max(0, above - below), framed: Math.max(above, below) };
  });
  // Every quantum begins and ends with a plain round of its own: one above and one below where it has none - its cut's edge rows are
  // patterned, and the rounds beside it are its neighbours'.
  spots.forEach((_, k) => {
    if (framing[k].framed === 0) framing[k] = { top: 1, bottom: 1, framed: 1 };
  });
  // The quanta either side of a core framed alike: the less framed given rounds above and below to match the other.
  if (mode.mirror) {
    spots.forEach((sp, k) => {
      const j = partners(strips[sp.i]).get(sp.j);
      if (j === undefined) return;
      const other = framing[spots.findIndex((x) => x.i === sp.i && x.j === j)];
      const more = Math.max(0, other.framed - framing[k].framed);
      framing[k] = { top: framing[k].top + more, bottom: framing[k].bottom + more, framed: framing[k].framed + more };
    });
  }
  const used =
    strips.reduce((t, s) => t + s.rounds.length, 0) + gaps.filter((g) => g !== undefined).length + framing.reduce((t, f) => t + f.top + f.bottom, 0);
  return { spare: total - used, spots, gaps, framing };
};

/**
 * Whether the round in gap g frames quantum k: its own; or, where a piece has
 * no room for a round each, the one between two quanta of a strip frames both.
 */
const framedBy = (gaps: (Spot | null | undefined)[], spots: Spot[], g: number, k: number, share: boolean): number => {
  const o = gaps[g];
  if (!o) return 0;
  if (o.i === spots[k].i && o.j === spots[k].j) return 1;
  const other = spots[g === k ? k - 1 : k + 1];
  return share && other && other.i === spots[k].i && o.i === other.i && o.j === other.j ? 1 : 0;
};

/** A piece's rounds and its strips, the spare rounds shared out by rule 5, each plain round in the background beside it. */
const build = (strips: Placed[], total: number, ends: Ends, mode: Mode = STRICT): { rows: Row[]; strips: Strip[]; frames: Frame[] } => {
  const { spare, spots, gaps, framing } = layout(strips, total, ends, mode);
  const { share } = mode;
  if (spare < 0) throw new Error(`${strips.map((s) => s.year).join(", ")} will not go in ${total} rounds`);
  const block = ({ i, j }: Spot) => strips[i].blocks[j];
  // Rule 5: padding a pair at a time, patterned quanta first, the least framed first, then the strongest background; up to two pairs each.
  const strength = (k: number) => {
    const [a, b] = [edge(block(spots[k]), true), edge(block(spots[k]), false)];
    return { k, patterned: !a.plain && !b.plain, share: a.share + b.share };
  };
  const order = spots.map((_, k) => strength(k)).sort((a, b) => b.share - a.share);
  const patterned = order.filter((e) => e.patterned);
  const pads = framing.map((f) => ({ ...f }));
  const given = spots.map(() => 0);
  const mine = (g: number, k: number) => framedBy(gaps, spots, g, k, share);
  const framed = (k: number) => mine(k, k) + pads[k].top + leading(block(spots[k]));
  // The quanta either side of a core are given pairs together, so they stay framed alike.
  const partnerOf = (k: number): number | undefined => {
    const j = mode.mirror ? partners(strips[spots[k].i]).get(spots[k].j) : undefined;
    return j === undefined ? undefined : spots.findIndex((x) => x.i === spots[k].i && x.j === j);
  };
  const cost = (k: number) => (partnerOf(k) === undefined ? 1 : 2);
  for (let pairs = Math.floor(spare / 2), rest = 0; pairs > 0; ) {
    const open = patterned.filter((e) => given[e.k] < 2 && cost(e.k) <= pairs);
    let e = open.length ? open.reduce((a, b) => (framed(b.k) < framed(a.k) ? b : a)) : undefined;
    for (let tries = 0; !e && tries < order.length; tries++) {
      const next = order[rest++ % order.length];
      if (cost(next.k) <= pairs) e = next;
    }
    if (!e) break;
    for (const k of [e.k, partnerOf(e.k)]) {
      if (k === undefined) continue;
      given[k]++;
      pads[k].top++;
      pads[k].bottom++;
      pairs--;
    }
  }
  // Rule 8: every plain round in the background of the quantum it belongs to, at the edge it is on.
  const tops = spots.map((sp) => backgroundAt(block(sp), true));
  const bottoms = spots.map((sp) => backgroundAt(block(sp), false));
  const plain = (k: number, top: boolean): R => ({ year: strips[spots[k].i].year, plain: (top ? tops : bottoms)[k] });
  const gapRound = (g: number): R[] => {
    const o = gaps[g];
    if (o === undefined) return [];
    const k = spots.findIndex((sp) => o && sp.i === o.i && sp.j === o.j);
    return [plain(k, k === g)];
  };
  const out: R[][] = strips.map(() => []);
  const frames: Frame[] = [];
  spots.forEach((sp, k) => {
    const own = out[sp.i];
    // The round above it, filed with whichever strip owns it.
    const above = gapRound(k);
    if (above.length) out[gaps[k]!.i].push(...above);
    for (let n = 0; n < pads[k].top; n++) own.push(plain(k, true));
    own.push(...block(sp));
    for (let n = 0; n < pads[k].bottom; n++) own.push(plain(k, false));
    if (k === spots.length - 1) own.push(...gapRound(k + 1));
    frames.push({ year: strips[sp.i].year, above: framed(k), below: mine(k + 1, k) + pads[k].bottom + leading([...block(sp)].reverse()) });
  });
  const rows: Row[] = out.flat();
  const placed: Strip[] = strips.map((s, i) => ({
    year: s.year,
    height: out[i].length,
    cut: measured(s.year, { ...s.state, neat: true }),
    ground: groundOf(s.year, s.state.parts),
  }));
  return { rows, strips: placed, frames };
};

const place = (year: number, state: State): Placed => {
  const blocks = blocksOfState(year, state);
  return { year, state, blocks, rounds: blocks.flat() };
};

/**
 * A year's whole ladder: its rungs, and below them every other cut the year
 * has that is shorter than the last (see cuts' cutsOf), tallest first, so
 * that a piece with too few rounds for the rungs - a knitter's bigger
 * stitches, or more years to a piece - still has a cut that fits. Those are
 * stepped down to after every rung, the year that has lost the least of its
 * height first.
 */
const whole = new Map<number, Rung[]>();
const wholeOf = (year: number): Rung[] => {
  let ladder = whole.get(year);
  if (!ladder) {
    const own = ladders[year];
    const height = (state: State) => topDown(year, state.parts).length;
    const top = height(own[0][1]);
    const least = Math.min(...own.map(([, state]) => height(state)));
    const below = cutsOf(year)
      .filter((cut) => cut.height < least)
      .sort((a, b) => b.height - a.height)
      .filter((cut, at, all) => at === 0 || cut.height < all[at - 1].height)
      .map((cut): Rung => [100 + 100 * (1 - cut.height / top), st(cut.label, cut.parts)]);
    whole.set(year, (ladder = [...own, ...below]));
  }
  return ladder;
};

/**
 * Rule 6: these years, in order, cut to go in so many rounds. Each starts at
 * the top of its ladder; the step least missed is taken until the piece
 * fits; and then any step taken before the last, of another year, is taken
 * back where that leaves `slack` rounds spare. By the rungs alone, however
 * the piece has to be framed to take them; and only where they will not go
 * at all, by the cuts below them. None where the years will not go at all.
 */
const fit = (years: number[], total: number, ends: Ends, slack: number): { placed: Placed[]; mode: Mode } | null => {
  for (const all of [ladders, Object.fromEntries(years.map((year) => [year, wholeOf(year)]))]) {
    const own = years.map((year) => all[year]);
    for (const mode of [STRICT, { mirror: true, share: true }, { mirror: false, share: true }]) {
      const at = years.map(() => 0);
      const placed = () => own.map((ladder, i) => place(years[i], ladder[at[i]][1]));
      const spare = () => layout(placed(), total, ends, mode).spare;
      const taken: number[] = [];
      while (spare() < 0) {
        const next = own
          .map((ladder, i) => ({ i, rank: ladder[at[i] + 1]?.[0] }))
          .filter((one) => one.rank !== undefined)
          .sort((a, b) => a.rank! - b.rank!)[0];
        if (!next) break;
        at[next.i]++;
        taken.push(next.i);
      }
      if (spare() < 0) continue;
      const last = taken[taken.length - 1];
      for (const i of taken.slice(0, -1)) {
        if (i === last || at[i] === 0) continue;
        at[i]--;
        if (spare() < slack) at[i]++;
      }
      return { placed: placed(), mode };
    }
  }
  return null;
};

/** How many spare rounds a piece keeps when a step is taken back: the yoke and the sleeves, where every band is shaped, a round or two; the body none. */
const SLACK = { yoke: 2, body: 0, sleeve: 2 };
const YEARS = Object.keys(ladders).map(Number);

const toRow = (r: R): Row => ("plain" in r ? { year: r.year, plain: r.plain } : r);

/** A piece laid out: its years, the rounds it was given for them, the cut of each, and its rounds - a round fewer where an odd one was left out (rule 5). */
interface Piece {
  years: number[];
  total: number;
  placed: Placed[];
  rows: Row[];
  strips: Strip[];
  frames: Frame[];
}

const pieceOf = (name: keyof typeof SLACK, years: number[], total: number): Piece | undefined => {
  if (years.length === 0) return { years, total: 0, placed: [], rows: [], strips: [], frames: [] };
  const ends = { top: true, bottom: name !== "yoke" };
  const fitted = fit(years, total, ends, SLACK[name]);
  if (!fitted) return undefined;
  const built = build(fitted.placed, total, ends, fitted.mode);
  return { years, total, placed: fitted.placed, rows: built.rows.map(toRow), strips: built.strips, frames: built.frames };
};

/**
 * These years, in order, over the rounds there are for them on the yoke, the
 * body and a sleeve - a whole sweater's, or what is left of one part knitted:
 * so many to each piece that a year is most nearly the same height on all
 * three, and each piece cut by rule 6. The divide may move as many as `reach`
 * rounds, the body taking them, so that it falls between two years. A yoke
 * with too little left for a year has none, and the body is as much longer,
 * or shorter, as the yoke is not. None where the years will not go at all.
 */
export const laidOut = (years: number[], left: { yoke: number; body: number; sleeve: number }, reach: number): { yoke: Piece; body: Piece; sleeve: Piece } | undefined => {
  const mean = (Math.max(0, left.yoke) + left.body + left.sleeve) / years.length;
  const room = left.yoke >= 0.6 * mean;
  const tries: { k: number; m: number; dy: number; dev: number }[] = [];
  for (let k = 0; k <= years.length - 2; k++) {
    if (k > 0 && !room) break;
    for (let m = 1; m <= years.length - k - 1; m++) {
      const n = years.length - k - m;
      for (let dy = k > 0 ? -reach : 0; dy <= (k > 0 ? reach : 0); dy++) {
        const yoke = k > 0 ? left.yoke + dy : 0;
        const heights = [...(k > 0 ? [yoke / k] : []), (left.body + left.yoke - yoke) / m, left.sleeve / n];
        // A yoke with room for a year has one, if the years will go that way at all: its depth is the size's.
        tries.push({ k, m, dy, dev: Math.max(...heights.map((h) => Math.abs(h / mean - 1))) + (room && k === 0 ? 10 : 0) });
      }
    }
  }
  // The most even first; of two as even, the one with fewer years on the yoke, then on the body, then the shallower yoke.
  for (const { k, m, dy } of tries.sort((a, b) => (Math.abs(a.dev - b.dev) < 1e-9 ? 0 : a.dev - b.dev)).slice(0, 24)) {
    const yoke = pieceOf("yoke", years.slice(0, k), k > 0 ? left.yoke + dy : 0);
    // A yoke may come out a round short of what it was given: the body has that too.
    const body = yoke && pieceOf("body", years.slice(k, k + m), left.body + left.yoke - yoke.rows.length);
    const sleeve = body && pieceOf("sleeve", years.slice(k + m), left.sleeve);
    if (yoke && body && sleeve) return { yoke, body, sleeve };
  }
  return undefined;
};

/** How far the divide may move from the yoke's own depth, in rounds at a tension: about two centimetres. */
export const reachAt = (g: Gauge = gauge) => Math.round(2.1 * g.rounds);

/** What the rule chooses for a size, piece by piece: how the years are shared out, the rounds each piece has, and each year's cut with its rounds of pattern. */
export const chosen = (size: Measured, g?: Gauge) => {
  const laid = laidOut(YEARS, budgets(size, g), reachAt(g));
  if (!laid) throw new Error("the years will not go in this size");
  const pieces = [laid.yoke, laid.body, laid.sleeve];
  const cuts = (piece: Piece) => piece.placed.map((p) => `${p.year} ${p.state.label} (${p.rounds.length})`);
  return { split: pieces.map((piece) => piece.years.length).join("/"), rounds: pieces.map((piece) => piece.total), yoke: cuts(laid.yoke), body: cuts(laid.body), sleeve: cuts(laid.sleeve) };
};

/** A whole size: every year, over all its rounds. */
export const refit = (size: Measured, g?: Gauge): Plan => {
  const laid = laidOut(YEARS, budgets(size, g), reachAt(g));
  if (!laid) throw new Error("the years will not go in this size");
  const { yoke, body, sleeve } = laid;
  return {
    strips: { yoke: yoke.strips, body: body.strips, sleeve: sleeve.strips },
    rows: { yoke: yoke.rows, body: body.rows, sleeve: sleeve.rows },
    depth: { yoke: yoke.rows.length, body: body.rows.length, sleeve: sleeve.rows.length },
    frames: { yoke: yoke.frames, body: body.frames, sleeve: sleeve.frames },
  };
};
