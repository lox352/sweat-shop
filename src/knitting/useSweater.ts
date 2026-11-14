import { useMemo } from "react";
import type { Design } from "../data/sweaters/types";
import { askAgain, editionFailed, editionKnitting, isSuperseded, loadEdition } from "../data/sweaters/editions";
import { type SweaterStitches } from "./knitted";
import { type ChartLayout, layOutSweater } from "./layout";
import { type RoundIndex, indexRounds } from "./progress";
import { holdRegions } from "./holds";
import { type MarkerLine, type View, beginningAt, viewFor } from "./view";
import { markersPassed } from "./marker-routes";
import { type ChartView, chartViews, layOutView, markersInView, viewFollowedAt } from "./views";

/**
 * For the tests alone, which knit the designs as they are in hand: see
 * test-setup. Nothing a browser loads can work a pattern out.
 */
type InHand = (design: Design, sizeId?: string) => SweaterStitches;
let inHand: InHand | undefined;
export const knitInHand = (knit: InHand) => {
  inHand = knit;
};

/** A size's knitting could not be fetched. Thrown by useKnitting, for KnittingBoundary to say so. */
export class NoKnitting extends Error {}

/** Forget what could not be had, so that it is asked for again. */
export const retryKnitting = askAgain;

/** A size's knitting, if it is to hand: its frozen copy, fetched - the size's edition now, or the one a project is on. */
export const knittingToHand = (pattern: Design, sizeId?: string, edition?: string): SweaterStitches | undefined =>
  (sizeId ? editionKnitting(pattern.id, sizeId, edition) : undefined) ??
  // In hand is the size as it is now, never an edition it has moved on from.
  (inHand && !(sizeId && isSuperseded(pattern.id, sizeId, edition)) ? inHand(pattern, sizeId) : undefined);

/** A size's knitting, which a caller has waited for: see whenKnitting and useKnitting. */
export const sweaterStitches = (pattern: Design, sizeId?: string, edition?: string): SweaterStitches => {
  const knitting = knittingToHand(pattern, sizeId, edition);
  if (!knitting) throw new Error(`${pattern.id} ${sizeId ?? ""}: its knitting has not been fetched`);
  return knitting;
};

/** The fetching of a size's knitting: rejects where it cannot be had. */
export const whenKnitting = async (pattern: Design, sizeId: string, edition?: string): Promise<SweaterStitches> =>
  knittingToHand(pattern, sizeId, edition) ?? loadEdition(pattern.id, sizeId, edition);

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
export const countedAt = (pattern: Design, built: SweaterStitches, progress: number) => {
  const beginning = beginningAt(built, progress);
  let kept = counts.get(built);
  if (!kept) counts.set(built, (kept = new Map()));
  let counted = kept.get(beginning);
  if (!counted) {
    const view = viewFor(built, () => seamLayout(built), beginning);
    const index = indexRounds(view.rounds, view.labels, view.pieces, pattern.pieces, view.kinds, view.rows);
    // Every run stops at a marker part way along: see markersPassed.
    index.markerAfter = markersPassed(built);
    counted = { view, index };
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

/**
 * A size's knitting, for a component: suspended, under the nearest Suspense,
 * while its frozen copy is fetched, and NoKnitting, for the nearest
 * KnittingBoundary, where it cannot be.
 */
export const useKnitting = (pattern: Design, sizeId: string, edition?: string) => {
  const knitting = knittingToHand(pattern, sizeId, edition);
  if (!knitting) {
    if (editionFailed(pattern.id, sizeId, edition)) throw new NoKnitting(`${pattern.id} ${sizeId}`);
    // Either way it settles, and the page is drawn again to find which.
    throw loadEdition(pattern.id, sizeId, edition).then(() => undefined, () => undefined);
  }
  return knitting;
};

/** A sweater, and its rounds as the knitter counts them once `progress` stitches are worked: see countedAt. */
export const useSweater = (pattern: Design, sizeId: string, progress = 0, edition?: string) => {
  const built = useKnitting(pattern, sizeId, edition);
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
export const defaultSize = (pattern: Design) =>
  pattern.sizes.reduce((best, size) =>
    Math.abs(size.toFitChestCm - 96) < Math.abs(best.toFitChestCm - 96) ? size : best,
  );
