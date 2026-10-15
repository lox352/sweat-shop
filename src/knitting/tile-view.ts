import type { ChartScene } from "./chart-scene";
import { type ChartColours, type ChartOverlay, type PaintState, laidOutPlaces, paintRegion } from "./chart-painter";
import { gutter } from "./chart-paths";
import type { Palette } from "./palette";

/**
 * The chart on canvases, a tile at a time, inside the box it scrolls in.
 *
 * The box scrolls as any box does, so a fling is the browser's and costs
 * nothing here. What this keeps up is the tiles: one canvas for each square
 * of the chart in view or about to be, painted once and kept until something
 * it shows changes. A stitch worked repaints the tiles across its row and no
 * others, and a zoom or a change of wool repaints what is on screen - a few
 * milliseconds, where the chart as one drawing redrew all of itself.
 *
 * The canvases are pooled: a phone keeps a couple of dozen, and a tile that
 * scrolls away hands its canvas to the next one to come into view.
 */

/** A tile's side, in CSS pixels. */
export const tileSize = 256;
/** How far past the box tiles are kept painted, for the next moment's scrolling. */
const ahead = 128;
/** The most canvases kept beyond those in view: at three device pixels to one, about two megabytes each. */
const most = 24;

export interface TileContent {
  scene: ChartScene;
  cell: number;
  palette: Palette;
  yarnLabels?: Record<string, string>;
  progress: number;
  hatch: [number, number][];
  onHold: Set<number>[];
  overlay?: ChartOverlay;
  colours: ChartColours;
  /** How far left of the chart's own left edge there is room to draw: a join's arrow reaches into it. */
  margin: number;
}

interface Tile {
  key: string;
  x: number;
  y: number;
  canvas: HTMLCanvasElement;
  /** What it shows: stale once the content moves on. */
  painted: number;
  used: number;
}

export class TileView {
  private tiles = new Map<string, Tile>();
  private spare: HTMLCanvasElement[] = [];
  private content?: TileContent;
  private version = 0;
  private frame = 0;
  private clock = 0;
  private ratio = 1;
  private places?: { left: Float64Array; width: Float64Array; columns: number; cell: number };
  private readonly onScroll = () => this.schedule();
  private readonly watch?: ResizeObserver;

  constructor(
    private readonly container: HTMLDivElement,
    private readonly scroller: HTMLElement,
    private readonly sheet: HTMLElement,
  ) {
    scroller.addEventListener("scroll", this.onScroll, { passive: true });
    if (typeof ResizeObserver !== "undefined") {
      this.watch = new ResizeObserver(this.onScroll);
      this.watch.observe(scroller);
    }
  }

  /**
   * Show this. Whatever changed is repainted: everything in view for a new
   * layout, size or wool, and only the rows a stitch has changed for progress.
   */
  show(content: TileContent) {
    const was = this.content;
    this.content = content;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const same =
      was !== undefined &&
      was.scene === content.scene &&
      was.cell === content.cell &&
      was.palette === content.palette &&
      was.yarnLabels === content.yarnLabels &&
      was.hatch === content.hatch &&
      was.onHold === content.onHold &&
      was.overlay === content.overlay &&
      was.colours === content.colours &&
      was.margin === content.margin &&
      ratio === this.ratio;
    this.ratio = ratio;
    if (!same) this.version++;
    else if (was.progress !== content.progress) this.progressed(was.progress, content.progress);
    this.update();
  }

  /** Mark stale the tiles across the rows whose stitches changed from done to to do, or back. */
  private progressed(from: number, to: number) {
    const { scene, cell } = this.content!;
    const [low, high] = from < to ? [from, to] : [to, from];
    if (high - low > 5000) {
      this.version++;
      return;
    }
    let first = Infinity;
    let last = -Infinity;
    for (let id = low + 1; id <= high; id++) {
      const row = scene.rowOf[id];
      if (!row) continue;
      first = Math.min(first, row);
      last = Math.max(last, row);
    }
    if (first > last) return;
    const top = (scene.layout.rows - last) * cell;
    const bottom = (scene.layout.rows - first + 1) * cell;
    this.tiles.forEach((tile) => {
      if (tile.y < bottom && tile.y + tileSize > top) tile.painted = -1;
    });
  }

  private schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.update();
    });
  }

  /** What of the chart the box shows, in the chart's own pixels. */
  private showing() {
    const x = this.scroller.scrollLeft - this.sheet.offsetLeft;
    const y = this.scroller.scrollTop - this.sheet.offsetTop;
    return { x, y, width: this.scroller.clientWidth, height: this.scroller.clientHeight };
  }

  private stateFor(content: TileContent): PaintState {
    const columns = content.scene.layout.columns;
    if (!this.places || this.places.columns !== columns || this.places.cell !== content.cell) {
      this.places = { ...laidOutPlaces(columns, content.cell), columns, cell: content.cell };
    }
    return {
      cell: content.cell,
      left: this.places.left,
      width: this.places.width,
      palette: content.palette,
      yarnLabels: content.yarnLabels,
      progress: content.progress,
      hatch: content.hatch,
      onHold: content.onHold,
      overlay: content.overlay,
      colours: content.colours,
      ratio: this.ratio,
    };
  }

  /** Bring the tiles up to date with what is in view: paint the stale ones in view, and let go of the far ones. */
  update() {
    const content = this.content;
    if (!content) return;
    const view = this.showing();
    const { margin } = content;
    const chartWidth = content.scene.layout.columns * content.cell + margin + gutter(content.cell);
    const chartHeight = content.scene.layout.rows * content.cell;
    // Tiles are counted from the room left of the chart, so that is painted too.
    const span = (from: number, to: number, size: number) => [
      Math.max(0, Math.floor(from / tileSize)),
      Math.min(Math.ceil(size / tileSize) - 1, Math.floor((to - 1) / tileSize)),
    ];
    const [tx0, tx1] = span(view.x + margin - ahead, view.x + margin + view.width + ahead, chartWidth);
    const [ty0, ty1] = span(view.y - ahead, view.y + view.height + ahead, chartHeight);
    const state = this.stateFor(content);
    this.clock++;
    const wanted = new Set<string>();
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const key = `${tx}|${ty}`;
        wanted.add(key);
        let tile = this.tiles.get(key);
        if (!tile) {
          const canvas = this.canvas();
          if (!canvas) continue;
          tile = { key, x: 0, y: ty * tileSize, canvas, painted: -1, used: 0 };
          canvas.style.left = `${tx * tileSize}px`;
          canvas.style.top = `${ty * tileSize}px`;
          this.tiles.set(key, tile);
        }
        // From the chart's own left edge, which moves against the tiles as the room left of it does with the cell size.
        tile.x = tx * tileSize - margin;
        tile.used = this.clock;
        if (tile.painted !== this.version) this.paint(tile, content, state);
      }
    }
    // Keep only as many canvases as a phone can spare: the longest unused go first.
    if (this.tiles.size > most) {
      const old = [...this.tiles.values()].filter((tile) => !wanted.has(tile.key)).sort((a, b) => a.used - b.used);
      for (const tile of old.slice(0, this.tiles.size - most)) this.release(tile);
    }
  }

  private canvas(): HTMLCanvasElement | undefined {
    const reused = this.spare.pop();
    if (reused) return reused;
    const canvas = document.createElement("canvas");
    canvas.style.width = `${tileSize}px`;
    canvas.style.height = `${tileSize}px`;
    this.container.appendChild(canvas);
    return canvas;
  }

  private paint(tile: Tile, content: TileContent, state: PaintState) {
    const side = Math.round(tileSize * this.ratio);
    if (tile.canvas.width !== side) {
      tile.canvas.width = side;
      tile.canvas.height = side;
    }
    const ctx = tile.canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.setTransform(this.ratio, 0, 0, this.ratio, -tile.x * this.ratio, -tile.y * this.ratio);
    paintRegion(ctx, { x: tile.x, y: tile.y, width: tileSize, height: tileSize }, content.scene, state);
    tile.painted = this.version;
  }

  private release(tile: Tile) {
    this.tiles.delete(tile.key);
    tile.canvas.style.left = "-9999px";
    this.spare.push(tile.canvas);
  }

  /** Let go of every canvas: a canvas's memory is only given back once it has no size. */
  destroy() {
    cancelAnimationFrame(this.frame);
    this.scroller.removeEventListener("scroll", this.onScroll);
    this.watch?.disconnect();
    for (const canvas of [...this.spare, ...[...this.tiles.values()].map((tile) => tile.canvas)]) {
      canvas.width = 0;
      canvas.height = 0;
      canvas.remove();
    }
    this.tiles.clear();
    this.spare = [];
  }
}
