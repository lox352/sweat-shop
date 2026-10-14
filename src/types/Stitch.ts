import { StitchType, stepTypes } from "./StitchType";

/**
 * One stitch, or one step, in the order it is worked.
 *
 * A stitch's id is its place in that order, so a project's progress - the id
 * of the last stitch worked - says exactly how far through the sweater it is,
 * and the stitches of every piece follow one another: the yoke, the body,
 * then each sleeve.
 *
 * Where a stitch is in space is not part of it. The knitting is the same
 * knitting however it is posed or settled, so positions live in a list of
 * their own, by id: see physics/pose.ts and the settled files.
 */
export interface Stitch {
  id: number;
  /**
   * The stitches this one works, then the stitch before it.
   *
   * The first part is as long as the stitch's consumption: one for a knit,
   * two for a k2tog, none for an increase, a cast-on or a picked-up stitch.
   * The last entry is the stitch worked just before it, which the yarn runs
   * on from - absent only where the yarn starts, at the very first cast-on
   * stitch and at the first stitch of a piece begun with new yarn.
   */
  links: number[];
  type: StitchType;
  /**
   * Which yarn, as a palette key: a slot letter. What it looks like is the
   * colourway's business, decided on the way to the screen, so changing
   * colourway never rebuilds the knitting.
   */
  slot: string;
  /** Which piece it belongs to: "yoke", "body", "sleeve-left"... */
  piece: string;
  /** A picked-up stitch: the edge stitch it was drawn up out of. */
  from?: number;
  /**
   * How wide this stitch is, and how tall its round, where the pattern knits
   * in more than one fabric - a rib is narrower than the yoke above it.
   * Left off, they are the size's own; see engine's fabricOf.
   */
  width?: number;
  rise?: number;
  /**
   * The size of needle it is worked on, in millimetres. On a "needles" step,
   * the size changed to.
   */
  needles?: number;
  /** A "hold" or "resume" step: which holder, and how many stitches. */
  holder?: string;
  count?: number;
  /**
   * Worked from the wrong side, on a short row knitted back the other way.
   * Its type is what it looks like from the right side - a stitch purled from
   * the wrong side is a knit - which is what the sweater on screen draws, and
   * the chart from the right side. What to do is the stitch from the side it
   * is worked from: see knitting/sides.ts.
   */
  wrongSide?: boolean;
}

/**
 * Whether a stitch is a step: part of the order of work, but no fabric.
 * Joining the round, changing needles, putting stitches on hold and taking
 * them back up again are all things a knitter does, not loops of yarn.
 */
export const isStep = (stitch: Stitch): boolean => stepTypes.has(stitch.type);

/**
 * Whether the join in the round at `id` comes straight after the cast-on, and
 * so is made by casting on one more and lifting one over. Every join a
 * sweater makes is; the question is kept for the chart and the key, which
 * describe a join by what it follows.
 */
export const joinsCastOn = (stitches: Stitch[], id: number): boolean => {
  let at = id - 1;
  while (at > 0 && isStep(stitches[at])) at--;
  return stitches[at]?.type === "castOn";
};

/**
 * Whether a stitch is fabric: something drawn, on the chart or the sweater.
 * The phantom stitch 0 that starts the cast-on is not, and nor is a step.
 */
export const isFabric = (stitch: Stitch): boolean => stitch.id !== 0 && !isStep(stitch);

/** The stitch before this one, which the yarn runs on from, if there is one. */
export const before = (stitch: Stitch, consumed: number): number | undefined =>
  stitch.links.length > consumed ? stitch.links[stitch.links.length - 1] : undefined;
