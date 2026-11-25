import { stripSampler } from "./wool-week/strips/design";

/**
 * Each Year Once, its yoke shaped to the body: the same thirteen hats in the
 * same order, the same bands and the same counts round by round, with each
 * round's increases put where bodies of the size have room for them - fewer
 * down the middle of the back, more over the shoulders, the same on the left
 * as on the right. One of the strip samplers; see
 * wool-week/strips/design.ts and body.ts.
 */
export default stripSampler({
  id: "wool-week-strips-once-oldest-shaped",
  name: "Each Year Once, shaped",
  story:
    "Every Shetland Wool Week hat from 2014 to 2026, each once, in date order: " +
    "the first three round the yoke, the next five down the body, the last " +
    "five down both sleeves, as Each Year Once has them. The yoke is shaped " +
    "to the body: where a round yoke increases evenly all the way round, this " +
    "one makes fewer new stitches down the middle of the back and more over " +
    "the shoulders, where a body has the room for them, and the same on the " +
    "left as on the right.",
  layout: { kind: "refit" },
  shaped: true,
});
