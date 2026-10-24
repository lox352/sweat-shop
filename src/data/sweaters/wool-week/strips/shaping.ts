import type { Row } from "./plan";
import { background, quantumOf } from "./quanta";
import { type Narrowed, narrowingsOf, paddingOf } from "./regions";
import { bandSlotsOfRow } from "./slots";

/**
 * Shaping a piece by its quanta (see quanta.ts): how the count goes, round by
 * round, so that it follows a target without altering any foreground.
 *
 * - **Units.** A piece's rounds are cut into units: a quantum as far as the
 *   piece has it - with its aligned frames, where they're kept - or a round
 *   all of one yarn. Each unit is laid out afresh on its own count: a whole
 *   number of its repeat, some of the repeat's columns doubled, the same in
 *   every repeat.
 * - **Between units** the count changes freely: make-ones anywhere in a round
 *   of one yarn, or spread through the first round of the unit after.
 * - **Inside a unit** a column may be doubled at a round where no foreground
 *   stitch is in its chain of descendants - where it is background from that
 *   round to the unit's last. In a mirror image it is doubled with its mirror
 *   partner. A column is never doubled within two columns of one already
 *   doubled, and rounds that increase are kept apart where the target allows.
 * - **Decreases** are the same problem the other way up: worked from the
 *   bottom up, a piece that narrows going down grows. So a narrowing piece is
 *   solved on its rounds reversed, and each change of count is worked in the
 *   round below it: a doubled column then ends where its ancestors, from the
 *   top of its unit down, are all background.
 * - **Seamless where it can be.** A narrowing piece keeps every round within
 *   a tolerance of its target. A band that can't, on whole repeats, is knitted
 *   with a seam instead: centred on the arm, its repeats meeting part-way at a
 *   seam stitch, two decreases at a time either side of it. Seamed rounds cost
 *   the search far more than any departure from the target within the
 *   tolerance, so it seams as few as it can, and the piece never widens.
 * - **Narrowed and padded bands.** A narrowing piece may also knit a band on
 *   a narrower repeat than its hat's, its motifs brought closer together
 *   unaltered, by seams through its background between its foreground regions
 *   (see regions.ts); or on a wider one, a seam of background added. Such a
 *   band keeps its repeat all the way down. Padding costs more the more it
 *   bends a region it has to cross, enough that it is used only where the band would otherwise be seamed.
 *
 * The counts are chosen by a search over the whole piece, keeping each round
 * as near its target as it can, never more than 12% over it.
 */

type ChartRow = Exclude<Row, { plain: string }>;
const isPlain = (r: Row): r is { year: number; plain: string } => "plain" in r;

/** A chart row's slots on its repeat, as knitted: right to left, each marked for its place in a shaded band where the row has one. */
export const tileOf = (r: ChartRow): string[] => bandSlotsOfRow(r.year, r.chart, r.row, r.band).slice(0, r.w).reverse();

export interface Unit {
  /** Its rounds, as indices into the piece's rows. */
  rows: number[];
  /** A round all of one yarn. */
  solid: boolean;
  /** The repeat all its rounds share, in stitches. */
  w: number;
  /** Each round's repeat, as knitted. */
  tiles: string[][];
  /** Each round's stitches, as knitted: background or not. */
  bg: boolean[][];
  /** The columns that are doubled together: a column with its mirror partner, or one on a mirror line, or alone. */
  slots: number[][];
  /** Each round's pass round its quantum's repeat: 0, then 1 once the unit has run on from its last row back to its first. */
  pass: number[];
}

const periodOf = (tiles: string[][]): number => {
  const w = tiles[0].length;
  for (let p = 1; p < w; p++) if (w % p === 0 && tiles.every((t) => t.every((c, j) => c === t[j % p]))) return p;
  return w;
};

/** A repeat's mirror lines, doubled so that a line between two stitches is a whole number. */
const axesOf = (tiles: string[][], p: number): number[] => {
  const out: number[] = [];
  for (let a2 = 0; a2 < 2 * p; a2++) if (tiles.every((t) => t.every((c, x) => c === t[(((a2 - x) % p) + p) % p]))) out.push(a2);
  return out;
};

/** The piece's rounds as units. */
export const unitsOf = (rows: Row[]): Unit[] => {
  const keyOf = (r: Row, i: number): string => {
    if (isPlain(r) || new Set(tileOf(r)).size === 1) return `solid${i}`;
    const q = quantumOf(r.year, r.chart, r.row);
    if (!q) return `alone${i}`;
    return q.aligned ? `${r.year}${r.chart}:${q.group}` : `${r.year}${r.chart}:${q.from}-${q.to}`;
  };
  const units: Unit[] = [];
  for (let i = 0; i < rows.length; ) {
    const key = keyOf(rows[i], i);
    let j = i + 1;
    // A unit runs on while its rounds are the same quantum's, in order through its chart: down it, or up it for a piece solved the other way up;
    // and on round the quantum's own repeat, from its last row back to its first, so that 2025's peerie and the cores either side of it line up.
    const onward = (a: ChartRow, b: ChartRow) => {
      if (Math.abs(b.row - a.row) === 1) return true;
      const q = quantumOf(a.year, a.chart, a.row);
      return !!q && q.to > q.from && ((a.row === q.from && b.row === q.to) || (a.row === q.to && b.row === q.from));
    };
    while (j < rows.length && keyOf(rows[j], j) === key && !isPlain(rows[j]) && onward(rows[j - 1] as ChartRow, rows[j] as ChartRow)) j++;
    const idx = Array.from({ length: j - i }, (_, k) => i + k);
    const pass = idx.map(() => 0);
    for (let k = 1; k < idx.length; k++) pass[k] = pass[k - 1] + (Math.abs((rows[idx[k]] as ChartRow).row - (rows[idx[k - 1]] as ChartRow).row) === 1 ? 0 : 1);
    if (key.startsWith("solid")) units.push({ rows: idx, solid: true, w: 1, tiles: [], bg: [], slots: [], pass });
    else {
      const rs = idx.map((k) => rows[k] as ChartRow);
      const full = rs.map(tileOf);
      const w = periodOf(full);
      const tiles = full.map((t) => t.slice(0, w));
      let axes = axesOf(tiles, w);
      // 2014's 28-stitch stars are a mirror image but for a pair of dots in their middle row: mirrored as the rest are.
      if (!axes.length && rs[0].year === 2014) axes = axesOf(tiles.filter((_, k) => rs[k].row !== 7), w);
      const mirror = (x: number) => (axes.length ? (((axes[0] - x) % w) + w) % w : x);
      const bg = rs.map((r) => Array.from({ length: w }, (_, q) => background(r.year, r.chart, r.row, r.w - 1 - q)));
      const slots = [...new Map(Array.from({ length: w }, (_, x) => [Math.min(x, mirror(x)), [...new Set([x, mirror(x)])].sort((a, b) => a - b)])).values()];
      units.push({ rows: idx, solid: false, w, tiles, bg, slots, pass });
    }
    i = j;
  }
  return units;
};

/** Doubled columns: how many extra copies of each. */
type Dup = [x: number, extra: number][];
const keyOfDup = (d: Dup) => d.map(([x, k]) => `${x}.${k}`).join(",");

/** A repeat with columns doubled: each column, as many times as it now has. */
export const mapOf = (w: number, dup: Dup): number[] => {
  const extra = new Map(dup);
  return Array.from({ length: w }, (_, x) => Array<number>(1 + (extra.get(x) ?? 0)).fill(x)).flat();
};

export interface Step {
  /** The count the round leaves. */
  count: number;
  /** How the round is worked: as it stands; a change of count in a round of one yarn or through a unit's first round; or columns doubled. */
  kind: "same" | "change" | "double";
  /** For a unit's round, its repeat: the unit's columns, doubled ones repeated. */
  map?: number[];
  /** For a unit's round, how many repeats. */
  reps?: number;
  /** A band with a seam on the inner arm (see above), its round the whole count. */
  seam?: boolean;
  /** A band on a narrowed or padded repeat (see regions.ts): how many stitches each repeat gains, or gives up if fewer than none. Its map is then the round's own. */
  resized?: number;
}

export interface Target {
  /** The count before the first round. */
  from: number;
  /** The count after the last: exactly (growing), or at most (narrowing, solved reversed). */
  to: number;
  /** Round i's target. */
  want: (i: number) => number;
  /** For a narrowing piece: how far, as a part of it, any round may be from its target. */
  tolerance?: number;
}

const CAP = 5;
const KEEP = 8;

/** A layout of doubled columns, kept once and named by a number, so the search can tell layouts apart cheaply. */
interface Layout {
  id: number;
  dup: Dup;
  /** Extra stitches it adds to a repeat. */
  extra: number;
  /** Not a layout of repeats: the band seamed. */
  seam?: boolean;
  /** The band on its repeat narrowed or padded: which of its resizings. */
  resized?: number;
}

/**
 * The counts and layouts for a piece that grows down its rounds. `rows` and
 * `t` are as the search sees them: for a narrowing piece, reversed (see
 * narrowing).
 */
const search = (rows: Row[], t: Target, reversed: boolean): Step[] => {
  const n = rows.length;
  const units = unitsOf(rows);
  const unitAt: number[] = [];
  const posAt: number[] = [];
  units.forEach((u, k) => u.rows.forEach((i, p) => ((unitAt[i] = k), (posAt[i] = p))));
  /** Is a round worked in pattern - where the count changes when it's at round i? */
  const patterned = (i: number) => {
    const at = reversed ? i - 1 : i;
    return at >= 0 && at < n && !units[unitAt[at]].solid;
  };
  /** The first round of its unit from which a slot is background to the unit's end, or past the end if none. */
  const clearFrom = (u: Unit, slot: number[]) => {
    let p = u.rows.length;
    while (p > 0 && slot.every((x) => u.bg[p - 1][x])) p--;
    return p;
  };
  /** How much a doubled stitch shows: a lone stitch made two shows a lot, one in a long run little. */
  const shows = (tile: string[], bg: boolean[], m: number[], q: number) => {
    const w = tile.length;
    const x = tile[q];
    let L = 1;
    for (let k = 1; k < w && tile[(q - k + w) % w] === x; k++) L++;
    for (let k = 1; k < w && L < w && tile[(q + k) % w] === x; k++) L++;
    return (bg[m[q]] ? 0.3 : 1) / L;
  };

  const layouts: Layout[] = [];
  const layoutIds = new Map<string, number>();
  const layoutOf = (dup: Dup): Layout => {
    const key = keyOfDup(dup);
    let id = layoutIds.get(key);
    if (id === undefined) {
      id = layouts.length;
      layoutIds.set(key, id);
      layouts.push({ id, dup, extra: dup.reduce((s, [, e]) => s + e, 0) });
    }
    return layouts[id];
  };
  const none = layoutOf([]);
  const seamed: Layout = { id: layouts.length, dup: [], extra: 0, seam: true };
  layouts.push(seamed);
  layoutIds.set("seam", seamed.id);
  /** What a seamed round costs: more than any round within the tolerance, so a band is seamed only where it must be. */
  const SEAM = 0.05;
  // Narrowing, each band's narrower repeats and its padded one, and a layout for each; a narrowed band costs a little, so the hat's own spacing is kept where it does as well, and a padded one more, the more it bends what it crosses.
  const resizings = units.map((u): Narrowed[] => {
    if (!reversed || u.solid) return [];
    const padded = paddingOf(u.tiles, u.bg);
    return [...narrowingsOf(u.tiles, u.bg), ...(padded ? [padded] : [])];
  });
  const resizedLayouts = resizings.map((ns, k) =>
    ns.map((v, j) => {
      const L: Layout = { id: layouts.length, dup: [], extra: v.w - units[k].w, resized: j };
      layouts.push(L);
      return L;
    }),
  );
  const NARROWED = 0.002;
  const PADDED = 0.08;
  const BENT = 0.004;
  const resizeCost = (k: number, L: Layout) => {
    const v = resizings[k][L.resized!];
    return v.w < units[k].w ? NARROWED : PADDED + BENT * (v.cost ?? 0);
  };

  const lookMemo = new Map<number, number>();
  const look = (k: number, p: number, L: Layout): number => {
    const key = (L.id * 512 + k) * 256 + p;
    let c = lookMemo.get(key);
    if (c !== undefined) return c;
    const u = units[k];
    const m = mapOf(u.w, L.dup);
    c = 0;
    for (let r = p; r < u.rows.length; r++) {
      const tile = m.map((x) => u.tiles[r][x]);
      for (let q = 1; q < m.length; q++) if (m[q - 1] === m[q]) c += shows(tile, u.bg[r], m, q);
    }
    lookMemo.set(key, c);
    return c;
  };
  // Each unit's best slots to double: clear for the most rounds, then least seen.
  const best = units.map((u, k) => {
    if (u.solid) return [];
    const scored = u.slots
      .map((slot) => ({ slot, from: clearFrom(u, slot) }))
      .filter((s) => s.from < u.rows.length)
      .map((s) => ({ ...s, cost: look(k, 0, layoutOf(s.slot.map((x) => [x, 1]))) / s.slot.length }));
    scored.sort((a, b) => a.from - b.from || a.cost - b.cost);
    return scored.slice(0, KEEP);
  });
  const addMemo = new Map<number, Layout | null>();
  const add = (L: Layout, k: number, j: number): Layout | null => {
    const key = (L.id * 512 + k) * 16 + j;
    let r = addMemo.get(key);
    if (r !== undefined) return r;
    const { slot } = best[k][j];
    const w = units[k].w;
    const d = new Map(L.dup);
    r = null;
    // Never within two columns of a column already doubled.
    const near = slot.some((x) => L.dup.some(([y]) => Math.min((((x - y) % w) + w) % w, (((y - x) % w) + w) % w) <= 2));
    if (!near) {
      for (const x of slot) d.set(x, (d.get(x) ?? 0) + 1);
      const vals = [...d.values()];
      if (vals.every((v) => v <= 2) && vals.reduce((a, b) => a + b, 0) <= CAP * slot.length) r = layoutOf([...d].sort((a, b) => a[0] - b[0]));
    }
    addMemo.set(key, r);
    return r;
  };
  const dev = (m: number, i: number) => {
    const x = (m - t.want(i)) / t.want(i);
    return x * x * (x < 0 ? 1.6 : 1);
  };

  interface Move {
    m: number;
    L: Layout;
    reps: number;
    kind: Step["kind"];
  }
  interface Best {
    cost: number;
    move?: Move;
    next?: number;
  }
  const memo = new Map<number, Best>();
  // One number for a state: its round, count, layout, repeats and rounds since an increase, in 47 bits.
  const keyOf = (i: number, c: number, L: Layout, reps: number, since: number) => (((i * 4096 + c) * 65536 + L.id) * 512 + reps) * 4 + since;

  const rec = (i: number, c: number, L: Layout, reps: number, since: number): Best => {
    const key = keyOf(i, c, L, reps, since);
    const hit = memo.get(key);
    if (hit) return hit;
    let res: Best;
    if (i === n) res = { cost: (reversed ? c <= t.to : c === t.to) ? 0 : Infinity };
    else {
      const k = unitAt[i];
      const u = units[k];
      const p = posAt[i];
      const last = i === n - 1;
      const want = t.want(i);
      const moves: Move[] = [];
      // The first round of a narrowing piece, reversed, is just above the cuff: a change here is worked below the piece, in a round before the rib.
      const fixed = reversed && i === 0;
      if (u.solid) {
        if (last && !reversed) {
          if (t.to >= c) moves.push({ m: t.to, L: none, reps: 0, kind: t.to > c ? "change" : "same" });
        } else {
          const lo = Math.max(c, 0.92 * want);
          const hi = Math.min(1.5 * c, 1.12 * want);
          let cands = new Set<number>([c]);
          for (let m = Math.ceil(lo); m <= hi; m += 2) cands.add(m);
          // Only counts the next unit can be knitted on unchanged are worth stopping at.
          const next = i + 1 < n ? units[unitAt[i + 1]] : undefined;
          if (next && !next.solid) {
            const widths = [next.w, ...best[unitAt[i + 1]].map((s) => next.w + s.slot.length), ...resizings[unitAt[i + 1]].map((v) => v.w)];
            cands = new Set([...cands].filter((m) => m === c || widths.some((w) => m % w === 0)));
            if (lo <= hi && cands.size === 1) cands.add(Math.ceil(lo / widths[0]) * widths[0]);
          }
          for (const m of cands) if (m >= c) moves.push({ m, L: none, reps: 0, kind: m > c ? "change" : "same" });
        }
      } else if (p === 0) {
        // A unit starts afresh: on a whole number of its repeat, perhaps with a slot doubled from its first round.
        const starts = [none, ...best[k].filter((s) => s.from === 0).map((s) => layoutOf(s.slot.map((x) => [x, 1])))];
        for (const L0 of starts) {
          const ww = u.w + L0.extra;
          const reps = new Set<number>();
          const lo = Math.max(c, 0.9 * want);
          const hi = Math.min(1.5 * c, 1.12 * want);
          for (let r = Math.ceil(lo / ww); r <= Math.floor(hi / ww); r++) reps.add(r);
          // Narrowing, a wide repeat may have to go on as few as it can.
          if (!reps.size || reversed) reps.add(Math.ceil(c / ww));
          if (c % ww === 0) reps.add(c / ww);
          for (const r of reps) if (r * ww >= c) moves.push({ m: r * ww, L: L0, reps: r, kind: r * ww > c ? "change" : "same" });
        }
        // Or, narrowing, on a narrowed or padded repeat, all the way down.
        for (const L0 of resizedLayouts[k]) {
          const ww = u.w + L0.extra;
          const lo = Math.max(c, 0.9 * want);
          const hi = Math.min(1.5 * c, 1.12 * want);
          const reps = new Set<number>([Math.ceil(c / ww)]);
          for (let r = Math.ceil(lo / ww); r <= Math.floor(hi / ww); r++) reps.add(r);
          for (const r of reps) if (r * ww >= c) moves.push({ m: r * ww, L: L0, reps: r, kind: r * ww > c ? "change" : "same" });
        }
        // Or, narrowing, the band seamed: on its count, or near its target.
        if (reversed) for (const m of new Set([c, c + 1, c + 2, Math.round(want)])) if (m >= c) moves.push({ m, L: seamed, reps: 0, kind: m > c ? "change" : "same" });
      } else if (L.resized !== undefined) {
        moves.push({ m: c, L, reps, kind: "same" });
      } else if (L.seam) {
        // A seamed band narrows two stitches at a time, either side of its seam.
        moves.push({ m: c, L, reps: 0, kind: "same" });
        if (since >= 1) moves.push({ m: c + 2, L, reps: 0, kind: "change" });
      } else {
        moves.push({ m: c, L, reps, kind: "same" });
        // A unit that runs on round its repeat changes its layout only in its first pass, as knitted, so the rest line up with it: 2025's peerie and lower core with its upper core.
        // Narrowing, solved reversed, that pass is the last, and a change here is worked in the round below, which must be in it too.
        const lastPass = u.pass[u.pass.length - 1];
        const firstPass = reversed ? u.pass[p] === lastPass && u.pass[p - 1] === lastPass : u.pass[p] === 0;
        if (since >= 2 && firstPass) {
          best[k].forEach((s, j) => {
            if (p < s.from) return;
            const L1 = add(L, k, j);
            if (L1) moves.push({ m: reps * (u.w + L1.extra), L: L1, reps, kind: "double" });
          });
        }
      }
      res = { cost: Infinity };
      for (const mv of moves) {
        if (mv.m > 1.5 * c || (mv.m > c && mv.m > 1.125 * want && !last)) continue;
        // Narrowing, every round within the tolerance of its target; the round above the cuff may differ from it, worked in a round before the rib.
        if (reversed && !fixed && Math.abs(mv.m - want) > (t.tolerance ?? 0.1) * want) continue;
        let pen = dev(mv.m, i) + (mv.L.seam ? SEAM : 0) + (mv.L.resized !== undefined && p === 0 ? resizeCost(k, mv.L) : 0);
        if (fixed && mv.m > c) pen += 0.01;
        if (mv.m > c) pen += 0.0015;
        // Increase rounds close together crowd their make-ones: two rounds between them where the target allows.
        if (mv.m > c && since < 2) pen += 0.004 * (2 - since);
        if (mv.m > c && mv.kind === "change" && patterned(i)) pen += 0.002;
        if (!u.solid) {
          if (mv.kind === "double") pen += 0.0004 * (look(k, p, mv.L) - look(k, p, L));
          else if (p === 0 && mv.L.extra > 0 && mv.L.resized === undefined) pen += 0.0004 * look(k, 0, mv.L);
        }
        if (pen >= res.cost) continue;
        const nextSince = mv.m > c ? 0 : Math.min(3, since + 1);
        const sub = rec(i + 1, mv.m, mv.L, mv.reps, nextSince);
        if (pen + sub.cost < res.cost) res = { cost: pen + sub.cost, move: mv, next: keyOf(i + 1, mv.m, mv.L, mv.reps, nextSince) };
      }
    }
    memo.set(key, res);
    return res;
  };

  const root = rec(0, t.from, none, 0, 3);
  if (!Number.isFinite(root.cost)) throw new Error(`no way to shape ${n} rounds from ${t.from} to ${t.to}`);
  const steps: Step[] = [];
  for (let b: Best | undefined = root; b?.move; b = memo.get(b.next!)) {
    const { m, L, reps, kind } = b.move;
    const u = units[unitAt[steps.length]];
    const v = L.resized !== undefined ? resizings[unitAt[steps.length]][L.resized] : undefined;
    steps.push(
      u.solid
        ? { count: m, kind }
        : L.seam
          ? { count: m, kind, seam: true }
          : v
            ? { count: m, kind, map: v.maps[posAt[steps.length]], reps, resized: v.w - u.w }
            : { count: m, kind, map: mapOf(u.w, L.dup), reps },
    );
  }
  return steps;
};

/** The places in a repeat that are new: each copy of a column after those it had. */
export const added = (before: number[], after: number[]): Set<number> => {
  const fresh = new Set<number>();
  let i = 0;
  after.forEach((x, q) => (i < before.length && before[i] === x ? i++ : fresh.add(q)));
  return fresh;
};

/**
 * Where each round of a growing piece makes its new stitches, as places in
 * the round it leaves. A doubled column's are its new copies, in every
 * repeat; a change of count's are spread evenly - in a round of one yarn,
 * turned to fall as far as they can from the increases of the few rounds
 * above, the round just above counting most, so they never line up into a
 * seam.
 */
export const increasesOf = (steps: Step[], from: number): number[][] => {
  const LOOK = 4;
  const history: number[][] = [];
  let prev = from;
  let before: number[] | undefined;
  return steps.map((s) => {
    const m = s.count;
    const k = m - prev;
    let at: number[] = [];
    if (s.kind === "double" && before && s.map && s.reps) {
      const fresh = [...added(before, s.map)];
      at = Array.from({ length: s.reps }, (_, r) => fresh.map((q) => r * s.map!.length + q)).flat();
    } else if (k > 0 && !s.map) {
      const g = m / k;
      let bestScore = -Infinity;
      for (let o = 0; o < Math.max(1, Math.ceil(g)); o++) {
        const pos = [...new Set(Array.from({ length: k }, (_, j) => Math.floor(o + j * g) % m))].sort((a, b) => a - b);
        if (pos.length !== k) continue;
        let score = Infinity;
        history.slice(-LOOK).reverse().forEach((h, t) => {
          for (const a of h) for (const p of pos) {
            const d = Math.abs(p / m - a) % 1;
            score = Math.min(score, Math.min(d, 1 - d) * m * (1 + 0.6 * t));
          }
        });
        if (score > bestScore) [bestScore, at] = [score, pos];
      }
    } else if (k > 0) at = [...new Set(Array.from({ length: k }, (_, j) => Math.floor(((j + 0.5) * m) / k)))];
    history.push(at.map((p) => p / m));
    prev = m;
    before = s.map;
    return at;
  });
};

/** A piece that grows from the top down, the yoke: each round's count and layout. */
export const growing = (rows: Row[], t: Target): Step[] => search(rows, t, false);

/**
 * A piece that narrows from the top down, a sleeve: each round's count and
 * layout, seamless band by band where it can be. `t.from` is the count it
 * starts from and `t.to` its cuff's; its last round may be on more, taken in a
 * round before the rib, but never fewer. `t.want(i)` is round i's target,
 * from the top.
 */
export const narrowing = (rows: Row[], t: Target): Step[] => {
  const n = rows.length;
  const steps = search([...rows].reverse(), { from: t.to, to: t.from, want: (i) => t.want(n - 1 - i), tolerance: t.tolerance }, true).reverse();
  // Reversed, a change was the round above's: it's worked in the round below, from the count above to its own.
  return steps.map((s, i) => ({ ...s, kind: i === 0 ? (s.count !== t.from ? "change" : "same") : steps[i - 1].kind }));
};
