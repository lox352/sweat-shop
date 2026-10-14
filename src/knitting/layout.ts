import type { RoundKind } from "./needles";
import { Stitch, isFabric } from "../types/Stitch";
import { consumption } from "../types/StitchType";

export interface Cell {
  /** 1-based, counting up from the cast-on. */
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
}

export interface ChartLayout {
  cells: Map<number, Cell>;
  rounds: number;
  columns: number;
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
const place = (ids: number[], on: number, lean: Lean, column: Map<number, number>) => {
  const anchor =
    lean === "right" ? 0 : lean === "left" ? ids.length - 1 : (ids.length - 1) / 2;
  ids.forEach((id, index) => {
    column.set(id, on + index - anchor);
  });
};

const columnsOf = (ids: number[], column: Map<number, number>): number[] =>
  ids.map((id) => column.get(id)).filter((at): at is number => at !== undefined);

/**
 * Lay a tube out flat as a chart, every stitch over what it was worked into.
 *
 * A plain knit inherits its column exactly, so colourwork stacks up in true
 * vertical columns; a centred double decrease sits on the middle of the three
 * it took together, and a leaning one on the stitch it leans onto. Read the
 * other way, a KFB keeps its column and the stitch it makes sits beside it,
 * and a make-one picked up between two stitches sits over the gap between
 * them. The columns a decrease gave up are left empty, which is what draws a
 * wedge of decreases as the staircase a printed chart shows.
 *
 * The widest round anchors the grid, at one column per stitch, and everything
 * else is propagated away from it in both directions. It is the hat site's
 * layout, and the right one for a design whose shaping is drawn into its
 * charts. A yoke shaped in plain increase rounds between bands is not: laid
 * out this way, its top band would be scattered across the whole width of
 * its bottom one. That is what layOutBanded is for.
 */
export const layOut = (stitches: Stitch[], rounds: number[][]): ChartLayout => {
  const byId = new Map(stitches.map((stitch) => [stitch.id, stitch]));
  const widest = rounds.reduce((most, round) => Math.max(most, round.length), 0);
  const anchor = rounds.findIndex((round) => round.length === widest);
  const column = new Map<number, number>();

  if (anchor >= 0) rounds[anchor].forEach((id, index) => column.set(id, index + 1));

  // Upwards from the anchor: over what it was worked into.
  for (let index = anchor + 1; index < rounds.length; index++) {
    for (const family of familiesOf(rounds[index], byId)) {
      const below = columnsOf(family.below, column);
      const lean = leanOf(family, byId);
      if (below.length > 0) place(family.above, pick(below, widest, lean), lean, column);
    }
  }

  // And downwards: under whatever was worked into it.
  for (let index = anchor - 1; index >= 0; index--) {
    for (const family of familiesOf(rounds[index + 1], byId, true)) {
      const above = columnsOf(family.above, column);
      const lean = leanOf(family, byId);
      if (above.length > 0) place(family.below, pick(above, widest, lean), lean, column);
    }
  }

  const cells = new Map<number, Cell>();
  rounds.forEach((round, index) => {
    round.forEach((id, position) => {
      cells.set(id, {
        round: index + 1,
        column: column.get(id) ?? position + 1,
        index: position + 1,
      });
    });
  });

  return { cells, rounds: rounds.length, columns: widest };
};

/**
 * Lay a piece out as bands: every round on its own row, its stitches side by
 * side, centred on the widest round.
 *
 * A Fair Isle yoke is shaped in plain increase rounds between its bands, and
 * a band is only a band if its stitches are side by side - a peerie of six
 * stitches is a row of little diamonds, not six stitches spread across the
 * forty columns the yoke will grow to. So between shaping rounds nothing
 * moves and the columns line up exactly, a band reads as the picture it is,
 * and at each shaping round the chart simply steps out (or in) to the new
 * width, its make-ones or decreases marked in the round that makes them.
 * The whole piece comes out the shape a top-down yoke is: narrow at the neck,
 * where the knitting starts, and wide where it divides.
 */
export const layOutBanded = (
  rounds: number[][],
  /**
   * Which of the rounds are short rows, and the stitches, to place them by.
   * A short row is only part of the way round, so it is not centred: each of
   * its stitches stands over the stitch it was worked into, so the rows
   * across the back of the neck stand over the back of the round below -
   * which, the round beginning at the middle of the back, is its two ends.
   */
  rows?: { kinds: RoundKind[]; stitches: Stitch[] },
): ChartLayout => {
  const isRow = (index: number) => rows !== undefined && (rows.kinds[index] ?? "round") !== "round";
  const widest = rounds.reduce((most, round, index) => (isRow(index) ? most : Math.max(most, round.length)), 0);
  const cells = new Map<number, Cell>();
  rounds.forEach((round, index) => {
    const offset = Math.floor((widest - round.length) / 2);
    round.forEach((id, position) => {
      const below = isRow(index) ? cells.get(rows!.stitches[id].links[0]) : undefined;
      cells.set(id, {
        round: index + 1,
        column: below ? below.column : offset + position + 1,
        index: position + 1,
      });
    });
  });
  return { cells, rounds: rounds.length, columns: widest };
};

/** The stitches to draw: not the phantom start of the cast-on, nor a step. */
export const chartedStitches = (stitches: Stitch[]): Stitch[] =>
  stitches.filter(isFabric);
