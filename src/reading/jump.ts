import { Stitch, secondLoop } from "../pattern/Stitch";

/** Return the last worked id immediately before the requested next stitch. */
export function progressBefore(stitches: Stitch[], rounds: number[][], round: number, stitch: number) {
  const ids = rounds[round - 1];
  if (!Number.isInteger(round) || !Number.isInteger(stitch) || !ids || stitch < 1 || stitch > ids.length) {
    throw new Error("Choose a valid round and stitch within that round.");
  }
  let id = ids[stitch - 1];
  if (secondLoop(stitches[id], stitches[id - 1])) id--;
  return id - 1;
}
