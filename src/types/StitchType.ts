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
 * "bindOffPurl" purls the stitch instead of knitting it: a rib bound off "in
 * pattern" binds its purls off purlwise.
 *
 * "kfb" knits into the front of a stitch and then its back, making two loops
 * of one; "kbf" knits it and then lifts the leg of the stitch below, its
 * mirror, which a raglan line puts on its other side. Either way the second
 * loop is stored as the "m1" straight after it, held by the same stitch.
 *
 * "sl1po" slips a stitch and lifts the stitch just cast on over it: how a
 * cast-on part way round is closed up to the stitches after it, the last
 * stitch cast on passed over the first of them so no gap is left.
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
 *
 * "turn" is turning the work part way round, to knit a short row back the
 * other way: the back of the neck is raised with them. The first stitch
 * after the turn is made a double stitch - slipped, and its two legs pulled
 * up over the needle - and worked as one when a later row or round reaches
 * it. See Needles.turn.
 */
export type StitchType =
  | "castOn"
  | "k1"
  | "p1"
  | "k1tbl"
  | "m1"
  | "kfb"
  | "kbf"
  | "k2tog"
  | "ssk"
  | "s2kp"
  | "sk2p"
  | "sl1po"
  | "pickUp"
  | "bindOff"
  | "bindOffPurl"
  | "join"
  | "needles"
  | "hold"
  | "resume"
  | "turn";

/** How many stitches on the needle this one works. */
export const consumption: Record<StitchType, number> = {
  castOn: 0,
  k1: 1,
  p1: 1,
  k1tbl: 1,
  m1: 0,
  kfb: 1,
  kbf: 1,
  k2tog: 2,
  ssk: 2,
  s2kp: 3,
  sk2p: 3,
  sl1po: 1,
  pickUp: 0,
  bindOff: 1,
  bindOffPurl: 1,
  join: 0,
  needles: 0,
  hold: 0,
  resume: 0,
  turn: 0,
};

/** The step types: part of the order of work, but no fabric. */
export const stepTypes: ReadonlySet<StitchType> = new Set<StitchType>([
  "join",
  "needles",
  "hold",
  "resume",
  "turn",
]);

/** Whether a stitch makes two loops of one, its second the make-one straight after it: a KFB or a KBF. */
export const makesTwo = (type: StitchType | undefined): boolean => type === "kfb" || type === "kbf";

/** Whether a stitch is bound off, leaving nothing on the needle. */
export const boundOff = (type: StitchType | undefined): boolean => type === "bindOff" || type === "bindOffPurl";
