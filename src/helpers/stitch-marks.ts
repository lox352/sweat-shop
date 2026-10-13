import { StitchType } from "../types/StitchType";

/**
 * The marks a chart prints in a cell, as geometry rather than as a picture.
 *
 * The symbols are the ones these patterns use: a dot for a purl, a leaning
 * stroke for a decrease that leans, a three-legged chevron for the centred
 * double decrease, whose middle leg says the middle stitch finishes on top,
 * and the same chevron without that leg for the double decrease that has no
 * middle stitch on top and leans instead.
 * Every mark is symmetric about the middle of its cell, so it lands square
 * whatever size the cell is drawn at.
 *
 * Given as points in a unit cell so the chart can draw them at whatever size
 * it likes, and so nothing here has to know it is being drawn onto a canvas.
 */

/** How far a mark keeps clear of the cell's edges, as a fraction of a cell. */
const inset = 0.22;

const near = inset;
const far = 1 - inset;
const mid = 0.5;

export interface Mark {
  /** Each entry is a run of points to be joined up. */
  strokes?: [number, number][][];
  /** A filled circle, as centre and radius, in the same unit cell. */
  dot?: { x: number; y: number; r: number };
}

const marks: Partial<Record<StitchType, Mark>> = {
  p1: { dot: { x: mid, y: mid, r: 0.14 } },
  // A twisted stitch: the two legs crossed.
  k1tbl: {
    strokes: [
      [
        [near, far],
        [far, near],
      ],
      [
        [near, near],
        [far, far],
      ],
    ],
  },
  k2tog: {
    strokes: [
      [
        [near, far],
        [far, near],
      ],
    ],
  },
  ssk: {
    strokes: [
      [
        [near, near],
        [far, far],
      ],
    ],
  },
  s2kp: {
    strokes: [
      [
        [near, far],
        [mid, near],
        [far, far],
      ],
      [
        [mid, near],
        [mid, far],
      ],
    ],
  },
  /*
   * The other double decrease, which leans rather than standing straight:
   * slip one, knit two together, pass the slipped stitch over. Drawn as the
   * chevron without its middle leg, because there is no middle stitch
   * finishing on top - the lean is the whole difference.
   */
  sk2p: {
    strokes: [
      [
        [near, far],
        [mid, near],
        [far, far],
      ],
    ],
  },
  /*
   * A make-one, picked up from the strand between two stitches: the strand
   * along the foot of the cell, and the new stitch lifted up out of it. It
   * sits over the gap between those two stitches, with nothing under it.
   */
  m1: {
    strokes: [
      [
        [near, far],
        [far, far],
      ],
      [
        [mid, far],
        [mid, near],
      ],
    ],
  },
};

/*
 * Casting on: a loop hanging from the needle, open at the top.
 */
marks.castOn = {
  strokes: [
    Array.from({ length: 9 }, (_, i): [number, number] => {
      const angle = (i / 8) * Math.PI;
      return [mid + 0.2 * Math.cos(angle), mid + 0.2 * Math.sin(angle) - 0.05];
    }),
  ],
};

/*
 * Picking up a stitch from an edge: the stitch drawn up out of the foot of
 * the cell, with the loop it makes at the top.
 */
marks.pickUp = {
  strokes: [
    [
      [mid, far],
      [mid, mid],
    ],
    Array.from({ length: 9 }, (_, i): [number, number] => {
      const angle = Math.PI + (i / 8) * Math.PI;
      return [mid + 0.16 * Math.cos(angle), mid - 0.06 + 0.16 * Math.sin(angle)];
    }),
  ],
};

/*
 * Binding off: a bar across the cell, the chain a bound-off edge makes.
 */
marks.bindOff = {
  strokes: [
    [
      [near, mid],
      [far, mid],
    ],
  ],
};

export const markFor = (type: StitchType): Mark | undefined => marks[type];

/**
 * A make-one whose pattern says which way it leans: the same strand along the
 * foot of the cell, with the new stitch lifted out of it leaning that way.
 */
export const makeOneMark = (lean?: "left" | "right"): Mark | undefined =>
  lean === undefined
    ? marks.m1
    : {
        strokes: [
          [
            [near, far],
            [far, far],
          ],
          [
            [mid, far],
            [lean === "left" ? near : far, near],
          ],
        ],
      };

/**
 * One stitch becoming two, drawn across both: a V opening from over the
 * stitch below to the middle of each stitch it becomes - the double
 * decrease's chevron, the other way up.
 *
 * Points are in the unit cell of the stitch that does the work, so `from` and
 * `to` are cell centres measured from its left edge - 0.5 is its own middle
 * and -0.5 the middle of the cell to its left. Where the point of the V
 * stands is what says which way the increase leans: under the working stitch
 * when the new one is made beside it, as a KFB's is, so one arm stands
 * straight up; or between the two when neither keeps the column.
 */
export const forkMark = (from: number, to: number[]): Mark => ({
  strokes: to.map((x) => [
    [from, far],
    [x, near],
  ]),
});

export const markLabels: Partial<Record<StitchType, string>> = {
  p1: "purl",
  k1tbl: "knit through the back loop",
  k2tog: "knit two together",
  ssk: "slip, slip, knit",
  pickUp: "pick up and knit",
  bindOff: "bind off",
  s2kp: "slip 2, knit 1, pass slipped stitches over",
  sk2p: "slip 1, knit 2 together, pass slipped stitch over",
  m1: "make one",
  kfb: "knit front and back",
};
