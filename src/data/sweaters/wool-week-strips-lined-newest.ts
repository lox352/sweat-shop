import { stripSampler } from "./wool-week/strips/design";

/**
 * Thirteen strips, lined up, newest at the neck: 2026 round the neck to 2014
 * at the hem, and the same strips down each sleeve, round for round, with
 * 2014 carrying on to the cuff. One of the strip samplers; see
 * wool-week/strips/design.ts.
 */
export default stripSampler({
  id: "wool-week-strips-lined-newest",
  name: "Thirteen Strips, newest at the neck",
  story:
    "Every Shetland Wool Week hat from 2014 to 2026, each in a strip of the " +
    "same height, the newest round the neck and the oldest at the hem. The " +
    "sleeves carry the same strips round for round, so they line up with the " +
    "body when the arms hang down, and the Shwook Hat runs on down each " +
    "sleeve to the cuff. Each hat is cut to fit its strip around its own " +
    "centre, and the sleeves taper at a seam under the arm.",
  layout: { kind: "lined", newestFirst: true },
});
