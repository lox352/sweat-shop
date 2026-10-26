import type { Colourway, Shade } from "../../types";
import data from "./colourways.json";
import roleData from "./roles.json";
import { allSlots, allTrims, letterOf, trimSlot, yearOfSlot, yearsOfTrim } from "./slots";

/**
 * The strip samplers' colourways: a palette, all light or all dark, and a
 * trim. All but the assembling is in colourways.json, worked out by
 * scripts/strip-colourways.mjs: each palette's yarns, and each hat's yarns
 * put onto them by what they are - ground, figure, or a middle that stands
 * off both - with the ground on the palette's lights for all light and on
 * its darks for all dark.
 *
 * Fifteen palettes, each after a knitting tradition and grouped by where it
 * is from, so thirty colourways; then thirteen of many colours, tens of yarns
 * each, every one built on a single idea - a path round the colour circle,
 * Shetland's places, undyed grounds, Fair Isle shading and more. One of them
 * shades its bands, giving each round of a band its own shades of ground and
 * figure (see slots' bandSlotsOfRow); every other colourway knits a shaded
 * slot in its yarn's own colour.
 *
 * The ribbing is the trim's, no hat's: the neck's, with the back neck's
 * short rows, by default in the darkest yarn the year beside it knits in the
 * colourway, and the waist's and wrists' in the darkest of the years beside
 * them, one yarn for both; or all of it in any of the palette's yarns the
 * knitter chooses (see Colourway.trims, and slots' trimOf).
 */

interface Yarn {
  name: string;
  code: string;
  hex: string;
  wool: string;
}
interface Palette {
  id: string;
  family: string;
  name: string;
  note: string;
  yarns: string[];
  light: { maps: Record<string, Record<string, string>> };
  dark: { maps: Record<string, Record<string, string>> };
}
/** A many-colour palette: one colourway, light or dark grounds as its idea has them. */
interface Many {
  id: string;
  family: string;
  name: string;
  note: string;
  mode: "light" | "dark";
  trims: string[];
  maps: Record<string, Record<string, string>>;
  /** For a palette that shades its bands, each year's yarns for each shade of its slots. */
  shading?: Record<string, { G: string[]; F: string[]; h: string[]; m: string[]; c: string }>;
}
const yarns = data.yarns as Record<string, Yarn>;
const palettes = data.palettes as Palette[];
const many = data.many as Many[];

const spindrift = {
  brand: "Jamieson's of Shetland",
  yarn: "2ply Jumper Weight (Spindrift)",
  wool: "jamieson-s-of-shetland-spindrift",
  url: "https://www.jamiesonsofshetland.co.uk",
  ballMetres: 105,
  ballGrams: 25,
};

const shadeOf = (slot: string, code: string): Shade => {
  const y = yarns[code];
  return { slot, wool: y.wool, name: y.name, code: y.code, hex: y.hex, source: "library" };
};

// All dark first: the design's default is the first palette, all dark.
const modes = [
  ["dark", "all dark"],
  ["light", "all light"],
] as const;

/** A palette's yarn for a slot: the hat's yarn's, or for a shaded slot in a palette that shades, that shade's. */
const codeFor = (maps: Many["maps"], slot: string, shading?: Many["shading"]): string => {
  const year = yearOfSlot(slot);
  const letter = letterOf(slot);
  const own = maps[year][letter];
  const shade = slot.split("/")[1];
  const S = shading?.[year];
  // The pinned sheep and their faces keep their yarn whatever the round.
  if (!shade || !S || (roleData as Record<string, { pins?: Record<string, string> }>)[year]?.pins?.[letter]) return own;
  if (shade === "c") return S.c;
  const i = Number(shade.slice(1));
  return { g: S.G, h: S.h, f: S.F, m: S.m }[shade[0] as "g" | "h" | "f" | "m"][i];
};

/** CIE L*, how light a yarn looks. */
const lightness = (code: string): number => {
  const n = parseInt(yarns[code].hex.slice(1), 16);
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const y = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return 116 * (y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116) - 16;
};

/** Each trim's yarn by default: the darkest any of its years knits, by the colourway's yarn for every slot. */
const trimShades = (codeOf: (slot: string) => string): Shade[] =>
  allTrims.map((trim) => {
    const years = new Set(yearsOfTrim(trim));
    const codes = allSlots.filter((slot) => years.has(yearOfSlot(slot))).map(codeOf);
    return shadeOf(trim, codes.reduce((dark, code) => (lightness(code) < lightness(dark) ? code : dark)));
  });

/** Every colourway of a strip sampler: each palette, all dark then all light; then the many-colour palettes. */
export const colourways: Colourway[] = [
  ...palettes.flatMap((p) =>
  modes.map(([mode, label]): Colourway => {
    const { maps } = p[mode];
    return {
      id: `${p.id}-${mode}`,
      name: `${p.name}, ${label}`,
      family: p.family,
      ...spindrift,
      shades: [...allSlots.map((slot) => shadeOf(slot, codeFor(maps, slot))), ...trimShades((slot) => codeFor(maps, slot))],
      trims: p.yarns.map((code) => shadeOf(trimSlot, code)),
    };
  }),
  ),
  ...many.map(
    (p): Colourway => ({
      id: `${p.id}-${p.mode}`,
      name: p.name,
      family: p.family,
      ...spindrift,
      shades: [...allSlots.map((slot) => shadeOf(slot, codeFor(p.maps, slot, p.shading))), ...trimShades((slot) => codeFor(p.maps, slot, p.shading))],
      trims: p.trims.map((code) => shadeOf(trimSlot, code)),
    }),
  ),
];
