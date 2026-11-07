import traced from "./traced.json";
import model from "./model.json";

/**
 * The tunic's two felines, drawn as stitches at whatever size a jumper has
 * room for.
 *
 * Each feline is a vector model, traced vertex by vertex on a photograph of
 * the tunic and fitted to its edges (see model.json, in the photograph's
 * pixels): its body one polygon with its face a hole, its ears' whites
 * triangles, its eyes hexagon rings, its mouth and nose hexagons, its teeth a
 * zigzag, and its whiskers and claws lines. Drawn at a size:
 *
 * - The shapes are sampled: each stitch takes the colour covering most of it,
 *   and the cream where it covers a third, so a thin ring stays unbroken.
 * - The lines are drawn on the stitch grid itself, one stitch wide. A hand's
 *   four claws are its outermost as placed and three more alike, a whole
 *   number of stitches apart; a foot's five nest, a stitch of cream and one
 *   of red, out to the foot's top and back. Every claw stitch has red round
 *   it, as on the cloth.
 *
 * A stitch is wider than a row is tall, by the gauge, so a feline drawn
 * `width` stitches wide is that many times taller in rows than its picture is.
 */

export type Felines = typeof model;
export type FelineId = keyof Felines;
type Point = [number, number];

/** Codes in a feline's grid. */
export const GROUND = 0;
export const RED = 1;
export const CREAM = 2;

export interface Drawn {
  /** Rows top first as worn, each its stitches left to right as seen from the outside. */
  grid: number[][];
  width: number;
  height: number;
}

/** Samples across a stitch and down a row, for its coverage. */
const K = 8;

/** Which spans of a horizontal line at `y` are inside these polygons, by the even-odd rule. */
const crossings = (polys: Point[][], y: number): number[] => {
  const xs: number[] = [];
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      if ((y1 > y) !== (y2 > y)) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
    }
  }
  return xs.sort((a, b) => a - b);
};

const area = (poly: Point[]) => poly.reduce((s, [x, y], i) => s + x * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * y, 0) / 2;

/** A convex polygon moved out by `d` along every edge (in, for a negative `d`), its corners mitred. */
const offset = (poly: Point[], d: number): Point[] => {
  const sign = area(poly) > 0 ? -1 : 1;
  const lines = poly.map(([x1, y1], i) => {
    const [x2, y2] = poly[(i + 1) % poly.length];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len];
    const [nx, ny] = [-uy * sign, ux * sign];
    return { p: [x1 + nx * d, y1 + ny * d] as Point, u: [ux, uy] as Point };
  });
  return lines.map((l, i) => {
    const m = lines[(i + lines.length - 1) % lines.length];
    const det = m.u[0] * -l.u[1] - -l.u[0] * m.u[1];
    const t = ((l.p[0] - m.p[0]) * -l.u[1] - -l.u[0] * (l.p[1] - m.p[1])) / det;
    return [m.p[0] + m.u[0] * t, m.p[1] + m.u[1] * t];
  });
};

/** 8-connected cells along a line between two points in stitch coordinates. */
const cellsAlong = ([x1, y1]: Point, [x2, y2]: Point): Point[] => {
  const [a, b, c, d] = [x1 - 0.5, y1 - 0.5, x2 - 0.5, y2 - 0.5];
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(c - a), Math.abs(d - b))));
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) out.push([Math.round(a + ((c - a) * i) / n), Math.round(b + ((d - b) * i) / n)]);
  return out;
};

/**
 * A claw's stitches: one a row along its steep arms, every stitch along its
 * level runs - so nested claws stay a stitch apart.
 */
const rowwise = (line: Point[]): Point[] => {
  const out: Point[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const [x1, y1] = line[i];
    const [x2, y2] = line[i + 1];
    if (Math.abs(y2 - y1) >= 0.6 * Math.abs(x2 - x1) && Math.abs(y2 - y1) > 0.3) {
      const [ra, rb] = [Math.min(y1, y2), Math.max(y1, y2)];
      for (let r = Math.floor(ra); r <= Math.floor(rb); r++) {
        const yc = Math.min(Math.max(r + 0.5, ra), rb);
        out.push([Math.floor(x1 + ((yc - y1) / (y2 - y1)) * (x2 - x1)), r]);
      }
    } else {
      const r = Math.floor((y1 + y2) / 2);
      for (let c = Math.floor(Math.min(x1, x2)); c <= Math.floor(Math.max(x1, x2)); c++) out.push([c, r]);
    }
  }
  return out;
};

/** A line through the points, by least squares: the a and b of y = a x + b. */
const fitLine = (xs: number[], ys: number[]): [number, number] => {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  xs.forEach((x, i) => {
    sxy += (x - mx) * (ys[i] - my);
    sxx += (x - mx) ** 2;
  });
  const a = sxx ? sxy / sxx : 1;
  return [a, my - a * mx];
};

/**
 * A group of claws moved along one axis so their key points fall on whole
 * stitches (or rows), `pitch` apart, the outermost nearest where it was.
 */
const snapped = (claws: Point[][], axis: 0 | 1, key: number, pitch?: number): Point[][] => {
  const keys = claws.map((c) => c[key][axis]);
  const mean = (keys[keys.length - 1] - keys[0]) / (keys.length - 1);
  const p = Math.sign(mean) * (pitch ?? Math.max(1, Math.round(Math.abs(mean))));
  const start = Math.floor(keys[0]) + 0.5;
  const [a, b] = fitLine(keys, keys.map((_, i) => start + p * i));
  return claws.map((c) => c.map((pt) => (axis === 0 ? [a * pt[0] + b, pt[1]] : [pt[0], a * pt[1] + b]) as Point));
};

/**
 * A feline's claws drawn into its grid, in stitch coordinates. Hands: the
 * outermost chevron as placed, the rest the same, each a whole number of
 * stitches further in - at least three, so that they never run together -
 * and as many of the four as the hand has room for at that. Feet: each claw
 * the outermost as placed, moved in so they nest a stitch of cream and one of
 * red. Red round every claw stitch, then the claws in cream.
 */
const clawsInto = (grid: number[][], hands: Point[][][], feet: Point[][][]) => {
  const [height, width] = [grid.length, grid[0].length];
  const inside = (c: number, r: number) => c >= 0 && r >= 0 && c < width && r < height;
  const claw: boolean[][] = grid.map((row) => row.map(() => false));
  const mark = (cells: Point[]) => cells.forEach(([c, r]) => inside(c, r) && (claw[r][c] = true));

  // Hands: the outermost chevron as placed, the rest the same, each a whole number of stitches further in - at least
  // three, so that they never run together - and as many of the four as the hand has room for at that.
  hands.forEach((hand, h) => {
    const inward = h === 0 ? 1 : -1;
    const claws = snapped(hand, 0, 1).sort((a, b) => (a[1][0] - b[1][0]) * inward);
    const first = rowwise(claws[0]);
    const tips = claws.map((c) => c[1][0]);
    const pitch = Math.max(3, Math.round(Math.abs((tips[tips.length - 1] - tips[0]) / (tips.length - 1))));
    const across = (cells: Point[]) => Math.max(...cells.map(([c]) => c * inward)) - Math.min(...cells.map(([c]) => c * inward));
    const room = across(claws.flatMap(rowwise));
    let n = claws.length;
    while (n > 1 && (n - 1) * pitch + across(first) > room + 1) n--;
    for (let i = 0; i < n; i++) mark(first.map(([c, r]) => [c + inward * pitch * i, r]));
  });

  // Feet: each claw the outermost as placed, moved in - its steep arms two stitches a claw towards the back of the
  // foot, its level run two rows a claw up - so they nest a stitch of cream and one of red, as many as the foot has.
  feet.forEach((foot) => {
    const claws = snapped(foot, 1, 2, 2);
    const [top, tip, corner, back] = claws[0];
    const inward = Math.sign(back[0] - tip[0]) || 1;
    const steep = rowwise([top, tip, corner]);
    const cornerRow = Math.floor(corner[1]);
    const topRow = Math.floor(top[1]);
    const backCol = Math.floor(back[0]);
    for (let i = 0; i < claws.length; i++) {
      const level = cornerRow - 2 * i;
      if (level <= topRow) break;
      // Its steep arms, above its level run.
      const arms = steep.filter(([, r]) => r < level).map(([c, r]): Point => [c + inward * 2 * i, r]);
      mark(arms);
      // Its level run, from where its arms come down to the back of the foot.
      const lowest = arms.filter(([, r]) => r === level - 1).map(([c]) => c);
      const from = lowest.length ? (inward > 0 ? Math.max(...lowest) : Math.min(...lowest)) : Math.floor(corner[0]) + inward * 2 * i;
      for (let c = from; inward > 0 ? c <= backCol : c >= backCol; c += inward) mark([[c, level]]);
    }
  });

  // Red round every claw stitch, then the claws in cream.
  for (let r = 0; r < height; r++)
    for (let c = 0; c < width; c++) {
      if (!claw[r][c]) continue;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) if (inside(c + dc, r + dr) && grid[r + dr][c + dc] === GROUND) grid[r + dr][c + dc] = RED;
    }
  for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) if (claw[r][c]) grid[r][c] = CREAM;

};

/** A feline `width` stitches wide, as stitches; or, `sizeOnly`, only how tall it is. */
export const drawFeline = (id: FelineId, width: number, gauge: { stitches: number; rounds: number }, sizeOnly = false): Drawn => {
  const f = model[id];
  const [x0, y0, x1, y1] = f.box;
  const sx = width / (x1 - x0);
  const sy = (sx * gauge.rounds) / gauge.stitches;
  const height = Math.round((y1 - y0) * sy);
  if (sizeOnly) return { grid: [], width, height };
  const W = width * K;
  const H = height * K;
  const samples = new Uint8Array(W * H);
  const pts = (poly: number[][]) => poly as Point[];

  // The shapes, painted in order as the model draws them.
  const layers: [Point[][], number][] = [
    [[pts(f.body), pts(f.face)], RED],
    [f.ears.map(pts), CREAM],
    ...f.eyes.map((e): [Point[][], number] => [[offset(pts(e.ring), e.width / 2), offset(pts(e.ring), -e.width / 2)], CREAM]),
    [[pts(f.mouth)], CREAM],
    [[pts(f.nose)], RED],
  ];
  for (let j = 0; j < H; j++) {
    const y = y0 + (j + 0.5) / (K * sy);
    for (const [polys, colour] of layers) {
      const xs = crossings(polys, y);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const from = Math.max(0, Math.ceil((xs[k] - x0) * sx * K - 0.5));
        const to = Math.min(W - 1, Math.floor((xs[k + 1] - x0) * sx * K - 0.5));
        for (let i = from; i <= to; i++) samples[j * W + i] = colour;
      }
    }
  }
  const grid: number[][] = [];
  for (let r = 0; r < height; r++) {
    const row: number[] = [];
    for (let c = 0; c < width; c++) {
      const n = [0, 0, 0];
      for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) n[samples[(r * K + j) * W + c * K + i]]++;
      const most = n.indexOf(Math.max(...n));
      row.push(n[CREAM] >= 0.34 * K * K ? CREAM : most);
    }
    grid.push(row);
  }

  // The lines, in stitch coordinates: x across in stitches, y down in rows.
  const st = (p: number[]): Point => [(p[0] - x0) * sx, (p[1] - y0) * sy];
  const inside = (c: number, r: number) => c >= 0 && r >= 0 && c < width && r < height;
  clawsInto(grid, f.hands.map((hand) => hand.map((c) => c.map(st))), f.feet.map((foot) => foot.map((c) => c.map(st))));

  // Whiskers, one stitch wide, in red.
  const draw = (line: Point[], colour: number) => {
    for (let i = 0; i + 1 < line.length; i++) cellsAlong(line[i], line[i + 1]).forEach(([c, r]) => inside(c, r) && (grid[r][c] = colour));
  };
  f.whiskers.forEach((w) => draw(w.map(st), RED));
  // Teeth: a zigzag inside the mouth, a row from peak to trough, in the face's ground or in red as the feline's are.
  const teeth = f.teeth.line.map(st);
  const cy = teeth.reduce((s, p) => s + p[1], 0) / teeth.length;
  draw(teeth.map(([x], i) => [x, cy + (i % 2 ? 0.5 : -0.5)] as Point), f.teeth.yarn === "red" ? RED : GROUND);

  return { grid, width, height };
};



type Traced = typeof traced;

/** How much of each stitch these polygons cover, by the even-odd rule: a share for every stitch, rows top first. */
const coverage = (polys: Point[][], box: number[], sx: number, sy: number, width: number, height: number): number[][] => {
  const out = Array.from({ length: height }, () => Array<number>(width).fill(0));
  for (let j = 0; j < height * K; j++) {
    const xs = crossings(polys, box[1] + (j + 0.5) / (K * sy));
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.ceil((xs[k] - box[0]) * sx * K - 0.5));
      const to = Math.min(width * K - 1, Math.floor((xs[k + 1] - box[0]) * sx * K - 0.5));
      for (let i = from; i <= to; i++) out[Math.floor(j / K)][Math.floor(i / K)] += 1 / (K * K);
    }
  }
  return out;
};

/**
 * EXPERIMENT: a feline from the tracings (traced.json), `width` stitches
 * wide. Its shapes are sampled as the model's are - each stitch the colour
 * covering most of it, cream where it covers a third - the face's darker tan
 * knitted in the ground. Its whiskers and teeth are thinner than a stitch,
 * so a stitch takes them where they cover a quarter of it. Its claws are
 * drawn as the model's are, along the middle of each traced claw.
 */
export const drawTraced = (id: keyof Traced, width: number, gauge: { stitches: number; rounds: number }, sizeOnly = false): Drawn => {
  const f = traced[id];
  const box = f.box;
  const sx = width / (box[2] - box[0]);
  const sy = (sx * gauge.rounds) / gauge.stitches;
  const height = Math.round((box[3] - box[1]) * sy);
  if (sizeOnly) return { grid: [], width, height };
  const pts = (poly: number[][]) => poly as Point[];
  const layers: [Point[][], number][] = [
    [[pts(f.body), pts(f.face)], RED],
    [f.ears.map(pts), CREAM],
    ...f.eyes.flatMap((e): [Point[][], number][] => [
      [[pts(e.outer)], CREAM],
      [[pts(e.inner)], e.pupil === "red" ? RED : GROUND],
    ]),
    [[pts(f.nose)], RED],
    [[pts(f.mouth)], CREAM],
  ];
  const W = width * K;
  const samples = new Uint8Array(W * height * K);
  for (let j = 0; j < height * K; j++) {
    const y = box[1] + (j + 0.5) / (K * sy);
    for (const [polys, colour] of layers) {
      const xs = crossings(polys, y);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const from = Math.max(0, Math.ceil((xs[k] - box[0]) * sx * K - 0.5));
        const to = Math.min(W - 1, Math.floor((xs[k + 1] - box[0]) * sx * K - 0.5));
        for (let i = from; i <= to; i++) samples[j * W + i] = colour;
      }
    }
  }
  const grid: number[][] = [];
  for (let r = 0; r < height; r++) {
    const row: number[] = [];
    for (let c = 0; c < width; c++) {
      const n = [0, 0, 0];
      for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) n[samples[(r * K + j) * W + c * K + i]]++;
      const most = n.indexOf(Math.max(...n));
      row.push(n[CREAM] >= 0.34 * K * K ? CREAM : most);
    }
    grid.push(row);
  }
  // The whiskers and the teeth, thinner than a stitch.
  const thin = (polys: number[][][], colour: number, share: number) =>
    coverage(polys.map(pts), box, sx, sy, width, height).forEach((row, r) => row.forEach((v, c) => v >= share && (grid[r][c] = colour)));
  f.whiskers.forEach((w) => thin([w], RED, 0.25));
  thin([f.teeth.polygon], f.teeth.yarn === "red" ? RED : GROUND, 0.25);
  // The claws, along the middle of each.
  const st = (p: number[]): Point => [(p[0] - box[0]) * sx, (p[1] - box[1]) * sy];
  clawsInto(grid, f.hands.map((hand) => hand.map((c) => c.map(st))), f.feet.map((foot) => foot.map((c) => c.map(st))));
  return { grid, width, height };
};
