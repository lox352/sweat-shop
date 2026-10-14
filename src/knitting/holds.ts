import type { Stitch } from "../types/Stitch";
import { consumption } from "../types/StitchType";
import type { Held } from "./needles";

/**
 * Stitches on hold, and everything that will be knitted from them.
 *
 * Putting stitches on hold is setting a region of the knitting aside: a run
 * of consecutive stitches goes onto waste yarn, and nothing that grows out of
 * them - every stitch knitted into them, and into those, at whatever remove -
 * can be knitted until they are taken up again. A sleeve's held stitches are
 * the region the whole of the sleeve above them grows out of. So a region is
 * the held stitches and all of their descendants, and it is on hold from the
 * step that holds it until the step that takes it up again, whenever in the
 * knitting that comes: nothing about it depends on which piece is knitted
 * first.
 *
 * The stitches a sleeve picks up out of the body's underarm are not part of
 * it - they come out of the body, which is not on hold - though the decreases
 * that take one of them together with one of the held stitches' are.
 */
export interface HoldRegion extends Held {
  /** The held stitches and every stitch knitted from them. */
  region: Set<number>;
}

export const holdRegions = (stitches: Stitch[], holds: Held[]): HoldRegion[] =>
  holds.map((held) => {
    const region = new Set(held.stitches);
    const first = held.stitches.reduce((least, id) => Math.min(least, id), Infinity);
    // Stitches are in the order they are worked, so a stitch's parents always come before it.
    for (let id = first + 1; id < stitches.length; id++) {
      const stitch = stitches[id];
      for (let link = 0; link < consumption[stitch.type]; link++) {
        if (region.has(stitch.links[link])) {
          region.add(id);
          break;
        }
      }
    }
    return { ...held, region };
  });

/** The regions on hold once the knitting has got as far as `progress`. */
export const onHoldAt = (regions: HoldRegion[], progress: number): HoldRegion[] =>
  regions.filter((region) => region.heldAt <= progress && (region.resumedAt === undefined || progress < region.resumedAt));
