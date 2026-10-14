/**
 * One stitch's width, in the units the sweater is laid out and settled in.
 * At 28 stitches to 10cm a unit is about 1.8mm.
 */
export const adjacentStitchDistance = 2;
/**
 * And its height, where a design gives no tension: knitted stitches are wider
 * than they are tall. A design's own sizes always say, and a round is then
 * as tall as their tension makes it - see engine's roundHeightFor.
 */
export const verticalStitchDistance = 1.6;
