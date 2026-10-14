/**
 * How long a sweater has taken, and how long it has left, from the log of taps.
 *
 * A tap is rarely one stitch: the big button finishes a run, End of round a
 * round, and the chart can jump anywhere. So the log only ever says that a
 * stretch of stitches was reached at a moment, and everything else is
 * inferred. The approach, chosen by simulation (see the explore branch):
 *
 *   - Each gap between taps is judged against what its stitches should take
 *     at typical costs. Much longer than that, it had a break in it, and its
 *     stitches are credited at the knitter's own pace instead.
 *   - Every gap judged as knitting is also capped at half as much again as
 *     the knitter's pace says, plus two minutes: short breaks hide inside
 *     long gaps, and no tap tells them apart.
 *   - The knitter's pace is a cost per operation (knit, purl, a colour
 *     change, a decrease...), fitted to the gaps by least squares and pulled
 *     towards typical costs while there is little to go on. What is left is
 *     priced at those costs, which knows a crown of decreases or a stretch of
 *     two-colour rounds for what it is.
 */
import { Stitch, isFabric, isStep } from "../../types/Stitch";
import { workedAs } from "../sides";
import type { Action } from "./log";

export const operations = [
  "castOn",
  "knit",
  "purl",
  "tbl",
  "decrease",
  "doubleDecrease",
  "makeOne",
  "kfb",
  "pickUp",
  "bindOff",
  "colourChange",
  "knitPurlSwitch",
  "join",
  "hold",
  "resume",
  "needles",
  "turn",
] as const;
export type Operation = (typeof operations)[number];
export const columns = [...operations, "tap"] as const;
export type Column = (typeof columns)[number];
export type Costs = Record<Column, number>;

/**
 * Seconds each takes, as a starting guess: estimates, not measured from real
 * knitters. They judge whether a gap looks like a break, and hold each cost
 * steady until the knitter's own taps outweigh them. Never shown as a
 * comparison. A tap is the moment spent tapping.
 */
export const typical: Costs = {
  castOn: 5.5,
  knit: 2.2,
  purl: 2.9,
  tbl: 2.8,
  decrease: 3.8,
  doubleDecrease: 5,
  makeOne: 6,
  kfb: 5,
  pickUp: 5,
  bindOff: 3.5,
  colourChange: 2.5,
  knitPurlSwitch: 1.2,
  join: 45,
  hold: 120,
  resume: 150,
  needles: 40,
  turn: 15,
  tap: 1.5,
};

const baseOf = (stitch: Stitch): Operation | undefined => {
  // As it was worked: a knit on a row worked from the wrong side was purled.
  switch (workedAs(stitch)) {
    case "castOn": return "castOn";
    case "k1": return "knit";
    case "p1": return "purl";
    case "k1tbl": return "tbl";
    case "k2tog": case "ssk": return "decrease";
    case "s2kp": case "sk2p": return "doubleDecrease";
    case "m1": return "makeOne";
    case "kfb": return "kfb";
    case "pickUp": return "pickUp";
    case "bindOff": return "bindOff";
    case "join": return "join";
    case "hold": return "hold";
    case "resume": return "resume";
    case "needles": return "needles";
    case "turn": return "turn";
    default: return undefined;
  }
};

/**
 * What each stitch asks of the knitter, as running totals from the start, so
 * the operations in any stretch can be counted at once.
 */
export class Prefix {
  private sums: Float64Array[];
  readonly last: number;
  constructor(stitches: Stitch[]) {
    const ops = stitches.map(() => new Set<Operation>());
    let previous: Stitch | undefined;
    for (const stitch of stitches) {
      if (stitch.id === 0) continue;
      const base = baseOf(stitch);
      if (base) ops[stitch.id].add(base);
      if (isStep(stitch) || !isFabric(stitch)) continue;
      if (previous && stitch.type !== "castOn" && previous.type !== "castOn") {
        if (previous.slot !== stitch.slot) ops[stitch.id].add("colourChange");
        if ((previous.type === "p1") !== (stitch.type === "p1")) ops[stitch.id].add("knitPurlSwitch");
      }
      previous = stitch;
    }
    this.sums = operations.map((op) => {
      const out = new Float64Array(stitches.length);
      for (let id = 1; id < out.length; id++) out[id] = out[id - 1] + (ops[id].has(op) ? 1 : 0);
      return out;
    });
    this.last = stitches.length - 1;
  }
  /** Operations over the stitches after `from`, up to and including `to`. */
  counts(from: number, to: number): number[] {
    const hi = Math.min(to, this.last);
    const lo = Math.max(from, 0);
    return this.sums.map((sum) => sum[hi] - sum[lo]);
  }
}

const prefixes = new WeakMap<Stitch[], Prefix>();
export const prefixFor = (stitches: Stitch[]): Prefix => {
  let prefix = prefixes.get(stitches);
  if (!prefix) prefixes.set(stitches, (prefix = new Prefix(stitches)));
  return prefix;
};

/** Seconds a stretch should take at these costs, with this many taps for it. */
export const predict = (prefix: Prefix, costs: Costs, from: number, to: number, taps = 1) =>
  prefix.counts(from, to).reduce((sum, n, i) => sum + n * costs[operations[i]], 0) + taps * costs.tap;

/** The stitches after `from` up to `to`, reached in `ms`; or at a pace nobody saw. */
export interface Observation {
  from: number;
  to: number;
  ms?: number;
}

/** A gap with a break in it: going backwards, or far longer than its stitches should take. */
const paused = (gapMs: number, expectedMs: number) =>
  gapMs < 0 || gapMs > Math.max(3 * expectedMs, expectedMs + 5 * 60_000);

/**
 * The changes an undo took back: each undo cancels the latest change still
 * standing, when it reverses it exactly. A cancelled change never happened,
 * as far as timing goes: a run tapped twice, or a jump ahead to show someone
 * the chart, and then undone.
 */
export const cancelledBy = (actions: Action[]) => {
  const cancelled = new Set<number>();
  const standing: number[] = [];
  actions.forEach((action, i) => {
    if (action.untimed) {
      standing.length = 0;
      return;
    }
    if (!action.undo) {
      standing.push(i);
      return;
    }
    const last = standing.pop();
    if (last === undefined) return;
    const undone = actions[last];
    if (undone.from === action.to && undone.to === action.from) {
      cancelled.add(last);
      cancelled.add(i);
    } else {
      standing.push(last);
    }
  });
  return cancelled;
};

/** Faster than a third of this knitter's usual pace is no knitting at all, but a jump. */
const impossiblyFast = 1 / 3;

/**
 * Every stretch of stitches reached going forwards, and how long it took if
 * the gap before it looked like knitting. A stitch's time is that of the last
 * tap that reached it: knitting frogged and done again counts its second
 * time. Going back is never knitting; its gap is time spent all the same,
 * and is counted apart.
 *
 * Two things are never timed. A change that was undone is left out
 * altogether, and the next tap is timed from the last change still standing.
 * And a stretch reached impossibly fast, far quicker than the knitter's own
 * pace, was jumped to rather than knitted: its stitches count, at the
 * knitter's usual pace, but it says nothing about how fast they knit.
 */
export const observe = (actions: Action[], prefix: Prefix) => {
  const cancelled = cancelledBy(actions);
  const observations: Observation[] = [];
  let otherMs = 0;
  let previous: Action | undefined;
  actions.forEach((action, i) => {
    if (cancelled.has(i)) return;
    // Progress that moved while nothing was recording is neither timed nor credited,
    // and the tap after it has no gap of its own to go on.
    if (action.untimed) {
      previous = action;
      return;
    }
    const gap = !previous || previous.untimed ? NaN : action.t - previous.t;
    previous = action;
    if (action.undo || action.to <= action.from) {
      if (Number.isFinite(gap) && !paused(gap, 60_000)) otherMs += gap;
      return;
    }
    const expected = predict(prefix, typical, action.from, action.to) * 1000;
    observations.push({
      from: action.from,
      to: action.to,
      ms: Number.isFinite(gap) && !paused(gap, expected) ? gap : undefined,
    });
  });

  // The knitter's own pace, against typical: the middle of their timed
  // stretches, which one wild stretch can't drag about.
  const ratios = observations
    .filter((o) => o.ms !== undefined)
    .map((o) => o.ms! / 1000 / predict(prefix, typical, o.from, o.to))
    .sort((a, b) => a - b);
  const pace = ratios.length >= 5 ? ratios[Math.floor(ratios.length / 2)] : 1;
  for (const o of observations) {
    if (o.ms !== undefined && o.ms / 1000 < impossiblyFast * pace * predict(prefix, typical, o.from, o.to)) {
      o.ms = undefined;
    }
  }

  const reached = new Int32Array(prefix.last + 1).fill(-1);
  observations.forEach((o, n) => {
    for (let id = Math.max(o.from + 1, 0); id <= Math.min(o.to, prefix.last); id++) reached[id] = n;
  });
  const kept = new Set(reached);
  return { observations: observations.filter((_, n) => kept.has(n)), otherMs };
};

/** How much longer or shorter than typical this knitter's timed stretches took. */
export const speedOf = (observations: Observation[], prefix: Prefix) => {
  let actual = 0;
  let expected = 0;
  for (const o of observations) {
    if (o.ms === undefined) continue;
    actual += o.ms / 1000;
    expected += predict(prefix, typical, o.from, o.to);
  }
  return expected > 0 ? actual / expected : 1;
};

/**
 * Each timed gap capped at half as much again as its stitches should take at
 * this knitter's pace, and two minutes. Worked out twice, so that the cap
 * uses a pace the breaks have already been taken out of.
 */
export const clamp = (observations: Observation[], prefix: Prefix): Observation[] => {
  let out = observations;
  for (let pass = 0; pass < 2; pass++) {
    const speed = speedOf(out, prefix);
    out = observations.map((o) =>
      o.ms === undefined
        ? o
        : { ...o, ms: Math.min(o.ms, 1000 * (1.5 * speed * predict(prefix, typical, o.from, o.to) + 120)) },
    );
  }
  return out;
};

/**
 * Least squares with every cost at least zero (Lawson and Hanson), on the
 * normal equations: a dozen or so unknowns, however many taps.
 */
const nnls = (ata: number[][], atb: number[]): number[] => {
  const n = atb.length;
  const x = new Array<number>(n).fill(0);
  const passive = new Array<boolean>(n).fill(false);
  const gradient = () => atb.map((b, i) => b - ata[i].reduce((s, a, j) => s + a * x[j], 0));
  const solve = (set: number[]) => {
    const m = set.map((i) => set.map((j) => ata[i][j]));
    const v = set.map((i) => atb[i]);
    for (let c = 0; c < set.length; c++) {
      let p = c;
      for (let r = c + 1; r < set.length; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
      [m[c], m[p]] = [m[p], m[c]];
      [v[c], v[p]] = [v[p], v[c]];
      const d = m[c][c] || 1e-12;
      for (let r = 0; r < set.length; r++) {
        if (r === c) continue;
        const f = m[r][c] / d;
        for (let k = c; k < set.length; k++) m[r][k] -= f * m[c][k];
        v[r] -= f * v[c];
      }
    }
    return v.map((value, i) => value / (m[i][i] || 1e-12));
  };
  for (let outer = 0; outer < 3 * n; outer++) {
    const w = gradient();
    let best = -1;
    for (let i = 0; i < n; i++) if (!passive[i] && w[i] > 1e-9 && (best < 0 || w[i] > w[best])) best = i;
    if (best < 0) break;
    passive[best] = true;
    for (let inner = 0; inner < 3 * n; inner++) {
      const set = passive.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
      const z = solve(set);
      if (z.every((value) => value > 0)) {
        set.forEach((i, k) => (x[i] = z[k]));
        break;
      }
      let alpha = 1;
      set.forEach((i, k) => {
        if (z[k] <= 0) alpha = Math.min(alpha, x[i] / (x[i] - z[k] || 1e-12));
      });
      set.forEach((i, k) => {
        x[i] += alpha * (z[k] - x[i]);
        if (x[i] <= 1e-12) {
          x[i] = 0;
          passive[i] = false;
        }
      });
    }
  }
  return x;
};

/**
 * This knitter's cost per operation, fitted to the timed gaps. Each cost is
 * pulled towards typical as if `strength` more of it had been seen at exactly
 * that, so a handful of taps can't make a purl cost nothing.
 */
export const fitCosts = (observations: Observation[], prefix: Prefix, strength = 400): Costs => {
  const n = columns.length;
  const ata = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const atb = new Array<number>(n).fill(0);
  for (const o of observations) {
    if (o.ms === undefined) continue;
    const row = [...prefix.counts(o.from, o.to), 1];
    const y = o.ms / 1000;
    for (let i = 0; i < n; i++) {
      if (!row[i]) continue;
      atb[i] += row[i] * y;
      for (let j = 0; j < n; j++) ata[i][j] += row[i] * row[j];
    }
  }
  columns.forEach((column, i) => {
    ata[i][i] += strength;
    atb[i] += strength * typical[column];
  });
  const x = nnls(ata, atb);
  return Object.fromEntries(columns.map((column, i) => [column, x[i]])) as Costs;
};

/** A sitting: from its first tap to its last. */
export interface Sitting {
  start: number;
  end: number;
}

/** Taps more than this apart are in different sittings. */
const sittingGap = 30 * 60_000;

export interface TimeSummary {
  /** Seconds spent knitting, breaks left out. */
  knitted: number;
  sittings: Sitting[];
  /** Days a sitting began on, in the device's own time zone. */
  days: number;
  /** Stitches a minute, over the timed gaps. */
  perMinute?: number;
  /** Seconds of knitting left, as a likely figure and a range; unknown until there is enough to go on. */
  left?: { low: number; mid: number; high: number };
}

/** How far out time left tends to be, by how far through the knitting, from the simulations. */
const spread = (fraction: number) => (fraction < 0.2 ? 0.15 : fraction < 0.4 ? 0.1 : fraction < 0.7 ? 0.07 : 0.05);

/** Enough timed knitting to say anything about the rest. */
const enough = { stitches: 300, seconds: 10 * 60 };

export const summarise = (actions: Action[], stitches: Stitch[], progress: number): TimeSummary | undefined => {
  if (actions.length === 0) return undefined;
  const prefix = prefixFor(stitches);
  const { observations: raw, otherMs } = observe(actions, prefix);
  const observations = clamp(raw, prefix);
  const costs = fitCosts(observations, prefix);

  let knittedMs = otherMs;
  let timedMs = 0;
  let timedStitches = 0;
  let timedTaps = 0;
  for (const o of observations) {
    if (o.ms === undefined) knittedMs += predict(prefix, costs, o.from, o.to) * 1000;
    else {
      knittedMs += o.ms;
      timedMs += o.ms;
      timedStitches += o.to - o.from;
      timedTaps++;
    }
  }

  const sittings: Sitting[] = [];
  for (const { t } of actions) {
    const open = sittings.at(-1);
    if (!open || t - open.end > sittingGap || t < open.end) sittings.push({ start: t, end: t });
    else open.end = t;
  }
  // By when each sitting began, so an evening that runs past midnight is one day.
  const days = new Set(sittings.map(({ start }) => new Date(start).toDateString())).size;

  const last = prefix.last;
  let left: TimeSummary["left"];
  if (progress < last && timedStitches >= enough.stitches && timedMs >= enough.seconds * 1000) {
    const fraction = progress / last;
    /*
     * The flat rate only for the first few per cent, then the fitted costs.
     *
     * The hat site's simulations found a flat rate best for most of a hat,
     * whose knitting is much the same from brim to crown. A sweater's is not:
     * its first third is ribbing and colourwork, with a change of yarn every
     * few stitches, and its last two thirds plain stocking stitch, so a rate
     * taken from the yoke says the body will take half as long again as it
     * does. The fitted costs know what is left is mostly plain, and by a few
     * per cent through there are thousands of taps to fit them from.
     */
    const flat = (timedMs / 1000 / timedStitches) * (last - progress);
    const perTap = timedStitches / Math.max(timedTaps, 1);
    const fitted = predict(prefix, costs, progress, last, (last - progress) / Math.max(perTap, 1));
    const w = Math.min(1, Math.max(0, (fraction - 0.03) / 0.07));
    const mid = (1 - w) * flat + w * fitted;
    const e = spread(fraction);
    left = { low: mid * (1 - e), mid, high: mid * (1 + e) };
  }

  return {
    knitted: knittedMs / 1000,
    sittings,
    days,
    perMinute: timedMs > 0 ? timedStitches / (timedMs / 60_000) : undefined,
    left,
  };
};
