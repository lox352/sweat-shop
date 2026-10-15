import type { Chart, ChartCell, Colourway, RoundSpec, Section, ShapingOp, Size, SweaterPattern } from "./types";
import { underarmDecrease } from "./writing";

/**
 * Paul Klee Sweater, by Midori Hirose: a circular yoke of squares.
 *
 * Transcribed from the pattern as bought (version 1.0, last revised 5 June
 * 2022) for its owner's own knitting, every size of it, with the counts the
 * pattern states held against the knitting by the tests. The pattern is for
 * personal use, and so is this.
 *
 * The yoke is bands of blocks, four stitches by five rounds, each band in
 * two yarns of its own - its colour A and colour B - so a yoke of twelve
 * bands can knit in twenty-four colours as well as the main colour, or in a
 * handful. Some bands increase in their last round, inside the blocks: k1,
 * kfb, k2 in a block makes it five. The next band begins its blocks afresh
 * from the beginning of the round, so the squares of one band never stand
 * over the squares of the last, as in the paintings.
 *
 * Below the colourwork the yoke goes on in the main colour and turns into a
 * raglan: four lines of increases, a KBF before each marker and a KFB after
 * it. At the divide each sleeve's first stitch is wrapped before the sleeve
 * goes on hold, the underarm is cable cast on and closed up to the next
 * stitch with the last of it passed over, and the round moves from the
 * middle of the back to the middle of the right underarm.
 *
 * Slots: MC is the main colour - the neck, the raglan, the body and the
 * sleeves. "1A" and "1B" are the first band's colours A and B, "2A" and
 * "2B" the second's, and so on to the twelfth; the smaller sizes knit fewer
 * bands and leave the last colours unused.
 */

/* ------------------------------------------------------------- the bands */

/**
 * How a band's last round increases, block by block from the beginning of
 * the round, as the pattern writes it: "4" a plain block, "+" one worked k1,
 * kfb, k2. The blocks go colour A, colour B, A, B... round the round.
 */
const shapes = {
  /** No increase: "(with colour A k4, with colour B k4) repeat to end". */
  plain: "44",
  /** Kids 1 & 2's colour 1. */
  k1: "+4+4+4++4+4+4+",
  /** Kids 1 & 2's colour 2: every block. */
  k2: "++",
  /** Kids 1 & 2's colour 4, which places the markers the next increases work between. */
  k4: "++++4++++4",
  /** Kids 1 & 2's colour 6. */
  k6: "++4++4",
  /** Kids 3's colour 8. */
  k8: "++4+4+4++4+4+4",
  /** Size 2XS's colour 9. */
  x9: "+4+4+4+4",
  /** Sizes L-2XL's colour 1: two plain blocks either end, every other block between. */
  l1: `44${"+4".repeat(16)}44`,
  /** Sizes 3XL-6XL's colour 1. */
  x1: "+4++4+",
} as const;
type Shape = keyof typeof shapes;

/** A band's chart: four rounds of plain blocks, and a last round shaped or not. */
const bandChart = (band: number, shape: Shape): Chart => {
  const [a, b] = [`${band}A`, `${band}B`];
  const row = (blocks: string): ChartCell[] =>
    [...blocks].flatMap((block, index): ChartCell[] => {
      const slot = index % 2 === 0 ? a : b;
      return block === "+"
        ? [{ slot }, { slot, symbol: "kfb" }, { slot, symbol: "m1" }, { slot }, { slot }]
        : [{ slot }, { slot }, { slot }, { slot }];
    });
  return {
    id: `colour-${band}-${shape}`,
    name: `Colour ${band}`,
    fabric: "colour",
    rows: [row("44"), row("44"), row("44"), row("44"), row(shapes[shape])],
  };
};

/** The bands each group of sizes knits, by the shape of each band's last round. */
const bands: Record<"kids12" | "kids34" | "small" | "large" | "largest", Shape[]> = {
  kids12: ["k1", "k2", "plain", "k4", "plain", "k6", "plain"],
  kids34: ["k1", "k2", "plain", "k4", "plain", "k6", "plain", "k8"],
  small: ["k2", "plain", "k4", "plain", "k6", "plain", "k8", "plain", "x9"],
  large: ["l1", "k2", "plain", "k4", "plain", "k6", "plain", "k8", "plain", "x9", "plain"],
  largest: ["x1", "k1", "k2", "plain", "k4", "plain", "k6", "plain", "k8", "plain", "x9", "plain"],
};
type Group = keyof typeof bands;

const charts: Chart[] = Object.values(bands).flatMap((group) =>
  group.map((shape, index) => bandChart(index + 1, shape)),
).filter((chart, index, all) => all.findIndex((other) => other.id === chart.id) === index);

/* -------------------------------------------------------------- the script */

const k = (times: number): ShapingOp => ({ work: "k", times });
const p = (times: number): ShapingOp => ({ work: "p", times });
const kfb: ShapingOp = { work: "kfb" };
const pfb: ShapingOp = { work: "pfb" };
const kbf: ShapingOp = { work: "kbf" };
const times = (count: number, ...repeat: ShapingOp[]): ShapingOp => ({ repeat, times: count });

/**
 * One size's numbers, as the pattern states them: section 1's cast-on and
 * rib, section 2's set-up round and short rows, section 3's bands, section
 * 4's raglan, section 5's divide, and sections 6 and 7's body and sleeves.
 */
interface Grade {
  /** Stitches after the join: the pattern casts on one more and passes it over to join. */
  neck: number;
  /** Rounds of k1, p1 rib in all. */
  rib: number;
  setUp: ShapingOp[];
  shortRows: { pairs: number; extendLast?: number; wrong?: ShapingOp[]; right?: ShapingOp[] };
  group: Group;
  /** Plain rounds in the main colour between the colourwork and the raglan's set-up round. */
  plain: number;
  /** Stitches between the raglan's markers: half the back, a sleeve, the front. */
  raglan: [back: number, sleeve: number, front: number];
  /** Raglan increase rounds in all, a plain round between each two. */
  increases: number;
  /** Cast on at each underarm before the new end-of-round marker, and after it - one of which is passed over. */
  underarm: [before: number, after: number];
  /** Plain rounds of the body, from the new beginning of the round. */
  body: number;
  /** Rounds of k1, p1 rib at the hem, after its two knit rounds. */
  hem: number;
  /** Plain rounds before each of the sleeve's decrease rounds, how many of them, and plain rounds after. */
  sleeve: [plain: number, decreases: number, after: number];
  /** Rounds of k1, p1 rib at each cuff, after its two knit rounds. */
  cuff: number;
}

/* Section 2's set-up rounds, which differ by size. */
const setUpKids = [k(3), kfb, k(8), kfb, times(7, k(9), kfb), k(8), kfb, k(4)];
const setUpSmall = [k(2), kfb, k(5), kfb, times(11, k(7), kfb), k(5), kfb, k(3)];
const setUpM2 = [k(3), kfb, times(2, k(7), kfb), times(7, k(9), kfb), times(2, k(7), kfb), k(4)];
const setUpL = [times(2, k(6), kfb), times(10, k(8), kfb), times(2, k(6), kfb)];
const setUp2XL = [k(4), kfb, times(2, k(8), kfb), times(7, k(10), kfb), times(2, k(8), kfb), k(4)];
const setUp3XL = [k(4), kfb, k(8), kfb, times(9, k(10), kfb), k(8), kfb, k(4)];

/* Section 2's short rows: German short rows, reaching 5 past the middle of the back and 4 further each pair after. */
const shortRowsKids = {
  pairs: 5,
  wrong: [p(2), pfb, times(2, p(6), pfb), p(3)],
  right: [k(2), kfb, times(2, k(6), kfb), k(3)],
};
const shortRowsSmall = {
  pairs: 6,
  wrong: [p(5), pfb, times(3, p(4), pfb), p(3)],
  right: [k(5), kfb, times(3, k(4), kfb), k(3)],
};
const shortRowsM2 = {
  pairs: 6,
  wrong: [p(3), pfb, times(2, p(7), pfb), p(4)],
  right: [k(3), kfb, times(2, k(7), kfb), k(4)],
};
const shortRowsL = {
  pairs: 7,
  extendLast: 5,
  wrong: [times(5, pfb, p(4)), pfb, p(3)],
  right: [times(5, kfb, k(4)), kfb, k(3)],
};
const shortRows2XL = {
  pairs: 7,
  wrong: [times(5, p(4), pfb), p(3)],
  right: [times(5, k(4), kfb), k(3)],
};
const shortRows3XL = {
  pairs: 7,
  wrong: [p(2), pfb, times(2, p(9), pfb), p(5)],
  right: [k(2), kfb, times(2, k(9), kfb), k(5)],
};

const grades: Record<string, Grade> = {
  k1: { neck: 96, rib: 16, setUp: setUpKids, shortRows: shortRowsKids, group: "kids12", plain: 4, raglan: [33, 46, 66], increases: 3, underarm: [3, 4], body: 38, hem: 22, sleeve: [4, 7, 3], cuff: 26 },
  k2: { neck: 96, rib: 16, setUp: setUpKids, shortRows: shortRowsKids, group: "kids12", plain: 4, raglan: [34, 44, 68], increases: 5, underarm: [3, 4], body: 43, hem: 22, sleeve: [6, 7, 5], cuff: 29 },
  k3: { neck: 96, rib: 18, setUp: setUpKids, shortRows: shortRowsKids, group: "kids34", plain: 4, raglan: [39, 50, 78], increases: 3, underarm: [3, 4], body: 43, hem: 26, sleeve: [7, 8, 8], cuff: 33 },
  k4: { neck: 96, rib: 18, setUp: setUpKids, shortRows: shortRowsKids, group: "kids34", plain: 4, raglan: [39, 50, 78], increases: 5, underarm: [3, 4], body: 56, hem: 26, sleeve: [9, 8, 8], cuff: 37 },
  "2xs": { neck: 106, rib: 20, setUp: setUpSmall, shortRows: shortRowsSmall, group: "small", plain: 4, raglan: [41, 62, 82], increases: 5, underarm: [4, 5], body: 72, hem: 31, sleeve: [9, 12, 4], cuff: 41 },
  xs: { neck: 106, rib: 20, setUp: setUpSmall, shortRows: shortRowsSmall, group: "small", plain: 4, raglan: [42, 60, 84], increases: 7, underarm: [4, 5], body: 72, hem: 31, sleeve: [8, 13, 4], cuff: 41 },
  s: { neck: 106, rib: 20, setUp: setUpSmall, shortRows: shortRowsSmall, group: "small", plain: 4, raglan: [43, 58, 86], increases: 9, underarm: [4, 5], body: 68, hem: 31, sleeve: [7, 14, 4], cuff: 41 },
  m1: { neck: 106, rib: 20, setUp: setUpSmall, shortRows: shortRowsSmall, group: "small", plain: 4, raglan: [44, 56, 88], increases: 11, underarm: [4, 5], body: 64, hem: 31, sleeve: [6, 15, 7], cuff: 41 },
  m2: { neck: 110, rib: 20, setUp: setUpM2, shortRows: shortRowsM2, group: "small", plain: 4, raglan: [45, 54, 90], increases: 13, underarm: [4, 5], body: 64, hem: 31, sleeve: [6, 14, 10], cuff: 41 },
  l: { neck: 118, rib: 20, setUp: setUpL, shortRows: shortRowsL, group: "large", plain: 6, raglan: [54, 72, 108], increases: 7, underarm: [4, 5], body: 70, hem: 31, sleeve: [5, 16, 12], cuff: 41 },
  xl: { neck: 118, rib: 20, setUp: setUpL, shortRows: shortRowsL, group: "large", plain: 4, raglan: [55, 70, 110], increases: 8, underarm: [5, 6], body: 75, hem: 31, sleeve: [5, 16, 12], cuff: 41 },
  "2xl": { neck: 122, rib: 20, setUp: setUp2XL, shortRows: shortRows2XL, group: "large", plain: 4, raglan: [56, 68, 112], increases: 10, underarm: [6, 7], body: 75, hem: 31, sleeve: [5, 16, 12], cuff: 41 },
  "3xl": { neck: 126, rib: 20, setUp: setUp3XL, shortRows: shortRows3XL, group: "largest", plain: 11, raglan: [66, 84, 132], increases: 4, underarm: [6, 7], body: 75, hem: 31, sleeve: [5, 16, 12], cuff: 41 },
  "4xl": { neck: 126, rib: 20, setUp: setUp3XL, shortRows: shortRows3XL, group: "largest", plain: 4, raglan: [66, 84, 132], increases: 8, underarm: [7, 8], body: 75, hem: 31, sleeve: [4, 20, 8], cuff: 41 },
  "5xl": { neck: 130, rib: 20, setUp: [k(13), kfb, times(6, k(16), kfb), k(13), kfb], shortRows: shortRows3XL, group: "largest", plain: 4, raglan: [67, 82, 134], increases: 11, underarm: [9, 10], body: 75, hem: 31, sleeve: [4, 20, 8], cuff: 41 },
  "6xl": { neck: 136, rib: 20, setUp: [k(13), kfb, times(6, k(17), kfb), k(13), kfb], shortRows: { pairs: 8 }, group: "largest", plain: 4, raglan: [68, 80, 136], increases: 15, underarm: [10, 11], body: 75, hem: 31, sleeve: [4, 21, 3], cuff: 41 },
};

/**
 * A raglan increase round on the stitches between its markers: knit to one
 * before each marker, KBF, slip the marker, KFB - four times - and knit to
 * the end. Each half of the back grows by one and each sleeve and the front
 * by two.
 */
const raglanRound = ([back, sleeve, front]: [number, number, number]): ShapingOp[] => [
  k(back - 1), kbf, kfb,
  k(sleeve - 2), kbf, kfb,
  k(front - 2), kbf, kfb,
  k(sleeve - 2), kbf, kfb,
  k(back - 1),
];

/* The other counts the pattern states, size by size, in its order of sizes. */
const stated = {
  setUp: [106, 106, 106, 106, 120, 120, 120, 120, 122, 132, 132, 134, 138, 138, 138, 144],
  shortRows: [112, 112, 112, 112, 128, 128, 128, 128, 128, 144, 144, 144, 144, 144, 144, 144],
  raglan: [248, 264, 280, 296, 328, 344, 360, 376, 392, 416, 424, 440, 464, 496, 520, 552],
  body: [156, 168, 180, 188, 200, 212, 224, 236, 248, 260, 272, 288, 304, 324, 348, 372],
  top: [60, 62, 64, 68, 82, 84, 86, 88, 90, 96, 98, 102, 106, 116, 124, 132],
  cuff: [46, 48, 48, 52, 58, 58, 58, 58, 62, 64, 66, 70, 74, 76, 84, 90],
  /*
   * The yarn: metres of the main colour, and of each band's colours. The
   * pattern gives the main colour in balls of Spindrift too, a ball fewer
   * in some sizes than its metres come to; the metres are what is kept.
   */
  mainMetres: [350, 430, 500, 620, 870, 910, 930, 950, 1000, 1030, 1080, 1160, 1190, 1280, 1410, 1570],
  bandMetres: [25, 25, 25, 25, 25, 25, 25, 25, 25, 30, 30, 30, 34, 34, 34, 34],
};

/** The pattern's shopping list for a size: its main colour, and each colour of every band it knits. */
const yardageFor = (g: Grade, at: number): Record<string, number> => ({
  MC: stated.mainMetres[at],
  ...Object.fromEntries(
    bands[g.group].flatMap((_, index) => [
      [`${index + 1}A`, stated.bandMetres[at]],
      [`${index + 1}B`, stated.bandMetres[at]],
    ]),
  ),
});

const plain = (count: number, fabric?: string): RoundSpec[] =>
  count > 0 ? [{ type: "rounds", count, slot: "MC", ...(fabric ? { fabric } : {}) }] : [];
const rib = (count: number): RoundSpec => ({ type: "rounds", count, slot: "MC", sequence: ["k", "p"], fabric: "rib" });
const bindOff: RoundSpec = { type: "bindOff", slot: "MC", sequence: ["k", "p"], fabric: "rib" };

const sectionsFor = (g: Grade, at: number): Section[] => {
  const [back, sleeve, front] = g.raglan;
  const raglan: RoundSpec[] = [];
  for (let round = 0; round < g.increases; round++) {
    const at: [number, number, number] = [back + round, sleeve + 2 * round, front + 2 * round];
    if (round > 0) raglan.push(...plain(1));
    raglan.push({
      type: "shaping",
      slot: "MC",
      ops: raglanRound(at),
      to: 2 * at[0] + 2 * at[1] + at[2] + 8,
      ...(round === g.increases - 1 ? { check: "raglan" } : {}),
    });
  }
  const [before, after] = g.underarm;
  const held = sleeve + 2 * g.increases;
  const sleeveSection = (piece: string, label: string): Section => {
    const [each, decreases, tail] = g.sleeve;
    const shaping: RoundSpec[] = [];
    for (let time = 0; time < decreases; time++) {
      shaping.push(...plain(each));
      shaping.push({ type: "shaping", slot: "MC", ops: underarmDecrease, to: held + 2 * after - 2 * (time + 1) });
    }
    return {
      label,
      piece,
      rounds: [
        // Beginning at the middle of the underarm: pick up from half of it, knit the held stitches, pick up from the rest.
        { type: "piece", held: piece, before: after, after, slot: "MC", check: `${piece}:top` },
        ...shaping,
        ...plain(tail),
        { type: "needles", to: "rib" },
        { ...plain(2, "rib")[0], check: `${piece}:cuff` },
        rib(g.cuff),
        bindOff,
      ],
    };
  };
  return [
    {
      label: "Neck",
      piece: "yoke",
      rounds: [
        { type: "castOn", count: g.neck, slot: "MC", fabric: "rib", check: "neck" },
        { type: "join" },
        rib(g.rib),
      ],
    },
    {
      label: "Back neck",
      piece: "yoke",
      rounds: [
        { type: "needles", to: "main" },
        { type: "shaping", slot: "MC", ops: g.setUp, to: stated.setUp[at], check: "setUp" },
        {
          type: "shortRows",
          first: 5,
          extend: 4,
          pairs: g.shortRows.pairs,
          slot: "MC",
          ...(g.shortRows.extendLast ? { extendLast: g.shortRows.extendLast } : {}),
          ...(g.shortRows.wrong ? { shaping: { wrong: g.shortRows.wrong, right: g.shortRows.right } } : {}),
          check: "shortRows",
        },
      ],
    },
    {
      label: "Colourwork",
      piece: "yoke",
      rounds: [
        { type: "needles", to: "colour" },
        ...bands[g.group].map((shape, index): RoundSpec => ({
          type: "chart",
          chart: `colour-${index + 1}-${shape}`,
          rows: [1, 5],
          check: `colour-${index + 1}`,
        })),
      ],
    },
    {
      label: "Raglan",
      piece: "yoke",
      rounds: [
        { type: "needles", to: "main" },
        ...plain(g.plain),
        // The set-up round places the raglan's markers: a plain round as knitted.
        ...plain(1),
        ...raglan,
      ],
    },
    {
      label: "Body",
      piece: "body",
      rounds: [
        {
          type: "divide",
          slot: "MC",
          segments: [
            { work: back + g.increases },
            { hold: "sleeve-right", count: held, castOn: before + after - 1, wrap: true, close: "slipPassOver", newRound: before },
            { work: front + 2 * g.increases },
            { hold: "sleeve-left", count: held, castOn: before + after - 1, wrap: true, close: "slipPassOver" },
            { work: back + g.increases },
          ],
          check: "body",
        },
        ...plain(g.body),
        { type: "needles", to: "rib" },
        ...plain(2, "rib"),
        rib(g.hem),
        bindOff,
      ],
    },
    sleeveSection("sleeve-right", "Right sleeve"),
    sleeveSection("sleeve-left", "Left sleeve"),
  ];
};

/* -------------------------------------------------------------- the sizes */

/*
 * The finished measurements, from the pattern's table: a round the neck, b
 * the bust, c the upper arm, d the yoke's depth, e the body from the
 * underarm, g the sleeve from the underarm, k the cuff. The pattern sizes
 * by fit with 16-25cm of ease at the bust, and the children's by age: each
 * size is made to fit a bust 20cm smaller than its own, near the middle of
 * that ease.
 */
interface Listed {
  id: string;
  label: string;
  fits?: string;
  finished: Size["finished"];
  /** The counts the pattern states for the bands that increase, by band. */
  colours: Record<number, number>;
}

const measured = (neckCm: number, chestCm: number, upperArmCm: number, yokeDepthCm: number, bodyLengthCm: number, sleeveLengthCm: number, cuffCm: number): Size["finished"] => ({
  neckCm,
  chestCm,
  upperArmCm,
  yokeDepthCm,
  bodyLengthCm,
  sleeveLengthCm,
  cuffCm,
});

/* What each group's bands leave, as the pattern states it under each band that increases. */
const kids12Colours = { 1: 128, 2: 160, 4: 192, 6: 224 };
const kids34Colours = { ...kids12Colours, 8: 256 };
const smallColours = { 1: 160, 3: 192, 5: 224, 7: 256, 9: 288 };
const largeColours = { 1: 160, 2: 200, 4: 240, 6: 280, 8: 320, 10: 360 };
const largestColours = { 1: 168, 2: 192, 3: 240, 5: 288, 7: 336, 9: 384, 11: 432 };

const listed: Listed[] = [
  { id: "k1", label: "Kids 1", fits: "2–3 years", finished: measured(36, 71, 27.5, 19, 17.5, 18.5, 16), colours: kids12Colours },
  { id: "k2", label: "Kids 2", fits: "3–5 years", finished: measured(36, 76.5, 28, 20.5, 19, 24, 16.5), colours: kids12Colours },
  { id: "k3", label: "Kids 3", fits: "5–7 years", finished: measured(36, 82, 29, 21, 20, 30, 16.5), colours: kids34Colours },
  { id: "k4", label: "Kids 4", fits: "7–9 years", finished: measured(36, 85.5, 31, 22, 24, 36, 18), colours: kids34Colours },
  { id: "2xs", label: "2XS", finished: measured(40, 91, 37.5, 24.5, 29.5, 47.5, 20), colours: smallColours },
  { id: "xs", label: "XS", finished: measured(40, 96.5, 38, 26, 29.5, 46.5, 20), colours: smallColours },
  { id: "s", label: "S", finished: measured(40, 102, 39, 27, 28.5, 45, 20), colours: smallColours },
  { id: "m1", label: "M1", finished: measured(40, 107.5, 40, 28, 27.5, 44, 20), colours: smallColours },
  { id: "m2", label: "M2", finished: measured(41.5, 112.5, 41, 29.5, 27.5, 43, 21.5), colours: smallColours },
  { id: "l", label: "L", finished: measured(44.5, 118, 43.5, 30.5, 29, 43, 22), colours: largeColours },
  { id: "xl", label: "XL", finished: measured(44.5, 123.5, 44.5, 30.5, 30.5, 43, 23), colours: largeColours },
  { id: "2xl", label: "2XL", finished: measured(46, 131, 46.5, 32, 30.5, 43, 24), colours: largeColours },
  { id: "3xl", label: "3XL", finished: measured(47.5, 138, 48, 32, 30.5, 43, 25.5), colours: largestColours },
  { id: "4xl", label: "4XL", finished: measured(47.5, 147.5, 52.5, 32.5, 30.5, 43, 26), colours: largestColours },
  { id: "5xl", label: "5XL", finished: measured(49, 158, 56.5, 34.5, 30.5, 43, 29), colours: largestColours },
  { id: "6xl", label: "6XL", finished: measured(51.5, 169, 60, 37, 30.5, 43, 31), colours: largestColours },
];

const checksFor = (size: Listed, at: number): Record<string, number> => {
  const g = grades[size.id];
  const bandCounts: Record<string, number> = {};
  let count = stated.shortRows[at];
  bands[g.group].forEach((_, index) => {
    count = size.colours[index + 1] ?? count;
    bandCounts[`colour-${index + 1}`] = count;
  });
  return {
    neck: g.neck,
    setUp: stated.setUp[at],
    shortRows: stated.shortRows[at],
    ...bandCounts,
    raglan: stated.raglan[at],
    body: stated.body[at],
    "sleeve-left:top": stated.top[at],
    "sleeve-left:cuff": stated.cuff[at],
    "sleeve-right:top": stated.top[at],
    "sleeve-right:cuff": stated.cuff[at],
  };
};

/* -------------------------------------------------------------- the colours */

const spindrift = (slot: string, name: string, code: string, hex: string): Colourway["shades"][number] => ({
  slot,
  name,
  code,
  hex,
  source: "library",
  wool: `jamieson-s-of-shetland-spindrift-${code}`,
});

const colourway = (id: string, name: string, shades: Colourway["shades"]): Colourway => ({
  id,
  wool: "jamieson-s-of-shetland-spindrift",
  name,
  brand: "Jamieson's of Shetland",
  yarn: "Spindrift",
  url: "https://www.jamiesonsofshetland.co.uk",
  ballMetres: 105,
  ballGrams: 25,
  shades,
});

const slots = ["MC", ...Array.from({ length: 12 }, (_, index) => [`${index + 1}A`, `${index + 1}B`]).flat()];

const paulKlee: SweaterPattern = {
  id: "paul-klee",
  name: "Paul Klee Sweater",
  designer: "Midori Hirose",
  story:
    "A circular yoke of squares, after Paul Klee's paintings: band upon band " +
    "of blocks four stitches wide and five rounds deep, each band in two " +
    "colours of its own and set off from the band below, so the squares " +
    "never line up. Knitted from the neck down, with short rows across the " +
    "back of the neck, a looser gauge for the colourwork than Fair Isle " +
    "usually has, and a raglan below the yoke before the sleeves are set aside.",
  credit: "© Midori Hirose 2022. Transcribed from the pattern for its owner's own knitting; not to be shared.",
  pieces: [
    { id: "yoke", label: "Yoke" },
    { id: "body", label: "Body" },
    { id: "sleeve-right", label: "Right sleeve" },
    { id: "sleeve-left", label: "Left sleeve" },
  ],
  slots,
  slotRoles: Object.fromEntries([
    ["MC", "main colour"],
    ...Array.from({ length: 12 }, (_, index) => [
      [`${index + 1}A`, `colour ${index + 1}, A`],
      [`${index + 1}B`, `colour ${index + 1}, B`],
    ]).flat(),
  ]),
  /*
   * The pattern's gauge is 22 stitches and 34 rounds to 10cm in stocking
   * stitch, and 22 by 27 in the colourwork: the same width, and rounds a
   * quarter taller. Its k1, p1 rib on the finer needles pulls in to about
   * 28 stitches to 10cm, by the neck and cuff measurements it gives.
   */
  tensions: { rib: { stitch: 0.8 }, colour: { round: 34 / 27 } },
  stitchNotes: {
    castOn: {
      label: "Cable cast-on",
      how:
        "The neck is cable cast on with the rib's needles: firm, with an edge " +
        "that matches the rib above it. The pattern casts on one more than the " +
        "round keeps, and the join passes it over.",
      steps: [
        "Make a slip knot on the left needle. Knit into it, draw the loop through and put it on the left needle beside it: two stitches.",
        "Put the right needle between the first two stitches on the left needle, from front to back.",
        "Wrap the yarn, draw a loop through between them and put it on the left needle: one more stitch.",
        "Go on between the last two stitches each time until all are on.",
        "Check that the cast-on goes over your head. If it is too tight, try a double start cast-on instead, as the pattern suggests.",
      ],
      alternative:
        "A double start cast-on, which the pattern recommends where the cable " +
        "cast-on comes out too tight for the neck.",
    },
    castOnUnderarm: {
      label: "Cable cast-on, at the underarm",
      how:
        "With the sleeve's stitches on hold, turn the work and cable cast on " +
        "the underarm, with the new end-of-round marker half way along the " +
        "stitches that will stay cast on at the right underarm; then turn back. " +
        "One more is cast on than stays: the stitch after them closes it up.",
      steps: [
        "Turn the work, so the wrong side faces you.",
        "Cable cast on: put the right needle between the first two stitches on the left needle, draw a loop through and put it on the left needle. Repeat for each stitch.",
        "At the right underarm, place the marker for the new end of the round half way, as the chart's round begins there.",
        "Turn the work back, right side facing: the next stitch slips, and the last stitch cast on is passed over it.",
      ],
    },
    join: {
      how:
        "Slip the first stitch cast on from the left needle to the right, and " +
        "pass the last stitch cast on over it and off, pulling it snug: the " +
        "round is joined, one stitch fewer than was cast on.",
    },
    kbf: {
      how:
        "Slip a stitch knitwise and back to the left needle purlwise, knit it, " +
        "then put the left needle into the right leg of the stitch below it, " +
        "from back to front, and knit that through the back loop. One stitch " +
        "becomes two, the new one to its right - a KFB's mirror - before each " +
        "raglan marker.",
    },
    bindOff: {
      how:
        "Bind off loosely in pattern: knit the knit stitches and purl the purl " +
        "stitches as you go, lifting the stitch before over each.",
      alternative: "Lori's Twisty Bind Off, which the pattern suggests for a more elastic edge.",
    },
    bindOffPurl: {
      how: "Purl the stitch, then lift the stitch before it over it and off the needle: the rib's purls bound off as purls.",
    },
  },
  charts,
  colourways: [
    colourway("klee", "Klee", [
      spindrift("MC", "Rosewood", "236", "#3f3c3c"),
      spindrift("1A", "Ivy", "815", "#56643e"), spindrift("1B", "Mermaid", "688", "#327c7f"),
      spindrift("2A", "Peacock", "258", "#3e687c"), spindrift("2B", "Yell Sound Blue", "240", "#6b8588"),
      spindrift("3A", "China Blue", "655", "#aac6dc"), spindrift("3B", "Caspian", "760", "#66aeb4"),
      spindrift("4A", "White", "304", "#f1f1e7"), spindrift("4B", "Mint", "770", "#75b398"),
      spindrift("5A", "Lemon", "350", "#f0e693"), spindrift("5B", "Natural White", "104", "#eae5c6"),
      spindrift("6A", "Bramble", "155", "#71464f"), spindrift("6B", "Fjord", "170", "#767b94"),
      spindrift("7A", "Oxford", "123", "#4b4a47"), spindrift("7B", "Pacific", "763", "#576375"),
      spindrift("8A", "Buttercup", "182", "#f4b85a"), spindrift("8B", "Sandalwood", "861", "#da7153"),
      spindrift("9A", "Cocoa", "870", "#a94a35"), spindrift("9B", "Buttermilk", "179", "#ead094"),
      spindrift("10A", "Daffodil", "390", "#e5c84a"), spindrift("10B", "Anemone", "616", "#9878ad"),
      spindrift("11A", "Ivory", "343", "#e3d9be"), spindrift("11B", "Petrol", "750", "#2f6095"),
      spindrift("12A", "Nutmeg", "1200", "#d4724f"), spindrift("12B", "Redcurrant", "572", "#8e2f3c"),
    ]),
    colourway("grey-and-blue", "Grey and Blue", [
      spindrift("MC", "Rosewood", "236", "#3f3c3c"),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].flatMap((band) => {
        const cycle: [string, string, string][][] = [
          [["White", "304", "#f1f1e7"], ["Storm", "243", "#777d79"]],
          [["Eggshell", "768", "#c8d0c3"], ["Black Ice", "1341", "#5b5d62"]],
          [["Mist", "180", "#b1abaf"], ["Bluebell", "665", "#6385c5"]],
          [["Storm", "243", "#777d79"], ["White", "304", "#f1f1e7"]],
          [["Black Ice", "1341", "#5b5d62"], ["Eggshell", "768", "#c8d0c3"]],
          [["Bluebell", "665", "#6385c5"], ["Mist", "180", "#b1abaf"]],
        ];
        const [a, b] = cycle[(band - 1) % cycle.length];
        return [spindrift(`${band}A`, ...a), spindrift(`${band}B`, ...b)];
      }),
    ]),
    colourway("green-and-grey", "Green and Grey", [
      spindrift("MC", "Eggshell", "768", "#c8d0c3"),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].flatMap((band) => {
        const cycle: [string, string, string][][] = [
          [["Willow", "769", "#a6b699"], ["White", "304", "#f1f1e7"]],
          [["Orchid", "547", "#d1c0c0"], ["Mist", "180", "#b1abaf"]],
          [["White", "304", "#f1f1e7"], ["Willow", "769", "#a6b699"]],
          [["Mist", "180", "#b1abaf"], ["Orchid", "547", "#d1c0c0"]],
        ];
        const [a, b] = cycle[(band - 1) % cycle.length];
        return [spindrift(`${band}A`, ...a), spindrift(`${band}B`, ...b)];
      }),
    ]),
  ],
  sizes: listed.map((size, at) => ({
    id: size.id,
    label: size.label,
    ...(size.fits ? { fits: size.fits } : {}),
    toFitChestCm: Math.round(size.finished.chestCm - 20),
    finished: size.finished,
    stitchesPer10cm: 22,
    roundsPer10cm: 34,
    needlesMm: 3,
    ribNeedlesMm: 2.75,
    colourNeedlesMm: 3.75,
    yardage: yardageFor(grades[size.id], at),
    sections: sectionsFor(grades[size.id], at),
    checks: checksFor(size, at),
  })),
};

export default paulKlee;
