import type { Colourway, Shade } from "../../types";
import { yearOf } from "../years";
import data from "./colourways.json";
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

export interface Family {
  id: string;
  colourways: (places: Places) => Colourway[];
}

export const families: Family[] = [
  {
    id: "ladders",
    colourways: (places) => [
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

export const colourwaysFor = (places: Places): Colourway[] => families.flatMap((f) => f.colourways(places));
