import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSweater } from "./engine";
import { layOutSweater } from "./layout";
import { sceneOf } from "./chart-scene";
import { defaultColours } from "./chart-painter";
import { gutter } from "./chart-paths";
import { LiveColumns, mapOf } from "./column-window";
import { TileView, type TileContent, tileSize } from "./tile-view";
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
  Object.defineProperty(scroller, "scrollTop", { value: 0, writable: true });
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
 * and is scrolled by the knitter with `scrollTo`.
 */
const scrollingBox = (width: number, height: number) => {
  const { scroller, sheet, container } = box(width, height);
  Object.defineProperty(scroller, "offsetHeight", { value: height });
  let left = 0;
  const writes: number[] = [];
  Object.defineProperty(scroller, "scrollLeft", {
    get: () => left,
    set: (value: number) => {
      writes.push(value);
      left = value;
    },
  });
  const scrollTo = (x: number, y: number) => {
    left = x;
    scroller.scrollTop = y;
    scroller.dispatchEvent(new Event("scroll"));
  };
  const touch = (type: string, fingers: number) => {
    const event = new Event(type);
    Object.defineProperty(event, "touches", { value: { length: fingers } });
    scroller.dispatchEvent(event);
  };
  return { scroller, sheet, container, writes, scrollTo, touch };
};

describe("the chart on tiles, closed up", () => {
  const { rows } = layout;
  const cell = 40;
  // Five rows in view: the box `top` down the chart shows rows first to first + 4.
  const topFor = (first: number) => (rows - first - 4) * cell;
  const idsIn = (row: number) => Array.from(scene.index.id.subarray(scene.index.start[row], scene.index.start[row + 1]));
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
    const { scroller, sheet, container, scrollTo } = scrollingBox(300, 200);
    scrollTo(0, topFor(1));
    const view = new TileView(container, scroller, sheet);
    now += 200;
    view.show(content({ collapse: true }));
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
    const { scroller, sheet, container, writes, scrollTo } = scrollingBox(300, 200);
    const view = new TileView(container, scroller, sheet);
    view.show(content({ collapse: true, follow: id }));
    scrollTo(view.place(id)!.x - 100, topFor(first));
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
    const { scroller, sheet, container, writes, scrollTo, touch } = scrollingBox(300, 200);
    const view = new TileView(container, scroller, sheet);
    view.show(content({ collapse: true, follow: id }));
    scrollTo(view.place(id)!.x - 100, topFor(first));
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

  it("moves the columns at once when the rows in view jump, or when asked for less motion", () => {
    const { first, id, other } = heldStitch();
    const { scroller, sheet, container, scrollTo } = scrollingBox(300, 200);
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
      const again = scrollingBox(300, 200);
      const calm = new TileView(again.container, again.scroller, again.sheet);
      calm.show(content({ collapse: true, follow: id }));
      again.scrollTo(calm.place(id)!.x - 100, topFor(first));
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
    const { scroller, sheet, container, scrollTo } = scrollingBox(300, 200);
    const view = new TileView(container, scroller, sheet);
    view.show(content({ collapse: true, follow: id }));
    scrollTo(view.place(id)!.x - 100, topFor(first));
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
    const { scroller, sheet, container, scrollTo } = scrollingBox(300, 200);
    const view = new TileView(container, scroller, sheet);
    view.show(content({ collapse: true, follow: id }));
    scrollTo(view.place(id)!.x - 100, topFor(first));
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
    const { scroller, sheet, container, scrollTo } = scrollingBox(300, 200);
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

  it("zooms about the column a point is in, a closed-up column for a closed-up column", () => {
    const { scroller, sheet, container, scrollTo } = scrollingBox(300, 200);
    const view = new TileView(container, scroller, sheet);
    scrollTo(0, topFor(1));
    now += 200;
    view.show(content({ collapse: true }));
    const id = idsIn(3)[5];
    const x = view.place(id)!.x + 10;
    view.show(content({ collapse: true, cell: 32 }));
    const across = view.zoomedTo(x, topFor(1) * 0.8);
    expect(across).toBeCloseTo(view.place(id)!.x + 8, 6);
    expect(sheet.style.width).toBe(`${view.place(idsIn(1)[0])!.x + 32 + gutter(32)}px`);
    view.destroy();
  });
});
