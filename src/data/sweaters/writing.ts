import type { Chart, ChartCell, ShapingOp, SlotId } from "./types";

/**
 * Helpers for writing a design down the way a designer draws one.
 *
 * A Fair Isle band is a little picture - one repeat wide, a few rows tall,
 * with a ground colour and a pattern colour on every row - and it is far
 * easier to see, and to change, drawn as rows of characters than as a few
 * hundred cell objects. So that is how the designs are written, and these
 * turn the drawing into the chart rows the engine knits.
 */

/**
 * A band drawn as characters, top row first: "x" for the pattern colour and
 * "." for the ground. Each row names its own [ground, pattern] slots, which
 * is how Fair Isle shades a band from its edges to its middle.
 */
export const band = (
  id: string,
  name: string,
  lines: [drawing: string, ground: SlotId, pattern: SlotId][],
): Chart => {
  const width = lines[0][0].length;
  const rows = lines.map(([drawing, ground, pattern], index) => {
    if (drawing.length !== width) {
      throw new Error(`${id}: row ${lines.length - index} is not ${width} wide`);
    }
    return [...drawing].map((mark): ChartCell => {
      if (mark !== "x" && mark !== ".") throw new Error(`${id}: "${mark}" is not x or .`);
      return { slot: mark === "x" ? pattern : ground };
    });
  });
  // Drawn top first; knitted, and stored, bottom first.
  return { id, name, rows: rows.reverse() };
};

/**
 * Corrugated rib: knit two in one yarn, purl two in another, round after
 * round, with the knit stitches' yarn named row by row, top row first. It is
 * what a Fair Isle neck, hem and cuff are worked in: two colours, like every
 * other round of the yoke, and so no less firm than the colourwork above it.
 */
export const corrugatedRib = (
  id: string,
  name: string,
  rows: [knit: SlotId, purl: SlotId][],
  fabric?: string,
): Chart => ({
  id,
  name,
  fabric,
  rows: rows
    .map(([knit, purl]): ChartCell[] => [
      { slot: knit },
      { slot: knit },
      { slot: purl, symbol: "purl" },
      { slot: purl, symbol: "purl" },
    ])
    .reverse(),
});

/**
 * "Increase evenly": take a round of `from` stitches to `to`, with the
 * make-ones spread as evenly round it as whole stitches allow.
 *
 * The stitches are shared out into as many stretches as there are
 * increases, the longer stretches interleaved among the shorter ones, with a
 * make-one between each two. The round begins half way through the first
 * stretch and ends with its other half, as a pattern writes it - "K8, [m1,
 * k17] 23 times, m1, k9" - so the make-ones sit evenly either side of the
 * beginning of the round and every stitch stays over the one it is worked
 * into, near enough. Runs of the same stretch are written as a repeat.
 */
export const increaseEvenly = (from: number, to: number): ShapingOp[] => {
  const increases = to - from;
  if (increases <= 0 || increases > from) {
    throw new Error(`cannot increase ${from} stitches to ${to} in one round`);
  }
  const short = Math.floor(from / increases);
  const long = from % increases;
  // Bresenham: which of the stretches are the long ones.
  const stretches: number[] = [];
  for (let index = 0; index < increases; index++) {
    const longSoFar = Math.floor(((index + 1) * long) / increases) - Math.floor((index * long) / increases);
    stretches.push(short + longSoFar);
  }
  const first = Math.ceil(stretches[0] / 2);
  const ops: ShapingOp[] = [{ work: "k", times: first }, { work: "m1" }];
  for (let index = 1; index < stretches.length; ) {
    let times = 1;
    while (stretches[index + times] === stretches[index]) times++;
    const one: ShapingOp[] = [{ work: "k", times: stretches[index] }, { work: "m1" }];
    if (times === 1) ops.push(...one);
    else ops.push({ repeat: one, times });
    index += times;
  }
  if (stretches[0] - first > 0) ops.push({ work: "k", times: stretches[0] - first });
  return ops;
};

/**
 * A sleeve's decrease round, with the beginning of the round at the middle
 * of the underarm: knit one, k2tog, knit to the last three, ssk, knit one.
 * The k2tog leans right and the ssk left, so the two lines of decreases lean
 * in towards the underarm from either side.
 */
export const underarmDecrease: ShapingOp[] = [
  { work: "k", times: 1 },
  { work: "k2tog" },
  { repeat: [{ work: "k", times: 1 }], untilRemaining: 3 },
  { work: "ssk" },
  { work: "k", times: 1 },
];
