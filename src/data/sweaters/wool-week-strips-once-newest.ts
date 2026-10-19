import { stripSampler } from "./wool-week/strips/design";

/**
 * Each year once, newest at the neck: 2026 to 2024 round the yoke, 2023 to
 * 2019 down the body, 2018 to 2014 down both sleeves. One of the strip
 * samplers; see wool-week/strips/design.ts.
 */
export default stripSampler({
  id: "wool-week-strips-once-newest",
  name: "Each Year Once, newest at the neck",
  story:
    "Every Shetland Wool Week hat from 2014 to 2026, each once, newest first: " +
    "the latest three round the yoke, the next five down the body, the first " +
    "five down both sleeves, ending with the Shwook Hat at the cuffs. Every " +
    "year has about the same length, so each hat shows its whole motif and " +
    "most of its borders. The sleeves taper at a seam under the arm.",
  layout: { kind: "once", order: "newest" },
});
