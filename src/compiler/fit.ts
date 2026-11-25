import type { Measurements, Placement, Tension } from "../pattern/design";
import type { SweaterStitches } from "../pattern/knitted";
import { sweaterById } from "./designs";
import type { Fitted, Fitting, Size, Start, SweaterPattern } from "./designs/types";
import { writtenPattern } from "./designs/written";
import { atTension } from "../reading/tension";
import { buildSweater, sizeOf } from "./engine/engine";

/**
 * A sweater fitted to its knitter, part way through: what is knitted kept as
 * it is, and the rest planned afresh by the design (see Fitting) - for a
 * tension that is not the pattern's, or a pattern changed for good under the
 * knitting.
 *
 * For a design that asks it (see Fitting.consistent), the rest is the rest of
 * the earliest plan that explains what is knitted, so that planning is the
 * same wherever on a plan it is done from: a plan followed and planned again
 * at its tension is itself, and a tension changed and changed back before
 * anything more is knitted leaves the pattern as it was.
 *
 * The one place a pattern is worked out for one knitter alone. Everything
 * else the site shows is an edition, worked out once for everybody and
 * frozen; this is asked for, and runs where it is asked.
 */

export interface FitAsk {
  design: string;
  sizeId: string;
  /** What is knitted, and the round it is knitted to: one the design can plan on from (see cutAfter). Neither, for a whole sweater from the cast-on. */
  knitted?: SweaterStitches;
  round?: number;
  /** The knitter's own tension. */
  tension: Tension;
  /** What it is to measure: the size's own, unless other measurements are asked for. */
  finished?: Measurements;
  option?: string;
}

export interface Fit {
  /** The whole sweater: the rounds knitted, and the rest. */
  knitted: SweaterStitches;
  /** The round the rest begins after: none, for a whole sweater from the cast-on. */
  round?: number;
  tension: Tension;
  /** What it will measure. */
  finished: Measurements;
  notes: string[];
  /** The rest, written out as a pattern. */
  written: string;
  /** Where the bands planned afresh sit, for a design whose colourways follow that. */
  placement?: Placement;
}

const fittingOf = (design: string): { pattern: SweaterPattern; fitting: Fitting } | undefined => {
  const pattern = sweaterById(design);
  return pattern?.fitting ? { pattern, fitting: pattern.fitting } : undefined;
};

/** The ways a design can lay out the rest; none for a design that can't plan one. */
export const fitOptions = (design: string) => fittingOf(design)?.fitting.options ?? [];

/** The first round, at or after `round`, the rest can be planned from: none where the design can't, or it is too late. */
export const cutAfter = (design: string, knitted: SweaterStitches, round: number): number | undefined =>
  fittingOf(design)?.fitting.cutAfter?.(knitted, round);

/** Are two knittings the same, round for round and stitch for stitch, to a round? */
const sameTo = (a: SweaterStitches, b: SweaterStitches, round: number): boolean => {
  if (a.rounds.length < round || b.rounds.length < round) return false;
  for (let r = 0; r < round; r++) {
    if (a.roundKinds[r] !== b.roundKinds[r] || a.roundPieces[r] !== b.roundPieces[r] || a.rounds[r].length !== b.rounds[r].length) return false;
    for (let i = 0; i < a.rounds[r].length; i++) {
      const [x, y] = [a.stitches[a.rounds[r][i]], b.stitches[b.rounds[r][i]]];
      if (x.type !== y.type || x.slot !== y.slot) return false;
    }
  }
  return true;
};

export const fit = (ask: FitAsk, done?: (fraction: number) => void): Fit => {
  const found = fittingOf(ask.design);
  if (!found) throw new Error(`${ask.design} can't be planned on from part knitted`);
  const { pattern, fitting } = found;
  if (ask.knitted && !fitting.cutAfter) throw new Error(`${ask.design} can only be planned whole, from the cast-on`);
  const size = sizeOf(pattern, ask.sizeId);
  const finished = ask.finished ?? size.finished;
  /*
   * What is knitted was knitted at the knitter's tension, whatever the
   * pattern said: its stitches are as they were made, and its rounds as tall
   * for their width as the rest's will be.
   */
  // The counts a pattern names are of the pattern that names them: the fitted sweater's are the rest's.
  const from = ask.knitted && ask.round !== undefined ? { knitted: { ...atTension(ask.knitted, ask.tension), checks: {} }, round: ask.round } : undefined;
  // The size as it is planned: its own name and needles, the rest as its knitting. Named a field at a time, as a size may work its knitting out only when asked.
  const sizeFor = (planned: Fitted): Size => ({
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
  });
  const restOf = (planned: Fitted): SweaterPattern => ({ ...pattern, charts: planned.charts, sizes: [sizeFor(planned)] });

  /*
   * A consistent design's rest (see Fitting.consistent): the plan from an
   * earlier start - the cast-on, or a round before this one it could have
   * been planned from - where that plan, knitted, is what is knitted; cut to
   * what is still to be knitted. None where the start's plan is not the
   * knitting's, or does not turn from one instruction to the next at the
   * round knitted to. With it, the counts that plan names, the ones already
   * knitted past among them: the sweater is that plan's, and so the same
   * edition as the plan knitted whole - the published size's own, where the
   * plan is the pattern's.
   */
  const restFrom = (start: Start | undefined, to: Start): { planned: Fitted; checks: Record<string, number> } | undefined => {
    let planned: Fitted;
    let cut: { section: number; spec: number } | undefined;
    let built: SweaterStitches;
    try {
      planned = fitting.plan({ finished, tension: ask.tension, from: start, option: ask.option });
      built = buildSweater(restOf(planned), size.id, start, (section, spec, rounds) => {
        if (rounds === to.round) cut ??= { section, spec };
      });
    } catch {
      return undefined;
    }
    if (!cut || !sameTo(built, to.knitted, to.round)) return undefined;
    const sections = planned.sections
      .slice(cut.section)
      .map((section, i) => (i === 0 ? { ...section, rounds: section.rounds.slice(cut!.spec + 1) } : section))
      .filter((section) => section.rounds.length > 0);
    const since = start ? "an earlier round" : "the cast-on";
    const notes = [`What is knitted is the beginning of the pattern as it is planned from ${since} at this tension: this is the rest of that pattern.`, ...planned.notes];
    return { planned: { ...planned, sections, notes }, checks: built.checks };
  };
  let earlier: ReturnType<typeof restFrom>;
  if (from && fitting.consistent && fitting.cutAfter) {
    const starts: (Start | undefined)[] = [undefined];
    for (let r = fitting.cutAfter(from.knitted, 1); r !== undefined && r < from.round; r = fitting.cutAfter(from.knitted, r + 1)) starts.push({ knitted: from.knitted, round: r });
    for (const start of starts) if ((earlier = restFrom(start, from))) break;
  }
  const planned = earlier?.planned ?? fitting.plan({ finished, tension: ask.tension, from, option: ask.option });
  const rest = restOf(planned);
  const fitted = rest.sizes[0];
  const steps = planned.sections.reduce((total, section) => total + section.rounds.length, 0);
  let at = 0;
  const continued = buildSweater(rest, fitted.id, from, () => done?.(++at / steps));
  const knitted = earlier ? { ...continued, checks: earlier.checks } : continued;
  return {
    knitted,
    ...(from ? { round: from.round } : {}),
    tension: ask.tension,
    finished: planned.finished,
    notes: planned.notes,
    ...(planned.placement ? { placement: planned.placement } : {}),
    written: writtenPattern(rest, fitted.id, knitted.checks),
  };
};
