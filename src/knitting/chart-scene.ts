import { Stitch } from "../types/Stitch";
import type { ChartLayout } from "./layout";
import { type RowIndex, indexRows } from "./column-window";
import { type Face, type Hold, type Join, type Turn, markAt } from "./chart-marks";
import { seenFrom } from "./sides";
import type { Mark } from "../helpers/stitch-marks";
import type { MarkerLine } from "./view";

/** Every fifth row and column is counted by: numbered down the edge, and ruled heavier. */
export const emphasis = 5;

/** Where the needles change: the row before the change, and the piece it is in. */
export interface NeedleRule {
  after: number;
  piece: string;
}

/**
 * Which rows get a number down the right-hand edge, the row's own number,
 * which is what the knitting calls its rounds; see chartRows.
 *
 * Every fifth, each piece's first and the chart's last - and both rows a
 * change of needles falls between, so the line across the chart can be named
 * in words and found by eye.
 */
export const numberedRows = (layout: ChartLayout, needleChanges: NeedleRule[] = []): number[] => {
  const named = new Set<number>();
  needleChanges.forEach((change) => {
    named.add(change.after);
    named.add(change.after + 1);
  });
  // Each piece's first row: the neck's, and the one the body and the sleeves all begin in.
  const first = new Map<string, number>();
  layout.cells.forEach((at) => first.set(at.piece, Math.min(at.row, first.get(at.piece) ?? at.row)));
  first.forEach((row) => named.add(row));
  const out: number[] = [];
  for (let row = 1; row <= layout.rows; row++) {
    if (row % emphasis === 0 || row === 1 || row === layout.rows || named.has(row)) out.push(row);
  }
  return out;
};

/**
 * Everything the chart draws, gathered once for a layout, so that any piece
 * of it can be painted on its own: a tile of the chart as it scrolls into
 * view, at whatever place the columns have been given. See chart-painter.
 *
 * Built afresh when the layout, the side shown or the knitting changes, and
 * never as you knit: what changes then - how much is done, what is on hold -
 * is read at the time of painting.
 */
export interface ChartScene {
  layout: ChartLayout;
  index: RowIndex;
  stitches: Stitch[];
  rounds: number[][];
  /** Where each stitch is on the chart, by id: its row, or 0 where it is not drawn, and its column. */
  rowOf: Int32Array;
  columnOf: Int32Array;
  /** The yarn slot of each stitch in the index, by its place there. */
  slotAt: Uint16Array;
  slots: string[];
  /** The piece of each stitch in the index, by its place there. */
  pieceAt: Uint8Array;
  pieces: string[];
  /** The rows numbered down the edge. */
  numbered: number[];
  /** 1 for each stitch in the index whose mark is a fork across two loops, by its place there. */
  forkAt: Uint8Array;
  /** The furthest a fork reaches from its own column, to the stitch below or its second loop, in columns. */
  forkReach: number;
  /** For each round, by its place from 0, how many rounds before it share its row: side by side above the divide. */
  beside: Int32Array;
  needleRules: NeedleRule[];
  join?: Join;
  /** Which way the round before the join and the round after it run across the chart: -1 leftwards. */
  joinWays: [number, number];
  holds: Hold[];
  turns: Turn[];
  /** The stitch markers on the needles, each a line up the chart between two columns. */
  markers: MarkerLine[];
  face: Face;
  makeOneLean?: "left" | "right";
  /**
   * A stitch's mark. A fork across the two loops of an increase reaches to
   * the stitch below and the loop it makes, wherever their columns have been
   * put, so it is worked out from `centre`, each column's middle across the
   * chart; any other mark sits in its own cell, and is worked out once.
   */
  markOf(id: number, centre: (column: number) => number, cell: number): Mark | undefined;
}

const forks = new Set(["kfb", "kbf", "pfb", "pbf"]);

export const sceneOf = (
  layout: ChartLayout,
  stitches: Stitch[],
  rounds: number[][],
  options: {
    needleRules?: NeedleRule[];
    join?: Join;
    holds?: Hold[];
    turns?: Turn[];
    markers?: MarkerLine[];
    face?: Face;
    makeOneLean?: "left" | "right";
  } = {},
): ChartScene => {
  const { needleRules = [], join, holds = [], turns = [], markers = [], face = "right", makeOneLean } = options;
  const index = indexRows(layout);
  const size = stitches.length;
  const rowOf = new Int32Array(size);
  const columnOf = new Int32Array(size);
  layout.cells.forEach((at, id) => {
    if (id < 0 || id >= size) return;
    rowOf[id] = at.row;
    columnOf[id] = Math.round(at.column);
  });

  const slots: string[] = [];
  const slotIndex = new Map<string, number>();
  const pieces: string[] = [];
  const pieceIndex = new Map<string, number>();
  const slotAt = new Uint16Array(index.id.length);
  const pieceAt = new Uint8Array(index.id.length);
  const forkAt = new Uint8Array(index.id.length);
  let forkReach = 0;
  index.id.forEach((id, k) => {
    const type = stitches[id]?.type;
    // A KFB or a KBF, and so a PBF or a PFB from behind: each a fork, from whichever side.
    if (type === "kfb" || type === "kbf") {
      forkAt[k] = 1;
      for (const other of [stitches[id].links[0], id + 1]) {
        if (rowOf[other]) forkReach = Math.max(forkReach, Math.abs(columnOf[other] - columnOf[id]));
      }
    }
    const slot = stitches[id]?.slot ?? "";
    if (!slotIndex.has(slot)) {
      slotIndex.set(slot, slots.length);
      slots.push(slot);
    }
    slotAt[k] = slotIndex.get(slot)!;
    const piece = layout.cells.get(id)?.piece ?? "";
    if (!pieceIndex.has(piece)) {
      pieceIndex.set(piece, pieces.length);
      pieces.push(piece);
    }
    pieceAt[k] = pieceIndex.get(piece)!;
  });

  // Which way a round runs across the chart, from its first two stitches: -1 leftwards, as most do.
  const wayOf = (ids: number[] | undefined) => {
    const [a, b] = [ids?.[0], ids?.[1]];
    if (a === undefined || b === undefined || !rowOf[a] || !rowOf[b]) return -1;
    return columnOf[b] < columnOf[a] ? 1 : -1;
  };
  const joinWays: [number, number] = join ? [wayOf(rounds[join.after - 1]), wayOf(rounds[join.after])] : [-1, -1];

  const byId = { get: (id: number) => stitches[id] } as Map<number, Stitch>;
  const fixed = new Map<number, Mark | undefined>();
  const markOf = (id: number, centre: (column: number) => number, cell: number): Mark | undefined => {
    const stitch = stitches[id];
    if (!stitch) return undefined;
    if (!forks.has(seenFrom(stitch, face))) {
      if (!fixed.has(id)) fixed.set(id, markAt(stitch, byId, layout, makeOneLean, face));
      return fixed.get(id);
    }
    /*
     * markAt measures a fork by how many columns its ends are from the
     * stitch's own, so it is given columns that are where each is drawn:
     * a cell's width a column, counted the chart's way, leftwards.
     */
    const placed = {
      ...layout,
      cells: {
        get: (one: number) => {
          const at = layout.cells.get(one);
          return at && { ...at, column: -centre(Math.round(at.column)) / cell };
        },
      },
    } as unknown as ChartLayout;
    return markAt(stitch, byId, placed, makeOneLean, face);
  };

  const beside = new Int32Array(rounds.length);
  const seen = new Map<number, number>();
  rounds.forEach((_, round) => {
    const row = layout.roundRows[round] ?? round + 1;
    beside[round] = seen.get(row) ?? 0;
    seen.set(row, beside[round] + 1);
  });

  return {
    layout,
    index,
    stitches,
    rounds,
    rowOf,
    columnOf,
    slotAt,
    slots,
    pieceAt,
    pieces,
    numbered: numberedRows(layout, needleRules),
    forkAt,
    forkReach,
    beside,
    needleRules,
    join,
    joinWays,
    holds,
    turns,
    markers,
    face,
    makeOneLean,
    markOf,
  };
};
