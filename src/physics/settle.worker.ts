import type { Knitting } from "../pattern/knitting";
import { shapeNameOf } from "./naming";
import { pose } from "./pose";
import { type SettlingAnswer, progressOf } from "./settling";
import { settle } from "./solver";

/**
 * The settling, in a worker: a knitting posed and brought to rest, off the
 * page's own thread. See settling.ts.
 */
const scope = self as unknown as {
  postMessage(answer: SettlingAnswer, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<Knitting>) => void) | null;
};

scope.onmessage = async ({ data: knitting }) => {
  try {
    // Its name first: whoever asked may have the shape already, and stop this here.
    scope.postMessage({ shape: await shapeNameOf(knitting) });
    let most = 0;
    let told = 0;
    const { positions, rested } = settle(knitting, pose(knitting), {}, (progress) => {
      most = Math.max(most, progress.moved);
      const fraction = progressOf(most, progress);
      // A hundred steps is all a progress bar shows, and it never goes back.
      if (fraction - told >= 0.01) scope.postMessage({ progress: (told = fraction) });
    });
    scope.postMessage({ positions, rested }, [positions.buffer]);
  } catch (error) {
    scope.postMessage({ failed: error instanceof Error ? error.message : String(error) });
  }
};
