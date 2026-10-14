import { Stitch, isFabric } from "../types/Stitch";
import { consumption } from "../types/StitchType";
import { adjacentStitchDistance } from "../constants";

/**
 * What holds the knitting together: one rope for every link between two
 * stitches, as long as the yarn between them allows.
 *
 * A rope says two stitches may come no further apart than that and nothing
 * at all about them coming closer, which is a fair account of yarn. How long
 * it is depends on what the link is, not on how far apart the two stitches'
 * ids happen to be - which is what the hat site counted, and which a sweater
 * would get wrong at every pick-up:
 *
 * - "below": a stitch and a stitch it was worked into - a round apart;
 * - "picked": a stitch and the edge stitch it was picked up out of - a
 *   round apart too, the edge standing in for the round below;
 * - "before": a stitch and the one worked just before it, which the yarn runs
 *   on from - a stitch apart, including the step from one round into the
 *   next, which is only the next stitch along the helix; but across the turn
 *   at the end of a short row, a stitch along and a round up, since the row
 *   back is worked into the stitches beside the one it turned at.
 *
 * Each is the stitch's own width or height, so a rib knitted narrower than
 * the yoke is held narrower.
 */
export type RopeKind = "below" | "picked" | "before";

export interface Rope {
  a: number;
  b: number;
  length: number;
  kind: RopeKind;
}

export const ropesOf = (stitches: Stitch[], roundHeight: number): Rope[] => {
  const ropes: Rope[] = [];
  const fabric = (id: number | undefined) => id !== undefined && stitches[id] !== undefined && isFabric(stitches[id]);
  for (const stitch of stitches) {
    if (!isFabric(stitch)) continue;
    const width = stitch.width ?? adjacentStitchDistance;
    const rise = stitch.rise ?? roundHeight;
    const worked = consumption[stitch.type];
    const links = stitch.links;
    const hasBefore = links.length > worked;
    // What it works, and anything else it is drawn out of (a KFB's second loop).
    const below = links.slice(0, hasBefore ? links.length - 1 : links.length);
    for (const id of below) if (fabric(id)) ropes.push({ a: stitch.id, b: id, length: rise, kind: "below" });
    if (hasBefore) {
      const id = links[links.length - 1];
      const turned = stitches[stitch.id - 1]?.type === "turn";
      if (fabric(id)) ropes.push({ a: stitch.id, b: id, length: turned ? Math.hypot(width, rise) : width, kind: "before" });
    }
    if (fabric(stitch.from)) ropes.push({ a: stitch.id, b: stitch.from!, length: rise, kind: "picked" });
  }
  return ropes;
};
