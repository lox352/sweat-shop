import { type Part, type Round, edgeOf as edge, groundOf, isPlain, lettersOfRound, measured, seamsOf, topDown } from "./cuts";
import { type Frame, type Measured, type Plan, type Row, type Strip, splitOf } from "./plan";
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

export const refit = (size: Measured, sizeId: string): Plan => {
  const start = starts[sizeId];
  if (!start) throw new Error(`no refit for size ${sizeId}`);
  const sp = splitOf(size);
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
