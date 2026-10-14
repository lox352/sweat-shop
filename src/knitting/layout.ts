import type { RoundKind } from "./needles";
import { Stitch, isFabric } from "../types/Stitch";
import { consumption } from "../types/StitchType";

export interface Cell {
  /** The row of the chart it is drawn in, 1-based, counting up from the cast-on. */
  row: number;
  /**
   * Which of the chart's rounds it belongs to, 1-based. On a chart of one
   * piece that is its row as well; on the whole sweater's, the body and the
   * sleeves share the rows above the divide, each in its own columns.
   */
  round: number;
  /**
   * Where the stitch sits across the chart, counting from the right-hand edge
   * where stitch 1 is.
   *
   * Fractional, because a stitch sits over the middle of what it was worked
   * into: a k2tog takes two columns together and so lands on the half column
   * between them, and every stitch above it inherits that half.
   */
  column: number;
  /** 1-based stitch number within its round, for counting and for the rules. */
  index: number;
  /** The piece of the sweater it belongs to. */
  piece: string;
}

export interface ChartLayout {
  cells: Map<number, Cell>;
  /** How many rows the chart has. */
  rows: number;
  columns: number;
  /** The row each round is drawn in, by its place among the chart's rounds from 0. */
  roundRows: number[];
  /**
   * What each row is numbered in the margin, by row from 0: the round it is
   * of its piece, so the body's twentieth round is 20 there as it is in the
   * knitting panel, and so is each sleeve's beside it.
   */
  numbers: number[];
}

/** The stitches of the round below that this one is worked into. */
const worksInto = (stitch: Stitch): number[] =>
  stitch.links.slice(0, consumption[stitch.type]);

/**
 * Which of a family's columns the other side of it lines up with.
 *
 * "middle" is a symmetric stitch: a centred double decrease stands on the
 * middle of its three, and a stitch that becomes two straddles it. The other
 * two are the leaning ones, named by where on the chart they sit, which reads
 * right to left from column 1: a right-leaning k2tog stands on the right-hand
 * (lower) of its two columns and leaves a gap on its left, and a KFB keeps
 * its own column and puts the new stitch in a gap to its left.
 */
export type Lean = "right" | "middle" | "left";

/**
 * A family's columns in order across the chart, right to left.
 *
 * A chart is a cylinder cut open, and one family a round straddles the cut:
 * a centred decrease worked as a round's first stitch takes the last stitch
 * of the round below with it, which is the stitch to its right and is drawn
 * at the far left. Left as it lies it drags the family right across the
 * chart. So anything more than half a chart away from the nearest of them
 * has come round the seam, and belongs just off the other end.
 */
const unwrapped = (columns: number[], width: number): number[] => {
  const near = Math.min(...columns);
  return columns
    .map((at) => (at - near > width / 2 ? at - width : at))
    .sort((a, b) => a - b);
};

/**
 * The column of these that a family lines up with, counted by stitch rather
 * than by distance.
 *
 * For "middle" that is the middle one of three exactly, and with two the half
 * column between them. Which is not the same as averaging their positions,
 * and the difference is the whole of why a crown's decrease line runs
 * straight: the stitches a decrease takes together stop being evenly spaced
 * the moment the crown has opened a wedge beside them, so their average
 * creeps a fraction of a column towards the wider side every round, and
 * sixteen rounds of that is a decrease line you can see bending. Counting
 * instead ignores how wide the gaps either side have grown, so a decrease
 * inherits the column of the stitch below it exactly, round after round, and
 * never moves.
 */
const pick = (columns: number[], width: number, lean: Lean): number => {
  // One for one, as most of a sweater is: nothing to choose between.
  if (columns.length === 1) return columns[0] < 1 ? columns[0] + width : columns[0];
  const sorted = unwrapped(columns, width);
  const half = Math.floor(sorted.length / 2);
  const at =
    lean === "right"
      ? sorted[0]
      : lean === "left"
        ? sorted[sorted.length - 1]
        : sorted.length % 2 === 1
          ? sorted[half]
          : (sorted[half - 1] + sorted[half]) / 2;
  return at < 1 ? at + width : at;
};

/**
 * A group of stitches and the stitches of the round below they came out of.
 *
 * Usually one and one - a knit is worked into a single stitch and leaves a
 * single stitch. A decrease has several below it and one above; an increase
 * has one below and several above, because a make-one is worked into nothing
 * at all and so belongs with the stitch beside it rather than on its own.
 * Grouping them is what lets both be laid out by the same rule.
 */
interface Family {
  below: number[];
  above: number[];
}

/**
 * Whether a make-one is the second loop of the KFB worked just before it,
 * rather than a stitch picked up on its own between two others.
 */
export const isSecondLoop = (stitch: Stitch, byId: Map<number, Stitch>): boolean =>
  stitch.type === "m1" && byId.get(stitch.id - 1)?.type === "kfb";

/**
 * How a family lines up with the round below.
 *
 * Decreases by the way they lean. An increase by what made it: a KFB keeps
 * its stitch over the one it was worked into and puts the new one beside it,
 * to its left; anything else that makes two of one - a make-one only ever
 * joins a family when there is nowhere else to put it - straddles it.
 */
const leanOf = (family: Family, byId: Map<number, Stitch>): Lean => {
  if (family.above.length > 1) {
    return family.above.some((id) => byId.get(id)?.type === "kfb")
      ? "right"
      : "middle";
  }
  switch (byId.get(family.above[0])?.type) {
    case "k2tog":
      return "right";
    case "ssk":
    case "sk2p":
      return "left";
    default:
      return "middle";
  }
};

const familiesOf = (
  above: number[],
  byId: Map<number, Stitch>,
  /**
   * Leave a make-one picked up between two stitches out of any family, so it
   * keeps whatever column the round above gave it and the round below simply
   * has no stitch under it. Only possible working down from the widest round;
   * working up there is no column for it yet, and it straddles the stitch
   * before it instead.
   */
  standalone = false,
): Family[] => {
  const families: Family[] = [];
  /** Increases seen before any stitch that has something below it. */
  let orphans: number[] = [];

  for (const id of above) {
    const stitch = byId.get(id);
    if (!stitch) continue;
    const below = worksInto(stitch);
    if (below.length === 0) {
      if (standalone && !isSecondLoop(stitch, byId)) continue;
      const last = families[families.length - 1];
      if (last) last.above.push(id);
      else orphans.push(id);
      continue;
    }
    families.push({ below, above: [id] });
  }

  if (orphans.length > 0 && families.length > 0) {
    families[0].above.unshift(...orphans);
    orphans = [];
  }
  return families;
};

/**
 * Lay out one side of a family against a column on the other side of it.
 *
 * Its stitches go in a row, one column apart, with the one at `anchor` on
 * the column: a symmetric family is centred on it, a k2tog's right-hand
 * stitch below it stands under it, and a KFB's own stitch above it stands
 * over it with the new stitch in the gap beside. It is the same rule read in
 * either direction, which is what makes a decrease and an increase mirror
 * images of each other on the chart rather than two separate special cases.
 */
const place = (
  ids: number[],
  on: number,
  lean: Lean,
  column: Map<number, number>,
  /** 1 for a round worked right to left on the chart, -1 left to right. */
  way = 1,
) => {
  const anchor =
    lean === "right" ? 0 : lean === "left" ? ids.length - 1 : (ids.length - 1) / 2;
  ids.forEach((id, index) => {
    column.set(id, on + way * (index - anchor));
  });
};

/** A lean as it looks from the other face of the fabric. */
const mirrored = (lean: Lean): Lean =>
  lean === "right" ? "left" : lean === "left" ? "right" : "middle";

const columnsOf = (ids: number[], column: Map<number, number>): number[] =>
  ids.map((id) => column.get(id)).filter((at): at is number => at !== undefined);

/**
 * The stitches of these rounds, by id. A sweater's stitches are listed in the
 * order they are worked, each at the place its id gives, so every stitch is
 * found there directly, and only the piece being laid out is indexed rather
 * than every stitch of the sweater - which, at eighty thousand, cost more than
 * laying the piece out.
 */
const indexOf = (stitches: Stitch[], rounds: number[][]): Map<number, Stitch> => {
  let all: Map<number, Stitch> | undefined;
  const byId = new Map<number, Stitch>();
  for (const round of rounds) {
    for (const id of round) {
      let stitch: Stitch | undefined = stitches[id];
      if (stitch?.id !== id) stitch = (all ??= new Map(stitches.map((one) => [one.id, one]))).get(id);
      if (stitch) byId.set(id, stitch);
    }
  }
  return byId;
};

/**
 * Lay a piece out flat as a chart: every stitch over the stitches it was
 * worked into, and under the stitches worked into it.
 *
 * It is the hat site's layout, and what it gives a chart is that a column is
 * a column of the knitting. Two cells one above the other are one stitch
 * worked into the other, all the way up, so a line of the colourwork can be
 * followed up the chart as it runs up the fabric. A plain knit inherits its
 * column exactly; a centred double decrease sits on the middle of the three
 * it took together, and a leaning one on the stitch it leans onto - a k2tog
 * on the right of its two, an ssk on the left. Read the other way, a KFB
 * keeps its column and the stitch it makes sits beside it, and a make-one
 * picked up between two stitches sits over the gap between them.
 *
 * So a column begins only where a stitch is made out of nothing, and ends
 * only where a decrease takes it in. Under a make-one the column is empty,
 * which in a yoke is much of what lies below its widest round: the neck has
 * a third of the stitches the yoke divides with, and its rib spans the whole
 * chart with a gap wherever an increase is yet to come in, each band a little
 * denser than the one below it. Over the columns a sleeve's decreases give up
 * it is empty too: the staircase a printed sleeve chart shows either side of
 * the underarm.
 *
 * The widest round anchors the grid, at one column per stitch, and everything
 * else is propagated away from it in both directions: down the yoke from the
 * round it divides from, up the body and the sleeves from the rounds that
 * begin them.
 *
 * A short row is laid out by the same rule, part of the way across: the back
 * of the neck, which, the round beginning at the middle of the back, is at
 * both ends of the chart. One worked from the wrong side goes the other way
 * across - the chart is turned over to be read along it, see mirrorLayout -
 * and where such a row shapes, its leans are mirrored to match.
 */
export const layOut = (
  stitches: Stitch[],
  rounds: number[][],
  /** Whether each is a round or a short row, and from which side: see Needles.row. */
  kinds: RoundKind[] = [],
): ChartLayout => {
  const byId = indexOf(stitches, rounds);
  const widest = rounds.reduce((most, round) => Math.max(most, round.length), 0);
  const anchor = rounds.findIndex((round) => round.length === widest);
  const column = new Map<number, number>();

  // Which way across the chart a round is worked: right to left, as a chart is read, but for a row worked back.
  const way = (index: number) => (kinds[index] === "wrong" ? -1 : 1);
  const leanIn = (family: Family, index: number) =>
    way(index) === 1 ? leanOf(family, byId) : mirrored(leanOf(family, byId));

  if (anchor >= 0) {
    rounds[anchor].forEach((id, index) =>
      column.set(id, way(anchor) === 1 ? index + 1 : widest - index),
    );
  }

  // Upwards from the anchor: over what it was worked into.
  for (let index = anchor + 1; index < rounds.length; index++) {
    for (const family of familiesOf(rounds[index], byId)) {
      const below = columnsOf(family.below, column);
      const lean = leanIn(family, index);
      if (below.length > 0) place(family.above, pick(below, widest, lean), lean, column, way(index));
    }
  }

  // And downwards: under whatever was worked into it, in the order the round above took them.
  for (let index = anchor - 1; index >= 0; index--) {
    for (const family of familiesOf(rounds[index + 1], byId, true)) {
      const above = columnsOf(family.above, column);
      const lean = leanIn(family, index + 1);
      if (above.length > 0) place(family.below, pick(above, widest, lean), lean, column, way(index + 1));
    }
  }

  const cells = new Map<number, Cell>();
  rounds.forEach((round, index) => {
    round.forEach((id, position) => {
      cells.set(id, {
        row: index + 1,
        round: index + 1,
        column: column.get(id) ?? position + 1,
        index: position + 1,
        piece: byId.get(id)?.piece ?? "",
      });
    });
  });
  const rows = rounds.map((_, index) => index + 1);
  return { cells, rows: rounds.length, columns: widest, roundRows: rows, numbers: rows };
};

/**
 * Lay the whole sweater out as one chart: the yoke, and above it the body and
 * both sleeves side by side, each over the part of the yoke it was knitted
 * out of.
 *
 * The yoke is laid out as a piece of its own; see layOut. Every piece after
 * it begins from the yoke's last round - the body from its back and front,
 * each sleeve from the stitches it held - so each of their stitches stands
 * over the stitch it was worked into, as everywhere else, and a column is
 * still a column of the knitting, all the way from the neck to a cuff.
 *
 * What none of the yoke's columns can carry is a stitch made out of nothing
 * after it: the stitches the body casts on at each underarm, and the ones
 * each sleeve picks up out of them. Those are given columns of their own, let
 * in beside the stitches they are worked next to - a sleeve's picked-up
 * stitches either side of its held ones, and the body's underarm after the
 * sleeve whose place it takes, as the dividing round comes to them - and
 * like a make-one's, those columns are empty all the way down the yoke.
 *
 * Above the divide a row holds a round of each piece: the body's twentieth
 * round, and each sleeve's twentieth beside it. Knitting round the body
 * leaves the sleeves' columns to one side, and knitting a sleeve goes up its
 * own columns a row at a time; the knitting panel and the chart's mark on the
 * next stitch follow it there.
 */
export const layOutSweater = (
  stitches: Stitch[],
  rounds: number[][],
  /** Whether each is a round or a short row, and from which side: see Needles.row. */
  kinds: RoundKind[] = [],
  /** The piece each round belongs to, the pieces in the order they are knitted. */
  roundPieces: string[] = [],
): ChartLayout => {
  const yokeCount = roundPieces.findIndex((piece) => piece !== roundPieces[0]);
  if (yokeCount <= 0) return layOut(stitches, rounds, kinds);
  const yoke = layOut(stitches, rounds.slice(0, yokeCount), kinds.slice(0, yokeCount));
  const byId = indexOf(stitches, rounds);
  const parentOf = (id: number) => {
    const stitch = byId.get(id);
    return stitch ? worksInto(stitch)[0] : undefined;
  };

  // The pieces after the yoke, each a run of rounds.
  const pieces: { piece: string; indices: number[] }[] = [];
  for (let index = yokeCount; index < rounds.length; index++) {
    const last = pieces[pieces.length - 1];
    if (last?.piece === roundPieces[index]) last.indices.push(index);
    else pieces.push({ piece: roundPieces[index], indices: [index] });
  }

  /*
   * Where the stitches made out of nothing go: a run of them is let in just
   * before the next stitch of their round that has a column, or, at the end
   * of a round, just after the last. The gap they go in is between two of
   * the yoke's columns; in a gap that takes runs both ways, the ones after
   * the column to its right come first.
   */
  const gaps = new Map<number, { after: number[][]; before: number[][] }>();
  const letIn = (gap: number, side: "after" | "before", ids: number[]) => {
    const at = gaps.get(gap) ?? { after: [], before: [] };
    at[side].push(ids);
    gaps.set(gap, at);
  };
  for (const { indices } of pieces) {
    let waiting: number[] = [];
    let previous: number | undefined;
    for (const id of rounds[indices[0]]) {
      const parent = parentOf(id);
      const column = parent === undefined ? undefined : yoke.cells.get(parent)?.column;
      if (column === undefined) {
        waiting.push(id);
        continue;
      }
      if (waiting.length > 0) letIn(Math.round(column) - 0.5, "before", waiting);
      waiting = [];
      previous = column;
    }
    if (waiting.length > 0) letIn(Math.round(previous ?? yoke.columns) + 0.5, "after", waiting);
  }

  // The yoke's columns, renumbered with the new ones in among them.
  let columns = 0;
  const moved = new Map<number, number>();
  const madeAt = new Map<number, number>();
  const fill = (gap: number) => {
    const at = gaps.get(gap);
    if (!at) return;
    for (const ids of [...at.after, ...at.before]) for (const id of ids) madeAt.set(id, ++columns);
  };
  for (let column = 1; column <= yoke.columns; column++) {
    fill(column - 0.5);
    moved.set(column, ++columns);
  }
  fill(yoke.columns + 0.5);
  const shift = (column: number) => {
    const whole = Math.min(Math.max(Math.floor(column), 1), yoke.columns);
    return (moved.get(whole) ?? whole) + (column - Math.floor(column));
  };

  const cells = new Map<number, Cell>();
  yoke.cells.forEach((cell, id) => cells.set(id, { ...cell, column: shift(cell.column) }));
  const roundRows = [...yoke.roundRows];
  const numbers = [...yoke.numbers];
  let rows = yoke.rows;

  for (const { piece, indices } of pieces) {
    const column = new Map<number, number>();
    for (const id of rounds[indices[0]]) {
      const parent = parentOf(id);
      const over = parent === undefined ? undefined : cells.get(parent)?.column;
      const at = over ?? madeAt.get(id);
      if (at !== undefined) column.set(id, at);
    }
    // Up the piece, each stitch over what it was worked into.
    for (let k = 1; k < indices.length; k++) {
      for (const family of familiesOf(rounds[indices[k]], byId)) {
        const below = columnsOf(family.below, column);
        const lean = leanOf(family, byId);
        if (below.length > 0) place(family.above, pick(below, columns, lean), lean, column);
      }
    }
    indices.forEach((index, k) => {
      const row = yoke.rows + k + 1;
      roundRows[index] = row;
      numbers[row - 1] = k + 1;
      rows = Math.max(rows, row);
      rounds[index].forEach((id, position) =>
        cells.set(id, {
          row,
          round: index + 1,
          column: column.get(id) ?? position + 1,
          index: position + 1,
          piece,
        }),
      );
    });
  }

  return { cells, rows, columns, roundRows, numbers };
};

/**
 * The chart turned over, left for right: how it looks from the other face,
 * which is the one towards you while a short row is purled back. Every stitch
 * keeps its round and its stitch number; only which side of the chart the
 * columns count from changes.
 */
export const mirrorLayout = (layout: ChartLayout): ChartLayout => ({
  ...layout,
  cells: new Map(
    [...layout.cells].map(([id, cell]) => [id, { ...cell, column: layout.columns + 1 - cell.column }]),
  ),
});

/** The stitches to draw: not the phantom start of the cast-on, nor a step. */
export const chartedStitches = (stitches: Stitch[]): Stitch[] =>
  stitches.filter(isFabric);
