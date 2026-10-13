/**
 * The stitches a top-down sweater is made of, and the steps between them.
 *
 * "castOn" is a stitch cast on: the loops the neck is begun with, and the
 * loops cast on part way round at each underarm when the sleeves are put
 * aside. Either way it takes nothing from the needle, because there is
 * nothing there to take.
 *
 * "pickUp" is a stitch picked up and knitted from an edge: the sleeve's
 * underarm stitches, drawn up out of the stitches the body cast on there. It
 * takes nothing from the needle either, but it is held by the edge it came
 * out of - see Stitch.from.
 *
 * "bindOff" works a stitch and passes the one before it over, so that nothing
 * is left on the needle: the hem and the cuffs end in a round of them.
 *
 * k2tog and ssk both take two stitches down to one and lean opposite ways - a
 * k2tog to the right, an ssk to the left - which is why a sleeve decreases
 * with one of each, either side of its underarm. s2kp and sk2p both take three
 * down to one: the centred one slips two together, knits one and passes the
 * two over so the middle stitch finishes on top; the other leans.
 *
 * Then the steps, which are part of the order of work but make no fabric:
 *
 * "join" is joining the cast-on into a round: one stitch more is cast on and
 * lifted over where the two ends meet. See Needles.join.
 *
 * "needles" is changing to needles of another size, between the ribbing and
 * the yoke and back again for the hem and the cuffs.
 *
 * "hold" is putting stitches aside on waste yarn, part way through a round:
 * the sleeves, when the yoke is divided from the body. The stitch carries how
 * many, and which holder.
 *
 * "resume" is putting held stitches back on the needles, to begin the piece
 * they are for: each sleeve begins with one.
 */
export type StitchType =
  | "castOn"
  | "k1"
  | "p1"
  | "k1tbl"
  | "m1"
  | "kfb"
  | "k2tog"
  | "ssk"
  | "s2kp"
  | "sk2p"
  | "pickUp"
  | "bindOff"
  | "join"
  | "needles"
  | "hold"
  | "resume";

/** How many stitches on the needle this one works. */
export const consumption: Record<StitchType, number> = {
  castOn: 0,
  k1: 1,
  p1: 1,
  k1tbl: 1,
  m1: 0,
  kfb: 1,
  k2tog: 2,
  ssk: 2,
  s2kp: 3,
  sk2p: 3,
  pickUp: 0,
  bindOff: 1,
  join: 0,
  needles: 0,
  hold: 0,
  resume: 0,
};

/** The step types: part of the order of work, but no fabric. */
export const stepTypes: ReadonlySet<StitchType> = new Set<StitchType>([
  "join",
  "needles",
  "hold",
  "resume",
]);
