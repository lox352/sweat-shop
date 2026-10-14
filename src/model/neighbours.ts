import { Stitch, before, isFabric } from "../types/Stitch";
import { consumption } from "../types/StitchType";

/**
 * Which way each drawn stitch faces, as the stitches it is measured against.
 *
 * A stitch is drawn square to the fabric around it: across, towards the
 * stitch before it in its round, and up, from what it was worked into to it -
 * the way the knitting grew. Both come from the stitch's own links, so they
 * hold wherever the fabric goes: round the body, out along a sleeve, over
 * the bend under an arm, where no one axis would do for all of them.
 *
 * Not every stitch has both. The first stitch cast on and the first of a
 * piece begun with new yarn have nothing before them, and a cast-on stitch
 * or a make-one was worked into nothing; each is measured against the
 * stitch on its other side instead - the next in its round, or the first
 * worked into it - the other way round. A picked-up stitch's "below" is the
 * edge stitch it was drawn out of.
 *
 * Four ids a stitch, by its place among the drawn: across is the first
 * position less the second, and up the third less the fourth. -1 where even
 * that fails, which leaves the drawing to fall back on something sensible.
 */
export interface Neighbours {
  drawn: Stitch[];
  pairs: Int32Array;
}

export const neighboursOf = (stitches: Stitch[], rounds: number[][]): Neighbours => {
  const drawn = stitches.filter(isFabric);
  const fabric = (id: number | undefined): id is number =>
    id !== undefined && stitches[id] !== undefined && isFabric(stitches[id]);

  // The stitch after each in its round, and the first stitch worked into each.
  const after = new Int32Array(stitches.length).fill(-1);
  for (const round of rounds) {
    for (let index = 0; index + 1 < round.length; index++) after[round[index]] = round[index + 1];
  }
  const child = new Int32Array(stitches.length).fill(-1);
  for (const stitch of stitches) {
    if (!isFabric(stitch)) continue;
    for (const id of stitch.links.slice(0, consumption[stitch.type])) {
      if (child[id] === -1) child[id] = stitch.id;
    }
  }

  const pairs = new Int32Array(drawn.length * 4).fill(-1);
  drawn.forEach((stitch, index) => {
    const at = index * 4;
    const previous = before(stitch, consumption[stitch.type]);
    if (fabric(previous)) {
      pairs[at] = previous;
      pairs[at + 1] = stitch.id;
    } else if (after[stitch.id] !== -1) {
      pairs[at] = stitch.id;
      pairs[at + 1] = after[stitch.id];
    }
    // Of what it works, the middle, as the chart anchors a decrease.
    const worked = stitch.links.slice(0, consumption[stitch.type]).filter(fabric);
    const below = worked.length > 0 ? worked[Math.floor(worked.length / 2)] : stitch.from;
    if (fabric(below)) {
      pairs[at + 2] = stitch.id;
      pairs[at + 3] = below;
    } else if (child[stitch.id] !== -1) {
      pairs[at + 2] = child[stitch.id];
      pairs[at + 3] = stitch.id;
    }
  });
  return { drawn, pairs };
};
