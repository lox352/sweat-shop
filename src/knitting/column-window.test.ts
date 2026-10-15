import { describe, expect, it } from "vitest";
import { buildSweater } from "./engine";
import { layOutSweater } from "./layout";
import { LiveColumns, columnAt, everyColumn, indexRows, mapOf, placeFrom, rowsShowing } from "./column-window";
import { testSweater } from "./test-sweater";
import { sweaters } from "../data/sweaters";
import hamefarin from "../data/sweaters/hamefarin";

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

describe("the rows on screen", () => {
  it("are every row any part of which shows, counted from the bottom", () => {
    // Ten rows of ten pixels: the top row is 0-10 down the chart, the bottom 90-100.
    expect(rowsShowing(10, 10, 0, 100)).toEqual([1, 10]);
    expect(rowsShowing(10, 10, 0, 10)).toEqual([10, 10]);
    expect(rowsShowing(10, 10, 5, 10)).toEqual([9, 10]);
    expect(rowsShowing(10, 10, 90, 30)).toEqual([1, 1]);
    // A box that only touches a row's edge does not show it.
    expect(rowsShowing(10, 10, 10, 10)).toEqual([9, 9]);
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
