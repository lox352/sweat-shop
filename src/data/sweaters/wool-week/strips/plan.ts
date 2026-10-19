import { yearOf } from "../years";
import { type Cut, type CutRow, choose, cutsOf, groundOf, lettersOf, patterns, patternOf, solid, topDown } from "./cuts";

/**
 * Where each year goes on a strip sampler, and how many rounds it has.
 *
 * Two kinds of layout:
 * - **Lined up**: all thirteen years from the neck to the hem, and the same
 *   strips again down each sleeve, round for round, so they line up when the
 *   arms hang down; the last year carries on down the sleeve, through the
 *   rest of its hat's sequence, to the cuff.
 * - **Each year once**: some years round the yoke, some down the body, the
 *   rest down both sleeves, in date order either way or in whatever order is
 *   easiest to knit.
 *
 * Either way every strip is within five percent of its piece's average
 * height, to the nearest round: one plain round (where any shaping goes) and
 * a cut of the year's pattern, with plain rounds in its ground to make up the
 * height, or its one-colour edge rounds taken off.
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
}

export type Layout =
  | { kind: "lined"; newestFirst: boolean }
  | { kind: "once"; order: "oldest" | "newest" | "easiest" };

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

// Pictures: a motif that reads as a thing, so a part-repeat at a seam shows.
const PICTURES = new Set([2015, 2016, 2019, 2022, 2023, 2024]);

/** What makes a year easy or hard to place: its repeat, whether it is a picture, and its longest run with nowhere to increase. */
export const traitsOf = (year: number, height: number) => {
  const cut = choose(cutsOf(year), height - 1);
  const rows = topDown(year, cut.parts);
  let run = 0;
  let longest = 0;
  rows.forEach((r, i) => {
    const flat = solid(lettersOf(year, r.chart)[r.row - 1]);
    const boundary = i > 0 && rows[i - 1].chart !== r.chart;
    run = flat || boundary ? 0 : run + 1;
    longest = Math.max(longest, run);
  });
  return { cut, w: Math.max(...rows.map((r) => r.w)), longest, picture: PICTURES.has(year) };
};

/**
 * The easiest order: every way of sharing the years between the pieces is
 * scored, and the cheapest kept. The yoke wants patterns with one-colour
 * rounds close together, to take its increases; the sleeves want all-over
 * patterns, which don't mind a part-repeat at the seam; pictures, which need
 * their whole repeat, go on the body. Then narrow repeats sit near the neck
 * and at the cuff, and down the body light and dark grounds take turns.
 */
export const easiestOrder = (size: Measured) => {
  const sp = splitOf(size);
  const t = Object.fromEntries(years.map((y) => [y, traitsOf(y, Math.round(sp.T))]));
  const body = Math.max(4, Math.round((size.chestCm * gauge.stitches) / 4) * 4);
  const cost = (y: number, piece: "yoke" | "body" | "sleeve") => {
    const x = t[y];
    if (piece === "yoke") return Math.max(0, x.longest - 8) + x.w / 40;
    if (piece === "sleeve") return x.picture ? 3 + 6 * Math.min(1, x.w / 30) : x.w / 40;
    return body % x.w === 0 ? 0 : 0.5;
  };
  const combos = (arr: number[], k: number): number[][] => {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    const [first, ...rest] = arr;
    return [...combos(rest, k - 1).map((c) => [first, ...c]), ...combos(rest, k)];
  };
  let best: { c: number; yoke: number[]; body: number[]; sleeve: number[] } | undefined;
  for (const yoke of combos(years, sp.k)) {
    const rest = years.filter((y) => !yoke.includes(y));
    for (const bodyYears of combos(rest, sp.m)) {
      const sleeve = rest.filter((y) => !bodyYears.includes(y));
      const c =
        yoke.reduce((s, y) => s + cost(y, "yoke"), 0) +
        bodyYears.reduce((s, y) => s + cost(y, "body"), 0) +
        sleeve.reduce((s, y) => s + cost(y, "sleeve"), 0);
      if (!best || c < best.c) best = { c, yoke, body: bodyYears, sleeve };
    }
  }
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  };
  const lightGround = (y: number) => {
    const shades = yearOf(y).colourway.shades;
    const g = groundOf(y, t[y].cut.parts);
    const all = Object.values(shades).map((s) => lum(s.hex));
    return lum(shades[g].hex) > all.reduce((a, b) => a + b, 0) / all.length;
  };
  const light = best!.body.filter(lightGround);
  const dark = best!.body.filter((y) => !lightGround(y));
  const bodyOrder: number[] = [];
  let flip = light.length >= dark.length;
  while (light.length || dark.length) {
    const from = (flip && light.length) || !dark.length ? light : dark;
    bodyOrder.push(from.shift()!);
    flip = !flip;
  }
  return {
    yoke: [...best!.yoke].sort((a, b) => t[a].w - t[b].w || a - b),
    body: bodyOrder,
    sleeve: [...best!.sleeve].sort((a, b) => t[b].w - t[a].w || a - b),
    traits: t,
  };
};

const once = (size: Measured, order: "oldest" | "newest" | "easiest"): Plan => {
  const sp = splitOf(size);
  const byDate = order === "newest" ? [...years].reverse() : years;
  const which =
    order === "easiest"
      ? easiestOrder(size)
      : { yoke: byDate.slice(0, sp.k), body: byDate.slice(sp.k, sp.k + sp.m), sleeve: byDate.slice(sp.k + sp.m) };
  const strips = { yoke: settle(which.yoke, sp.yoke), body: settle(which.body, sp.body), sleeve: settle(which.sleeve, sp.sleeve) };
  return {
    strips,
    rows: {
      yoke: strips.yoke.flatMap((s) => roundsOf(s).rows),
      body: strips.body.flatMap((s) => roundsOf(s).rows),
      sleeve: strips.sleeve.flatMap((s) => roundsOf(s).rows),
    },
    depth: { yoke: sp.yoke, body: sp.body, sleeve: sp.sleeve },
  };
};

export const planOf = (size: Measured, layout: Layout): Plan =>
  layout.kind === "lined" ? lined(size, layout.newestFirst) : once(size, layout.order);

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
