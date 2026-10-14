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
  round: number,
  column: number,
  cell: number,
) => ({
  // The cast-on belongs at the bottom, and stitch 1 at the right.
  x: (layout.columns - column) * cell,
  y: (layout.rounds - round) * cell,
});

/** Room to the right of the chart for the round numbers. */
export const gutter = (cell: number) => Math.round(cell * 2.2);

export const chartSize = (layout: ChartLayout, cell: number) => ({
  width: layout.columns * cell + gutter(cell),
  height: layout.rounds * cell,
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

/** The cells of each round, keyed by round number. */
const byRound = (layout: ChartLayout): Map<number, Cell[]> => {
  const rows = new Map<number, Cell[]>();
  layout.cells.forEach((at) => {
    const row = rows.get(at.round);
    if (row) row.push(at);
    else rows.set(at.round, [at]);
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
    const row = rows.get(at.round) ?? [];
    row.push({ column: at.column, slot: stitch.slot });
    rows.set(at.round, row);
  }

  const paths = new Map<string, string[]>();
  for (const [round, cells] of rows) {
    for (const run of runsOf(cells, (a, b) => a.slot === b.slot)) {
      const { left, right } = extent(layout, run, cell);
      const parts = paths.get(run[0].slot) ?? [];
      parts.push(rect(left, cellAt(layout, round, 1, cell).y, right - left, cell));
      paths.set(run[0].slot, parts);
    }
  }

  return [...paths].map(([slot, parts]) => ({ slot, d: parts.join("") }));
};

/**
 * The rules between cells, as two paths: the hairlines, and the heavier ones
 * that fall after every fifth stitch and every fifth round.
 *
 * They follow the cells rather than a lattice laid over the whole chart,
 * because a chart of a shaped tube is not a rectangle: the columns a decrease
 * gives up are left empty, and the rules stop at the edge of the fabric so
 * those gaps read as the wedges of absent stitches they are.
 *
 * Collinear segments are merged, so a chart's worth of cell edges comes out as
 * a few hundred lines rather than one per cell.
 */
export const gridPaths = (
  layout: ChartLayout,
  cell: number,
  needleChanges: number[] = [],
): { light: string; heavy: string; needles: string } => {
  const needlesAt = new Set(needleChanges);
  const rows = byRound(layout);
  const runs = new Map<number, Cell[][]>();
  rows.forEach((cells, round) => runs.set(round, runsOf(cells)));

  const light: string[] = [];
  const heavy: string[] = [];
  const needles: string[] = [];

  /*
   * Horizontal rules: a boundary needs one wherever there is fabric on
   * either side of it, so the spans of the two rounds it separates are
   * merged before they are drawn.
   */
  const spans = (round: number) =>
    (runs.get(round) ?? []).map((run) => extent(layout, run, cell));

  for (let round = 0; round <= layout.rounds; round++) {
    const all = [...spans(round), ...spans(round + 1)].sort(
      (a, b) => a.left - b.left,
    );
    const y = (layout.rounds - round) * cell;
    // A change of needles takes the boundary for itself, dashed.
    const into = needlesAt.has(round)
      ? needles
      : round !== 0 && round % emphasis === 0
        ? heavy
        : light;
    let open: { left: number; right: number } | null = null;
    for (const span of all) {
      if (open && span.left <= open.right + 1e-6) {
        open.right = Math.max(open.right, span.right);
        continue;
      }
      if (open) into.push(`M${open.left} ${y}h${open.right - open.left}`);
      open = { ...span };
    }
    if (open) into.push(`M${open.left} ${y}h${open.right - open.left}`);
  }

  /*
   * And vertical rules, one per cell edge, gathered by where they fall so a
   * column that runs unbroken up the chart is a single line.
   */
  const lines = new Map<string, number[]>();
  const edge = (on: number, round: number) => {
    const key = `${on.toFixed(3)}|${onGrid(on) ? "h" : "l"}`;
    const at = lines.get(key);
    if (at) at.push(round);
    else lines.set(key, [round]);
  };

  runs.forEach((rounds, round) => {
    for (const run of rounds) {
      // The edge on the stitch-1 side of the run, then one per cell going left.
      edge(run[0].column - 1, round);
      for (const at of run) edge(at.column, round);
    }
  });

  lines.forEach((rounds, key) => {
    const [at, weight] = key.split("|");
    const into = weight === "h" ? heavy : light;
    const x = (layout.columns - Number(at)) * cell;
    rounds.sort((a, b) => a - b);
    let from = rounds[0];
    let last = rounds[0];
    const flush = () => {
      const top = (layout.rounds - last) * cell;
      into.push(`M${x} ${top}v${(last - from + 1) * cell}`);
    };
    for (let i = 1; i < rounds.length; i++) {
      if (rounds[i] === last + 1) {
        last = rounds[i];
        continue;
      }
      flush();
      from = rounds[i];
      last = rounds[i];
    }
    flush();
  });

  return {
    light: light.join(""),
    heavy: heavy.join(""),
    needles: needles.join(""),
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
    const { x, y } = cellAt(layout, at.round, at.column, cell);
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
    const y = (layout.rounds - (index + 1)) * cell;
    for (const run of runsOf(worked)) {
      const { left, right } = extent(layout, run, cell);
      parts.push(rect(left, y, right - left, cell));
    }
  }
  return parts.join("");
};

/**
 * Which rounds get a number down the right-hand edge.
 *
 * Every fifth, the first and the last - and both rounds a change of needles
 * falls between, so the line across the chart can be named in words and
 * found by eye.
 */
export const numberedRounds = (
  layout: ChartLayout,
  needleChanges: number[] = [],
): number[] => {
  const named = new Set<number>();
  needleChanges.forEach((round) => {
    named.add(round);
    named.add(round + 1);
  });
  const out: number[] = [];
  for (let round = 1; round <= layout.rounds; round++) {
    if (
      round % emphasis === 0 ||
      round === 1 ||
      round === layout.rounds ||
      named.has(round)
    ) {
      out.push(round);
    }
  }
  return out;
};
