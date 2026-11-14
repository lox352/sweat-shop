import library from "./shetland-yarns.json";

/**
 * Every Shetland wool the site knows how to offer, and where to buy it.
 *
 * Nine hundred and ninety-eight shades from the five spinners whose yarn
 * these patterns are written in - Jamieson's of Shetland, Jamieson & Smith,
 * Uradale, Laxdale and Aister 'oo' - read off their own shops. It does two
 * jobs. Every hat's shades are pinned to an entry here, so one wool is one
 * colour wherever it appears rather than one colour per hat; and a knitter
 * choosing their own can pick out of the whole of it.
 *
 * The colours are estimates sampled from the spinners' product photographs -
 * the best anyone outside a dye house has - and then corrected, because a
 * photograph of a ball of wool is partly the shadow between its strands and
 * comes out darker than the wool. The correction is a lightness one and
 * leaves the hue alone: across the whole library it lifts shades named white
 * from a mean of 182 to 221 and leaves shades named black at 62, and mean
 * saturation moves by three thousandths. Raw, Jamieson & Smith's Optic White
 * sampled as a mid brown.
 *
 * They are still estimates, and a photograph is not a dye lot. Where a shade
 * matters, the wool in your hands wins: see the yarn picker.
 *
 * Two spinners in these patterns are not here at all, because they do not
 * sell online in a form that can be read: Foula Wool and the handspun in
 * 2021's fifth colourway. Those shades keep the colours they had.
 */
/** One shade of one yarn. */
export interface Shade {
  name: string;
  /** The spinner's own shade number, where they use one. */
  code?: string;
  hex: string;
  url: string;
  /** Set only when the shop is not taking orders for it. */
  soldOut?: boolean;
}

/**
 * One yarn: a spinner's range, and every shade they spin it in.
 *
 * Stored this way round because that is how wool is sold and how it is
 * shopped for - nobody wants Spindrift's two hundred and twenty-seven shades
 * mixed in with Aran - and because it means each range says its spinner's
 * name once rather than two hundred and twenty-seven times.
 */
export interface Range {
  spinner: string;
  /** Which of their yarns, e.g. "Spindrift". */
  range: string;
  /** "fingering", "dk", "aran"... as the shop lists it. */
  weight: string;
  colours: Record<WoolId, Shade>;
}

export type RangeId = string;
export type WoolId = string;

/** A shade with everything about it, which is how the rest of the site wants it. */
export interface Wool extends Shade {
  id: WoolId;
  rangeId: RangeId;
  spinner: string;
  range: string;
  weight: string;
}

export const ranges = library as Record<RangeId, Range>;

let flat: Record<WoolId, Wool> | undefined;

/** Every shade of every yarn, by id. Worked out once. */
export const wools = (): Record<WoolId, Wool> => {
  if (flat) return flat;
  flat = {};
  for (const [rangeId, range] of Object.entries(ranges)) {
    for (const [id, shade] of Object.entries(range.colours)) {
      flat[id] = {
        ...shade,
        id,
        rangeId,
        spinner: range.spinner,
        range: range.range,
        weight: range.weight,
      };
    }
  }
  return flat;
};

export const woolById = (id: string | undefined): Wool | undefined =>
  id ? wools()[id] : undefined;

/**
 * The library grouped the way it is shopped: by spinner, then by yarn.
 *
 * Worked out once and kept, because the picker asks for it on every keystroke
 * and it never changes.
 */
export interface WoolRange {
  id: RangeId;
  spinner: string;
  range: string;
  weight: string;
  wools: Wool[];
}

let grouped: WoolRange[] | undefined;

export const woolRanges = (): WoolRange[] => {
  if (grouped) return grouped;
  const all = wools();
  grouped = Object.entries(ranges).map(([id, range]) => ({
    id,
    spinner: range.spinner,
    range: range.range,
    weight: range.weight,
    wools: Object.keys(range.colours).map((key) => all[key]),
  }));
  return grouped;
};

/**
 * Wools matching what someone has typed.
 *
 * Name, shade number, yarn and spinner all count, so "spindrift port",
 * "293" and "jamieson wine" all find the same wool.
 */
export const searchWools = (query: string, within?: RangeId): Wool[] => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const out: Wool[] = [];
  for (const range of woolRanges()) {
    if (within && range.id !== within) continue;
    for (const wool of range.wools) {
      const haystack =
        `${wool.spinner} ${wool.range} ${wool.name} ${wool.code ?? ""}`.toLowerCase();
      if (words.every((word) => haystack.includes(word))) out.push(wool);
    }
  }
  return out;
};
