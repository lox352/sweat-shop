import { useEffect, useMemo, useState } from "react";
import type { Design } from "../data/sweaters/types";
import { askAgain, compiledKnitting, editionMissing, frozenEdition, isSuperseded, loadEdition, prepareKnitting } from "../data/sweaters/editions";
import { type SweaterStitches } from "./knitted";
import { type ChartLayout, layOutSweater } from "./layout";
import { type RoundIndex, indexRounds } from "./progress";
import { holdRegions } from "./holds";
import { type MarkerLine, type View, beginningAt, viewFor } from "./view";
import { markersPassed } from "./marker-routes";
import { type ChartView, chartViews, layOutView, markersInView, viewFollowedAt } from "./views";

/**
 * What works a pattern out, where it is loaded: see builder.ts, which is most
 * of the weight a page would otherwise carry, and is fetched only when a
 * pattern has to be worked out here.
 */
type Builder = (design: Design, sizeId?: string) => SweaterStitches;
let builder: Builder | undefined;
export const setBuilder = (build: Builder) => {
  builder = build;
};
let loadingBuilder: Promise<void> | undefined;
/** Whether it was asked for and could not be had. */
let noBuilder = false;
/** Never rejects: a page that waits on it then finds whether its knitting can be had. */
const loadBuilder = () =>
  (loadingBuilder ??= import("./builder").then(
    () => undefined,
    () => {
      noBuilder = true;
      loadingBuilder = undefined;
    },
  ));

/**
 * A size's knitting can be had no way: its frozen copy could not be fetched,
 * and nor could what works a pattern out. Offline, in a browser that keeps
 * nothing of the site. Thrown by useKnitting, for KnittingBoundary to say so.
 */
export class NoKnitting extends Error {}

/** Forget what could not be had, so that it is asked for again. */
export const retryKnitting = () => {
  noBuilder = false;
  askAgain();
};

/** Patterns worked out here, kept: the same answer every time for a design and size. */
const cache = new Map<string, SweaterStitches>();

/**
 * A size's knitting: from its frozen copy where that has been fetched - the
 * size's edition now, or the one a project is on that the size has moved on
 * from - and otherwise worked out here, as the size is now. See
 * whenKnittable, which a caller waits on first, and data/sweaters/editions.
 */
export const sweaterStitches = (pattern: Design, sizeId?: string, edition?: string): SweaterStitches => {
  const frozen = sizeId && compiledKnitting(pattern.id, sizeId, edition);
  if (frozen) return frozen;
  const key = `${pattern.id}::${sizeId ?? ""}`;
  const cached = cache.get(key);
  if (cached) return cached;
  if (!builder) throw new Error(`${pattern.id} ${sizeId ?? ""}: its knitting has not been fetched, nor what works it out`);
  const built = builder(pattern, sizeId);
  cache.set(key, built);
  return built;
};

/** Whether a size's knitting can be had at once: see whenKnittable. */
export const knittable = (pattern: Design, sizeId?: string, edition?: string): boolean =>
  !!builder || !!(sizeId && compiledKnitting(pattern.id, sizeId, edition)) || cache.has(`${pattern.id}::${sizeId ?? ""}`);

/**
 * What to wait for before a size's knitting can be had, or undefined once it
 * can: its frozen copy, or, where that cannot be fetched, what works a
 * pattern out here.
 */
export const whenKnittable = (pattern: Design, sizeId?: string, edition?: string): Promise<void> | undefined => {
  const copy = sizeId && prepareKnitting(pattern.id, sizeId, edition);
  if (copy) return copy;
  return knittable(pattern, sizeId, edition) || noBuilder ? undefined : loadBuilder();
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
 * Whether an edition's knitting is ready to build from. At once, unless it is
 * one a size has moved on from and its frozen copy has still to be fetched,
 * which this starts: "loading" until it comes, and "failed" if it cannot be
 * reached, with `retry` to try again. An edition the site has no copy of is
 * ready too, and knitted as the size is now.
 */
export const useEditionReady = (
  design: string | undefined,
  size: string | undefined,
  edition: string | undefined,
): { state: "ready" | "loading" | "failed"; retry: () => void } => {
  const needed = !!design && !!size && isSuperseded(design, size, edition);
  const ready = !needed || !!frozenEdition(design!, size!, edition!) || editionMissing(design!, size!, edition!);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [, fetched] = useState(0);
  useEffect(() => {
    if (!needed || ready) return;
    let open = true;
    setFailed(false);
    loadEdition(design!, size!, edition!).then(
      () => open && fetched((n) => n + 1),
      () => open && setFailed(true),
    );
    return () => {
      open = false;
    };
  }, [design, size, edition, needed, ready, attempt]);
  return { state: ready ? "ready" : failed ? "failed" : "loading", retry: () => setAttempt((n) => n + 1) };
};

/**
 * A size's knitting, for a component: suspended, under the nearest Suspense,
 * while its frozen copy is fetched, so that the published site never works a
 * pattern out where it can fetch the answer. See editions' prepareKnitting.
 */
export const useKnitting = (pattern: Design, sizeId?: string, edition?: string) => {
  const waiting = whenKnittable(pattern, sizeId, edition);
  if (waiting) throw waiting;
  if (!knittable(pattern, sizeId, edition)) throw new NoKnitting(`${pattern.id} ${sizeId ?? ""}`);
  return useMemo(() => sweaterStitches(pattern, sizeId, edition), [pattern, sizeId, edition]);
};

/** A sweater, and its rounds as the knitter counts them once `progress` stitches are worked: see countedAt. */
export const useSweater = (pattern: Design, sizeId?: string, progress = 0, edition?: string) => {
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
