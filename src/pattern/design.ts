/**
 * A design, as the site shows one: what it is called, its pieces and yarn
 * slots, its sizes and what they measure, its colourways, and what it says of
 * its stitches. Nothing a sweater is built from - no chart, no round - which
 * is the compiler's (see compiler/designs/types), and reaches the site only
 * as knitting already worked out: see library.
 *
 * The shape follows how Fair Isle patterns are written: a chart is drawn once
 * in yarn *slots* (A, B, C...), and a colourway says which real wool goes in
 * each slot. So the chart is the design and the colourway is a costume, and
 * changing colourway never touches the knitting.
 */

import type { WoolId } from "./yarns";

/**
 * A yarn slot, as the design names it: "A", "B", "C"... for a design drawn
 * in a handful of yarns, or "MC" and "1A", "1B", "2A"... for a yoke of many
 * bands, each knitted in two yarns of its own.
 */
export type SlotId = string;

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
  /** Where the design has many, the group the picker shows it in: a knitting tradition. */
  family?: string;
  brand: string;
  yarn: string;
  /** Which range of the yarn library it is knitted in, for the picker. */
  wool?: string;
  url: string;
  /** Metres and grams in one ball, for the shopping list. */
  ballMetres?: number;
  ballGrams?: number;
  shades: Shade[];
  /**
   * The yarns the trim may be knitted in instead of its own, where the
   * design has a trim (see SweaterPattern.trim): each a shade of that slot.
   * Choosing one is part of choosing the colourway, not wool of the
   * knitter's own.
   */
  trims?: Shade[];
  /**
   * Its yarns follow where a band sits down the garment: the shades above are
   * for the design as published, and for a sweater laid out otherwise its
   * yarns by place are fetched (see library/colourways) and placed on it (see
   * reading/palette's placed).
   */
  stepped?: true;
}

/**
 * Where the bands of a sweater sit, as its planner laid them out for one
 * knitter: each band planned afresh, by what the design calls it, at its
 * place down the garment from 0 at the neck to 1 at the hem or cuff; and for
 * each part of the trim, the bands it is knitted beside. The bands already
 * knitted are not among them: their wool is in the fabric.
 */
export interface Placement {
  places: Record<string, number>;
  trims?: Record<SlotId, string[]>;
}

/**
 * A stepped colourway's yarns by place (see Colourway.stepped): for each of
 * the design's bands, the slots that share each of its yarns, and that yarn
 * at each of the places in `at`, as a number among `wools`.
 */
export interface Steps {
  at: number[];
  wools: Omit<Shade, "slot">[];
  bands: Record<string, { slots: SlotId[][]; wools: number[][] }>;
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

/** How tightly something is knitted: stitches and rounds to 10cm. */
export interface Tension {
  stitchesPer10cm: number;
  roundsPer10cm: number;
}

/** A size without its knitting: what it measures and is knitted on. */
export interface SizeAbout {
  id: string;
  label: string;
  /** The chest it is made to fit, before the ease. */
  toFitChestCm: number;
  /** Who it fits, where the pattern says so in other words than a chest: "2-3 years". */
  fits?: string;
  finished: Measurements;
  /** Over the stocking stitch and colourwork, after blocking. */
  stitchesPer10cm: number;
  roundsPer10cm: number;
  needlesMm: number;
  /** The ribbing's finer needles. */
  ribNeedlesMm?: number;
  /** Larger needles for the colourwork, where the design loosens it. */
  colourNeedlesMm?: number;
  /**
   * Metres of each yarn, where the pattern states them: a bought pattern's
   * own shopping list, which is better than any estimate. Left out, they
   * are worked out from the stitches; see reading/yardage.
   */
  yardage?: Record<SlotId, number>;
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

export interface Piece {
  id: string;
  label: string;
}

/**
 * A design without its knitting: everything the site shows of one. The site
 * reads designs from the catalogue, written from the designs' own files by
 * `npm run editions`, and their knitting from its editions.
 */
export interface Design {
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
  /**
   * A slot a knitter chooses separately from the rest of the colourway,
   * among the colourway's own trims: the ribbing at the neck, waist and
   * wrists, say.
   */
  trim?: { slot: SlotId; label: string; note?: string };
  colourways: Colourway[];
  /** Anything the design says about its stitches. See StitchNote. */
  stitchNotes?: Partial<Record<StitchKeyId, StitchNote>>;
  /**
   * Whether a size can be planned afresh for a knitter whose tension is not
   * the pattern's - whole, from the cast-on, or the rest of one part knitted -
   * and the ways it can be laid out where the knitter has a choice. See
   * library/fit.
   */
  fitting?: { options?: FitOption[] };
  sizes: SizeAbout[];
}

/** One way a design can lay out the rest of a sweater part knitted. */
export interface FitOption {
  id: string;
  label: string;
  detail: string;
}
