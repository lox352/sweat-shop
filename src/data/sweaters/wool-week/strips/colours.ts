import type { Colourway, Shade } from "../../types";
import data from "./colourways.json";
import { allSlots, letterOf, trimSlot, yearOfSlot } from "./slots";

/**
 * The strip samplers' colourways: a palette, all light or all dark, and a
 * trim. All but the assembling is in colourways.json, worked out by
 * scripts/strip-colourways.mjs: each palette's yarns, and each hat's yarns
 * put onto them by what they are - ground, figure, or a middle that stands
 * off both - with the ground on the palette's lights for all light and on
 * its darks for all dark.
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
  name: string;
  note: string;
  yarns: string[];
  light: { ground: string; maps: Record<string, Record<string, string>> };
  dark: { ground: string; maps: Record<string, Record<string, string>> };
}
const yarns = data.yarns as Record<string, Yarn>;
const palettes = data.palettes as Palette[];

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

/** Every colourway of a strip sampler: each palette, all dark then all light. */
export const colourways: Colourway[] = palettes.flatMap((p) =>
  modes.map(([mode, label]): Colourway => {
    const { ground, maps } = p[mode];
    return {
      id: `${p.id}-${mode}`,
      name: `${p.name}, ${label}`,
      ...spindrift,
      shades: [
        ...allSlots.map((slot) => shadeOf(slot, maps[yearOfSlot(slot)][letterOf(slot)])),
        shadeOf(trimSlot, ground),
      ],
      trims: p.yarns.map((code) => shadeOf(trimSlot, code)),
    };
  }),
);
