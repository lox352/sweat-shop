import type { Chart, Colourway, Size, SweaterPattern } from "./types";
import ladder from "./wool-week/ladder.json";
import { type Graded, type Measured, grade } from "./wool-week/grade";
import { years } from "./wool-week/years";

/**
 * The Wool Week Sampler: every Shetland Wool Week hat from 2014 to 2026 in
 * one top-down jumper, in the order they came out.
 *
 * Each year's hat is knitted round the jumper as its designer charted it,
 * turned for knitting from the neck down so that every picture stands the
 * right way up as worn: 2014 to 2016 round the yoke, 2017 to 2021 down the
 * body, 2022 to 2026 down both sleeves. Every motif of every hat is in every
 * size; what grades the sizes is each hat's extras - its peeries, the stripes
 * between its bands, the rows where its chart repeats itself, and its crown,
 * which on the yoke is worked from its point outwards as an increase and on
 * a sleeve as the hat works it, as a decrease. See wool-week/grade.ts.
 *
 * Thirteen hats' yarns are put onto ten, a ladder from darkest to lightest,
 * each hat's yarns in their own order of lightness (see
 * scripts/ladder.mjs): any colourway that keeps the ladder in order keeps
 * every hat's lights and darks.
 *
 * The charts are the designers', from the patterns Shetland Wool Week
 * publishes; this site is not public, and each year can be taken out in one
 * commit - see wool-week/years.ts and WOOL-WEEK.md.
 */

/*
 * The sizes: Hamefarin's finished measurements, the yoke a centimetre and a
 * half deeper and the body three and a half longer - a sampler of thirteen
 * hats is a long jumper, and it is what lets the smallest size carry every
 * year's motifs.
 */
const measured: (Omit<Size, "sections" | "checks" | "finished" | "stitchesPer10cm" | "roundsPer10cm" | "needlesMm" | "ribNeedlesMm"> & {
  finished: Measured;
})[] = [
  { id: "xs", label: "XS", toFitChestCm: 76, finished: { chestCm: 86, neckCm: 44, yokeDepthCm: 20.5, bodyLengthCm: 38.5, upperArmCm: 29, sleeveLengthCm: 43, cuffCm: 19 } },
  { id: "s", label: "S", toFitChestCm: 86, finished: { chestCm: 96, neckCm: 45, yokeDepthCm: 21.5, bodyLengthCm: 39.5, upperArmCm: 31, sleeveLengthCm: 44, cuffCm: 19.5 } },
  { id: "m", label: "M", toFitChestCm: 96, finished: { chestCm: 106, neckCm: 46, yokeDepthCm: 22.5, bodyLengthCm: 40.5, upperArmCm: 33, sleeveLengthCm: 45, cuffCm: 20 } },
  { id: "l", label: "L", toFitChestCm: 106, finished: { chestCm: 116, neckCm: 47, yokeDepthCm: 23.5, bodyLengthCm: 41.5, upperArmCm: 35.5, sleeveLengthCm: 46, cuffCm: 21 } },
  { id: "xl", label: "XL", toFitChestCm: 116, finished: { chestCm: 126, neckCm: 48, yokeDepthCm: 24.5, bodyLengthCm: 42.5, upperArmCm: 38, sleeveLengthCm: 47, cuffCm: 22 } },
  { id: "2xl", label: "2XL", toFitChestCm: 126, finished: { chestCm: 136, neckCm: 49, yokeDepthCm: 25.5, bodyLengthCm: 43.5, upperArmCm: 41, sleeveLengthCm: 47, cuffCm: 23 } },
  { id: "3xl", label: "3XL", toFitChestCm: 136, finished: { chestCm: 146, neckCm: 50, yokeDepthCm: 26.5, bodyLengthCm: 44.5, upperArmCm: 44, sleeveLengthCm: 48, cuffCm: 24 } },
  { id: "4xl", label: "4XL", toFitChestCm: 146, finished: { chestCm: 156, neckCm: 51, yokeDepthCm: 27.5, bodyLengthCm: 45.5, upperArmCm: 47, sleeveLengthCm: 48, cuffCm: 25 } },
];

/*
 * Each size is graded the first time anything asks for its knitting, and
 * kept: a page that never opens the sampler, or opens one size of it, does
 * not grade all eight.
 */
const grades = new Map<string, Graded>();
const gradeOf = (size: (typeof measured)[number]): Graded => {
  let found = grades.get(size.id);
  if (!found) grades.set(size.id, (found = grade(size.finished)));
  return found;
};

const sizes: Size[] = measured.map((size) => ({
  ...size,
  stitchesPer10cm: 32,
  roundsPer10cm: 38,
  needlesMm: 3,
  ribNeedlesMm: 2.5,
  get sections() {
    return gradeOf(size).sections;
  },
  get checks() {
    return gradeOf(size).checks;
  },
}));

const colourways: Colourway[] = ladder.colourways.map((colourway) => ({
  ...colourway,
  shades: colourway.shades.map((shade) => ({ ...shade, source: "library" as const })),
}));

const designers = [...new Set(years.map((year) => year.designer))];

const woolWeekSampler: SweaterPattern = {
  id: "wool-week-sampler",
  name: "Wool Week Sampler",
  designer: "Sweat Shop, after the Shetland Wool Week hats",
  story:
    "Thirteen years of Shetland Wool Week hats in one jumper, in the order " +
    "they came out. Hazel Tindall's Shwook Hat is round the neck, with the " +
    "Baa-ble Hat's sheep and the crofthooses round the yoke; the Bousta " +
    "Beanie, the Merrie Dancers, the Roadside Beanie's sheep and boat, " +
    "Katie's Kep and Da Crofter's Kep go down the body; Bonnie Isle, the " +
    "buggiflooers, the Islesburgh ram, Aal Ower and the Birsie Beanny go " +
    "down the sleeves. Every motif of every hat is in every size, each " +
    "turned so that it stands the right way up on a jumper knitted from the " +
    "neck down; the bigger sizes put back the extras - the peeries, the " +
    "stripes, and the hats' own crowns, worked on the yoke from their point " +
    "outwards. All thirteen hats' colours are put onto one ladder of ten " +
    "yarns, dark to light, so every hat keeps its contrasts in every colourway.",
  credit: `Charts from the Shetland Wool Week hats, 2014 to 2026, by ${designers.join("; ")}`,
  pieces: [
    { id: "yoke", label: "Yoke" },
    { id: "body", label: "Body" },
    { id: "sleeve-left", label: "Left sleeve" },
    { id: "sleeve-right", label: "Right sleeve" },
  ],
  slots: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"],
  slotRoles: {
    A: "darkest",
    B: "dark",
    C: "deep accent",
    D: "dark middle",
    E: "middle",
    F: "light middle",
    G: "soft accent",
    H: "bright light",
    I: "pale",
    J: "lightest",
  },
  /*
   * Other people's charts, knitted as they drew them: a sheep's back, a sail
   * and a flower's middle carry a yarn further than seven stitches - twelve
   * at most, which the hats' patterns ask knitters to catch - and one round
   * of the Shwook Hat is in three colours.
   */
  rules: { colours: 3, float: 12 },
  tensions: { rib: { stitch: 0.9 } },
  stitchNotes: {
    m1: {
      abbreviation: "M1L",
      lean: "left",
      how:
        "Pick up the bar between the stitches from front to back with the " +
        "left needle, and knit it through the back of the loop.",
    },
    pickUp: {
      how:
        "Insert the needle under both legs of the next stitch cast on at " +
        "the underarm, wrap the yarn and draw a loop through.",
    },
  },
  /*
   * Every chart of every size graded so far, once each: a crown slice is the
   * same chart in every size that cuts it the same. A size is graded before
   * its charts are looked for, as its sections are read first.
   */
  get charts(): Chart[] {
    return [...new Map([...grades.values()].flatMap((graded) => graded.charts).map((chart) => [chart.id, chart])).values()];
  },
  colourways,
  sizes,
};

export default woolWeekSampler;
