import type { Stitch } from "../../../types/Stitch";

/** The first stitch at which two knittings differ, or undefined if one only runs on past the other. */
export const firstDifference = (mine: Stitch[], now: Stitch[]): number | undefined => {
  const same = (a: Stitch, b: Stitch) =>
    a.type === b.type && a.slot === b.slot && a.piece === b.piece && !!a.wrongSide === !!b.wrongSide &&
    a.links.length === b.links.length && a.links.every((link, i) => link === b.links[i]);
  const shorter = Math.min(mine.length, now.length);
  for (let id = 0; id < shorter; id++) if (!same(mine[id], now[id])) return id;
  return mine.length === now.length ? undefined : shorter;
};
