import type { Measurements, Tension } from "../pattern/design";

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
