/**
 * How a settled sweater is written down: every stitch's position, by id, in
 * tenths of a unit - a millimetre or so, finer than anyone can see - each as
 * the difference from the stitch before it.
 *
 * Positions as they are would be a few hundred thousand numbers like
 * -153.7, which compress badly. Neighbouring stitches are a stitch apart, so
 * their differences are small whole numbers, mostly the same few over and
 * over, and the file gzips to a fraction of the size. Steps sit where the
 * stitch before them does, so they cost a zero each.
 */
export interface SettledFile {
  version: 1;
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
  return { version: 1, scale, deltas };
};

export const decodeSettled = (file: SettledFile): Float32Array => {
  if (file.version !== 1) throw new Error(`settled file version ${file.version} is not one this site reads`);
  const positions = new Float32Array(file.deltas.length);
  const sum = [0, 0, 0];
  for (let index = 0; index < file.deltas.length; index++) {
    const axis = index % 3;
    sum[axis] += file.deltas[index];
    positions[index] = sum[axis] / file.scale;
  }
  return positions;
};
