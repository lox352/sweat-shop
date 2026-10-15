import { StitchType } from "../types/StitchType";
import type { ChartStitch } from "../knitting/sides";

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

const marks: Partial<Record<ChartStitch, Mark>> = {
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

/**
 * Casting on part way round, at an underarm, with the yarn already at the
 * needle: the cast-on's loop, hanging from a bar - the needle it is knitted
 * onto - so it reads apart from the neck's long-tail cast-on.
 */
export const castOnPartWayMark: Mark = {
  strokes: [
    ...(marks.castOn?.strokes ?? []),
    [
      [near, 0.3],
      [far, 0.3],
    ],
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

/*
 * Slipping a stitch and passing the last stitch cast on over it: a slipped
 * stitch's V, closed across the top by the stitch lifted over it.
 */
marks.sl1po = {
  strokes: [
    [
      [near, near],
      [mid, far],
      [far, near],
      [near, near],
    ],
  ],
};

/*
 * The stitches as they are from the other side of the fabric - see
 * knitting/sides.ts. Each is drawn as its pair, with a purl's dot wherever its
 * strokes leave the cell clear, as a chart key draws a p2tog: a k2tog's stroke
 * with a dot beside it. A knit's pair is the purl's dot alone, and a purl's
 * the plain cell of a knit.
 */
const dotted = (mark: Mark | undefined, x: number, y: number): Mark => ({
  ...mark,
  dot: { x, y, r: 0.09 },
});
marks.p1tbl = dotted(marks.k1tbl, mid, 0.86);
marks.p2tog = dotted(marks.k2tog, 0.72, 0.72);
marks.ssp = dotted(marks.ssk, 0.28, 0.72);
marks.s2pp = dotted(marks.s2kp, 0.8, 0.3);
marks.p2sps = dotted(marks.sk2p, mid, 0.68);
marks.pickUpPurl = dotted(marks.pickUp, 0.76, 0.74);
marks.bindOffPurl = dotted(marks.bindOff, mid, 0.74);

export const markFor = (type: ChartStitch): Mark | undefined => marks[type];

/**
 * A make-one whose pattern says which way it leans: the same strand along the
 * foot of the cell, with the new stitch lifted out of it leaning that way.
 * Purled, from the other side of the fabric, it has a purl's dot on the side
 * it leans away from.
 */
export const makeOneMark = (lean?: "left" | "right", purled = false): Mark | undefined => {
  const mark: Mark | undefined =
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
  return purled ? dotted(mark, lean === "right" ? 0.26 : 0.74, 0.42) : mark;
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
 * straight up; or between the two when neither keeps the column. A KBF, whose
 * second loop is lifted out of the stitch below, stands its V on a foot - and
 * so does whatever looks like one from the side the chart shows, its new
 * stitch on its right: a PFB purled back, seen from the right side, and a KFB
 * seen from the wrong side, a PBF. So a V opening to the right always has a
 * foot, and a KFB is never drawn turned round.
 */
export const forkMark = (from: number, to: number[], purled = false, lifted = false): Mark => {
  const mark: Mark = {
    strokes: [
      ...to.map((x): [number, number][] => [
        [from, far],
        [x, near],
      ]),
      ...(lifted
        ? [
            [
              [from - 0.16, far],
              [from + 0.16, far],
            ] as [number, number][],
          ]
        : []),
    ],
  };
  // Purled - a PFB or a PBF - with a purl's dot beside the arm that stands up, away from the stitch it makes.
  return purled ? dotted(mark, from + (to.some((x) => x < from) ? 0.32 : -0.32), 0.56) : mark;
};

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
  kbf: "knit back and front",
  sl1po: "slip 1, pass the cast-on over",
  bindOffPurl: "bind off purlwise",
};
