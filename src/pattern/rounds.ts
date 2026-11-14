/**
 * The rounds a knitting is worked in, and what is put on hold: the words the
 * knitted sweater (see knitted) is written in, which the engine that makes
 * one and everything that reads one share.
 */

/** A round, or a short row worked from one side or the other. */
export type RoundKind = "round" | "right" | "wrong";

/**
 * And among the rounds from the seam, as the physics counts them, one can be
 * part of the way round: the last of a piece whose beginning of the round
 * was moved off its seam, which ends at the beginning and not at the seam.
 */
export type SeamKind = RoundKind | "part";

/** What the marker the rounds begin at is called until a pattern places another. */
export const beginning = "the beginning of the round";

/**
 * Stitches put on hold: a run of the round they were held from, in order,
 * waiting on waste yarn under a holder's name - the step that put them there,
 * and the step that takes them up again, once there is one. Consecutive held
 * stitches are one region of the knitting, which could be taken up again at
 * any time: what is on hold is decided by those two steps alone.
 */
export interface Held {
  holder: string;
  /** The held stitches, in the order they sit round the needle: one block, however many steps put it on hold. */
  stitches: number[];
  /**
   * Each step that put some of them on hold, and the ones it did. A block is
   * usually held in one; a sleeve can be held a part at a time, with cast-on
   * stitches between the parts, so long as nothing else is worked between
   * them - or as the round begins and as it ends, a block that straddles its
   * beginning.
   */
  parts: { at: number; stitches: number[] }[];
  /**
   * The stitches cast on in their place, where there are any: a sleeve's
   * underarm, which the body knits on from and the sleeve picks up out of
   * when it takes its held stitches up again.
   */
  edge?: number[];
  heldAt: number;
  resumedAt?: number;
}
