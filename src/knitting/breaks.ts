import { type Stitch, isFabric } from "../types/Stitch";
import type { RowIndex } from "./column-window";
import type { ChartLayout } from "./layout";

/**
 * Where a chart puts two stitches of one round side by side that are not
 * worked one after the other.
 *
 * A view leaves stitches out: the Body view the sleeves' part of the yoke,
 * the view from the neck the underarms' cast-on. Below the underarm the
 * back's last stitch and the front's first then stand next to each other on
 * the chart, with a sleeve's worth of stitches between them on the needles,
 * and the colourwork looks as if it runs straight across. The chart tears
 * the two apart there: see chart-painter, and the room tile-view keeps.
 */
export interface Break {
  /** The columns of the stitches either side: the one on the right, worked first, and the one on its left. */
  right: number;
  left: number;
  /** The rows it runs through, from the lowest. */
  from: number;
  to: number;
  /** How many stitches are worked between the two, in its lowest row: the stitches the chart leaves out. */
  between: number;
}

/** Whether `a` and `b` are worked one straight after the other, either way round, past any steps between. */
const neighbours = (stitches: Stitch[], a: number, b: number): boolean => {
  const [first, second] = a < b ? [a, b] : [b, a];
  let at = second - 1;
  while (at > first && !isFabric(stitches[at])) at--;
  return at === first;
};

export const breaksIn = (index: RowIndex, layout: ChartLayout, stitches: Stitch[]): Break[] => {
  const found: Break[] = [];
  const open = new Map<string, Break>();
  for (let row = 1; row <= index.rows; row++) {
    for (let k = index.start[row]; k < index.start[row + 1] - 1; k++) {
      const [a, b] = [index.id[k], index.id[k + 1]];
      const [one, other] = [layout.cells.get(a), layout.cells.get(b)];
      if (!one || !other || one.round !== other.round || one.piece !== other.piece) continue;
      if (neighbours(stitches, a, b)) continue;
      const [right, left] = [index.column[k], index.column[k + 1]];
      // Only where every stitch between them is left out of this chart: a short row's two ends, its turn between, are not torn apart.
      let between = 0;
      let drawn = false;
      for (let id = Math.min(a, b) + 1; id < Math.max(a, b) && !drawn; id++) {
        if (!isFabric(stitches[id])) continue;
        between++;
        drawn = layout.cells.has(id);
      }
      if (drawn || between === 0) continue;
      const key = `${right}:${left}`;
      const known = open.get(key);
      if (known && known.to === row - 1) {
        known.to = row;
        continue;
      }
      const fresh = { right, left, from: row, to: row, between };
      open.set(key, fresh);
      found.push(fresh);
    }
  }
  return found;
};
