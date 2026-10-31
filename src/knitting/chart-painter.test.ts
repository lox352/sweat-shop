import { describe, expect, it } from "vitest";
import { buildSweater } from "./engine";
import { layOut, layOutSweater } from "./layout";
import { numberedRows, sceneOf } from "./chart-scene";
import { type Ctx2D, type PaintState, defaultColours, laidOutPlaces, laidOutRows, markerRowsChanging, paintRegion } from "./chart-painter";
import { LiveColumns, mapOf, placeFrom } from "./column-window";
import { holdsIn, joinIn, needleChangesIn, turnsIn } from "./chart-marks";
import { raglanLine, testBandedSweater, testSweater, testSweaterWithMarkers } from "./test-sweater";
import { viewAt } from "./view";
import type { Palette } from "./palette";
import { isFabric } from "../types/Stitch";

/**
 * A stand-in for a canvas that keeps what is drawn: each filled rectangle
 * with the colour and alpha it was filled in, each path's points, and each
 * stroke, clipped to the region painted as a canvas would be.
 */
const recorder = () => {
  const rects: { x: number; y: number; w: number; h: number; fill: string; alpha: number; path: boolean }[] = [];
  const strokes: { points: number[][]; colour: string; width: number }[] = [];
  const texts: { text: string; x: number; y: number }[] = [];
  let path: { kind: "rect"; x: number; y: number; w: number; h: number }[] = [];
  let points: number[][] = [];
  let current: number[] = [];
  const state = { fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1 };
  const stack: (typeof state)[] = [];
  const ctx = {
    ...state,
    save() {
      stack.push({ fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth, globalAlpha: this.globalAlpha });
    },
    restore() {
      Object.assign(this, stack.pop());
    },
    beginPath() {
      path = [];
      points = [];
      current = [];
    },
    rect(x: number, y: number, w: number, h: number) {
      path.push({ kind: "rect", x, y, w, h });
    },
    moveTo(x: number, y: number) {
      current = [x, y];
      points.push(current);
    },
    lineTo(x: number, y: number) {
      current.push(x, y);
    },
    arc() {},
    closePath() {},
    clip() {},
    fill() {
      for (const one of path) rects.push({ x: one.x, y: one.y, w: one.w, h: one.h, fill: String(this.fillStyle), alpha: this.globalAlpha, path: true });
    },
    stroke() {
      strokes.push({ points: points.map((run) => [...run]), colour: String(this.strokeStyle), width: this.lineWidth });
    },
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h, fill: String(this.fillStyle), alpha: this.globalAlpha, path: false });
    },
    fillText(text: string, x: number, y: number) {
      texts.push({ text, x, y });
    },
    setLineDash() {},
    lineCap: "round",
    lineJoin: "round",
    font: "",
    textAlign: "left",
    textBaseline: "middle",
  };
  return { ctx: ctx as unknown as Ctx2D, rects, strokes, texts };
};

const palette: Palette = {
  MC: { name: "Main", hex: "#223344" },
  A: { name: "A", hex: "#aa0000" },
  B: { name: "B", hex: "#00aa00" },
} as unknown as Palette;

const cell = 10;
const yarns = new Set(["#223344", "#aa0000", "#00aa00"]);
const stateFor = (layout: { columns: number; rows: number }, extra: Partial<PaintState> = {}): PaintState => ({
  cell,
  ...laidOutPlaces(layout.columns, cell),
  ...laidOutRows(layout.rows, cell),
  palette,
  progress: 0,
  hatch: [],
  onHold: [],
  colours: defaultColours,
  ratio: 1,
  ...extra,
});

describe("the chart painted a piece at a time", () => {
  const built = buildSweater(testSweater, "one");
  const yoke = built.rounds.filter((_, index) => built.roundPieces[index] === "yoke");
  const layout = layOut(built.stitches, yoke);
  const scene = sceneOf(layout, built.stitches, yoke);
  const whole = { x: 0, y: 0, width: layout.columns * cell + 40, height: layout.rows * cell };

  it("veils the knitting done a rectangle to each unbroken run, as the vectors did", () => {
    // Under the yoke's make-ones the neck's stitches stand apart: the cast-on and half the first rib round, a rectangle each.
    const halfway = yoke[1][11];
    const veiled = (progress: number) => {
      const paint = recorder();
      paintRegion(paint.ctx, whole, scene, stateFor(layout, { progress }));
      return paint.rects.filter((one) => one.fill === defaultColours.paper && one.alpha === 0.62);
    };
    expect(veiled(0)).toHaveLength(0);
    expect(veiled(halfway)).toHaveLength(24 + 12);
    // And the round that fills the gaps in, side by side, is one.
    expect(veiled(yoke[3].at(-1)!)).toHaveLength(24 * 3 + 1);
  });

  it("fills a run of one yarn along a row as one rectangle, and every stitch somewhere", () => {
    const paint = recorder();
    paintRegion(paint.ctx, whole, scene, stateFor(layout));
    const yarn = paint.rects.filter((one) => !one.path && yarns.has(one.fill));
    const area = yarn.reduce((sum, one) => sum + one.w * one.h, 0);
    const drawn = yoke.flat().filter((id) => isFabric(built.stitches[id])).length;
    expect(area).toBe(drawn * cell * cell);
    // The widest rounds are one run each.
    expect(yarn.filter((one) => one.w === layout.columns * cell).length).toBeGreaterThan(0);
  });

  it("paints the same whether a region is painted at once or as four tiles", () => {
    const fills = (rects: ReturnType<typeof recorder>["rects"], region: { x: number; y: number; width: number; height: number }) =>
      rects
        .filter((one) => !one.path && one.fill.startsWith("#") && one.fill !== defaultColours.ground)
        .flatMap((one) => {
          // Clipped to the region, as a canvas would.
          const x0 = Math.max(one.x, region.x);
          const x1 = Math.min(one.x + one.w, region.x + region.width);
          const y0 = Math.max(one.y, region.y);
          const y1 = Math.min(one.y + one.h, region.y + region.height);
          const out: string[] = [];
          for (let x = x0; x < x1; x += cell / 2) for (let y = y0; y < y1; y += cell / 2) out.push(`${x}|${y}|${one.fill}`);
          return out;
        });
    const once = recorder();
    paintRegion(once.ctx, whole, scene, stateFor(layout));
    const tiles: string[] = [];
    const halfW = Math.ceil(whole.width / 2 / cell) * cell;
    const halfH = Math.ceil(whole.height / 2 / cell) * cell;
    for (const [x, y] of [[0, 0], [halfW, 0], [0, halfH], [halfW, halfH]]) {
      const region = { x, y, width: halfW, height: halfH };
      const paint = recorder();
      paintRegion(paint.ctx, region, scene, stateFor(layout));
      tiles.push(...fills(paint.rects, region));
    }
    expect(new Set(tiles)).toEqual(new Set(fills(once.rects, whole)));
  });
});

describe("the chart with its empty columns closed up", () => {
  const built = buildSweater(testSweater, "one");
  const layout = layOutSweater(built.stitches, built.rounds, built.roundKinds, built.roundPieces);
  const scene = sceneOf(layout, built.stitches, built.rounds);
  /** Where the columns go with rows first to last in view, closed up. */
  const closedUp = (first: number, last: number) => {
    const live = new LiveColumns(scene.index);
    live.moveTo(first, last);
    const map = mapOf(live);
    const left = placeFrom(map, map.order[0], 0, cell);
    const width = new Float64Array(left.length);
    for (let c = 1; c < width.length - 1; c++) width[c] = map.shows[c] ? cell : 0;
    return { map, left, width };
  };

  it("paints the neck's stitches side by side, with no gap between them", () => {
    const { map, left, width } = closedUp(1, 2);
    const paint = recorder();
    paintRegion(paint.ctx, { x: 0, y: (layout.rows - 2) * cell, width: map.count * cell, height: 2 * cell }, scene, stateFor(layout, { left, width }));
    const row1 = paint.rects.filter((one) => !one.path && yarns.has(one.fill) && one.y === (layout.rows - 1) * cell);
    // The cast-on: one run across every column showing.
    expect(row1).toEqual([expect.objectContaining({ x: 0, w: map.count * cell })]);
  });

  it("draws a heavy line only between two showing columns that are neighbours on the chart as well", () => {
    const { map, left, width } = closedUp(1, 2);
    const paint = recorder();
    paintRegion(paint.ctx, { x: 0, y: (layout.rows - 1) * cell, width: map.count * cell, height: cell }, scene, stateFor(layout, { left, width }));
    const heavyDown = paint.rects.filter((one) => one.fill === defaultColours.heavy && one.h === cell);
    for (const rule of heavyDown) {
      const x = rule.x + rule.w / 2;
      // The columns either side of it on screen.
      const leftOf = map.order[Math.round(x / cell) - 1];
      const rightOf = map.order[Math.round(x / cell)];
      if (leftOf !== undefined && rightOf !== undefined) {
        expect(leftOf).toBe(rightOf + 1);
        expect(rightOf % 5).toBe(0);
      }
    }
  });
});

describe("a fork across an increase's two loops, its columns closed up", () => {
  const built = buildSweater(testBandedSweater, "one");
  const layout = layOutSweater(built.stitches, built.rounds, built.roundKinds, built.roundPieces);
  const scene = sceneOf(layout, built.stitches, built.rounds, {
    join: joinIn(built.stitches, built.rounds),
    holds: holdsIn(built.stitches, built.rounds),
    turns: turnsIn(built.stitches, built.rounds),
  });

  it("reaches from over the stitch below to the middle of each loop, wherever they are drawn", () => {
    const raglan = built.roundLabels.lastIndexOf("Yoke · shaping round");
    const kfb = built.rounds[raglan].find((id) => built.stitches[id].type === "kfb")!;
    const row = scene.rowOf[kfb];
    // With only this row and the one below in view, the loops are side by side on screen.
    const live = new LiveColumns(scene.index);
    live.moveTo(row - 1, row);
    const map = mapOf(live);
    const left = placeFrom(map, map.order[0], 0, cell);
    const width = new Float64Array(left.length);
    for (let c = 1; c < width.length - 1; c++) width[c] = map.shows[c] ? cell : 0;
    const centre = (c: number) => left[c] + width[c] / 2;
    const mark = scene.markOf(kfb, centre, cell)!;
    const x = left[scene.columnOf[kfb]];
    const ends = mark.strokes!.map((stroke) => stroke.map(([px]) => x + px * cell));
    const parent = built.stitches[kfb].links[0];
    // From the middle of the stitch below, to the middle of its own cell and of its second loop's.
    expect(ends[0][0]).toBeCloseTo(centre(scene.columnOf[parent]));
    expect(ends.map((arm) => arm[1]).sort((a, b) => a - b)).toEqual(
      [centre(scene.columnOf[kfb]), centre(scene.columnOf[kfb + 1])].sort((a, b) => a - b),
    );
  });

  it("draws a fork in a region its arm reaches into, though the stitch it is drawn from is several columns off", () => {
    const fork = built.stitches.find(
      (stitch) => stitch.type === "kfb" && scene.rowOf[stitch.id] && Math.abs(scene.columnOf[stitch.id + 1] - scene.columnOf[stitch.id]) >= 3,
    )!;
    const state = stateFor(layout);
    const made = scene.columnOf[fork.id + 1];
    const y = (layout.rows - scene.rowOf[fork.id]) * cell;
    const paint = recorder();
    // Just the second loop's cell, its first loop's well outside it.
    paintRegion(paint.ctx, { x: state.left[made], y, width: cell, height: cell }, scene, state);
    const arms = paint.strokes.filter((one) => one.width === 1.2).flatMap((one) => one.points);
    expect(arms.some((run) => Math.abs(run[run.length - 2] - (state.left[made] + cell / 2)) < 1e-6)).toBe(true);
  });

  it("paints the steps where their stitches are: the join, the holds and the turns", () => {
    const paint = recorder();
    const whole = { x: 0, y: 0, width: layout.columns * cell + 40, height: layout.rows * cell };
    paintRegion(paint.ctx, whole, scene, stateFor(layout));
    const holds = paint.strokes.filter((one) => one.width === 2 && one.colour === defaultColours.piece);
    expect(holds).toHaveLength(1);
    expect(holds[0].points).toHaveLength(2 * 2);
    const inked = paint.strokes.filter((one) => one.width === 1.6);
    // The join's two arrows, and a hook for each turn.
    expect(inked.length).toBe(2);
  });

  it("paints a short row's turned stitch the height of two rows where nothing stands over it, its yarn across both", () => {
    const state = stateFor(layout);
    const empty = (row: number, column: number) =>
      ![...layout.cells.values()].some((at) => at.row === row && Math.round(at.column) === column);
    const tall = scene.turns.filter((turn) => empty(scene.rowOf[turn.last] + 1, scene.columnOf[turn.last]));
    const short = scene.turns.filter((turn) => !tall.includes(turn));
    expect(tall.length).toBeGreaterThan(0);
    const paint = recorder();
    paintRegion(paint.ctx, { x: 0, y: 0, width: layout.columns * cell + 40, height: layout.rows * cell }, scene, state);
    const filled = (turn: (typeof scene.turns)[number]) =>
      paint.rects.filter(
        (one) => !one.path && one.x === state.left[scene.columnOf[turn.last]] && one.w === cell && one.h === 2 * cell,
      );
    for (const turn of tall) {
      const [hit] = filled(turn);
      // From the top of the row above to the foot of its own.
      expect(hit?.y).toBe(state.top[scene.rowOf[turn.last] + 1]);
    }
    for (const turn of short) expect(filled(turn)).toEqual([]);
  });

  it("numbers every fifth row and each piece's first down the edge", () => {
    const paint = recorder();
    paintRegion(paint.ctx, { x: 0, y: 0, width: layout.columns * cell + 40, height: layout.rows * cell }, scene, stateFor(layout));
    expect(paint.texts.map((one) => Number(one.text)).sort((a, b) => a - b)).toEqual(scene.numbered);
  });
});

describe("the change of needles on the chart", () => {
  const built = buildSweater(testSweater, "one");
  const yoke = built.rounds.filter((_, index) => built.roundPieces[index] === "yoke");
  const layout = layOut(built.stitches, yoke);
  const changes = needleChangesIn(built.stitches, yoke).map((change) => ({ after: change.after, piece: "yoke" }));

  it("falls between the rib and the yoke", () => {
    expect(changes.map((change) => change.after)).toEqual([3]);
  });

  it("is dashed across that boundary", () => {
    const scene = sceneOf(layout, built.stitches, yoke, { needleRules: changes });
    const paint = recorder();
    paintRegion(paint.ctx, { x: 0, y: 0, width: layout.columns * cell + 40, height: layout.rows * cell }, scene, stateFor(layout));
    const y = (layout.rows - 3) * cell;
    const dashed = paint.strokes.filter((one) => one.width === 2 && one.colour === defaultColours.piece);
    expect(dashed.length).toBeGreaterThan(0);
    for (const one of dashed) for (const run of one.points) for (let k = 1; k < run.length; k += 2) expect(run[k]).toBe(y);
  });

  it("numbers both rounds it falls between, so it can be named", () => {
    const numbers = numberedRows(layout, changes);
    expect(numbers).toContain(3);
    expect(numbers).toContain(4);
    expect(numbers).toEqual([...new Set(numbers)].sort((a, b) => a - b));
  });
});

describe("the round numbers down the edge", () => {
  it("number the row every piece after the yoke begins in, the yoke's last plus one, as well as every fifth", () => {
    const built = buildSweater(testSweater, "one");
    const whole = layOutSweater(built.stitches, built.rounds, built.roundKinds, built.roundPieces);
    // A yoke of six rounds, the body's five above it and the sleeves' four beside them.
    expect(numberedRows(whole)).toEqual([1, 5, 7, 10, 11]);
  });
});

describe("the stitch markers on the chart", () => {
  const built = buildSweater(testSweaterWithMarkers(), "one");
  const { stitches, knitting } = built;
  const seam = layOutSweater(stitches, knitting.rounds, knitting.roundKinds, knitting.roundPieces);
  // Once the new beginning is placed, the chart turned to it, the raglan line with it.
  const view = viewAt(built, seam, stitches.length);
  const line = view.markers.find((one) => one.marker === raglanLine)!;
  const scene = sceneOf(view.layout, stitches, view.rounds, { markers: view.markers });
  const paintAt = (progress: number) => {
    const state = stateFor(view.layout, { progress });
    const paint = recorder();
    paintRegion(paint.ctx, { x: 0, y: 0, width: view.layout.columns * cell + 40, height: view.layout.rows * cell }, scene, state);
    const x = state.left[line.after];
    const rowOf = (row: number) => [x, state.top[row] + state.height[row], x, state.top[row]];
    const drawn = (colour: string, width: number) =>
      paint.strokes.filter((one) => one.colour === colour && one.width === width).flatMap((one) => one.points);
    return { rowOf, drawn, state, x };
  };

  it("draws each up the chart between two columns, a row at a time, through the rows it is on the needles", () => {
    expect(line.route.map((at) => at.row)).toEqual(Array.from({ length: line.to - line.from + 1 }, (_, k) => line.from + k));
    expect(new Set(line.route.map((at) => at.after))).toEqual(new Set([line.after]));
  });

  it("dashes the rows to come in the marker's colour, with a bar across where it is placed and where it comes off", () => {
    const { rowOf, drawn, state, x } = paintAt(0);
    const ahead = drawn(defaultColours.marker, 2);
    for (let row = line.from; row <= line.to; row++) expect(ahead).toContainEqual(rowOf(row));
    const bars = drawn(defaultColours.marker, 2.5);
    expect(bars).toContainEqual([x - cell * 0.35, state.top[line.from] + state.height[line.from], x + cell * 0.35, state.top[line.from] + state.height[line.from]]);
    expect(bars).toContainEqual([x - cell * 0.35, state.top[line.to], x + cell * 0.35, state.top[line.to]]);
  });

  it("draws the rows it has been through in grey ink, and the row it is reached in next heavier", () => {
    // Placed, and the knitting part way round the next row, short of the marker.
    const placedRow = line.route[0];
    const { rowOf, drawn } = paintAt(placedRow.passed);
    expect(drawn(defaultColours.ink, 2)).toContainEqual(rowOf(line.from));
    expect(drawn(defaultColours.marker, 3)).toContainEqual(rowOf(line.route[1].row));
    // Off the needles: every row it was on is in grey.
    const done = paintAt(stitches.length - 1);
    for (let row = line.from; row <= line.to; row++) expect(done.drawn(defaultColours.ink, 2)).toContainEqual(done.rowOf(row));
    expect(done.drawn(defaultColours.marker, 2)).toHaveLength(0);
  });

  it("draws a marker at the start of the round heavy beside the round being worked, which it was passed in beginning", () => {
    // The same line, as a start of the round's: beside each row's first stitch.
    const start = { ...line, atStart: true };
    const atStart = sceneOf(view.layout, stitches, view.rounds, { markers: [start] });
    const [first, second, third] = start.route;
    const paintStartAt = (progress: number) => {
      const state = stateFor(view.layout, { progress });
      const paint = recorder();
      paintRegion(paint.ctx, { x: 0, y: 0, width: view.layout.columns * cell + 40, height: view.layout.rows * cell }, atStart, state);
      const x = state.left[start.after];
      const rowOf = (row: number) => [x, state.top[row] + state.height[row], x, state.top[row]];
      const drawn = (colour: string, width: number) =>
        paint.strokes.filter((one) => one.colour === colour && one.width === width).flatMap((one) => one.points);
      return { rowOf, drawn };
    };
    // Into the second row's round: the knitting beside the marker there, the row below behind it, the rows above to come.
    const { rowOf, drawn } = paintStartAt(second.passed + 1);
    expect(drawn(defaultColours.marker, 3)).toEqual([rowOf(second.row)]);
    expect(drawn(defaultColours.ink, 2)).toContainEqual(rowOf(first.row));
    expect(drawn(defaultColours.marker, 2)).toContainEqual(rowOf(third.row));
    // Beginning the next round turns the row it is beside heavy instead.
    const changing = markerRowsChanging(atStart, third.passed - 1, third.passed);
    expect(changing).toContain(second.row);
    expect(changing).toContain(third.row);
    expect(paintStartAt(third.passed).drawn(defaultColours.marker, 3)).toEqual([rowOf(third.row)]);
  });

  it("draws a start of the round at the chart's other edge in the tenses its own rows say, bars and all", () => {
    // The same line, at the far edge: each row behind you once the stitch after the marker, its upTo, is worked.
    const [first, second] = line.route;
    const upTo = second.passed + 2;
    const edge = { ...line, atStart: true, edge: true, route: line.route.map((at, k) => (k === 1 ? { ...at, upTo } : at)) };
    const atEdge = sceneOf(view.layout, stitches, view.rounds, { markers: [edge] });
    const paintEdgeAt = (progress: number) => {
      const state = stateFor(view.layout, { progress });
      const paint = recorder();
      paintRegion(paint.ctx, { x: 0, y: 0, width: view.layout.columns * cell + 40, height: view.layout.rows * cell }, atEdge, state);
      const x = state.left[edge.after];
      const rowOf = (row: number) => [x, state.top[row] + state.height[row], x, state.top[row]];
      const drawn = (colour: string, width: number) =>
        paint.strokes.filter((one) => one.colour === colour && one.width === width).flatMap((one) => one.points);
      return { rowOf, drawn };
    };
    // Short of its upTo, the second row's stretch is heavy, the first behind; a bar across where it was placed.
    const short = paintEdgeAt(upTo - 1);
    expect(short.drawn(defaultColours.marker, 3)).toEqual([short.rowOf(second.row)]);
    expect(short.drawn(defaultColours.ink, 2)).toContainEqual(short.rowOf(first.row));
    expect(short.drawn(defaultColours.ink, 2.5)).not.toHaveLength(0);
    // At it, behind you, though the next round is not yet begun; and the change is said to touch that row.
    const reached = paintEdgeAt(upTo);
    expect(reached.drawn(defaultColours.ink, 2)).toContainEqual(reached.rowOf(second.row));
    expect(reached.drawn(defaultColours.marker, 3)).toEqual([]);
    expect(markerRowsChanging(atEdge, upTo - 1, upTo)).toContain(second.row);
  });

  it("says which rows working stitches changes the line in, beyond the stitches' own: the row it is reached in next", () => {
    const placedRow = line.route[0];
    const next = line.route[1];
    // Passing the marker in its first row turns the next row's stretch of line heavy, though no stitch there was worked.
    const changing = markerRowsChanging(scene, placedRow.passed - 1, placedRow.passed);
    expect(changing).toContain(next.row);
    expect(changing).toContain(placedRow.row);
    // Painted at either, the next row's stretch is drawn differently.
    const [before, after] = [paintAt(placedRow.passed - 1), paintAt(placedRow.passed)];
    expect(before.drawn(defaultColours.marker, 3)).not.toContainEqual(before.rowOf(next.row));
    expect(after.drawn(defaultColours.marker, 3)).toContainEqual(after.rowOf(next.row));
    // Working on where nothing about it changes, nothing does.
    expect(markerRowsChanging(scene, next.passed + 1, next.passed + 1)).toEqual([]);
  });
});

