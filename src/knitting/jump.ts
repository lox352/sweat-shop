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

/** Which stitch, if any, is drawn at a point on the chart. */
export const stitchAtPoint = (
  layout: ChartLayout,
  rounds: number[][],
  cell: number,
  x: number,
  y: number,
): number | undefined => {
  const round = layout.rounds - Math.floor(y / cell);
  const ids = rounds[round - 1];
  if (!ids) return undefined;
  return ids.find((id) => {
    const at = layout.cells.get(id);
    if (!at) return false;
    const left = cellAt(layout, at.round, at.column, cell).x;
    return x >= left && x < left + cell;
  });
};
