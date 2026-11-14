/**
 * The points that bound a sweater's silhouette, from wherever it is posed or
 * settled: for each of the twenty-six directions out from a cube's middle -
 * its faces, edges and corners - the stitch furthest that way.
 *
 * Not a bounding box's corners. A sweater with its arms out is mostly air
 * between the cuffs and the hem, and a box's lower corners sit out there,
 * further from the middle than any stitch; framed by them, the sweater
 * shrinks into the middle of the frame. Real stitches at the extremes - the
 * cuffs, the neck, the hem, the underarms - are what the camera has to fit.
 */
export const extremesOf = (positions: Float32Array, ids: Iterable<number>): [number, number, number][] => {
  const directions: [number, number, number][] = [];
  for (const x of [-1, 0, 1]) {
    for (const y of [-1, 0, 1]) {
      for (const z of [-1, 0, 1]) {
        if (x || y || z) directions.push([x, y, z]);
      }
    }
  }
  const best = directions.map(() => -Infinity);
  const found = directions.map((): [number, number, number] => [0, 0, 0]);
  for (const id of ids) {
    const x = positions[id * 3];
    const y = positions[id * 3 + 1];
    const z = positions[id * 3 + 2];
    directions.forEach(([dx, dy, dz], index) => {
      const reach = x * dx + y * dy + z * dz;
      if (reach > best[index]) {
        best[index] = reach;
        found[index] = [x, y, z];
      }
    });
  }
  // A sweater with no stitches at all has no extremes, rather than twenty-six at the origin.
  return best[0] === -Infinity ? [] : found;
};
