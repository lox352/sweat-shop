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

/**
 * A move on the needles: what a recipe is written in. Close to the abstract
 * machine knitting machines are programmed for (Knitout's), a needle at a
 * time, so that a kind is a few of them and the engine knows only the moves.
 *
 * - `take`: take the next so many loops off the needle, to work.
 * - `bar`, `strand`, `edge`: what a new loop is drawn through when it is not
 *   a loop on the needle - the bar between two stitches, nothing at all, a
 *   stitch of an edge. They take nothing.
 * - `make`: draw one new loop of yarn through what was taken.
 * - `slip`: move the loop taken across as it is, with no new yarn.
 * - `passOver`: lift the loop before this one over it, fastening that one.
 * - `keep`: the loop goes on the needle. `finish`: it is fastened off.
 */
export type Move = { take: number } | "bar" | "strand" | "edge" | "make" | "slip" | "passOver" | "keep" | "finish";

export interface Kind {
  family: Family;
  /** The method, as a knitter would name it. */
  variant: string;
  /** How it is worked, in moves on the needles: what the engine does for one. A step has none; what it does is the engine's own. */
  recipe: Move[];
  /** How many loops on the needle it works: what its recipe takes. */
  takes: number;
  /** Makes two loops of one: its second is the make-one stored straight after it. */
  makesTwo?: true;
  /** Leaves nothing on the needle: its recipe finishes its loop. */
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

/** A recipe as it is written: "take(2) make keep". */
const movesOf = (recipe: string): Move[] =>
  recipe.split(" ").filter(Boolean).map((word) => {
    const taken = /^take\((\d+)\)$/.exec(word);
    return taken ? { take: Number(taken[1]) } : (word as Move);
  });

const kind = (family: Family, variant: string, written: string, said: string, rest: Partial<Kind> = {}): Kind => {
  const recipe = movesOf(written);
  const takes = recipe.reduce((total, move) => total + (typeof move === "object" ? move.take : 0), 0);
  return { family, variant, recipe, takes, said, ...(recipe.includes("finish") ? { finishes: true as const } : {}), ...rest };
};

const one = "take(1) make keep";
const two = "take(2) make keep";
const three = "take(3) make keep";
// Drawn through the bar between two stitches. A KFB's second loop is stored as one too, and is worked into the KFB's own stitch: see the engine.
const fromTheBar = "bar make keep";

export const kinds: Record<KindId, Kind> = {
  castOn: kind("castOn", "longTail", "strand make keep", "cast on", { perStitch: true, effort: "castOn" }),
  k1: kind("work", "knit", one, "knit", { otherSide: "p1", perStitch: true, effort: "knit" }),
  p1: kind("work", "purl", one, "purl", { otherSide: "k1", purlwise: true, perStitch: true, effort: "purl" }),
  k1tbl: kind("work", "knitTbl", one, "knit", { after: "tbl", otherSide: "p1tbl", perStitch: true, effort: "tbl" }),
  p1tbl: kind("work", "purlTbl", one, "purl", { after: "tbl", otherSide: "k1tbl", purlwise: true, perStitch: true, effort: "tbl" }),
  m1: kind("increase", "m1", fromTheBar, "m1", { otherSide: "m1p", effort: "makeOne" }),
  m1p: kind("increase", "m1p", fromTheBar, "m1p", { otherSide: "m1", purlwise: true, effort: "makeOne" }),
  // A KFB puts its new stitch past the first, and so does a PFB: turned over, each is the other's mirror. See reading/sides.
  kfb: kind("split", "kfb", one, "KFB", { makesTwo: true, otherSide: "pbf", effort: "kfb" }),
  kbf: kind("split", "kbf", one, "KBF", { makesTwo: true, otherSide: "pfb", effort: "kfb" }),
  pfb: kind("split", "pfb", one, "PFB", { makesTwo: true, otherSide: "kbf", purlwise: true, effort: "kfb" }),
  pbf: kind("split", "pbf", one, "PBF", { makesTwo: true, otherSide: "kfb", purlwise: true, effort: "kfb" }),
  k2tog: kind("decrease", "k2tog", two, "k2tog", { otherSide: "p2tog", effort: "decrease" }),
  p2tog: kind("decrease", "p2tog", two, "p2tog", { otherSide: "k2tog", purlwise: true, effort: "decrease" }),
  ssk: kind("decrease", "ssk", two, "ssk", { otherSide: "ssp", effort: "decrease" }),
  ssp: kind("decrease", "ssp", two, "ssp", { otherSide: "ssk", purlwise: true, effort: "decrease" }),
  s2kp: kind("decrease", "s2kp", three, "s2kp", { otherSide: "s2pp", effort: "doubleDecrease" }),
  s2pp: kind("decrease", "s2pp", three, "s2pp", { otherSide: "s2kp", purlwise: true, effort: "doubleDecrease" }),
  sk2p: kind("decrease", "sk2p", three, "sk2p", { otherSide: "p2sps", effort: "doubleDecrease" }),
  p2sps: kind("decrease", "p2sps", three, "p2sps", { otherSide: "sk2p", purlwise: true, effort: "doubleDecrease" }),
  sl1po: kind("slip", "passCastOnOver", "take(1) slip passOver keep", "slip 1 and pass the cast-on over", { effort: "decrease" }),
  pickUp: kind("pickUp", "knit", "edge make keep", "pick up and knit", { otherSide: "pickUpPurl", perStitch: true, effort: "pickUp" }),
  pickUpPurl: kind("pickUp", "purl", "edge make keep", "pick up and purl", { otherSide: "pickUp", purlwise: true, perStitch: true, effort: "pickUp" }),
  bindOff: kind("bindOff", "knitwise", "take(1) make finish", "bind off", { otherSide: "bindOffPurl", perStitch: true, effort: "bindOff" }),
  bindOffPurl: kind("bindOff", "purlwise", "take(1) make finish", "bind off purlwise", { otherSide: "bindOff", purlwise: true, perStitch: true, effort: "bindOff" }),
  // The steps: part of the order of work, and no fabric.
  join: kind("step", "join", "", "join in the round", { effort: "join" }),
  needles: kind("step", "needles", "", "change needles", { effort: "needles" }),
  hold: kind("step", "hold", "", "put stitches on hold", { effort: "hold" }),
  resume: kind("step", "resume", "", "take up the held stitches", { effort: "resume" }),
  turn: kind("step", "german", "", "turn and make a double stitch", { effort: "turn" }),
  marker: kind("step", "marker", "", "place a marker"),
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
