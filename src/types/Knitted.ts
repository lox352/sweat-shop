import type { Held, RoundKind } from "../knitting/needles";
import type { Knitting } from "../physics/knitting";
import type { Stitch } from "./Stitch";

/**
 * A size of a design, knitted: its stitches and steps in the order they are
 * worked (see Stitch), the rounds they fall in, and what is put on hold.
 *
 * This is what everything that shows a sweater reads - the chart, the
 * knitting panel, the row counter, the sweater in three dimensions, the
 * yardage - and all any of them wants. The engine makes one from a design
 * (knitting/engine), and an edition is one frozen, which decodes to the same
 * again (data/sweaters/editions): neither the chart nor an edition knows
 * anything of how a pattern is written or worked out.
 */
export interface SweaterStitches {
  stitches: Stitch[];
  rounds: number[][];
  /** A label per round, for the chart's margin: "Border, row 3". */
  roundLabels: string[];
  /** The piece each round belongs to. */
  roundPieces: string[];
  /** Whether each is a round or a short row, and from which side: see Needles.row. */
  roundKinds: RoundKind[];
  /** Every run of stitches put on hold, and when it is taken up again: see Needles.Held. */
  holds: Held[];
  /** The rounds after which the needles are changed, 1-based. */
  needleChanges: number[];
  /** The counts the design names; see Size.checks. */
  checks: Record<string, number>;
  /** How tall a round is, in the units the stitches are laid out in. */
  roundHeight: number;
  /** The knitting as the physics sees it, its rounds worked from each piece's seam: see physics/knitting. */
  knitting: Knitting;
}

/**
 * A stitch knitted from a chart cell that only spaces the pattern out (see
 * ChartCell.spacer), for a picture of the sweater to leave out. Kept as a plain
 * mark on the stitch, not a field of the Stitch type: that type is part of
 * what a settled sweater is keyed on, and the mark is no part of its shape.
 */
export const markSpacer = (stitch: Stitch) => Object.assign(stitch, { spacer: true });
export const isSpacer = (stitch: Stitch | undefined): boolean => !!(stitch as { spacer?: true } | undefined)?.spacer;
