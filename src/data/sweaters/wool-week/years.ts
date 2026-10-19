import sww14 from "./sww14.json";
import sww15 from "./sww15.json";
import sww16 from "./sww16.json";
import sww17 from "./sww17.json";
import sww18 from "./sww18.json";
import sww19 from "./sww19.json";
import sww20 from "./sww20.json";
import sww21 from "./sww21.json";
import sww22 from "./sww22.json";
import sww23 from "./sww23.json";
import sww24 from "./sww24.json";
import sww25 from "./sww25.json";
import sww26 from "./sww26.json";

/**
 * The Shetland Wool Week hats, 2014 to 2026, as the samplers knit from them.
 *
 * Each year is one file beside this one, brought over from the hat site by
 * scripts/import-wool-week.mjs, and one line below: take both out and the
 * year is gone. A file holds what the samplers need and no more - the hat's
 * charts, cell for cell, its first colourway, which is what its yarns are
 * put onto the samplers' palettes from (see scripts/strip-colourways.mjs),
 * and every colourway it was published in. No written instructions come
 * over, only charts.
 *
 * A chart is stored as the hat site stores it: bottom row first, each row
 * the stitches worked in that round, right to left. Each cell is two
 * characters, its yarn and its mark: "A-" a plain stitch in yarn A, "Ap" a
 * purl, "Ak" a k2tog, "As" an s2kp, "Ax" an sk2p, "At" through the back.
 */
export interface Year {
  id: string;
  year: number;
  name: string;
  designer: string;
  credit: string;
  patternUrl: string;
  colourway: { name: string; shades: Record<string, { name: string; hex: string; wool?: string }> };
  gauge: { stitches: number; rounds: number };
  charts: Record<string, string[]>;
  /** Every colourway the hat publishes, for the strip samplers' collections. */
  colourways: PublishedColourway[];
  /**
   * A chart drawn in parts, as 2026's are, cast in another pair of colourways'
   * yarns: the same cells, the yarn letters alone, keyed by the pair.
   */
  printings?: Record<string, Record<string, string[]>>;
}

export interface PublishedColourway {
  id: string;
  name: string;
  brand: string;
  yarn: string;
  url: string;
  wool?: string;
  ballMetres?: number;
  ballGrams?: number;
  /** Which printing of a chart drawn in parts it knits from. */
  part?: string;
  shades: Record<string, { name: string; code?: string; hex: string; source: "library" | "approximate"; wool?: string }>;
}

export const years: Year[] = [sww14, sww15, sww16, sww17, sww18, sww19, sww20, sww21, sww22, sww23, sww24, sww25, sww26] as Year[];

export const yearOf = (year: number): Year => {
  const found = years.find((one) => one.year === year);
  if (!found) throw new Error(`no Wool Week hat for ${year}`);
  return found;
};
