/**
 * Each Year Once's yoke through the 2014 bands: how it grows from the neck to
 * the sheep, round by round, size by size.
 *
 * The Shwook Hat's two star bands, 24 and 28 stitches round, have no plain
 * or one-colour row in them to increase in, and the yoke can't wait for the
 * round after them. So each band fans out as it goes, in steps that keep it
 * the hat's band:
 *
 * - Every increase doubles a column of the band, with a symmetric single
 *   increase - one stitch made into two, charted as a KFB and its second loop.
 * - Columns are doubled in mirror-image pairs either side of the band's mirror
 *   lines, or singly on one, so every repeat stays a mirror image of itself.
 *   Every repeat takes the same, so the yoke stays alike all the way round.
 * - Every increase is worked on the band's background - the yarn the motif
 *   sits on, with that yarn in the stitches below: in the 24-stitch band the
 *   lighter yarn of the row, taupe at the borders and cream round the crosses
 *   and circles; in the 28-stitch band the darker, gold at the borders and
 *   navy round its motifs.
 * - A band that starts on more stitches than the round above has - where no
 *   plain round comes before it - starts with its make-ones mirrored, the
 *   same in every repeat, on background stitches.
 * - The 6-stitch peerie, half one yarn and half the other, is never widened.
 *
 * Within those rules, the steps were chosen by a search over each size's plan,
 * keeping the count as near as it can be to the yoke's target (see knit), never
 * more than 12% over it, with the rest of the yoke as it would be. It is the
 * yoke's "option 7", chosen from seven drawn side by side.
 */

/**
 * One round of the 2014 bands, in the plan's order from the neck: a plain
 * round's count; a band row knitted as it stands, on the repeat as it has
 * grown (null); a band row that doubles these columns of the hat's repeat,
 * numbered as knitted from 0; or a band's first row started on more stitches,
 * its make-ones at these columns of each repeat.
 */
export type Fan = number | null | { double: number[] } | { start: number; at: number[] };

export const fans: Record<string, Fan[]> = {
  xs: [192, null, null, null, null, null, { double: [6, 18] }, null, null, { double: [7, 17] }, null, null, null, null, { double: [7, 17] }, null, null, null, null, null, null, null],
  s: [196, 216, null, null, null, null, null, { double: [12] }, null, null, null, { double: [11, 13] }, null, null, null, { double: [12] }, null, null, { double: [11, 13] }, null, null, null, null],
  m: [200, 216, null, null, null, null, null, { double: [6, 18] }, null, null, null, { double: [8, 16] }, null, null, null, { double: [7, 17] }, null, null, { double: [6, 18] }, null, null, null, null, 300],
  l: [{ start: 192, at: [2, 7, 12, 17, 22] }, { double: [6, 18] }, { double: [6, 18] }, null, null, null, { double: [10, 14] }, null, null, { double: [12] }, null, { double: [7, 17] }, { double: [11, 13] }, null, null, null, null, null, null, { double: [12, 16] }, null, null, { double: [14] }, null, null, null],
  xl: [216, 216, null, null, { double: [6, 18] }, null, null, { double: [8, 16] }, null, null, null, { double: [7, 17] }, null, null, null, 280, null, { double: [14] }, null, null, { double: [9, 19] }, null, null, null, { double: [13, 15] }, null, null, null, null, 360],
  "2xl": [216, 216, null, { double: [6, 18] }, null, null, { double: [7, 17] }, null, null, null, { double: [11, 13] }, null, null, { double: [6, 18] }, null, 308, null, null, null, null, null, { double: [13, 15] }, null, null, null, { double: [9, 19] }, null, null, null],
  "3xl": [224, 224, 240, null, null, { double: [12] }, null, null, { double: [11, 13] }, null, null, { double: [11, 13] }, null, null, null, { double: [12] }, 308, null, null, { double: [8, 20] }, null, null, null, { double: [12, 16] }, null, null, { double: [14] }, null, null, { double: [13, 15] }, 385, 385],
  "4xl": [232, 232, 240, null, { double: [6, 18] }, null, null, null, { double: [8, 16] }, null, null, null, { double: [7, 17] }, null, null, null, null, null, null, null, { start: 336, at: [0, 9, 19] }, null, { double: [8, 20] }, null, null, null, null, { double: [12, 16] }, null, null, null, { double: [8, 20] }, null, 408, 408],
};
