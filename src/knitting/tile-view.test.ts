import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSweater } from "./engine";
import { layOutSweater } from "./layout";
import { sceneOf } from "./chart-scene";
import { defaultColours, gutter } from "./chart-painter";
import { LiveColumns, mapOf } from "./column-window";
import { TileView, type TileContent, tileSize, along, type Places } from "./tile-view";
import { testSweater } from "./test-sweater";
import type { Palette } from "./palette";

const built = buildSweater(testSweater, "one");
const layout = layOutSweater(built.stitches, built.rounds, built.roundKinds, built.roundPieces);
const scene = sceneOf(layout, built.stitches, built.rounds);
const palette = { A: { name: "A", hex: "#333333" }, B: { name: "B", hex: "#cccccc" } } as unknown as Palette;

/** A canvas context that only counts the tiles painted, by where each was painted from. */
let painted: string[] = [];
const context = () => {
  let at = "";
  return new Proxy(
    {},
    {
      get: (target: Record<string, unknown>, key: string) => {
        if (key === "setTransform") return (_a: number, _b: number, _c: number, _d: number, x: number, y: number) => (at = `${x}|${y}`);
        if (key === "restore") return () => painted.push(at);
        return key in target ? target[key] : () => {};
      },
      set: (target: Record<string, unknown>, key: string, value: unknown) => {
        target[key] = value;
        return true;
      },
    },
  );
};

const box = (width: number, height: number) => {
  const scroller = document.createElement("div");
  const sheet = document.createElement("div");
  const container = document.createElement("div");
  sheet.appendChild(container);
  scroller.appendChild(sheet);
  document.body.appendChild(scroller);
  Object.defineProperty(scroller, "clientWidth", { value: width });
  Object.defineProperty(scroller, "clientHeight", { value: height });
  Object.defineProperty(scroller, "scrollLeft", { value: 0, writable: true, configurable: true });
  Object.defineProperty(scroller, "scrollTop", { value: 0, writable: true, configurable: true });
  return { scroller, sheet, container };
};

// Kept the same between renders, as the chart's memos keep them: a new one is a change to repaint for.
const hatch: [number, number][] = [];
const onHold: Set<number>[] = [];
const content = (change: Partial<TileContent> = {}): TileContent => ({
  scene,
  cell: 40,
  palette,
  progress: 0,
  hatch,
  onHold,
  colours: defaultColours,
  margin: 0,
  ...change,
});

describe("the chart on tiles", () => {
  beforeEach(() => {
    painted = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => context() as unknown as CanvasRenderingContext2D);
    // The clock stopped, so painting never runs out of time for the tiles just out of view, however busy the machine.
    vi.spyOn(performance, "now").mockImplementation(() => 1000);
  });
  afterEach(() => vi.restoreAllMocks());

  it("paints the tiles in view and a little way past them, and no more", () => {
    const { scroller, sheet, container } = box(300, 200);
    const view = new TileView(container, scroller, sheet);
    view.show(content());
    const canvases = container.querySelectorAll("canvas");
    // 300 wide and 200 tall, and 128 past each edge: two tiles across and two down.
    expect(canvases.length).toBe(4);
    expect(new Set(painted).size).toBe(4);
    view.destroy();
    expect(container.querySelectorAll("canvas").length).toBe(0);
  });

  it("repaints only the tiles across a stitch's row when it is worked, and all of them for a zoom", () => {
    const { scroller, sheet, container } = box(300, 200);
    const view = new TileView(container, scroller, sheet);
    view.show(content());
    painted = [];
    // Nothing changed: nothing repainted.
    view.show(content());
    expect(painted).toEqual([]);
    // A stitch of the top row is worked: the tiles across that row's band, which is the top row of tiles.
    const top = scene.index.id[scene.index.start[layout.rows]];
    view.show(content({ progress: top - 1 }));
    painted = [];
    view.show(content({ progress: top }));
    expect(painted).toHaveLength(2);
    expect(painted.every((at) => at.endsWith("|0"))).toBe(true);
    painted = [];
    // A zoom changes the room left of the chart too: every tile is painted from the chart's new left edge.
    view.show(content({ progress: top, cell: 32, margin: 16 }));
    expect(painted.length).toBe(container.querySelectorAll("canvas").length);
    expect(new Set(painted.map((at) => Number(at.split("|")[0])))).toEqual(new Set([16, 16 - tileSize]));
    view.destroy();
  });

  it("follows the box as it scrolls, keeping the tiles it has painted", () => {
    const { scroller, sheet, container } = box(300, 200);
    const view = new TileView(container, scroller, sheet);
    view.show(content());
    painted = [];
    scroller.scrollLeft = tileSize;
    view.update();
    // A column of tiles comes into view; the rest were painted already.
    expect(painted.length).toBe(2);
    view.destroy();
  });
});

/**
 * A box the chart scrolls in, which keeps every scroll set on it by the view,
 * either way, and is scrolled by the knitter with `scrollTo`.
 */
const scrollingBox = (width: number, height: number) => {
  const { scroller, sheet, container } = box(width, height);
  Object.defineProperty(scroller, "offsetWidth", { value: width });
  Object.defineProperty(scroller, "offsetHeight", { value: height });
  const at = { left: 0, top: 0 };
  const writes: string[] = [];
  for (const side of ["left", "top"] as const) {
    Object.defineProperty(scroller, side === "left" ? "scrollLeft" : "scrollTop", {
      get: () => at[side],
      set: (value: number) => {
        writes.push(`${side} ${value}`);
        at[side] = value;
      },
    });
  }
  const scrollTo = (x: number, y: number) => {
    at.left = x;
    at.top = y;
    scroller.dispatchEvent(new Event("scroll"));
  };
  const touch = (type: string, fingers: number) => {
    const event = new Event(type);
    Object.defineProperty(event, "touches", { value: { length: fingers } });
    scroller.dispatchEvent(event);
  };
  return { scroller, sheet, container, writes, scrollTo, touch };
};

const sheetOf = (scroller: HTMLElement) => scroller.firstElementChild as HTMLElement;
const idsIn = (row: number) => Array.from(scene.index.id.subarray(scene.index.start[row], scene.index.start[row + 1]));

describe("the chart on tiles, closed up", () => {
  const { rows } = layout;
  const cell = 40;
  /** Wide enough for every column, so every row has a stitch on screen and none closes up: the rows' own tests are below. */
  const wide = 4000;
  // Five rows in view: the box `top` down the chart shows rows first to first + 4.
  const topFor = (first: number) => (rows - first - 4) * cell;
  let now = 0;

  beforeEach(() => {
    painted = [];
    now = 1000;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => context() as unknown as CanvasRenderingContext2D);
    vi.spyOn(performance, "now").mockImplementation(() => now);
    // Frames are run here, by hand.
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  /** The first step up the chart, a row at a time, that changes the columns showing. */
  const firstChange = () => {
    const live = new LiveColumns(scene.index);
    for (let first = 1; first + 5 <= rows; first++) {
      live.moveTo(first, first + 4);
      const before = mapOf(live);
      if (live.moveTo(first + 1, first + 5)) return { first, before, after: mapOf(live) };
    }
    throw new Error("no change");
  };

  /**
   * A stitch in a row in view before and after that step, with columns
   * opening or closing to its left, and another in its row that columns open
   * or close between.
   */
  const heldStitch = () => {
    const { first, before, after } = firstChange();
    const ids = idsIn(first + 2);
    const gap = (a: number, b: number, map: typeof before) => map.leftOf[scene.columnOf[a]] - map.leftOf[scene.columnOf[b]];
    const id = ids.find((id) => before.leftOf[scene.columnOf[id]] !== after.leftOf[scene.columnOf[id]]);
    const other = ids.find((other) => id !== undefined && gap(other, id, before) !== gap(other, id, after));
    if (id === undefined || other === undefined) throw new Error("nothing moves");
    return { first, id, other };
  };

  it("closes up the columns no row in view has a stitch in, the sheet as wide as the rest", () => {
    const { scroller, sheet, container, scrollTo } = scrollingBox(wide, 200);
    scrollTo(0, topFor(1));
    const view = new TileView(container, scroller, sheet);
    now += 200;
    view.show(content({ collapse: true }));
    expect(container.dataset.rowsShowing).toBe(String(rows));
    const live = new LiveColumns(scene.index);
    live.moveTo(1, 5);
    const showing = mapOf(live).count;
    expect(showing).toBeLessThan(layout.columns);
    expect(container.dataset.columns).toBe(String(layout.columns));
    expect(container.dataset.columnsShowing).toBe(String(showing));
    expect(sheet.style.width).toBe(`${showing * cell + gutter(cell)}px`);
    // The columns showing side by side, with a stitch of a row in view in each, every row's running leftwards.
    const xs = new Set<number>();
    for (let row = 1; row <= 5; row++) {
      const places = idsIn(row).map((id) => view.place(id)!.x);
      places.forEach((x, k) => k > 0 && expect(x).toBeLessThan(places[k - 1]));
      places.forEach((x) => xs.add(x));
    }
    expect([...xs].sort((a, b) => a - b)).toEqual(Array.from({ length: showing }, (_, k) => k * cell));
    view.destroy();
  });

  it("holds the stitch being worked still on screen as the columns ease to their new places", () => {
    const { first, id, other } = heldStitch();
    const { scroller, sheet, container, writes, scrollTo } = scrollingBox(wide, 200);
    const view = new TileView(container, scroller, sheet);
    view.show(content({ collapse: true, follow: id }));
    scrollTo(0, topFor(first));
    now += 200;
    view.update();
    const onScreen = () => view.place(id)!.x - scroller.scrollLeft;
    const held = onScreen();
    const from = view.place(other)!.x - scroller.scrollLeft;
    writes.length = 0;

    // A row further up the chart: the columns ease to their new places over the next frames.
    scrollTo(scroller.scrollLeft, topFor(first + 1));
    now += 16;
    view.update();
    expect(onScreen()).toBeCloseTo(held, 6);
    now += 75;
    view.update();
    expect(onScreen()).toBeCloseTo(held, 6);
    const midway = view.place(other)!.x - scroller.scrollLeft;
    now += 100;
    view.update();
    expect(onScreen()).toBeCloseTo(held, 6);
    const to = view.place(other)!.x - scroller.scrollLeft;
    expect(to).not.toBeCloseTo(from, 6);
    expect(Math.min(from, to) < midway && midway < Math.max(from, to)).toBe(true);

    // At rest, the layer goes back to the sheet's edge and the box is scrolled once to match: nothing moves.
    expect(writes).toHaveLength(1);
    expect(onScreen()).toBeCloseTo(held, 6);
    expect(view.place(other)!.x - scroller.scrollLeft).toBeCloseTo(to, 6);
    expect(container.querySelector<HTMLElement>(".chart-layer")!.style.transform).toBe("");
    view.destroy();
  });

  it("never sets the box's scroll while a finger is on it or it is still moving", () => {
    const { first, id } = heldStitch();
    const { scroller, sheet, container, writes, scrollTo, touch } = scrollingBox(wide, 200);
    const view = new TileView(container, scroller, sheet);
    view.show(content({ collapse: true, follow: id }));
    scrollTo(0, topFor(first));
    now += 200;
    view.update();
    const onScreen = () => view.place(id)!.x - scroller.scrollLeft;
    const held = onScreen();
    writes.length = 0;

    touch("touchstart", 1);
    scrollTo(scroller.scrollLeft, topFor(first + 1));
    for (let frame = 0; frame < 60; frame++) {
      now += 16;
      view.update();
    }
    // A second, finger down, and the columns long since moved: the layer has moved, the box has not.
    expect(writes).toEqual([]);
    expect(container.querySelector<HTMLElement>(".chart-layer")!.style.transform).not.toBe("");
    expect(onScreen()).toBeCloseTo(held, 6);
    // The finger lifts, and the box coasts for a moment.
    touch("touchend", 0);
    now += 100;
    view.update();
    expect(writes).toEqual([]);
    now += 100;
    view.update();
    expect(writes).toHaveLength(1);
    expect(onScreen()).toBeCloseTo(held, 6);
    view.destroy();
  });

  it("never carries the chart's right-hand edge into the box, whatever it holds still", () => {
    /*
     * A step up the chart that closes or opens columns between the chart's
     * right-hand edge and a stitch near it, which would be held still - and
     * the edge with it carried into the box, or out past it.
     */
    const live = new LiveColumns(scene.index);
    const narrow = 13 * cell + gutter(cell);
    let found: { first: number; id: number } | undefined;
    for (let first = 1; first + 5 <= rows && !found; first++) {
      live.moveTo(first, first + 4);
      const before = mapOf(live);
      if (!live.moveTo(first + 1, first + 5)) continue;
      const after = mapOf(live);
      const id = idsIn(first + 2).find((id) => {
        const column = scene.columnOf[id];
        const fromEdge = (map: typeof before) => map.count - map.leftOf[column];
        return fromEdge(before) !== fromEdge(after) && fromEdge(before) <= 10;
      });
      if (id !== undefined) found = { first, id };
    }
    if (!found) throw new Error("no step moves the edge against a stitch near it");
    const { first, id } = found;
    const { scroller, sheet, container, scrollTo } = scrollingBox(narrow, 200);
    const view = new TileView(container, scroller, sheet);
    view.show(content({ collapse: true, follow: id }));
    // At the chart's right-hand edge, the rows above `first` in view; then down a row, which closes the columns again.
    const toEdge = () => parseFloat(sheet.style.width) - narrow;
    scrollTo(toEdge(), topFor(first + 1));
    now += 200;
    view.update();
    scrollTo(toEdge(), topFor(first + 1));
    now += 200;
    view.update();
    const column1 = idsIn(first + 2).find((one) => scene.columnOf[one] === 1)!;
    const edge = () => view.place(column1)!.x + cell + gutter(cell);
    const boxRight = () => scroller.scrollLeft + narrow;
    expect(edge()).toBeCloseTo(boxRight(), 6);

    scrollTo(scroller.scrollLeft, topFor(first));
    for (let frame = 0; frame < 20; frame++) {
      now += 16;
      view.update();
      expect(edge(), `frame ${frame}`).toBeGreaterThanOrEqual(boxRight() - 1e-6);
    }
    view.destroy();
  });

  it("tells how far the stitch being scrolled to moves when keeping the edge out of the box moves it, for the scroll to follow", () => {
    const live = new LiveColumns(scene.index);
    const narrow = 13 * cell + gutter(cell);
    let found: { first: number; id: number } | undefined;
    for (let first = 1; first + 5 <= rows && !found; first++) {
      live.moveTo(first, first + 4);
      const before = mapOf(live);
      if (!live.moveTo(first + 1, first + 5)) continue;
      const after = mapOf(live);
      const id = idsIn(first + 2).find((id) => {
        const column = scene.columnOf[id];
        const fromEdge = (map: typeof before) => map.count - map.leftOf[column];
        return fromEdge(before) !== fromEdge(after) && fromEdge(before) <= 10;
      });
      if (id !== undefined) found = { first, id };
    }
    if (!found) throw new Error("no step moves the edge against a stitch near it");
    const { first, id } = found;
    const { scroller, sheet, container, scrollTo } = scrollingBox(narrow, 200);
    const view = new TileView(container, scroller, sheet);
    const told: number[] = [];
    view.onTargetMoved = (by) => told.push(by);
    view.show(content({ collapse: true }));
    const toEdge = () => parseFloat(sheet.style.width) - narrow;
    scrollTo(toEdge(), topFor(first + 1));
    now += 200;
    view.update();
    scrollTo(toEdge(), topFor(first + 1));
    now += 200;
    view.update();
    // Scrolling to the stitch, which the columns closing between it and the edge would carry the edge in with.
    // Where it is on screen: on the sheet, less the box's scroll, which coming to rest may set.
    const onScreen = () => view.place(id)!.x - scroller.scrollLeft;
    const was = onScreen();
    view.hold(id);
    scrollTo(scroller.scrollLeft, topFor(first));
    for (let frame = 0; frame < 20; frame++) {
      now += 16;
      view.update();
    }
    expect(told.length).toBeGreaterThan(0);
    expect(onScreen() - was).toBeCloseTo(told.reduce((sum, by) => sum + by, 0), 6);
    view.destroy();
  });

  it("scrolled across from the right, never sets the box's scroll across as columns close or open to the left of what it holds", () => {
    const { first } = heldStitch();
    const narrow = 13 * cell + gutter(cell);
    const { scroller, sheet, container, writes, scrollTo } = scrollingBox(narrow, 200);
    // As a box written right to left lays it out: the sheet against its right-hand edge, growing and shrinking leftwards.
    scroller.style.direction = "rtl";
    Object.defineProperty(sheet, "offsetLeft", { get: () => narrow - (parseFloat(sheet.style.width) || 0) });
    Object.defineProperty(scroller, "scrollWidth", { get: () => Math.max(narrow, parseFloat(sheet.style.width) || 0) });
    const view = new TileView(container, scroller, sheet);
    view.show(content({ collapse: true }));
    // At the right-hand edge, scrolled nought, the rows above `first` in view; then down a row and back, closing columns and opening them.
    scrollTo(0, topFor(first + 1));
    now += 200;
    view.update();
    const edge = () => {
      const column1 = idsIn(first + 2).find((one) => scene.columnOf[one] === 1)!;
      return sheet.offsetLeft + view.place(column1)!.x + cell + gutter(cell) - scroller.scrollLeft;
    };
    for (const to of [first, first + 1]) {
      writes.length = 0;
      scrollTo(0, topFor(to));
      for (let frame = 0; frame < 30; frame++) {
        now += 16;
        view.update();
        // The chart's right-hand edge at the box's, every frame.
        expect(edge(), `frame ${frame}`).toBeCloseTo(narrow, 6);
      }
      expect(container.querySelector<HTMLElement>(".chart-layer")!.style.transform).toBe("");
      expect(writes.filter((write) => write.startsWith("left"))).toEqual([]);
    }
    view.destroy();
  });

  it("scrolled across from the right, holds the chart's left-hand edge at the far left, and never leaves an edge out of reach while columns change", () => {
    const narrow = 6 * cell;
    const { scroller, sheet, container, writes, scrollTo, touch } = scrollingBox(narrow, 200);
    scroller.style.direction = "rtl";
    Object.defineProperty(sheet, "offsetLeft", { get: () => narrow - (parseFloat(sheet.style.width) || 0) });
    Object.defineProperty(scroller, "scrollWidth", { get: () => Math.max(narrow, parseFloat(sheet.style.width) || 0) });
    const view = new TileView(container, scroller, sheet);
    view.show(content({ collapse: true }));
    const layer = container.querySelector<HTMLElement>(".chart-layer")!;
    const shift = () => Number(/translate\((-?[\d.e-]+)px/.exec(layer.style.transform)?.[1] ?? 0);
    // Where the chart's left-hand edge is across the box, and how far its right-hand edge, with the round numbers, falls short of the box's.
    const left = () => sheet.offsetLeft + shift() - scroller.scrollLeft;
    const right = () => narrow - (left() + view.place(idsIn(1).find((id) => scene.columnOf[id] === 1)!)!.x - shift() + cell + gutter(cell));
    const frames = (count: number) => {
      for (let frame = 0; frame < count; frame++) {
        now += 16;
        view.update();
      }
    };
    let changed = 0;
    for (const inset of [0, narrow]) {
      for (let first = 1; first + 6 <= rows; first++) {
        // A finger as far left as the sheet goes, or a box in from there, then a row up the chart.
        scrollTo(0, topFor(first));
        now += 200;
        view.update();
        scrollTo(narrow - (parseFloat(sheet.style.width) || 0) + inset, topFor(first));
        now += 200;
        view.update();
        const was = left();
        const columns = container.dataset.columnsShowing;
        writes.length = 0;
        touch("touchstart", 1);
        scrollTo(scroller.scrollLeft, topFor(first + 1));
        for (let frame = 0; frame < 30; frame++) {
          frames(1);
          // At the far left, the edge stays where it is, columns opening and closing away from it.
          if (inset === 0) expect(left(), `rows ${first} up, frame ${frame}`).toBeCloseTo(was, 6);
        }
        changed += Number(container.dataset.columnsShowing !== columns);
        // Before rest, the finger still down, the box scrolled to either end of the sheet shows that edge of the chart.
        scrollTo(narrow - (parseFloat(sheet.style.width) || 0), scroller.scrollTop);
        frames(1);
        expect(left(), `rows ${first} up, at the left`).toBeCloseTo(0, 6);
        scrollTo(0, scroller.scrollTop);
        frames(1);
        expect(right(), `rows ${first} up, at the right`).toBeCloseTo(0, 6);
        expect(writes.filter((write) => write.startsWith("left"))).toEqual([]);
        touch("touchend", 0);
      }
    }
    // Columns did open and close.
    expect(changed).toBeGreaterThan(0);
    view.destroy();
  });

  it("scrolled across from the right, puts every column back where it was when the rows in view go and come back", () => {
    const narrow = 6 * cell;
    const { scroller, sheet, container, scrollTo } = scrollingBox(narrow, 200);
    scroller.style.direction = "rtl";
    Object.defineProperty(sheet, "offsetLeft", { get: () => narrow - (parseFloat(sheet.style.width) || 0) });
    Object.defineProperty(scroller, "scrollWidth", { get: () => Math.max(narrow, parseFloat(sheet.style.width) || 0) });
    const view = new TileView(container, scroller, sheet);
    view.show(content({ collapse: true }));
    const settle = () => {
      for (let frame = 0; frame < 15; frame++) {
        now += 16;
        view.update();
      }
      now += 200;
      view.update();
    };
    const across = (id: number) => sheet.offsetLeft + view.place(id)!.x - scroller.scrollLeft;
    const showing = () => container.dataset.columnsShowing;
    let changed = 0;
    for (let first = 1; first + 6 <= rows; first++) {
      // Rested on rows `first` up, half way across the chart: well away from either edge.
      scrollTo(0, topFor(first));
      settle();
      scrollTo(-((parseFloat(sheet.style.width) || 0) - narrow) / 2, topFor(first));
      settle();
      // The stitch nearest the middle of the box, in a row in view either side of the step.
      const ids = idsIn(first + 2).filter((id) => view.place(id) !== undefined);
      const id = ids.reduce((best, one) => (Math.abs(across(one) - narrow / 2) < Math.abs(across(best) - narrow / 2) ? one : best));
      const was = across(id);
      const columns = showing();
      const after: number[] = [];
      for (let cycle = 0; cycle < 4; cycle++) {
        scrollTo(scroller.scrollLeft, topFor(first + 1));
        settle();
        changed += Number(showing() !== columns);
        scrollTo(scroller.scrollLeft, topFor(first));
        settle();
        after.push(across(id));
      }
      // Never further than part of a cell the first time - a column it was in closing in on it from both sides opens on one - and nowhere after.
      expect(Math.abs(after[0] - was), `rows ${first} up`).toBeLessThan(cell);
      for (const at of after) expect(at, `rows ${first} up`).toBeCloseTo(after[0], 6);
    }
    // Columns did open and close.
    expect(changed).toBeGreaterThan(0);
    view.destroy();
  });

  it("comes back to just where it was after rows in view wander about and return, whatever the way", () => {
    const narrow = 6 * cell;
    // A box half way across a chart scrolled from the right, and a finger on it throughout: nothing put right at rest.
    for (const seed of [1, 2, 3, 4, 5]) {
      const { scroller, sheet, container, scrollTo, touch } = scrollingBox(narrow, 200);
      scroller.style.direction = "rtl";
      Object.defineProperty(sheet, "offsetLeft", { get: () => narrow - (parseFloat(sheet.style.width) || 0) });
      Object.defineProperty(scroller, "scrollWidth", { get: () => Math.max(narrow, parseFloat(sheet.style.width) || 0) });
      const view = new TileView(container, scroller, sheet);
      view.show(content({ collapse: true }));
      const start = 2 + (seed % 3);
      scrollTo(0, topFor(start));
      now += 200;
      view.update();
      scrollTo(-((parseFloat(sheet.style.width) || 0) - narrow) / 2, topFor(start));
      now += 200;
      view.update();
      const ids = idsIn(start + 2).filter((id) => view.place(id) !== undefined);
      const where = () => ids.map((id) => [sheet.offsetLeft + view.place(id)!.x - scroller.scrollLeft, view.place(id)!.y - scroller.scrollTop]);
      const was = where();
      touch("touchstart", 1);
      let random = seed;
      const next = () => (random = (random * 1103515245 + 12345) % 2147483648) / 2147483648;
      let first = start;
      for (let move = 0; move < 40; move++) {
        first = Math.min(rows - 6, Math.max(1, first + Math.round((next() - 0.5) * 6)));
        scrollTo(scroller.scrollLeft, topFor(first));
        // Now and then before the lines have got where they were going.
        const frames = Math.floor(next() * 12);
        for (let frame = 0; frame < frames; frame++) {
          now += 16;
          view.update();
        }
      }
      scrollTo(scroller.scrollLeft, topFor(start));
      for (let frame = 0; frame < 15; frame++) {
        now += 16;
        view.update();
      }
      where().forEach(([x, y], k) => {
        expect(x, `seed ${seed}, stitch ${ids[k]} across`).toBeCloseTo(was[k][0], 6);
        expect(y, `seed ${seed}, stitch ${ids[k]} down`).toBeCloseTo(was[k][1], 6);
      });
      touch("touchend", 0);
      view.destroy();
    }
  });

  it("moves the columns at once when the rows in view jump, or when asked for less motion", () => {
    const { first, id, other } = heldStitch();
    const { scroller, sheet, container, scrollTo } = scrollingBox(wide, 200);
    const view = new TileView(container, scroller, sheet);
    view.show(content({ collapse: true }));
    scrollTo(0, topFor(1));
    now += 200;
    view.update();
    // From the bottom of the chart to the top, nothing in view before still in view: no easing.
    scrollTo(0, 0);
    now += 16;
    view.update();
    const top = idsIn(rows)[0];
    const jumped = view.place(top)!.x;
    now += 50;
    view.update();
    expect(view.place(top)!.x).toBe(jumped);
    view.destroy();

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({ matches: query.includes("reduce") }),
    });
    try {
      const again = scrollingBox(wide, 200);
      const calm = new TileView(again.container, again.scroller, again.sheet);
      calm.show(content({ collapse: true, follow: id }));
      again.scrollTo(0, topFor(first));
      now += 200;
      calm.update();
      const was = calm.place(other)!.x - calm.place(id)!.x;
      again.scrollTo(again.scroller.scrollLeft, topFor(first + 1));
      now += 16;
      calm.update();
      // Moved all the way in the one frame.
      const moved = calm.place(other)!.x - calm.place(id)!.x;
      expect(moved).not.toBe(was);
      now += 50;
      calm.update();
      expect(calm.place(other)!.x - calm.place(id)!.x).toBe(moved);
      calm.destroy();
    } finally {
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });

  it("tells of columns moved while the chart is drawn on the next frame, not in the middle of drawing it", () => {
    const { first, id } = heldStitch();
    const { scroller, sheet, container, scrollTo } = scrollingBox(wide, 200);
    const view = new TileView(container, scroller, sheet);
    view.show(content({ collapse: true, follow: id }));
    scrollTo(0, topFor(first));
    now += 200;
    view.update();
    let told = 0;
    view.onMove = () => told++;
    // The chart drawn again as the columns change: telling it then would only have it drawn again, and again.
    scrollTo(scroller.scrollLeft, topFor(first + 1));
    now += 16;
    view.show(content({ collapse: true, follow: id }));
    expect(told).toBe(0);
    now += 16;
    view.update();
    expect(told).toBe(1);
    view.destroy();
  });

  it("moves the columns at once while painting is too slow to ease them, and eases again once it is quick", () => {
    const { first, id, other } = heldStitch();
    // Each tile takes this long to paint.
    let slow = 0;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        new Proxy({} as Record<string, unknown>, {
          get: (target, key: string) => (key === "restore" ? () => (now += slow) : key in target ? target[key] : () => {}),
          set: (target, key: string, value) => ((target[key] = value), true),
        }) as unknown as CanvasRenderingContext2D,
    );
    const { scroller, sheet, container, scrollTo } = scrollingBox(wide, 200);
    const view = new TileView(container, scroller, sheet);
    view.show(content({ collapse: true, follow: id }));
    scrollTo(0, topFor(first));
    now += 200;
    view.update();
    const gap = () => view.place(other)!.x - view.place(id)!.x;
    /** Up a row and back, a frame at a time: whether the first frame of each change moved the columns all the way. */
    const steps = () =>
      [first + 1, first].map((row) => {
        scrollTo(scroller.scrollLeft, topFor(row));
        now += 16;
        view.update();
        const at = gap();
        for (let frame = 0; frame < 15; frame++) {
          now += 16;
          view.update();
        }
        return gap() === at;
      });
    expect(steps()).toEqual([false, false]);
    slow = 20;
    steps();
    expect(steps()).toEqual([true, true]);
    // Quick again: easing comes back within a few changes, as the slow frames are forgotten.
    slow = 0;
    for (let round = 0; round < 5 && steps()[1]; round++);
    expect(steps()).toEqual([false, false]);
    view.destroy();
  });

  it("finds the stitch at a point by the columns as they are drawn", () => {
    const margin = 16;
    const { scroller, sheet, container, scrollTo } = scrollingBox(wide, 200);
    const view = new TileView(container, scroller, sheet);
    scrollTo(0, topFor(3));
    now += 200;
    view.show(content({ collapse: true, margin }));
    // The layer is where the page puts it: at no offset here, the room for a join's arrow first.
    for (let row = 3; row <= 7; row++) {
      for (const id of idsIn(row)) {
        const { x, y } = view.place(id)!;
        expect(view.stitchAt(margin + x + cell / 2, y + cell / 2)).toBe(id);
      }
    }
    expect(view.stitchAt(margin - 4, (rows - 3) * cell + cell / 2)).toBeUndefined();
    view.destroy();
  });

  it("zooms about the column and row a point is in, a closed-up column for a closed-up column", () => {
    const { scroller, sheet, container, scrollTo } = scrollingBox(wide, 200);
    const view = new TileView(container, scroller, sheet);
    scrollTo(0, topFor(1));
    now += 200;
    view.show(content({ collapse: true }));
    const id = idsIn(3)[5];
    const x = view.place(id)!.x + 10;
    const y = view.place(id)!.y + 10;
    view.show(content({ collapse: true, cell: 32 }));
    // On screen where it was, in a box at the page's corner.
    const placed = view.zoomedTo(x, y, x - scroller.scrollLeft, y - scroller.scrollTop)!;
    expect(placed.x).toBeCloseTo(view.place(id)!.x + 8, 6);
    expect(placed.y).toBeCloseTo(view.place(id)!.y + 8, 6);
    expect(sheet.style.width).toBe(`${view.place(idsIn(1)[0])!.x + 32 + gutter(32)}px`);
    view.destroy();
  });

  describe("its rows", () => {
    // A box 300 wide shows eight columns' worth: the top row has no stitch in some eight together.
    const across = 8;
    /** How far across the chart's top the box is over columns the top row has no stitch in, every column showing there. */
    const gapAt = () => {
      const live = new LiveColumns(scene.index);
      live.moveTo(rows - 4, rows);
      const { order } = mapOf(live);
      const top = new Set(idsIn(rows).map((id) => scene.columnOf[id]));
      for (let k = 0; k + across <= order.length; k++) {
        if (Array.from(order.subarray(k, k + across)).every((column) => !top.has(column))) return k * cell;
      }
      throw new Error("no gap");
    };
    /** The box at the chart's top over that gap, the top row closed up. */
    const atGap = (follow?: number) => {
      const box = scrollingBox(300, 200);
      box.scrollTo(gapAt(), 0);
      const view = new TileView(box.container, box.scroller, box.sheet);
      now += 200;
      view.show(content({ collapse: true, follow }));
      return { ...box, view };
    };

    it("closes up the rows no column on screen has a stitch in, the sheet as tall as the rest", () => {
      const { scroller, sheet, container, scrollTo, view } = atGap();
      expect(container.dataset.rows).toBe(String(rows));
      expect(container.dataset.rowsShowing).toBe(String(rows - 1));
      expect(sheet.style.height).toBe(`${(rows - 1) * cell}px`);
      // The rows showing one above another from the sheet's top, the top row's stitches nowhere to be seen.
      for (let row = 1; row < rows; row++) {
        for (const id of idsIn(row)) expect(view.place(id)!.y).toBe((rows - 1 - row) * cell);
      }

      // Over the columns at the chart's left edge, the top row has stitches again: it opens.
      const middle = idsIn(rows - 3)[0];
      const was = view.place(middle)!.y - scroller.scrollTop;
      scrollTo(0, 0);
      now += 16;
      view.update();
      expect(container.dataset.rowsShowing).toBe(String(rows));
      now += 200;
      view.update();
      // At the chart's top edge, which stayed at the box's top: the rows below make way.
      expect(sheet.style.height).toBe(`${rows * cell}px`);
      expect(scroller.scrollTop).toBe(0);
      expect(view.place(idsIn(rows)[0])!.y).toBe(0);
      expect(view.place(middle)!.y - scroller.scrollTop).toBe(was + cell);
      view.destroy();
    });

    it("holds the stitch being worked still on screen as the rows ease to their new places", () => {
      // A stitch of the row below the top in the leftmost column on screen, which stays on screen a column to the left.
      const left = gapAt();
      const first = atGap();
      const id = idsIn(rows - 1).find((one) => Math.abs(first.view.place(one)!.x - left) < 1)!;
      first.view.destroy();
      const { scroller, container, writes, scrollTo, view } = atGap(id);
      const onScreen = () => view.place(id)!.y - scroller.scrollTop;
      const held = onScreen();
      writes.length = 0;

      // A column to the left: the top row opens above it, over the next frames.
      scrollTo(left - cell, 0);
      const heights: number[] = [];
      for (let frame = 0; frame < 6; frame++) {
        now += 16;
        view.update();
        expect(onScreen()).toBeCloseTo(held, 6);
        heights.push(view.place(idsIn(rows)[0])!.y);
      }
      expect(container.dataset.rowsShowing).toBe(String(rows));
      expect(new Set(heights).size).toBeGreaterThan(1);
      // At rest, the layer goes back to the sheet's edge and the box is scrolled once to match: nothing moves.
      now += 200;
      view.update();
      expect(writes).toEqual([`top ${cell}`]);
      expect(onScreen()).toBeCloseTo(held, 6);
      expect(container.querySelector<HTMLElement>(".chart-layer")!.style.transform).toBe("");
      view.destroy();
    });

    it("keeps the box inside the chart as rows close near an edge out of view", () => {
      // Every row open, the box half a row down from the chart's top, so neither edge is in view.
      const { scroller, sheet, container, scrollTo } = scrollingBox(300, 200);
      scrollTo(0, cell / 2);
      const view = new TileView(container, scroller, sheet);
      now += 200;
      view.show(content({ collapse: true }));
      expect(container.dataset.rowsShowing).toBe(String(rows));
      // Over the gap, the top row closes above the row in the middle.
      const below = idsIn(rows - 1)[0];
      scrollTo(gapAt(), cell / 2);
      now += 16;
      view.update();
      expect(container.dataset.rowsShowing).toBe(String(rows - 1));
      // No gap above the chart: its top is at or above the box's, and stays there at rest.
      const above = view.place(below)!.y - scroller.scrollTop;
      expect(above).toBeLessThanOrEqual(1e-6);
      now += 200;
      view.update();
      expect(scroller.scrollTop).toBeGreaterThanOrEqual(0);
      expect(view.place(below)!.y - scroller.scrollTop).toBeCloseTo(above, 6);
      expect(sheet.style.height).toBe(`${(rows - 1) * cell}px`);
      view.destroy();
    });

    it("keeps the chart's bottom at the box's when rows open under a box at the bottom", () => {
      // Seven columns showing none of the bottom rows' stitches, the first such from the left: the column before them shows some.
      const live = new LiveColumns(scene.index);
      live.moveTo(1, rows);
      const { order } = mapOf(live);
      const bottom = new Set(idsIn(1).map((id) => scene.columnOf[id]));
      const k = order.findIndex((_, k) => k > 0 && Array.from(order.subarray(k, k + 7)).every((column) => !bottom.has(column)));
      const closed = [1, 2, 3].filter((row) => idsIn(row).every((id) => bottom.has(scene.columnOf[id])));
      expect(closed).toEqual([1, 2, 3]);
      /** The box 280 wide, so seven columns, and `height` tall, at the chart's bottom over those columns; then a column to their left. */
      const opening = (height: number) => {
        const { scroller, container, scrollTo } = scrollingBox(7 * cell, height);
        const chart = (rows - closed.length) * cell;
        scrollTo(k * cell, Math.max(0, chart - height));
        const view = new TileView(container, scroller, sheetOf(scroller));
        now += 200;
        view.show(content({ collapse: true }));
        expect(container.dataset.rowsShowing).toBe(String(rows - closed.length));
        const middle = idsIn(closed.length + 2)[0];
        const was = view.place(middle)!.y - scroller.scrollTop;
        scrollTo((k - 1) * cell, scroller.scrollTop);
        for (let frame = 0; frame < 15; frame++) {
          now += 16;
          view.update();
        }
        expect(container.dataset.rowsShowing).toBe(String(rows));
        const result = {
          middle: view.place(middle)!.y - scroller.scrollTop - was,
          bottom: rows * cell - scroller.scrollTop - height,
        };
        view.destroy();
        return result;
      };
      // Three rows opening at the bottom of the chart, the box all the way down: the bottom stays where it is.
      expect(opening(5 * cell).bottom).toBeCloseTo(0, 6);
      // In a box ten rows tall the whole chart fits, and the box has nowhere to scroll: it grows down from its top, where the box starts.
      expect(opening(10 * cell).bottom).toBeCloseTo(rows * cell - 10 * cell, 6);
    });

    it("never closes up everything, even with the box off the chart", () => {
      const { container, scrollTo, view } = atGap();
      // Far past the chart's bottom left, as a fling might take a box whose sheet is still large: the lines nearest it show.
      scrollTo(-5000, 5000);
      now += 16;
      view.update();
      expect(Number(container.dataset.rowsShowing)).toBeGreaterThan(0);
      expect(Number(container.dataset.columnsShowing)).toBeGreaterThan(0);
      // And zoomed out from there, the old scroll past the new chart's edge.
      scrollTo(gapAt(), 0);
      now += 200;
      view.update();
      view.show(content({ collapse: true, cell: 8 }));
      expect(Number(container.dataset.rowsShowing)).toBeGreaterThan(0);
      expect(Number(container.dataset.columnsShowing)).toBeGreaterThan(0);
      view.destroy();
    });

    it("finds the stitch at a point with rows closed up", () => {
      const { view } = atGap();
      for (let row = 1; row < rows; row++) {
        for (const id of idsIn(row)) {
          const { x, y } = view.place(id)!;
          expect(view.stitchAt(x + cell / 2, y + cell / 2)).toBe(id);
        }
      }
      view.destroy();
    });

    it("zooms about the row a point is in, laying out at once the rows the box needs at the new size", () => {
      const { scroller, sheet, container, scrollTo, view } = atGap();
      const id = idsIn(rows - 2).find((one) => Math.abs(view.place(one)!.x - scroller.scrollLeft) < 1)!;
      const point = { x: view.place(id)!.x + 10, y: view.place(id)!.y + 10 };
      const screen = { x: point.x - scroller.scrollLeft, y: point.y - scroller.scrollTop };
      // Zoomed out, twice as many columns on screen, and among them the top row's: it opens.
      view.show(content({ collapse: true, cell: 20 }));
      const placed = view.zoomedTo(point.x, point.y, screen.x, screen.y)!;
      expect(placed.x).toBeCloseTo(view.place(id)!.x + 5, 6);
      expect(placed.y).toBeCloseTo(view.place(id)!.y + 5, 6);
      expect(sheet.style.height).toBe(`${rows * 20}px`);
      // Scrolled to put the point back: nothing more opens or closes, and nothing moves.
      scrollTo(placed.x - screen.x, placed.y - screen.y);
      now += 16;
      view.update();
      expect(container.dataset.rowsShowing).toBe(String(rows));
      expect(view.place(id)!.x + 5).toBeCloseTo(placed.x, 6);
      expect(view.place(id)!.y + 5).toBeCloseTo(placed.y, 6);
      expect(container.querySelector<HTMLElement>(".chart-layer")!.style.transform).toBe("");
      view.destroy();
    });
  });
});

describe("where the box goes as lines open and close", () => {
  const cell = 10;
  // A chart long beside the box, as a sweater's is.
  const lines = 200;
  /** Lines all a cell wide but those in `shut`, from line `lines` at the near edge to line 1 at the far one. */
  const laid = (shut: (line: number) => boolean): Places => {
    const start = new Float64Array(lines + 2);
    const size = new Float64Array(lines + 2);
    let at = 0;
    for (let line = lines + 1; line >= 0; line--) {
      start[line] = at;
      size[line] = line >= 1 && line <= lines && !shut(line) ? cell : 0;
      at += size[line];
    }
    return { start, size };
  };

  it("opens a block of lines out both ways in view, by more on the side the box is further from, and changes that share as gradually as the box moves", () => {
    // Fourteen lines side by side, shut, then open; a box twenty cells long.
    const block = (line: number) => line >= 95 && line <= 108;
    const rest = laid(block);
    const open = laid(() => false);
    const size = 20 * cell;
    const room = rest.start[0] - size;
    const width = 14 * cell;
    // The block's place on the chart while shut.
    const point = rest.start[108];
    const shares: { across: number; left: number }[] = [];
    // Clear of the pixel at either end, which counts as at it.
    for (let box = 2; box <= room - 2; box += 5) {
      const part = (box - 1) / (room - 2);
      const now = along(rest, open, part, size, 0, 0, 1, cell);
      // What was left of the block moves left by as much as the box moves on along the chart: that share of it opened to the left.
      shares.push({ across: point - box, left: (now - box) / width });
    }
    // Well left of the box, all of it opens to the left; well right, all to the right; never more than all, nor less than none.
    expect(shares[shares.length - 1].left).toBeGreaterThan(0.95);
    expect(shares[0].left).toBeLessThan(0.05);
    for (const { left } of shares) {
      expect(left).toBeGreaterThanOrEqual(-1e-9);
      expect(left).toBeLessThanOrEqual(1 + 1e-9);
    }
    // The further along the box is, the more of it opens to the left: never back the other way.
    shares.forEach((share, k) => k > 0 && expect(share.left).toBeGreaterThanOrEqual(shares[k - 1].left - 1e-9));
    // And from mostly one way to mostly the other over half the box or more, not as the box passes a line.
    const mostlyRight = shares.filter((share) => share.left <= 0.2).map((share) => share.across);
    const mostlyLeft = shares.filter((share) => share.left >= 0.8).map((share) => share.across);
    expect(Math.min(...mostlyRight) - Math.max(...mostlyLeft)).toBeGreaterThanOrEqual(size / 2);
  });
});
