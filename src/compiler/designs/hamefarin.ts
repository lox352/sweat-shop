import type { Chart, Fitted, Fitting, Measurements, RoundSpec, Section, SweaterPattern } from "./types";
import { type Grade, type GradedOn, bandRounds, grade, gradeOn, measured, neckRibRounds, shortRowsFor, standard, widths } from "./hamefarin-grade";
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

/** What the divide leaves and the body and sleeves are knitted to: a size's grade, or one graded on from a yoke part knitted. */
type Below = Pick<Grade, "back" | "front" | "sleeve" | "underarm" | "bodyRounds" | "firstDecrease" | "decreases" | "sleeveTail">;

const sleeve = (piece: string, label: string, g: Below): Section => {
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
  ...belowFor(g),
];

/** The divide, the body and both sleeves. */
const belowFor = (g: Below): Section[] => [
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

/* ------------------------------------------------------- fitted part way */

/** The five bands of the yoke, by their charts, in the order they are knitted. */
const bandIds = ["peerie", "border", "seeds", "oxo", "lozenges"];
/** Which band a round is the last of, by what the knitting calls it: none for any other round. */
const bandEnding = (label: string): number =>
  bandIds.findIndex((id, at) => label === `${charts.find((one) => one.id === id)!.name}, row ${bandRounds[at]}`);

/** A yoke graded on, written: the bands still to come and the plain rounds to the divide, then the body and sleeves, with what the knitter should know of it. */
const written = (on: GradedOn, count: number, finished: Measurements, before: Section[] = []): Fitted => {
  let at = on.first ?? count;
  const yoke: RoundSpec[] = [
    // From the neck: the first increase round, straight after the rib, and a plain round.
    ...(on.first === undefined ? [] : [increase(count, on.first, "first"), ...plain(1)]),
    ...on.bands.flatMap(({ band, plain: rounds, to }) => {
      // An increase round with nothing to add is a plain round, which a band still begins after.
      const first: RoundSpec = to > at ? increase(at, to, bandIds[band]) : { type: "rounds", count: 1, slot: "A", check: bandIds[band] };
      at = to;
      return [...plain(rounds), first, chart(bandIds[band], bandRounds[band])];
    }),
    ...plain(on.pad),
  ];
  const top = on.below.sleeve + on.below.underarm;
  const cuff = top - 2 * on.below.decreases.reduce((total, { times }) => total + times, 0);
  const named = (bands: number[]) => bands.map((band) => charts.find((one) => one.id === bandIds[band])!.name).join(", ");
  const notes = [
    on.bands.length > 0
      ? `The yoke has ${named(on.bands.map(({ band }) => band))} ${before.length > 0 ? "" : "still to come, "}and grows from ${count} stitches to ${on.yoke}.`
      : "The yoke is as deep as it is to be at this tension: it divides for the body and sleeves once its plain rounds are done.",
    ...(on.dropped.length > 0 ? [`Left out, for want of depth at this tension: ${named(on.dropped)}.`] : []),
    ...(on.deeper > 0 ? [`The yoke comes ${on.deeper} round${on.deeper === 1 ? "" : "s"} deeper than the size's, which the body is shorter by.`] : []),
    ...(Math.abs(on.over) > 0.02 * (on.yoke - on.over)
      ? [
          `The yoke divides on ${on.yoke} stitches, ${Math.abs(on.over)} ${on.over > 0 ? "more" : "fewer"} than this tension wants for the size. ` +
            `They are shared between the body and the sleeves: the chest comes to ${on.finished.chestCm}cm for ${finished.chestCm}cm, the upper arm to ${on.finished.upperArmCm}cm for ${finished.upperArmCm}cm.`,
        ]
      : []),
  ];
  // The yoke carries on in the section it was in: before it, where there is one, the neck.
  const [neck, ...rest] = before;
  const yokeSections: Section[] = neck
    ? [neck, ...rest, { label: "Yoke", piece: "yoke", rounds: yoke }]
    : yoke.length > 0
      ? [{ label: "Yoke", piece: "yoke", rounds: yoke }]
      : [];
  return {
    sections: [...yokeSections, ...belowFor(on.below)],
    charts,
    checks: {
      ...(on.first === undefined ? {} : { first: on.first }),
      ...Object.fromEntries(on.bands.map(({ band, to }) => [bandIds[band], to])),
      body: on.below.back + on.below.front + 2 * on.below.underarm,
      "sleeve-left:top": top,
      "sleeve-left:cuff": cuff,
      "sleeve-right:top": top,
      "sleeve-right:cuff": cuff,
    },
    finished: on.finished,
    notes,
  };
};

/**
 * Hamefarin for a knitter's tension. From part of its yoke knitted, after the
 * last round of a band: the bands still to come graded on from the stitches
 * on the needles (see hamefarin-grade's gradeOn), then the body and sleeves.
 * And from nothing: the neck cast on for the tension, and every band graded
 * on from there in the same way, so that one the yoke has no depth for at a
 * loose tension is left out rather than the pattern refused.
 */
const fitting: Fitting = {
  whole: true,
  cutAfter: (knitted, from) => {
    for (let round = Math.max(1, from); round <= knitted.rounds.length; round++) {
      if (knitted.roundPieces[round - 1] !== "yoke") return undefined;
      if (knitted.roundKinds[round - 1] === "round" && bandEnding(knitted.roundLabels[round - 1]) >= 0) return round;
    }
    return undefined;
  },
  plan: ({ finished, tension, from }) => {
    const gauge = { stitches: tension.stitchesPer10cm / 10, rounds: tension.roundsPer10cm / 10 };
    if (!from) {
      const { neck } = widths(finished, gauge, "fitted");
      // The cast-on and the rib are rounds worked before any band; the short rows are not rounds.
      const on = gradeOn(finished, gauge, { neck, count: neck, worked: 1 + neckRibRounds, done: 0 });
      const fitted = written(on, neck, finished, [
        { label: "Neck", piece: "yoke", rounds: [{ type: "castOn", count: neck, slot: "A", fabric: "rib", check: "neck" }, { type: "join" }, { type: "chart", chart: "neck-rib", rows: [1, neckRibRounds] }] },
        { label: "Yoke", piece: "yoke", rounds: [{ type: "needles", to: "main" }, { type: "shortRows", ...shortRowsFor(neck), slot: "A" }] },
      ]);
      return { ...fitted, checks: { neck, ...fitted.checks } };
    }
    const { knitted, round } = from;
    const done = bandEnding(knitted.roundLabels[round - 1] ?? "") + 1;
    if (done === 0 || knitted.roundPieces[round - 1] !== "yoke") throw new Error(`the rest can't be planned from round ${round}: it is not the last round of a band of the yoke`);
    const count = knitted.rounds[round - 1].length;
    const worked = knitted.roundKinds.slice(0, round).filter((kind) => kind === "round").length;
    return written(gradeOn(finished, gauge, { neck: knitted.rounds[0].length, count, worked, done }), count, finished);
  },
};

/*
 * The sizes: standard body measurements with about ten centimetres of ease
 * at the chest, graded at the pattern's tension (see hamefarin-grade). The
 * finished measurements are the ones each size is graded to; the tests check
 * that the knitting comes out at them.
 */
const graded = measured.map((size) => grade(size));

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
  fitting,
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
    stitchesPer10cm: standard.stitches * 10,
    roundsPer10cm: standard.rounds * 10,
    needlesMm: 3.25,
    ribNeedlesMm: 2.75,
    sections: sectionsFor(grade),
    checks: checksFor(grade),
  })),
};

export default hamefarin;
