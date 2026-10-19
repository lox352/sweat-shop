import { stripSampler } from "./wool-week/strips/design";

/**
 * Each year once, in the order that is easiest to knit. One of the strip
 * samplers; see wool-week/strips/design.ts and its plan's easiestOrder.
 */
export default stripSampler({
  id: "wool-week-strips-once-easiest",
  name: "Each Year Once, easiest order",
  story:
    "Every Shetland Wool Week hat from 2014 to 2026, each once, placed where " +
    "it is easiest to knit rather than by date. Round the yoke go the hats " +
    "with one-colour rounds close together, so the yoke can grow smoothly " +
    "in them: the crofthooses, the Merrie Dancers and Katie's Kep. Down the " +
    "body go the pictures, which need every repeat whole: sheep, anchors, " +
    "boats, flowers and rams. Down the sleeves go the all-over patterns, " +
    "which don't mind meeting part-way at the seam under the arm.",
  layout: { kind: "once", order: "easiest" },
});
