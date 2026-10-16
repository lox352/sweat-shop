import { Stitch } from "../types/Stitch";
import { makesTwo } from "../types/StitchType";

/** Return the last worked id immediately before the requested next stitch. */
export function progressBefore(stitches: Stitch[], rounds: number[][], round: number, stitch: number) {
  const ids = rounds[round - 1];
  if (!Number.isInteger(round) || !Number.isInteger(stitch) || !ids || stitch < 1 || stitch > ids.length) {
    throw new Error("Choose a valid round and stitch within that round.");
  }
  let id = ids[stitch - 1];
  if (stitches[id]?.type === "m1" && makesTwo(stitches[id - 1]?.type)) id--;
  return id - 1;
}
