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

import type { WoolId } from "../yarns";

/**
 * A yarn slot, as the design names it: "A", "B", "C"... for a design drawn
 * in a handful of yarns, or "MC" and "1A", "1B", "2A"... for a yoke of many
 * bands, each knitted in two yarns of its own.
 */
export type SlotId = string;

/**
 * A mark printed in a cell, on top of its colour. A "kfb" is the first of the
 * two loops a KFB makes, and the cell after it is always the second: an "m1".
 */
export type ChartSymbol = "purl" | "k1tbl" | "k2tog" | "ssk" | "s2kp" | "sk2p" | "m1" | "kfb";

export interface ChartCell {
  slot: SlotId;
  symbol?: ChartSymbol;
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

/**
 * Where a shade's colour came from. "library" is the yarn library, sampled
 * from the spinner's own photograph and corrected; "approximate" is a
 * considered stand-in, for a shade the library cannot reach.
 */
export type ShadeSource = "library" | "approximate";

export interface Shade {
  slot: SlotId;
  /**
   * Which wool in the library this is - see data/yarns. Its name, number and
   * colour are copied out of the library rather than looked up, so drawing a
   * sweater never loads a thousand shades; a test keeps the copy honest.
   */
  wool?: WoolId;
  name: string;
  /** The spinner's own shade number, where they use one. */
  code?: string;
  hex: string;
  source: ShadeSource;
}

export interface Colourway {
  id: string;
  /** As the design names it. */
  name: string;
  brand: string;
  yarn: string;
  /** Which range of the yarn library it is knitted in, for the picker. */
  wool?: string;
  url: string;
  /** Metres and grams in one ball, for the shopping list. */
  ballMetres?: number;
  ballGrams?: number;
  shades: Shade[];
}

/**
 * The finished measurements a size is written to, in centimetres.
 *
 * Measured the way a sweater pattern's schematic measures them: the chest all
 * the way round, the yoke from the cast-on to the underarm at the front, the
 * body from the underarm to the hem, the sleeve from the underarm to the cuff.
 */
export interface Measurements {
  chestCm: number;
  neckCm: number;
  yokeDepthCm: number;
  bodyLengthCm: number;
  upperArmCm: number;
  sleeveLengthCm: number;
  cuffCm: number;
}

export interface Size {
  id: string;
  label: string;
  /** The chest it is made to fit, before the ease. */
  toFitChestCm: number;
  finished: Measurements;
  /** Over the stocking stitch and colourwork, after blocking. */
  stitchesPer10cm: number;
  roundsPer10cm: number;
  needlesMm: number;
  /** The ribbing's finer needles. */
  ribNeedlesMm?: number;
  /** Larger needles for the colourwork, where the design loosens it. */
  colourNeedlesMm?: number;
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

/**
 * An entry in the stitch-symbol key. A KFB's second loop is part of "kfb",
 * and a KBF's of "kbf". "castOn" is the neck's, the knitting's first
 * stitches; "castOnUnderarm" is any cast on part way round, with the yarn
 * already at the needle.
 */
export type StitchKeyId =
  | "castOn"
  | "castOnUnderarm"
  | "join"
  | "k1"
  | "p1"
  | "k1tbl"
  | "kfb"
  | "kbf"
  | "m1"
  | "k2tog"
  | "ssk"
  | "s2kp"
  | "sk2p"
  | "sl1po"
  | "pickUp"
  | "bindOff"
  | "bindOffPurl";

/**
 * What a design says about one of its stitches, for the symbol key: its own
 * wording, where it puts it differently, and which way a make-one leans. A
 * design whose cast-on is worked another way gives its own steps, and its
 * own other way, in place of the site's.
 */
export interface StitchNote {
  abbreviation?: string;
  lean?: "left" | "right";
  label?: string;
  how?: string;
  steps?: string[];
  alternative?: string;
  note?: string;
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
 * A stretch of a divide round: knit some, or put some on hold and cast on
 * new stitches in their place.
 */
export type DivideSegment =
  | { work: number }
  | {
      /** The holder's name, which is the piece they will become. */
      hold: string;
      count: number;
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
      /**
       * Begin the round here from now on: after this many of the stitches
       * cast on, where the pattern places the new end-of-round marker. The
       * body is knitted on round from the old beginning to the new before
       * its next round begins.
       */
      newRound?: number;
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
    }
  /**
   * "Divide for body and sleeves": the yoke's last stitches are knitted into
   * the body's first round, the sleeves' put on hold, and the underarms cast
   * on in their place. The round belongs to the body.
   */
  | { type: "divide"; slot: string; segments: DivideSegment[]; fabric?: string }
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

export interface Piece {
  id: string;
  label: string;
}

export interface SweaterPattern {
  id: string;
  name: string;
  designer: string;
  /** A paragraph about where the design came from. */
  story: string;
  /** The copyright line the design carries. */
  credit: string;
  /** The pieces, in the order they are knitted. */
  pieces: Piece[];
  slots: SlotId[];
  /** What each slot is for, in a word or two, where it is clear. */
  slotRoles?: Partial<Record<SlotId, string>>;
  sizes: Size[];
  colourways: Colourway[];
  charts: Chart[];
  /**
   * The design's fabrics, where it knits in more than one, each as a
   * fraction of the tension the size states. `stitch` decides how wide a
   * round comes out - a round is its stitches laid end to end - and `round`
   * how tall its rounds are.
   */
  tensions?: Record<string, { stitch?: number; round?: number }>;
  /** Anything the design says about its stitches. See StitchNote. */
  stitchNotes?: Partial<Record<StitchKeyId, StitchNote>>;
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
