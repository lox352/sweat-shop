import { Stitch, isStep } from "../types/Stitch";
import { ChartLayout, isSecondLoop } from "./layout";
import type { RoundKind } from "./needles";
import { Mark, castOnPartWayMark, forkMark, makeOneMark, markFor } from "../helpers/stitch-marks";
import { castOnPartWay } from "./stitch-key";
import { type Face, seenFrom } from "./sides";

export type { Face };

/**
 * The mark a stitch carries on the chart, which can depend on its neighbours.
 *
 * Nearly always the stitch's own, as it looks from the side the chart shows:
 * from the right side, what it is there - a short row purled back from the
 * wrong side is knits - and from the wrong side, its pair from behind, every
 * knit a purl and every purl a knit; see sides.ts. The exception is a KFB:
 * one instruction that makes two stitches, so it is drawn as one mark across
 * both cells - a fork from the stitch below to each of them - and the new
 * stitch carries nothing of its own, being made rather than worked.
 */
export const markAt = (
  stitch: Stitch,
  byId: Map<number, Stitch>,
  layout: ChartLayout,
  /** Which way this pattern's make-ones lean, if it says. */
  makeOneLean?: "left" | "right",
  /** The side of the sweater the chart shows. */
  face: Face = "right",
): Mark | undefined => {
  if (isSecondLoop(stitch, byId)) return undefined;
  const shown = seenFrom(stitch, face);
  if (shown === "castOn" && castOnPartWay(stitch.id, (id) => byId.get(id))) return castOnPartWayMark;
  if (shown === "m1" || shown === "m1p") return makeOneMark(makeOneLean, shown === "m1p");
  if (shown !== "kfb" && shown !== "pfb" && shown !== "kbf") return markFor(shown);

  const at = layout.cells.get(stitch.id);
  const made = byId.get(stitch.id + 1);
  const madeAt = made && isSecondLoop(made, byId) ? layout.cells.get(made.id) : undefined;
  if (!at || !madeAt || madeAt.round !== at.round) return undefined;
  // Column 1 is at the right, so a higher column is further left.
  const centre = (column: number) => 0.5 + at.column - column;
  const parentAt = layout.cells.get(stitch.links[0]);
  return forkMark(centre(parentAt?.column ?? at.column), [0.5, centre(madeAt.column)], shown === "pfb", shown === "kbf");
};

/** Where the needles change: after which round, and to what size. */
export interface NeedleChange {
  after: number;
  to: number;
  /** What that round is called, where the chart knows: "Body, round 97". */
  where?: string;
  /**
   * Not a change between two rounds but held stitches taken up onto other
   * needles, to begin a piece - a sleeve onto the main needles after the
   * body's hem rib. The chart draws no rule for it.
   */
  takeUp?: boolean;
}

/**
 * The needle changes among these rounds, each placed after the last round
 * worked before it. Only those with fabric on both sides are drawn.
 */
export const needleChangesIn = (
  stitches: Stitch[],
  rounds: number[][],
  /** What each round is called. */
  names?: string[],
): NeedleChange[] => {
  const roundOf = new Map<number, number>();
  rounds.forEach((ids, index) => ids.forEach((id) => roundOf.set(id, index + 1)));
  const out: NeedleChange[] = [];
  let last = 0;
  for (const stitch of stitches) {
    last = roundOf.get(stitch.id) ?? last;
    if (stitch.type === "needles" && stitch.needles !== undefined && last > 0 && last < rounds.length) {
      out.push({ after: last, to: stitch.needles, ...(names?.[last - 1] ? { where: names[last - 1] } : {}) });
    }
    const before = stitches[stitch.id - 1]?.needles;
    if (stitch.type === "resume" && stitch.needles !== undefined && before !== undefined && stitch.needles !== before) {
      out.push({ after: last, to: stitch.needles, takeUp: true });
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

/**
 * Where a piece's stitches are put on hold, part way through a round - a
 * sleeve's, in the dividing round - and the stitches either side of the
 * step, which the chart draws a bar between: the last worked before it, and
 * the first after, which is the first of the underarm cast on in their place.
 */
export interface Hold {
  before: number;
  after: number;
  holder: string;
  count: number;
  /** What the held stitches are for: "Right sleeve". */
  label: string;
}

export const holdsIn = (
  stitches: Stitch[],
  rounds: number[][],
  pieces: { id: string; label: string }[] = [],
): Hold[] => {
  const roundOf = new Map<number, number>();
  rounds.forEach((ids, index) => ids.forEach((id) => roundOf.set(id, index)));
  const out: Hold[] = [];
  for (const stitch of stitches) {
    if (stitch.type !== "hold" || !stitch.holder || stitch.count === undefined) continue;
    let before = stitch.id - 1;
    while (before > 0 && isStep(stitches[before])) before--;
    let after = stitch.id + 1;
    while (after < stitches.length && isStep(stitches[after])) after++;
    const round = roundOf.get(before);
    if (round === undefined || roundOf.get(after) !== round) continue;
    const label = pieces.find((piece) => piece.id === stitch.holder)?.label ?? stitch.holder;
    out.push({ before, after, holder: stitch.holder, count: stitch.count, label });
  }
  return out;
};

/**
 * Where a short row turns: the last stitch of the row - the one the turn makes
 * a double stitch of - and the next before it, which say which way the row
 * was going when it turned.
 */
export interface Turn {
  last: number;
  before: number;
}

export const turnsIn = (stitches: Stitch[], rounds: number[][]): Turn[] => {
  const roundOf = new Map<number, number>();
  rounds.forEach((ids, index) => ids.forEach((id) => roundOf.set(id, index)));
  const out: Turn[] = [];
  for (const stitch of stitches) {
    if (stitch.type !== "turn") continue;
    const round = roundOf.get(stitch.id - 1);
    if (round === undefined) continue;
    const ids = rounds[round];
    if (ids.length < 2) continue;
    out.push({ last: ids[ids.length - 1], before: ids[ids.length - 2] });
  }
  return out;
};

/**
 * Which side of the sweater is towards you once the knitting is worked as far
 * as `progress`: the right side, but for while a short row is being purled
 * back. Every turn worked turns the work over, so it is how many of them have
 * been worked, odd or even.
 */
export const faceAfter = (turnIds: number[], progress: number): Face =>
  turnIds.filter((id) => id <= progress).length % 2 === 1 ? "wrong" : "right";

/**
 * The rows worked with the other side towards you from `face`, in runs,
 * first and last, numbered from 1: what the chart hatches. With the right side
 * towards you they are the short rows purled back; with the wrong side, every
 * other row there is.
 */
export const otherFaceRows = (
  /** Each round's row; see ChartLayout.roundRows. */
  roundRows: readonly number[],
  kinds: readonly (RoundKind | undefined)[],
  face: Face,
): [number, number][] => {
  const rows = new Set<number>();
  roundRows.forEach((row, index) => {
    if ((kinds[index] === "wrong" ? "wrong" : "right") !== face) rows.add(row);
  });
  const runs: [number, number][] = [];
  for (const row of [...rows].sort((a, b) => a - b)) {
    const last = runs[runs.length - 1];
    if (last && last[1] === row - 1) last[1] = row;
    else runs.push([row, row]);
  }
  return runs;
};
