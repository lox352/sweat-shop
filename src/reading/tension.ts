import { adjacentStitchDistance, verticalStitchDistance } from "../constants";
import type { Measurements, Tension } from "../pattern/design";
import type { SweaterStitches } from "../pattern/knitted";

/**
 * What a pattern knits up to at a tension other than the one it was written
 * for.
 *
 * A pattern is a count of stitches and rounds, and its measurements are those
 * counts at its tension. Knitted as written at another, the counts are the
 * same and the cloth is not: everything measured round the sweater - the
 * chest, the neck, the upper arm, the cuff - comes out by the ratio of the
 * stitch tensions, and everything measured down it - the yoke, the body, the
 * sleeve - by the ratio of the rounds.
 */
export const asKnitted = (finished: Measurements, written: Tension, measured: Tension): Measurements => {
  const round = written.stitchesPer10cm / measured.stitchesPer10cm;
  const down = written.roundsPer10cm / measured.roundsPer10cm;
  const cm = (value: number) => Math.round(value * 2) / 2;
  return {
    chestCm: cm(finished.chestCm * round),
    neckCm: cm(finished.neckCm * round),
    upperArmCm: cm(finished.upperArmCm * round),
    cuffCm: cm(finished.cuffCm * round),
    yokeDepthCm: cm(finished.yokeDepthCm * down),
    bodyLengthCm: cm(finished.bodyLengthCm * down),
    sleeveLengthCm: cm(finished.sleeveLengthCm * down),
  };
};

/** A count over a measured length, as a tension to 10cm, to one decimal place. */
export const per10cm = (count: number, overCm: number): number => Math.round((count / overCm) * 100) / 10;

/** Whether two tensions are near enough to knit up alike: within two per cent each way. */
export const sameTension = (a: Tension, b: Tension): boolean =>
  Math.abs(a.stitchesPer10cm / b.stitchesPer10cm - 1) <= 0.02 && Math.abs(a.roundsPer10cm / b.roundsPer10cm - 1) <= 0.02;

/**
 * How much more yarn a stitch takes at a knitter's tension than at the one a
 * pattern was written for: a stitch is a loop about as long as it is wide and
 * tall together, so half by its width and half by its height.
 */
export const yarnPerStitch = (written: Tension, own: Tension): number =>
  (written.stitchesPer10cm / own.stitchesPer10cm + written.roundsPer10cm / own.roundsPer10cm) / 2;

/**
 * How tall a round is at a tension, relative to how wide a stitch is. At 28
 * stitches and 32 rounds to 10cm a round is seven eighths of a stitch's
 * width.
 */
export const roundHeightFor = (tension: Partial<Tension>): number =>
  tension.stitchesPer10cm && tension.roundsPer10cm
    ? adjacentStitchDistance * (tension.stitchesPer10cm / tension.roundsPer10cm)
    : verticalStitchDistance;

/**
 * A knitting as it is at a knitter's tension: every stitch what it was, and
 * every round as tall for its width as that tension makes it. What a pattern
 * knitted as written looks like in their hands - and what the rounds knitted
 * are, when the rest is worked out again for it (see compiler/fit).
 */
export const atTension = (knitted: SweaterStitches, tension: Tension): SweaterStitches => {
  const roundHeight = roundHeightFor(tension);
  const taller = roundHeight / knitted.roundHeight;
  if (taller === 1) return knitted;
  const stitches = knitted.stitches.map((stitch) => (stitch.rise === undefined ? stitch : { ...stitch, rise: stitch.rise * taller }));
  return { ...knitted, stitches, roundHeight, knitting: { ...knitted.knitting, stitches, roundHeight } };
};
