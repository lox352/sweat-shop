import { gutter, leftMargin } from "./chart-painter";

/**
 * How far the chart zooms, as the size of a stitch in CSS pixels.
 *
 * From the largest down to `minCell` a stitch is a whole number of pixels,
 * its rules crisp and its symbol drawn. Below that it zooms on out as far as
 * the whole width of the chart fitting the box - every column side by side,
 * a stitch less than a pixel wide on a phone - and no further; or to
 * `minCell` where the chart is narrow enough to fit at that already. Out
 * there a stitch is its colour and little else: see chart-painter.
 */
export const maxCell = 40;
export const minCell = 8;

/** How far apart the two sides of a break are kept, in cells: see tile-view's columnPlaces. */
export const torn = 0.45;

/**
 * How wide the chart is on its sheet at `cell`, with every one of its
 * `columns` showing - as it is with all its rows in view, zoomed right out -
 * and room kept at as many as `breaks` tears: the room for a join's arrow
 * on the left, and for the round numbers on the right.
 */
export const chartWidth = (columns: number, cell: number, breaks = 0) =>
  columns * cell + breaks * Math.round(cell * torn) + leftMargin(cell) + gutter(cell);

/**
 * The largest stitch, to a hundredth of a pixel, at which the chart's whole
 * width fits in `room` pixels: nothing is to scroll across.
 */
export const fitCell = (room: number, columns: number, breaks = 0): number => {
  if (columns <= 0) return minCell;
  let low = 0;
  let high = maxCell;
  for (let step = 0; step < 40; step++) {
    const middle = (low + high) / 2;
    if (chartWidth(columns, middle, breaks) <= room) low = middle;
    else high = middle;
  }
  return Math.floor(low * 100) / 100;
};

/** The least a chart zooms out to: its width fitting the box, or `minCell` where it fits at more than that. */
export const leastCell = (room: number, columns: number, breaks = 0) => Math.max(0.25, Math.min(minCell, fitCell(room, columns, breaks)));

/**
 * A cell size as the chart takes it, between `least` and `maxCell`: a whole
 * number of pixels from `minCell` up, a hundredth of one below, and the
 * least itself when within a few hundredths of it, so that zooming out as
 * far as it goes always ends with the chart fitting the box.
 */
export const settleCell = (cell: number, least: number) => {
  const within = Math.min(maxCell, Math.max(least, cell));
  if (within >= minCell) return Math.round(within);
  if (within <= least * 1.03) return least;
  return Math.max(least, Math.round(within * 100) / 100);
};

/**
 * A press of plus or minus: four pixels a stitch at a time from `minCell`
 * up, and below it by half again or two thirds, down to the least. Out from
 * a little above the least goes all the way to it.
 */
export const stepCell = (cell: number, way: 1 | -1, least: number) => {
  if (way > 0) return settleCell(cell < minCell ? Math.min(minCell, cell * 1.5) : cell + 4, least);
  if (cell > minCell) return settleCell(Math.max(minCell, cell - 4), least);
  const next = cell / 1.5;
  return settleCell(next < least * 1.25 ? least : next, least);
};
