import { sweaterById } from "../data/sweaters";
import { sweaterStitches } from "../knitting/useSweater";
import type { Row } from "../knitting/timing/log";
import type { Stitch } from "../types/Stitch";

/**
 * Projects saved against an older revision of their design, brought up to
 * date: see SweaterPattern.revisions.
 *
 * A project's progress is the id of the last stitch it worked, and an id is
 * the stitch's place in the order of work. When a revision adds steps - the
 * pattern's stitch markers, say - every stitch after one of them moves on,
 * and a project saved before it would come back that many stitches short.
 * Brought up to date, it is at the same stitch again: past every step added
 * before it, with any added straight after it still to do. Its knitting-time
 * log counts in progress too, and moves on with it.
 *
 * A revision names the kinds of step it added, which the design had none of
 * before it; the knitting as it was is the knitting now without them.
 */

/** How many revisions of its design a project started now counts in: all of them. */
export const currentRevision = (sweaterId: string): number => sweaterById(sweaterId)?.revisions?.length ?? 0;

/**
 * Where each stitch of the knitting as it was is now: `moved(id)` is the id
 * that stitch has among `stitches`, which are the same with the steps of the
 * kinds in `added` put in.
 */
export const movedOn = (stitches: Stitch[], added: ReadonlySet<string>): ((id: number) => number) => {
  const kept = stitches.filter((stitch) => !added.has(stitch.type)).map((stitch) => stitch.id);
  return (id) => kept[Math.min(Math.max(id, 0), kept.length - 1)];
};

/** A knitting-time log moved on: each change of progress, from where it began moved on to where it ended moved on. */
export const movedLog = (rows: Row[], moved: (id: number) => number): Row[] => {
  let progress = 0;
  return rows.map(([seconds, change, ...flag]) => {
    const from = progress;
    progress += change;
    return [seconds, change === 0 ? 0 : moved(progress) - moved(from), ...flag];
  });
};

/**
 * Where a project saved against an older revision of its design is now: its
 * progress moved on, and a way to move its knitting-time log on with it. None
 * for a project already up to date, or of a design or size no longer known.
 */
export const migration = (project: { sweaterId: string; sizeId: string; progress: number; revision?: number }) => {
  const sweater = sweaterById(project.sweaterId);
  const revisions = sweater?.revisions ?? [];
  const from = project.revision ?? 0;
  const size = sweater?.sizes.find((one) => one.id === project.sizeId);
  if (!sweater || !size || from >= revisions.length) return undefined;
  const added = new Set<string>(revisions.slice(from).flatMap((revision) => revision.added));
  const moved = movedOn(sweaterStitches(sweater, size.id).stitches, added);
  return {
    progress: moved(project.progress),
    revision: revisions.length,
    log: (rows: Row[]) => movedLog(rows, moved),
  };
};
