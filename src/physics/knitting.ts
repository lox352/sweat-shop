import type { Stitch } from "../types/Stitch";
import type { RoundKind } from "../knitting/needles";

/**
 * The knitting as the physics sees it: every stitch, and the rounds as they
 * are worked from each piece's seam - where its first round began, the
 * middle of the back or of an underarm - whatever marker a pattern counts its
 * rounds from. A marker moved changes what the pattern calls a round, and
 * nothing about the fabric, so the physics never sees it.
 */
export interface Knitting {
  /** Marks these rounds apart from a pattern's own, so the one is never taken for the other. */
  readonly fromSeam: true;
  stitches: Stitch[];
  /** Stitch ids in each round from the seam, in the order they are worked. */
  rounds: number[][];
  /** Whether each is a round, or a short row worked from one side or the other. */
  roundKinds: RoundKind[];
  /** The piece each belongs to. */
  roundPieces: string[];
  /** How tall a round of the main fabric is, in the units the stitches are laid out in. */
  roundHeight: number;
}
