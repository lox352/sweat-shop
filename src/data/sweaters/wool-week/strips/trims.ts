/**
 * Stitches a band may leave out, as background, when it is narrowed (see
 * regions.ts): by year and chart, each chart row's places in the repeat as
 * knitted (tileOf's), mirror partners included.
 *
 * - **2023's flowers.** The four birch-branch stems running out at 45° from
 *   each flower towards its neighbours come within a stitch of the next
 *   flower's at the corners between them. Shortened along their slant, the
 *   flowers can come a stitch nearer the three crosses between them, a
 *   34-stitch repeat narrowed to 32: three stitches from each corner, the
 *   branch's tip in the band's edge round and the end of the twig below it.
 */
export const TRIMS: Record<string, Record<number, number[]>> = {
  "2023C": {
    25: [0, 3, 29, 32],
    22: [0, 32],
    4: [0, 32],
    1: [0, 3, 29, 32],
  },
};
