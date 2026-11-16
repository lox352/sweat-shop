import type { Knitting } from "../pattern/knitting";
import type { Progress } from "./solver";
import { defaultTuning } from "./tuning";

/**
 * A sweater settled off the main thread, for one no published shape holds:
 * a knitter's own, worked out for them (see library/fit). Settling is the
 * slowest thing the site does - a minute or two on a laptop, several on a
 * phone - so it runs in a worker, says how far it has got, and can be
 * stopped. It only settles: what is done with the shape - kept, drawn - is
 * the caller's (see ui/useShape).
 */

/** What the worker says: the shape's name first, then how far it has got, then where every stitch came to rest. */
export type SettlingAnswer =
  | { shape: string }
  | { progress: number }
  | { positions: Float32Array; rested: boolean }
  | { failed: string };

export interface SettledNow {
  /** Three numbers a stitch, by id: see solver's Settled. */
  positions: Float32Array;
  /** Whether it came to rest, rather than running out of steps. */
  rested: boolean;
}

/**
 * How far a settling has got, from 0 to 1, by how far its stitches still
 * move. They gather speed as the sweater begins to fall, and from the most
 * they move they slow as it nears rest, by about the same share each step: so
 * the way there is read off the logarithm of how far they move, from that
 * most to the stillness it stops at.
 */
export const progressOf = (most: number, { moved }: Progress, still = defaultTuning.restMovement): number =>
  most <= still || moved <= 0 ? 1 : Math.min(1, Math.max(0, Math.log(most / moved) / Math.log(most / still)));

export const settleInWorker = (
  knitting: Knitting,
  on: { shape?: (name: string) => void; progress?: (fraction: number) => void } = {},
): { settled: Promise<SettledNow>; cancel: () => void } => {
  const worker = new Worker(new URL("./settle.worker.ts", import.meta.url), { type: "module" });
  const settled = new Promise<SettledNow>((resolve, reject) => {
    worker.onmessage = ({ data }: MessageEvent<SettlingAnswer>) => {
      if ("shape" in data) return on.shape?.(data.shape);
      if ("progress" in data) return on.progress?.(data.progress);
      worker.terminate();
      if ("positions" in data) resolve(data);
      else reject(new Error(data.failed));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error("the settling could not be fetched or run"));
    };
  });
  worker.postMessage(knitting);
  return { settled, cancel: () => worker.terminate() };
};
