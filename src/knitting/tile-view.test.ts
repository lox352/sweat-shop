import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSweater } from "./engine";
import { layOutSweater } from "./layout";
import { sceneOf } from "./chart-scene";
import { defaultColours } from "./chart-painter";
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
  Object.defineProperty(scroller, "scrollLeft", { value: 0, writable: true });
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
