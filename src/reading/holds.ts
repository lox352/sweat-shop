import { type Stitch, isFabric, worksInto } from "../pattern/Stitch";
import { kinds } from "../pattern/kinds";
import type { Held } from "../pattern/rounds";

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
      // The steps that hold them are no part of what is held.
      if (!isFabric(stitch)) continue;
      if (stitch.type === "pickUp" && stitch.from !== undefined && edge.has(stitch.from)) {
        region.add(id);
        continue;
      }
      for (let link = 0; link < kinds[stitch.type].takes; link++) {
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

const knitFrom = new WeakMap<Stitch[], Map<number, number>>();

/**
 * The stitch knitted into a stitch put on hold, once its piece takes it up:
 * the sleeve's first over it. While the stitch is the one to hold, that is
 * where the knitting is taken to be - as though the stitch to come were
 * knitted there now, and it is in hand twice: held, and then knitted.
 */
export const knittedFromHeld = (stitches: Stitch[], held: number): number | undefined => {
  let over = knitFrom.get(stitches);
  if (!over) {
    over = new Map();
    const waiting = new Set(stitches.filter((stitch) => stitch.type === "hold").flatMap(worksInto));
    for (const stitch of waiting.size > 0 ? stitches : []) {
      if (!isFabric(stitch)) continue;
      for (const below of worksInto(stitch)) if (waiting.has(below) && !over.has(below)) over.set(below, stitch.id);
    }
    knitFrom.set(stitches, over);
  }
  return over.get(held);
};
