import { Colourway, Shade, SlotId } from "../data/sweaters/types";
import type { WoolId } from "../data/yarns";
import { RGB } from "../types/RGB";
import { ballsFor } from "./yardage";

/**
 * What each yarn slot looks like.
 *
 * The chart is stored in slots, not colours, so this is the only place a
 * colour is decided and the only thing that changes when you pick a different
 * colourway. Anything a knitter has overridden wins, because the wool in
 * their hands beats the wool in the pattern.
 */

export interface Yarn {
  name: string;
  hex: string;
  /**
   * True when the colour is a considered stand-in rather than one read off
   * the spinner's own shade - and never a colour a knitter has set
   * themselves, which is by definition the right one.
   */
  approximate: boolean;
  code?: string;
  /** Which wool of the library it is, where it is one. */
  wool?: WoolId;
}

export type Palette = Record<string, Yarn>;

/**
 * The wool a knitter has put in a slot in place of the design's own: a ball
 * of wool rather than a hex, with a name and a shade number to buy it by. A
 * colour on its own is still allowed, for the ball whose band went in the bin.
 */
export type Overrides = Partial<
  Record<SlotId, { wool?: WoolId; name?: string; code?: string; hex?: string }>
>;

const asYarn = (shade: Shade): Yarn => ({
  name: shade.name,
  hex: shade.hex,
  code: shade.code,
  wool: shade.wool,
  approximate: shade.source === "approximate",
});

export const paletteOf = (colourway: Colourway, overrides: Overrides = {}): Palette => {
  const out: Palette = {};
  colourway.shades.forEach((shade) => {
    const override = overrides[shade.slot];
    const base = asYarn(shade);
    out[shade.slot] = override
      ? {
          name: override.name ?? base.name,
          code: override.wool || override.hex ? override.code : base.code,
          hex: override.hex ?? base.hex,
          wool: override.wool,
          approximate: false,
        }
      : base;
  });
  return out;
};

/**
 * The yarn slots a knitter reads, without the shades some designs give a
 * slot round by round ("14D/f2" is yarn 14D): each once, in order.
 */
export const shownSlots = (slots: SlotId[]): SlotId[] => [...new Set(slots.map((slot) => slot.split("/")[0]))];

/** Slots named for a key: "14A", "14A + 14C", or past a few, the first and how many more. */
export const slotNames = (slots: SlotId[]): string => {
  const shown = shownSlots(slots);
  return shown.length > 3 ? `${shown[0]} + ${shown.length - 1} more` : shown.join(" + ");
};

/** A design's slots by the yarn each is in a palette, each yarn once, in the order its first slot comes. */
export const keyOf = (slots: SlotId[], palette: Palette): { slots: SlotId[]; yarn: Yarn }[] => {
  const out: { slots: SlotId[]; yarn: Yarn }[] = [];
  for (const slot of slots) {
    const yarn = yarnFor(palette, slot);
    const seen = out.find((entry) => entry.yarn.name === yarn.name && entry.yarn.hex === yarn.hex);
    if (seen) seen.slots.push(slot);
    else out.push({ slots: [slot], yarn });
  }
  return out;
};

/** How a trim is chosen and stored: by its wool, or failing that its shade number or name. */
export const trimIdOf = (shade: Shade): string => shade.wool ?? shade.code ?? shade.name;

/**
 * A colourway with its trim changed to one of its own trims, where the
 * design has one and the choice is still among them; otherwise as it is.
 * A trim in parts, each a slot of its own under the trim's ("trim/14"), is
 * changed in every part.
 */
export const trimmed = (colourway: Colourway, trim: string | undefined): Colourway => {
  const choice = trim === undefined ? undefined : colourway.trims?.find((t) => trimIdOf(t) === trim);
  if (!choice) return colourway;
  return { ...colourway, shades: colourway.shades.map((s) => (s.slot.split("/")[0] === choice.slot ? { ...choice, slot: s.slot } : s)) };
};

const fallback: Yarn = { name: "unknown", hex: "#cccccc", approximate: true };

export const yarnFor = (palette: Palette, slot: string): Yarn => palette[slot] ?? fallback;

export const rgbOf = (hex: string): RGB => {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean.padEnd(6, "0");
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};

/** Readable ink for a label sitting on a yarn. */
export const inkOn = (hex: string): string => {
  const [r, g, b] = rgbOf(hex);
  // Rec. 601 luma is close enough for deciding black or white.
  return (r * 299 + g * 587 + b * 114) / 1000 > 145 ? "#1f1d1b" : "#ffffff";
};

/** One ball of wool: which yarns of the design it does, and how many to buy. */
export interface Ball {
  yarn: Yarn;
  slots: SlotId[];
  /** Metres the size knits up, estimated: see knitting/yardage. */
  metres: number;
  balls: number;
}

/**
 * The wool a colourway is knitted in, a ball at a time.
 *
 * A knitter may put one wool in several of the design's yarns, and nobody
 * wants to be told to buy it twice. So slots sharing a wool come back as one
 * entry, which is what the page lists, counts and changes: a row is a ball,
 * and its count is for all the metres its slots knit up together.
 */
export const ballsOf = (
  colourway: Colourway,
  metres: Record<string, number>,
  overrides: Overrides = {},
): Ball[] => {
  const palette = paletteOf(colourway, overrides);
  const out: Omit<Ball, "balls">[] = [];
  colourway.shades.forEach((shade) => {
    const yarn = palette[shade.slot] ?? asYarn(shade);
    // The same wool, by its library id where there is one and by what it
    // looks like where there is not.
    const seen = out.find((entry) =>
      entry.yarn.wool || yarn.wool
        ? entry.yarn.wool === yarn.wool
        : entry.yarn.name === yarn.name && entry.yarn.hex === yarn.hex,
    );
    const length = metres[shade.slot] ?? 0;
    if (seen) {
      seen.slots.push(shade.slot);
      seen.metres += length;
    } else out.push({ yarn, slots: [shade.slot], metres: length });
  });
  return out.map((entry) => ({
    ...entry,
    balls: ballsFor(entry.metres, colourway.ballMetres ?? 100),
  }));
};

/** How many balls of a colourway have been swapped for wool of the knitter's own. */
export const ownBalls = (colourway: Colourway, overrides: Overrides) =>
  ballsOf(colourway, {}, overrides).filter((ball) => ball.slots.some((slot) => overrides[slot])).length;

/** "Simmer Dim", or "Your own, from Simmer Dim" once any of its wool is changed. */
export const colourwayLabel = (colourway: Colourway, overrides: Overrides | undefined) =>
  overrides && Object.keys(overrides).length > 0 ? `Your own, from ${colourway.name}` : colourway.name;
