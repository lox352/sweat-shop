import type { Stitch } from "../pattern/Stitch";
import { startOf } from "./spans";

/** Return the last worked id immediately before the requested next stitch. */
export function progressBefore(stitches: Stitch[], rounds: number[][], round: number, stitch: number) {
  const ids = rounds[round - 1];
  if (!Number.isInteger(round) || !Number.isInteger(stitch) || !ids || stitch < 1 || stitch > ids.length) {
    throw new Error("Choose a valid round and stitch within that round.");
  }
  // Stood at the start of what is done as one, a KFB, whichever of its loops was asked for: see spans.
  return startOf(stitches, ids[stitch - 1]) - 1;
}
