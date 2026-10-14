import type { Chart, RoundSpec, Section, Size, SweaterPattern } from "./types";
import { band, corrugatedRib, increaseEvenly, underarmDecrease } from "./writing";

/**
 * Hamefarin: a top-down, circular-yoke Fair Isle jumper.
 *
 * An original design, made for this site, in the vocabulary Shetland
 * knitters have worked in for a century: peerie patterns, borders and an
 * OXO, never more than two colours in a round, each band shaded from its
 * edges to its middle. The construction is the one modern top-down yokes
 * share - see DESIGN.md for the designs studied and what each contributed.
 *
 * Every band is the same upside down as the right way up. A top-down chart
 * is knitted from the neck, so whatever it draws comes out turned through
 * half a circle on the finished yoke; a motif that is its own reflection
 * looks the same either way, and nobody has to knit a chart upside down.
 *
 * Slots: A is the body and the darkest ground; B, C and D shade the grounds
 * from dark to light towards the middle of a band; E, F, G and H are the
 * pattern colours, shading the other way, so that every row keeps its
 * contrast.
 */

/* ------------------------------------------------------------- the charts */

const neckRib = corrugatedRib(
  "neck-rib",
  "Neck rib",
  [
    ["F", "A"], ["F", "A"], ["F", "A"],
    ["E", "A"], ["E", "A"], ["E", "A"], ["E", "A"], ["E", "A"], ["E", "A"],
    ["F", "A"], ["F", "A"], ["F", "A"],
  ],
  "rib",
);

/** The hem's and the cuffs' rib: the neck's, deeper. */
const edgeRib = corrugatedRib(
  "edge-rib",
  "Rib",
  [
    ["F", "A"], ["F", "A"], ["F", "A"],
    ...Array.from({ length: 14 }, (): ["E", "A"] => ["E", "A"]),
    ["F", "A"], ["F", "A"], ["F", "A"],
  ],
  "rib",
);

/** Small diamonds, each with a seed in it, point to point. */
const peerie = band("peerie", "Peerie", [
  ["...x..", "A", "E"],
  ["..x.x.", "A", "E"],
  [".x.x.x", "A", "F"],
  ["..x.x.", "A", "E"],
  ["...x..", "A", "E"],
]);

/** Lozenges and crosses, between two rows of seeds. */
const border = band("border", "Border", [
  ["x.x.x.x.x.x.", "A", "E"],
  ["x..x..x.....", "B", "F"],
  ["..x.x..x...x", "B", "F"],
  [".x...x..x.x.", "C", "H"],
  ["x..x..x..x..", "D", "G"],
  [".x...x..x.x.", "C", "H"],
  ["..x.x..x...x", "B", "F"],
  ["x..x..x.....", "B", "F"],
  ["x.x.x.x.x.x.", "A", "E"],
]);

/** The smallest peerie: a three-row diamond. Also the hem's and cuffs' echo. */
const seeds = band("seeds", "Peerie seeds", [
  [".x..", "A", "F"],
  ["x.x.", "A", "G"],
  [".x..", "A", "F"],
]);

/**
 * The OXO. Two diagonals cross at every X and run on, round each O, to the
 * next: the strong diagonals that are the whole point of an OXO. Each O
 * holds a smaller lozenge and a seed; each X has a lozenge round its
 * crossing and one in the space above and below it.
 */
const oxo = band("oxo", "OXO", [
  ["..xx.x.x.xx.......x.....", "A", "E"],
  [".x..x...x..x.....x.x....", "A", "E"],
  ["x.....x.....x...x.x.x...", "B", "F"],
  ["......x......x...x.x...x", "B", "F"],
  [".....x.x......x...x...x.", "C", "H"],
  ["....x...x......x.....x..", "C", "H"],
  ["...x..x..x......x.x.x...", "D", "G"],
  ["..x..x.x..x......x.x....", "D", "G"],
  [".x..x.x.x..x....x.x.x...", "D", "G"],
  ["..x..x.x..x......x.x....", "D", "G"],
  ["...x..x..x......x.x.x...", "D", "G"],
  ["....x...x......x.....x..", "C", "H"],
  [".....x.x......x...x...x.", "C", "H"],
  ["......x......x...x.x...x", "B", "F"],
  ["x.....x.....x...x.x.x...", "B", "F"],
  [".x..x...x..x.....x.x....", "A", "E"],
  ["..xx.x.x.xx.......x.....", "A", "E"],
]);

/** A chain of lozenges, each with a seed: the last band before the divide. */
const lozenges = band("lozenges", "Lozenges", [
  ["x.....x.....", "A", "E"],
  [".x...x.x...x", "B", "F"],
  ["..x.x...x.x.", "C", "H"],
  ["x..x..x..x..", "D", "G"],
  ["..x.x...x.x.", "C", "H"],
  [".x...x.x...x", "B", "F"],
  ["x.....x.....", "A", "E"],
]);

const charts: Chart[] = [neckRib, peerie, border, seeds, oxo, lozenges, edgeRib];

/* -------------------------------------------------------------- the script */

/**
 * One size's numbers, as scripts/grade.mjs worked them out: what the neck
 * casts on, what each increase round leaves, the plain rounds that make up
 * the yoke's depth, how it divides, and how the body and sleeves are shaped.
 */
interface Grade {
  neck: number;
  /** The short rows across the back of the neck: see RoundSpec's shortRows. */
  shortRows: { first: number; extend: number; pairs: number };
  /** The first increase round, straight after the rib. */
  first: number;
  /** After the increase round before each band, in order. */
  incs: [number, number, number, number, number];
  /** Plain rounds before each band's increase round. */
  plain: [number, number, number, number, number];
  /** Plain rounds after the last band, down to the divide. */
  pad: number;
  /** All of the back, half either side of the beginning of the round. */
  back: number;
  front: number;
  /** Each sleeve's held stitches. */
  sleeve: number;
  /** Cast on at each underarm. */
  underarm: number;
  /** Plain body rounds after the dividing round, before the echo. */
  bodyRounds: number;
  firstDecrease: number;
  /** "Decrease every n rounds, so many times", in order. */
  decreases: { every: number; times: number }[];
  sleeveTail: number;
}

const plain = (count: number, slot = "A"): RoundSpec[] =>
  count > 0 ? [{ type: "rounds", count, slot }] : [];

const increase = (from: number, to: number, check: string): RoundSpec => ({
  type: "shaping",
  slot: "A",
  ops: increaseEvenly(from, to),
  to,
  check,
});

const chart = (id: string, rows: number): RoundSpec => ({ type: "chart", chart: id, rows: [1, rows] });

/** The echo of the seeds above a hem or a cuff, with a plain round either side. */
const echo: RoundSpec[] = [...plain(1), chart("seeds", 3), ...plain(1)];

/** The rib, the bind-off in the rib's own tension, and the ribbing's needles. */
const edge = (): RoundSpec[] => [
  { type: "needles", to: "rib" },
  { type: "chart", chart: "edge-rib", rows: [1, 20] },
  { type: "bindOff", slot: "A", fabric: "rib" },
];

const sleeve = (piece: string, label: string, g: Grade): Section => {
  const top = g.sleeve + g.underarm;
  let count = top;
  const shaping: RoundSpec[] = [];
  for (const { every, times } of g.decreases) {
    for (let time = 0; time < times; time++) {
      count -= 2;
      shaping.push({ type: "shaping", slot: "A", ops: underarmDecrease, to: count });
      shaping.push(...plain(every - 1));
    }
  }
  return {
    label,
    piece,
    rounds: [
      {
        type: "piece",
        held: piece,
        before: g.underarm / 2,
        after: g.underarm / 2,
        slot: "A",
        check: `${piece}:top`,
      },
      ...plain(g.firstDecrease),
      ...shaping,
      ...plain(g.sleeveTail),
      ...echo.map((spec, index) => (index === 0 ? { ...spec, check: `${piece}:cuff` } : spec)),
      ...edge(),
    ],
  };
};

const sectionsFor = (g: Grade): Section[] => [
  {
    label: "Neck",
    piece: "yoke",
    rounds: [
      { type: "castOn", count: g.neck, slot: "A", fabric: "rib", check: "neck" },
      { type: "join" },
      { type: "chart", chart: "neck-rib", rows: [1, 12] },
    ],
  },
  {
    label: "Yoke",
    piece: "yoke",
    rounds: [
      { type: "needles", to: "main" },
      { type: "shortRows", ...g.shortRows, slot: "A" },
      increase(g.neck, g.first, "first"),
      ...plain(g.plain[0]),
      increase(g.first, g.incs[0], "peerie"),
      chart("peerie", 5),
      ...plain(g.plain[1]),
      increase(g.incs[0], g.incs[1], "border"),
      chart("border", 9),
      ...plain(g.plain[2]),
      increase(g.incs[1], g.incs[2], "seeds"),
      chart("seeds", 3),
      ...plain(g.plain[3]),
      increase(g.incs[2], g.incs[3], "oxo"),
      chart("oxo", 17),
      ...plain(g.plain[4]),
      increase(g.incs[3], g.incs[4], "lozenges"),
      chart("lozenges", 7),
      ...plain(g.pad),
    ],
  },
  {
    label: "Body",
    piece: "body",
    rounds: [
      /*
       * From the middle of the back, round the knitter's way, the first
       * sleeve reached is the wearer's right: knitted top down and turned
       * the right way up, the rounds run left to right as you look at them.
       */
      {
        type: "divide",
        slot: "A",
        segments: [
          { work: g.back / 2 },
          { hold: "sleeve-right", count: g.sleeve, castOn: g.underarm },
          { work: g.front },
          { hold: "sleeve-left", count: g.sleeve, castOn: g.underarm },
          { work: g.back / 2 },
        ],
        check: "body",
      },
      ...plain(g.bodyRounds),
      ...echo,
      ...edge(),
    ],
  },
  sleeve("sleeve-left", "Left sleeve", g),
  sleeve("sleeve-right", "Right sleeve", g),
];

/** The counts the pattern states, which the tests hold the knitting to. */
const checksFor = (g: Grade): Record<string, number> => {
  const top = g.sleeve + g.underarm;
  const cuff = top - 2 * g.decreases.reduce((total, { times }) => total + times, 0);
  return {
    neck: g.neck,
    first: g.first,
    peerie: g.incs[0],
    border: g.incs[1],
    seeds: g.incs[2],
    oxo: g.incs[3],
    lozenges: g.incs[4],
    body: g.back + g.front + 2 * g.underarm,
    "sleeve-left:top": top,
    "sleeve-left:cuff": cuff,
    "sleeve-right:top": top,
    "sleeve-right:cuff": cuff,
  };
};

type Graded = Omit<Size, "sections" | "checks" | "stitchesPer10cm" | "roundsPer10cm" | "needlesMm" | "ribNeedlesMm"> & {
  grade: Grade;
};

/*
 * The sizes, as graded by scripts/grade.mjs from standard body measurements
 * with about ten centimetres of ease at the chest. The finished measurements
 * are the ones each size was graded to; the tests check that the knitting
 * comes out at them.
 */
const graded: Graded[] = [
  {
    id: "xs", label: "XS", toFitChestCm: 76,
    finished: { chestCm: 86, neckCm: 44, yokeDepthCm: 19, bodyLengthCm: 35, upperArmCm: 29, sleeveLengthCm: 43, cuffCm: 19 },
    grade: {
      neck: 124, shortRows: { first: 20, extend: 6, pairs: 3 }, first: 164, incs: [222, 264, 296, 336, 360],
      plain: [1, 1, 0, 0, 0], pad: 0,
      back: 110, front: 110, sleeve: 70, underarm: 10,
      bodyRounds: 85,
      firstDecrease: 8, decreases: [{ every: 7, times: 11 }, { every: 6, times: 3 }], sleeveTail: 8,
    },
  },
  {
    id: "s", label: "S", toFitChestCm: 86,
    finished: { chestCm: 96, neckCm: 45, yokeDepthCm: 20, bodyLengthCm: 36, upperArmCm: 31, sleeveLengthCm: 44, cuffCm: 19.5 },
    grade: {
      neck: 124, shortRows: { first: 20, extend: 6, pairs: 3 }, first: 168, incs: [228, 276, 356, 384, 396],
      plain: [1, 1, 1, 1, 1], pad: 0,
      back: 124, front: 124, sleeve: 74, underarm: 10,
      bodyRounds: 88,
      firstDecrease: 8, decreases: [{ every: 7, times: 14 }], sleeveTail: 8,
    },
  },
  {
    id: "m", label: "M", toFitChestCm: 96,
    finished: { chestCm: 106, neckCm: 46, yokeDepthCm: 21, bodyLengthCm: 37, upperArmCm: 33, sleeveLengthCm: 45, cuffCm: 20 },
    grade: {
      neck: 128, shortRows: { first: 20, extend: 6, pairs: 3 }, first: 176, incs: [240, 300, 348, 408, 432],
      plain: [1, 2, 2, 2, 1], pad: 0,
      back: 136, front: 136, sleeve: 80, underarm: 12,
      bodyRounds: 91,
      firstDecrease: 8, decreases: [{ every: 6, times: 11 }, { every: 5, times: 7 }], sleeveTail: 8,
    },
  },
  {
    id: "l", label: "L", toFitChestCm: 106,
    finished: { chestCm: 116, neckCm: 47, yokeDepthCm: 22, bodyLengthCm: 38, upperArmCm: 35.5, sleeveLengthCm: 46, cuffCm: 21 },
    grade: {
      neck: 132, shortRows: { first: 21, extend: 7, pairs: 3 }, first: 184, incs: [258, 324, 424, 456, 480],
      plain: [1, 2, 2, 2, 2], pad: 2,
      back: 150, front: 150, sleeve: 90, underarm: 12,
      bodyRounds: 95,
      firstDecrease: 8, decreases: [{ every: 5, times: 20 }, { every: 4, times: 1 }], sleeveTail: 8,
    },
  },
  {
    id: "xl", label: "XL", toFitChestCm: 116,
    finished: { chestCm: 126, neckCm: 48, yokeDepthCm: 23, bodyLengthCm: 39, upperArmCm: 38, sleeveLengthCm: 47, cuffCm: 22 },
    grade: {
      neck: 136, shortRows: { first: 22, extend: 7, pairs: 3 }, first: 188, incs: [258, 324, 428, 480, 504],
      plain: [1, 2, 2, 2, 2], pad: 6,
      back: 162, front: 162, sleeve: 90, underarm: 14,
      bodyRounds: 98,
      firstDecrease: 8, decreases: [{ every: 5, times: 19 }, { every: 4, times: 3 }], sleeveTail: 8,
    },
  },
  {
    id: "2xl", label: "2XL", toFitChestCm: 126,
    finished: { chestCm: 136, neckCm: 49, yokeDepthCm: 24, bodyLengthCm: 40, upperArmCm: 41, sleeveLengthCm: 47, cuffCm: 23 },
    grade: {
      neck: 136, shortRows: { first: 22, extend: 7, pairs: 3 }, first: 192, incs: [270, 336, 444, 504, 540],
      plain: [1, 2, 2, 2, 2], pad: 9,
      back: 174, front: 174, sleeve: 96, underarm: 16,
      bodyRounds: 101,
      firstDecrease: 8, decreases: [{ every: 5, times: 11 }, { every: 4, times: 13 }], sleeveTail: 8,
    },
  },
  {
    id: "3xl", label: "3XL", toFitChestCm: 136,
    finished: { chestCm: 146, neckCm: 50, yokeDepthCm: 25, bodyLengthCm: 41, upperArmCm: 44, sleeveLengthCm: 48, cuffCm: 24 },
    grade: {
      neck: 140, shortRows: { first: 22, extend: 7, pairs: 3 }, first: 200, incs: [282, 360, 468, 528, 588],
      plain: [1, 2, 2, 2, 2], pad: 12,
      back: 188, front: 188, sleeve: 106, underarm: 16,
      bodyRounds: 104,
      firstDecrease: 8, decreases: [{ every: 5, times: 3 }, { every: 4, times: 24 }], sleeveTail: 8,
    },
  },
  {
    id: "4xl", label: "4XL", toFitChestCm: 146,
    finished: { chestCm: 156, neckCm: 51, yokeDepthCm: 26, bodyLengthCm: 42, upperArmCm: 47, sleeveLengthCm: 48, cuffCm: 25 },
    grade: {
      neck: 144, shortRows: { first: 23, extend: 7, pairs: 3 }, first: 204, incs: [288, 360, 480, 528, 624],
      plain: [1, 2, 2, 2, 2], pad: 15,
      back: 200, front: 200, sleeve: 112, underarm: 18,
      bodyRounds: 107,
      firstDecrease: 8, decreases: [{ every: 4, times: 24 }, { every: 3, times: 5 }], sleeveTail: 8,
    },
  },
];

const hamefarin: SweaterPattern = {
  id: "hamefarin",
  name: "Hamefarin",
  designer: "Sweat Shop",
  story:
    "A homecoming jumper: a ribbed neck, a peerie and a border, then the " +
    "OXO round the widest part of the yoke, where its diagonals have room to " +
    "run, and a chain of lozenges to finish before the sleeves are set " +
    "aside. Knitted from the neck down in one piece, so it can be tried on " +
    "as it grows, with the smallest peerie echoed above the hem and the " +
    "cuffs. Every band is the same either way up, so the charts are knitted " +
    "as drawn.",
  credit: "An original design for Sweat Shop",
  pieces: [
    { id: "yoke", label: "Yoke" },
    { id: "body", label: "Body" },
    { id: "sleeve-left", label: "Left sleeve" },
    { id: "sleeve-right", label: "Right sleeve" },
  ],
  slots: ["A", "B", "C", "D", "E", "F", "G", "H"],
  slotRoles: {
    A: "body and darkest ground",
    B: "dark ground",
    C: "middle ground",
    D: "light ground",
    E: "lightest pattern",
    F: "warm pattern",
    G: "accent",
    H: "light pattern",
  },
  /*
   * The ribbing is worked on needles half a millimetre finer and pulls in:
   * its stitches are narrower than the yoke's, as a rib's are.
   */
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
  charts,
  colourways: [
    {
      id: "simmer-dim",
      wool: "jamieson-s-of-shetland-spindrift",
      name: "Simmer Dim",
      brand: "Jamieson's of Shetland",
      yarn: "2ply Jumper Weight (Spindrift)",
      url: "https://www.jamiesonsofshetland.co.uk",
      ballMetres: 105,
      ballGrams: 25,
      shades: [
        { slot: "A", name: "Admiral Navy", code: "727", hex: "#2a2a3b", source: "library", wool: "jamieson-s-of-shetland-spindrift-727" },
        { slot: "B", name: "Nighthawk", code: "1020", hex: "#2e5560", source: "library", wool: "jamieson-s-of-shetland-spindrift-1020" },
        { slot: "C", name: "Mermaid", code: "688", hex: "#327c7f", source: "library", wool: "jamieson-s-of-shetland-spindrift-688" },
        { slot: "D", name: "Cloud", code: "764", hex: "#b6d2d5", source: "library", wool: "jamieson-s-of-shetland-spindrift-764" },
        { slot: "E", name: "Natural White", code: "104", hex: "#eae5c6", source: "library", wool: "jamieson-s-of-shetland-spindrift-104" },
        { slot: "F", name: "Gold", code: "289", hex: "#cfb151", source: "library", wool: "jamieson-s-of-shetland-spindrift-289" },
        { slot: "G", name: "Madder", code: "587", hex: "#891e25", source: "library", wool: "jamieson-s-of-shetland-spindrift-587" },
        { slot: "H", name: "Buttermilk", code: "179", hex: "#ead094", source: "library", wool: "jamieson-s-of-shetland-spindrift-179" },
      ],
    },
    {
      id: "hairst",
      wool: "jamieson-smith-2ply-jumper-weight",
      name: "Hairst",
      brand: "Jamieson & Smith",
      yarn: "2ply Jumper Weight",
      url: "https://www.shetlandwoolbrokers.co.uk",
      ballMetres: 115,
      ballGrams: 25,
      shades: [
        { slot: "A", name: "Brown", code: "80", hex: "#452c29", source: "library", wool: "jamieson-smith-2ply-jumper-weight-80" },
        { slot: "B", name: "Orange Rust Mix", code: "FC38", hex: "#94361b", source: "library", wool: "jamieson-smith-2ply-jumper-weight-fc38" },
        { slot: "C", name: "Tan", code: "FC45", hex: "#bd7c41", source: "library", wool: "jamieson-smith-2ply-jumper-weight-fc45" },
        { slot: "D", name: "Light Fawn", code: "202", hex: "#c9c0a4", source: "library", wool: "jamieson-smith-2ply-jumper-weight-202" },
        { slot: "E", name: "Natural White", code: "1A", hex: "#efe8c9", source: "library", wool: "jamieson-smith-2ply-jumper-weight-1a" },
        { slot: "F", name: "Mustard Yellow", code: "28", hex: "#e5ac35", source: "library", wool: "jamieson-smith-2ply-jumper-weight-28" },
        { slot: "G", name: "Dark Green", code: "82", hex: "#3a5d5a", source: "library", wool: "jamieson-smith-2ply-jumper-weight-82" },
        { slot: "H", name: "Grass Green", code: "FC12", hex: "#675b2d", source: "library", wool: "jamieson-smith-2ply-jumper-weight-fc12" },
      ],
    },
    {
      id: "moorit",
      wool: "uradale-yarns-2ply-jumper-weight",
      name: "Moorit",
      brand: "Uradale",
      yarn: "2ply Jumper Weight, organic",
      url: "https://www.uradale.com",
      ballMetres: 86,
      ballGrams: 25,
      shades: [
        { slot: "A", name: "Graeff (Shetland black)", hex: "#352c2c", source: "library", wool: "uradale-yarns-2ply-jumper-weight-graeff-shetland-black" },
        { slot: "B", name: "Moorit (Shetland brown)", hex: "#4a3930", source: "library", wool: "uradale-yarns-2ply-jumper-weight-moorit-shetland-brown" },
        { slot: "C", name: "Laebrak (dark grey)", hex: "#605753", source: "library", wool: "uradale-yarns-2ply-jumper-weight-laebrak-dark-grey" },
        { slot: "D", name: "Glansin (light grey)", hex: "#ebeae8", source: "library", wool: "uradale-yarns-2ply-jumper-weight-glansin-light-grey" },
        { slot: "E", name: "Flukkra (natural white)", hex: "#eef0e2", source: "library", wool: "uradale-yarns-2ply-jumper-weight-flukkra-natural-white" },
        { slot: "F", name: "Aess (dark fawn)", hex: "#cbb0af", source: "library", wool: "uradale-yarns-2ply-jumper-weight-aess-dark-fawn" },
        { slot: "G", name: "Shoormal (mid grey)", hex: "#676261", source: "library", wool: "uradale-yarns-2ply-jumper-weight-shoormal-mid-grey" },
        { slot: "H", name: "Aetmeal (light fawn)", hex: "#f6efe3", source: "library", wool: "uradale-yarns-2ply-jumper-weight-aetmeal-light-fawn" },
      ],
    },
  ],
  sizes: graded.map(({ grade, ...size }) => ({
    ...size,
    stitchesPer10cm: 28,
    roundsPer10cm: 32,
    needlesMm: 3.25,
    ribNeedlesMm: 2.75,
    sections: sectionsFor(grade),
    checks: checksFor(grade),
  })),
};

export default hamefarin;
