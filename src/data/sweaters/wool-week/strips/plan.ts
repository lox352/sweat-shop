import { type Cut, type CutRow, choose, cutsOf, groundOf, lettersOf, patterns, patternOf, topDown } from "./cuts";
import type { Fan } from "./fans";
import { refit } from "./refit";

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
 *   plain rounds in its ground to make up the height, or its one-colour edge
 *   rounds taken off.
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

/** A round of a strip before any counts: plain in one of the year's yarns, or a row of one of its charts. */
export type Row = { year: number; plain: string } | ({ year: number } & CutRow);

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
  /** How the yoke grows through its first rounds, where the layout says: see fans. */
  fans?: Fan[];
}

export type Layout = { kind: "lined"; newestFirst: boolean } | { kind: "refit" };

const years = patterns.map((p) => p.year);

/** Colourwork rounds each piece has, before any year is placed. */
const budgets = (size: Measured) => ({
  yoke: Math.round(size.yokeDepthCm * gauge.rounds) - ribs.neck - 1,
  body: Math.round(size.bodyLengthCm * gauge.rounds) - ribs.hem - 2,
  sleeve: Math.round(size.sleeveLengthCm * gauge.rounds) - ribs.cuff - 2,
});

/**
 * Heights for strips sharing `total` rounds, each within 5% of their average
 * and as near its cut's own height as that allows.
 */
const settle = (years: number[], total: number): Strip[] => {
  const mean = total / years.length;
  const lo = Math.round(0.95 * mean);
  const hi = Math.round(1.05 * mean);
  const picks = years.map((year) => {
    const cut = choose(cutsOf(year), Math.round(mean) - 1);
    return { year, cut, h: Math.min(hi, Math.max(lo, cut.height + 1)) };
  });
  let d = total - picks.reduce((t, x) => t + x.h, 0);
  while (d !== 0) {
    let pick = -1;
    let score = -Infinity;
    picks.forEach((x, i) => {
      const want = x.cut.height + 1;
      const s = d > 0 ? (x.h < hi ? want - x.h : -Infinity) : x.h > lo ? x.h - want : -Infinity;
      if (s > score) {
        score = s;
        pick = i;
      }
    });
    if (pick < 0) throw new Error(`${years.length} strips will not share ${total} rounds`);
    picks[pick].h += Math.sign(d);
    d -= Math.sign(d);
  }
  return picks.map((x) => {
    const cut = choose(cutsOf(x.year), x.h - 1);
    return { year: x.year, height: x.h, cut, ground: groundOf(x.year, cut.parts) };
  });
};

/**
 * A strip's rounds: its plain round, then its cut, with plain rounds to make
 * up the height - first where the repeat changes inside it, then shared above
 * and below, or all above when `last`, so that its pattern runs straight on
 * into a sleeve's longer version.
 */
const roundsOf = (strip: Strip, last = false): { rows: Row[]; kept: CutRow[] } => {
  const rows: Row[] = [];
  let pad = strip.height - 1 - strip.cut.height;
  let trimTop = 0;
  let trimBottom = 0;
  for (; pad < 0; pad++) {
    if ((trimTop < strip.cut.edgeTop && trimTop <= trimBottom) || trimBottom >= strip.cut.edgeBottom) trimTop++;
    else trimBottom++;
  }
  const flat = topDown(strip.year, strip.cut.parts);
  const kept = flat.slice(trimTop, flat.length - trimBottom);
  const joins = kept.filter((r, k) => k > 0 && r.w !== kept[k - 1].w).length;
  let atJoins = Math.min(joins, pad);
  const rest = pad - atJoins;
  const above = last ? rest : Math.floor(rest / 2);
  const plain = (n: number) => {
    for (let k = 0; k < n; k++) rows.push({ year: strip.year, plain: strip.ground });
  };
  plain(1 + above);
  kept.forEach((r, k) => {
    if (k > 0 && r.w !== kept[k - 1].w && atJoins > 0) {
      plain(1);
      atJoins--;
    }
    rows.push({ year: strip.year, ...r });
  });
  plain(rest - above + atJoins);
  return { rows, kept };
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
  const yokeStrips = settle(order.slice(0, plan.k), plan.yoke);
  const bodyStrips = settle(order.slice(plan.k), P - plan.yoke);
  const yokeRows = yokeStrips.flatMap((s) => roundsOf(s).rows);
  const shaped = bodyStrips.map((s, i) => roundsOf(s, i === bodyStrips.length - 1));
  const bodyRows = shaped.flatMap((x) => x.rows);
  // The sleeves: the body's strips, then the last year carried on down from where its cut stops.
  const last = bodyStrips[bodyStrips.length - 1];
  const extra = b.sleeve - b.body;
  const p = patternOf(last.year);
  const full = topDown(last.year, p.full ?? p.options[p.options.length - 1].parts);
  const kept = shaped[shaped.length - 1].kept;
  let from = -1;
  for (let i = 0; i + kept.length <= full.length; i++) {
    if (kept.every((r, k) => full[i + k].chart === r.chart && full[i + k].row === r.row)) {
      from = i;
      break;
    }
  }
  const onward = from < 0 ? [] : full.slice(from + kept.length);
  let take = Math.min(onward.length, extra);
  // Stopping where a part ends, if one ends near enough.
  for (let t = take; t > take - 6 && t > 0; t--) {
    if (t === onward.length || onward[t].chart !== onward[t - 1].chart) {
      take = t;
      break;
    }
  }
  const sleeveRows: Row[] = [
    ...bodyRows,
    ...onward.slice(0, take).map((r) => ({ year: last.year, ...r })),
    ...Array.from({ length: extra - take }, () => ({ year: last.year, plain: last.ground })),
  ];
  const sleeveStrips = [...bodyStrips.slice(0, -1), { ...last, height: last.height + extra }];
  return {
    strips: { yoke: yokeStrips, body: bodyStrips, sleeve: sleeveStrips },
    rows: { yoke: yokeRows, body: bodyRows, sleeve: sleeveRows },
    depth: { yoke: plan.yoke, body: P - plan.yoke, sleeve: b.sleeve - (plan.yoke - b.yoke) },
    onward: { year: last.year, pattern: take, plain: extra - take },
  };
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

/** Where each year's strip sits, for the colourways that shade or alternate by place: 0 at the neck to 1, and its turn. */
export const placesOf = (plan: Plan): Record<number, { frac: number; parity: number }> => {
  const out: Record<number, { frac: number; parity: number }> = {};
  const lined = plan.onward !== undefined;
  if (lined) {
    [...plan.strips.yoke, ...plan.strips.body].forEach((s, i) => (out[s.year] = { frac: i / 12, parity: i }));
  } else {
    const k = plan.strips.yoke.length;
    const below = Math.max(plan.strips.body.length, plan.strips.sleeve.length);
    const span = k + below - 1;
    plan.strips.yoke.forEach((s, i) => (out[s.year] = { frac: i / span, parity: i }));
    plan.strips.body.forEach((s, i) => (out[s.year] = { frac: (k + i) / span, parity: k + i }));
    plan.strips.sleeve.forEach((s, i) => (out[s.year] = { frac: (k + i) / span, parity: k + i + 1 }));
  }
  return out;
};

/**
 * Each year's ground: the commonest of its hat's yarns over the plan's rounds, each round's yarns sharing
 * one round between them. The colourways set a year light or dark by it, and the ribs are knitted in it.
 */
export const groundsOf = (plan: Plan): Record<number, string> => {
  const count = new Map<number, Map<string, number>>();
  for (const r of [...plan.rows.yoke, ...plan.rows.body, ...plan.rows.sleeve]) {
    const letters = "plain" in r ? [r.plain] : lettersOf(r.year, r.chart)[r.row - 1].slice(0, r.w);
    if (!count.has(r.year)) count.set(r.year, new Map());
    const n = count.get(r.year)!;
    for (const l of letters) n.set(l, (n.get(l) ?? 0) + 1 / letters.length);
  }
  return Object.fromEntries([...count].map(([y, n]) => [y, [...n].sort((a, b) => b[1] - a[1])[0][0]]));
};
