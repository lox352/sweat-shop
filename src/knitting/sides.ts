import type { Stitch } from "../types/Stitch";
import type { StitchType } from "../types/StitchType";

/** A side of the sweater: the side it is worn with out, or its reverse. */
export type Face = "right" | "wrong";

/**
 * The stitches that are only ever one of the sweater's own seen from behind.
 *
 * Turn knitting over and every stitch in it is another stitch: a knit seen
 * from the back is a purl, and a k2tog a p2tog - which is also exactly what
 * you would work from that side to make it, and why a chart key gives most
 * of its symbols as a pair, one stitch for a right-side row and one for a
 * wrong-side row (the Craft Yarn Council's standard chart symbols, Random
 * House's stitch key). The pairs:
 *
 *   knit                purl
 *   knit tbl            purl tbl
 *   k2tog               p2tog, which leans the same way from the right side
 *   ssk                 ssp, likewise
 *   s2kp, centred       s2pp: slip two through the back loops, purl one and
 *                       pass the two over (Purl Soho's s2pp, Tin Can Knits)
 *   sk2p, leaning left  p2sps: purl two together, slip that back, pass the
 *                       next stitch over it and slip it on again (Remade By
 *                       Hand); an sssp is close
 *   make one            make one purlwise, with the same lean from the right
 *                       side (Purl Soho's m1L purlwise, Brianak Designs)
 *   kfb                 pbf: purl into the back of the stitch, then its front
 *   kbf                 pfb
 *   pick up and knit    pick up and purl
 *   bind off            bind off purlwise
 *
 * A KFB puts its new stitch on its left as it is worked, and so does a PFB:
 * the second loop goes on the needle past the first. Turned over, that is on
 * the right, so a KFB from behind is not a PFB but its mirror, a PBF, and a
 * PFB from behind looks like a KBF, whose new stitch is on its right.
 *
 * A cast-on is a cast-on from either side, and a step - joining the round,
 * a turn - is the same step. A purlwise bind-off is one of the sweater's own
 * as well, where a rib is bound off in pattern.
 */
export type ReverseStitch =
  | "p1tbl"
  | "p2tog"
  | "ssp"
  | "s2pp"
  | "p2sps"
  | "m1p"
  | "pfb"
  | "pbf"
  | "pickUpPurl";

/** Any stitch a chart can show: one of the sweater's, or one of them from behind. */
export type ChartStitch = StitchType | ReverseStitch;

const pairs: [ChartStitch, ChartStitch][] = [
  ["k1", "p1"],
  ["k1tbl", "p1tbl"],
  ["k2tog", "p2tog"],
  ["ssk", "ssp"],
  ["s2kp", "s2pp"],
  ["sk2p", "p2sps"],
  ["m1", "m1p"],
  ["kfb", "pbf"],
  ["kbf", "pfb"],
  ["pickUp", "pickUpPurl"],
  ["bindOff", "bindOffPurl"],
];
const pairOf = new Map<ChartStitch, ChartStitch>(pairs.flatMap(([a, b]) => [[a, b], [b, a]]));

/** A stitch from the other side of the fabric: its pair, or itself where it has none. */
export const reverseOf = (stitch: ChartStitch): ChartStitch => pairOf.get(stitch) ?? stitch;

/**
 * A stitch as it is worked, from the side it is worked from: what the
 * knitting panel says to do, and what it is timed as.
 *
 * A short row worked back from the wrong side is stored as what it makes on
 * the right side, knits; worked, from the wrong side, it is purls, and the
 * increase a short row may make, a KBF from the right side, is a PFB.
 */
export const workedAs = (stitch: Pick<Stitch, "type" | "wrongSide">): StitchType | "pfb" =>
  !stitch.wrongSide
    ? stitch.type
    : stitch.type === "k1"
      ? "p1"
      : stitch.type === "p1"
        ? "k1"
        : stitch.type === "kbf"
          ? "pfb"
          : stitch.type;

/**
 * What the chart shows a stitch as, seen from one side of the sweater.
 *
 * From the right side, what it looks like there: a short row purled back from
 * the wrong side is knits, as the fabric round it is. From the wrong side, its
 * pair: every knit a purl, every purl a knit, a k2tog a p2tog. Where that is
 * not what was worked - fabric worked with the other side towards you - the
 * chart hatches it; see Chart.
 */
export const seenFrom = (stitch: Pick<Stitch, "type">, face: Face): ChartStitch =>
  face === "wrong" ? reverseOf(stitch.type) : stitch.type;
