import { type ChartScene, emphasis } from "./chart-scene";
import { rowsWithin } from "./column-window";
import { type Palette, inkOn, yarnFor } from "./palette";
import type { MarkerLine, MarkerRow } from "./view";

/**
 * The chart painted a piece at a time, onto a canvas.
 *
 * A tile of the chart as it comes into view, or the part of it a change has
 * touched, is painted on its own: the region is clipped, and only the rows
 * and stitches that reach into it are visited. So a frame of scrolling costs
 * what is on screen, whatever the size of the sweater, where the chart drawn
 * whole as vectors costs the whole chart every time anything about it changes.
 *
 * Nothing here assumes a column is where its layout put it. Each column's
 * left edge and width come in with the state, so the same painting serves a
 * chart with every column showing and one with the columns no row on screen
 * has a stitch in closed up; see column-window. A closed column has no width
 * and nothing in it is painted.
 *
 * The layers are those ChartSvg draws, in its order: the yarns, the rules
 * between cells, the marks, the veil over work done, the hatching of rows
 * worked from the other side, what is on hold, the steps' marks - a join, a
 * hold, a turn, a change of needles - and the round numbers. The stitch to be
 * worked next is not painted: it moves with every stitch, so it is an outline
 * laid over the chart rather than something to repaint.
 */

/** As much of a canvas's drawing as the chart uses, so a test can stand in for one. */
export type Ctx2D = Pick<
  CanvasRenderingContext2D,
  | "fillStyle"
  | "strokeStyle"
  | "lineWidth"
  | "lineCap"
  | "lineJoin"
  | "globalAlpha"
  | "font"
  | "textAlign"
  | "textBaseline"
  | "save"
  | "restore"
  | "beginPath"
  | "moveTo"
  | "lineTo"
  | "rect"
  | "arc"
  | "closePath"
  | "fill"
  | "stroke"
  | "fillRect"
  | "fillText"
  | "clip"
  | "setLineDash"
>;

/** The chart's colours, read from the stylesheet so a canvas matches the page round it. */
export interface ChartColours {
  /** Behind the stitches, where the chart has none. */
  ground: string;
  /** The page: the veil over work done, and the wash over what is on hold. */
  paper: string;
  ink: string;
  /** The round numbers. */
  faint: string;
  /** The hairlines between cells, and the heavier lines every fifth. */
  rule: string;
  heavy: string;
  /** Where one piece meets another, and the steps drawn in ink: a change of needles, a hold. */
  piece: string;
  /** A stitch marker's way ahead, and the round it is reached in next. */
  marker: string;
  font: string;
}

export const defaultColours: ChartColours = {
  ground: "#f3f1ef",
  paper: "#eae7e4",
  ink: "#1f1d1b",
  faint: "#66605a",
  rule: "rgba(0, 0, 0, 0.22)",
  heavy: "rgba(0, 0, 0, 0.7)",
  piece: "#1d1a17",
  marker: "#bb2c43",
  font: '"Source Sans 3", "Source Sans Pro", system-ui, sans-serif',
};

/**
 * Something drawn over the chart, such as a heat map of the knitter's pace:
 * a tint over some stitches, and a strip beside some rounds' numbers.
 */
export interface ChartOverlay {
  tint?: (id: number) => { fill: string; alpha: number } | undefined;
  /** By round, from 1. */
  strips?: { round: number; fill: string }[];
}

/** Room to the right of the chart for the round numbers: as wide as three figures, however small a stitch. */
export const gutter = (cell: number) => Math.max(Math.round(cell * 2.2), 22);

/** Room kept to the left of the chart, for the join's arrow to reach into. On the right, the gutter has room for it. */
export const leftMargin = (cell: number) => Math.ceil(cell * 0.5);

export interface PaintState {
  cell: number;
  /**
   * Each column's left edge across the chart and its width, in pixels: a
   * cell, or none for a column closed up. Column 0 and the one past the
   * last stand for the chart's right and left edges.
   */
  left: Float64Array;
  width: Float64Array;
  /**
   * Each row's top edge down the chart and its height: a cell, or none for a
   * row closed up. Row 0 and the one past the last stand for the chart's
   * bottom and top edges.
   */
  top: Float64Array;
  height: Float64Array;
  /** The yarns, as they are to be shown: all white for high contrast. */
  palette: Palette;
  /** For high contrast: each yarn's number, written in every cell. */
  yarnLabels?: Record<string, string>;
  progress: number;
  /** Rows, first and last, worked with the other side towards you: hatched. */
  hatch: [number, number][];
  /** The regions on hold, each a set of stitch ids: washed over and crosshatched. */
  onHold: Set<number>[];
  overlay?: ChartOverlay;
  colours: ChartColours;
  /** Device pixels to a CSS pixel, so the rules land on whole device pixels. */
  ratio: number;
}

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

const joinArrowLength = 0.42;
/**
 * Zoomed out, a stitch too small for its symbol, its hairlines or the
 * steps' marks to read is painted as its colour alone, in pixels: smaller
 * than this, in CSS pixels, has no symbol, no hairlines and no steps drawn.
 */
const detailed = 6;
/** And smaller than this, not even every fifth line heavy: there are too many to tell apart. */
const ruled = 3;
/** Round numbers no closer than this, in pixels, so that zoomed out they never run into one another. */
const numberSpacing = 16;
/** A cell squeezed narrower than this, opening or closing, is painted without its mark. */
const markable = 0.6;
/** Hatching: one line every six pixels, at forty-five degrees, as the SVG's pattern draws it. */
const hatchStep = 6 * Math.SQRT2;

/** The stitches of a row that reach into a stretch across the chart: their places in the index, first and past last. */
const within = (scene: ChartScene, state: PaintState, row: number, from: number, to: number): [number, number] => {
  const { start, column } = scene.index;
  const { left, width } = state;
  // Columns rise along the row and run leftwards, so both edges fall as the place does.
  const first = (test: (k: number) => boolean) => {
    let low = start[row];
    let high = start[row + 1];
    while (low < high) {
      const middle = (low + high) >> 1;
      if (test(middle)) high = middle;
      else low = middle + 1;
    }
    return low;
  };
  const begin = first((k) => left[column[k]] < to);
  const end = first((k) => left[column[k]] + width[column[k]] <= from);
  return [begin, Math.max(begin, end)];
};

/** Runs of stitches side by side on screen in a row: [left, right] edges, right to left. */
const runsIn = (
  scene: ChartScene,
  state: PaintState,
  span: [number, number],
  keep: (id: number, k: number) => boolean = () => true,
): [number, number][] => {
  const { column, id } = scene.index;
  const { left, width } = state;
  const out: [number, number][] = [];
  for (let k = span[0]; k < span[1]; k++) {
    const c = column[k];
    if (width[c] <= 0 || !keep(id[k], k)) continue;
    const open = out[out.length - 1];
    if (open && Math.abs(open[0] - (left[c] + width[c])) < 1e-6) open[0] = left[c];
    else out.push([left[c], left[c] + width[c]]);
  }
  return out;
};

const merged = (spans: [number, number][]): [number, number][] => {
  const out: [number, number][] = [];
  for (const span of [...spans].sort((a, b) => a[0] - b[0])) {
    const open = out[out.length - 1];
    if (open && span[0] <= open[1] + 1e-6) open[1] = Math.max(open[1], span[1]);
    else out.push([span[0], span[1]]);
  }
  return out;
};

/**
 * Of the rows to be numbered, those whose numbers stand clear of one another
 * in a font `size` pixels tall, whose figures stand three quarters of that:
 * the rows named for what happens there first - the instructions say them -
 * then every fifth, each left out where it would run into one kept already.
 * Worked out over the whole chart, so that every tile keeps the same.
 */
const clearOfEachOther = (rows: number[], top: (row: number) => number, height: Float64Array, size: number): number[] => {
  const kept: number[] = [];
  const at: number[] = [];
  const order = [...rows.filter((row) => row % emphasis !== 0), ...rows.filter((row) => row % emphasis === 0)];
  for (const row of order) {
    if (height[row] <= 0) continue;
    const y = top(row) + height[row] / 2;
    if (at.some((other) => Math.abs(other - y) < size * 0.75)) continue;
    kept.push(row);
    at.push(y);
  }
  return kept;
};

/**
 * Which of its three tenses a marker line is drawn in along the `k`th row of
 * its route, at `progress`: see the markers below. Along most rows it is the
 * marker reached in that row, now while it is the next to be reached. A
 * marker at the start of the round stands beside each row's first stitch,
 * where it was passed in beginning that row's round: now while that round is
 * worked, been once the next is begun, or at the end, once it comes `off`.
 */
const markerTense = (line: Pick<MarkerLine, "route" | "atStart" | "off">, k: number, progress: number): "been" | "now" | "ahead" => {
  const { route } = line;
  const at = route[k];
  if (line.atStart) {
    if (progress < at.passed) return "ahead";
    const next = route[k + 1];
    // Behind you once the next round is begun: said outright where the rows that follow are not the rounds that do (see view's farEdge).
    const done = at.upTo !== undefined ? progress >= at.upTo : next ? progress >= next.passed : line.off !== undefined && progress >= line.off;
    return done ? "been" : "now";
  }
  if (progress >= at.passed) return "been";
  const reached = k > 0 ? progress >= route[k - 1].passed : progress >= at.start - 1;
  return reached ? "now" : "ahead";
};

/**
 * The rows whose marker lines are drawn differently at progress `from` and
 * at `to`: a line's tense along a row turns on stitches worked in the row
 * below it, and its bars on the steps placing and taking it off, so working
 * stitches changes more rows than the stitches' own. With the rows either
 * side, for what is drawn along a row's edge.
 */
export const markerRowsChanging = (scene: ChartScene, from: number, to: number): number[] => {
  const rows: number[] = [];
  const both = (row: number) => rows.push(row - 1, row, row + 1);
  for (const line of scene.markers) {
    const { route } = line;
    route.forEach((at, k) => {
      if (markerTense(line, k, from) === markerTense(line, k, to)) return;
      both(at.row);
      if (k > 0) both(route[k - 1].row);
    });
    const [first, last] = [route[0], route[route.length - 1]];
    if (!first || !last) continue;
    if (from >= line.placed !== to >= line.placed) both(first.row);
    const off = line.off ?? last.passed;
    if (from >= off !== to >= off) both(last.row);
  }
  return rows;
};

export const paintRegion = (ctx: Ctx2D, region: Region, scene: ChartScene, state: PaintState) => {
  const { layout, index } = scene;
  const { cell, left, width, colours, height } = state;
  const rows = layout.rows;
  const columns = layout.columns;
  const snap = (v: number) => Math.round(v * state.ratio) / state.ratio;
  const top = (row: number) => state.top[row];

  ctx.save();
  ctx.beginPath();
  ctx.rect(region.x, region.y, region.width, region.height);
  ctx.clip();
  ctx.fillStyle = colours.ground;
  ctx.fillRect(region.x, region.y, region.width, region.height);

  // A row and a cell beyond each side, for what reaches past its own cell: a hold's bar, a turn's hook, a fork.
  const [firstRow, lastRow] = rowsWithin(state.top, height, rows, region.y - cell, region.y + region.height + cell);
  const from = region.x - cell;
  const to = region.x + region.width + cell;
  const spans = new Map<number, [number, number]>();
  // A row closed up has nothing to paint.
  const spanOf = (row: number): [number, number] => {
    if (row < 1 || row > rows || height[row] <= 0) return [0, 0];
    let span = spans.get(row);
    if (!span) spans.set(row, (span = within(scene, state, row, from, to)));
    return span;
  };
  const visit = (each: (k: number, row: number) => void) => {
    for (let row = firstRow; row <= lastRow; row++) {
      const [begin, end] = spanOf(row);
      for (let k = begin; k < end; k++) if (width[index.column[k]] > 0) each(k, row);
    }
  };

  /* The yarns: a run of one along a row is one rectangle. */
  const fills = new Map<string, number[]>();
  for (let row = firstRow; row <= lastRow; row++) {
    const [begin, end] = spanOf(row);
    let colour = "";
    let runLeft = 0;
    let runRight = 0;
    const flush = () => {
      if (!colour) return;
      let list = fills.get(colour);
      if (!list) fills.set(colour, (list = []));
      // On whole device pixels, so that cells a pixel or two wide meet without a seam of ground between them.
      const [x0, x1, y0, y1] = [snap(runLeft), snap(runRight), snap(top(row)), snap(top(row) + height[row])];
      list.push(x0, y0, x1 - x0, y1 - y0);
    };
    for (let k = begin; k < end; k++) {
      const c = index.column[k];
      if (width[c] <= 0) continue;
      const hex = yarnFor(state.palette, scene.slots[scene.slotAt[k]]).hex;
      if (hex === colour && Math.abs(runLeft - (left[c] + width[c])) < 1e-6) {
        runLeft = left[c];
        continue;
      }
      flush();
      colour = hex;
      runLeft = left[c];
      runRight = left[c] + width[c];
    }
    flush();
  }
  fills.forEach((list, colour) => {
    ctx.fillStyle = colour;
    for (let i = 0; i < list.length; i += 4) ctx.fillRect(list[i], list[i + 1], list[i + 2], list[i + 3]);
  });

  /*
   * The rules between cells, a path each for the hairlines and the heavy
   * lines, so a crossing is drawn once. A boundary between rows has a rule
   * wherever there is fabric on either side of it. A rule is heavy every
   * fifth column or row of the chart's grid, and only between two side by
   * side on the chart as well as on screen: a closed gap between two that
   * show is no boundary of the grid's.
   */
  const light: number[] = [];
  const heavy: number[] = [];
  const line = (into: number[], x: number, y: number, w: number, h: number) => into.push(x, y, w, h);
  const across = (into: number[], x0: number, x1: number, y: number) => {
    const y0 = snap(y - 0.5);
    line(into, x0, y0, x1 - x0, Math.max(snap(y + 0.5) - y0, 1 / state.ratio));
  };
  const down = (into: number[], x: number, y: number, h: number) => {
    const x0 = snap(x - 0.5);
    line(into, x0, y, Math.max(snap(x + 0.5) - x0, 1 / state.ratio), h);
  };
  // The next row up that shows, past any closed up: the one a row meets on screen.
  const aboveOf = (row: number) => {
    let up = row + 1;
    while (up <= rows && height[up] <= 0) up++;
    return up;
  };
  /** Whether a row has a stitch in a column. */
  const stitchIn = (row: number, c: number) => {
    const { start, column } = index;
    let low = start[row];
    let high = start[row + 1];
    while (low < high) {
      const middle = (low + high) >> 1;
      if (column[middle] < c) low = middle + 1;
      else high = middle;
    }
    return low < start[row + 1] && column[low] === c;
  };
  for (let row = firstRow - 1; row <= lastRow; row++) {
    if (row > 0 && height[row] <= 0) continue;
    const y = top(row);
    if (y < region.y - 1 || y > region.y + region.height + 1) continue;
    const up = aboveOf(row);
    const both = merged([...runsIn(scene, state, spanOf(row)), ...runsIn(scene, state, spanOf(up))]);
    const fifth = row > 0 && row % emphasis === 0 && up === row + 1;
    if (cell < (fifth ? ruled : detailed)) continue;
    for (const [x0, x1] of both) across(fifth ? heavy : light, x0, x1, y);
  }
  const showing = (c: number) => c === columns + 1 || width[c] > 0;
  for (let row = firstRow; row <= lastRow; row++) {
    const [begin, end] = spanOf(row);
    const y = top(row);
    let previous = -1;
    for (let k = begin; k < end; k++) {
      const c = index.column[k];
      if (width[c] <= 0) continue;
      const touching = previous >= 0 && Math.abs(left[previous] - (left[c] + width[c])) < 1e-6;
      if (!touching) {
        // The edge on the stitch-1 side of a run: heavy if the column to its right shows and is a fifth.
        const right = c - 1;
        const fifth = right >= 1 && right % emphasis === 0 && width[right] > 0;
        if (cell >= (fifth ? ruled : detailed)) down(fifth ? heavy : light, left[c] + width[c], y, height[row]);
      }
      // And the left edge of every stitch, against the next one along on screen.
      const next = k + 1 < end ? index.column[k + 1] : -1;
      const nextTouches = next >= 0 && width[next] > 0 && Math.abs(left[c] - (left[next] + width[next])) < 1e-6;
      const fifth = c % emphasis === 0 && (nextTouches ? next === c + 1 : showing(c + 1));
      if (cell >= (fifth ? ruled : detailed)) down(fifth ? heavy : light, left[c], y, height[row]);
      previous = c;
    }
  }
  const fillRects = (list: number[], colour: string) => {
    if (list.length === 0) return;
    ctx.fillStyle = colour;
    ctx.beginPath();
    for (let i = 0; i < list.length; i += 4) ctx.rect(list[i], list[i + 1], list[i + 2], list[i + 3]);
    ctx.fill();
  };
  fillRects(light, colours.rule);
  fillRects(heavy, colours.heavy);

  /*
   * A short row's turned stitch - a German short row's double stitch, pulled
   * up over the needle by its two legs - is drawn the height of two rows:
   * its own, and the row above, where nothing stands over it because the
   * row back begins beside it. One cell across both, its yarn over the rule
   * between them, outlined as one; its mark stays in its own row, and the
   * turn's hook still goes from it up into the row above.
   */
  const doubles: { x: number; y: number; w: number; h: number; split: number; id: number }[] = [];
  for (const turn of cell >= detailed ? scene.turns : []) {
    const row = scene.rowOf[turn.last];
    const c = scene.columnOf[turn.last];
    if (!row || height[row] <= 0 || width[c] <= 0) continue;
    const up = aboveOf(row);
    if (up > rows || height[up] <= 0 || stitchIn(up, c)) continue;
    const [x0, x1] = [snap(left[c]), snap(left[c] + width[c])];
    const [y0, y1] = [snap(top(up)), snap(top(row) + height[row])];
    if (x1 <= region.x || x0 >= region.x + region.width || y1 <= region.y || y0 >= region.y + region.height) continue;
    doubles.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, split: snap(top(row)), id: turn.last });
  }
  for (const one of doubles) {
    ctx.fillStyle = yarnFor(state.palette, scene.stitches[one.id]?.slot ?? "").hex;
    ctx.fillRect(one.x, one.y, one.w, one.h);
    if (cell < detailed) continue;
    const hair = 1 / state.ratio;
    fillRects([one.x, one.y, one.w, hair, one.x, one.y + one.h - hair, one.w, hair, one.x, one.y, hair, one.h, one.x + one.w - hair, one.y, hair, one.h], colours.rule);
  }

  /* Where one piece meets another: beside each other on screen in a row, and one over the other in a column. */
  const pieceLines: number[] = [];
  // Half a piece line's width: two and a half pixels across, or less where a stitch is hardly wider, but never under a device pixel.
  const halfPiece = Math.max(0.5 / state.ratio, Math.min(1.25, cell * 0.15));
  const pieceAbove = (row: number, c: number): number | undefined => {
    const up = aboveOf(row);
    if (up > rows) return undefined;
    const { start, column } = index;
    let low = start[up];
    let high = start[up + 1];
    while (low < high) {
      const middle = (low + high) >> 1;
      if (column[middle] < c) low = middle + 1;
      else high = middle;
    }
    return low < start[up + 1] && column[low] === c ? scene.pieceAt[low] : undefined;
  };
  visit((k, row) => {
    const c = index.column[k];
    const next = index.column[k + 1];
    const y = top(row);
    if (
      k + 1 < index.start[row + 1] &&
      width[next] > 0 &&
      Math.abs(left[c] - (left[next] + width[next])) < 1e-6 &&
      scene.pieceAt[k + 1] !== scene.pieceAt[k]
    ) {
      pieceLines.push(snap(left[c] - halfPiece), y, Math.max(1 / state.ratio, snap(left[c] + halfPiece) - snap(left[c] - halfPiece)), height[row]);
    }
    const above = pieceAbove(row, c);
    if (above !== undefined && above !== scene.pieceAt[k]) {
      pieceLines.push(left[c], snap(y - halfPiece), width[c], Math.max(1 / state.ratio, snap(y + halfPiece) - snap(y - halfPiece)));
    }
  });
  fillRects(pieceLines, colours.piece);

  /*
   * The marks, a path for each ink, each on a halo so it reads on any yarn.
   * A fork can reach several columns from its own stitch, so the stitches
   * either side of the region are looked at as far as any fork reaches, for
   * forks alone.
   */
  const centre = (c: number) => left[c] + width[c] / 2;
  const inks = new Map<string, { strokes: number[][]; dots: number[] }>();
  const reach = scene.forkReach * cell;
  const marked = (each: (k: number, row: number) => void) => {
    for (let row = firstRow; row <= lastRow; row++) {
      const [begin, end] = spanOf(row);
      const [wideBegin, wideEnd] = reach > cell ? within(scene, state, row, from - reach, to + reach) : [begin, end];
      for (let k = wideBegin; k < wideEnd; k++) {
        if (width[index.column[k]] <= 0) continue;
        if ((k < begin || k >= end) && !scene.forkAt[k]) continue;
        each(k, row);
      }
    }
  };
  marked((k, row) => {
    const c = index.column[k];
    if (cell < detailed || width[c] < cell * markable || height[row] < cell * markable) return;
    const id = index.id[k];
    const mark = scene.markOf(id, centre, cell);
    if (!mark) return;
    const ink = inkOn(yarnFor(state.palette, scene.slots[scene.slotAt[k]]).hex);
    let group = inks.get(ink);
    if (!group) inks.set(ink, (group = { strokes: [], dots: [] }));
    const x = left[c];
    const y = top(row);
    const w = width[c];
    const h = height[row];
    for (const stroke of mark.strokes ?? []) group.strokes.push(stroke.flatMap(([px, py]) => [x + px * w, y + py * h]));
    if (mark.dot) group.dots.push(x + mark.dot.x * w, y + mark.dot.y * h, mark.dot.r * cell);
  });
  inks.forEach((group, ink) => {
    if (group.strokes.length > 0) {
      ctx.beginPath();
      for (const points of group.strokes) {
        ctx.moveTo(points[0], points[1]);
        for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = ink === "#ffffff" ? "rgba(0, 0, 0, 0.45)" : "rgba(255, 255, 255, 0.75)";
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    if (group.dots.length > 0) {
      ctx.fillStyle = ink;
      ctx.beginPath();
      for (let i = 0; i < group.dots.length; i += 3) {
        ctx.moveTo(group.dots[i] + group.dots[i + 2], group.dots[i + 1]);
        ctx.arc(group.dots[i], group.dots[i + 1], group.dots[i + 2], 0, Math.PI * 2);
      }
      ctx.fill();
    }
  });

  /* High contrast: each yarn's number in its cells. */
  if (state.yarnLabels) {
    ctx.fillStyle = "#000";
    ctx.font = `9px ${colours.font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    visit((k, row) => {
      const label = state.yarnLabels![scene.slots[scene.slotAt[k]]];
      if (label && height[row] >= cell * markable) ctx.fillText(label, left[index.column[k]] + 2, top(row) + 9);
    });
  }

  /* The veil over work done: the stitches worked so far, a rectangle to a run of them along a row. */
  const regionOf = (keep: (id: number) => boolean) => {
    const out: number[] = [];
    for (let row = firstRow; row <= lastRow; row++) {
      // On whole device pixels, as the yarns are, so that a wash laid over neither overlaps itself nor leaves a seam.
      const [y0, y1] = [snap(top(row)), snap(top(row) + height[row])];
      for (const [x0, x1] of runsIn(scene, state, spanOf(row), keep)) out.push(snap(x0), y0, snap(x1) - snap(x0), y1 - y0);
    }
    return out;
  };
  const veil = regionOf((id) => id <= state.progress);
  // A turned stitch worked: its part in the row above with it.
  for (const one of doubles) if (one.id <= state.progress) veil.push(one.x, one.y, one.w, one.split - one.y);
  if (veil.length > 0) {
    ctx.globalAlpha = 0.62;
    fillRects(veil, colours.paper);
    ctx.globalAlpha = 1;
  }

  /*
   * Where the chart is torn (see breaks): the two stitches either side, not
   * worked one after the other, each have their facing edge pinked, two
   * teeth a row, as if cut apart with what was between them taken out.
   */
  if (scene.breaks.length > 0 && cell >= detailed) {
    const depth = Math.max(2, cell * 0.18);
    // Each tooth: the edge it is cut into, which way into the stitch, and the stretch of the row it spans.
    const cuts: { x: number; into: number; y: number; span: number }[] = [];
    for (const one of scene.breaks) {
      if (width[one.right] <= 0 || width[one.left] <= 0) continue;
      // The facing edges: the left of the stitch on the right, the right of the one on the left.
      const [onRight, onLeft] = [left[one.right], left[one.left] + width[one.left]];
      if (Math.max(onRight, onLeft) < region.x - depth || Math.min(onRight, onLeft) > region.x + region.width + depth) continue;
      for (let row = Math.max(one.from, firstRow); row <= Math.min(one.to, lastRow); row++) {
        const h = height[row];
        for (let y = top(row); y < top(row) + h - 0.5; y += h / 2) {
          cuts.push({ x: onRight, into: depth, y, span: h / 2 }, { x: onLeft, into: -depth, y, span: h / 2 });
        }
      }
    }
    if (cuts.length > 0) {
      const teeth = () => {
        for (const { x, into, y, span } of cuts) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + into, y + span / 2);
          ctx.lineTo(x, y + span);
        }
      };
      ctx.beginPath();
      teeth();
      ctx.fillStyle = colours.ground;
      ctx.fill();
      ctx.beginPath();
      teeth();
      ctx.strokeStyle = colours.faint;
      ctx.lineWidth = 1;
      ctx.lineJoin = "miter";
      ctx.stroke();
    }
  }

  /* Diagonal lines over a region, at the SVG pattern's spacing, from the chart's corner so tiles meet. */
  const diagonals = (rects: number[], up: boolean, down: boolean, lineWidth: number, alpha: number) => {
    if (rects.length === 0) return;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < rects.length; i += 4) ctx.rect(rects[i], rects[i + 1], rects[i + 2], rects[i + 3]);
    ctx.clip();
    ctx.beginPath();
    const x0 = region.x;
    const x1 = region.x + region.width;
    const y0 = region.y;
    const y1 = region.y + region.height;
    // x + y = constant: rising to the right, as the pattern's lines turned forty-five degrees do.
    if (up) {
      for (let s = Math.floor((x0 + y0) / hatchStep) * hatchStep; s <= x1 + y1; s += hatchStep) {
        ctx.moveTo(s - y0, y0);
        ctx.lineTo(s - y1, y1);
      }
    }
    // y - x = constant: the crosshatch's other way.
    if (down) {
      for (let s = Math.floor((y0 - x1) / hatchStep) * hatchStep; s <= y1 - x0; s += hatchStep) {
        ctx.moveTo(y0 - s, y0);
        ctx.lineTo(y1 - s, y1);
      }
    }
    ctx.strokeStyle = colours.ink;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "butt";
    ctx.stroke();
    ctx.restore();
  };

  /* Rows worked with the other side towards you, hatched across the whole width of the chart. */
  const hatched: number[] = [];
  for (const [first, last] of state.hatch) {
    if (last < firstRow || first > lastRow) continue;
    const span = top(first) + height[first] - top(last);
    if (span > 0) hatched.push(0, top(last), left[0], span);
  }
  diagonals(hatched, true, false, 0.75, 0.2);

  /* What is on hold: washed over, and crosshatched both ways, a region at a time. */
  for (const held of state.onHold) {
    const rects = regionOf((id) => held.has(id));
    if (rects.length === 0) continue;
    ctx.globalAlpha = 0.45;
    fillRects(rects, colours.paper);
    ctx.globalAlpha = 1;
    diagonals(rects, true, true, 0.6, 0.28);
  }

  /* The steps, drawn where they fall between stitches. */
  // Where a step's stitch is drawn: nowhere, if its row is closed up.
  const at = (id: number) => {
    const row = scene.rowOf[id];
    if (!row || height[row] <= 0) return undefined;
    const c = scene.columnOf[id];
    return { x: left[c], y: top(row), w: width[c], h: height[row], row };
  };
  const strokeIn = (draw: () => void, colour: string, lineWidth: number) => {
    ctx.beginPath();
    draw();
    ctx.strokeStyle = colour;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };

  // The join: the round going on past its last stitch, and coming back in at the first of the next.
  if (scene.join && cell >= detailed) {
    const last = at(scene.join.last);
    const first = at(scene.join.first);
    if (last && first) {
      const length = cell * joinArrowLength;
      const head = cell * 0.18;
      const arrow = (x0: number, x1: number, y: number) => {
        const d = Math.sign(x1 - x0);
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.moveTo(x1 - d * head, y - head);
        ctx.lineTo(x1, y);
        ctx.lineTo(x1 - d * head, y + head);
      };
      const [out, into] = scene.joinWays;
      const leaveFrom = out < 0 ? last.x : last.x + last.w;
      const enterAt = into < 0 ? first.x + first.w : first.x;
      strokeIn(() => {
        arrow(leaveFrom, leaveFrom + out * length, last.y + last.h / 2);
        arrow(enterAt - into * length, enterAt, first.y + first.h / 2);
      }, colours.ink, 1.6);
    }
  }

  // A sleeve going on hold: a bar at the end of the stitch before, an arrow down it.
  const bars: { x: number; top: number; bottom: number }[] = [];
  for (const hold of cell >= detailed ? scene.holds : []) {
    const a = at(hold.before);
    const b = at(hold.after);
    if (!a || !b) continue;
    bars.push({ x: b.x < a.x ? a.x : a.x + a.w, top: a.y - a.h * 0.3, bottom: a.y + a.h * 0.88 });
  }
  if (bars.length > 0) {
    const head = cell * 0.2;
    const draw = () => {
      for (const bar of bars) {
        ctx.moveTo(bar.x, bar.top);
        ctx.lineTo(bar.x, bar.bottom);
        ctx.moveTo(bar.x - head, bar.bottom - head);
        ctx.lineTo(bar.x, bar.bottom);
        ctx.lineTo(bar.x + head, bar.bottom - head);
      }
    };
    strokeIn(draw, "#fff", 4.5);
    strokeIn(draw, colours.piece, 2);
  }

  /*
   * A stitch put on hold: a bracket over the top of its cell, open below,
   * which runs on across a run of them as the holder they go onto.
   */
  if (scene.held.length > 0 && cell >= detailed) {
    const drop = cell * 0.22;
    const draw = () => {
      for (const id of scene.held) {
        const a = at(id);
        if (!a || a.w <= 0) continue;
        const y = a.y + a.h * 0.14;
        ctx.moveTo(a.x + a.w * 0.12, y + drop);
        ctx.lineTo(a.x + a.w * 0.12, y);
        ctx.lineTo(a.x + a.w * 0.88, y);
        ctx.lineTo(a.x + a.w * 0.88, y + drop);
      }
    };
    strokeIn(draw, "#fff", 3.5);
    strokeIn(draw, colours.piece, 1.6);
  }

  // A short row's turn: a hook from its last stitch round into the row above.
  if (scene.turns.length > 0 && cell >= detailed) {
    const reach = cell * 0.38;
    const head = cell * 0.16;
    strokeIn(() => {
      for (const turn of scene.turns) {
        const last = at(turn.last);
        const before = at(turn.before);
        if (!last || !before) continue;
        const way = last.x < before.x ? -1 : 1;
        const edge = way < 0 ? last.x : last.x + last.w;
        const [y0, y1] = [last.y + last.h / 2, last.y - last.h / 2];
        ctx.moveTo(edge, y0);
        ctx.lineTo(edge + way * reach, y0);
        ctx.lineTo(edge + way * reach, y1);
        ctx.lineTo(edge, y1);
        ctx.moveTo(edge + way * head, y1 - head);
        ctx.lineTo(edge, y1);
        ctx.lineTo(edge + way * head, y1 + head);
      }
    }, colours.ink, 1.6);
  }

  // A change of needles: dashed across the piece that changes, on a pale line of its own.
  const needleSpans: { y: number; spans: [number, number][] }[] = [];
  for (const change of cell >= detailed ? scene.needleRules : []) {
    const y = top(change.after);
    if (y < region.y - 4 || y > region.y + region.height + 4) continue;
    const piece = scene.pieces.indexOf(change.piece);
    const ofPiece = (row: number) =>
      row < 1 || row > rows ? [] : runsIn(scene, state, spanOf(row), (_, k) => scene.pieceAt[k] === piece);
    needleSpans.push({ y, spans: merged([...ofPiece(change.after), ...ofPiece(change.after + 1)]) });
  }
  if (needleSpans.length > 0) {
    const draw = () => {
      for (const { y, spans } of needleSpans) {
        for (const [x0, x1] of spans) {
          ctx.moveTo(x0, y);
          ctx.lineTo(x1, y);
        }
      }
    };
    ctx.beginPath();
    draw();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 4;
    ctx.lineCap = "butt";
    ctx.stroke();
    ctx.beginPath();
    draw();
    ctx.setLineDash([5, 3]);
    ctx.strokeStyle = colours.piece;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /*
   * A stitch marker, up the chart between two columns, row by row: grey ink
   * where it has been, a heavy stroke in the round it is reached in next,
   * dashes for the rounds still to come. A bar across where it is placed,
   * grey once it is, and another where it comes off, in the marker's colour
   * until it does. Where it steps across to stand by a make-one, it steps
   * along the top of the row below.
   */
  const near = (row: MarkerRow) => left[row.after] >= region.x - 4 && left[row.after] <= region.x + region.width + 4;
  const lines = scene.markers.filter((line) => line.route.some(near));
  if (lines.length > 0) {
    const been: number[] = [];
    const now: number[] = [];
    const ahead: number[] = [];
    const bars: { x: number; y: number; done: boolean }[] = [];
    for (const line of lines) {
      const { route } = line;
      route.forEach((at, k) => {
        const tense = markerTense(line, k, state.progress);
        const into = tense === "been" ? been : tense === "now" ? now : ahead;
        const x = snap(left[at.after]);
        if (k > 0 && route[k - 1].after !== at.after) {
          const y = top(route[k - 1].row);
          into.push(snap(left[route[k - 1].after]), y, x, y);
        }
        into.push(x, top(at.row) + height[at.row], x, top(at.row));
      });
      const [first, last] = [route[0], route[route.length - 1]];
      bars.push({ x: snap(left[first.after]), y: top(first.row) + height[first.row], done: state.progress >= line.placed });
      bars.push({ x: snap(left[last.after]), y: top(last.row), done: state.progress >= (line.off ?? last.passed) });
    }
    const reach = cell * 0.35;
    const segments = (list: number[]) => () => {
      for (let i = 0; i < list.length; i += 4) {
        ctx.moveTo(list[i], list[i + 1]);
        ctx.lineTo(list[i + 2], list[i + 3]);
      }
    };
    const across = (done: boolean) => () => {
      for (const bar of bars) {
        if (bar.done !== done) continue;
        ctx.moveTo(bar.x - reach, bar.y);
        ctx.lineTo(bar.x + reach, bar.y);
      }
    };
    // Zoomed out, every stroke thinner by as much as a stitch is smaller, but never under a device pixel.
    const fine = Math.min(1, cell / 8);
    const w = (pixels: number) => Math.max(1 / state.ratio, pixels * fine);
    const thick = w(Math.max(3, Math.min(5, cell * 0.22)));
    strokeIn(() => {
      segments(been)();
      segments(now)();
      segments(ahead)();
      across(true)();
      across(false)();
    }, "#fff", thick + w(2));
    ctx.globalAlpha = 0.45;
    strokeIn(segments(been), colours.ink, w(2));
    strokeIn(across(true), colours.ink, w(2.5));
    ctx.globalAlpha = 1;
    ctx.setLineDash([Math.max(2, cell * 0.28), Math.max(2, cell * 0.2)]);
    strokeIn(segments(ahead), colours.marker, w(2));
    ctx.setLineDash([]);
    strokeIn(segments(now), colours.marker, thick);
    strokeIn(across(false), colours.marker, w(2.5));
  }

  /* The round numbers down the right-hand edge, beside where column 1 ends. */
  const numbersAt = left[0] + Math.max(2, Math.round(cell * 0.45));
  if (numbersAt < region.x + region.width && numbersAt + gutter(cell) > region.x) {
    ctx.fillStyle = colours.faint;
    const size = Math.max(12, cell * 0.55);
    ctx.font = `${size}px ${colours.font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    /*
     * Every fifth row, and the rows named, while there is room between them;
     * zoomed out further, every tenth, or 25th, or 50th... only, as far apart
     * as leaves the numbers clear of one another.
     */
    const every = cell * emphasis >= numberSpacing ? 0 : ([10, 25, 50, 100, 250].find((n) => n * cell >= numberSpacing) ?? 500);
    if (every) {
      for (let row = Math.ceil(firstRow / every) * every; row <= lastRow; row += every) {
        if (height[row] > 0) ctx.fillText(String(row), numbersAt, top(row) + height[row] / 2);
      }
    } else {
      for (const row of clearOfEachOther(scene.numbered, top, height, size)) {
        if (row < firstRow || row > lastRow || height[row] < cell * markable) continue;
        ctx.fillText(String(row), numbersAt, top(row) + height[row] / 2);
      }
    }
  }

  /* And anything laid over the chart, last, as the overlay SVG was. */
  const overlay = state.overlay;
  if (overlay?.tint) {
    visit((k, row) => {
      const tint = overlay.tint!(index.id[k]);
      if (!tint) return;
      ctx.globalAlpha = tint.alpha;
      ctx.fillStyle = tint.fill;
      ctx.fillRect(left[index.column[k]], top(row), width[index.column[k]], height[row]);
    });
    ctx.globalAlpha = 1;
  }
  if (overlay?.strips) {
    const stripWidth = Math.max(3, Math.round(cell * 0.28));
    for (const strip of overlay.strips) {
      const row = layout.roundRows[strip.round - 1] ?? strip.round;
      if (row < firstRow || row > lastRow || height[row] <= 0) continue;
      ctx.fillStyle = strip.fill;
      ctx.fillRect(left[0] + 1 + scene.beside[strip.round - 1] * (stripWidth + 1), top(row), stripWidth, height[row]);
    }
  }

  ctx.restore();
};

/** Where every row is with every row showing, as the layout lays them out: row 1 at the bottom. */
export const laidOutRows = (rows: number, cell: number): { top: Float64Array; height: Float64Array } => {
  const top = new Float64Array(rows + 2);
  const height = new Float64Array(rows + 2);
  for (let row = 0; row <= rows + 1; row++) {
    top[row] = Math.max(0, rows - row) * cell;
    height[row] = row >= 1 && row <= rows ? cell : 0;
  }
  return { top, height };
};

/** Where every column is with every column showing, as the layout lays them out. */
export const laidOutPlaces = (columns: number, cell: number): { left: Float64Array; width: Float64Array } => {
  const left = new Float64Array(columns + 2);
  const width = new Float64Array(columns + 2);
  for (let c = 0; c <= columns + 1; c++) {
    left[c] = Math.max(0, columns - c) * cell;
    width[c] = c >= 1 && c <= columns ? cell : 0;
  }
  return { left, width };
};
