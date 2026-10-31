import { isFabric, isStep } from "../types/Stitch";
import { consumption } from "../types/StitchType";
import type { SweaterStitches } from "./engine";
import { type Cell, type ChartLayout, chartRows } from "./layout";
import { markerRoutes, markersPassed } from "./marker-routes";
import type { RoundKind } from "./needles";

/**
 * The knitting as the knitter counts it at a point in the work: its rounds
 * cut at the beginning of the round in force there, and the chart turned so
 * that beginning is its right-hand edge.
 *
 * A chart is a view of the stitches in the order they are worked. Where a
 * round begins is only where the knitter's marker is: move it a quarter of the
 * way round and the same stitches are cut into rounds a quarter of the way
 * along - the first a quarter long, every one after it whole, the last a
 * quarter long again. So the whole chart is cut at the beginning in force,
 * what has been knitted and what is still to come, and redrawn when a pattern
 * places a new one, or when undoing takes it away again.
 *
 * Laid out once, from the rounds as they are worked from the seam (see
 * physics/knitting): a column is a column of the knitting wherever the rounds
 * are cut, so the view only turns the columns and cuts the rows again.
 */
export interface View {
  /** The stitches in each round, as the knitter counts them now, in the order they are worked. */
  rounds: number[][];
  /** What each is: the pattern's name for the round its first stitch is in. */
  labels: string[];
  /** The piece each belongs to: the piece of its last stitch. */
  pieces: string[];
  kinds: RoundKind[];
  /** The row of the chart each round is in, which is what the knitting numbers it. */
  rows: number[];
  /** The chart, turned and cut again: each round's row, each stitch's cell. Laid out only once asked for. */
  readonly layout: ChartLayout;
  /** Each marker on the needles, as a line up the chart between two columns. */
  readonly markers: MarkerLine[];
  /** The step that placed the beginning of the round in force, or none while it is at the seam. */
  beginning?: number;
}

/** A stitch marker, up the chart: between two columns, from the row it is placed in to the row it comes off in. */
export interface MarkerLine {
  marker: string;
  /** The column it stands to the left of, counted from the chart's right-hand edge, where it is placed. */
  after: number;
  from: number;
  to: number;
  /** The steps placing it and taking it off, where it comes off. */
  placed: number;
  off?: number;
  /** Row by row, up from the row it is placed in: see MarkerRow. */
  route: MarkerRow[];
  /**
   * A marker at the start of the round, beside each round's first stitch:
   * drawn up one boundary, to the right of the first stitch of every row it
   * is in, however far into the row that is (see startLine).
   */
  atStart?: boolean;
  /**
   * The start of the round again, at the chart's other edge, beside the
   * short rows that cross it: the chart is cut at the beginning of the
   * round, so its left edge and its right are the same place on the needles,
   * and a short row passes the marker between them. Drawn row by row, each
   * reached in its own row, with no bars across: it is placed and taken off
   * where the start of the round's line is.
   */
  edge?: boolean;
}

/**
 * A start of the round's rows all on the one boundary, to the right of every
 * row's first stitch: the chart's edge, for the round it begins.
 */
export const startLine = (route: MarkerRow[]): MarkerRow[] => {
  const after = Math.min(...route.map((row) => (row.beside ?? row.after + 1) - 1));
  return route.map((row) => ({ ...row, after }));
};

/** A marker in one row: the column it stands to the left of, and the stitch it is reached after - in the row it is placed in, the step placing it. */
export interface MarkerRow {
  row: number;
  after: number;
  passed: number;
  /** The round's first stitch. */
  start: number;
  /** For a marker at the start of the round, the column of the round's first stitch, which it stands beside: see atStart. */
  beside?: number;
}

/** Every step placing a new beginning of the round, once a sweater: most have none. */
const beginnings = new WeakMap<object, number[]>();

/** The step that placed the beginning of the round in force once `progress` stitches are worked, if any did. */
export const beginningAt = (built: Pick<SweaterStitches, "stitches">, progress: number): number | undefined => {
  let steps = beginnings.get(built.stitches);
  if (!steps) {
    steps = built.stitches.filter((stitch) => stitch.type === "marker" && stitch.begins).map((stitch) => stitch.id);
    beginnings.set(built.stitches, steps);
  }
  let found: number | undefined;
  for (const id of steps) if (id <= progress) found = id;
  return found;
};

/** The fabric stitch at or before `id`, past any steps. */
const fabricBefore = (built: Pick<SweaterStitches, "stitches">, id: number): number => {
  let at = id;
  while (at > 0 && !isFabric(built.stitches[at])) at--;
  return at;
};

/**
 * Cut the rounds of a ring at a boundary after column `after` of `width`:
 * walking its stitches in the order worked, a round ends wherever the walk
 * comes round past the boundary - where a stitch's distance round from it
 * falls rather than rises. Rows worked to and fro, short rows, are only ever
 * cut at their turns.
 */
export const cutAt = (
  rounds: { ids: number[]; turned: boolean }[],
  columnOf: (id: number) => number,
  after: number,
  width: number,
): number[][] => {
  const cut: number[][] = [];
  let round: number[] = [];
  let last = -1;
  const distance = (id: number) => (((Math.round(columnOf(id)) - after - 1) % width) + width) % width;
  const close = () => {
    if (round.length > 0) cut.push(round);
    round = [];
    last = -1;
  };
  for (const { ids, turned } of rounds) {
    if (turned) {
      close();
      cut.push([...ids]);
      continue;
    }
    for (const id of ids) {
      const at = distance(id);
      if (last >= 0 && at < last) close();
      round.push(id);
      last = at;
    }
  }
  close();
  return cut;
};

/** A column turned so that the boundary after column `after` is the chart's right-hand edge. */
export const turned = (column: number, after: number, width: number): number =>
  ((((column - after - 1) % width) + width) % width) + 1;

/** The knitting as the knitter counts it once `progress` stitches are worked: see View and viewFor. */
export const viewAt = (built: SweaterStitches, layout: ChartLayout, progress: number): View =>
  viewFor(built, () => layout, beginningAt(built, progress));

/**
 * The knitting as the knitter counts it with the beginning of the round
 * placed by the step `beginning`, or at the seam: see View. `layoutOf` lays
 * the chart out from the rounds as worked from the seam, `knitting.rounds`;
 * while the beginning is at the seam, that is the view's chart as it is, and
 * it is only laid out when the chart is drawn.
 */
export const viewFor = (built: SweaterStitches, layoutOf: () => ChartLayout, beginning: number | undefined): View => {
  const { stitches, knitting } = built;
  // The pattern's name for the round each stitch is in.
  const labelOf = new Map<number, string>();
  built.rounds.forEach((round, index) => round.forEach((id) => labelOf.set(id, built.roundLabels[index])));
  const kindOf = (kind: string): RoundKind => (kind === "right" || kind === "wrong" ? kind : "round");

  if (beginning === undefined) {
    let lines: MarkerLine[] | undefined;
    return {
      rounds: knitting.rounds,
      labels: knitting.rounds.map((round) => labelOf.get(round[0]) ?? ""),
      pieces: knitting.roundPieces,
      kinds: knitting.roundKinds.map(kindOf),
      rows: chartRows(knitting.roundPieces),
      get layout() {
        return layoutOf();
      },
      get markers() {
        return (lines ??= markerLines(built, (id) => layoutOf().cells.get(id)));
      },
    };
  }
  const layout = layoutOf();

  /*
   * The rings: the yoke and the body knitted on from it, then each piece
   * begun from held stitches, a ring of its own. The beginning in force is the
   * one placed in the ring the chart is turned for, the yoke's and the body's.
   */
  const width = layout.columns;
  const after = Math.round(layout.cells.get(fabricBefore(built, beginning))?.column ?? 0);
  const ringOf = new Map<string, number>();
  let ring = 0;
  knitting.roundPieces.forEach((piece, index) => {
    if (ringOf.has(piece)) return;
    const first = knitting.rounds[index][0];
    let at = first - 1;
    while (at > 0 && isStep(stitches[at]) && stitches[at].type !== "resume") at--;
    if (index > 0 && stitches[at]?.type === "resume") ring++;
    ringOf.set(piece, ring);
  });
  const turnedRing = ringOf.get(stitches[fabricBefore(built, beginning)].piece) ?? 0;

  const rounds: number[][] = [];
  const pieces: string[] = [];
  const kinds: RoundKind[] = [];
  const rowOf: number[] = [];
  const cells = new Map<number, Cell>();
  const row = new Map<number, number>();
  let rows = 0;

  for (let r = 0; r <= ring; r++) {
    const indices = knitting.rounds.flatMap((_, index) => (ringOf.get(knitting.roundPieces[index]) === r ? [index] : []));
    const cut =
      r === turnedRing
        ? cutAt(
            indices.map((index) => ({
              ids: knitting.rounds[index],
              turned: knitting.roundKinds[index] === "right" || knitting.roundKinds[index] === "wrong",
            })),
            (id) => layout.cells.get(id)?.column ?? 0,
            after,
            width,
          )
        : indices.map((index) => knitting.rounds[index]);
    // A round left whole keeps its kind - a short row is still one - and every round cut again is a round.
    const whole = new Map(indices.map((index) => [knitting.rounds[index][0], index]));
    const kindOfCut = (ids: number[]) => {
      const index = whole.get(ids[0]);
      return index !== undefined && knitting.rounds[index].length === ids.length ? kindOf(knitting.roundKinds[index]) : "round";
    };
    /*
     * The first ring from the bottom of the chart; a piece begun from held
     * stitches in the row above the highest of them, as every stitch stands
     * over what it was worked into.
     */
    let at = 0;
    if (r > 0) {
      for (const id of cut[0] ?? []) {
        const stitch = stitches[id];
        for (const below of stitch.links.slice(0, consumption[stitch.type])) at = Math.max(at, row.get(below) ?? 0);
      }
    }
    for (const ids of cut) {
      at++;
      rounds.push(ids);
      pieces.push(stitches[ids[ids.length - 1]].piece);
      kinds.push(kindOfCut(ids));
      rowOf.push(at);
      rows = Math.max(rows, at);
      ids.forEach((id, position) => {
        row.set(id, at);
        const cell = layout.cells.get(id);
        cells.set(id, {
          row: at,
          round: rounds.length,
          column: cell ? turned(cell.column, after, width) : position + 1,
          index: position + 1,
          piece: cell?.piece ?? stitches[id].piece,
        });
      });
    }
  }

  const viewLayout: ChartLayout = { cells, rows, columns: width, roundRows: rowOf };
  return {
    rounds,
    labels: rounds.map((round) => labelOf.get(round[0]) ?? ""),
    pieces,
    kinds,
    rows: rowOf,
    layout: viewLayout,
    markers: markerLines(built, (id) => cells.get(id)),
    beginning,
  };
};

/**
 * Every marker placed on the needles, as a line up the chart: row by row,
 * on the boundary to the left of the stitch before it, from the row it is
 * placed in to the row it comes off in - or the end of its piece, where it
 * never does. Not the beginning of the round, which the chart's own edge is.
 */
const markerLines = (built: SweaterStitches, cellOf: (id: number) => Cell | undefined): MarkerLine[] =>
  markerRoutes(built).flatMap(({ marker, placed, off, rounds }) => {
    const route: MarkerRow[] = [];
    const atStart = rounds.some((round) => round.atStart);
    rounds.forEach((round, k) => {
      // At the start of the round, beside the round's first stitch.
      const cell = cellOf(atStart ? round.after : round.before);
      if (!cell) return;
      // Taken off, it is reached where it came up to, whatever is either side of it there; a short row is where the round before it is.
      const last = route[route.length - 1];
      const after = (round.takenOff || round.turned) && last ? last.after : Math.round(cell.column);
      const row: MarkerRow = { row: cell.row, after, passed: k === 0 ? placed : round.before, start: round.start, ...(atStart ? { beside: (round.turned && last?.beside) || after } : {}) };
      if (last && last.row === row.row) route[route.length - 1] = row;
      else if (last && atStart && row.row > last.row + 1) {
        // A row with no round begun in it of its own, a short row's sharing the row before: reached with the row above.
        for (let between = last.row + 1; between < row.row; between++) route.push({ ...row, row: between });
        route.push(row);
      } else route.push(row);
    });
    if (route.length === 0) return [];
    const lined = atStart ? startLine(route) : route;
    const line: MarkerLine = { marker, after: lined[0].after, from: lined[0].row, to: lined[lined.length - 1].row, placed, ...(off === undefined ? {} : { off }), route: lined, ...(atStart ? { atStart } : {}) };
    return atStart ? [line, ...seamEdges(built, marker, placed, rounds, cellOf)] : [line];
  });

/**
 * The start of the round at the chart's other edge, beside the short rows
 * that cross it: a line for each run of them, one above another, up the
 * boundary on the far side of the stitch at that edge. See MarkerLine.edge.
 */
const seamEdges = (
  built: SweaterStitches,
  marker: string,
  placed: number,
  rounds: { start: number; turned?: boolean }[],
  cellOf: (id: number) => Cell | undefined,
): MarkerLine[] => {
  const { stitches, knitting } = built;
  const passed = markersPassed(built);
  const roundAt = new Map<number, number[]>();
  knitting.rounds.forEach((round) => roundAt.set(round[0], round));
  const rows: MarkerRow[] = [];
  for (const round of rounds) {
    if (!round.turned) continue;
    const ids = (roundAt.get(round.start) ?? []).filter((id) => isFabric(stitches[id]));
    const k = ids.findIndex((id) => passed.get(id) === marker);
    if (k < 0 || k + 1 >= ids.length) continue;
    // Of the two either side of where it is passed, the one at the chart's far edge: the line stands to its left.
    const sides = [cellOf(ids[k]), cellOf(ids[k + 1])].filter((cell): cell is Cell => cell !== undefined);
    if (sides.length < 2) continue;
    const far = sides[0].column > sides[1].column ? sides[0] : sides[1];
    rows.push({ row: sides[0].row, after: Math.round(far.column), passed: ids[k], start: round.start });
  }
  // A line for each run of rows one above another, all up the one boundary, the furthest out.
  const runs: MarkerRow[][] = [];
  for (const row of rows.sort((a, b) => a.row - b.row)) {
    const last = runs[runs.length - 1];
    if (last && row.row === last[last.length - 1].row + 1) last.push(row);
    else if (!last || row.row !== last[last.length - 1].row) runs.push([row]);
  }
  return runs.map((run) => {
    const after = Math.max(...run.map((row) => row.after));
    const route = run.map((row) => ({ ...row, after }));
    return { marker, after, from: route[0].row, to: route[route.length - 1].row, placed, route, edge: true };
  });
};
