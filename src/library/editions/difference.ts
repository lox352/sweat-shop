import type { Stitch } from "../../pattern/Stitch";

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

/**
 * Where a project's place in its edition is in another: the same stitch
 * wherever the two are the same knitting.
 *
 * Two editions of a size share a stretch at the start - everything before
 * their first difference - and most often a stretch at the end, the same
 * knitting from some stitch on, a few stitches further along or back for
 * whatever was added or taken out between. A place in either stretch is the
 * same place in the other. One between them, in what was changed, has no
 * such place, and is undefined: its knitter is asked to say where they are
 * with Knit up to here.
 */
export const carryOver = (mine: Stitch[], now: Stitch[]): ((progress: number) => number | undefined) => {
  const first = firstDifference(mine, now);
  if (first === undefined) return (progress) => progress;
  // The longest stretch the two end with, not reaching back past where they first differ.
  let same = 0;
  const most = Math.min(mine.length, now.length) - first;
  while (same < most && alike(mine[mine.length - 1 - same], now[now.length - 1 - same])) same++;
  const from = mine.length - same;
  const shift = now.length - mine.length;
  // Progress is the last stitch worked: before the first difference, or at the end of the stretch before the shared one, it is the same.
  return (progress) => (progress < first ? progress : progress >= from - 1 && from + shift >= first ? progress + shift : undefined);
};
