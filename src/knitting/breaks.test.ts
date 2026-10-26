import { describe, expect, it } from "vitest";
import { buildSweater } from "./engine";
import { breaksIn } from "./breaks";
import { indexRows, type ColumnMap } from "./column-window";
import { sceneOf } from "./chart-scene";
import { type Ctx2D, defaultColours, laidOutPlaces, laidOutRows, paintRegion } from "./chart-painter";
import { columnPlaces } from "./tile-view";
import { testSweater } from "./test-sweater";
import { seamLayout, viewChart } from "./useSweater";
import { viewFor } from "./view";
import { chartViews } from "./views";
import type { Palette } from "./palette";

const built = buildSweater(testSweater, "one");
const counted = viewFor(built, () => seamLayout(built), undefined);
const views = chartViews(built, testSweater.pieces);
const chartOf = (label: string) => viewChart(built, counted, views.find((view) => view.label === label)!).layout;

describe("where the chart is torn apart", () => {
  it("is in the Body view, either side of each underarm, through the yoke: back and front with a sleeve's stitches between them", () => {
    const layout = chartOf("Body");
    const breaks = breaksIn(indexRows(layout), layout, built.stitches);
    const yokeRows = new Set([...layout.cells.values()].filter((cell) => cell.piece === "yoke").map((cell) => cell.row));
    // Two in every row of the yoke, one each side, and in no other row.
    for (const row of yokeRows) expect(breaks.filter((one) => one.from <= row && row <= one.to)).toHaveLength(2);
    for (const one of breaks) {
      for (let row = one.from; row <= one.to; row++) expect(yokeRows.has(row)).toBe(true);
      expect(one.between).toBeGreaterThan(0);
    }
    // In the yoke's last round, the stitches left out between are a sleeve's eight, which go on hold.
    const last = Math.max(...yokeRows);
    for (const one of breaks.filter((b) => b.to === last)) expect(one.between).toBe(8);
  });

  it("is in the view from the neck only where the body's back and front meet with an underarm left out, and never in a sleeve's", () => {
    const layout = chartOf("From the neck");
    const breaks = breaksIn(indexRows(layout), layout, built.stitches);
    // The body's last round, the bind-off, where no sleeve's round stands between the two: an underarm's four left out each side.
    expect(breaks.map(({ from, to, between }) => ({ from, to, between }))).toEqual(Array(2).fill({ from: layout.rows, to: layout.rows, between: 4 }));
    for (const label of ["Right sleeve", "Left sleeve"]) {
      const sleeve = chartOf(label);
      expect(breaksIn(indexRows(sleeve), sleeve, built.stitches)).toEqual([]);
    }
  });

  it("keeps the two sides a little apart once the columns between them close up, and not while they show", () => {
    // Six columns, the chart's edges 0 and 7 aside: a break between 2 and 5, with 3 and 4 between.
    const mapWith = (shown: number[]): ColumnMap => {
      const shows = new Uint8Array(8);
      for (const column of shown) shows[column] = 1;
      const leftOf = new Int32Array(8);
      let count = 0;
      for (let column = 7; column >= 0; column--) {
        leftOf[column] = count;
        count += shows[column];
      }
      return { shows, count, leftOf, order: Int32Array.from(shown.sort((a, b) => b - a)) };
    };
    const breaks = [{ right: 2, left: 5, from: 1, to: 3, between: 8 }];
    const closed = mapWith([1, 2, 5, 6]);
    const plain = columnPlaces(closed, 20);
    const torn = columnPlaces(closed, 20, breaks);
    // Nine pixels, 0.45 of a cell, at the left of column 2: it and everything right of it move along.
    for (const column of [0, 1, 2]) expect(torn.start[column] - plain.start[column]).toBe(9);
    for (const column of [3, 4, 5, 6]) expect(torn.start[column]).toBe(plain.start[column]);
    // With a column between them showing, there is room already.
    const open = mapWith([1, 2, 3, 5, 6]);
    expect(columnPlaces(open, 20, breaks).start).toEqual(columnPlaces(open, 20).start);
  });

  it("pinks the two facing edges, two teeth to a row", () => {
    const layout = chartOf("Body");
    const scene = sceneOf(layout, built.stitches, counted.rounds);
    expect(scene.breaks.length).toBeGreaterThan(0);
    const cell = 10;
    const state = {
      cell,
      ...laidOutPlaces(layout.columns, cell),
      ...laidOutRows(layout.rows, cell),
      palette: { A: { name: "A", hex: "#333333" }, B: { name: "B", hex: "#cccccc" } } as unknown as Palette,
      progress: 0,
      hatch: [],
      onHold: [],
      colours: defaultColours,
      ratio: 1,
    };
    const strokes: { points: number[][]; colour: string }[] = [];
    let points: number[][] = [];
    const ctx = new Proxy(
      {},
      {
        get: (target: Record<string, unknown>, key: string) => {
          if (key === "beginPath") return () => (points = []);
          if (key === "moveTo") return (x: number, y: number) => points.push([x, y]);
          if (key === "lineTo") return (x: number, y: number) => points[points.length - 1].push(x, y);
          if (key === "stroke") return () => strokes.push({ points: points.map((one) => [...one]), colour: String(target.strokeStyle) });
          return key in target ? target[key] : () => {};
        },
        set: (target: Record<string, unknown>, key: string, value: unknown) => {
          target[key] = value;
          return true;
        },
      },
    ) as unknown as Ctx2D;
    paintRegion(ctx, { x: 0, y: 0, width: layout.columns * cell + 40, height: layout.rows * cell }, scene, state);
    const one = scene.breaks[0];
    const x = state.left[one.right];
    const y = state.top[one.from];
    const depth = Math.max(2, cell * 0.18);
    const teeth = strokes.filter((stroke) => stroke.colour === defaultColours.faint).flatMap((stroke) => stroke.points);
    expect(teeth).toContainEqual([x, y, x + depth, y + cell / 4, x, y + cell / 2]);
    expect(teeth).toContainEqual([x, y + cell / 2, x + depth, y + (3 * cell) / 4, x, y + cell]);
    const facing = state.left[one.left] + state.width[one.left];
    expect(teeth).toContainEqual([facing, y, facing - depth, y + cell / 4, facing, y + cell / 2]);
  });
});
