import type { Chart, ChartCell, Section, SweaterPattern } from "../data/sweaters/types";

/**
 * A sweater small enough to count by hand, for the tests.
 *
 * Every part of the construction is in it - a ribbed neck, an increase, a
 * colourwork band, the divide, the body, two sleeves picked up from their
 * underarms, decreases and a bind-off - at a size where a test can say what
 * every stitch should be.
 *
 *   neck     cast on 24, join, 2 rounds of k2 p2 rib
 *   yoke     [k1, m1] around -> 48; 2 rounds of a 4-stitch band
 *   divide   k8, hold 8 (right sleeve), cast on 4, k16, hold 8 (left), cast on 4, k8
 *            -> body of 40. From the middle of the back the first sleeve
 *            reached is the wearer's right: see physics/pose.
 *   body     3 rounds, bind off
 *   sleeves  pick up 2, knit 8, pick up 2 -> 12; 1 round; k1, k2tog, k to
 *            last 3, ssk, k1 -> 10; bind off
 */

const rib: Chart = {
  id: "rib",
  name: "Rib",
  rows: [
    [{ slot: "B" }, { slot: "B" }, { slot: "A", symbol: "purl" }, { slot: "A", symbol: "purl" }],
  ],
};

const band: Chart = {
  id: "band",
  name: "Band",
  rows: [
    [{ slot: "A" }, { slot: "B" }, { slot: "A" }, { slot: "A" }],
    [{ slot: "B" }, { slot: "A" }, { slot: "B" }, { slot: "B" }],
  ],
};

const sleeve = (piece: string, label: string): Section => ({
  label,
  piece,
  rounds: [
    { type: "piece", held: piece, before: 2, after: 2, slot: "A", check: `${piece}:top` },
    { type: "rounds", count: 1, slot: "A" },
    {
      type: "shaping",
      slot: "A",
      to: 10,
      ops: [
        { work: "k", times: 1 },
        { work: "k2tog" },
        { repeat: [{ work: "k", times: 1 }], untilRemaining: 3 },
        { work: "ssk" },
        { work: "k", times: 1 },
      ],
    },
    { type: "bindOff", slot: "A", check: `${piece}:cuff` },
  ],
});

export const testSweater: SweaterPattern = {
  id: "test-sweater",
  name: "Test sweater",
  designer: "The tests",
  story: "",
  credit: "",
  pieces: [
    { id: "yoke", label: "Yoke" },
    { id: "body", label: "Body" },
    { id: "sleeve-left", label: "Left sleeve" },
    { id: "sleeve-right", label: "Right sleeve" },
  ],
  slots: ["A", "B"],
  tensions: { rib: { stitch: 0.9 } },
  charts: [rib, band],
  colourways: [
    {
      id: "plain",
      name: "Plain",
      brand: "Test",
      yarn: "Test",
      url: "https://example.org",
      shades: [
        { slot: "A", name: "Dark", hex: "#333333", source: "approximate" },
        { slot: "B", name: "Light", hex: "#eeeeee", source: "approximate" },
      ],
    },
  ],
  sizes: [
    {
      id: "one",
      label: "One",
      toFitChestCm: 10,
      finished: {
        chestCm: 14,
        neckCm: 9,
        yokeDepthCm: 2,
        bodyLengthCm: 1,
        upperArmCm: 4,
        sleeveLengthCm: 1,
        cuffCm: 4,
      },
      stitchesPer10cm: 28,
      roundsPer10cm: 32,
      needlesMm: 3.25,
      ribNeedlesMm: 2.75,
      checks: {
        neck: 24,
        yoke: 48,
        body: 40,
        "sleeve-left:top": 12,
        "sleeve-left:cuff": 10,
        "sleeve-right:top": 12,
        "sleeve-right:cuff": 10,
      },
      sections: [
        {
          label: "Neck",
          piece: "yoke",
          rounds: [
            { type: "castOn", count: 24, slot: "A", fabric: "rib", check: "neck" },
            { type: "join" },
            { type: "chart", chart: "rib", rows: [1, 1], passes: 2, fabric: "rib" },
          ],
        },
        {
          label: "Yoke",
          piece: "yoke",
          rounds: [
            { type: "needles", to: "main" },
            {
              type: "shaping",
              slot: "A",
              to: 48,
              ops: [{ repeat: [{ work: "k", times: 1 }, { work: "m1" }], untilRemaining: 0 }],
              check: "yoke",
            },
            { type: "chart", chart: "band", rows: [1, 2] },
          ],
        },
        {
          label: "Body",
          piece: "body",
          rounds: [
            {
              type: "divide",
              slot: "A",
              segments: [
                { work: 8 },
                { hold: "sleeve-right", count: 8, castOn: 4 },
                { work: 16 },
                { hold: "sleeve-left", count: 8, castOn: 4 },
                { work: 8 },
              ],
              check: "body",
            },
            { type: "rounds", count: 3, slot: "A" },
            { type: "bindOff", slot: "A" },
          ],
        },
        sleeve("sleeve-left", "Left sleeve"),
        sleeve("sleeve-right", "Right sleeve"),
      ],
    },
  ],
};

/**
 * The test sweater with German short rows across the back of its neck, after
 * the rib: two pairs, the first reaching 4 stitches past the middle of the
 * back each way and the second 2 further, then on to the end of the round -
 * rows of 4, 7, 9, 11 and 5 stitches.
 */
export const testSweaterWithShortRows = (): SweaterPattern => {
  const pattern = structuredClone(testSweater);
  pattern.sizes[0].sections[1].rounds.splice(1, 0, {
    type: "shortRows",
    first: 4,
    extend: 2,
    pairs: 2,
    slot: "A",
  });
  return pattern;
};

/** Four stitches of one yarn and four of the next, round after round: a band's blocks. */
const blocks = (a: string, b: string, increases?: "both"): ChartCell[] => {
  const block = (slot: string): ChartCell[] =>
    increases
      ? [{ slot }, { slot, symbol: "kfb" }, { slot, symbol: "m1" }, { slot }, { slot }]
      : [{ slot }, { slot }, { slot }, { slot }];
  return [...block(a), ...block(b)];
};

/**
 * A sweater built the other way the site knows: a yoke of two-colour bands,
 * each in yarns of its own, increased within the bands, then increased again
 * along four raglan lines before it divides - and divided with the round
 * moved to the middle of the right underarm. Small enough to count by hand,
 * like the test sweater, with every stitch that construction asks for.
 *
 *   neck     cast on 24, join, 2 rounds of k1 p1 rib on the rib's needles
 *   yoke     main needles: (k3, kfb) x 6 -> 30; German short rows, pairs
 *            reaching 3 and then 3 more, increasing once on the last row
 *            back and once on the row to the end of the round -> 32
 *            colour needles: band 1, a round of blocks and a round
 *            increasing in every block -> 40; band 2, 2 rounds of blocks
 *            main needles: a plain round; a raglan round, kbf and kfb
 *            either side of four lines -> 48; a plain round
 *   divide   k6, wrap and hold 10 (right sleeve), cast on 3 and close up,
 *            k16, wrap and hold 10 (left), cast on 3 and close up, k6 ->
 *            body of 32
 *   body     a round, then on the rib's needles a round of k1 p1, and bound
 *            off in pattern
 *   sleeves  pick up 2, knit 10, pick up 2 -> 14, from an edge of 2; a
 *            round; k1, k2tog, k to last 3, ssk, k1 -> 12; a round of
 *            k1 p1 rib on the rib's needles, bound off in pattern
 */
export const testBandedSweater: SweaterPattern = {
  ...testSweater,
  id: "test-banded",
  name: "Test banded sweater",
  slots: ["MC", "1A", "1B", "2A", "2B"],
  tensions: { rib: { stitch: 0.9 }, colour: { round: 1.25 } },
  charts: [
    { id: "band-1", name: "Band 1", fabric: "colour", rows: [blocks("1A", "1B"), blocks("1A", "1B", "both")] },
    { id: "band-2", name: "Band 2", fabric: "colour", rows: [blocks("2A", "2B"), blocks("2A", "2B")] },
  ],
  colourways: [
    {
      ...testSweater.colourways[0],
      shades: [
        { slot: "MC", name: "Dark", hex: "#333333", source: "approximate" },
        { slot: "1A", name: "Red", hex: "#aa3333", source: "approximate" },
        { slot: "1B", name: "Gold", hex: "#ccaa33", source: "approximate" },
        { slot: "2A", name: "Blue", hex: "#3355aa", source: "approximate" },
        { slot: "2B", name: "Pale", hex: "#dddddd", source: "approximate" },
      ],
    },
  ],
  sizes: [
    {
      ...testSweater.sizes[0],
      needlesMm: 3,
      ribNeedlesMm: 2.75,
      colourNeedlesMm: 3.75,
      checks: {
        neck: 24,
        setUp: 30,
        shortRows: 32,
        "band-1": 40,
        raglan: 48,
        body: 32,
        "sleeve-left:top": 14,
        "sleeve-left:cuff": 12,
        "sleeve-right:top": 14,
        "sleeve-right:cuff": 12,
      },
      sections: [
        {
          label: "Neck",
          piece: "yoke",
          rounds: [
            { type: "castOn", count: 24, slot: "MC", fabric: "rib", check: "neck" },
            { type: "join" },
            { type: "rounds", count: 2, slot: "MC", sequence: ["k", "p"], fabric: "rib" },
          ],
        },
        {
          label: "Yoke",
          piece: "yoke",
          rounds: [
            { type: "needles", to: "main" },
            {
              type: "shaping",
              slot: "MC",
              to: 30,
              ops: [{ repeat: [{ work: "k", times: 3 }, { work: "kfb" }], times: 6 }],
              check: "setUp",
            },
            {
              type: "shortRows",
              first: 3,
              extend: 2,
              extendLast: 3,
              pairs: 2,
              slot: "MC",
              shaping: {
                wrong: [{ work: "p", times: 2 }, { work: "pfb" }, { work: "p", times: 2 }],
                right: [{ work: "k", times: 2 }, { work: "kfb" }, { work: "k", times: 2 }],
              },
              check: "shortRows",
            },
            { type: "needles", to: "colour" },
            { type: "chart", chart: "band-1", rows: [1, 2], check: "band-1" },
            { type: "chart", chart: "band-2", rows: [1, 2] },
            { type: "needles", to: "main" },
            { type: "rounds", count: 1, slot: "MC" },
            {
              type: "shaping",
              slot: "MC",
              to: 48,
              ops: [
                { work: "k", times: 4 }, { work: "kbf" }, { work: "kfb" },
                { work: "k", times: 6 }, { work: "kbf" }, { work: "kfb" },
                { work: "k", times: 12 }, { work: "kbf" }, { work: "kfb" },
                { work: "k", times: 6 }, { work: "kbf" }, { work: "kfb" },
                { work: "k", times: 4 },
              ],
              check: "raglan",
            },
            { type: "rounds", count: 1, slot: "MC" },
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
                { work: 6 },
                { hold: "sleeve-right", count: 10, castOn: 2, wrap: true, close: "slipPassOver" },
                { work: 16 },
                { hold: "sleeve-left", count: 10, castOn: 2, wrap: true, close: "slipPassOver" },
                { work: 6 },
              ],
              check: "body",
            },
            { type: "rounds", count: 1, slot: "MC" },
            { type: "needles", to: "rib" },
            { type: "rounds", count: 1, slot: "MC", sequence: ["k", "p"], fabric: "rib" },
            { type: "bindOff", slot: "MC", sequence: ["k", "p"], fabric: "rib" },
          ],
        },
        ...(["sleeve-left", "sleeve-right"] as const).map((piece): Section => ({
          label: piece === "sleeve-left" ? "Left sleeve" : "Right sleeve",
          piece,
          rounds: [
            { type: "piece", held: piece, before: 2, after: 2, slot: "MC", check: `${piece}:top` },
            { type: "rounds", count: 1, slot: "MC" },
            {
              type: "shaping",
              slot: "MC",
              to: 12,
              ops: [
                { work: "k", times: 1 },
                { work: "k2tog" },
                { repeat: [{ work: "k", times: 1 }], untilRemaining: 3 },
                { work: "ssk" },
                { work: "k", times: 1 },
              ],
            },
            { type: "needles", to: "rib" },
            { type: "rounds", count: 1, slot: "MC", sequence: ["k", "p"], fabric: "rib", check: `${piece}:cuff` },
            { type: "bindOff", slot: "MC", sequence: ["k", "p"], fabric: "rib" },
          ],
        })),
      ],
    },
  ],
};
