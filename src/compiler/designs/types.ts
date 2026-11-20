/**
 * What a sweater design is, as data.
 *
 * Adding a design means adding one file next to this one and a line in
 * index.ts. Nothing else in the site knows how many designs there are, or
 * anything about a particular one.
 *
 * The shape follows how Fair Isle patterns are written: a chart is drawn once
 * in yarn *slots* (A, B, C...), and a colourway says which real wool goes in
 * each slot. So the chart is the design and the colourway is a costume, and
 * changing colourway never touches the knitting.
 *
 * Where a sweater differs from a hat is that its sizes are different
 * knitting, not just different needles: every size casts on its own number of
 * stitches, increases to its own counts, and divides its yoke its own way. So
 * each size carries its own script, written out from a table of numbers that
 * the grading worked out once and that the tests check every stitch of.
 */

import type { Design, FitOption, Measurements, Placement, SizeAbout, SlotId, Steps, Tension } from "../../pattern/design";
import type { SweaterStitches } from "../../pattern/knitted";

export type * from "../../pattern/design";

/**
 * A mark printed in a cell, on top of its colour. A "kfb" is the first of the
 * two loops a KFB makes, and the cell after it is always the second: an "m1".
 */
export type ChartSymbol = "purl" | "k1tbl" | "k2tog" | "ssk" | "s2kp" | "sk2p" | "m1" | "kfb" | "kbf";

export interface ChartCell {
  slot: SlotId;
  symbol?: ChartSymbol;
  /**
   * A stitch that only spaces the pattern out: the copy of a column a band
   * has doubled, always background. Knitted like any other; left out of the
   * picture of a sweater, so a band is painted at its own repeat.
   */
  spacer?: true;
}

export interface Chart {
  id: string;
  /** What the design calls it: "Peerie", "Border", "OXO". */
  name?: string;
  /**
   * Which fabric this chart is knitted in, where the design has more than
   * one - its ribbing is narrower than its yoke. See SweaterPattern.tensions.
   */
  fabric?: string;
  /**
   * Chart rows, bottom row first, each holding the stitches *worked* in that
   * round of the repeat, right to left as knitted.
   *
   * So a row's length is the stitch count it leaves, and the count it works
   * is what its cells consume - one for a plain stitch, two for a k2tog,
   * none for a make-one.
   */
  rows: ChartCell[][];
}

/** A size: what it measures, and the whole of its knitting. */
export interface Size extends SizeAbout {
  /** The whole knitting, for this size, as the pattern writes it. */
  sections: Section[];
  /**
   * Stitch counts the pattern states out loud, by name: what the neck casts
   * on, what each increase round leaves, how the yoke divides. The engine
   * records the count after every round that names one, and the tests hold
   * the two against each other.
   */
  checks: Record<string, number>;
}

/* -------------------------------------------------------------- the script */

/** One entry in a shaping round: "k4", "m1", or "[m1, k8] to last 6". */
export type ShapingOp =
  | { work: "k" | "p"; times: number }
  | { work: "m1" }
  | { work: "kfb" }
  /** Knit back and front: a KFB's mirror, for the other side of a raglan line. */
  | { work: "kbf" }
  /** Purl front and back: a short row's increase, worked from the wrong side. */
  | { work: "pfb" }
  | { work: "k2tog" }
  | { work: "ssk" }
  | { work: "s2kp" }
  | { work: "sk2p" }
  /** "[m1, k4] to last 5 sts" - repeat until that many are left unworked. */
  | { repeat: ShapingOp[]; untilRemaining: number }
  /** "[m1, k4] x 29" - repeat a fixed number of times. */
  | { repeat: ShapingOp[]; times: number };

/**
 * A stitch marker placed or taken off part way round, once `after` of the
 * round's stitches are worked - nought, before the first. One placed as the
 * round's new beginning moves where the rounds begin from the next one on: a
 * `walk` then knits on to it.
 */
export interface MarkerAt {
  after: number;
  /** What a marker placed marks: "the raglan line". */
  place?: string;
  /** What a marker taken off marked. */
  remove?: string;
  /** Placed as the round's new beginning. */
  begins?: boolean;
}

/**
 * A stretch of a divide round: knit some, or put some on hold and cast on
 * new stitches in their place, or place or take off a marker.
 */
export type DivideSegment =
  /**
   * Knit some: in the round's yarn, or, where the round is part of a picture
   * that runs on through the divide, each stitch in its own.
   */
  | { work: number; slots?: SlotId[] }
  | { place: string; begins?: boolean }
  | { remove: string }
  | {
      /** The holder's name, which is the piece they will become. */
      hold: string;
      count: number;
      /**
       * A marker taken off once they are on hold, before the cast-on: the
       * one that stood after them - "place the sts on waste yarn, RM".
       */
      thenRemove?: string;
      /** Cast on this many in their place, for the body's underarm: the ones that stay cast on. */
      castOn: number;
      /**
       * Wrap the first stitch to go on hold before it goes - yarn to the
       * front, slip it, yarn to the back, slip it back - so the corner of
       * the underarm is left with no hole.
       */
      wrap?: boolean;
      /**
       * Close the cast-on up to the stitches after it: cast on one more,
       * then slip the next stitch and pass that last one over it. The
       * slipped stitch is the first of the next stretch's.
       */
      close?: "slipPassOver";
      /** A marker placed part way through the cast-on: "CO 3, PM for new beginning of round, CO 3". */
      marker?: { after: number; place: string; begins?: boolean };
    };

export type RoundSpec = (
  | { type: "castOn"; count: number; slot: string; fabric?: string }
  /** "Join to work in the round" - straight after the cast-on. */
  | { type: "join" }
  /** "Change to larger needles", or back to the ribbing's, or the colourwork's. */
  | { type: "needles"; to: "rib" | "main" | "colour" }
  | {
      type: "rounds";
      count: number;
      slot: string;
      /** Repeated to the end of each round. Defaults to a single knit. */
      sequence?: ("k" | "p" | "k1tbl")[];
      fabric?: string;
      /** Markers placed or taken off in the first of them. */
      markers?: MarkerAt[];
    }
  | {
      type: "shaping";
      slot: string;
      ops: ShapingOp[];
      /** What it leaves, as the pattern states it. Checked as it is knitted. */
      to: number;
      fabric?: string;
      /** Where to begin working the round: see engine's borrowFor. */
      borrow?: number;
      /** Markers placed or taken off in it. */
      markers?: MarkerAt[];
    }
  | {
      type: "chart";
      chart: string;
      /** Inclusive, 1-based, as the chart is numbered. */
      rows: [number, number];
      /**
       * How many times the repeat goes round. Left out, as many as fit -
       * which must be a whole number, or the pattern is wrong.
       */
      repeats?: number;
      /** How many times to work that block of rows. Defaults to one. */
      passes?: number;
      fabric?: string;
      /** Markers placed or taken off in the first of its rounds. */
      markers?: MarkerAt[];
    }
  /**
   * "Divide for body and sleeves": the yoke's last stitches are knitted into
   * the body's first round, the sleeves' put on hold, and the underarms cast
   * on in their place. The round belongs to the body.
   */
  | { type: "divide"; slot: string; segments: DivideSegment[]; fabric?: string }
  /**
   * "Knit to marker" after a round that placed a new beginning of the round:
   * on from the old beginning, which comes off as it is reached, to the new
   * one, as a round of its own short of the whole way round. The rounds after
   * it begin at the new beginning.
   */
  | { type: "walk"; slot: string; fabric?: string }
  /**
   * The first round of a piece begun from held stitches: pick up and knit
   * `before` stitches from the edge cast on in the holder's place, knit the
   * held stitches, then pick up `after` more - starting, as a sleeve does, at
   * the middle of the underarm. Picking up more than the edge has stitches
   * picks the rest up at its corners, where it meets the held stitches. The
   * held stitches go onto the main needles, whatever the piece before ended
   * on; a rib after that changes needles as a rib anywhere does.
   */
  | {
      type: "piece";
      held: string;
      before: number;
      after: number;
      slot: string;
      fabric?: string;
    }
  /**
   * "Bind off all stitches" - knitwise, or "in pattern", with the stitches
   * of a rib bound off as they were worked: knits knitwise, purls purlwise.
   */
  | { type: "bindOff"; slot: string; fabric?: string; sequence?: ("k" | "p")[] }
  /**
   * German short rows, centred on the beginning of the round - the middle of
   * the back - to raise the back of the neck: `pairs` pairs of rows, the
   * first knitted `first` stitches past the beginning of the round and
   * purled back as far past it the other way, each row after reaching
   * `extend` stitches beyond the turn before. Then the round is knitted on
   * from the last turn to its end, and the next round works the last two
   * double stitches as it reaches them.
   */
  | {
      type: "shortRows";
      /**
       * How each turn is made, and the gap it leaves closed later: a choice
       * the engine expands into the stitches and steps that method is, which
       * differ - a shadow wrap makes a loop more, a wrap and turn a strand to
       * pick up - and not only a name for the turn. German short rows, the
       * one every design here works and the one left out, are the only method
       * the engine knits yet.
       */
      method?: "german";
      first: number;
      extend: number;
      pairs: number;
      slot: string;
      fabric?: string;
      /** How much further the last pair reaches, where the pattern stretches it. */
      extendLast?: number;
      /**
       * Increases on the way back to the beginning of the round: in the last
       * row from the wrong side, as far as the beginning of the round, and in
       * the row that knits on from the last turn to the end of the round -
       * each written as the pattern works it, "p2, pfb, [p6, pfb] x 2, p3".
       */
      shaping?: { wrong?: ShapingOp[]; right?: ShapingOp[] };
    }
) & {
  /** Record the stitch count this leaves under this name; see Size.checks. */
  check?: string;
};

export interface Section {
  label: string;
  /** The piece its rounds belong to. */
  piece: string;
  rounds: RoundSpec[];
}

/** Knitting already made, to carry on from after one of its rounds: see engine's Needles.resume. */
export interface Start {
  knitted: SweaterStitches;
  round: number;
}

/** What the rest of a size is asked to be planned for: see Fitting. */
export interface FitRequest {
  /** What it is to measure, finished. */
  finished: Measurements;
  /** The knitter's own tension. */
  tension: Tension;
  /** What is knitted, and the round it is knitted to. Nothing, for a whole sweater planned from the cast-on: see Fitting.whole. */
  from?: Start;
  /** Which of the design's ways of doing it, where it offers more than one. */
  option?: string;
}

/** The rest of a size, planned: what is still to be knitted, and what the whole then measures. */
export interface Fitted {
  sections: Section[];
  charts: Chart[];
  /** The counts the rest names: see Size.checks. */
  checks: Record<string, number>;
  finished: Measurements;
  /** What the knitter should know of it, a sentence each. */
  notes: string[];
  /** Where the bands planned afresh sit, for a design whose colourways follow that: see Placement. */
  placement?: Placement;
}

/**
 * A design that can plan a sweater for one knitter: whole, from the cast-on,
 * or the rest of one part knitted - for a knitter whose tension is not the
 * pattern's, or whose pattern has changed under them. What is knitted is a
 * fact, kept as it is; the rest is planned for what is on the needles, to
 * come out at the measurements asked for at the tension given. See
 * compiler/fit.
 */
export interface Fitting {
  /** The ways the rest can be laid out, where the knitter has a choice. */
  options?: FitOption[];
  /**
   * The first round, at or after `round`, after which the rest can be planned
   * afresh; none once it no longer can. A design that has none can only be
   * planned whole, from the cast-on.
   */
  cutAfter?(knitted: SweaterStitches, round: number): number | undefined;
  plan(ask: FitRequest): Fitted;
}

/** A design as it is written: a Design, with the charts and the knitting of every size. */
export interface SweaterPattern extends Omit<Design, "sizes"> {
  /** What each slot is for, in a word or two, where it is clear. */
  slotRoles?: Partial<Record<SlotId, string>>;
  sizes: Size[];
  charts: Chart[];
  /**
   * The design's fabrics, where it knits in more than one, each as a
   * fraction of the tension the size states. `stitch` decides how wide a
   * round comes out - a round is its stitches laid end to end - and `round`
   * how tall its rounds are.
   */
  tensions?: Record<string, { stitch?: number; round?: number }>;
  /**
   * Where the design asks more of a knitter than Fair Isle's usual two
   * colours a round and floats of seven stitches at most (see knitting/
   * rules): a design that knits other people's charts as they drew them
   * says so here - a float longer than seven to be caught behind the work,
   * and how long the longest is.
   */
  rules?: { colours?: number; float?: number };
  /**
   * Its sizes knit different cuts of its patterns, so a size may leave some
   * of the design's yarns out: a small one has room for less of each.
   */
  slotsVaryBySize?: boolean;
  /** How the rest of a size is planned from one part knitted, where the design can: see Fitting. */
  fitting?: Fitting;
  /** The yarns by place of its stepped colourways, by colourway: published beside the catalogue, a file each. See Steps. */
  steps?: Record<string, Steps>;
}

/** Stitches a cell works on the needle. */
export const consumes = (cell: ChartCell): number =>
  cell.symbol === "s2kp" || cell.symbol === "sk2p"
    ? 3
    : cell.symbol === "k2tog" || cell.symbol === "ssk"
      ? 2
      : cell.symbol === "m1"
        ? 0
        : 1;
