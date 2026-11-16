import { type Part, type Round, cutsOf, edgeOf as edge, groundOf, isPlain, lettersOfRound, measured, seamsOf, topDown } from "./cuts";
import { type Frame, type Gauge, type Measured, type Plan, type Row, type Strip, splitOf } from "./plan";
import { background, quantumOf } from "./quanta";

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
 *    with one - save a yoke whose first cut says it opens the yoke itself,
 *    its first row taking the neck's increases (see shaping).
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
 * 7. Every quantum is framed alike: as many plain rounds above it as below -
 *    its own plain edge rows, the round between it and its neighbour where
 *    that is its own, and its padding. Where one side has more, rounds go on
 *    the other. So 2014's two stars each have a round of their own
 *    background above and below, not the year as a whole.
 * 8. Each of those plain rounds is in the background of the quantum's edge it
 *    is beside (rule 1): 2026's lattice, a ground round above and below;
 *    2015's sheep, sky above.
 * 6. Each year's cuts are a ladder from fullest down; a piece starts each
 *    year at the top of its ladder and steps down the trims in a set order
 *    until it fits. The sleeves start in the middle and spend spare rounds
 *    upwards.
 *
 * The depths of the yoke, body and sleeves are the even-strips plan's (see
 * plan's splitOf), and the cuts each size starts from, 2014's and 2017's and
 * 2018's, the ones it chose.
 */

interface State {
  label: string;
  parts: Part[];
  /** First in its piece, it begins the piece itself, with no plain round above: rule 2. */
  opens?: boolean;
}
interface Ladder {
  year: number;
  states: State[];
}
const st = (label: string, parts: Part[], opens = false): State => ({ label, parts, opens });

/* The years' ladders: the fullest first, then each trim in the order it is taken. */

const y2014 = (cut: "C21" | "B26" | "P30"): Ladder => ({
  year: 2014,
  states:
    cut === "C21"
      ? [st("Chart C between peeries", [["A", 1, 4], ["C", 1, 13], ["A", 1, 4]])]
      : cut === "B26"
        ? [
            st("Both stars, a round between", [["B", 1, 13], ["C", 1, 13]]),
            // A round fewer: the first star's tips are the yoke's first round.
            st("Both stars, a round between, opening the yoke", [["B", 1, 13], ["C", 1, 13]], true),
          ]
        : [
            st("Both stars, peerie between", [["B", 1, 13], ["A", 1, 4], ["C", 1, 13]]),
            st("Both stars, peerie between, outer rows off", [["B", 2, 13], ["A", 1, 4], ["C", 1, 12]]),
          ],
});
// The sheep's sky (rows 16-25) and field (1-5), taken off two rows to one.
const y2015: Ladder = {
  year: 2015,
  states: [[0, 1, 25], [3, 2, 23], [6, 3, 21], [9, 4, 19], [12, 5, 17]].map(([off, a, b]) =>
    st(off ? `Sheep, ${(off * 2) / 3} sky and ${off / 3} field rows off` : "As the hat, all the sky", [["A", a, b]]),
  ),
};
const y2016 = (seed: boolean): Ladder => ({
  year: 2016,
  states: [...(seed ? [st("Three strips with seed borders", [["A", 9, 41]])] : []), st("Three strips", [["A", 11, 39]])],
});
const y2017 = (four: boolean): Ladder => ({
  year: 2017,
  states: [0, 1, 2].map((t) =>
    st(
      `${four ? "Four" : "Three"} bands${t ? `, ${t} row${t > 1 ? "s" : ""} off each side` : ""}`,
      four ? [["A", 1 + t, 14], ["A", 1, 14 - t]] : [["A", 1 + t, 14], ["A", 1, 7 - t]],
    ),
  ),
});
const y2018 = (three: boolean): Ladder => {
  const top = three ? 34 : 24;
  const name = three ? "Dancers, plusses, dancers" : "Dancers and plusses";
  return {
    year: 2018,
    states: [st(name, [["B", 4, top]]), st(`${name}, plain edges off`, [["B", 5, top - 1]]), st(`${name}, a row off each side`, [["B", 6, top - 2]])],
  };
};
const y2019: Ladder = { year: 2019, states: [st("Sheep and boat, a round between", [["C", 3, 14], ["E", 1, 12]])] };
const y2020: Ladder = { year: 2020, states: [st("As the hat", [["B", 2, 39]]), st("Both star bands", [["B", 6, 35]])] };
const y2021: Ladder = { year: 2021, states: [st("With its borders", [["B", 3, 33]])] };
const sleeveLadders: (Ladder & { start: number })[] = [
  {
    year: 2022,
    start: 1,
    states: [
      st("Anchors, waves and ropes", [["B", 1, 14], ["C", 1, 13], ["D", 1, 14]]),
      st("Anchors and waves", [["B", 8, 14], ["C", 1, 13], ["D", 1, 7]]),
      st("Anchors", [["C", 1, 13]]),
    ],
  },
  {
    year: 2023,
    start: 1,
    states: [
      st("Flowers between peeries", [["B", 1, 4], ["C", 1, 25], ["D", 1, 4]]),
      st("Flowers", [["C", 1, 25]]),
      st("Flowers, cropped to 21", [["C", 3, 23]]),
      st("Flowers, cropped to 15", [["C", 6, 20]]),
    ],
  },
  {
    year: 2024,
    start: 1,
    states: [
      st("As the hat", [["B", 1, 11], ["C", 1, 15], ["D", 1, 12]]),
      st("Rams between zigzags", [["B", 5, 11], ["C", 1, 15], ["D", 1, 7]]),
      st("Rams", [["C", 1, 15]]),
    ],
  },
  {
    year: 2025,
    start: 1,
    states: [
      st("As the hat", [["A", 1, 16], ["A", 1, 16], ["A", 1, 13]]),
      st("Twice, dotted strip between", [["A", 1, 16], ["A", 1, 13]]),
      st("With the dotted strip", [["A", 1, 16]]),
    ],
  },
  {
    year: 2026,
    start: 2,
    states: [
      st("Cropped to 36", [["Body", 3, 38]]),
      st("Cropped to 32", [["Body", 5, 36]]),
      st("Cropped to 28", [["Body", 7, 34]]),
      st("Cropped to 24", [["Body", 9, 32]]),
    ],
  },
];
// Spare rounds on a sleeve go up these ladders, a step at a time: 2023, 2026 twice, 2024, 2022, 2025.
const sleeveSpend = [1, 4, 4, 2, 0, 3];
// And a sleeve too long comes down them: 2026 twice, 2025, 2023 twice, 2024, 2022.
const sleeveTrims = [4, 4, 3, 1, 1, 2, 0];

/** The cuts each size starts from, as the even-strips plan chose them. */
const starts: Record<string, { c2014: "C21" | "B26" | "P30"; four2017: boolean; three2018: boolean }> = {
  xs: { c2014: "C21", four2017: false, three2018: false },
  s: { c2014: "C21", four2017: false, three2018: false },
  m: { c2014: "C21", four2017: false, three2018: false },
  l: { c2014: "B26", four2017: false, three2018: false },
  xl: { c2014: "B26", four2017: true, three2018: false },
  "2xl": { c2014: "B26", four2017: true, three2018: true },
  "3xl": { c2014: "B26", four2017: true, three2018: true },
  "4xl": { c2014: "P30", four2017: true, three2018: true },
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
  const gaps: (Spot | null | undefined)[] = [ends.top && !strips[0].state.opens ? owner(null, spots[0], false) : undefined];
  for (let k = 1; k < spots.length; k++) gaps.push(owner(spots[k - 1], spots[k], spots[k].i === spots[k - 1].i));
  gaps.push(ends.bottom ? owner(spots[spots.length - 1], null, false) : undefined);
  // Rule 7: each quantum's plain rounds above and below it, and the rounds that even them up.
  const framing = spots.map((sp, k) => {
    const above = framedBy(gaps, spots, k, k, share) + leading(block(sp));
    const below = framedBy(gaps, spots, k + 1, k, share) + leading([...block(sp)].reverse());
    return { top: Math.max(0, below - above), bottom: Math.max(0, above - below), framed: Math.max(above, below) };
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

const place = (ladders: Ladder[], at: number[]): Placed[] =>
  ladders.map((l, i) => {
    const blocks = blocksOfState(l.year, l.states[at[i]]);
    return { year: l.year, state: l.states[at[i]], blocks, rounds: blocks.flat() };
  });

/**
 * Each year at the top of its ladder, then down the trims in order (indices
 * into `ladders`), until the piece fits; then back up any a later, bigger trim
 * has made room for again.
 */
const fit = (ladders: Ladder[], total: number, ends: Ends, trims: number[]): { placed: Placed[]; at: number[]; mode: Mode } | null =>
  fitting(ladders, total, ends, trims, STRICT) ??
  fitting(ladders, total, ends, trims, { mirror: true, share: true }) ??
  fitting(ladders, total, ends, trims, { mirror: false, share: true });

const fitting = (ladders: Ladder[], total: number, ends: Ends, trims: number[], mode: Mode): { placed: Placed[]; at: number[]; mode: Mode } | null => {
  const at = ladders.map(() => 0);
  const taken: number[] = [];
  // A cut that opens the piece itself is passed over: every piece begins with a plain round, where its first shaping or its divide goes.
  const next = (i: number) => {
    let a = at[i] + 1;
    while (a < ladders[i].states.length && ladders[i].states[a].opens) a++;
    return a;
  };
  while (layout(place(ladders, at), total, ends, mode).spare < 0) {
    const k = trims.find((i) => next(i) < ladders[i].states.length);
    if (k === undefined) {
      return null;
    }
    at[k] = next(k);
    taken.push(k);
  }
  for (const k of taken.slice(0, -1)) {
    const was = at[k];
    do at[k]--; while (at[k] > 0 && ladders[k].states[at[k]].opens);
    if (ladders[k].states[at[k]].opens || layout(place(ladders, at), total, ends, mode).spare < 0) at[k] = was;
  }
  return { placed: place(ladders, at), at, mode };
};

/** A sleeve: each year where it starts, down if too long, then up while a round or two of padding is left. */
const fitSleeve = (total: number, ends: Ends): Placed[] => {
  const at = sleeveLadders.map((l) => l.start);
  for (const i of sleeveTrims) {
    if (layout(place(sleeveLadders, at), total, ends).spare >= 0) break;
    if (at[i] < sleeveLadders[i].states.length - 1) at[i]++;
  }
  for (const i of sleeveSpend) {
    if (at[i] === 0) continue;
    at[i]--;
    if (layout(place(sleeveLadders, at), total, ends).spare < 2) at[i]++;
  }
  return place(sleeveLadders, at);
};


const toRow = (r: R): Row => ("plain" in r ? { year: r.year, plain: r.plain } : r);

/*
 * One rule for every piece (in the making: see ruled). Each year has one
 * ladder, every cut it has, fullest first; and each step down it has a rank,
 * how readily it is taken, the least missed first. A piece starts every year
 * at the top, takes the steps of its years in rank order until it fits, and
 * then takes back any an earlier step of another year made room for.
 */
const rungs: Record<number, [rank: number, state: State][]> = {
  2014: [[0, y2014("P30").states[0]], [1, y2014("B26").states[0]], [5, y2014("C21").states[0]]],
  2015: y2015.states.map((state, at) => [[0, 3, 4, 6, 7][at], state]),
  2016: [[0, y2016(true).states[0]], [2, y2016(true).states[1]]],
  2017: [[0, y2017(true).states[0]], ...y2017(false).states.map((state, at): [number, State] => [[7, 9, 11][at], state])],
  2018: [...y2018(true).states.map((state, at): [number, State] => [[0, 2, 4][at], state]), ...y2018(false).states.map((state, at): [number, State] => [[6, 8, 10][at], state])],
  2019: [[0, y2019.states[0]]],
  2020: y2020.states.map((state, at) => [[0, 1][at], state]),
  2021: [[0, y2021.states[0]]],
  2022: sleeveLadders[0].states.map((state, at) => [[0, 2, 12][at], state]),
  2023: sleeveLadders[1].states.map((state, at) => [[0, 6, 9, 10][at], state]),
  2024: sleeveLadders[2].states.map((state, at) => [[0, 3, 11][at], state]),
  2025: sleeveLadders[3].states.map((state, at) => [[0, 1, 8][at], state]),
  2026: sleeveLadders[4].states.map((state, at) => [[0, 4, 5, 7][at], state]),
};

/*
 * The same ladders, reordered where the order set by hand went against what
 * its knitter looks for in a cut:
 * - **A pattern is not cut into.** A step that takes rows off a pattern -
 *   "a row off each side" - is almost never to be taken: only when every
 *   step that keeps the patterns whole has been, the years' whole cuts
 *   narrowed first. (Rows of sky over the sheep are not the sheep; a plain
 *   edge is no pattern; the lattice is cropped where its frames end.)
 * - **Twice is company, four times is dull.** 2017's band is one motif,
 *   turned about row by row: three of it before four, the first step taken.
 * - **A core wants its trimmings.** 2014's one star between two peeries
 *   before its two stars side by side; and 2020's two stars each framed
 *   either side (as the hat) kept longest of the steps that cut nothing.
 */
const CUTS_INTO = 30;
const symmetric: Record<number, [rank: number, state: State][]> = {
  ...rungs,
  2014: [[0, y2014("P30").states[0]], [1, y2014("C21").states[0]]],
  2017: [[0, y2017(true).states[0]], ...y2017(false).states.map((state, at): [number, State] => [[0.5, CUTS_INTO + 9, CUTS_INTO + 11][at], state])],
  // Its three bands with a row off each side stand taller than its two whole: a ladder only goes down, so that cut is left out.
  2018: [
    ...y2018(true).states.slice(0, 2).map((state, at): [number, State] => [[0, 2][at], state]),
    ...y2018(false).states.map((state, at): [number, State] => [[6, 8, CUTS_INTO + 10][at], state]),
  ],
  2020: y2020.states.map((state, at) => [[0, 20][at], state]),
  2023: sleeveLadders[1].states.map((state, at) => [[0, 6, CUTS_INTO + 9, CUTS_INTO + 10][at], state]),
};
let rungsNow = rungs;
/** For measuring: the rungs to plan by. */
export const planBy = (which: "hand" | "symmetric") => {
  rungsNow = which === "hand" ? rungs : symmetric;
  wholeLadder.clear();
};

/**
 * A year's whole ladder: its rungs, and below them every other cut the year
 * has that is shorter than the last (see cuts' cutsOf), tallest first, so
 * that a piece with too few rounds for the cuts chosen for the pattern's own
 * tension - a knitter's bigger stitches, or more years to a piece - still
 * has one that fits. Those are stepped down to after every rung, the year
 * that has lost the least of its height first.
 */
const wholeLadder = new Map<number, [rank: number, state: State][]>();
const ladderOf = (year: number): [rank: number, state: State][] => {
  let ladder = wholeLadder.get(year);
  if (!ladder) {
    const own = rungsNow[year];
    const height = (state: State) => topDown(year, state.parts).length;
    const top = height(own[0][1]);
    const least = Math.min(...own.map(([, state]) => height(state)));
    const below = cutsOf(year)
      .filter((cut) => cut.height < least)
      .sort((a, b) => b.height - a.height)
      .filter((cut, at, all) => at === 0 || cut.height < all[at - 1].height)
      .map((cut): [number, State] => [100 + 100 * (1 - cut.height / top), st(cut.label, cut.parts)]);
    wholeLadder.set(year, (ladder = [...own, ...below]));
  }
  return ladder;
};

const ruledPiece = (years: number[], total: number, ends: Ends, slack: number) => {
  // By the rungs alone, however the piece has to be framed to take them; and only where they will not go at all, by the cuts below them.
  for (const whole of [false, true]) {
    const rankOf = (year: number, at: number) => (whole ? ladderOf(year) : rungsNow[year])[at]?.[0];
    const ladders: Ladder[] = years.map((year) => ({ year, states: (whole ? ladderOf(year) : rungsNow[year]).map(([, state]) => state) }));
    for (const mode of [STRICT, { mirror: true, share: true }, { mirror: false, share: true }]) {
      const at = years.map(() => 0);
      const spare = () => layout(place(ladders, at), total, ends, mode).spare;
      const taken: number[] = [];
      let stuck = false;
      while (spare() < 0) {
        // The step least missed, of those still to take.
        const next = years
          .map((year, i) => ({ i, rank: rankOf(year, at[i] + 1) }))
          .filter((one) => one.rank !== undefined)
          .sort((a, b) => a.rank! - b.rank!)[0];
        if (!next) {
          stuck = true;
          break;
        }
        at[next.i]++;
        taken.push(next.i);
      }
      if (stuck) continue;
      const last = taken[taken.length - 1];
      for (const k of taken.slice(0, -1)) {
        if (k === last || at[k] === 0) continue;
        at[k]--;
        if (spare() < slack) at[k]++;
      }
      return { placed: place(ladders, at), mode };
    }
  }
  return null;
};

/** What the one rule chooses for a size, as `chosen` says what the rules as they are choose. */
export const ruled = (size: Measured, g?: Gauge, slacks: [number, number, number] = [0, 0, 2]) => {
  const sp = splitOf(size, g);
  const years = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
  const yoke = ruledPiece(years.slice(0, sp.k), sp.yoke, { top: true, bottom: false }, slacks[0]);
  const body = ruledPiece(years.slice(sp.k, sp.k + sp.m), sp.body, { top: true, bottom: true }, slacks[1]);
  const sleeve = ruledPiece(years.slice(sp.k + sp.m), sp.sleeve, { top: true, bottom: true }, slacks[2]);
  const cuts = (placed: Placed[] | undefined) => (placed ?? []).map((p) => `${p.year} ${p.state.label} (${p.rounds.length})`);
  return { split: `${sp.k}/${sp.m}/${sp.n}`, rounds: [sp.yoke, sp.body, sp.sleeve], yoke: cuts(yoke?.placed), body: cuts(body?.placed), sleeve: cuts(sleeve?.placed) };
};

/**
 * What a cut is worth, beyond its rounds of pattern: how nearly it mirrors
 * about its centre line, row for row, from 0 to 1; and how fully its cores
 * are framed, a core with a frame either side 1 and one with none 0, over
 * all its cores - nothing for a cut with no core.
 */
const worth = new Map<State, { rounds: number; mirrored: number; framed: number }>();
const worthOf = (year: number, state: State) => {
  let w = worth.get(state);
  if (!w) {
    const rows = blocksOfState(year, state).flat();
    const letters = rows.map((r) => lettersOfRound(r).join(""));
    const mirrored = letters.filter((row, at) => row === letters[letters.length - 1 - at]).length / letters.length;
    // Its quanta in order, the rows between them that belong to none left out.
    const made: { kind: string; key: string }[] = [];
    for (const r of rows) {
      const q = "plain" in r ? undefined : quantumOf(r.year, r.chart, r.row);
      if (!q) continue;
      const key = `${q.chart}${q.from}`;
      if (made[made.length - 1]?.key !== key) made.push({ kind: q.kind, key });
    }
    const cores = made.map((one, at) => ({ one, at })).filter(({ one }) => one.kind === "core");
    const sides = cores.reduce((n, { at }) => n + (made[at - 1]?.kind === "frame" ? 1 : 0) + (made[at + 1]?.kind === "frame" ? 1 : 0), 0);
    worth.set(state, (w = { rounds: rows.length, mirrored, framed: cores.length ? sides / (2 * cores.length) : 0 }));
  }
  return w;
};

/**
 * A piece by worth (in the making, beside ruledPiece): of every way of
 * cutting its years that fits, the one worth most - its rounds of pattern,
 * and so many rounds' worth for a cut that mirrors about its centre line and
 * for cores framed either side.
 */
const worthiestPiece = (years: number[], total: number, ends: Ends, weights: { mirrored: number; framed: number }) => {
  const ladders: Ladder[] = years.map((year) => ({ year, states: rungs[year].map(([, state]) => state) }));
  for (const mode of [STRICT, { mirror: true, share: true }, { mirror: false, share: true }]) {
    let best: { at: number[]; value: number; spare: number } | undefined;
    const at = years.map(() => 0);
    const visit = (i: number, value: number) => {
      if (i === years.length) {
        const spare = layout(place(ladders, at), total, ends, mode).spare;
        // The most worth; of two worth the same, the one that leaves fewer rounds to pad.
        if (spare >= 0 && (!best || value > best.value + 1e-9 || (Math.abs(value - best.value) < 1e-9 && spare < best.spare))) best = { at: [...at], value, spare };
        return;
      }
      ladders[i].states.forEach((state, k) => {
        if (state.opens) return;
        const w = worthOf(years[i], state);
        at[i] = k;
        visit(i + 1, value + w.rounds + weights.mirrored * w.mirrored + weights.framed * w.framed);
      });
    };
    visit(0, 0);
    if (best) return { placed: place(ladders, (best as { at: number[] }).at), mode };
  }
  return null;
};

/** What choosing by worth chooses for a size, as `chosen` says what the rules as they are choose. */
export const worthiest = (size: Measured, weights: { mirrored: number; framed: number }, g?: Gauge) => {
  const sp = splitOf(size, g);
  const years = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
  const yoke = worthiestPiece(years.slice(0, sp.k), sp.yoke, { top: true, bottom: false }, weights);
  const body = worthiestPiece(years.slice(sp.k, sp.k + sp.m), sp.body, { top: true, bottom: true }, weights);
  const sleeve = worthiestPiece(years.slice(sp.k + sp.m), sp.sleeve, { top: true, bottom: true }, weights);
  const cuts = (placed: Placed[] | undefined) => (placed ?? []).map((p) => `${p.year} ${p.state.label} (${p.rounds.length})`);
  return { split: `${sp.k}/${sp.m}/${sp.n}`, rounds: [sp.yoke, sp.body, sp.sleeve], yoke: cuts(yoke?.placed), body: cuts(body?.placed), sleeve: cuts(sleeve?.placed) };
};

/** For measuring: every rung of every year, with what it is made of - its rounds, its quanta's lengths, and how nearly it mirrors about its middle. */
export const rungsMeasured = () =>
  Object.entries(rungs).flatMap(([year, own]) =>
    own.map(([rank, state]) => {
      const blocks = blocksOfState(Number(year), state);
      const rows = blocks.flat().map((r) => lettersOfRound(r).join(""));
      const mirrored = rows.filter((row, at) => row === rows[rows.length - 1 - at]).length / rows.length;
      // Its make-up, quantum by quantum: each a core, a frame or free, with its rows; "-" a row that belongs to none.
      const made: string[] = [];
      let last = "";
      for (const r of blocks.flat()) {
        const q = "plain" in r ? undefined : quantumOf(r.year, r.chart, r.row);
        const key = q ? `${q.kind}:${q.chart}${q.from}` : "-";
        if (key === last) made[made.length - 1] = made[made.length - 1].replace(/\d+$/, (n) => String(Number(n) + 1));
        else made.push(`${q ? q.kind : "-"} ${1}`);
        last = key;
      }
      return { year: Number(year), rank, label: state.label, rounds: rows.length, blocks: blocks.map((block) => block.length), mirrored: Math.round(mirrored * 100), made };
    }),
  );

/** How many spare rounds a piece keeps when a step is taken back: the yoke and the sleeves, where every band is shaped, a round or two; the body none. */
const SLACK = { yoke: 2, body: 0, sleeve: 2 };

/**
 * A piece by the one rule: these years, in order, in so many rounds - its
 * rows, laid out by the rules every piece keeps. None where the years will
 * not go in the rounds however they are cut.
 */
export const pieceOf = (years: number[], total: number, piece: "yoke" | "body" | "sleeve"): Row[] | null => {
  const ends = { top: true, bottom: piece !== "yoke" };
  const fitted = ruledPiece(years, total, ends, SLACK[piece]);
  return fitted && build(fitted.placed, total, ends, fitted.mode).rows.map(toRow);
};

/** A size's plan by the one rule: as refit lays a size out, from the cuts the rule chooses. */
export const ruledPlan = (size: Measured, g?: Gauge, slacks: [number, number, number] = [2, 0, 2]): Plan => {
  const sp = splitOf(size, g);
  const years = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
  const piece = { top: true, bottom: false };
  const whole = { top: true, bottom: true };
  const yoke = ruledPiece(years.slice(0, sp.k), sp.yoke, piece, slacks[0]);
  const body = ruledPiece(years.slice(sp.k, sp.k + sp.m), sp.body, whole, slacks[1]);
  const sleeve = ruledPiece(years.slice(sp.k + sp.m), sp.sleeve, whole, slacks[2]);
  if (!yoke || !body || !sleeve) throw new Error("the years will not fit");
  const y = build(yoke.placed, sp.yoke, piece, yoke.mode);
  const b = build(body.placed, sp.body, whole, body.mode);
  const s = build(sleeve.placed, sp.sleeve, whole, sleeve.mode);
  return {
    strips: { yoke: y.strips, body: b.strips, sleeve: s.strips },
    rows: { yoke: y.rows.map(toRow), body: b.rows.map(toRow), sleeve: s.rows.map(toRow) },
    depth: { yoke: y.rows.length, body: b.rows.length, sleeve: s.rows.length },
    frames: { yoke: y.frames, body: b.frames, sleeve: s.frames },
  };
};

/** What the rules choose for a size, piece by piece: how the years are shared out, the rounds each piece has, and each year's cut with its rounds of pattern. */
export const chosen = (size: Measured, sizeId: string, g?: Gauge) => {
  const start = starts[sizeId];
  const sp = splitOf(size, g);
  const piece = { top: true, bottom: false };
  const whole = { top: true, bottom: true };
  const yokeWith = (seed: boolean) => fit([y2014(start.c2014), y2015, y2016(seed)], sp.yoke, piece, [2, 0, 1, 1, 1, 1]);
  let yoke = yokeWith(true);
  if (!yoke || yoke.at.some((a) => a !== 0)) yoke = yokeWith(false);
  const body = fit([y2017(start.four2017), y2018(start.three2018), y2019, y2020, y2021], sp.body, whole, [3, 1, 0, 1, 0]);
  const sleeve = fitSleeve(sp.sleeve, whole);
  const cuts = (placed: Placed[]) => placed.map((p) => `${p.year} ${p.state.label} (${p.rounds.length})`);
  return {
    split: `${sp.k}/${sp.m}/${sp.n}`,
    rounds: [sp.yoke, sp.body, sp.sleeve],
    yoke: yoke ? cuts(yoke.placed) : [],
    body: body ? cuts(body.placed) : [],
    sleeve: cuts(sleeve),
  };
};

export const refit = (size: Measured, sizeId: string, g?: Gauge): Plan => {
  const start = starts[sizeId];
  if (!start) throw new Error(`no refit for size ${sizeId}`);
  const sp = splitOf(size, g);
  const piece = { top: true, bottom: false };
  const whole = { top: true, bottom: true };
  // The yoke: the houses' seed borders only if everything else fits whole; trims 2016's borders, 2014's outer rows, then the sheep in threes.
  const yokeWith = (seed: boolean) => fit([y2014(start.c2014), y2015, y2016(seed)], sp.yoke, piece, [2, 0, 1, 1, 1, 1]);
  let yoke = yokeWith(true);
  if (!yoke || yoke.at.some((a) => a !== 0)) yoke = yokeWith(false);
  // The body: trims 2020's outer peeries, 2018's plain edges, a row off each side of 2017, then of 2018, then 2017 again.
  const body = fit([y2017(start.four2017), y2018(start.three2018), y2019, y2020, y2021], sp.body, whole, [3, 1, 0, 1, 0]);
  if (!yoke || !body) throw new Error(`size ${sizeId} will not fit`);
  const y = build(yoke.placed, sp.yoke, piece, yoke.mode);
  const b = build(body.placed, sp.body, whole, body.mode);
  const sleeve = fitSleeve(sp.sleeve, whole);
  const modes: Mode[] = [STRICT, { mirror: true, share: true }, { mirror: false, share: true }];
  const s = build(sleeve, sp.sleeve, whole, modes.find((m) => layout(sleeve, sp.sleeve, whole, m).spare >= 0) ?? modes[2]);
  return {
    strips: { yoke: y.strips, body: b.strips, sleeve: s.strips },
    rows: { yoke: y.rows.map(toRow), body: b.rows.map(toRow), sleeve: s.rows.map(toRow) },
    // A piece a round shorter where an odd round was left out (rule 5).
    depth: { yoke: y.rows.length, body: b.rows.length, sleeve: s.rows.length },
    frames: { yoke: y.frames, body: b.frames, sleeve: s.frames },
  };
};
