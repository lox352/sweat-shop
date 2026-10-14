import { Stitch } from "../types/Stitch";
import { Cell, ChartLayout } from "./layout";
import { Palette, inkOn, yarnFor } from "./palette";
import { type Face, markAt } from "./chart-marks";

/**
 * The chart as paths.
 *
 * A chart of forty thousand stitches cannot be forty thousand elements - the
 * hat site's CSS grid cost about six hundred milliseconds a stitch at a
 * quarter of that. But it does not have to be. The sweater on the overview
 * draws eighty thousand stitches in one call by instancing them, and the
 * equivalent here is that a chart is mostly long runs of one colour: merge
 * each run into a rectangle, and every rectangle of a given yarn into one
 * path, and the whole chart is eight paths and a couple for the rules.
 *
 * Which keeps it vector, so it stays sharp at any pixel ratio and when zoomed
 * or printed - where a canvas is capped at 2048 pixels a side and so draws at
 * a third of native resolution on a phone.
 */

/** Every nth line is drawn heavier, to make counting easier. */
const emphasis = 5;

/**
 * Whether a rule falls on one of the chart's heavy lines.
 *
 * The heavy lines belong to the grid the chart is drawn on, not to the
 * stitches of any one round: they mark off blocks of five columns and stay
 * where they are, so that counting across the chart means the same thing at
 * the rib as at the crown. Counting them off each round's own stitches
 * instead would shuffle them sideways every time a round was shaped, which
 * is the opposite of what they are for.
 *
 * A round the shaping has left on half columns has no edge lying on one of
 * them, so it simply goes without: better a heavy line missing for a few
 * rounds than one drawn through the middle of a stitch.
 */
const onGrid = (at: number) =>
  at > 0 && Math.abs(at - Math.round(at)) < 1e-6 && Math.round(at) % emphasis === 0;

export const cellAt = (
  layout: ChartLayout,
  row: number,
  column: number,
  cell: number,
) => ({
  // The cast-on belongs at the bottom, and stitch 1 at the right.
  x: (layout.columns - column) * cell,
  y: (layout.rows - row) * cell,
});

/** Room to the right of the chart for the round numbers. */
export const gutter = (cell: number) => Math.round(cell * 2.2);

export const chartSize = (layout: ChartLayout, cell: number) => ({
  width: layout.columns * cell + gutter(cell),
  height: layout.rows * cell,
});

const rect = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y}h${w}v${h}h${-w}z`;

/**
 * Two stitches sit side by side when their columns are one apart.
 *
 * Columns are fractional - a k2tog lands between the two it took together -
 * so this is a comparison with a tolerance rather than an equality, and the
 * places where it comes out false are the real holes in the fabric: the
 * columns a decrease gave up, and the ones an increase has yet to fill.
 */
const adjacent = (left: number, right: number) =>
  Math.abs(right - left - 1) < 1e-6;

/** A round's cells, in column order, split wherever the fabric breaks. */
const runsOf = <T extends { column: number }>(
  cells: T[],
  same: (a: T, b: T) => boolean = () => true,
): T[][] => {
  const sorted = [...cells].sort((a, b) => a.column - b.column);
  const runs: T[][] = [];
  let run: T[] = [];
  for (const cell of sorted) {
    const last = run[run.length - 1];
    if (last && (!adjacent(last.column, cell.column) || !same(last, cell))) {
      runs.push(run);
      run = [];
    }
    run.push(cell);
  }
  if (run.length > 0) runs.push(run);
  return runs;
};

/** Where a run of cells starts and ends across the chart. */
const extent = (layout: ChartLayout, run: { column: number }[], cell: number) => {
  const left = cellAt(layout, 1, run[run.length - 1].column, cell).x;
  const right = cellAt(layout, 1, run[0].column, cell).x + cell;
  return { left, right };
};

/** The cells of each row, keyed by row. */
const byRow = (layout: ChartLayout): Map<number, Cell[]> => {
  const rows = new Map<number, Cell[]>();
  layout.cells.forEach((at) => {
    const row = rows.get(at.row);
    if (row) row.push(at);
    else rows.set(at.row, [at]);
  });
  return rows;
};

/**
 * One filled path per yarn.
 *
 * Runs of a colour along a round become a single rectangle, which on Fair Isle
 * takes tens of thousands of cells down to a few thousand rectangles across
 * eight paths.
 */
export const fillPaths = (
  stitches: Stitch[],
  layout: ChartLayout,
  cell: number,
): { slot: string; d: string }[] => {
  const rows = new Map<number, { column: number; slot: string }[]>();
  for (const stitch of stitches) {
    const at = layout.cells.get(stitch.id);
    if (!at) continue;
    const row = rows.get(at.row) ?? [];
    row.push({ column: at.column, slot: stitch.slot });
    rows.set(at.row, row);
  }

  const paths = new Map<string, string[]>();
  for (const [row, cells] of rows) {
    for (const run of runsOf(cells, (a, b) => a.slot === b.slot)) {
      const { left, right } = extent(layout, run, cell);
      const parts = paths.get(run[0].slot) ?? [];
      parts.push(rect(left, cellAt(layout, row, 1, cell).y, right - left, cell));
      paths.set(run[0].slot, parts);
    }
  }

  return [...paths].map(([slot, parts]) => ({ slot, d: parts.join("") }));
};

/** Where the needles change: the row before the change, and the piece it is in. */
export interface NeedleRule {
  after: number;
  piece: string;
}

/**
 * The rules between cells: the hairlines, and the heavier ones that fall
 * after every fifth stitch and every fifth round; the dashed rule where the
 * needles change; and the rule round each piece of the sweater.
 *
 * They follow the cells rather than a lattice laid over the whole chart,
 * because a chart of a shaped tube is not a rectangle: the columns a decrease
 * gives up are left empty, and the rules stop at the edge of the fabric so
 * those gaps read as the wedges of absent stitches they are.
 *
 * The heavy rows are the fifth rounds of their piece, as the margin numbers
 * them, so above the divide they count the body's rounds and the sleeves'
 * alike. A change of needles is dashed across its own piece only: the body
 * changes for its hem rounds before the sleeves beside it change for their
 * cuffs. And where one piece meets another - the body beside a sleeve, either
 * beside the yoke they were knitted out of - the rule is drawn heavier still,
 * so the pieces read as the pieces they are.
 *
 * Collinear segments are merged, so a chart's worth of cell edges comes out as
 * a few hundred lines rather than one per cell.
 */
export const gridPaths = (
  layout: ChartLayout,
  cell: number,
  needleChanges: NeedleRule[] = [],
): { light: string; heavy: string; needles: string; pieces: string } => {
  const rows = byRow(layout);
  const runs = new Map<number, Cell[][]>();
  rows.forEach((cells, row) => runs.set(row, runsOf(cells)));

  const light: string[] = [];
  const heavy: string[] = [];
  const needles: string[] = [];
  const pieces: string[] = [];

  /** Spans of cells merged where they touch or overlap, left to right. */
  const merged = (spans: { left: number; right: number }[]) => {
    const out: { left: number; right: number }[] = [];
    for (const span of [...spans].sort((a, b) => a.left - b.left)) {
      const open = out[out.length - 1];
      if (open && span.left <= open.right + 1e-6) open.right = Math.max(open.right, span.right);
      else out.push({ ...span });
    }
    return out;
  };
  const spansOf = (cells: Cell[]) => runsOf(cells).map((run) => extent(layout, run, cell));

  /*
   * Horizontal rules: a boundary needs one wherever there is fabric on
   * either side of it, so the spans of the two rows it separates are merged
   * before they are drawn. Boundary r is the one above row r.
   */
  for (let row = 0; row <= layout.rows; row++) {
    const y = (layout.rows - row) * cell;
    const number = layout.numbers[row - 1];
    const into = row !== 0 && number !== undefined && number % emphasis === 0 ? heavy : light;
    const spans = (at: number) => (runs.get(at) ?? []).map((run) => extent(layout, run, cell));
    for (const span of merged([...spans(row), ...spans(row + 1)])) {
      into.push(`M${span.left} ${y}h${span.right - span.left}`);
    }
  }

  // A change of needles, dashed across the piece that changes, over the pale ground ChartSvg gives it.
  for (const change of needleChanges) {
    const y = (layout.rows - change.after) * cell;
    const ofPiece = (row: number) => (rows.get(row) ?? []).filter((at) => at.piece === change.piece);
    for (const span of merged([...spansOf(ofPiece(change.after)), ...spansOf(ofPiece(change.after + 1))])) {
      needles.push(`M${span.left} ${y}h${span.right - span.left}`);
    }
  }

  /*
   * And vertical rules, one per cell edge, gathered by where they fall so a
   * column that runs unbroken up the chart is a single line.
   */
  const lines = new Map<string, number[]>();
  const edge = (on: number, row: number) => {
    const key = `${on.toFixed(3)}|${onGrid(on) ? "h" : "l"}`;
    const at = lines.get(key);
    if (at) at.push(row);
    else lines.set(key, [row]);
  };

  runs.forEach((rowRuns, row) => {
    for (const run of rowRuns) {
      // The edge on the stitch-1 side of the run, then one per cell going left.
      edge(run[0].column - 1, row);
      for (const at of run) edge(at.column, row);
    }
  });

  lines.forEach((atRows, key) => {
    const [at, weight] = key.split("|");
    const into = weight === "h" ? heavy : light;
    const x = (layout.columns - Number(at)) * cell;
    atRows.sort((a, b) => a - b);
    let from = atRows[0];
    let last = atRows[0];
    const flush = () => {
      const top = (layout.rows - last) * cell;
      into.push(`M${x} ${top}v${(last - from + 1) * cell}`);
    };
    for (let i = 1; i < atRows.length; i++) {
      if (atRows[i] === last + 1) {
        last = atRows[i];
        continue;
      }
      flush();
      from = atRows[i];
      last = atRows[i];
    }
    flush();
  });

  // Where pieces meet: beside one another in a row, and one above the other at the divide.
  const pieceAt = new Map<string, string>();
  const key = (row: number, column: number) => `${row}|${column.toFixed(3)}`;
  layout.cells.forEach((at) => pieceAt.set(key(at.row, at.column), at.piece));
  layout.cells.forEach((at) => {
    const { x, y } = cellAt(layout, at.row, at.column, cell);
    const left = pieceAt.get(key(at.row, at.column + 1));
    if (left !== undefined && left !== at.piece) pieces.push(`M${x} ${y}v${cell}`);
    const above = pieceAt.get(key(at.row + 1, at.column));
    if (above !== undefined && above !== at.piece) pieces.push(`M${x} ${y}h${cell}`);
  });

  return {
    light: light.join(""),
    heavy: heavy.join(""),
    needles: needles.join(""),
    pieces: pieces.join(""),
  };
};

/**
 * The knitting symbols, grouped by the ink they need.
 *
 * A mark has to read on whatever yarn is under it, so it is drawn in dark ink
 * on a pale wool and pale ink on a dark one - which is two paths, not two
 * thousand.
 */
export const markPaths = (
  stitches: Stitch[],
  layout: ChartLayout,
  palette: Palette,
  cell: number,
  makeOneLean?: "left" | "right",
  /** The side of the sweater shown, which decides what each stitch is. */
  face: Face = "right",
): { ink: string; strokes: string; dots: string }[] => {
  const groups = new Map<string, { strokes: string[]; dots: string[] }>();
  const byId = new Map(stitches.map((stitch) => [stitch.id, stitch]));

  for (const stitch of stitches) {
    const mark = markAt(stitch, byId, layout, makeOneLean, face);
    if (!mark) continue;
    const at = layout.cells.get(stitch.id);
    if (!at) continue;
    const { x, y } = cellAt(layout, at.row, at.column, cell);
    const ink = inkOn(yarnFor(palette, stitch.slot).hex);
    const group = groups.get(ink) ?? { strokes: [], dots: [] };

    for (const stroke of mark.strokes ?? []) {
      group.strokes.push(
        stroke
          .map(
            ([px, py], i) =>
              `${i === 0 ? "M" : "L"}${(x + px * cell).toFixed(1)} ${(
                y +
                py * cell
              ).toFixed(1)}`,
          )
          .join(""),
      );
    }
    if (mark.dot) {
      const cx = x + mark.dot.x * cell;
      const cy = y + mark.dot.y * cell;
      const r = mark.dot.r * cell;
      // A circle as a path, so every dot of one ink is one element.
      group.dots.push(
        `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`,
      );
    }
    groups.set(ink, group);
  }

  return [...groups].map(([ink, group]) => ({
    ink,
    strokes: group.strokes.join(""),
    dots: group.dots.join(""),
  }));
};

/**
 * The knitting done so far, as a rectangle per unbroken run of it.
 *
 * Columns only ever increase across a round, so the stitches worked so far
 * are a run rather than a scatter, and a whole round of plain knitting veils
 * with one rectangle. A round the crown has taken stitches out of breaks into
 * a few, which is what keeps the veil off the empty columns between them -
 * and either way the cost is per round rather than per stitch, so a stitch
 * costs the same on a forty thousand stitch body as on a small sleeve.
 */
export const progressPath = (
  layout: ChartLayout,
  rounds: number[][],
  progress: number,
  cell: number,
): string => {
  const parts: string[] = [];
  for (let index = 0; index < rounds.length; index++) {
    const ids = rounds[index];
    if (ids.length === 0 || ids[0] > progress) break;
    let last = ids.length - 1;
    while (last >= 0 && ids[last] > progress) last--;
    if (last < 0) break;

    const worked = ids
      .slice(0, last + 1)
      .map((id) => layout.cells.get(id))
      .filter((at): at is Cell => at !== undefined);
    // In the row it is drawn in: on the whole sweater's chart, beside other pieces' rounds.
    const y = (layout.rows - (layout.roundRows[index] ?? index + 1)) * cell;
    for (const run of runsOf(worked)) {
      const { left, right } = extent(layout, run, cell);
      parts.push(rect(left, y, right - left, cell));
    }
  }
  return parts.join("");
};

/**
 * Some stitches of the chart, as a rectangle per unbroken run of them along
 * each row: a region of the knitting to wash or hatch over, such as stitches
 * on hold and everything to be knitted from them.
 */
export const regionPath = (layout: ChartLayout, ids: Iterable<number>, cell: number): string => {
  const rows = new Map<number, Cell[]>();
  for (const id of ids) {
    const at = layout.cells.get(id);
    if (!at) continue;
    const row = rows.get(at.row);
    if (row) row.push(at);
    else rows.set(at.row, [at]);
  }
  const parts: string[] = [];
  rows.forEach((cells, row) => {
    const y = (layout.rows - row) * cell;
    for (const run of runsOf(cells)) {
      const { left, right } = extent(layout, run, cell);
      parts.push(rect(left, y, right - left, cell));
    }
  });
  return parts.join("");
};

/**
 * Which rows get a number down the right-hand edge - each numbered as the
 * round it is of its piece; see ChartLayout.numbers.
 *
 * Every fifth, each piece's first and the chart's last - and both rows a
 * change of needles falls between, so the line across the chart can be named
 * in words and found by eye.
 */
export const numberedRows = (
  layout: ChartLayout,
  needleChanges: NeedleRule[] = [],
): number[] => {
  const named = new Set<number>();
  needleChanges.forEach((change) => {
    named.add(change.after);
    named.add(change.after + 1);
  });
  const out: number[] = [];
  for (let row = 1; row <= layout.rows; row++) {
    const number = layout.numbers[row - 1] ?? row;
    if (number % emphasis === 0 || number === 1 || row === layout.rows || named.has(row)) out.push(row);
  }
  return out;
};
