import { Stitch } from "../types/Stitch";
import { ChartLayout } from "./layout";
import { Palette, inkOn, yarnFor } from "./palette";
import { type Face, markAt } from "./chart-marks";
import { type NeedleRule, numberedRows } from "./chart-paths";

/**
 * Drawing the chart onto a canvas: the renderer kept beside the vector one,
 * for holding the two against each other (see Chart's renderer).
 *
 * A grid of divs, one per stitch, cost the hat site about six hundred
 * milliseconds a stitch on a phone at ten thousand stitches - unusable for
 * the one thing the page is for. So this is a canvas. The colours and marks never change while you knit, so
 * they are drawn once onto a second canvas kept off screen, and each stitch
 * worked is then a blit plus one rectangle per round: the work stops depending
 * on how many stitches there are.
 */

/** Every nth line is drawn heavier, to make counting easier. */
const emphasis = 5;

const grid = "rgba(0, 0, 0, 0.22)";
const gridStrong = "rgba(0, 0, 0, 0.7)";
/** Where the needles are changed, dashed. */
const gridNeedles = "#1d1a17";

/** Where a cell's top left corner is, in pixels. */
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

/**
 * How far the join in the round's arrows reach past a round's end, in cells,
 * and the room kept to the left of the chart for one to reach into. On the
 * right, the gutter has room for it short of the round numbers.
 */
export const joinArrowLength = 0.42;
export const leftMargin = (cell: number) => Math.ceil(cell * 0.5);

export const chartSize = (layout: ChartLayout, cell: number) => ({
  width: layout.columns * cell + gutter(cell),
  height: layout.rows * cell,
});

/**
 * The round numbers down the right-hand edge: each row its own number, which
 * is what the knitting calls its rounds; see chartRows.
 *
 * Every fifth, plus each piece's first and the chart's last, which are the
 * ones a knitter looks for: where to start and how far there is to go.
 */
const drawRoundNumbers = (
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  cell: number,
  ink: string,
  needleChanges: NeedleRule[] = [],
) => {
  ctx.save();
  ctx.fillStyle = ink;
  ctx.font = `${Math.round(cell * 0.72)}px ui-monospace, "Source Sans 3", system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const x = layout.columns * cell + Math.round(cell * 0.45);
  for (const row of numberedRows(layout, needleChanges)) {
    const { y } = cellAt(layout, row, 1, cell);
    ctx.fillText(String(row), x, y + cell / 2);
  }
  ctx.restore();
};

/**
 * The chart itself: colours, outlines and marks. Drawn once.
 *
 * A cell draws its own right and bottom edge, and its top or left as well when
 * there is no neighbour there to draw it - which is what makes a crown's
 * decreases read as an edge rather than as a smudge.
 */
export const drawChart = (
  ctx: CanvasRenderingContext2D,
  stitches: Stitch[],
  layout: ChartLayout,
  palette: Palette,
  cell: number,
  ink = "#a29a91",
  makeOneLean?: "left" | "right",
  needleChanges: NeedleRule[] = [],
  face: Face = "right",
) => {
  // A cell draws its bottom edge, which is the boundary above the row below it.
  const needlesAt = new Set(needleChanges.map((change) => `${change.after + 1}|${change.piece}`));
  const { width, height } = chartSize(layout, cell);
  ctx.clearRect(0, 0, width, height);

  /*
   * Which cells exist, keyed to three decimals: columns are fractional, since
   * a decrease sits between the stitches it took together, so "is there a
   * neighbour here" is a lookup with a tolerance rather than an exact one.
   */
  const key = (row: number, column: number) => `${row},${column.toFixed(3)}`;
  const filled = new Set<string>();
  layout.cells.forEach((at) => filled.add(key(at.row, at.column)));

  const byId = new Map(stitches.map((stitch) => [stitch.id, stitch]));
  ctx.lineWidth = 1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const stitch of stitches) {
    const at = layout.cells.get(stitch.id);
    if (!at) continue;
    const { x, y } = cellAt(layout, at.row, at.column, cell);
    const yarn = yarnFor(palette, stitch.slot);

    ctx.fillStyle = yarn.hex;
    ctx.fillRect(x, y, cell, cell);

    /*
     * Outlines. Heavier every fifth round, and on the chart's own fifth
     * columns rather than on each round's own fifth stitch - the heavy lines
     * belong to the grid the chart is drawn on, so that counting across it
     * means the same thing at the rib as at the crown.
     */
    const majorCol =
      Math.abs(at.column - Math.round(at.column)) < 1e-6 &&
      Math.round(at.column) % emphasis === 0;
    const majorRow = at.row > 1 && (at.row - 1) % emphasis === 0;
    const needlesRow = needlesAt.has(`${at.row}|${at.piece}`);
    ctx.beginPath();
    ctx.strokeStyle = majorCol ? gridStrong : grid;
    ctx.moveTo(x + 0.5, y);
    ctx.lineTo(x + 0.5, y + cell);
    ctx.stroke();
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = majorRow ? gridStrong : grid;
    ctx.moveTo(x, y + cell - 0.5);
    ctx.lineTo(x + cell, y + cell - 0.5);
    ctx.stroke();
    if (needlesRow) {
      // Dashed, on a pale line so it shows on dark wool as well as light.
      for (const [colour, wide, dash] of [
        ["#ffffff", 4, []],
        [gridNeedles, 2, [5, 3]],
      ] as const) {
        ctx.beginPath();
        ctx.strokeStyle = colour;
        ctx.lineWidth = wide;
        ctx.setLineDash([...dash]);
        ctx.moveTo(x, y + cell - 0.5);
        ctx.lineTo(x + cell, y + cell - 0.5);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    ctx.lineWidth = 1;

    ctx.strokeStyle = grid;
    if (!filled.has(key(at.row + 1, at.column))) {
      ctx.beginPath();
      ctx.moveTo(x, y + 0.5);
      ctx.lineTo(x + cell, y + 0.5);
      ctx.stroke();
    }
    if (!filled.has(key(at.row, at.column + 1))) {
      ctx.beginPath();
      ctx.moveTo(x + cell - 0.5, y);
      ctx.lineTo(x + cell - 0.5, y + cell);
      ctx.stroke();
    }

    const mark = markAt(stitch, byId, layout, makeOneLean, face);
    if (!mark) continue;
    const ink = inkOn(yarn.hex);
    if (mark.dot) {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(x + mark.dot.x * cell, y + mark.dot.y * cell, mark.dot.r * cell, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const stroke of mark.strokes ?? []) {
      // A halo, so a mark stays legible on a dark yarn as well as a light one.
      for (const [colour, wide] of [
        [ink === "#ffffff" ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.75)", 2.4],
        [ink, 1.2],
      ] as const) {
        ctx.strokeStyle = colour;
        ctx.lineWidth = wide;
        ctx.beginPath();
        stroke.forEach(([px, py], index) => {
          const point = [x + px * cell, y + py * cell] as const;
          if (index === 0) ctx.moveTo(...point);
          else ctx.lineTo(...point);
        });
        ctx.stroke();
      }
    }
    ctx.lineWidth = 1;
  }

  drawRoundNumbers(ctx, layout, cell, ink, needleChanges);
};

/**
 * How much of each round has been worked, as spans of adjacent stitches.
 *
 * Columns only ever increase across a round, so the stitches worked so far
 * are a run rather than a scatter, and a whole round of plain knitting is one
 * span. A round the crown has taken stitches out of breaks into a few, so the
 * veil stays off the empty columns between them; either way the cost is per
 * round rather than per stitch.
 */
export const workedSpans = (
  layout: ChartLayout,
  rounds: number[][],
  progress: number,
): { row: number; from: number; to: number }[] => {
  const spans: { row: number; from: number; to: number }[] = [];
  for (let index = 0; index < rounds.length; index++) {
    const ids = rounds[index];
    const row = layout.roundRows[index] ?? index + 1;
    if (ids.length === 0 || ids[0] > progress) break;
    let last = ids.length - 1;
    while (last >= 0 && ids[last] > progress) last--;
    if (last < 0) break;

    let from: number | undefined;
    let to: number | undefined;
    for (let at = 0; at <= last; at++) {
      const column = layout.cells.get(ids[at])?.column;
      if (column === undefined) continue;
      if (from === undefined || to === undefined) {
        from = column;
        to = column;
        continue;
      }
      if (Math.abs(column - to - 1) < 1e-6) {
        to = column;
        continue;
      }
      spans.push({ row, from, to });
      from = column;
      to = column;
    }
    if (from !== undefined && to !== undefined) {
      spans.push({ row, from, to });
    }
  }
  return spans;
};

/** The veil over what is already knitted, and the ring round what is next. */
export const drawProgress = (
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  rounds: number[][],
  progress: number,
  nextStitchId: number | undefined,
  cell: number,
  paper: string,
  accent: string,
) => {
  ctx.save();
  ctx.fillStyle = paper;
  ctx.globalAlpha = 0.62;
  for (const span of workedSpans(layout, rounds, progress)) {
    const start = cellAt(layout, span.row, span.to, cell);
    const end = cellAt(layout, span.row, span.from, cell);
    ctx.fillRect(start.x, start.y, end.x - start.x + cell, cell);
  }
  ctx.restore();

  if (nextStitchId === undefined) return;
  const at = layout.cells.get(nextStitchId);
  if (!at) return;
  const { x, y } = cellAt(layout, at.row, at.column, cell);
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 1, y - 1, cell + 2, cell + 2);
  ctx.restore();
};
