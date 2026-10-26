import { useMemo } from "react";
import { SweaterPattern } from "../data/sweaters/types";
import { type SweaterStitches, buildSweater } from "./engine";
import { type ChartLayout, layOutSweater } from "./layout";
import { type RoundIndex, indexRounds } from "./progress";
import { holdRegions } from "./holds";
import { type MarkerLine, type View, beginningAt, viewFor } from "./view";
import { type ChartView, chartViews, layOutView, markersInView, viewFollowedAt } from "./views";

/**
 * A sweater's stitches and rounds, for a size.
 *
 * Building them is pure and quick enough - eighty thousand small objects for
 * a medium - but it is the same answer every time for a given design and
 * size, and the home page, the design page and a project all ask for it, so
 * it is worth keeping. Colourways share the knitting completely.
 */
const cache = new Map<string, ReturnType<typeof buildSweater>>();

export const sweaterStitches = (pattern: SweaterPattern, sizeId?: string) => {
  const key = `${pattern.id}::${sizeId ?? ""}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const built = buildSweater(pattern, sizeId);
  cache.set(key, built);
  return built;
};

/**
 * The rounds of the first piece knitted - for a top-down sweater, the yoke,
 * whose bands are what the strips on the cards and the colourway picker
 * show.
 */
export const yokeRounds = (built: { rounds: number[][]; roundPieces: string[] }): number[][] =>
  built.rounds.filter((_, index) => built.roundPieces[index] === built.roundPieces[0]);

/**
 * The chart laid out from the rounds as worked from the seam, once a design
 * and size, as the stitches are: see view, which only turns it and cuts its
 * rows again where the beginning of the round has moved.
 */
const layouts = new WeakMap<SweaterStitches, ChartLayout>();
export const seamLayout = (built: SweaterStitches): ChartLayout => {
  let layout = layouts.get(built);
  if (!layout) {
    const { stitches, knitting } = built;
    layout = layOutSweater(stitches, knitting.rounds, knitting.roundKinds, knitting.roundPieces);
    layouts.set(built, layout);
  }
  return layout;
};

/**
 * A sweater's rounds as the knitter counts them once `progress` stitches are
 * worked - cut at the beginning of the round in force, which a pattern may
 * move part way through - and what the knitting panel and the project's
 * pages read them by. See view. Kept once a design, size and beginning: a
 * pattern places very few.
 */
const counts = new WeakMap<SweaterStitches, Map<number | undefined, { view: View; index: RoundIndex }>>();
export const countedAt = (pattern: SweaterPattern, built: SweaterStitches, progress: number) => {
  const beginning = beginningAt(built, progress);
  let kept = counts.get(built);
  if (!kept) counts.set(built, (kept = new Map()));
  let counted = kept.get(beginning);
  if (!counted) {
    const view = viewFor(built, () => seamLayout(built), beginning);
    counted = { view, index: indexRounds(view.rounds, view.labels, view.pieces, pattern.pieces, view.kinds, view.rows) };
    kept.set(beginning, counted);
  }
  return counted;
};

/**
 * One of the chart's views, as the knitting counts it: its chart, and the
 * markers on it. See knitting/views. Kept once a view and a beginning.
 */
const charts = new WeakMap<View, Map<string, { layout: ChartLayout; markers: MarkerLine[] }>>();
export const viewChart = (built: SweaterStitches, counted: View, view: ChartView) => {
  let kept = charts.get(counted);
  if (!kept) charts.set(counted, (kept = new Map()));
  let chart = kept.get(view.id);
  if (!chart) {
    const edge = built.holds.find((held) => view.kind === "held" && held.holder === view.holder)?.edge;
    const { layout, boundary, column } = layOutView(view, counted.layout, built, edge);
    chart = { layout, markers: markersInView(counted.markers, boundary, column) };
    kept.set(view.id, chart);
  }
  return chart;
};

/** A sweater, and its rounds as the knitter counts them once `progress` stitches are worked: see countedAt. */
export const useSweater = (pattern: SweaterPattern, sizeId?: string, progress = 0) => {
  const built = useMemo(() => sweaterStitches(pattern, sizeId), [pattern, sizeId]);
  const { view, index } = countedAt(pattern, built, progress);
  const yoke = useMemo(() => yokeRounds(built), [built]);
  const holds = useMemo(() => holdRegions(built.stitches, built.holds), [built]);
  const views = useMemo(() => chartViews(built, pattern.pieces), [built, pattern]);
  const following = viewFollowedAt(views, built, progress);
  return { ...built, index, yoke, holdRegions: holds, view, views, following };
};

/**
 * The size to show first: the one made for a chest nearest an average
 * adult's, rather than whichever happens to be in the middle of the list.
 */
export const defaultSize = (pattern: SweaterPattern) =>
  pattern.sizes.reduce((best, size) =>
    Math.abs(size.toFitChestCm - 96) < Math.abs(best.toFitChestCm - 96) ? size : best,
  );
