import type { StitchType } from "./StitchType";

/**
 * The kinds of stitch and step, and what is so of each: one table, which the
 * engine, the chart, the panel, the key, the timing and the physics all read,
 * so that a new kind is a row here and not a case in each of them.
 *
 * A kind is a family and a variant. The family is its role - a decrease, an
 * increase, a cast-on - and what the variants of one share: how many loops
 * they take and whether they make one. The variant is the method a knitter
 * would name, and where they differ: which way it leans, what it is called,
 * what it is from the other side.
 *
 * Kinds are only ever added. A frozen edition (see library/editions) names
 * its stitches by kind, so a kind keeps its meaning for good.
 */

/**
 * The stitches that are only ever one of the sweater's own seen, or worked,
 * from behind: see reading/sides.
 */
export type ReverseStitch = "p1tbl" | "p2tog" | "ssp" | "s2pp" | "p2sps" | "m1p" | "pfb" | "pbf" | "pickUpPurl";

/** Any kind: one a sweater is stored in, or one of those from the other side. */
export type KindId = StitchType | ReverseStitch;

export type Family = "castOn" | "work" | "increase" | "split" | "decrease" | "slip" | "pickUp" | "bindOff" | "step";

/** What a kind costs a knitter, as the knitting time counts it: see projects/timing/model. */
export type Effort =
  | "castOn" | "knit" | "purl" | "tbl" | "decrease" | "doubleDecrease" | "makeOne" | "kfb" | "pickUp" | "bindOff"
  | "join" | "hold" | "resume" | "needles" | "turn";

export interface Kind {
  family: Family;
  /** The method, as a knitter would name it. */
  variant: string;
  /** How many loops on the needle it works. */
  takes: number;
  /** Makes two loops of one: its second is the make-one stored straight after it. */
  makesTwo?: true;
  /** Leaves nothing on the needle. */
  finishes?: true;
  /** Worked purlwise: a rib's "p". */
  purlwise?: true;
  /** What it is from the other side of the fabric, where that is another kind: both what it looks like there and what is worked there to make it. */
  otherSide?: KindId;
  /** What a knitter calls it; `after` follows the count, as a pattern writes "knit 2 tbl". */
  said: string;
  after?: string;
  /** Counted in stitches - "purl 2" - where the rest are counted in times worked: "k2tog 3 times". */
  perStitch?: true;
  effort?: Effort;
}

const kind = (family: Family, variant: string, takes: number, said: string, rest: Partial<Kind> = {}): Kind => ({ family, variant, takes, said, ...rest });

export const kinds: Record<KindId, Kind> = {
  castOn: kind("castOn", "longTail", 0, "cast on", { perStitch: true, effort: "castOn" }),
  k1: kind("work", "knit", 1, "knit", { otherSide: "p1", perStitch: true, effort: "knit" }),
  p1: kind("work", "purl", 1, "purl", { otherSide: "k1", purlwise: true, perStitch: true, effort: "purl" }),
  k1tbl: kind("work", "knitTbl", 1, "knit", { after: "tbl", otherSide: "p1tbl", perStitch: true, effort: "tbl" }),
  p1tbl: kind("work", "purlTbl", 1, "purl", { after: "tbl", otherSide: "k1tbl", purlwise: true, perStitch: true, effort: "tbl" }),
  m1: kind("increase", "m1", 0, "m1", { otherSide: "m1p", effort: "makeOne" }),
  m1p: kind("increase", "m1p", 0, "m1p", { otherSide: "m1", purlwise: true, effort: "makeOne" }),
  // A KFB puts its new stitch past the first, and so does a PFB: turned over, each is the other's mirror. See reading/sides.
  kfb: kind("split", "kfb", 1, "KFB", { makesTwo: true, otherSide: "pbf", effort: "kfb" }),
  kbf: kind("split", "kbf", 1, "KBF", { makesTwo: true, otherSide: "pfb", effort: "kfb" }),
  pfb: kind("split", "pfb", 1, "PFB", { makesTwo: true, otherSide: "kbf", purlwise: true, effort: "kfb" }),
  pbf: kind("split", "pbf", 1, "PBF", { makesTwo: true, otherSide: "kfb", purlwise: true, effort: "kfb" }),
  k2tog: kind("decrease", "k2tog", 2, "k2tog", { otherSide: "p2tog", effort: "decrease" }),
  p2tog: kind("decrease", "p2tog", 2, "p2tog", { otherSide: "k2tog", purlwise: true, effort: "decrease" }),
  ssk: kind("decrease", "ssk", 2, "ssk", { otherSide: "ssp", effort: "decrease" }),
  ssp: kind("decrease", "ssp", 2, "ssp", { otherSide: "ssk", purlwise: true, effort: "decrease" }),
  s2kp: kind("decrease", "s2kp", 3, "s2kp", { otherSide: "s2pp", effort: "doubleDecrease" }),
  s2pp: kind("decrease", "s2pp", 3, "s2pp", { otherSide: "s2kp", purlwise: true, effort: "doubleDecrease" }),
  sk2p: kind("decrease", "sk2p", 3, "sk2p", { otherSide: "p2sps", effort: "doubleDecrease" }),
  p2sps: kind("decrease", "p2sps", 3, "p2sps", { otherSide: "sk2p", purlwise: true, effort: "doubleDecrease" }),
  sl1po: kind("slip", "passCastOnOver", 1, "slip 1 and pass the cast-on over", { effort: "decrease" }),
  pickUp: kind("pickUp", "knit", 0, "pick up and knit", { otherSide: "pickUpPurl", perStitch: true, effort: "pickUp" }),
  pickUpPurl: kind("pickUp", "purl", 0, "pick up and purl", { otherSide: "pickUp", purlwise: true, perStitch: true, effort: "pickUp" }),
  bindOff: kind("bindOff", "knitwise", 1, "bind off", { finishes: true, otherSide: "bindOffPurl", perStitch: true, effort: "bindOff" }),
  bindOffPurl: kind("bindOff", "purlwise", 1, "bind off purlwise", { finishes: true, otherSide: "bindOff", purlwise: true, perStitch: true, effort: "bindOff" }),
  // The steps: part of the order of work, and no fabric.
  join: kind("step", "join", 0, "join in the round", { effort: "join" }),
  needles: kind("step", "needles", 0, "change needles", { effort: "needles" }),
  hold: kind("step", "hold", 0, "put stitches on hold", { effort: "hold" }),
  resume: kind("step", "resume", 0, "take up the held stitches", { effort: "resume" }),
  turn: kind("step", "german", 0, "turn and make a double stitch", { effort: "turn" }),
  marker: kind("step", "marker", 0, "place a marker"),
};

/** A kind's name in full: "decrease.k2tog". */
export const nameOf = (id: KindId): string => `${kinds[id].family}.${kinds[id].variant}`;

/** Whether a kind is a step: part of the order of work, but no fabric. */
export const isStepKind = (id: KindId | undefined): boolean => !!id && kinds[id].family === "step";

/** Whether a kind makes two loops of one, its second the make-one straight after it: a KFB or a KBF. */
export const makesTwo = (id: KindId | undefined): boolean => !!id && !!kinds[id].makesTwo;

/** Whether a kind is bound off, leaving nothing on the needle. */
export const boundOff = (id: KindId | undefined): boolean => !!id && !!kinds[id].finishes;

/** A kind from the other side of the fabric: its pair, or itself where it has none. */
export const otherSide = (id: KindId): KindId => kinds[id].otherSide ?? id;
