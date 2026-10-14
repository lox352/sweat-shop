import { Stitch } from "../types/Stitch";
import { ChartLayout } from "./layout";
import { cellAt } from "./draw-chart";

/** Return the last worked id immediately before the requested next stitch. */
export function progressBefore(stitches: Stitch[], rounds: number[][], round: number, stitch: number) {
  const ids = rounds[round - 1];
  if (!Number.isInteger(round) || !Number.isInteger(stitch) || !ids || stitch < 1 || stitch > ids.length) {
    throw new Error("Choose a valid round and stitch within that round.");
  }
  let id = ids[stitch - 1];
  if (stitches[id]?.type === "m1" && stitches[id - 1]?.type === "kfb") id--;
  return id - 1;
}

/**
 * Which stitch, if any, is drawn at a point on the chart: in the row under
 * it, of whichever round is drawn there - above the divide a row holds a
 * round of the body and one of each sleeve.
 */
export const stitchAtPoint = (
  layout: ChartLayout,
  rounds: number[][],
  cell: number,
  x: number,
  y: number,
): number | undefined => {
  const row = layout.rows - Math.floor(y / cell);
  for (let index = 0; index < rounds.length; index++) {
    if ((layout.roundRows[index] ?? index + 1) !== row) continue;
    const found = rounds[index].find((id) => {
      const at = layout.cells.get(id);
      if (!at) return false;
      const left = cellAt(layout, at.row, at.column, cell).x;
      return x >= left && x < left + cell;
    });
    if (found !== undefined) return found;
  }
  return undefined;
};
