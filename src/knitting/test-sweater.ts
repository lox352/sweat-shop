import type { Chart, Section, SweaterPattern } from "../data/sweaters/types";

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
