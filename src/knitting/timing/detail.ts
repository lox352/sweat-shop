/**
 * The finer grain behind the summary, for exploring it: roughly how long each
 * stitch took, each round, which sitting each stitch was knitted in, and the
 * knitter's own cost for each kind of stitch.
 *
 * A tap is rarely one stitch, so a stitch's own time is a share of its tap's,
 * split by what each stitch should cost at the knitter's fitted costs. Alone
 * that mostly redraws the pattern; averaged over the 30 stitches around it,
 * it follows the knitter's real pace (see the explore branch).
 */
import { Stitch, isFabric } from "../../types/Stitch";
import type { Action } from "./log";
import {
  Costs,
  Observation,
  cancelledBy,
  clamp,
  columns,
  fitCosts,
  observe,
  prefixFor,
  predict,
  type Column,
  type Sitting,
} from "./model";

export interface TimeDetail {
  /** Seconds each stitch took, roughly; NaN where not reached, or reached untimed. */
  perStitch: Float64Array;
  /** The same, averaged over the 30 stitches around each, in knitting order. */
  smooth: Float64Array;
  /** How many stitches the tap each stitch came in covered. */
  tapSpan: Float64Array;
  /** The median of `smooth`: this knitter's usual seconds a stitch. */
  usual: number;
  /** Seconds each round took, of what was timed, and how many of its stitches were. */
  perRound: { seconds: number; timed: number; stitches: number }[];
  /** Which sitting each stitch was reached in; -1 where not. */
  sittingOf: Int32Array;
  sittings: Sitting[];
  /** When each stitch was reached, ms since 1970. */
  reachedAt: Float64Array;
  costs: Costs;
  /** How many of each operation the timed taps covered: how much a cost has to go on. */
  seen: Record<Column, number>;
}

/** A running average over `size` stitches centred on each, in the order they are knitted. */
export const windowed = (values: ArrayLike<number>, order: number[], size: number): Float64Array => {
  const out = new Float64Array(values.length).fill(NaN);
  const sums = new Float64Array(order.length + 1);
  const counts = new Float64Array(order.length + 1);
  order.forEach((id, i) => {
    const v = values[id];
    const ok = Number.isFinite(v);
    sums[i + 1] = sums[i] + (ok ? v : 0);
    counts[i + 1] = counts[i] + (ok ? 1 : 0);
  });
  order.forEach((id, i) => {
    if (!Number.isFinite(values[id])) return;
    const lo = Math.max(0, i - Math.floor(size / 2));
    const hi = Math.min(order.length - 1, lo + size - 1);
    const n = counts[hi + 1] - counts[lo];
    if (n > 0) out[id] = (sums[hi + 1] - sums[lo]) / n;
  });
  return out;
};

const median = (values: ArrayLike<number>) => {
  const sorted = Array.from(values).filter(Number.isFinite).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? NaN;
};

export const detail = (actions: Action[], stitches: Stitch[], rounds: number[][]): TimeDetail => {
  const prefix = prefixFor(stitches);
  const observations: Observation[] = clamp(observe(actions, prefix).observations, prefix);
  const costs = fitCosts(observations, prefix);
  const size = stitches.length;

  const perStitch = new Float64Array(size).fill(NaN);
  const tapSpan = new Float64Array(size).fill(NaN);
  const seen = Object.fromEntries(columns.map((c) => [c, 0])) as Record<Column, number>;
  for (const o of observations) {
    if (o.ms === undefined) continue;
    seen.tap++;
    prefix.counts(o.from, o.to).forEach((n, i) => (seen[columns[i]] += n));
    const weights: number[] = [];
    for (let id = o.from + 1; id <= o.to; id++) weights.push(predict(prefix, costs, id - 1, id, 0));
    const total = weights.reduce((s, w) => s + w, 0) || 1;
    weights.forEach((w, k) => {
      perStitch[o.from + 1 + k] = (o.ms! / 1000) * (w / total);
      tapSpan[o.from + 1 + k] = o.to - o.from;
    });
  }
  const order = stitches.filter(isFabric).map((s) => s.id);
  const smooth = windowed(perStitch, order, 30);

  const perRound = rounds.map((ids) => {
    let seconds = 0;
    let timed = 0;
    for (const id of ids) {
      if (Number.isFinite(perStitch[id])) {
        seconds += perStitch[id];
        timed++;
      }
    }
    return { seconds, timed, stitches: ids.length };
  });

  // Sittings, and which each stitch was reached in, going forwards.
  const sittings: Sitting[] = [];
  const sittingOf = new Int32Array(size).fill(-1);
  const reachedAt = new Float64Array(size).fill(NaN);
  // Changes that were undone never happened; going back unpicks what it passes.
  const cancelled = cancelledBy(actions);
  actions.forEach((a, i) => {
    if (cancelled.has(i)) return;
    const open = sittings.at(-1);
    if (!open || a.t - open.end > 30 * 60_000 || a.t < open.end) sittings.push({ start: a.t, end: a.t });
    else open.end = a.t;
    if (a.untimed) return;
    if (a.to < a.from) {
      sittingOf.fill(-1, Math.max(a.to + 1, 0), Math.min(a.from + 1, size));
      reachedAt.fill(NaN, Math.max(a.to + 1, 0), Math.min(a.from + 1, size));
      return;
    }
    for (let id = Math.max(a.from + 1, 0); id <= Math.min(a.to, size - 1); id++) {
      sittingOf[id] = sittings.length - 1;
      reachedAt[id] = a.t;
    }
  });

  return { perStitch, smooth, tapSpan, usual: median(smooth), perRound, sittingOf, sittings, reachedAt, costs, seen };
};
