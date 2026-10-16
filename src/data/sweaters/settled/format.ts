import { Stitch, isFabric } from "../../../types/Stitch";

/** The version of the files written now: 2, the fabric's stitches alone. 1 had every stitch, steps and all. */
export const settledVersion = 2;

/**
 * How a settled sweater is written down: the position of every stitch of its
 * fabric, in id order, in tenths of a unit - a millimetre or so, finer than
 * anyone can see - each as the difference from the stitch before it.
 *
 * Only the fabric. A step - a change of needles, a turn, a marker placed - is
 * not a stitch and has no place of its own, and nor has the phantom stitch 0:
 * each is put where a stitch beside it is (see allPositions), as the pose and
 * the settling put them. So a pattern can gain or lose a step without its
 * sweater being settled again.
 *
 * Positions as they are would be a few hundred thousand numbers like
 * -153.7, which compress badly. Neighbouring stitches are a stitch apart, so
 * their differences are small whole numbers, mostly the same few over and
 * over, and the file gzips to a fraction of the size.
 */
export interface SettledFile {
  version: typeof settledVersion;
  /** Units to a whole number: ten, for tenths. */
  scale: number;
  /** Three whole numbers a stitch: the first stitch's position, then each one's difference from the last. */
  deltas: number[];
}

export const encodeSettled = (positions: ArrayLike<number>, scale = 10): SettledFile => {
  const deltas = new Array<number>(positions.length);
  const last = [0, 0, 0];
  for (let index = 0; index < positions.length; index++) {
    const axis = index % 3;
    const whole = Math.round(positions[index] * scale);
    deltas[index] = whole - last[axis];
    last[axis] = whole;
  }
  return { version: settledVersion, scale, deltas };
};

export const decodeSettled = (file: SettledFile): Float32Array => {
  if (file.version !== settledVersion) throw new Error(`settled file version ${file.version} is not one this site reads`);
  const positions = new Float32Array(file.deltas.length);
  const sum = [0, 0, 0];
  for (let index = 0; index < file.deltas.length; index++) {
    const axis = index % 3;
    sum[axis] += file.deltas[index];
    positions[index] = sum[axis] / file.scale;
  }
  return positions;
};

/** The fabric's positions alone, in id order, out of every stitch's: what a settled file holds. */
export const fabricPositions = (stitches: Stitch[], positions: ArrayLike<number>): Float32Array => {
  const fabric = stitches.filter(isFabric);
  const out = new Float32Array(fabric.length * 3);
  fabric.forEach((stitch, index) => {
    for (let axis = 0; axis < 3; axis++) out[index * 3 + axis] = positions[stitch.id * 3 + axis];
  });
  return out;
};

/**
 * Every stitch's position from the fabric's: each step where the stitch
 * before it is, and the phantom stitch 0 where the first stitch cast on is,
 * as the pose and the settling put them.
 */
export const allPositions = (stitches: Stitch[], fabric: ArrayLike<number>): Float32Array => {
  const out = new Float32Array(stitches.length * 3);
  let next = 0;
  for (const stitch of stitches) {
    const at = stitch.id * 3;
    if (isFabric(stitch)) {
      for (let axis = 0; axis < 3; axis++) out[at + axis] = fabric[next + axis];
      next += 3;
    } else if (stitch.id > 0) {
      out.copyWithin(at, at - 3, at);
    }
  }
  if (stitches.length > 1) out.copyWithin(0, 3, 6);
  return out;
};

/** How many numbers a size's settled file holds: three for each stitch of its fabric. */
export const settledLength = (stitches: Stitch[]): number => stitches.filter(isFabric).length * 3;
