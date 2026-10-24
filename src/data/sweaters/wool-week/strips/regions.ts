/**
 * Narrowing or padding a band by its foreground regions: a repeat taken in,
 * or let out, without altering its motifs.
 *
 * - **Regions.** A band's foreground stitches, grouped where they touch - side
 *   by side, above and below, or corner to corner - on the repeat wrapped
 *   round as it is on the needle. Each region is a shape that must come out
 *   unaltered.
 * - **Seams.** A seam is a path down the band through its background, one
 *   stitch in each round, that never cuts through a region: each region lies
 *   wholly on one side of it. Taking a seam out takes one stitch from every
 *   round of the repeat and moves the regions on one side of it a stitch
 *   closer to those on the other, unaltered. It may wander from round to round:
 *   2024's ram heads come a stitch nearer the little diamonds between them,
 *   which stay where they are, the seam passing between the diamonds and the
 *   heads where the diamonds are and through the gap below them.
 * - **Regions never meet.** A seam is taken only where every region stays
 *   apart from the others, at least a stitch of background between them,
 *   corners included. A region that runs all the way round, a border or a
 *   lattice, can't be passed, so a band with one can't be narrowed.
 * - **Mirror images stay mirror images,** seams taken in pairs, one either
 *   side of the mirror line; and the straightest seams first.
 * - **Padding** is a seam the other way: a stitch of background added in
 *   every round, its regions on one side moved a stitch away from those on
 *   the other. It may cross a region that runs all the way round, where it
 *   must - 2026's lattice, padded either side of its diamond of balls - and
 *   that region gives where it does: a stitch doubled in the round it
 *   crosses, or a line bent between rounds. It crosses where it bends the
 *   fewest of its lines, and that count is what the padding costs.
 */

/** A band narrowed or padded to `w`: each round's stitches, as places in the repeat (a doubled place twice); and, padded, how much it bends what it crosses. */
export interface Narrowed {
  w: number;
  maps: number[][];
  cost?: number;
}

interface Region {
  /** Each stitch: its round and its place, unwrapped so the region reads as one piece. */
  cells: [number, number][];
  /** The region meets itself round the repeat: a border, a lattice. */
  wraps: boolean;
}

const regionsOf = (fg: boolean[][], w: number): Region[] => {
  const H = fg.length;
  const seen = new Map<number, [number, number]>();
  const regions: Region[] = [];
  for (let r = 0; r < H; r++) {
    for (let x = 0; x < w; x++) {
      if (!fg[r][x] || seen.has(r * w + x)) continue;
      const id = regions.length;
      const cells: [number, number][] = [];
      let wraps = false;
      const stack: [number, number][] = [[r, x]];
      seen.set(r * w + x, [id, x]);
      while (stack.length) {
        const [rr, ux] = stack.pop()!;
        cells.push([rr, ux]);
        for (let dr = -1; dr <= 1; dr++) {
          for (let dx = -1; dx <= 1; dx++) {
            const r2 = rr + dr, u2 = ux + dx, x2 = ((u2 % w) + w) % w;
            if ((!dr && !dx) || r2 < 0 || r2 >= H || !fg[r2][x2]) continue;
            const had = seen.get(r2 * w + x2);
            if (had) {
              if (had[0] === id && had[1] !== u2) wraps = true;
              continue;
            }
            seen.set(r2 * w + x2, [id, u2]);
            stack.push([r2, u2]);
          }
        }
      }
      regions.push({ cells, wraps });
    }
  }
  return regions;
};

/**
 * The seams through a band, straightest first: in each round a background
 * place, each region's stitches all in one span between one round's seam and
 * the next repeat's, the same span in every round it has.
 */
const seamsOf = (fg: boolean[][], w: number, regions: Region[], most: number): number[][] => {
  const H = fg.length;
  const byRow: Map<number, number[]>[] = Array.from({ length: H }, () => new Map());
  regions.forEach((g, i) => g.cells.forEach(([r, u]) => byRow[r].set(i, [...(byRow[r].get(i) ?? []), u])));
  const spanOf = (u: number, s: number) => Math.floor((u - s - 1) / w);
  // Each round's places a seam may take, and the span each of its regions then falls in.
  const options = byRow.map((regs, r) => {
    const out = new Map<number, Map<number, number>>();
    for (let s = 0; s < w; s++) {
      if (fg[r][s]) continue;
      const spans = new Map<number, number>();
      let ok = true;
      for (const [i, us] of regs) {
        const k = spanOf(us[0], s);
        if (us.some((u) => spanOf(u, s) !== k)) { ok = false; break; }
        spans.set(i, k);
      }
      if (ok) out.set(s, spans);
    }
    return out;
  });
  // The straightest path down, every region in one span all the way.
  let cost = new Map<number, [number, number[]]>([...options[0].keys()].map((s) => [s, [0, [s]]]));
  for (let r = 1; r < H; r++) {
    const next = new Map<number, [number, number[]]>();
    for (const [s, spans] of options[r]) {
      for (const [p, [c, path]] of cost) {
        const before = options[r - 1].get(p)!;
        if ([...spans].some(([i, k]) => before.has(i) && before.get(i) !== k)) continue;
        const d = Math.min(Math.abs(s - p), w - Math.abs(s - p));
        if (!next.has(s) || c + d * d < next.get(s)![0]) next.set(s, [c + d * d, [...path, s]]);
      }
    }
    cost = next;
    if (!cost.size) return [];
  }
  return [...cost.values()].sort((a, b) => a[0] - b[0]).slice(0, most).map(([, path]) => path);
};

/** A band with seams taken out: its foreground, its stitches' places in the repeat and their yarns. */
interface Band {
  fg: boolean[][];
  maps: number[][];
  tiles: string[][];
}
const cut = (b: Band, paths: number[][]): Band => {
  const keep = (r: number, x: number) => paths.every((p) => p[r] !== x);
  return {
    fg: b.fg.map((row, r) => row.filter((_, x) => keep(r, x))),
    maps: b.maps.map((row, r) => row.filter((_, x) => keep(r, x))),
    tiles: b.tiles.map((row, r) => row.filter((_, x) => keep(r, x))),
  };
};
/** Every region still whole and apart. */
const intact = (b: Band, n: number) => {
  const g = regionsOf(b.fg, b.fg[0].length);
  return g.length === n && !g.some((x) => x.wraps);
};
/** The lines a band is a mirror image about, as `a` where place x mirrors place a - x. */
const axesOf = (tiles: string[][]) => {
  const w = tiles[0].length;
  return Array.from({ length: w }, (_, a) => a).filter((a) => tiles.every((t) => t.every((c, x) => c === t[(((a - x) % w) + w) % w])));
};

/**
 * The ways a band can be taken in, narrowest last: for a mirror image two
 * stitches at a time, a seam and its mirror image; for any other one at a
 * time; up to `most` stitches. `tiles` and `bg` are its rounds' repeats and
 * their background, as unitsOf has them.
 */
export const narrowingsOf = (tiles: string[][], bg: boolean[][], most = 6): Narrowed[] => {
  const w = tiles[0].length;
  let band: Band = { fg: bg.map((row) => row.map((b) => !b)), maps: tiles.map(() => Array.from({ length: w }, (_, x) => x)), tiles };
  const first = regionsOf(band.fg, w);
  if (!first.length || first.some((g) => g.wraps)) return [];
  const n = first.length;
  const symmetric = axesOf(tiles).length > 0;
  const out: Narrowed[] = [];
  while (w - band.fg[0].length < most) {
    const b = band, bw = b.fg[0].length;
    const axes = symmetric ? axesOf(b.tiles) : [];
    let found: Band | undefined;
    for (const path of seamsOf(b.fg, bw, regionsOf(b.fg, bw), bw)) {
      const tries = symmetric ? axes.map((a) => path.map((x) => (((a - x) % bw) + bw) % bw)).filter((m) => m.every((x, r) => x !== path[r])).map((m) => [path, m]) : [[path]];
      found = tries.map((ps) => cut(b, ps)).find((c) => intact(c, n) && (!symmetric || axesOf(c.tiles).length > 0));
      if (found) break;
    }
    if (!found) break;
    band = found;
    out.push({ w: band.fg[0].length, maps: band.maps });
  }
  return out;
};

/**
 * The band padded by a seam and, for a mirror image, its mirror image: two
 * stitches for a mirror image, one for any other. Each seam doubles one
 * stitch in each round - background, or where it must cross a region that
 * runs all the way round, that region's - never cutting through any other
 * region; of those, the one that bends the fewest of the crossed region's
 * lines between rounds. None if no padding keeps every region apart.
 */
export const paddingOf = (tiles: string[][], bg: boolean[][]): Narrowed | undefined => {
  const w = tiles[0].length, H = tiles.length;
  const fg = bg.map((row) => row.map((b) => !b));
  const regions = regionsOf(fg, w);
  if (!regions.length) return undefined;
  const owner = new Map<number, number>();
  regions.forEach((g, i) => g.cells.forEach(([r, u]) => owner.set(r * w + (((u % w) + w) % w), i)));
  const round = fg.map((row, r) => row.map((f, x) => f && regions[owner.get(r * w + x)!].wraps));
  // The regions that must come out whole, by round.
  const byRow: Map<number, number[]>[] = Array.from({ length: H }, () => new Map());
  regions.forEach((g, i) => !g.wraps && g.cells.forEach(([r, u]) => byRow[r].set(i, [...(byRow[r].get(i) ?? []), u])));
  const spanOf = (u: number, s: number) => Math.floor((u - s - 1) / w);
  const options = byRow.map((regs, r) => {
    const out = new Map<number, { cost: number; spans: Map<number, number> }>();
    for (let s = 0; s < w; s++) {
      if (fg[r][s] && !round[r][s]) continue;
      const spans = new Map<number, number>();
      let ok = true;
      for (const [i, us] of regs) {
        const k = spanOf(us[0], s);
        if (us.some((u) => spanOf(u, s) !== k)) { ok = false; break; }
        spans.set(i, k);
      }
      if (ok) out.set(s, { cost: round[r][s] ? 1 : 0, spans });
    }
    return out;
  });
  // A round-the-repeat region's links between rounds r - 1 and r that a seam moving from p to s puts out of line.
  const bent = (r: number, p: number, s: number) => {
    let n = 0;
    for (let x = 0; x < w; x++) {
      if (!round[r - 1][x]) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const y = x + dx;
        if (y < 0 || y >= w || !round[r][y]) continue;
        if (x > p !== y > s) n++;
      }
    }
    return n;
  };
  let cost = new Map<number, [number, number[]]>([...options[0]].map(([s, o]) => [s, [o.cost, [s]]]));
  for (let r = 1; r < H; r++) {
    const next = new Map<number, [number, number[]]>();
    for (const [s, o] of options[r]) {
      for (const [p, [c, path]] of cost) {
        const before = options[r - 1].get(p)!;
        if ([...o.spans].some(([i, k]) => before.spans.has(i) && before.spans.get(i) !== k)) continue;
        const d = Math.min(Math.abs(s - p), w - Math.abs(s - p));
        const v = c + o.cost + bent(r, p, s) + 0.01 * d * d;
        if (!next.has(s) || v < next.get(s)![0]) next.set(s, [v, [...path, s]]);
      }
    }
    cost = next;
    if (!cost.size) return undefined;
  }
  const axes = axesOf(tiles);
  const doubled = (paths: number[][]) => {
    const maps = tiles.map((_, r) => Array.from({ length: w }, (_, x) => Array<number>(1 + paths.filter((p) => p[r] === x).length).fill(x)).flat());
    return { maps, fg: maps.map((m, r) => m.map((x) => fg[r][x])), tiles: maps.map((m, r) => m.map((x) => tiles[r][x])) };
  };
  for (const [c, path] of [...cost.values()].sort((a, b) => a[0] - b[0])) {
    // Doubling place x mirrors to doubling place a - x.
    const tries = axes.length ? axes.map((a) => [path, path.map((x) => (((a - x) % w) + w) % w)]) : [[path]];
    for (const paths of tries) {
      const b = doubled(paths);
      const after = regionsOf(b.fg, b.fg[0].length);
      if (after.length !== regions.length || after.filter((g) => g.wraps).length !== regions.filter((g) => g.wraps).length) continue;
      if (axes.length && !axesOf(b.tiles).length) continue;
      return { w: b.fg[0].length, maps: b.maps, cost: Math.round(c * paths.length) };
    }
  }
  return undefined;
};
