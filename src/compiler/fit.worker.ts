import { asEdition } from "../library/editions/own";
import type { FitAnswer, FitQuestion } from "../library/fit";
import { fit, fitOptions, startAfter } from "./fit";

/**
 * The fitting, in a worker: the one way a page reaches the compiler, and
 * only when a knitter asks for the rest of their sweater to be worked out
 * again (see library/fit). The page waits on it without stopping.
 */
const scope = self as unknown as { postMessage(answer: FitAnswer): void; onmessage: ((event: MessageEvent<FitQuestion>) => void) | null };

scope.onmessage = async ({ data: { design, sizeId, knitted, progress = 0, tension, round: known, option: only, earlier } }) => {
  // Part knitted: the round the last stitch worked is in - finished as it is charted, where it is part worked - and the first from there the design
  // can plan on from. Nothing knitted: the whole of it.
  let round: number | undefined;
  if (knitted) {
    // Made again as it was made, the round is the one it was planned from then, and no other will do.
    const at = known ?? knitted.rounds.findIndex((ids) => ids[ids.length - 1] >= progress) + 1;
    round = startAfter(design, knitted, Math.max(1, at));
    if (known !== undefined && round !== known) round = undefined;
    if (round === undefined) {
      return scope.postMessage({ cannot: "The rest of this pattern can't be worked out again from where you are: it is too late in the knitting, or this design can't be." });
    }
  }
  /*
   * Every way the design can lay the rest out, each said as it is done: one
   * that can't be is no reason to go without the others. They are ways of
   * laying out the rest of one part knitted - what to do with the years that
   * no longer fit as they were. From the cast-on there is nothing to make up
   * for, and one way: the design's own.
   */
  const options = fitOptions(design).map((option) => option.id);
  if (only !== undefined && !options.includes(only)) return scope.postMessage({ cannot: "This pattern can't be worked out that way: the design no longer has it." });
  // Or the one way it was laid out, where it is being made again as it was.
  const ways: (string | undefined)[] = only !== undefined ? [only] : knitted && options.length > 0 ? options : [undefined];
  let found = 0;
  for (const [nth, option] of ways.entries()) {
    try {
      let told = 0;
      const fitted = fit({ design, sizeId, knitted, round, tension, option, ...(earlier ? { earlier } : {}) }, (fraction) => {
        // A hundred steps is all a progress bar shows.
        const overall = (nth + fraction) / ways.length;
        if (overall - told >= 0.01) scope.postMessage({ progress: (told = overall) });
      });
      const file = await asEdition(fitted.knitted, design, sizeId);
      scope.postMessage({ fitted: { file, ...(round === undefined ? {} : { round }), tension, finished: fitted.finished, notes: fitted.notes, written: fitted.written, ...(option ? { option } : {}), ...(fitted.placement ? { placement: fitted.placement } : {}) } });
      found++;
    } catch (error) {
      const why = `The rest could not be worked out: ${error instanceof Error ? error.message : String(error)}.`;
      if (option === undefined || (found === 0 && nth === ways.length - 1)) return scope.postMessage({ cannot: why });
      scope.postMessage({ cannot: why, option });
    }
  }
  scope.postMessage({ done: true });
};
