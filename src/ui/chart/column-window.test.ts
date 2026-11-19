import { describe, expect, it } from "vitest";
import { buildSweater } from "../../compiler/engine/engine";
import { layOutSweater } from "../../reading/layout";
import {
  type ColumnMap,
  LiveColumns,
  LiveRows,
  columnAt,
  columnsWith,
  blocksKept,
  everyColumn,
  everyRow,
  indexColumns,
  indexRows,
  mapOf,
  placeFrom,
  rowMapOf,
  rowsWithin,
  sameShows,
} from "./column-window";
import { testSweater } from "../../compiler/engine/test-sweater";
import { sweaters } from "../../compiler/designs";
import hamefarin from "../../compiler/designs/hamefarin";

const laidOut = (design: Parameters<typeof buildSweater>[0], size: string) => {
  const built = buildSweater(design, size);
  return { built, layout: layOutSweater(built.stitches, built.rounds, built.roundKinds, built.roundPieces) };
};

/** The columns with a stitch in any of these rows, counted the slow way. */
const occupied = (index: ReturnType<typeof indexRows>, first: number, last: number) => {
  const out = new Set<number>();
  for (let row = first; row <= last; row++) {
    for (let k = index.start[row]; k < index.start[row + 1]; k++) out.add(index.column[k]);
  }
  return out;
};

/** Each row's top edge and height, ten pixels a row, the rows in `closed` taking none. */
const rowPlaces = (rows: number, closed: number[] = []) => {
  const top = new Float64Array(rows + 2);
  const height = new Float64Array(rows + 2);
  let y = 0;
  for (let row = rows + 1; row >= 0; row--) {
    top[row] = y;
    height[row] = row >= 1 && row <= rows && !closed.includes(row) ? 10 : 0;
    y += height[row];
  }
  return { top, height };
};

/** The rows with a stitch in any of these columns, counted the slow way. */
const crossed = (index: ReturnType<typeof indexRows>, columns: Iterable<number>) => {
  const wanted = new Set(columns);
  const out = new Set<number>();
  for (let k = 0; k < index.column.length; k++) {
    if (!wanted.has(index.column[k])) continue;
    let row = 1;
    while (index.start[row + 1] <= k) row++;
    out.add(row);
  }
  return out;
};

describe("the rows on screen", () => {
  it("are every row any part of which shows, counted from the bottom", () => {
    // Ten rows of ten pixels: the top row is 0-10 down the chart, the bottom 90-100.
    const { top, height } = rowPlaces(10);
    expect(rowsWithin(top, height, 10, 0, 100)).toEqual([1, 10]);
    expect(rowsWithin(top, height, 10, 0, 10)).toEqual([10, 10]);
    expect(rowsWithin(top, height, 10, 5, 15)).toEqual([9, 10]);
    expect(rowsWithin(top, height, 10, 90, 120)).toEqual([1, 1]);
    // A box that only touches a row's edge does not show it.
    expect(rowsWithin(top, height, 10, 10, 20)).toEqual([9, 9]);
  });

  it("go by where the rows are drawn, a row closed up taking none of the box", () => {
    // Rows 4 to 6 closed: row 7 stands on row 3, 30 to 40 and 40 to 50 down the chart.
    const { top, height } = rowPlaces(10, [4, 5, 6]);
    expect(rowsWithin(top, height, 10, 35, 45)).toEqual([3, 7]);
    expect(rowsWithin(top, height, 10, 30, 40)).toEqual([7, 7]);
    expect(rowsWithin(top, height, 10, 40, 50)).toEqual([3, 3]);
  });
});

describe("a chart's rows in column order", () => {
  const { layout } = laidOut(testSweater, "one");
  const index = indexRows(layout);

  it("holds every stitch once, in its row, left to right by column", () => {
    expect(index.id.length).toBe(layout.cells.size);
    expect(new Set(index.id).size).toBe(layout.cells.size);
    for (let row = 1; row <= index.rows; row++) {
      for (let k = index.start[row]; k < index.start[row + 1]; k++) {
        const at = layout.cells.get(index.id[k])!;
        expect(at.row).toBe(row);
        expect(index.column[k]).toBe(at.column);
        if (k > index.start[row]) expect(index.column[k]).toBeGreaterThan(index.column[k - 1]);
      }
    }
  });
});

describe("a chart's columns in row order", () => {
  const { layout } = laidOut(testSweater, "one");
  const index = indexRows(layout);
  const columns = indexColumns(index);

  it("holds every stitch's row once, in its column, from the bottom up", () => {
    expect(columns.row.length).toBe(layout.cells.size);
    const seen = new Set<string>();
    layout.cells.forEach((at) => seen.add(`${at.column}|${at.row}`));
    for (let c = 1; c <= columns.columns; c++) {
      for (let k = columns.start[c]; k < columns.start[c + 1]; k++) {
        expect(seen.has(`${c}|${columns.row[k]}`)).toBe(true);
        if (k > columns.start[c]) expect(columns.row[k]).toBeGreaterThan(columns.row[k - 1]);
      }
    }
  });
});

describe("the rows showing, as the view moves sideways", () => {
  const { built, layout } = laidOut(hamefarin, "m");
  const index = indexRows(layout);
  const columns = indexColumns(index);

  it("are those with a stitch in a column on screen, however the view got there", () => {
    const live = new LiveRows(columns);
    const spans: [number, number][] = [];
    for (let from = 1; from + 20 <= index.columns; from += 7) spans.push([from, from + 20]);
    spans.push([1, index.columns], [300, 310], [5, 6], [100, 99]);
    for (const [from, to] of spans) {
      const on = Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
      const before = new Set(Array.from({ length: index.rows }, (_, i) => i + 1).filter((row) => live.has(row)));
      const changed = live.moveTo(on);
      const want = crossed(index, on);
      const now = new Set(Array.from({ length: index.rows }, (_, i) => i + 1).filter((row) => live.has(row)));
      expect(now, `${from}-${to}`).toEqual(want);
      expect(live.live).toBe(want.size);
      expect(changed, `${from}-${to}`).toBe(before.size !== now.size || [...now].some((row) => !before.has(row)));
    }
  });

  it("close up a short row's band wherever its stitches are off screen, and keep every round's", () => {
    // The back of the neck's short rows, worked to and fro.
    const short = [...new Set(layout.roundRows.filter((_, round) => built.roundKinds[round] !== "round"))];
    expect(short.length).toBeGreaterThan(0);
    // Somewhere across the chart, a stretch of columns no short row has a stitch in: the rows there show, the short rows do not.
    const shortColumns = crossed(index, []);
    for (const row of short) for (let k = index.start[row]; k < index.start[row + 1]; k++) shortColumns.add(index.column[k]);
    const clear = Array.from({ length: index.columns }, (_, i) => i + 1).find(
      (c) => !shortColumns.has(c) && occupied(index, 1, 1).has(c),
    )!;
    const live = new LiveRows(columns);
    live.moveTo([clear]);
    const map = rowMapOf(live);
    for (const row of short) expect(map.shows[row], `row ${row}`).toBe(0);
    expect(map.shows[1]).toBe(1);
    expect(map.order[map.order.length - 1]).toBe(1);
    expect(everyRow(index.rows).count).toBe(index.rows);
  });
});

describe.each(sweaters.map((sweater) => [sweater.name, sweater] as const))("%s's columns, closed up", (_, design) => {
  it("are whole numbers in every size, one stitch to a column in a row, each with a stitch somewhere", () => {
    for (const size of design.sizes) {
      const { layout } = laidOut(design, size.id);
      const index = indexRows(layout);
      layout.cells.forEach((at) => expect(Number.isInteger(at.column), `${size.id}: ${at.column}`).toBe(true));
      expect(occupied(index, 1, index.rows).size, size.id).toBe(layout.columns);
    }
  }, 180_000);
});

describe("the columns showing, as the view moves", () => {
  const { layout } = laidOut(hamefarin, "m");
  const index = indexRows(layout);

  it("are those with a stitch in a row in view, however the view got there", () => {
    const live = new LiveColumns(index);
    // A walk up the chart a row at a time, then jumps about it.
    const windows: [number, number][] = [];
    for (let first = 1; first + 35 <= index.rows; first++) windows.push([first, first + 35]);
    windows.push([200, 219], [1, 10], [50, 60], [55, 120], [1, 219], [219, 219], [100, 99]);
    for (const [first, last] of windows) {
      const before = new Set(Array.from({ length: index.columns }, (_, i) => i + 1).filter((column) => live.has(column)));
      const changed = live.moveTo(first, last);
      const want = occupied(index, Math.max(1, first), Math.min(index.rows, last));
      const now = new Set(Array.from({ length: index.columns }, (_, i) => i + 1).filter((column) => live.has(column)));
      expect(now, `${first}-${last}`).toEqual(want);
      expect(live.live).toBe(want.size);
      expect(changed, `${first}-${last}`).toBe(before.size !== now.size || [...now].some((column) => !before.has(column)));
    }
  });

  it("close up at the neck: the rib's stitches side by side, until the first increase round comes into view", () => {
    const widthOf = (row: number) => index.start[row + 1] - index.start[row];
    const increase = Array.from({ length: index.rows }, (_, i) => i + 1).find((row) => widthOf(row) > widthOf(1))!;
    const live = new LiveColumns(index);
    // Up to the round before it, every column showing is a neck stitch's, side by side.
    live.moveTo(1, increase - 1);
    expect(mapOf(live).count).toBe(widthOf(1));
    // And with it in view, its new stitches part the columns either side of them.
    live.moveTo(1, increase);
    expect(mapOf(live).count).toBe(widthOf(increase));
  });
});

describe("where the columns go", () => {
  it("is where the layout puts them when every column shows", () => {
    const map = everyColumn(5);
    expect(Array.from(map.leftOf)).toEqual([5, 4, 3, 2, 1, 0, 0]);
    expect(Array.from(map.order)).toEqual([5, 4, 3, 2, 1]);
    expect(columnAt(map, 0, 10)).toBe(5);
    expect(columnAt(map, 49, 10)).toBe(1);
    expect(columnAt(map, 50, 10)).toBeUndefined();
  });

  it("holds the anchor still and lays the rest out from it, a closed column at the edge it would open from", () => {
    const live = new LiveColumns(indexRows(laidOut(testSweater, "one").layout));
    live.moveTo(1, 2);
    const map = mapOf(live);
    const left = placeFrom(map, map.order[3], 100, 8);
    expect(left[map.order[3]]).toBe(100);
    expect(left[map.order[4]]).toBe(108);
    expect(left[map.order[2]]).toBe(92);
    // A column with no stitch in view stands at the left edge of the next showing column to its right.
    const closed = Array.from({ length: map.shows.length - 2 }, (_, i) => i + 1).find((column) => !map.shows[column])!;
    let right = closed - 1;
    while (right > 0 && !map.shows[right]) right--;
    expect(left[closed]).toBe(left[right]);
  });
});

describe("lines closing in a block, kept while in view", () => {
  const lines = 20;
  const showing = (from: number, to: number) => Uint8Array.from({ length: lines + 2 }, (_, line) => (line >= from && line <= to ? 1 : 0));
  const everywhere = () => true;
  // A map showing just these: columnsWith reads nothing of the map it adds to but what it shows.
  const mapFrom = (shows: Uint8Array) => columnsWith({ shows: new Uint8Array(shows.length) } as ColumnMap, shows);

  it("are a block that would close at once, kept as paper", () => {
    // Lines 15 to 20 lose their last stitch on screen at once: a sleeve's cuff, the box gone on to the body.
    const kept = blocksKept(showing(1, 14), showing(1, 20), undefined, everywhere, everywhere, 3)!;
    expect([...kept].map((on, line) => (on ? line : 0)).filter(Boolean)).toEqual([15, 16, 17, 18, 19, 20]);
  });

  it("but only while in view: out of it they close", () => {
    const kept = blocksKept(showing(1, 14), showing(1, 20), undefined, (line) => line <= 18, everywhere, 3)!;
    expect([...kept].map((on, line) => (on ? line : 0)).filter(Boolean)).toEqual([15, 16, 17, 18]);
  });

  it("and once kept, stay kept while in view, however few are left", () => {
    const before = blocksKept(showing(1, 14), showing(1, 20), undefined, everywhere, everywhere, 3);
    const kept = blocksKept(showing(1, 14), showing(1, 16), before, everywhere, everywhere, 3)!;
    expect([...kept].map((on, line) => (on ? line : 0)).filter(Boolean)).toEqual([15, 16]);
  });

  it("and close together once all of them are out of view, not one by one", () => {
    const before = blocksKept(showing(1, 14), showing(1, 20), undefined, everywhere, everywhere, 3);
    // The box gone down the chart: only line 15 still in view, the rest of the block above it.
    const some = blocksKept(showing(1, 14), showing(1, 20), before, (line) => line <= 15, everywhere, 3)!;
    expect([...some].map((on, line) => (on ? line : 0)).filter(Boolean)).toEqual([15, 16, 17, 18, 19, 20]);
    expect(blocksKept(showing(1, 14), showing(1, 20), some, (line) => line <= 14, everywhere, 3)).toBeUndefined();
  });

  it("nor anything the box was not looking at before it moved: sent somewhere else altogether, it keeps nothing", () => {
    expect(blocksKept(showing(1, 14), showing(1, 20), undefined, everywhere, () => false, 3)).toBeUndefined();
  });

  it("not a line or a few closing one at a time, as a yoke's edge does", () => {
    expect(blocksKept(showing(1, 18), showing(1, 20), undefined, everywhere, everywhere, 3)).toBeUndefined();
  });

  it("between lines showing as at the edges: a short rows' band, its stitches off screen", () => {
    const shows = showing(1, 20);
    for (let line = 5; line <= 10; line++) shows[line] = 0;
    const kept = blocksKept(shows, showing(1, 20), undefined, everywhere, everywhere, 3)!;
    expect([...kept].map((on, line) => (on ? line : 0)).filter(Boolean)).toEqual([5, 6, 7, 8, 9, 10]);
  });

  it("but not lines closing here and there, as a yoke's make-ones do, however many", () => {
    const shows = showing(1, 20);
    for (const line of [3, 6, 9, 12, 15]) shows[line] = 0;
    expect(blocksKept(shows, showing(1, 20), undefined, everywhere, everywhere, 3)).toBeUndefined();
  });

  it("show alongside the lines with stitches", () => {
    const kept = blocksKept(showing(1, 14), showing(1, 20), undefined, everywhere, everywhere, 3)!;
    const map = columnsWith(mapFrom(showing(1, 14)), kept);
    expect(map.count).toBe(20);
    expect(sameShows(map, mapFrom(showing(1, 20)))).toBe(true);
  });
});
