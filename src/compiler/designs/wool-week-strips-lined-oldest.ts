import { stripSampler } from "./wool-week/strips/design";

/**
 * Thirteen strips, lined up, oldest at the neck: 2014 round the neck to 2026
 * at the hem, and the same strips down each sleeve, with 2026 carrying on to
 * the cuff. One of the strip samplers; see wool-week/strips/design.ts.
 */
export default stripSampler({
  id: "wool-week-strips-lined-oldest",
  name: "Thirteen Strips, oldest at the neck",
  story:
    "Every Shetland Wool Week hat from 2014 to 2026, each in a strip of the " +
    "same height, the oldest round the neck and the newest at the hem. The " +
    "sleeves carry the same strips round for round, so they line up with the " +
    "body when the arms hang down, and the Birsie Beanny runs on down each " +
    "sleeve to the cuff. Each hat is cut to fit its strip around its own " +
    "centre, with as many plain rounds above it as below, and the sleeves " +
    "taper without a seam.",
  layout: { kind: "lined", newestFirst: false },
});
