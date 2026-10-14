import type { Stitch } from "../types/Stitch";
import { consumption } from "../types/StitchType";
import type { Held } from "./needles";

/**
 * Stitches on hold, and everything that will be knitted from them.
 *
 * Putting stitches on hold is setting a region of the knitting aside: a run
 * of consecutive stitches goes onto waste yarn, and nothing that grows out of
 * them - every stitch knitted into them, and into those, at whatever remove -
 * can be knitted until they are taken up again. Where stitches were cast on
 * in their place, as at a sleeve's underarm, the piece that takes them up
 * picks up out of that edge as well, to go round with them, and what grows
 * out of those is set aside with them too. So a sleeve's region is its held
 * stitches, the stitches it picks up out of its underarm and all of their
 * descendants: the whole sleeve. The underarm cast-on itself is not - the
 * body is knitted on from it.
 *
 * A region is on hold from the step that holds it until the step that takes
 * it up again, whenever in the knitting that comes: nothing about it depends
 * on which piece is knitted first.
 */
export interface HoldRegion extends Held {
  /** The held stitches, those picked up to go with them, and every stitch knitted from them. */
  region: Set<number>;
}

export const holdRegions = (stitches: Stitch[], holds: Held[]): HoldRegion[] =>
  holds.map((held) => {
    const region = new Set(held.stitches);
    const edge = new Set(held.edge);
    const first = held.stitches.reduce((least, id) => Math.min(least, id), Infinity);
    // Stitches are in the order they are worked, so a stitch's parents always come before it.
    for (let id = first + 1; id < stitches.length; id++) {
      const stitch = stitches[id];
      if (stitch.type === "pickUp" && stitch.from !== undefined && edge.has(stitch.from)) {
        region.add(id);
        continue;
      }
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
