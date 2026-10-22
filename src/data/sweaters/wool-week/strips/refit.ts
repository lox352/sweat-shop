import { type Part, groundOf, lettersOf, measured, topDown } from "./cuts";
import { fans } from "./fans";
import { type Measured, type Plan, type Row, type Strip, splitOf } from "./plan";

/**
 * Each Year Once, refitted: 2014 to 2016 round the yoke, 2017 to 2021 down
 * the body, 2022 to 2026 down both sleeves, each year cut as full as its
 * piece has room for, by these rules:
 *
 * 1. A plain round outside a pattern carries on a neighbouring pattern's
 *    background - the commonest yarn in the three rows nearest that edge -
 *    never a colour from elsewhere. Padding carries on its own strip's; a
 *    round between two strips takes the stronger neighbour's, or, where one
 *    neighbour's edge row is already plain, the other's.
 * 2. A pattern's own plain first or last row is its increase round: no round
 *    goes beside it. Where neither neighbour has one, one plain round goes
 *    between them; each piece begins with one, and the body and sleeves end
 *    with one - save a yoke whose first cut says it opens the yoke itself,
 *    its first row taking the neck's increases (see knit's yoke fans).
 * 3. A cut's plain edge rows are kept or dropped in pairs, so a band is
 *    framed alike top and bottom.
 * 4. Where a cut skips part of the hat between two of its parts - 2014's two
 *    stars, which the hat parts with a peerie; 2019's boat and sheep - a
 *    plain round goes between them, to take the yoke's increases.
 * 5. Padding goes to patterned edges first, up to two rounds each, strongest
 *    background first; past that to any edge, carrying on its colour.
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
  /** A plain round between the hat's parts j - 1 and j, for each j: rule 4. */
  joins?: number[];
  /** First in its piece, it begins the piece itself, with no plain round above: rule 2. */
  opens?: boolean;
}
interface Ladder {
  year: number;
  states: State[];
}
const st = (label: string, parts: Part[], joins: number[] = [], opens = false): State => ({ label, parts, joins, opens });

/* The years' ladders: the fullest first, then each trim in the order it is taken. */

const y2014 = (cut: "C21" | "B26" | "P30"): Ladder => ({
  year: 2014,
  states:
    cut === "C21"
      ? [st("Chart C between peeries", [["A", 1, 4], ["C", 1, 13], ["A", 1, 4]])]
      : cut === "B26"
        ? [
            st("Both stars, a round between", [["B", 1, 13], ["C", 1, 13]], [1]),
            // Two rounds fewer: the stars meet, and the first star's tips are the yoke's first round.
            st("Both stars, meeting, opening the yoke", [["B", 1, 13], ["C", 1, 13]], [], true),
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
const y2019: Ladder = { year: 2019, states: [st("Sheep and boat, a round between", [["C", 3, 14], ["E", 1, 12]], [1])] };
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
type R = { year: number; chart: string; row: number; w: number } | { year: number; plain: string };
const lettersOfRound = (r: R): string[] => ("plain" in r ? [r.plain] : lettersOf(r.year, r.chart)[r.row - 1]);
const isPlain = (r: R) => new Set(lettersOfRound(r)).size === 1;

/** A pattern's background at an edge: the commonest yarn over the three rows nearest it, how much of them it is, and whether the edge row is plain. */
const edge = (rows: R[], top: boolean) => {
  const near = (top ? rows.slice(0, 3) : rows.slice(-3)).map(lettersOfRound);
  const n = new Map<string, number>();
  let all = 0;
  for (const r of near) {
    for (const c of r) {
      n.set(c, (n.get(c) ?? 0) + 1 / r.length);
      all += 1 / r.length;
    }
  }
  const [letter, count] = [...n].sort((a, b) => b[1] - a[1])[0];
  return { letter, share: count / all, plain: isPlain(top ? rows[0] : rows[rows.length - 1]) };
};

/** A cut's rounds from the neck down, with a round wherever it skips part of the hat. */
const roundsOfState = (year: number, s: State): R[] => {
  const out: R[] = [];
  const parts = [...s.parts].reverse();
  parts.forEach((part, k) => {
    const rows: R[] = topDown(year, [part]).map((r) => ({ year, ...r }));
    if (k > 0 && s.joins?.includes(parts.length - k)) {
      const above = edge(out, false);
      const below = edge(rows, true);
      out.push({ year, plain: (below.share > above.share ? below : above).letter });
    }
    out.push(...rows);
  });
  return out;
};

interface Placed {
  year: number;
  state: State;
  rounds: R[];
}
interface Ends {
  top: boolean;
  bottom: boolean;
}

/** The rounds rule 2 puts between a piece's strips, and above and below them, and what's left over. */
const between = (strips: Placed[], total: number, ends: Ends) => {
  const roundBetween = (a: Placed | null, b: Placed | null): R | null => {
    const upper = a ? edge(a.rounds, false) : null;
    const lower = b ? edge(b.rounds, true) : null;
    if (upper && lower && (upper.plain || lower.plain)) return null;
    if (!upper) return { year: b!.year, plain: lower!.letter };
    if (!lower) return { year: a!.year, plain: upper.letter };
    if (lower.plain && !upper.plain) return { year: a!.year, plain: upper.letter };
    if (upper.plain && !lower.plain) return { year: b!.year, plain: lower.letter };
    return lower.share > upper.share ? { year: b!.year, plain: lower.letter } : { year: a!.year, plain: upper.letter };
  };
  const rounds: (R | null)[] = [ends.top && !strips[0].state.opens ? roundBetween(null, strips[0]) : null];
  for (let i = 1; i < strips.length; i++) rounds.push(roundBetween(strips[i - 1], strips[i]));
  rounds.push(ends.bottom ? roundBetween(strips[strips.length - 1], null) : null);
  const used = strips.reduce((t, s) => t + s.rounds.length, 0) + rounds.filter(Boolean).length;
  return { spare: total - used, rounds };
};

/** A piece's rounds and its strips, the spare rounds shared out by rule 5. */
const build = (strips: Placed[], total: number, ends: Ends): { rows: Row[]; strips: Strip[] } => {
  const { spare, rounds } = between(strips, total, ends);
  if (spare < 0) throw new Error(`${strips.map((s) => s.year).join(", ")} will not go in ${total} rounds`);
  const edges = strips.flatMap((s, i) => [true, false].map((top) => ({ i, top, ...edge(s.rounds, top) })));
  const patterned = edges.filter((e) => !e.plain).sort((a, b) => b.share - a.share);
  const everywhere = [...edges].sort((a, b) => b.share - a.share);
  const pads = new Map<string, number>();
  for (let k = 0; k < spare; k++) {
    const e = k < 2 * patterned.length ? patterned[k % patterned.length] : everywhere[(k - 2 * patterned.length) % everywhere.length];
    pads.set(`${e.i}${e.top}`, (pads.get(`${e.i}${e.top}`) ?? 0) + 1);
  }
  const rows: Row[] = [];
  const placed: Strip[] = [];
  strips.forEach((s, i) => {
    const own: R[] = [];
    if (rounds[i]) own.push(rounds[i]!);
    for (let k = 0; k < (pads.get(`${i}true`) ?? 0); k++) own.push({ year: s.year, plain: edge(s.rounds, true).letter });
    own.push(...s.rounds);
    for (let k = 0; k < (pads.get(`${i}false`) ?? 0); k++) own.push({ year: s.year, plain: edge(s.rounds, false).letter });
    if (i === strips.length - 1 && rounds[i + 1]) own.push(rounds[i + 1]!);
    rows.push(...own);
    placed.push({ year: s.year, height: own.length, cut: measured(s.year, { ...s.state, neat: true }), ground: groundOf(s.year, s.state.parts) });
  });
  return { rows, strips: placed };
};

const place = (ladders: Ladder[], at: number[]): Placed[] =>
  ladders.map((l, i) => ({ year: l.year, state: l.states[at[i]], rounds: roundsOfState(l.year, l.states[at[i]]) }));

/** Each year at the top of its ladder, then down the trims in order (indices into `ladders`), until the piece fits. */
const fit = (ladders: Ladder[], total: number, ends: Ends, trims: number[]): { placed: Placed[]; at: number[] } | null => {
  const at = ladders.map(() => 0);
  while (between(place(ladders, at), total, ends).spare < 0) {
    const k = trims.find((i) => at[i] < ladders[i].states.length - 1);
    if (k === undefined) return null;
    at[k]++;
  }
  return { placed: place(ladders, at), at };
};

/** A sleeve: each year where it starts, down if too long, then up while a round or two of padding is left. */
const fitSleeve = (total: number, ends: Ends): Placed[] => {
  const at = sleeveLadders.map((l) => l.start);
  for (const i of sleeveTrims) {
    if (between(place(sleeveLadders, at), total, ends).spare >= 0) break;
    if (at[i] < sleeveLadders[i].states.length - 1) at[i]++;
  }
  for (const i of sleeveSpend) {
    if (at[i] === 0) continue;
    at[i]--;
    if (between(place(sleeveLadders, at), total, ends).spare < 2) at[i]++;
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
  const y = build(yoke.placed, sp.yoke, piece);
  const b = build(body.placed, sp.body, whole);
  const s = build(fitSleeve(sp.sleeve, whole), sp.sleeve, whole);
  return {
    strips: { yoke: y.strips, body: b.strips, sleeve: s.strips },
    rows: { yoke: y.rows.map(toRow), body: b.rows.map(toRow), sleeve: s.rows.map(toRow) },
    depth: { yoke: sp.yoke, body: sp.body, sleeve: sp.sleeve },
    fans: fans[sizeId],
  };
};
