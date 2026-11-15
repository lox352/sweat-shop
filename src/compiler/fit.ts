import type { Measurements, Tension } from "../pattern/design";
import type { SweaterStitches } from "../pattern/knitted";
import { sweaterById } from "./designs";
import type { Fitting, Size, SweaterPattern } from "./designs/types";
import { writtenPattern } from "./designs/written";
import { buildSweater, roundHeightFor, sizeOf } from "./engine/engine";

/**
 * A sweater fitted to its knitter, part way through: what is knitted kept as
 * it is, and the rest planned afresh by the design (see Fitting) - for a
 * tension that is not the pattern's, or a pattern changed for good under the
 * knitting.
 *
 * The one place a pattern is worked out for one knitter alone. Everything
 * else the site shows is an edition, worked out once for everybody and
 * frozen; this is asked for, and runs where it is asked.
 */

export interface FitAsk {
  design: string;
  sizeId: string;
  /** What is knitted, and the round it is knitted to: one the design can plan on from (see cutAfter). */
  knitted: SweaterStitches;
  round: number;
  /** The knitter's own tension. */
  tension: Tension;
  /** What it is to measure: the size's own, unless other measurements are asked for. */
  finished?: Measurements;
  option?: string;
}

export interface Fit {
  /** The whole sweater: the rounds knitted, and the rest. */
  knitted: SweaterStitches;
  /** The round the rest begins after. */
  round: number;
  tension: Tension;
  /** What it will measure. */
  finished: Measurements;
  notes: string[];
  /** The rest, written out as a pattern. */
  written: string;
}

const fittingOf = (design: string): { pattern: SweaterPattern; fitting: Fitting } | undefined => {
  const pattern = sweaterById(design);
  return pattern?.fitting ? { pattern, fitting: pattern.fitting } : undefined;
};

/** The ways a design can lay out the rest; none for a design that can't plan one. */
export const fitOptions = (design: string) => fittingOf(design)?.fitting.options ?? [];

/** The first round, at or after `round`, the rest can be planned from: none where the design can't, or it is too late. */
export const cutAfter = (design: string, knitted: SweaterStitches, round: number): number | undefined =>
  fittingOf(design)?.fitting.cutAfter(knitted, round);

export const fit = (ask: FitAsk, done?: (fraction: number) => void): Fit => {
  const found = fittingOf(ask.design);
  if (!found) throw new Error(`${ask.design} can't be planned on from part knitted`);
  const { pattern, fitting } = found;
  const size = sizeOf(pattern, ask.sizeId);
  /*
   * What is knitted was knitted at the knitter's tension, whatever the
   * pattern said: its stitches are as they were made, and its rounds as tall
   * for their width as the rest's will be.
   */
  const taller = roundHeightFor(ask.tension) / ask.knitted.roundHeight;
  const from = {
    knitted: {
      ...ask.knitted,
      stitches: ask.knitted.stitches.map((stitch) => (stitch.rise === undefined ? stitch : { ...stitch, rise: stitch.rise * taller })),
      // The counts a pattern names are of the pattern that names them: the fitted sweater's are the rest's.
      checks: {},
    },
    round: ask.round,
  };
  const planned = fitting.plan({ finished: ask.finished ?? size.finished, tension: ask.tension, from, option: ask.option });
  // The size as it now is: its own name and needles, the rest as its knitting. Named a field at a time, as a size may work its knitting out only when asked.
  const fitted: Size = {
    id: size.id,
    label: size.label,
    toFitChestCm: size.toFitChestCm,
    ...(size.fits ? { fits: size.fits } : {}),
    needlesMm: size.needlesMm,
    ...(size.ribNeedlesMm ? { ribNeedlesMm: size.ribNeedlesMm } : {}),
    ...(size.colourNeedlesMm ? { colourNeedlesMm: size.colourNeedlesMm } : {}),
    finished: planned.finished,
    ...ask.tension,
    sections: planned.sections,
    checks: planned.checks,
  };
  const rest: SweaterPattern = { ...pattern, charts: planned.charts, sizes: [fitted] };
  const steps = planned.sections.reduce((total, section) => total + section.rounds.length, 0);
  let at = 0;
  const knitted = buildSweater(rest, fitted.id, from, () => done?.(++at / steps));
  return {
    knitted,
    round: ask.round,
    tension: ask.tension,
    finished: planned.finished,
    notes: planned.notes,
    written: writtenPattern(rest, fitted.id, knitted.checks),
  };
};
