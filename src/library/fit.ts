import type { Design, Measurements, Placement, Tension } from "../pattern/design";
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
  /** The knitting in hand, and how many of its stitches are worked. Neither, for a whole sweater from the cast-on (see Design.fitting). */
  knitted?: SweaterStitches;
  progress?: number;
  /** The knitter's own tension. */
  tension: Tension;
}

export interface Fitted {
  /** The whole sweater - the rounds knitted, and the rest - as an edition. */
  file: EditionFile;
  /** The round the rest begins after: where the knitter is, or the first after it the design can plan on from. None, for a whole sweater from the cast-on. */
  round?: number;
  tension: Tension;
  /** What it will measure. */
  finished: Measurements;
  /** What the knitter should know of it, a sentence each. */
  notes: string[];
  /** The rest, written out as a pattern. */
  written: string;
  option?: string;
  /** Where the bands planned afresh sit, for a design whose colourways follow that: see Placement. */
  placement?: Placement;
}

/**
 * Whether the rest of a knitting might still be worked out again: its design
 * can be, and nothing is on hold yet - the whole sweater is still one round
 * on the needles. The design has the last word, when it is asked.
 */
export const mayFit = (design: Design, knitted: SweaterStitches, progress: number): boolean =>
  !!design.fitting && !knitted.holds.some((held) => held.heldAt <= progress);

/**
 * What the worker says back: how far it has got; each of the design's ways
 * of laying the rest out as it is worked out, or why that one can't be; and
 * that it has done. `cannot` with no option is the whole asking: none can be.
 */
export type FitAnswer = { progress: number } | { fitted: Fitted } | { cannot: string; option?: string } | { done: true };

/** One of a design's ways that could not be worked out, and why. */
export interface Unfitted {
  option?: string;
  why: string;
}

/**
 * Ask for the rest of a sweater at a knitter's tension, every way its design
 * can lay it out. `progress` is told how far the working out has got, from 0
 * to 1, and `fitted` each way as it is done. Resolves, when all are, with
 * those that could not be; rejects, with something to say to the knitter,
 * where none could be asked for at all.
 */
export const askForFit = (
  question: FitQuestion,
  on: { progress?: (fraction: number) => void; fitted: (fitted: Fitted) => void },
): { done: Promise<Unfitted[]>; cancel: () => void } => {
  const worker = new Worker(new URL("../compiler/fit.worker.ts", import.meta.url), { type: "module" });
  const unfitted: Unfitted[] = [];
  const done = new Promise<Unfitted[]>((resolve, reject) => {
    worker.onmessage = ({ data }: MessageEvent<FitAnswer>) => {
      if ("progress" in data) return on.progress?.(data.progress);
      if ("fitted" in data) return on.fitted(data.fitted);
      if ("cannot" in data && data.option !== undefined) return void unfitted.push({ option: data.option, why: data.cannot });
      worker.terminate();
      if ("done" in data) resolve(unfitted);
      else reject(new Error(data.cannot));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error("The rest could not be worked out: the part of the site that does it could not be fetched. Check your connection and try again."));
    };
  });
  worker.postMessage(question);
  return { done, cancel: () => worker.terminate() };
};
