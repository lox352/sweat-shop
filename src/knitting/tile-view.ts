import type { ChartScene } from "./chart-scene";
import { type ChartColours, type ChartOverlay, type PaintState, gutter, paintRegion } from "./chart-painter";
import { type ColumnMap, LiveColumns, everyColumn, mapOf, rowsShowing } from "./column-window";
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
 * It also decides where each column goes. Asked to close up the columns no
 * row in view has a stitch in, it counts, as the box scrolls, which columns
 * the rows in view need - see column-window - and when that changes, lays the
 * columns out again with one held still: the stitch being worked, or an edge
 * of the chart in view, or the column in the middle. The columns ease to their
 * new places rather than jumping.
 *
 * Holding a column still never writes the box's scroll while it is moving:
 * a phone ignores a scroll set mid-fling, or stops the fling for it, and a
 * smooth scroll set going by the chart is cancelled by one. So the tiles sit
 * on a layer that is moved across the sheet instead, and only once the box
 * has come to rest is the layer put back at the sheet's edge and the box
 * scrolled to match, in the same frame, so nothing on screen moves.
 */

/** A tile's side, in CSS pixels. */
export const tileSize = 256;
/** How far past the box tiles are kept painted, for the next moment's scrolling. */
const ahead = 128;
/** The most canvases kept beyond those in view: at three device pixels to one, about two megabytes each. */
const most = 24;
/** How long the columns take to ease to their new places, in milliseconds. */
const easing = 150;
/** How long after the box last moved it counts as at rest. */
const settling = 150;
/** Painting slower than this a frame, the columns are moved at once rather than eased. */
const budget = 12;
/** And no more than this a frame on tiles out of view, to have them ready. */
const spare = 6;

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
  /** Close up the columns that no row in view has a stitch in. */
  collapse?: boolean;
  /** The stitch to be worked next: outlined, and held still when the columns move. */
  follow?: number;
}

/** Each column's left edge from the chart's own left edge, and its width. */
interface Places {
  left: Float64Array;
  width: Float64Array;
}

interface Tile {
  key: string;
  tx: number;
  x: number;
  y: number;
  canvas: HTMLCanvasElement;
  /** What it shows: stale once the content moves on. */
  painted: number;
  used: number;
}

const placesOf = (map: ColumnMap, cell: number): Places => {
  const left = new Float64Array(map.leftOf.length);
  const width = new Float64Array(map.leftOf.length);
  for (let c = 0; c < left.length; c++) {
    left[c] = map.leftOf[c] * cell;
    width[c] = map.shows[c] ? cell : 0;
  }
  return { left, width };
};

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export class TileView {
  private tiles = new Map<string, Tile>();
  private spare: HTMLCanvasElement[] = [];
  private content?: TileContent;
  private version = 0;
  private frame = 0;
  private clock = 0;
  private ratio = 1;

  /** The layer the tiles and the next stitch's outline are on, moved across the sheet by `shift`. */
  private readonly layer: HTMLDivElement;
  private readonly next: HTMLDivElement;
  private live?: LiveColumns;
  private map?: ColumnMap;
  private places: Places = { left: new Float64Array(0), width: new Float64Array(0) };
  private ease?: { from: Places; to: Places; start: number; column: number; at: number };
  private shift = 0;
  /** Where the columns were before the cell size last changed, to zoom about. */
  private before?: Places & { shift: number; cell: number };
  /** A stitch to hold still when the columns next move: one the chart is scrolling to. */
  private target?: number;
  private touching = false;
  private movedAt = 0;
  /** What painting the tiles in view costs a frame while the columns move, smoothed; easing stops while it is over budget. */
  private cost = 0;
  /** The columns moved while the chart was being drawn, which is told of on the next frame instead. */
  private toTell = false;
  /** How many columns show, as the tiles' `data-columns-showing` says. */
  private showingCount = -1;
  /** Told when the columns move, for anything placed over the chart outside the tiles. */
  onMove?: () => void;

  private readonly onScroll = () => {
    this.movedAt = performance.now();
    this.schedule();
  };
  private readonly onTouch = (event: TouchEvent) => {
    this.touching = event.touches.length > 0;
    this.onScroll();
  };
  private readonly watch?: ResizeObserver;

  constructor(
    private readonly container: HTMLDivElement,
    private readonly scroller: HTMLElement,
    private readonly sheet: HTMLElement,
  ) {
    this.layer = document.createElement("div");
    this.layer.className = "chart-layer";
    container.appendChild(this.layer);
    this.next = document.createElement("div");
    this.next.className = "chart-next";
    this.next.hidden = true;
    this.layer.appendChild(this.next);
    scroller.addEventListener("scroll", this.onScroll, { passive: true });
    scroller.addEventListener("wheel", this.onScroll, { passive: true });
    scroller.addEventListener("touchstart", this.onTouch, { passive: true });
    scroller.addEventListener("touchend", this.onTouch, { passive: true });
    scroller.addEventListener("touchcancel", this.onTouch, { passive: true });
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
    if (!was || was.scene !== content.scene || !!was.collapse !== !!content.collapse) {
      this.reset(content);
    } else if (was.cell !== content.cell) {
      this.before = { ...this.places, shift: this.shift, cell: was.cell };
      this.relayout(content);
    }
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
      !!was.collapse === !!content.collapse &&
      ratio === this.ratio;
    this.ratio = ratio;
    if (!same) this.version++;
    else if (was.progress !== content.progress) this.progressed(was.progress, content.progress);
    this.update(true);
  }

  /** A new chart: every column showing to begin with, until the rows in view say otherwise. */
  private reset(content: TileContent) {
    this.container.dataset.columns = String(content.scene.layout.columns);
    this.live = new LiveColumns(content.scene.index);
    this.map = everyColumn(content.scene.layout.columns);
    this.ease = undefined;
    this.shift = 0;
    this.relayout(content);
  }

  /** The columns laid out afresh at the cell size, at once and at the sheet's edge. */
  private relayout(content: TileContent) {
    this.ease = undefined;
    this.shift = 0;
    if (content.collapse) this.windowAt(this.scroller.scrollTop, content);
    this.places = placesOf(this.map ?? everyColumn(content.scene.layout.columns), content.cell);
    this.version++;
  }

  /** The rows in view with the box scrolled `top` down, and the columns they need: whether those changed. */
  private windowAt(top: number, content: TileContent): boolean {
    const [first, last] = rowsShowing(
      content.scene.layout.rows,
      content.cell,
      top - this.sheet.offsetTop,
      this.scroller.offsetHeight,
    );
    if (!this.live!.moveTo(first, last)) return false;
    this.map = mapOf(this.live!);
    return true;
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

  /** What of the chart the box shows, from the chart's own left edge and top. */
  private showing() {
    const x = this.scroller.scrollLeft - this.sheet.offsetLeft - this.shift;
    const y = this.scroller.scrollTop - this.sheet.offsetTop;
    return { x, y, width: this.scroller.clientWidth, height: this.scroller.clientHeight };
  }

  /**
   * Which column to hold still as the columns move: one being scrolled to,
   * the stitch being worked if it is on screen, an edge of the chart in view
   * - the right one first, where a chart is read from - or else the column
   * in the middle of the box that shows before and after. Never one off
   * screen while the box is not scrolling to it: holding that still would
   * slide what is on screen sideways.
   */
  private anchor(map: ColumnMap, was: ColumnMap): number {
    const { scene, follow, cell } = this.content!;
    const view = this.showing();
    if (this.target !== undefined && scene.rowOf[this.target]) return scene.columnOf[this.target];
    const at = follow === undefined ? undefined : this.placeOnLayer(follow);
    if (at && at.x < view.x + view.width && at.x + at.width > view.x && at.y < view.y + view.height && at.y + cell > view.y) {
      return scene.columnOf[follow!];
    }
    const columns = scene.layout.columns;
    const right = this.places.left[0];
    if (right >= view.x && right <= view.x + view.width) return 0;
    if (this.places.left[columns + 1] >= view.x && this.places.left[columns + 1] <= view.x + view.width) {
      return columns + 1;
    }
    const middle = view.x + view.width / 2;
    const order = was.order;
    // The column showing under the middle of the box, by the places columns are drawn at now.
    let low = 0;
    let high = order.length - 1;
    while (low < high) {
      const k = (low + high) >> 1;
      if (this.places.left[order[k]] + this.places.width[order[k]] <= middle) low = k + 1;
      else high = k;
    }
    for (let step = 0; step < order.length; step++) {
      for (const k of [low - step, low + step]) {
        const column = order[k];
        if (column !== undefined && map.shows[column]) return column;
      }
    }
    return 0;
  }

  /** The columns needed have changed from `was`: ease them to their new places, holding one still. */
  private moveColumns(time: number, jumped: boolean, was: ColumnMap) {
    const content = this.content!;
    const map = this.map!;
    const to = placesOf(map, content.cell);
    const column = this.anchor(map, was);
    const at = this.shift + this.places.left[column];
    if (jumped || this.cost > budget || reducedMotion()) {
      this.places = to;
      this.shift = at - to.left[column];
      this.ease = undefined;
    } else {
      this.ease = {
        from: { left: this.places.left.slice(), width: this.places.width.slice() },
        to,
        start: time,
        column,
        at,
      };
    }
    this.version++;
  }

  private stepEase(time: number) {
    const ease = this.ease!;
    // Finished at once when the frames of easing have turned out too slow.
    const t = this.cost > budget ? 1 : Math.min(1, (time - ease.start) / easing);
    const e = 1 - (1 - t) ** 3;
    if (t >= 1) {
      this.places = ease.to;
      this.ease = undefined;
    } else {
      const { from, to } = ease;
      const left = new Float64Array(from.left.length);
      const width = new Float64Array(from.left.length);
      for (let c = 0; c < left.length; c++) {
        left[c] = from.left[c] + (to.left[c] - from.left[c]) * e;
        width[c] = from.width[c] + (to.width[c] - from.width[c]) * e;
      }
      this.places = { left, width };
    }
    this.shift = ease.at - this.places.left[ease.column];
    this.version++;
  }

  /** The chart's width on the sheet, with room for the round numbers. */
  private width() {
    const content = this.content!;
    return this.places.left[0] + gutter(content.cell);
  }

  /**
   * While the box is moving the sheet only ever grows, which never moves its
   * scroll. At rest, the layer goes back to the sheet's edge, the sheet takes
   * the chart's width, and the box is scrolled by however far the layer moved.
   */
  private fitSheet(time: number) {
    const content = this.content!;
    if (!content.collapse) return;
    const still = !this.touching && !this.ease && time - this.movedAt >= settling;
    const wanted = this.width();
    const now = parseFloat(this.sheet.style.width) || 0;
    if (!still) {
      if (this.shift + wanted > now) this.sheet.style.width = `${this.shift + wanted}px`;
      /*
       * Looked at again until at rest, while there is something to put right
       * then: a stitch held to let go of, or the sheet. A finger still down
       * looks again itself when it lifts.
       */
      if (!this.touching && (this.shift !== 0 || now !== wanted || this.target !== undefined)) this.schedule();
      return;
    }
    this.target = undefined;
    if (this.shift === 0 && now === wanted) return;
    const shift = this.shift;
    // Read before the sheet narrows, which may cut the box's scroll back to fit.
    const left = this.scroller.scrollLeft;
    this.sheet.style.width = `${wanted}px`;
    this.shift = 0;
    this.layer.style.transform = "";
    if (shift) this.scroller.scrollLeft = left - shift;
  }

  /**
   * Bring everything up to date with what is in view. `drawing` while the
   * chart itself is being drawn: then anything placed over the tiles is told
   * the columns moved on the next frame, not in the middle of the drawing,
   * which would only draw it again.
   */
  update(drawing = false) {
    const content = this.content;
    if (!content) return;
    const time = performance.now();
    let moved = false;
    if (content.collapse && this.live && this.map) {
      const live = this.live;
      const before = [live.first, live.last];
      const was = this.map;
      if (this.windowAt(this.scroller.scrollTop, content)) {
        const jumped = live.last < before[0] || live.first > before[1];
        this.moveColumns(time, jumped, was);
        moved = true;
      }
    }
    if (this.ease) {
      this.stepEase(time);
      moved = true;
    }
    const count = content.collapse ? this.map!.count : content.scene.layout.columns;
    if (count !== this.showingCount) this.container.dataset.columnsShowing = String((this.showingCount = count));
    this.fitSheet(time);
    this.layer.style.transform = this.shift ? `translateX(${this.shift}px)` : "";
    this.paintTiles(content, time, moved);
    this.placeNext(content);
    if (this.ease) this.schedule();
    if (moved || this.toTell) {
      if (drawing) {
        this.toTell = true;
        this.schedule();
      } else {
        this.toTell = false;
        this.onMove?.();
      }
    }
  }

  private paintTiles(content: TileContent, time: number, moved: boolean) {
    const view = this.showing();
    const { margin } = content;
    const chartWidth = this.width() + margin;
    const chartHeight = content.scene.layout.rows * content.cell;
    // Tiles are counted from the room left of the chart, so that is painted too.
    const span = (from: number, to: number, size: number) => [
      Math.max(0, Math.floor(from / tileSize)),
      Math.min(Math.ceil(size / tileSize) - 1, Math.floor((to - 1) / tileSize)),
    ];
    const near = (x0: number, x1: number, y0: number, y1: number) => [
      ...span(x0 + margin, x1 + margin, chartWidth),
      ...span(y0, y1, chartHeight),
    ];
    const [vx0, vx1, vy0, vy1] = near(view.x, view.x + view.width, view.y, view.y + view.height);
    const [tx0, tx1, ty0, ty1] = near(view.x - ahead, view.x + view.width + ahead, view.y - ahead, view.y + view.height + ahead);
    const state = this.stateFor(content);
    this.clock++;
    const wanted = new Set<string>();
    const stale: Tile[] = [];
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const key = `${tx}|${ty}`;
        wanted.add(key);
        let tile = this.tiles.get(key);
        if (!tile) {
          const canvas = this.canvas();
          tile = { key, tx, x: 0, y: ty * tileSize, canvas, painted: -1, used: 0 };
          canvas.style.left = `${tx * tileSize}px`;
          canvas.style.top = `${ty * tileSize}px`;
          this.tiles.set(key, tile);
        }
        // From the chart's own left edge, which moves against the tiles as the room left of it does with the cell size.
        tile.x = tx * tileSize - margin;
        tile.used = this.clock;
        if (tile.painted !== this.version) stale.push(tile);
      }
    }
    // What is in view first, then what is about to be, while there is time.
    const inView = (tile: Tile) => tile.tx >= vx0 && tile.tx <= vx1 && tile.y / tileSize >= vy0 && tile.y / tileSize <= vy1;
    let left = false;
    const fresh = stale.filter(inView);
    for (const tile of fresh) this.paint(tile, content, state);
    const spent = performance.now() - time;
    // A phone too slow to ease the columns has them moved at once instead, until it is quick enough again.
    if (moved && fresh.length > 0) this.cost = this.cost * 0.6 + spent * 0.4;
    for (const tile of stale.filter((tile) => !inView(tile))) {
      if (performance.now() - time > spent + spare) {
        left = true;
        break;
      }
      this.paint(tile, content, state);
    }
    if (left) this.schedule();
    // Keep only as many canvases as a phone can spare: the longest unused go first.
    if (this.tiles.size > most) {
      const old = [...this.tiles.values()].filter((tile) => !wanted.has(tile.key)).sort((a, b) => a.used - b.used);
      for (const tile of old.slice(0, this.tiles.size - most)) this.release(tile);
    }
  }

  private stateFor(content: TileContent): PaintState {
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

  /** The outline round the stitch to be worked next, on the layer with the tiles. */
  private placeNext(content: TileContent) {
    const at = content.follow === undefined ? undefined : this.placeOnLayer(content.follow);
    this.next.hidden = !at;
    if (!at) return;
    const style = this.next.style;
    style.left = `${at.x + content.margin - 1}px`;
    style.top = `${at.y - 1}px`;
    style.width = `${at.width + 2}px`;
    style.height = `${content.cell + 2}px`;
  }

  /** Where a stitch's cell is, from the chart's own left edge. */
  private placeOnLayer(id: number) {
    const content = this.content;
    if (!content) return undefined;
    const { scene, cell } = content;
    const row = scene.rowOf[id];
    if (!row) return undefined;
    const column = scene.columnOf[id];
    if (this.places.width[column] <= 0) return undefined;
    return { x: this.places.left[column], y: (scene.layout.rows - row) * cell, width: this.places.width[column] };
  }

  /** Where a stitch's cell is on the sheet, as the chart is drawn now. */
  place(id: number): { x: number; y: number } | undefined {
    const content = this.content;
    if (!content) return undefined;
    const { scene, cell } = content;
    const row = scene.rowOf[id];
    if (!row) return undefined;
    return { x: this.shift + this.places.left[scene.columnOf[id]], y: (scene.layout.rows - row) * cell };
  }

  /**
   * Hold this stitch still when the columns move, until the box comes to
   * rest: the chart is about to scroll to it. Counted as moving from now, so
   * the hold lasts until the scroll has had time to begin.
   */
  hold(id: number | undefined) {
    this.target = id;
    this.movedAt = performance.now();
    this.schedule();
  }

  /** The stitch at a point on screen, if any. */
  stitchAt(clientX: number, clientY: number): number | undefined {
    const content = this.content;
    if (!content) return undefined;
    const { scene, cell } = content;
    const box = this.layer.getBoundingClientRect();
    const x = clientX - box.left - content.margin;
    const y = clientY - box.top;
    const row = scene.layout.rows - Math.floor(y / cell);
    if (row < 1 || row > scene.layout.rows) return undefined;
    const { start, column, id } = scene.index;
    const { left, width } = this.places;
    // Along a row the columns run leftwards: find the first stitch whose right edge is left of the point.
    let low = start[row];
    let high = start[row + 1];
    while (low < high) {
      const k = (low + high) >> 1;
      if (left[column[k]] + width[column[k]] <= x) high = k;
      else low = k + 1;
    }
    const k = low - 1;
    if (k < start[row] || width[column[k]] <= 0 || x < left[column[k]]) return undefined;
    return id[k];
  }

  /**
   * After a zoom, where on the sheet the point zoomed about has got to: a
   * point `x` across the sheet before it, with the box to be scrolled `top`
   * down after it. The columns at the new size are those the rows then in
   * view need, so its place is worked out from the column it was in, not
   * scaled.
   */
  zoomedTo(x: number, top: number): number | undefined {
    const content = this.content;
    const before = this.before;
    if (!content || !before || !content.collapse) return undefined;
    // The column under the point, and how far across it, by the columns as they were drawn.
    const from = x - before.shift;
    const columns = content.scene.layout.columns;
    let column = 0;
    for (let c = 1; c <= columns; c++) {
      if (before.width[c] > 0 && before.left[c] <= from && from < before.left[c] + before.width[c]) {
        column = c;
        break;
      }
    }
    const across = column ? (from - before.left[column]) / before.width[column] : 0;
    this.windowAt(top, content);
    this.places = placesOf(this.map!, content.cell);
    this.shift = 0;
    this.ease = undefined;
    // The sheet takes the chart's new width now, before the box is scrolled to the point.
    this.sheet.style.width = `${this.width()}px`;
    this.layer.style.transform = "";
    this.version++;
    this.onMove?.();
    return this.places.left[column] + across * content.cell;
  }

  private canvas(): HTMLCanvasElement {
    const reused = this.spare.pop();
    if (reused) return reused;
    const canvas = document.createElement("canvas");
    canvas.style.width = `${tileSize}px`;
    canvas.style.height = `${tileSize}px`;
    this.layer.appendChild(canvas);
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
    this.scroller.removeEventListener("wheel", this.onScroll);
    this.scroller.removeEventListener("touchstart", this.onTouch);
    this.scroller.removeEventListener("touchend", this.onTouch);
    this.scroller.removeEventListener("touchcancel", this.onTouch);
    this.watch?.disconnect();
    for (const canvas of [...this.spare, ...[...this.tiles.values()].map((tile) => tile.canvas)]) {
      canvas.width = 0;
      canvas.height = 0;
      canvas.remove();
    }
    this.layer.remove();
    this.tiles.clear();
    this.spare = [];
  }
}
