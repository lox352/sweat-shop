import type { SweaterStitches } from "../../pattern/knitted";
import type { Stitch } from "../../pattern/Stitch";

/**
 * How an update to a size's knitting falls for a knitter part way through
 * the edition before it, and their knitting joined to the update's.
 *
 * What is knitted is a fact: an update is never applied to it. So what an
 * update is, to a knitter, depends only on where it falls from their needles:
 *
 * - **behind** them, and the rest the same stitches: nothing to do. They are
 *   told what was put right, once, and knit on.
 * - **ahead** of them, everything to their place the same: the update is
 *   theirs for the taking, their place where it was.
 * - **round them**: the two are compared a round at a time, as a reader would
 *   compare two written patterns, and where a round at or after the knitter's
 *   is the same round in both, their rounds to it are **joined** to the
 *   update's rest. The knitting is then their own, held by no published file.
 * - **apart** for good - every round from theirs on is on another count -
 *   there is nothing to join. A design that can plans the rest afresh from
 *   the stitches on the needles (see library/fit); otherwise they knit on.
 */
export type Update =
  | { kind: "behind"; changed: number[] }
  | { kind: "ahead"; changed: number[] }
  | { kind: "joined"; round: number; knitting: SweaterStitches; changed: number[] }
  | { kind: "apart" };

/** Whether two stitches are the same knitting, each read by how far back its links reach: where it sits in the stream is no part of it. */
const alike = (a: Stitch, b: Stitch) =>
  a.type === b.type && a.slot === b.slot && a.piece === b.piece && !!a.wrongSide === !!b.wrongSide &&
  a.links.length === b.links.length && a.links.every((link, i) => a.id - link === b.id - b.links[i]);

/** The first stitch at which two knittings differ, or undefined if one only runs on past the other. */
export const firstDifference = (mine: Stitch[], now: Stitch[]): number | undefined => {
  const shorter = Math.min(mine.length, now.length);
  for (let id = 0; id < shorter; id++) if (!alike(mine[id], now[id])) return id;
  return mine.length === now.length ? undefined : shorter;
};

/** A round as a written pattern would have it: what it is, and each stitch's kind and yarn, in order. */
const written = (knitted: SweaterStitches, at: number): string => {
  const out = [knitted.roundKinds[at], knitted.roundPieces[at]];
  let run = "";
  let length = 0;
  for (const id of knitted.rounds[at]) {
    const { type, slot } = knitted.stitches[id];
    const one = `${type} ${slot}`;
    if (one === run) length++;
    else {
      if (length) out.push(`${run} ${length}`);
      run = one;
      length = 1;
    }
  }
  out.push(`${run} ${length}`);
  return out.join("|");
};

/**
 * The rounds two knittings share, in order, each as [mine, theirs] counted
 * from 1: the longest run of rounds, not necessarily together, that are the
 * same round in both - as two texts are compared a line at a time.
 */
export const sharedRounds = (mine: SweaterStitches, theirs: SweaterStitches): [number, number][] => {
  const a = mine.rounds.map((_, at) => written(mine, at));
  const b = theirs.rounds.map((_, at) => written(theirs, at));
  // The rounds both begin with and end with are shared; only what lies between is searched.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const [n, m] = [a.length - head - tail, b.length - head - tail];
  // The longest shared run of the rounds from i and from j on.
  const longest = new Uint16Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      longest[i * (m + 1) + j] = a[head + i] === b[head + j] ? longest[(i + 1) * (m + 1) + j + 1] + 1 : Math.max(longest[(i + 1) * (m + 1) + j], longest[i * (m + 1) + j + 1]);
    }
  }
  const pairs: [number, number][] = Array.from({ length: head }, (_, at) => [at + 1, at + 1]);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (a[head + i] === b[head + j]) pairs.push([head + ++i, head + ++j]);
    else if (longest[(i + 1) * (m + 1) + j] >= longest[i * (m + 1) + j + 1]) i++;
    else j++;
  }
  for (let at = tail; at > 0; at--) pairs.push([a.length - at + 1, b.length - at + 1]);
  return pairs;
};

/**
 * Whether a knitting can be carried on from after one of its rounds as if
 * from a cast-on: a whole round, nothing on hold, and every round to it
 * begun at the seam. What the engine asks too: see Needles.resume.
 */
const standsAfter = (knitted: SweaterStitches, round: number): boolean => {
  const made = knitted.rounds[round - 1];
  if (!made || knitted.roundKinds[round - 1] !== "round") return false;
  const last = made[made.length - 1];
  if (knitted.holds.some((held) => held.heldAt <= last)) return false;
  if (knitted.stitches.slice(0, last + 1).some((stitch) => stitch.begins)) return false;
  return knitted.rounds.slice(0, round).every((ids, at) => knitted.knitting.rounds[at]?.length === ids.length && knitted.knitting.rounds[at][0] === ids[0]);
};

/**
 * A knitter's rounds to one of them, then another knitting's from the round
 * that is the same in it: one sweater, stitch for stitch what each was.
 * Undefined where they can't be joined there: the round is not one to carry
 * on from in either, or what follows it reaches back past it.
 */
export const joined = (mine: SweaterStitches, theirs: SweaterStitches, round: number, theirRound: number): SweaterStitches | undefined => {
  if (!standsAfter(mine, round) || !standsAfter(theirs, theirRound)) return undefined;
  const [made, theirMade] = [mine.rounds[round - 1], theirs.rounds[theirRound - 1]];
  const end = made[made.length - 1];
  const theirEnd = theirMade[theirMade.length - 1];
  // Everything of theirs from that round on is as many stitches further on, or back, in the join.
  const by = end - theirEnd;
  if (made[0] - theirMade[0] !== by) return undefined;
  const rest = theirs.stitches.slice(theirEnd + 1);
  // The rest may be worked into that round, which is the knitter's own now, and into nothing before it.
  if (rest.some((stitch) => stitch.links.some((link) => link < theirMade[0]) || (stitch.from !== undefined && stitch.from < theirMade[0]))) return undefined;
  const on = (id: number) => id + by;
  const ons = (ids: number[]) => ids.map(on);
  const stitches = [
    ...mine.stitches.slice(0, end + 1),
    ...rest.map((stitch) => ({ ...stitch, id: on(stitch.id), links: ons(stitch.links), ...(stitch.from !== undefined ? { from: on(stitch.from) } : {}) })),
  ];
  const after = <T>(ours: T[], others: T[]): T[] => [...ours.slice(0, round), ...others.slice(theirRound)];
  return {
    stitches,
    rounds: after(mine.rounds, theirs.rounds.map((ids, at) => (at < theirRound ? ids : ons(ids)))),
    roundLabels: after(mine.roundLabels, theirs.roundLabels),
    roundPieces: after(mine.roundPieces, theirs.roundPieces),
    roundKinds: after(mine.roundKinds, theirs.roundKinds),
    holds: theirs.holds.map((held) => ({
      ...held,
      stitches: ons(held.stitches),
      parts: held.parts.map((part) => ({ at: on(part.at), stitches: ons(part.stitches) })),
      ...(held.edge ? { edge: ons(held.edge) } : {}),
      heldAt: on(held.heldAt),
      ...(held.resumedAt !== undefined ? { resumedAt: on(held.resumedAt) } : {}),
    })),
    needleChanges: [...mine.needleChanges.filter((at) => at < round), ...theirs.needleChanges.filter((at) => at >= theirRound).map((at) => at + round - theirRound)],
    checks: theirs.checks,
    roundHeight: theirs.roundHeight,
    knitting: {
      fromSeam: true,
      stitches,
      rounds: after(mine.knitting.rounds, theirs.knitting.rounds.map((ids, at) => (at < theirRound ? ids : ons(ids)))),
      roundKinds: after(mine.knitting.roundKinds, theirs.knitting.roundKinds),
      roundPieces: after(mine.knitting.roundPieces, theirs.knitting.roundPieces),
      roundHeight: theirs.knitting.roundHeight,
    },
  };
};

/**
 * How `theirs`, the size's knitting now, falls for a knitter of `mine` with
 * `progress` its last stitch worked. `changed` are the rounds that are not
 * the same in both: of mine, for an update behind the knitter, and otherwise
 * of the knitting they would knit on.
 */
export const updateFor = (mine: SweaterStitches, theirs: SweaterStitches, progress: number): Update => {
  const shared = sharedRounds(mine, theirs);
  const [ours, others] = [new Set(shared.map(([round]) => round)), new Set(shared.map(([, round]) => round))];
  const notShared = (count: number, kept: Set<number>, from = 1) => Array.from({ length: count }, (_, at) => at + 1).filter((round) => round >= from && !kept.has(round));

  // Everything still to knit the same stitches: the update is all behind.
  const left = mine.stitches.length - 1 - progress;
  const theirLeft = theirs.stitches.length - left;
  if (theirLeft >= 0 && Array.from({ length: left }, (_, i) => i).every((i) => alike(mine.stitches[progress + 1 + i], theirs.stitches[theirLeft + i]))) {
    return { kind: "behind", changed: notShared(mine.rounds.length, ours) };
  }
  // Everything knitted the same stitches: it is all ahead.
  const first = firstDifference(mine.stitches, theirs.stitches);
  if (first === undefined || first > progress) return { kind: "ahead", changed: notShared(theirs.rounds.length, others) };

  // The round in hand, or the last finished, and the first from it on that the two share and can be joined at.
  const at = mine.rounds.findIndex((ids) => ids[ids.length - 1] >= progress) + 1;
  for (const [round, theirRound] of shared) {
    if (round < Math.max(1, at)) continue;
    const knitting = joined(mine, theirs, round, theirRound);
    if (knitting) return { kind: "joined", round, knitting, changed: notShared(theirs.rounds.length, others, theirRound).map((changed) => changed + round - theirRound) };
  }
  return { kind: "apart" };
};
