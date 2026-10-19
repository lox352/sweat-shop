import { stripSampler } from "./wool-week/strips/design";

/**
 * Each year once, oldest at the neck: 2014 to 2016 round the yoke, 2017 to
 * 2021 down the body, 2022 to 2026 down both sleeves. One of the strip
 * samplers; see wool-week/strips/design.ts.
 */
export default stripSampler({
  id: "wool-week-strips-once-oldest",
  name: "Each Year Once, oldest at the neck",
  story:
    "Every Shetland Wool Week hat from 2014 to 2026, each once, in date order: " +
    "the first three round the yoke, the next five down the body, the last " +
    "five down both sleeves. Every year has about the same length, nearly " +
    "twice what it has when the sleeves repeat the body, so each hat shows " +
    "its whole motif and most of its borders. The sleeves taper at a seam " +
    "under the arm.",
  layout: { kind: "once", order: "oldest" },
});
