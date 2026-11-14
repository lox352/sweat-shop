import type { Colourway, Design, Shade, SizeAbout, SweaterPattern } from "../types";

/**
 * The catalogue as its file holds it: every design without its knitting (see
 * types' Design), their colourways written small.
 *
 * A colourway names a wool for every yarn slot, and the samplers have dozens
 * of colourways of over a thousand slots each, in a couple of hundred wools:
 * written out, megabytes. So a design's slots are listed once and its wools
 * once, a colourway is a wool for each slot by number, and a list of wools or
 * a colourway that two designs share - the samplers' are nearly all the same
 * - is written once for both.
 */
type Wool = Omit<Shade, "slot">;

/** A wool for each of some slots, each by its number in the design's lists; the slots left out where they are simply the first so many, in order. */
interface Packed {
  slots?: number[];
  wools: number[];
}

interface PackedColourway extends Omit<Colourway, "shades" | "trims"> {
  shades: Packed;
  trims?: Packed;
}

interface PackedDesign extends Omit<Design, "colourways"> {
  shadeSlots: string[];
  /** Which of the catalogue's lists of wools its colourways number their wools in. */
  wools: number;
  /** Its colourways, each by its number among the catalogue's. */
  colourways: number[];
}

export interface CatalogueFile {
  /** In the order the designs are listed. */
  designs: PackedDesign[];
  wools: Wool[][];
  colourways: PackedColourway[];
}

const sizeKeys = ["id", "label", "toFitChestCm", "fits", "finished", "stitchesPer10cm", "roundsPer10cm", "needlesMm", "ribNeedlesMm", "colourNeedlesMm", "yardage"] as const;
const designKeys = ["id", "name", "designer", "story", "credit", "pieces", "slots", "trim", "stitchNotes", "revisions"] as const;

/** A copy of an object's named fields, those it has, in that order. */
const pick = <T extends object, K extends keyof T>(from: T, keys: readonly K[]): Pick<T, K> =>
  Object.fromEntries(keys.filter((key) => from[key] !== undefined).map((key) => [key, from[key]])) as Pick<T, K>;

/** A design without its knitting, as plain data: see types' Design. */
export const aboutOf = (pattern: SweaterPattern): Design => ({
  ...pick(pattern, designKeys),
  sizes: pattern.sizes.map((size): SizeAbout => pick(size, sizeKeys)),
  colourways: pattern.colourways,
});

/** Numbers values as they are first met, the same value the same number. */
const numbering = <T>(list: T[] = []) => {
  const at = new Map<string, number>();
  const of = (value: T): number => {
    const key = JSON.stringify(value);
    let n = at.get(key);
    if (n === undefined) {
      n = list.length;
      at.set(key, n);
      list.push(value);
    }
    return n;
  };
  return { list, of };
};

export const encodeCatalogue = (patterns: SweaterPattern[]): CatalogueFile => {
  const woolLists = numbering<Wool[]>();
  const colourways = numbering<PackedColourway>();
  const designs = patterns.map((pattern): PackedDesign => {
    const { colourways: own, ...about } = aboutOf(pattern);
    const slots = numbering<string>();
    const wools = numbering<Wool>();
    const pack = (shades: Shade[]): Packed => {
      const at = shades.map(({ slot }) => slots.of(slot));
      const packed = shades.map(({ slot, ...wool }) => (void slot, wools.of(wool)));
      return at.every((slot, i) => slot === i) ? { wools: packed } : { slots: at, wools: packed };
    };
    const packed = own.map(({ shades, trims, ...rest }): PackedColourway => ({ ...rest, shades: pack(shades), ...(trims ? { trims: pack(trims) } : {}) }));
    return { ...about, shadeSlots: slots.list, wools: woolLists.of(wools.list), colourways: packed.map(colourways.of) };
  });
  return { designs, wools: woolLists.list, colourways: colourways.list };
};

export const decodeCatalogue = (file: CatalogueFile): Design[] =>
  file.designs.map(({ shadeSlots, wools: list, colourways, ...about }) => {
    const wools = file.wools[list];
    const unpack = (packed: Packed): Shade[] => packed.wools.map((wool, i) => ({ slot: shadeSlots[packed.slots ? packed.slots[i] : i], ...wools[wool] }));
    return {
      ...about,
      colourways: colourways.map((n) => {
        const { shades, trims, ...rest } = file.colourways[n];
        return { ...rest, shades: unpack(shades), ...(trims ? { trims: unpack(trims) } : {}) };
      }),
    };
  });
