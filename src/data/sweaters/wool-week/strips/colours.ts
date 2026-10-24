import type { Colourway, Shade } from "../../types";
import data from "./colourways.json";
import roleData from "./roles.json";
import { allSlots, letterOf, trimSlot, yearOfSlot } from "./slots";

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
 * The neck, waist and wrist ribbing is its own slot, the trim: by default
 * the palette's ground for the colourway, and any of the palette's yarns the
 * knitter chooses (see Colourway.trims).
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
  light: { ground: string; maps: Record<string, Record<string, string>> };
  dark: { ground: string; maps: Record<string, Record<string, string>> };
}
/** A many-colour palette: one colourway, light or dark grounds as its idea has them. */
interface Many {
  id: string;
  family: string;
  name: string;
  note: string;
  mode: "light" | "dark";
  trim: string;
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

/** Every colourway of a strip sampler: each palette, all dark then all light; then the many-colour palettes. */
export const colourways: Colourway[] = [
  ...palettes.flatMap((p) =>
  modes.map(([mode, label]): Colourway => {
    const { ground, maps } = p[mode];
    return {
      id: `${p.id}-${mode}`,
      name: `${p.name}, ${label}`,
      family: p.family,
      ...spindrift,
      shades: [...allSlots.map((slot) => shadeOf(slot, codeFor(maps, slot))), shadeOf(trimSlot, ground)],
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
      shades: [...allSlots.map((slot) => shadeOf(slot, codeFor(p.maps, slot, p.shading))), shadeOf(trimSlot, p.trim)],
      trims: p.trims.map((code) => shadeOf(trimSlot, code)),
    }),
  ),
];
