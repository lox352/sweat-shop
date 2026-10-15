import type { ChartScene } from "./chart-scene";
import { rowsShowing } from "./column-window";
import { type Palette, inkOn, yarnFor } from "./palette";

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

export interface PaintState {
  cell: number;
  /**
   * Each column's left edge across the chart and its width, in pixels: a
   * cell, or none for a column closed up. Column 0 and the one past the
   * last stand for the chart's right and left edges.
   */
  left: Float64Array;
  width: Float64Array;
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

/** Every fifth line is heavier, to count by. */
const emphasis = 5;
const joinArrowLength = 0.42;
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

export const paintRegion = (ctx: Ctx2D, region: Region, scene: ChartScene, state: PaintState) => {
  const { layout, index } = scene;
  const { cell, left, width, colours } = state;
  const rows = layout.rows;
  const columns = layout.columns;
  const snap = (v: number) => Math.round(v * state.ratio) / state.ratio;
  const top = (row: number) => (rows - row) * cell;

  ctx.save();
  ctx.beginPath();
  ctx.rect(region.x, region.y, region.width, region.height);
  ctx.clip();
  ctx.fillStyle = colours.ground;
  ctx.fillRect(region.x, region.y, region.width, region.height);

  // A row and a cell beyond each side, for what reaches past its own cell: a hold's bar, a turn's hook, a fork.
  const [firstRow, lastRow] = rowsShowing(rows, cell, region.y - cell, region.height + 2 * cell);
  const from = region.x - cell;
  const to = region.x + region.width + cell;
  const spans = new Map<number, [number, number]>();
  const spanOf = (row: number): [number, number] => {
    if (row < 1 || row > rows) return [0, 0];
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
      list.push(runLeft, top(row), runRight - runLeft);
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
    for (let i = 0; i < list.length; i += 3) ctx.fillRect(list[i], list[i + 1], list[i + 2], cell);
  });

  /*
   * The rules between cells, a path each for the hairlines and the heavy
   * lines, so a crossing is drawn once. A boundary between rows has a rule
   * wherever there is fabric on either side of it. Between columns, a rule is
   * heavy every fifth column of the chart's grid, and only between two
   * columns side by side on the chart as well as on screen: a closed gap
   * between two showing columns is no boundary of the grid's.
   */
  const light: number[] = [];
  const heavy: number[] = [];
  const line = (into: number[], x: number, y: number, w: number, h: number) => into.push(x, y, w, h);
  const across = (into: number[], x0: number, x1: number, y: number) => {
    const y0 = snap(y - 0.5);
    line(into, x0, y0, x1 - x0, Math.max(snap(y + 0.5) - y0, 1 / state.ratio));
  };
  const down = (into: number[], x: number, y: number) => {
    const x0 = snap(x - 0.5);
    line(into, x0, y, Math.max(snap(x + 0.5) - x0, 1 / state.ratio), cell);
  };
  for (let row = firstRow - 1; row <= lastRow; row++) {
    const y = top(row);
    if (y < region.y - 1 || y > region.y + region.height + 1) continue;
    const both = merged([...runsIn(scene, state, spanOf(row)), ...runsIn(scene, state, spanOf(row + 1))]);
    for (const [x0, x1] of both) across(row > 0 && row % emphasis === 0 ? heavy : light, x0, x1, y);
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
        down(right >= 1 && right % emphasis === 0 && width[right] > 0 ? heavy : light, left[c] + width[c], y);
      }
      // And the left edge of every stitch, against the next one along on screen.
      const next = k + 1 < end ? index.column[k + 1] : -1;
      const nextTouches = next >= 0 && width[next] > 0 && Math.abs(left[c] - (left[next] + width[next])) < 1e-6;
      const fifth = c % emphasis === 0 && (nextTouches ? next === c + 1 : showing(c + 1));
      down(fifth ? heavy : light, left[c], y);
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

  /* Where one piece meets another: beside each other on screen in a row, and one over the other in a column. */
  const pieceLines: number[] = [];
  const pieceAbove = (row: number, c: number): number | undefined => {
    if (row + 1 > rows) return undefined;
    const { start, column } = index;
    let low = start[row + 1];
    let high = start[row + 2];
    while (low < high) {
      const middle = (low + high) >> 1;
      if (column[middle] < c) low = middle + 1;
      else high = middle;
    }
    return low < start[row + 2] && column[low] === c ? scene.pieceAt[low] : undefined;
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
      pieceLines.push(snap(left[c] - 1.25), y, snap(left[c] + 1.25) - snap(left[c] - 1.25), cell);
    }
    const above = pieceAbove(row, c);
    if (above !== undefined && above !== scene.pieceAt[k]) {
      pieceLines.push(left[c], snap(y - 1.25), width[c], snap(y + 1.25) - snap(y - 1.25));
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
    if (width[c] < cell * markable) return;
    const id = index.id[k];
    const mark = scene.markOf(id, centre, cell);
    if (!mark) return;
    const ink = inkOn(yarnFor(state.palette, scene.slots[scene.slotAt[k]]).hex);
    let group = inks.get(ink);
    if (!group) inks.set(ink, (group = { strokes: [], dots: [] }));
    const x = left[c];
    const y = top(row);
    const w = width[c];
    for (const stroke of mark.strokes ?? []) group.strokes.push(stroke.flatMap(([px, py]) => [x + px * w, y + py * cell]));
    if (mark.dot) group.dots.push(x + mark.dot.x * w, y + mark.dot.y * cell, mark.dot.r * cell);
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
      if (label) ctx.fillText(label, left[index.column[k]] + 2, top(row) + 9);
    });
  }

  /* The veil over work done: the stitches worked so far, a rectangle to a run of them along a row. */
  const regionOf = (keep: (id: number) => boolean) => {
    const out: number[] = [];
    for (let row = firstRow; row <= lastRow; row++) {
      for (const [x0, x1] of runsIn(scene, state, spanOf(row), keep)) out.push(x0, top(row), x1 - x0, cell);
    }
    return out;
  };
  const veil = regionOf((id) => id <= state.progress);
  if (veil.length > 0) {
    ctx.globalAlpha = 0.62;
    fillRects(veil, colours.paper);
    ctx.globalAlpha = 1;
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
    hatched.push(0, top(last), left[0], (last - first + 1) * cell);
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
  const at = (id: number) => {
    const row = scene.rowOf[id];
    if (!row) return undefined;
    const c = scene.columnOf[id];
    return { x: left[c], y: top(row), w: width[c], row };
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
  if (scene.join) {
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
        arrow(leaveFrom, leaveFrom + out * length, last.y + cell / 2);
        arrow(enterAt - into * length, enterAt, first.y + cell / 2);
      }, colours.ink, 1.6);
    }
  }

  // A sleeve going on hold: a bar at the end of the stitch before, an arrow down it.
  const bars: { x: number; top: number; bottom: number }[] = [];
  for (const hold of scene.holds) {
    const a = at(hold.before);
    const b = at(hold.after);
    if (!a || !b) continue;
    bars.push({ x: b.x < a.x ? a.x : a.x + a.w, top: a.y - cell * 0.3, bottom: a.y + cell * 0.88 });
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

  // A short row's turn: a hook from its last stitch round into the row above.
  if (scene.turns.length > 0) {
    const reach = cell * 0.38;
    const head = cell * 0.16;
    strokeIn(() => {
      for (const turn of scene.turns) {
        const last = at(turn.last);
        const before = at(turn.before);
        if (!last || !before) continue;
        const way = last.x < before.x ? -1 : 1;
        const edge = way < 0 ? last.x : last.x + last.w;
        const [y0, y1] = [last.y + cell / 2, last.y - cell / 2];
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
  for (const change of scene.needleRules) {
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

  /* The round numbers down the right-hand edge, beside where column 1 ends. */
  const numbersAt = left[0] + Math.round(cell * 0.45);
  if (numbersAt < region.x + region.width && numbersAt + 4 * cell > region.x) {
    ctx.fillStyle = colours.faint;
    ctx.font = `${Math.max(12, cell * 0.55)}px ${colours.font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (const row of scene.numbered) {
      if (row < firstRow || row > lastRow) continue;
      ctx.fillText(String(row), numbersAt, top(row) + cell / 2);
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
      ctx.fillRect(left[index.column[k]], top(row), width[index.column[k]], cell);
    });
    ctx.globalAlpha = 1;
  }
  if (overlay?.strips) {
    const stripWidth = Math.max(3, Math.round(cell * 0.28));
    for (const strip of overlay.strips) {
      const row = layout.roundRows[strip.round - 1] ?? strip.round;
      if (row < firstRow || row > lastRow) continue;
      ctx.fillStyle = strip.fill;
      ctx.fillRect(left[0] + 1 + scene.beside[strip.round - 1] * (stripWidth + 1), top(row), stripWidth, cell);
    }
  }

  ctx.restore();
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
