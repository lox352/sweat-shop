import { stripSampler } from "./wool-week/strips/design";

/**
 * Each year once, oldest at the neck: 2014 to 2016 round the yoke, 2017 to
 * 2021 down the body, 2022 to 2026 down both sleeves, each year as full as
 * its piece has room for. One of the strip samplers; see
 * wool-week/strips/design.ts and refit.ts.
 */
export default stripSampler({
  id: "wool-week-strips-once-oldest",
  name: "Each Year Once, oldest at the neck",
  story:
    "Every Shetland Wool Week hat from 2014 to 2026, each once, in date order: " +
    "the first three round the yoke, the next five down the body, the last " +
    "five down both sleeves. Each hat shows as much of itself as its piece " +
    "has room for - the Crofthoose Hat's three strips of houses, both of " +
    "Katie's Kep's star bands, Da Crofter's Kep with its borders - and the " +
    "plain rounds between them carry on the background beside them, as " +
    "many above each hat as below. The sleeves taper without a seam.",
  layout: { kind: "refit" },
});
