import { Stitch, isFabric } from "../types/Stitch";

/**
 * How much of each yarn a sweater takes, estimated from its stitches.
 *
 * A design of the site's own has no printed shopping list, so it is worked
 * out: every stitch takes a length of its own yarn, and in a round of two
 * yarns the other one is carried behind it as a float. The lengths are
 * estimates for Shetland jumper weight at 28 stitches to 10cm - about 15mm of
 * yarn in a stitch, and a little over a stitch's width in a float - with a
 * tenth added for the swatch, the tails and the knitter's own tension. They
 * say how many balls to buy, rounded up; they are not a promise.
 */
export const metresPerStitch = 0.015;
export const metresPerFloat = 0.0045;
export const margin = 1.1;

/** Metres of each slot, by slot. */
export const metresBySlot = (stitches: Stitch[], rounds: number[][]): Record<string, number> => {
  const metres: Record<string, number> = {};
  const add = (slot: string, length: number) => {
    metres[slot] = (metres[slot] ?? 0) + length;
  };
  for (const round of rounds) {
    const fabric = round.map((id) => stitches[id]).filter(isFabric);
    const yarns = [...new Set(fabric.map((stitch) => stitch.slot))];
    for (const stitch of fabric) {
      add(stitch.slot, metresPerStitch);
      // The other yarn, carried behind.
      if (yarns.length === 2) add(yarns[0] === stitch.slot ? yarns[1] : yarns[0], metresPerFloat);
    }
  }
  for (const slot of Object.keys(metres)) metres[slot] *= margin;
  return metres;
};

/** Balls of a given length, rounded up. */
export const ballsFor = (metres: number, ballMetres: number): number =>
  Math.max(1, Math.ceil(metres / ballMetres));
