import type { Design, Measurements, Tension } from "../pattern/design";
import type { SweaterStitches } from "../pattern/knitted";
import type { EditionFile } from "./editions/format";

/**
 * The rest of a sweater worked out again for its knitter, on their device.
 *
 * Everything else the site shows of a pattern is an edition, worked out once
 * for everybody and read; nothing a page loads can work one out. This is the
 * one exception, and a deliberate one: a knitter whose tension is not the
 * pattern's asks, once, for the rest to be planned for the stitches on their
 * needles, and it is - by the design's own planner, in a worker fetched when
 * they ask and not before (see compiler/fit.worker). It can take a while, and
 * the page says so; what comes back is an edition of the project's own (see
 * editions/own), and what the knitter is shown before they take it.
 */

export interface FitQuestion {
  design: string;
  sizeId: string;
  /** The knitting in hand, and how many of its stitches are worked. */
  knitted: SweaterStitches;
  progress: number;
  /** The knitter's own tension. */
  tension: Tension;
  /** Which of the design's ways of laying the rest out: see Design.fitting. */
  option?: string;
}

export interface Fitted {
  /** The whole sweater - the rounds knitted, and the rest - as an edition. */
  file: EditionFile;
  /** The round the rest begins after: where the knitter is, or the first after it the design can plan on from. */
  round: number;
  tension: Tension;
  /** What it will measure. */
  finished: Measurements;
  /** What the knitter should know of it, a sentence each. */
  notes: string[];
  /** The rest, written out as a pattern. */
  written: string;
  option?: string;
}

/**
 * Whether the rest of a knitting might still be worked out again: its design
 * can be, and nothing is on hold yet - the whole sweater is still one round
 * on the needles. The design has the last word, when it is asked.
 */
export const mayFit = (design: Design, knitted: SweaterStitches, progress: number): boolean =>
  !!design.fitting && !knitted.holds.some((held) => held.heldAt <= progress);

/** What the worker says back: how far it has got, then the fit, or why there is none. */
export type FitAnswer = { progress: number } | { fitted: Fitted } | { cannot: string };

/**
 * Ask for the rest of a sweater at a knitter's tension. `progress` is told
 * how far the working out has got, from 0 to 1. Rejects, with something to
 * say to the knitter, where it can't be done.
 */
export const askForFit = (question: FitQuestion, progress?: (fraction: number) => void): { fitted: Promise<Fitted>; cancel: () => void } => {
  const worker = new Worker(new URL("../compiler/fit.worker.ts", import.meta.url), { type: "module" });
  const fitted = new Promise<Fitted>((resolve, reject) => {
    worker.onmessage = ({ data }: MessageEvent<FitAnswer>) => {
      if ("progress" in data) return progress?.(data.progress);
      worker.terminate();
      if ("fitted" in data) resolve(data.fitted);
      else reject(new Error(data.cannot));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error("The rest could not be worked out: the part of the site that does it could not be fetched. Check your connection and try again."));
    };
  });
  worker.postMessage(question);
  return { fitted, cancel: () => worker.terminate() };
};
