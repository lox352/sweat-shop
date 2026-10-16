import type { ChartLayout } from "./layout";

/**
 * Which of the chart's columns have a stitch in the rows on screen, and where
 * each column goes when the ones that do not are closed up - and the same
 * the other way, for the rows with no stitch in the columns on screen.
 *
 * A chart laid out stitch over stitch has empty columns wherever a stitch is
 * yet to be made or has been taken in: under every make-one, all the way down
 * the yoke, and over every decrease, all the way up a sleeve. They are true to
 * the knitting, but only where the rows that make them are in view. Scrolled
 * to the neck, the rib is a few dozen stitches spread across the width of the
 * yoke, and what a knitter wants to see is those stitches side by side, as
 * they are on the needles. So a column takes room only while a row on screen
 * has a stitch in it, and scrolling a make-one's row into view parts the
 * columns either side of it.
 *
 * Nothing here touches the page: these are the sums a view does as it scrolls,
 * kept cheap enough to do on every frame of a fling on a phone. A row coming
 * into view costs a step per stitch in it, and the columns' places are worked
 * out again only when the set of columns showing changes.
 */

/**
 * Each row's stitches in column order, as one array for the whole chart: row
 * r's are from start[r] to start[r + 1], rows counted from 1 at the bottom.
 */
export interface RowIndex {
  rows: number;
  columns: number;
  start: Int32Array;
  column: Int32Array;
  id: Int32Array;
}

/**
 * The chart's stitches, row by row in column order.
 *
 * Every column a layout gives is a whole number - a stitch stands over the
 * stitch below it, or a column of its own - so a column is an index here.
 */
export const indexRows = (layout: ChartLayout): RowIndex => {
  const { rows, columns } = layout;
  const start = new Int32Array(rows + 2);
  layout.cells.forEach((at) => start[at.row + 1]++);
  for (let row = 1; row <= rows + 1; row++) start[row] += start[row - 1];
  const fill = start.slice();
  const column = new Int32Array(layout.cells.size);
  const id = new Int32Array(layout.cells.size);
  layout.cells.forEach((at, stitch) => {
    const k = fill[at.row]++;
    column[k] = Math.round(at.column);
    id[k] = stitch;
  });
  // Each row into column order: a few hundred stitches a row, sorted once per layout.
  for (let row = 1; row <= rows; row++) {
    const from = start[row];
    const to = start[row + 1];
    const order = Array.from({ length: to - from }, (_, k) => from + k).sort((a, b) => column[a] - column[b]);
    const columns = order.map((k) => column[k]);
    const ids = order.map((k) => id[k]);
    column.set(columns, from);
    id.set(ids, from);
  }
  return { rows, columns, start, column, id };
};

/**
 * The rows any part of which is drawn between `y0` and `y1` down the chart,
 * each row `top[row]` down and `height[row]` tall: the first and last,
 * counted from 1 at the bottom. A row closed up counts only between two that
 * show. Empty, last before first, when no row is there.
 */
export const rowsWithin = (
  top: ArrayLike<number>,
  height: ArrayLike<number>,
  rows: number,
  y0: number,
  y1: number,
): [number, number] => {
  // Rows rise as their number does, so both their top edges and their bottom edges fall.
  const firstWhere = (test: (row: number) => boolean) => {
    let low = 1;
    let high = rows + 1;
    while (low < high) {
      const row = (low + high) >> 1;
      if (test(row)) high = row;
      else low = row + 1;
    }
    return low;
  };
  const first = firstWhere((row) => top[row] < y1);
  const last = firstWhere((row) => top[row] + height[row] <= y0) - 1;
  return [first, last];
};

/**
 * How many of the rows in view have a stitch in each column, kept up as the
 * view moves rather than counted afresh.
 */
export class LiveColumns {
  readonly count: Int32Array;
  /** The rows in view, first and last; none while last is before first. */
  first = 1;
  last = 0;
  /** How many columns have a stitch in the rows in view. */
  live = 0;

  constructor(readonly index: RowIndex) {
    this.count = new Int32Array(index.columns + 2);
  }

  /** Whether a column has a stitch in a row in view. */
  has(column: number): boolean {
    return this.count[column] > 0;
  }

  /**
   * Bring the rows in view to these, and say whether that changed which
   * columns have a stitch in them.
   *
   * The rows coming into view are counted in before the ones leaving are
   * counted out, so a column in both never passes through none: a column
   * that crosses zero has really appeared or gone.
   */
  moveTo(first: number, last: number): boolean {
    const { rows } = this.index;
    first = Math.max(1, first);
    last = Math.min(rows, last);
    if (first === this.first && last === this.last) return false;
    const was = [this.first, this.last];
    let changed = false;
    for (let row = first; row <= last; row++) {
      if (row < was[0] || row > was[1]) changed = this.add(row, 1) || changed;
    }
    for (let row = was[0]; row <= was[1]; row++) {
      if (row < first || row > last) changed = this.add(row, -1) || changed;
    }
    this.first = first;
    this.last = last;
    return changed;
  }

  private add(row: number, by: 1 | -1): boolean {
    const { start, column } = this.index;
    const count = this.count;
    let crossed = false;
    for (let k = start[row]; k < start[row + 1]; k++) {
      const at = column[k];
      const before = count[at];
      count[at] = before + by;
      if (before === 0 || before + by === 0) {
        crossed = true;
        this.live += by;
      }
    }
    return crossed;
  }
}

/**
 * Each column's stitches by row, as one array for the whole chart: column c's
 * rows are from start[c] to start[c + 1], from the bottom up.
 */
export interface ColumnIndex {
  columns: number;
  rows: number;
  start: Int32Array;
  row: Int32Array;
}

/** The chart's stitches, column by column: the rows index turned on its side. */
export const indexColumns = (index: RowIndex): ColumnIndex => {
  const { rows, columns } = index;
  const start = new Int32Array(columns + 3);
  for (let k = 0; k < index.column.length; k++) start[index.column[k] + 1]++;
  for (let c = 1; c <= columns + 2; c++) start[c] += start[c - 1];
  const fill = start.slice();
  const row = new Int32Array(index.column.length);
  // Row by row from the bottom, so each column's rows come out in order.
  for (let r = 1; r <= rows; r++) {
    for (let k = index.start[r]; k < index.start[r + 1]; k++) row[fill[index.column[k]]++] = r;
  }
  return { columns, rows, start, row };
};

/**
 * How many of the columns on screen have a stitch in each row, kept up as the
 * view moves rather than counted afresh: a row shows only while one does.
 */
export class LiveRows {
  readonly count: Int32Array;
  /** How many rows have a stitch in the columns on screen. */
  live = 0;
  /** The lowest and highest numbered columns on screen; none while high is below low. */
  low = 1;
  high = 0;
  private on: Uint8Array;
  private stamp: Int32Array;
  private now = 0;
  private columns: number[] = [];

  constructor(readonly index: ColumnIndex) {
    this.count = new Int32Array(index.rows + 2);
    this.on = new Uint8Array(index.columns + 2);
    this.stamp = new Int32Array(index.columns + 2);
  }

  get lines() {
    return this.index.rows;
  }

  /** Whether a row has a stitch in a column on screen. */
  has(row: number): boolean {
    return this.count[row] > 0;
  }

  /**
   * Bring the columns on screen to these, and say whether that changed which
   * rows have a stitch in them. As with the columns, those coming on screen
   * are counted in before those leaving are counted out.
   */
  moveTo(columns: ArrayLike<number>): boolean {
    this.now++;
    let changed = false;
    const next: number[] = [];
    let low = this.index.columns + 1;
    let high = 0;
    for (let i = 0; i < columns.length; i++) {
      const c = columns[i];
      low = Math.min(low, c);
      high = Math.max(high, c);
      this.stamp[c] = this.now;
      next.push(c);
      if (!this.on[c]) {
        this.on[c] = 1;
        changed = this.add(c, 1) || changed;
      }
    }
    for (const c of this.columns) {
      if (this.stamp[c] === this.now) continue;
      this.on[c] = 0;
      changed = this.add(c, -1) || changed;
    }
    this.columns = next;
    this.low = low;
    this.high = high;
    return changed;
  }

  private add(c: number, by: 1 | -1): boolean {
    const { start, row } = this.index;
    let crossed = false;
    for (let k = start[c]; k < start[c + 1]; k++) {
      const before = this.count[row[k]];
      this.count[row[k]] = before + by;
      if (before === 0 || before + by === 0) {
        crossed = true;
        this.live += by;
      }
    }
    return crossed;
  }
}

/**
 * Where each column goes with the empty ones closed up.
 *
 * Measured from the chart's left edge, which is its highest column, in cells:
 * a column stands as many cells in as there are columns showing to its left.
 * Column 0 and the one past the last stand for the chart's right and left
 * edges, and never show.
 */
export interface ColumnMap {
  /** 1 where a column shows. */
  shows: Uint8Array;
  /** How many columns show. */
  count: number;
  /** For each column, how many columns showing are to its left: those with a higher number. */
  leftOf: Int32Array;
  /** The columns showing, left to right. */
  order: Int32Array;
}

const mapFrom = (columns: number, shows: (column: number) => boolean): ColumnMap => {
  const flags = new Uint8Array(columns + 2);
  const leftOf = new Int32Array(columns + 2);
  let count = 0;
  for (let column = columns + 1; column >= 0; column--) {
    leftOf[column] = count;
    if (column >= 1 && column <= columns && shows(column)) {
      flags[column] = 1;
      count++;
    }
  }
  const order = new Int32Array(count);
  let k = 0;
  for (let column = columns; column >= 1; column--) if (flags[column]) order[k++] = column;
  return { shows: flags, count, leftOf, order };
};

/** The chart with only the columns that have a stitch in a row in view. */
export const mapOf = (live: LiveColumns): ColumnMap => mapFrom(live.index.columns, (column) => live.has(column));

/**
 * Where each row goes with the empty ones closed up: as a column map, a row
 * standing as many cells down as there are rows showing above it. Row 0 and
 * the one past the last stand for the chart's bottom and top edges.
 */
export interface RowMap {
  shows: Uint8Array;
  count: number;
  /** For each row, how many rows showing are above it: those with a higher number. */
  above: Int32Array;
  /** The rows showing, top to bottom. */
  order: Int32Array;
}

const rowMapFrom = (rows: number, shows: (row: number) => boolean): RowMap => {
  const map = mapFrom(rows, shows);
  return { shows: map.shows, count: map.count, above: map.leftOf, order: map.order };
};

/** The chart with only the rows that have a stitch in a column on screen. */
export const rowMapOf = (live: LiveRows): RowMap => rowMapFrom(live.lines, (row) => live.has(row));

/** The chart with every row. */
export const everyRow = (rows: number): RowMap => rowMapFrom(rows, () => true);

/** The chart with every column, as it is laid out. */
export const everyColumn = (columns: number): ColumnMap => mapFrom(columns, () => true);

/** The column showing at a point so many pixels from the chart's left edge, if any. */
export const columnAt = (map: ColumnMap, x: number, cell: number): number | undefined => {
  const k = Math.floor(x / cell);
  return k >= 0 && k < map.count ? map.order[k] : undefined;
};

/**
 * Where every column goes in a new map, holding one still.
 *
 * `anchor` keeps the left edge it has now, `at`, and everything else is laid
 * out from it: a closed column stands at the edge it would open from, so a
 * stitch whose row is not in view yet still has a place to aim for, and a
 * column that opens keeps its left edge and grows to the right.
 */
export const placeFrom = (map: ColumnMap, anchor: number, at: number, cell: number): Float64Array => {
  const left = new Float64Array(map.leftOf.length);
  const base = at - map.leftOf[anchor] * cell;
  for (let column = 0; column < left.length; column++) left[column] = base + map.leftOf[column] * cell;
  return left;
};
