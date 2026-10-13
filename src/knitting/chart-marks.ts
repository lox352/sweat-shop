import { Stitch } from "../types/Stitch";
import { ChartLayout, isSecondLoop } from "./layout";
import { Mark, forkMark, makeOneMark, markFor } from "../helpers/stitch-marks";

/**
 * The mark a stitch carries on the chart, which can depend on its neighbours.
 *
 * Nearly always the stitch's own. The exception is a KFB: one instruction
 * that makes two stitches, so it is drawn as one mark across both cells - a
 * fork from the stitch below to each of them - and the new stitch carries
 * nothing of its own, being made rather than worked.
 */
export const markAt = (
  stitch: Stitch,
  byId: Map<number, Stitch>,
  layout: ChartLayout,
  /** Which way this pattern's make-ones lean, if it says. */
  makeOneLean?: "left" | "right",
): Mark | undefined => {
  if (isSecondLoop(stitch, byId)) return undefined;
  if (stitch.type === "m1") return makeOneMark(makeOneLean);
  if (stitch.type !== "kfb") return markFor(stitch.type);

  const at = layout.cells.get(stitch.id);
  const made = byId.get(stitch.id + 1);
  const madeAt = made && isSecondLoop(made, byId) ? layout.cells.get(made.id) : undefined;
  if (!at || !madeAt || madeAt.round !== at.round) return undefined;
  // Column 1 is at the right, so a higher column is further left.
  const centre = (column: number) => 0.5 + at.column - column;
  const parentAt = layout.cells.get(stitch.links[0]);
  return forkMark(centre(parentAt?.column ?? at.column), [0.5, centre(madeAt.column)]);
};

/** Where the needles change: after which round, and to what size. */
export interface NeedleChange {
  after: number;
  to: number;
}

/**
 * The needle changes among these rounds, each placed after the last round
 * worked before it. Only those with fabric on both sides are drawn.
 */
export const needleChangesIn = (stitches: Stitch[], rounds: number[][]): NeedleChange[] => {
  const roundOf = new Map<number, number>();
  rounds.forEach((ids, index) => ids.forEach((id) => roundOf.set(id, index + 1)));
  const out: NeedleChange[] = [];
  let last = 0;
  for (const stitch of stitches) {
    last = roundOf.get(stitch.id) ?? last;
    if (stitch.type === "needles" && stitch.needles !== undefined && last > 0 && last < rounds.length) {
      out.push({ after: last, to: stitch.needles });
    }
  }
  return out;
};

/**
 * Where the knitting is joined in the round: after which round, and the
 * stitches either side of the step - the last of that round, and the first
 * of the next, where the chart draws the round leaving and coming back in.
 */
export interface Join {
  after: number;
  last: number;
  first: number;
}

export const joinIn = (stitches: Stitch[], rounds: number[][]): Join | undefined => {
  const step = stitches.find((stitch) => stitch.type === "join");
  if (!step) return undefined;
  const after = rounds.findIndex((ids) => ids.includes(step.id - 1)) + 1;
  const next = rounds[after];
  if (after < 1 || !next) return undefined;
  return { after, last: step.id - 1, first: next[0] };
};
