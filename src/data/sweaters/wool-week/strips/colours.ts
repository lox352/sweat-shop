import type { Colourway, Shade } from "../../types";
import { yearOf } from "../years";
import data from "./colourways.json";
import { type Plan, groundsOf, placesOf } from "./plan";
import { allSlots, letterOf, yearOfSlot } from "./slots";

/**
 * The strip samplers' colourways: a yarn for every slot. All but the
 * arithmetic is in colourways.json, worked out by scripts/strip-colourways.mjs;
 * here each is assembled for a design, two of them by where its years sit.
 *
 * Each family is one entry in `families` below: taking one out takes its
 * colourways off every strip sampler.
 */

type Places = Record<number, { frac: number; parity: number }>;

/** What a design's layout tells its colourways: where each year sits, which are on the yoke, and each year's grounds. */
interface Layout {
  places: Places;
  yoke: Set<number>;
  grounds: Record<number, string[]>;
}

interface Yarn {
  name: string;
  code: string;
  hex: string;
  wool: string;
}
const yarns = data.yarns as Record<string, Yarn>;
const rungs = data.rungs as Record<string, Record<string, Record<string, number>>>;
const ladders = data.ladders as Record<string, number[]>;
const own = data.own as Record<string, Record<string, string>>;
const collections = data.collections as Record<string, Record<string, number>>;
const checked = data.checked as Record<string, Record<string, { wool?: string; approximate?: boolean }>[]>;

const spindrift = {
  brand: "Jamieson's of Shetland",
  yarn: "2ply Jumper Weight (Spindrift)",
  wool: "jamieson-s-of-shetland-spindrift",
  url: "https://www.jamiesonsofshetland.co.uk",
  ballMetres: 105,
  ballGrams: 25,
};

const fromLibrary = (slot: string, code: string | number): Shade => {
  const y = yarns[String(code)];
  return { slot, wool: y.wool, name: y.name, code: y.code, hex: y.hex, source: "library" };
};

/** A Spindrift colourway, each slot's yarn by its year and the hat's letter. */
const spindriftColourway = (id: string, name: string, pick: (year: number, letter: string) => string | number): Colourway => ({
  id,
  name,
  ...spindrift,
  shades: allSlots.map((slot) => fromLibrary(slot, pick(yearOfSlot(slot), letterOf(slot)))),
});

/** Each year in one of its own published colourways, by index. */
const publishedColourway = (id: string, name: string, picks: Record<string, number>): Colourway => {
  const brands = new Set<string>();
  const shades = allSlots.map((slot): Shade => {
    const year = yearOfSlot(slot);
    const index = picks[year];
    const cw = yearOf(year).colourways[index];
    brands.add(cw.brand);
    const letter = letterOf(slot, cw.part);
    const s = cw.shades[letter];
    const link = checked[year][index][letter];
    return link.wool
      ? { slot, wool: link.wool, name: s.name, ...(s.code ? { code: s.code } : {}), hex: s.hex, source: "library" }
      : { slot, name: s.name, ...(s.code ? { code: s.code } : {}), hex: s.hex, source: "approximate" };
  });
  const brand = brands.size === 1 ? [...brands][0] : "Several mills";
  return { id, name, brand, yarn: "Each hat's own", url: "https://www.shetlandwoolweek.com", ballMetres: 110, ballGrams: 25, shades };
};

/** Every year's first colourway, as its designer published it. */
const firsts = Object.fromEntries([...new Set(allSlots.map(yearOfSlot))].map((y) => [y, 0]));

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
};

/*
 * Light and dark grounds. A year's ground is the commonest yarn over its
 * strips; a hat built of separate two-colour bands, each on its own ground,
 * has a ground for every band, and they go light or dark together - they
 * never meet in a round, so they can share a yarn.
 */
const banded: Record<number, string[]> = { 2025: ["A", "D", "F", "G"], 2026: ["B", "D", "E"] };

/** Each year's grounds: its commonest yarn (see plan's groundsOf), or a banded hat's every band's. */
const groundsFor = (plan: Plan): Record<number, string[]> =>
  Object.fromEntries(Object.entries(groundsOf(plan)).map(([y, g]) => [y, banded[+y] ?? [g]]));

/**
 * Where a year's yarns go on a palette of `top + 1` places, darkest first, for a light or dark ground:
 * its grounds at the light or dark end, the hat's other yarns keeping their order of lightness (`rank`),
 * spread evenly over the rest. Where the palette has too few places to give the grounds an end of their
 * own, the hat's yarns are turned over instead, if that's what the mode asks.
 */
const placed = (rank: Record<string, number>, grounds: string[], light: boolean, top: number) => {
  const G = -1;
  const value = (l: string) => (grounds.includes(l) ? G : rank[l]);
  const others = [...new Set(Object.keys(rank).filter((l) => !grounds.includes(l)).map((l) => rank[l]))].sort((a, b) => a - b);
  const order = light ? [...others, G] : [G, ...others];
  return (l: string): number => {
    if (order.length - 1 > top) return (rank[grounds[0]] * 2 >= top) === light ? rank[l] : top - rank[l];
    return order.length === 1 ? (light ? top : 0) : Math.round((order.indexOf(value(l)) * top) / (order.length - 1));
  };
};

/*
 * A picture whose colours mean something keeps them, light year or dark: 2015's sheep are white sheep,
 * so their bodies (B) take the palette's lightest yarn and their faces and legs (C) its darkest. The sky
 * (D) goes dark in a dark year, a night sky, and to the middle in a light one, never above the sheep; the
 * field (A) sits between. Each letter's place is a fraction of the way from darkest to lightest.
 */
const pictures: Record<number, (light: boolean) => Record<string, number>> = {
  2015: (light) => ({ B: 1, C: 0, A: 0.6, D: light ? 0.4 : 0 }),
};

/** Light or dark grounds year by year on one palette: each year's letters to a Spindrift yarn. */
const grounded = (palette: string, layout: Layout, light: (year: number) => boolean) => {
  const maps = new Map<number, (letter: string) => string>();
  return (year: number, letter: string): string => {
    if (!maps.has(year)) {
      const grounds = layout.grounds[year];
      const picture = pictures[year]?.(light(year));
      const where = (rank: Record<string, number>, top: number) =>
        picture ? (l: string) => Math.round(picture[l] * top) : placed(rank, grounds, light(year), top);
      if (palette === "own") {
        const mine = own[year];
        const codes = [...new Set(Object.values(mine))].sort((a, b) => lum(yarns[a].hex) - lum(yarns[b].hex));
        const rank = Object.fromEntries(Object.entries(mine).map(([l, c]) => [l, codes.indexOf(c)]));
        const at = where(rank, codes.length - 1);
        maps.set(year, (l) => codes[at(l)]);
      } else {
        // Simmer dim works within its four rungs, a step lighter the further the year from the neck.
        const simmer = palette === "simmer";
        const rank = rungs[simmer ? "simmer" : palette][year];
        const base = simmer ? Math.round(layout.places[year].frac * 2) : 0;
        const at = where(rank, simmer ? 3 : 5);
        maps.set(year, (l) => String(ladders[palette][base + at(l)]));
      }
    }
    return maps.get(year)!(letter);
  };
};

const palettes: [id: string, name: string][] = [
  ["classic", "Aa ae colour: classic"],
  ["undyed", "Aa ae colour: undyed"],
  ["simmer", "Simmer dim"],
  ["own", "Each year its own"],
];
// The first is a design's default: Aa ae colour: classic, all dark.
const modes: [id: string, name: string, light: (year: number, layout: Layout) => boolean][] = [
  ["dark", "all dark", () => false],
  ["light-yoke", "light yoke, dark below", (y, l) => l.yoke.has(y)],
  ["light", "all light", () => true],
  ["turns", "light and dark by turns", (y) => (y - 2014) % 2 === 0],
];

export interface Family {
  id: string;
  colourways: (layout: Layout) => Colourway[];
}

export const families: Family[] = [
  {
    // Each palette with every year's ground set light or dark: the yarns stay the palette's, only which is ground and which motif changes.
    id: "grounds",
    colourways: (layout) =>
      palettes.flatMap(([pid, pname]) =>
        modes.map(([mid, mname, light]) => spindriftColourway(`${pid}-${mid}`, `${pname}, ${mname}`, grounded(pid, layout, (y) => light(y, layout)))),
      ),
  },
  {
    id: "ladders",
    colourways: ({ places }) => [
      spindriftColourway("classic", "Aa ae colour: classic", (y, l) => ladders.classic[rungs.classic[y][l]]),
      spindriftColourway("undyed", "Aa ae colour: undyed", (y, l) => ladders.undyed[rungs.undyed[y][l]]),
      // Every other year turned over: its darkest yarn on the lightest rung.
      spindriftColourway("licht", "Licht an mirk", (y, l) => ladders.classic[places[y].parity % 2 ? 5 - rungs.classic[y][l] : rungs.classic[y][l]]),
      // Four neighbouring rungs of six, a step lighter the further a year sits from the neck.
      spindriftColourway("simmer", "Simmer dim", (y, l) => ladders.simmer[Math.round(places[y].frac * 2) + rungs.simmer[y][l]]),
    ],
  },
  {
    id: "own",
    colourways: () => [spindriftColourway("own", "Each year its own", (y, l) => own[y][l])],
  },
  {
    id: "designers",
    colourways: () => [publishedColourway("designers", "As the designers knitted them", firsts)],
  },
  {
    id: "collections",
    colourways: () => [
      publishedColourway("c-together", "Best together", collections.together),
      publishedColourway("c-undyed", "Undyed (the hats' own)", collections.undyed),
      publishedColourway("c-js", "All Jamieson & Smith", collections.js),
      publishedColourway("c-jamiesons", "All Jamieson's", collections.jamiesons),
      publishedColourway("c-uradale", "Uradale and organics", collections.uradale),
      publishedColourway("c-sea", "Sea and sky", collections.sea),
      publishedColourway("c-heath", "Heather and peat", collections.heath),
      publishedColourway("c-bright", "Simmer brights", collections.bright),
    ],
  },
];

/** Every colourway of a strip sampler, from its plan in one size: where its years sit, and their grounds. */
export const colourwaysFor = (plan: Plan): Colourway[] => {
  const layout: Layout = { places: placesOf(plan), yoke: new Set(plan.strips.yoke.map((s) => s.year)), grounds: groundsFor(plan) };
  return families.flatMap((f) => f.colourways(layout));
};
