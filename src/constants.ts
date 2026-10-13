/** One stitch's width, in the units the physics works in. */
export const adjacentStitchDistance = 2;
/** And its height. Knitted stitches are wider than they are tall. */
export const verticalStitchDistance = 1.6;

export const settleDamping = 3;
export const settleTimeStep = 0.15;
export const solverIterations = 20;
export const settleSubsteps = 2;
/** Check the budget between indivisible physics steps. */
export const settleStepBudgetMs = 16;
/**
 * How still a hat has to be to count as settled: how far the average stitch
 * moves in a step, as a fraction of its own width.
 *
 * Distance rather than speed, which was measured and not assumed. A settling
 * hat's mean velocity does not fall to nothing - it comes down to a floor and
 * stays there, because the solver's corrections reverse from step to step and
 * so register as speed while going nowhere. On Da Crofter's Kep that floor is
 * 0.167 against a threshold of 0.15, so no amount of running would ever have
 * settled it: at four hundred steps its stitches were moving four
 * ten-thousandths of a width each and it was plainly finished.
 *
 * Distance has no such floor. Three thousandths of a stitch a step is about
 * where the velocity rule used to stop the hats that it did stop, so the
 * shapes are the ones it was already choosing - it is the hats it never
 * stopped that this changes.
 */
export const restMovement = 0.003;
export const minimumSettleFrames = 10;
export const settleRestSeconds = 2;

/**
 * How thick a knitted fabric is, as a fraction of how wide its stitches are.
 *
 * Two ply jumper weight comes out about a millimetre and a half thick at four
 * stitches to the centimetre, so a third of a stitch, and stranded colourwork
 * rather more. It is only ever wanted where the fabric is doubled: it is what
 * holds the two layers of a turned-up brim apart. See knitting/folding.ts.
 */
export const fabricThickness = adjacentStitchDistance * 0.35;
