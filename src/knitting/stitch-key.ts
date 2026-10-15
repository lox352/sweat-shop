import { Stitch, isStep, joinsCastOn } from "../types/Stitch";
import { makesTwo } from "../types/StitchType";
import type { StitchKeyId, StitchNote } from "../data/sweaters/types";
import { type ChartStitch, type Face, type ReverseStitch, seenFrom, workedAs } from "./sides";

/**
 * The symbol key, worked out from the stitches a design actually uses.
 *
 * Built from the knitting rather than from a fixed list, so a design is only
 * ever told about the stitches it has, and in the terms that fit it: a KFB
 * is one entry for both of the loops it makes, and "make one" is only listed
 * where a make-one is picked up on its own between two stitches.
 *
 * Read one of two ways. As the stitches are worked, which is what the
 * knitting panel explains: a short row purled back from the wrong side is
 * purls. Or as the chart shows them from one side of the sweater, which is
 * what its key explains: from the right side as they look there, and from the
 * wrong side each as its pair from behind - see sides.ts.
 */
export type KeyId = StitchKeyId | ReverseStitch;

/** Which way the key reads the stitches: as worked, or as seen from a side. */
export type KeyView = "worked" | Face;

type Notes = Partial<Record<StitchKeyId, StitchNote>>;

export interface KeyEntry {
  id: KeyId;
  /** The stitch whose mark the key draws. */
  type: ChartStitch;
  /** As a pattern abbreviates it. */
  abbreviation?: string;
  label: string;
  /** How to work it, in a sentence or two. */
  how: string;
  /** Where one is worth it, how to work it step by step. */
  steps?: string[];
  /** Another way to work it, and why you might. */
  alternative?: string;
  /** Anything this particular pattern says about it. */
  note?: string;
  /** Which way it leans, where the pattern says: see StitchNote.lean. */
  lean?: "left" | "right";
}

const standard: Record<KeyId, Omit<KeyEntry, "note">> = {
  /*
   * Casting on, by where it is done. The neck begins the knitting, with two
   * ends to work from, and wants an edge firm enough to carry the sweater and
   * stretchy enough to go over a head: a long-tail cast-on. An underarm is
   * cast on part way round, with only the yarn already at the needle and no
   * tail to make a long-tail with, and is an edge the sleeve picks up from
   * later: a knitted cast-on, worked with the work turned, is neat and firm and
   * picks up cleanly. The backward-loop cast-on needs no turn, and is the
   * quickest, but it is looser, and can leave a gap at the corners.
   */
  castOn: {
    id: "castOn",
    type: "castOn",
    abbreviation: "CO",
    label: "Long-tail cast-on",
    how:
      "The neck is cast on with the long-tail method, along the bottom of the " +
      "chart: firm enough to carry the whole sweater, and stretchy enough to go " +
      "over a head as long as it is not pulled tight.",
    steps: [
      "Measure the tail: wrap the yarn ten times round the needle, and allow that much for every ten stitches to cast on, and 20cm more to weave in.",
      "Make a slip knot there and put it on the needle. It is the first stitch.",
      "Hold the needle in your right hand, the tail over your left thumb and the yarn from the ball over your left forefinger, both ends held in your palm.",
      "Take the needle up through the loop round your thumb, over and round the strand on your forefinger, and back down through the thumb loop.",
      "Let the thumb loop go and spread thumb and finger to snug the new stitch up on the needle - snug, not tight. Repeat until all are on.",
      "For a neck that goes over a head with room to spare, cast on over two needles held together, and slide one out before you join.",
    ],
  },
  castOnUnderarm: {
    id: "castOnUnderarm",
    type: "castOn",
    abbreviation: "CO",
    label: "Knitted cast-on, at the underarm",
    how:
      "Cast on part way round, in the place of stitches put on hold, with the " +
      "yarn already at the needle: turn the work and knit the new stitches on. " +
      "A neat, firm edge, which the sleeve picks up from cleanly.",
    steps: [
      "With the sleeve's stitches on hold, turn the work so the wrong side faces you. The stitches just knitted are on your left needle now, the yarn hanging from the first of them.",
      "Put the right needle into that first stitch as if to knit, wrap the yarn and pull a loop through, leaving the old stitch where it is.",
      "Put the new loop on the left needle, in front of the old one: one stitch cast on. Knit the next into it the same way, and go on until all are on.",
      "Turn the work back, right side facing, and knit on from the next stitch, pulling the yarn firm across the gap.",
    ],
    alternative:
      "Without turning: the backward-loop cast-on. Loop the yarn round your left " +
      "thumb so the strand from the needle crosses in front, put the needle up " +
      "through the loop and let it go, snugging it onto the right needle. Quicker, " +
      "but looser, and its loops can open into a gap at each end.",
  },
  join: {
    id: "join",
    type: "join",
    label: "Join in the round",
    how:
      "The arrows show the round leaving its last stitch and coming back in " +
      "at its first.",
  },
  k1: {
    id: "k1",
    type: "k1",
    label: "Knit",
    how: "A plain cell: knit the stitch in the colour shown.",
  },
  p1: {
    id: "p1",
    type: "p1",
    abbreviation: "p",
    label: "Purl",
    how: "Bring the yarn to the front and purl the stitch.",
  },
  k1tbl: {
    id: "k1tbl",
    type: "k1tbl",
    abbreviation: "k tbl",
    label: "Knit through the back loop",
    how: "Put the needle into the back leg of the stitch and knit it, which twists it.",
  },
  kfb: {
    id: "kfb",
    type: "kfb",
    abbreviation: "KFB",
    label: "Knit front and back",
    how:
      "Knit into the stitch but leave it on the left needle, then knit into " +
      "the back of the same stitch and slip it off. One stitch becomes two, " +
      "the new one to its left; the pair is one instruction.",
  },
  kbf: {
    id: "kbf",
    type: "kbf",
    abbreviation: "KBF",
    label: "Knit back and front",
    how:
      "Knit the stitch, then put the left needle into the leg of the stitch " +
      "below it from the back and knit that through the back loop. One stitch " +
      "becomes two, a KFB's mirror; the pair is one instruction.",
  },
  m1: {
    id: "m1",
    type: "m1",
    abbreviation: "m1",
    label: "Make one",
    how:
      "With the left needle, lift the strand between the stitch just worked " +
      "and the next from front to back, and knit it through the back loop. " +
      "A new stitch between two, with none below it.",
  },
  k2tog: {
    id: "k2tog",
    type: "k2tog",
    abbreviation: "k2tog",
    label: "Knit two together",
    how: "Knit the next two stitches together as one. Leans to the right.",
  },
  ssk: {
    id: "ssk",
    type: "ssk",
    abbreviation: "ssk",
    label: "Slip, slip, knit",
    how:
      "Slip two stitches one at a time as if to knit, put the left needle " +
      "into their fronts and knit them together. Leans to the left.",
  },
  s2kp: {
    id: "s2kp",
    type: "s2kp",
    abbreviation: "s2kp",
    label: "Centred double decrease",
    how:
      "Slip two together as if to knit, knit one, then pass the two slipped " +
      "stitches over. Three become one, with the middle stitch on top.",
  },
  sk2p: {
    id: "sk2p",
    type: "sk2p",
    abbreviation: "sk2p",
    label: "Left-leaning double decrease",
    how:
      "Slip one, knit two together, then pass the slipped stitch over. " +
      "Three become one, leaning to the left.",
  },
  sl1po: {
    id: "sl1po",
    type: "sl1po",
    abbreviation: "sl1, pso",
    label: "Slip one, pass the cast-on over",
    how:
      "Slip the next stitch purlwise, then lift the last stitch cast on over " +
      "it and off the needle: the cast-on closed up to the stitches after it, " +
      "with no gap at the corner.",
  },
  pickUp: {
    id: "pickUp",
    type: "pickUp",
    abbreviation: "PU",
    label: "Pick up and knit",
    how:
      "Put the needle through the edge where the chart shows, wrap the yarn " +
      "and draw a loop through: a new stitch out of the edge, not the needle.",
  },
  bindOff: {
    id: "bindOff",
    type: "bindOff",
    abbreviation: "BO",
    label: "Bind off",
    how:
      "Knit the stitch, then lift the stitch before it over it and off the " +
      "needle. Keep it loose: a bound-off edge has to stretch as far as the " +
      "rib above it.",
  },
  /*
   * The stitches as they are from the other side of the fabric, which the
   * chart shows while the wrong side is towards you: each is what you would
   * work from that side to make its pair on the right side.
   */
  p1tbl: {
    id: "p1tbl",
    type: "p1tbl",
    abbreviation: "p tbl",
    label: "Purl through the back loop",
    how: "Purl the stitch through its back leg, which twists it: from the other side, a knit through the back loop.",
  },
  pfb: {
    id: "pfb",
    type: "pfb",
    abbreviation: "PFB",
    label: "Purl front and back",
    how:
      "Purl into the stitch but leave it on the left needle, then purl into " +
      "the back of the same stitch and slip it off. One stitch becomes two: " +
      "from the other side, a KFB.",
  },
  m1p: {
    id: "m1p",
    type: "m1p",
    abbreviation: "m1p",
    label: "Make one purlwise",
    how:
      "With the left needle, lift the strand between the stitch just worked " +
      "and the next from front to back, and purl it through the back loop. A " +
      "new stitch between two, with none below it: from the other side, a make-one.",
  },
  p2tog: {
    id: "p2tog",
    type: "p2tog",
    abbreviation: "p2tog",
    label: "Purl two together",
    how: "Purl the next two stitches together as one: from the other side, a k2tog, leaning right.",
  },
  ssp: {
    id: "ssp",
    type: "ssp",
    abbreviation: "ssp",
    label: "Slip, slip, purl",
    how:
      "Slip two stitches one at a time as if to knit, put them back on the " +
      "left needle and purl them together through the back loops: from the " +
      "other side, an ssk, leaning left.",
  },
  s2pp: {
    id: "s2pp",
    type: "s2pp",
    abbreviation: "s2pp",
    label: "Centred double decrease, purled",
    how:
      "Slip two stitches together through the back loops, purl one, then pass " +
      "the two slipped stitches over. Three become one: from the other side, " +
      "the centred double decrease.",
  },
  p2sps: {
    id: "p2sps",
    type: "p2sps",
    abbreviation: "p2sps",
    label: "Left-leaning double decrease, purled",
    how:
      "Purl two together, slip the stitch made back to the left needle, pass " +
      "the next stitch over it and slip it back. Three become one: from the " +
      "other side, an sk2p.",
  },
  pickUpPurl: {
    id: "pickUpPurl",
    type: "pickUpPurl",
    abbreviation: "PU purlwise",
    label: "Pick up and purl",
    how:
      "Put the needle through the edge from behind, wrap the yarn as if to " +
      "purl and draw a loop through: from the other side, a stitch picked up " +
      "and knitted.",
  },
  bindOffPurl: {
    id: "bindOffPurl",
    type: "bindOffPurl",
    abbreviation: "BO purlwise",
    label: "Bind off purlwise",
    how:
      "Purl the stitch, then lift the stitch before it over it and off the " +
      "needle: from the other side, a stitch bound off knitwise.",
  },
};

const order: KeyId[] = [
  "castOn", "castOnUnderarm", "join", "k1", "p1", "k1tbl", "p1tbl", "kfb", "pfb", "kbf", "m1", "m1p", "k2tog", "p2tog",
  "ssk", "ssp", "s2kp", "s2pp", "sk2p", "p2sps", "sl1po", "pickUp", "pickUpPurl", "bindOff", "bindOffPurl",
];

/** Whether an m1 is the second loop of the KFB or KBF just before it. */
export const pairedWithKfb = (stitches: Stitch[], index: number): boolean =>
  stitches[index]?.type === "m1" && makesTwo(stitches[index - 1]?.type);

/**
 * Whether a cast-on stitch is cast on part way round - an underarm, in the
 * place of stitches put on hold - rather than among the knitting's very first
 * stitches, the neck's: what comes before it is something other than more
 * cast-on stitches back to the start.
 */
export const castOnPartWay = (id: number, stitchAt: (id: number) => Stitch | undefined): boolean => {
  let at = id - 1;
  while (at > 0 && stitchAt(at)?.type === "castOn") at--;
  return at > 0;
};

/** A stitch's place in the key, read as worked or as seen from a side. */
const keyIdOf = (stitch: Stitch, view: KeyView, stitches: Stitch[]): KeyId => {
  if (stitch.type === "castOn" && castOnPartWay(stitch.id, (id) => stitches[id])) return "castOnUnderarm";
  return (view === "worked" ? workedAs(stitch) : seenFrom(stitch, view)) as KeyId;
};

/**
 * A key entry, in this pattern's words.
 *
 * A stitch from the other side keeps what the pattern says of its pair only
 * where that still holds of it: a make-one purled leans as the pattern's
 * make-one does, and is abbreviated as that one purlwise.
 */
const entryFor = (id: KeyId, notes: Notes, joinsAfterCastOn: boolean): KeyEntry => {
  const base = standard[id];
  if (id === "m1p") {
    const pair = notes.m1;
    return {
      ...base,
      abbreviation: pair?.abbreviation ? `${pair.abbreviation}P` : base.abbreviation,
      how:
        pair?.lean === "right"
          ? "With the left needle, lift the strand between the stitch just worked and the next from back to " +
            "front, and purl it through the front loop. A new stitch between two, with none below it: from the " +
            "other side, a make-one leaning right."
          : base.how,
      lean: pair?.lean,
    };
  }
  const note = id in reverseIds ? undefined : notes[id as StitchKeyId];
  const how = id === "join" ? joinHow(joinsAfterCastOn) : base.how;
  return {
    ...base,
    abbreviation: note?.abbreviation ?? base.abbreviation,
    label: note?.label ?? base.label,
    how: note?.how ?? how,
    // A design that works it another way says how, step by step, in place of these.
    steps: note?.steps ?? base.steps,
    alternative: note?.alternative ?? base.alternative,
    note: note?.note,
    lean: note?.lean,
  };
};

const reverseIds: Record<ReverseStitch, true> = {
  p1tbl: true,
  p2tog: true,
  ssp: true,
  s2pp: true,
  p2sps: true,
  m1p: true,
  pfb: true,
  pickUpPurl: true,
};

export const stitchKey = (stitches: Stitch[], notes: Notes = {}, view: KeyView = "worked"): KeyEntry[] => {
  const used = new Set<KeyId>();
  let joinAt = -1;
  stitches.forEach((stitch, index) => {
    if (stitch.type === "join" && joinAt < 0) joinAt = index;
    if (stitch.id <= 0 || (isStep(stitch) && stitch.type !== "join")) return;
    if (stitch.type === "m1" && pairedWithKfb(stitches, index)) return;
    used.add(keyIdOf(stitch, view, stitches));
  });
  const afterCastOn = joinAt >= 0 && joinsCastOn(stitches, joinAt);
  return order.filter((id) => used.has(id)).map((id) => entryFor(id, notes, afterCastOn));
};

/**
 * The key's entry for one stitch of the chart, in this pattern's words.
 *
 * The make-one that is the second loop of a KFB is part of the KFB, and is
 * explained as one.
 */
/*
 * How a join in the round is made depends on what it follows: see "join".
 * The key says the way this design does it.
 */
const joinHow = (afterCastOn: boolean): string =>
  (afterCastOn
    ? "After the cast-on, cast on one more stitch. Then, without twisting " +
      "the cast-on, slip that stitch from the right needle to the left, lift " +
      "the first stitch cast on over it and off the left needle, and slip " +
      "the last stitch back to the right needle. "
    : "Without turning, knit the next stitch - the first of the row just " +
      "worked - as the next of the round, pulling a little tighter than " +
      "usual so no gap is left. ") +
  "Place a marker for the start of the round. " +
  standard.join.how;

export const keyEntryAt = (
  stitches: Stitch[],
  id: number,
  notes: Notes = {},
  /** As worked - what to do - or as the chart shows it from a side. */
  view: KeyView = "worked",
): KeyEntry | undefined => {
  const stitch = stitches[id];
  if (!stitch || (isStep(stitch) && stitch.type !== "join")) {
    return undefined;
  }
  const own: Stitch = pairedWithKfb(stitches, id) ? { ...stitch, type: stitches[id - 1].type } : stitch;
  return entryFor(keyIdOf(own, view, stitches), notes, joinsCastOn(stitches, id));
};
