import { asEdition } from "../library/editions/own";
import type { FitAnswer, FitQuestion } from "../library/fit";
import { cutAfter, fit } from "./fit";

/**
 * The fitting, in a worker: the one way a page reaches the compiler, and
 * only when a knitter asks for the rest of their sweater to be worked out
 * again (see library/fit). The page waits on it without stopping.
 */
const scope = self as unknown as { postMessage(answer: FitAnswer): void; onmessage: ((event: MessageEvent<FitQuestion>) => void) | null };

scope.onmessage = async ({ data: { design, sizeId, knitted, progress, tension, option } }) => {
  try {
    // The round the last stitch worked is in, and the first from there the design can plan on from.
    const at = knitted.rounds.findIndex((ids) => ids[ids.length - 1] >= progress) + 1;
    const round = cutAfter(design, knitted, Math.max(1, at));
    if (round === undefined) {
      return scope.postMessage({ cannot: "The rest of this pattern can't be worked out again from where you are: it is too late in the knitting, or this design can't be." });
    }
    let told = 0;
    const fitted = fit({ design, sizeId, knitted, round, tension, option }, (fraction) => {
      // A hundred steps is all a progress bar shows.
      if (fraction - told >= 0.01) scope.postMessage({ progress: (told = fraction) });
    });
    const file = await asEdition(fitted.knitted, design, sizeId);
    scope.postMessage({ fitted: { file, round, tension, finished: fitted.finished, notes: fitted.notes, written: fitted.written, ...(option ? { option } : {}) } });
  } catch (error) {
    scope.postMessage({ cannot: `The rest could not be worked out: ${error instanceof Error ? error.message : String(error)}.` });
  }
};
