import { adjacentStitchDistance } from "../constants";
import { consumption } from "../types/StitchType";
import type { Knitting } from "./knitting";

/**
 * How a piece came out, measured off a settled sweater: the shape of its
 * stitches, and how round its rounds are.
 *
 * A knitter's tension is two numbers, stitches and rounds to ten
 * centimetres, and between them they say what shape a stitch is - which is
 * the one thing a settled sweater has to get right: stitches that settle
 * too tall make a sweater too long. So, as on the hat site, each piece is
 * measured across a band of its plain fabric - the middle half of its rounds
 * in the main fabric, clear of the ribs, which are meant to pull in - and
 * the measure is the stitch's width over its round's height, against what
 * the tension asks for.
 *
 * And frill: how much longer a round is than the circle it encloses. One is
 * a round held out round; more is a round wandering in and out on its way
 * round, which keeps its stitch gaps and the tension and still comes out
 * narrower than the knitting.
 */
export interface PieceGauge {
  piece: string;
  /** The rounds measured, 1-based within the sweater, inclusive. */
  band: [number, number];
  /** Mean gap between neighbouring stitches in a round. */
  across: number;
  /**
   * Mean distance from a stitch to the stitch it was worked into: a round's
   * height up the fabric, whichever way the fabric runs - down a tube, or
   * out across a yoke, where the rounds' middles are only the drop of it.
   */
  up: number;
  /** across / up: the shape of a stitch. */
  ratio: number;
  /** What the tension asks for. */
  wanted: number;
  frill: number;
}

const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

export const measurePiece = (knitting: Knitting, positions: ArrayLike<number>, piece: string): PieceGauge => {
  const { stitches, rounds, roundPieces, roundHeight } = knitting;
  const at = (id: number) => [positions[id * 3], positions[id * 3 + 1], positions[id * 3 + 2]];
  const gap = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // Whole rounds of the main fabric all the way round: not a short row, nor part of a round, nor one turning into a rib.
  const indices = rounds
    .map((_, index) => index)
    .filter((index) => roundPieces[index] === piece && (knitting.roundKinds[index] ?? "round") === "round")
    .filter((index) => rounds[index].every((id) => (stitches[id].width ?? adjacentStitchDistance) === adjacentStitchDistance));
  const band = indices.slice(Math.floor(indices.length * 0.25), Math.ceil(indices.length * 0.75));
  const middleOf = (index: number) => {
    const sum = [0, 0, 0];
    for (const id of rounds[index]) at(id).forEach((value, axis) => (sum[axis] += value / rounds[index].length));
    return sum;
  };

  const across: number[] = [];
  const ups: number[] = [];
  const frills: number[] = [];
  const inBand = new Set(band.map((index) => rounds[index]).flat());
  band.forEach((index) => {
    const round = rounds[index];
    const points = round.map(at);
    for (let i = 1; i < points.length; i++) across.push(gap(points[i], points[i - 1]));
    const middle = middleOf(index);
    for (const id of round) {
      const stitch = stitches[id];
      const worked = stitch.links.slice(0, consumption[stitch.type]);
      // One for one, and worked into the band's own fabric: a decrease leans, and the band's first round has nothing in it below.
      if (worked.length === 1 && inBand.has(worked[0])) ups.push(gap(at(id), at(worked[0])));
    }
    // The round's own length, closed, against the circle it encloses.
    let perimeter = 0;
    for (let i = 0; i < points.length; i++) perimeter += gap(points[i], points[(i + 1) % points.length]);
    const radius = mean(points.map((point) => gap(point, middle)));
    if (radius > 0) frills.push(perimeter / (2 * Math.PI * radius));
  });
  const acrossMean = mean(across);
  const upMean = mean(ups);
  return {
    piece,
    band: [(band[0] ?? 0) + 1, (band[band.length - 1] ?? 0) + 1],
    across: acrossMean,
    up: upMean,
    ratio: upMean > 0 ? acrossMean / upMean : 0,
    wanted: adjacentStitchDistance / roundHeight,
    frill: mean(frills),
  };
};
