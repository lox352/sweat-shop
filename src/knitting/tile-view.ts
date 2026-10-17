import type { ChartScene } from "./chart-scene";
import { type ChartColours, type ChartOverlay, type PaintState, gutter, paintRegion } from "./chart-painter";
import {
  type ColumnMap,
  LiveColumns,
  LiveRows,
  type RowMap,
  everyColumn,
  everyRow,
  indexColumns,
  mapOf,
  rowMapOf,
  rowsWithin,
} from "./column-window";
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
 * It also decides where each column and each row goes. Asked to close up,
 * it counts, as the box scrolls, which columns the rows in view need and
 * which rows the columns on screen need - see column-window - and when either
 * changes, lays those lines out again with one held still: the stitch being
 * worked, or an edge of the chart in view, or the line in the middle. The
 * lines ease to their new places rather than jumping.
 *
 * Holding a line still never writes the box's scroll while it is moving: a
 * phone ignores a scroll set mid-fling, or stops the fling for it, and a
 * smooth scroll set going by the chart is cancelled by one. So the tiles sit
 * on a layer that is moved across the sheet instead, and only once the box
 * has come to rest is the layer put back at the sheet's corner and the box
 * scrolled to match, in the same frame, so nothing on screen moves.
 */

/** A tile's side, in CSS pixels. */
export const tileSize = 256;
/** How far past the box tiles are kept painted, for the next moment's scrolling. */
const ahead = 128;
/** The most canvases kept beyond those in view: at three device pixels to one, about two megabytes each. */
const most = 24;
/** How long lines take to ease to their new places, in milliseconds. */
const easing = 150;
/** How long after the box last moved it counts as at rest. */
const settling = 150;
/** Painting slower than this a frame, lines are moved at once rather than eased. */
const budget = 12;
/** And no more than this a frame on tiles out of view, to have them ready. */
const spare = 6;
/**
 * How many times a frame the columns and the rows are let settle on each
 * other: the rows in view decide the columns, the columns on screen the rows.
 */
const rounds = 4;

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
  /** Close up the columns no row in view has a stitch in, and the rows no column on screen has. */
  collapse?: boolean;
  /** The stitch to be worked next: outlined, and held still when lines move. */
  follow?: number;
}

/**
 * Each line's leading edge from the chart's own top left corner - a
 * column's left, a row's top - and its size: a cell, or none closed up.
 */
interface Places {
  start: Float64Array;
  size: Float64Array;
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

/** Lines laid out side by side, each as many cells in as there are lines showing before it. */
const placesFrom = (before: Int32Array, shows: Uint8Array, cell: number): Places => {
  const start = new Float64Array(before.length);
  const size = new Float64Array(before.length);
  for (let line = 0; line < start.length; line++) {
    start[line] = before[line] * cell;
    size[line] = shows[line] ? cell : 0;
  }
  return { start, size };
};
const columnPlaces = (map: ColumnMap, cell: number) => placesFrom(map.leftOf, map.shows, cell);
const rowPlaces = (map: RowMap, cell: number) => placesFrom(map.above, map.shows, cell);

/**
 * The line a point `at` along an axis is in, by `places`, and how far into
 * it at the new `cell`, `ratio` times the old. Lines run from line `lines + 1`
 * at the sheet's edge, nought, to line 0 at the chart's far edge; a point
 * past either edge is held by that edge.
 */
const lineAt = (places: Places, lines: number, at: number, cell: number, ratio: number) => {
  const { start, size } = places;
  if (at >= start[0]) return { line: 0, offset: (at - start[0]) * ratio };
  if (at < start[lines + 1]) return { line: lines + 1, offset: (at - start[lines + 1]) * ratio };
  // The furthest line showing that begins before the point.
  let found = -1;
  for (let line = 1; line <= lines; line++) {
    if (size[line] > 0 && start[line] <= at && (found < 0 || start[line] > start[found])) found = line;
  }
  if (found < 0) return { line: lines + 1, offset: 0 };
  return { line: found, offset: (Math.min(at - start[found], size[found]) / size[found]) * cell };
};

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * One way across the chart, the columns or the rows: where its lines are
 * drawn now, where they are going, and how far the layer is moved along it
 * while they go, to hold one line still.
 */
class Axis {
  places: Places;
  /** Where the lines are going, and where the layer will be when they get there. */
  target: Places;
  shift = 0;
  targetShift = 0;
  private ease?: { from: Places; shift: number; start: number };

  constructor(places: Places) {
    this.places = this.target = places;
  }

  /** Laid out afresh, at once, with the layer back at the sheet's edge. */
  reset(places: Places) {
    this.places = this.target = places;
    this.shift = this.targetShift = 0;
    this.ease = undefined;
  }

  /** Where a line is drawn now, from the sheet's edge. */
  at(line: number) {
    return this.shift + this.places.start[line];
  }

  /** Send the lines to `to`, and the layer to where it holds `line` where it is drawn now. */
  retarget(to: Places, line: number) {
    this.target = to;
    this.targetShift = this.at(line) - to.start[line];
  }

  /**
   * And the layer only as near there as leaves the box, `from` along the
   * sheet and `size` long, inside the chart once the lines arrive, as its
   * scroll will have to at rest: never back past `lowest`, where its scroll
   * is nought, nor on past the chart's far edge, line 0, and the `room` the
   * box scrolls on beyond it.
   */
  keepBox(from: number, size: number, lowest: number, room = 0) {
    const highest = Math.max(lowest, this.target.start[0] + room - size);
    this.targetShift = from - Math.min(Math.max(from - this.targetShift, lowest), highest);
  }

  /** Set off for the target: eased over the next frames from where the lines are now, or there at once. */
  go(time: number, now: boolean) {
    if (now) {
      this.places = this.target;
      this.shift = this.targetShift;
      this.ease = undefined;
    } else {
      const from = { start: this.places.start.slice(), size: this.places.size.slice() };
      this.ease = { from, shift: this.shift, start: time };
    }
  }

  get moving() {
    return this.ease !== undefined;
  }

  /**
   * A frame of the easing, or its end at once when `finish`. The layer eases
   * with the lines, so the line it holds stays where it is all the way.
   */
  step(time: number, finish: boolean) {
    const ease = this.ease!;
    const t = finish ? 1 : Math.min(1, (time - ease.start) / easing);
    if (t >= 1) {
      this.places = this.target;
      this.shift = this.targetShift;
      this.ease = undefined;
      return;
    }
    const e = 1 - (1 - t) ** 3;
    const { from } = ease;
    const to = this.target;
    const start = new Float64Array(from.start.length);
    const size = new Float64Array(from.start.length);
    for (let line = 0; line < start.length; line++) {
      start[line] = from.start[line] + (to.start[line] - from.start[line]) * e;
      size[line] = from.size[line] + (to.size[line] - from.size[line]) * e;
    }
    this.places = { start, size };
    this.shift = ease.shift + (this.targetShift - ease.shift) * e;
  }

  /** At rest: the layer put back at the sheet's edge. Says how far it had moved. */
  rebase(): number {
    const shift = this.shift;
    this.shift = this.targetShift = 0;
    return shift;
  }
}

export class TileView {
  private tiles = new Map<string, Tile>();
  private spare: HTMLCanvasElement[] = [];
  private content?: TileContent;
  private version = 0;
  private frame = 0;
  private clock = 0;
  private ratio = 1;

  /** The layer the tiles and the next stitch's outline are on, moved across the sheet by the axes' shifts. */
  private readonly layer: HTMLDivElement;
  private readonly next: HTMLDivElement;
  private columns = new Axis({ start: new Float64Array(0), size: new Float64Array(0) });
  private rows = new Axis({ start: new Float64Array(0), size: new Float64Array(0) });
  private liveColumns?: LiveColumns;
  private liveRows?: LiveRows;
  private columnMap?: ColumnMap;
  private rowMap?: RowMap;
  /** Where the lines were before the cell size last changed, and at what size, to zoom about. */
  private before?: { columns: Places; rows: Places; x: number; y: number; cell: number };
  /** A stitch to hold still while lines move: one the chart is scrolling to. */
  private target?: number;
  /** A column and row to hold still while lines move: those a zoom was about. */
  private point?: { column: number; row: number };
  private touching = false;
  private movedAt = 0;
  /** What painting the tiles in view costs a frame while lines move, smoothed; easing stops while it is over budget. */
  private cost = 0;
  /** Lines moved while the chart was being drawn, which is told of on the next frame instead. */
  private toTell = false;
  /** How many columns and rows show, as the tiles' data attributes say. */
  private shown = "";
  /** Told when lines move, for anything placed over the chart outside the tiles. */
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
      this.before = {
        columns: this.columns.places,
        rows: this.rows.places,
        x: this.columns.shift,
        y: this.rows.shift,
        cell: was.cell,
      };
      // The same lines showing, at the new size; which show is looked at again once the box has its new scroll.
      this.columns.reset(columnPlaces(this.columnMap!, content.cell));
      this.rows.reset(rowPlaces(this.rowMap!, content.cell));
      this.version++;
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

  /** A new chart: every line showing to begin with, then those the box needs, laid out at once. */
  private reset(content: TileContent) {
    const { layout, index } = content.scene;
    this.container.dataset.columns = String(layout.columns);
    this.container.dataset.rows = String(layout.rows);
    this.liveColumns = new LiveColumns(index);
    this.liveRows = new LiveRows(indexColumns(index));
    this.columnMap = everyColumn(layout.columns);
    this.rowMap = everyRow(layout.rows);
    this.columns.reset(columnPlaces(this.columnMap, content.cell));
    this.rows.reset(rowPlaces(this.rowMap, content.cell));
    if (content.collapse) this.settle(true);
    this.version++;
  }

  /** What of the chart the box shows, from the chart's own top left: where the lines are drawn, or going. */
  private showing(going = false) {
    const x = this.scroller.scrollLeft - this.sheet.offsetLeft - (going ? this.columns.targetShift : this.columns.shift);
    const y = this.scroller.scrollTop - this.sheet.offsetTop - (going ? this.rows.targetShift : this.rows.shift);
    return { x, y, width: this.scroller.clientWidth, height: this.scroller.clientHeight };
  }

  /**
   * Let the columns and rows settle on each other: the rows in view decide
   * the columns, and the columns on screen decide the rows, each counted by
   * where the lines are going, so that easing never moves the window. Says
   * which changed. `fresh` lays them out at once, with nothing to hold still,
   * and `view` is where the box's top left corner is on the chart.
   */
  private settle(fresh: boolean, view: () => { x: number; y: number } = () => this.showing(true)): { columns: boolean; rows: boolean } {
    const content = this.content!;
    const { cell } = content;
    const wasColumns = this.columnMap!;
    const wasRows = this.rowMap!;
    let columns = false;
    let rows = false;
    for (let round = 0; round < rounds; round++) {
      const [first, last] = this.rowsInView(view().y);
      const columnsMoved = this.liveColumns!.moveTo(first, last);
      if (columnsMoved) {
        this.columnMap = mapOf(this.liveColumns!);
        const to = columnPlaces(this.columnMap, cell);
        if (fresh) this.columns.reset(to);
        else {
          this.columns.retarget(to, this.columnHeld(wasColumns));
          this.keepColumnsInBox();
        }
        columns = true;
      }
      const rowsMoved = this.liveRows!.moveTo(this.onScreen(view().x));
      if (rowsMoved) {
        this.rowMap = rowMapOf(this.liveRows!);
        const to = rowPlaces(this.rowMap, cell);
        if (fresh) this.rows.reset(to);
        else {
          this.rows.retarget(to, this.rowHeld(wasRows, to));
          this.keepRowsInBox();
        }
        rows = true;
      }
      if (!columnsMoved && !rowsMoved) break;
    }
    return { columns, rows };
  }

  /**
   * The rows in view, by where they are going, with the box `y` down the
   * chart: those any part of which is in it. Never none: a box off the chart,
   * flung past its edge while the sheet is still large or not yet caught up
   * with a zoom, counts the rows nearest it, as a box at that edge would.
   * With no rows there would be no columns, and so no rows ever again.
   *
   * Measured by the box's outer size, so a scrollbar coming or going cannot
   * feed back into it; and so are the columns on screen.
   */
  private rowsInView(y: number): [number, number] {
    const lines = this.content!.scene.layout.rows;
    const { start, size } = this.rows.target;
    const span = this.scroller.offsetHeight;
    const within = (from: number) => rowsWithin(start, size, lines, from, from + span);
    let [first, last] = within(y);
    if (last < first) [first, last] = within(y < 0 ? 0 : Math.max(0, start[0] - span));
    return last < first ? [1, lines] : [first, last];
  }

  /** The columns on screen, by where they are going: those any part of which is in the box, and never none, as for the rows. */
  private onScreen(x: number): Int32Array {
    const order = this.columnMap!.order;
    const { start, size } = this.columns.target;
    const span = this.scroller.offsetWidth;
    const firstWhere = (test: (k: number) => boolean) => {
      let low = 0;
      let high = order.length;
      while (low < high) {
        const k = (low + high) >> 1;
        if (test(k)) high = k;
        else low = k + 1;
      }
      return low;
    };
    // Left to right along the order, so both edges rise.
    const within = (left: number) => [
      firstWhere((k) => start[order[k]] + size[order[k]] > left),
      firstWhere((k) => start[order[k]] >= left + span),
    ];
    let [from, to] = within(x);
    if (from >= to) [from, to] = within(x < 0 ? 0 : Math.max(0, start[0] - span));
    return from < to ? order.subarray(from, to) : order;
  }

  /** Mark stale the tiles across the rows whose stitches changed from done to to do, or back. */
  private progressed(from: number, to: number) {
    const { scene } = this.content!;
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
    const { start, size } = this.rows.places;
    const top = start[last];
    const bottom = start[first] + size[first];
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

  /** Whether the stitch to be worked next is on screen, as drawn now. */
  private followShowing(): boolean {
    const content = this.content!;
    const at = content.follow === undefined ? undefined : this.placeOnLayer(content.follow);
    if (!at) return false;
    const view = this.showing();
    return at.x < view.x + view.width && at.x + at.width > view.x && at.y < view.y + view.height && at.y + at.height > view.y;
  }

  /**
   * Which column to hold still as the columns move: one being scrolled or
   * zoomed to, the stitch being worked if it is on screen, an edge of the
   * chart in view - the right one first, where a chart is read from - or else
   * the column in the middle of the box that shows before and after. Never
   * one off screen while the box is not scrolling to it: holding that still
   * would slide what is on screen sideways.
   */
  private columnHeld(was: ColumnMap): number {
    const { scene, follow } = this.content!;
    if (this.point) return this.point.column;
    if (this.target !== undefined && scene.rowOf[this.target]) return scene.columnOf[this.target];
    if (this.followShowing()) return scene.columnOf[follow!];
    const view = this.showing();
    const columns = scene.layout.columns;
    const { start, size } = this.columns.places;
    if (start[0] >= view.x && start[0] <= view.x + view.width) return 0;
    if (start[columns + 1] >= view.x && start[columns + 1] <= view.x + view.width) return columns + 1;
    return this.middle(was.order, start, size, view.x + view.width / 2, this.columnMap!.shows) ?? 0;
  }

  /**
   * And which row, going `to` new places: one being scrolled or zoomed to,
   * the stitch being worked if it is on screen, an edge of the chart in view -
   * the bottom first, where a chart is read from - or else the row in the
   * middle of the box that shows before and after. An edge only while holding
   * it keeps that middle row in the box: rows open and close by the dozen -
   * the whole yoke, under the stitches cast on at an underarm - and holding
   * the edge below them still would send what is on screen off the top.
   */
  private rowHeld(was: RowMap, to: Places): number {
    const { scene, follow } = this.content!;
    if (this.point) return this.point.row;
    if (this.target !== undefined && scene.rowOf[this.target]) return scene.rowOf[this.target];
    if (this.followShowing()) return scene.rowOf[follow!];
    const view = this.showing();
    const rows = scene.layout.rows;
    const { start, size } = this.rows.places;
    const middle = this.middle(was.order, start, size, view.y + view.height / 2, this.rowMap!.shows) ?? 0;
    // How far holding a line still would move the row in the middle.
    const moves = (line: number) => Math.abs(to.start[middle] - to.start[line] - (start[middle] - start[line]));
    for (const edge of [0, rows + 1]) {
      const inView = start[edge] >= view.y && start[edge] <= view.y + view.height;
      if (inView && moves(edge) < view.height / 2) return edge;
    }
    return middle;
  }

  /**
   * Have the rows, once there, fill the box up and down as its scroll will
   * at rest. Rows closing between the row held and an edge of the chart in
   * view would pull that edge into the box, and leave a gap for the box to
   * jump across when it comes to rest; then the edge is held still instead.
   * Not while the box is being scrolled to a stitch, or zoomed about one:
   * where it is going was worked out from that stitch's place on the sheet.
   */
  private keepRowsInBox() {
    if (this.target !== undefined || this.point) return;
    const top = this.sheet.offsetTop;
    this.rows.keepBox(this.scroller.scrollTop - top, this.scroller.clientHeight, -top);
  }

  /**
   * And the columns, always but while zoomed about a point: the box stays
   * inside the chart as the columns move, however those between the line
   * held and an edge open or close. Above all, the chart's right-hand edge -
   * column 1, and the round numbers beside it - is never carried into the
   * box, as it would be when columns close between it and a stitch held
   * still near it: the box can't be scrolled past that edge, so there would
   * be nothing in the gap, and the box would only be put right at rest, by a
   * scroll a phone can lose. A chart narrower than the box has nothing to
   * scroll, and is left as it is.
   */
  private keepColumnsInBox() {
    if (this.point) return;
    const size = this.scroller.clientWidth;
    // The chart, its round numbers, and the box's own padding past them.
    const room = gutter(this.content!.cell) + (parseFloat(getComputedStyle(this.scroller).paddingRight) || 0);
    if (this.columns.target.start[0] + room < size) return;
    const left = this.sheet.offsetLeft;
    this.columns.keepBox(this.scroller.scrollLeft - left, size, -left, room);
  }

  /** The line under `at` along `order`, by where lines are drawn now, or the nearest to it that `shows`. */
  private middle(order: Int32Array, start: Float64Array, size: Float64Array, at: number, shows: Uint8Array) {
    let low = 0;
    let high = order.length - 1;
    while (low < high) {
      const k = (low + high) >> 1;
      if (start[order[k]] + size[order[k]] <= at) low = k + 1;
      else high = k;
    }
    for (let step = 0; step < order.length; step++) {
      for (const k of [low - step, low + step]) {
        const line = order[k];
        if (line !== undefined && shows[line]) return line;
      }
    }
    return undefined;
  }

  /** The chart's width on the sheet, with room for the round numbers, and its height. */
  private size() {
    const content = this.content!;
    return {
      width: this.columns.places.start[0] + gutter(content.cell),
      height: this.rows.places.start[0],
    };
  }

  /**
   * While the box is moving the sheet only ever grows, which never moves its
   * scroll. At rest, the layer goes back to the sheet's corner, the sheet
   * takes the chart's size, and the box is scrolled by however far the layer
   * moved. Says whether the layer moved, and with it every place on the sheet.
   */
  private fitSheet(time: number): boolean {
    const content = this.content!;
    const wanted = this.size();
    const style = this.sheet.style;
    if (!content.collapse) {
      style.width = `${wanted.width}px`;
      style.height = `${wanted.height}px`;
      return false;
    }
    const still = !this.touching && !this.columns.moving && !this.rows.moving && time - this.movedAt >= settling;
    const width = parseFloat(style.width) || 0;
    const height = parseFloat(style.height) || 0;
    const shifted = this.columns.shift !== 0 || this.rows.shift !== 0;
    if (!still) {
      if (this.columns.shift + wanted.width > width) style.width = `${this.columns.shift + wanted.width}px`;
      if (this.rows.shift + wanted.height > height) style.height = `${this.rows.shift + wanted.height}px`;
      /*
       * Looked at again until at rest, while there is something to put right
       * then: a stitch or a point held to let go of, or the sheet. A finger
       * still down looks again itself when it lifts.
       */
      const owed = shifted || width !== wanted.width || height !== wanted.height || this.target !== undefined || this.point;
      if (!this.touching && owed) this.schedule();
      return false;
    }
    this.target = undefined;
    this.point = undefined;
    if (!shifted && width === wanted.width && height === wanted.height) return false;
    // Read before the sheet shrinks, which may cut the box's scroll back to fit.
    const left = this.scroller.scrollLeft;
    const top = this.scroller.scrollTop;
    style.width = `${wanted.width}px`;
    style.height = `${wanted.height}px`;
    const x = this.columns.rebase();
    const y = this.rows.rebase();
    this.layer.style.transform = "";
    if (x) this.scroller.scrollLeft = left - x;
    if (y) this.scroller.scrollTop = top - y;
    return shifted;
  }

  /**
   * Bring everything up to date with what is in view. `drawing` while the
   * chart itself is being drawn: then anything placed over the tiles is told
   * lines moved on the next frame, not in the middle of the drawing, which
   * would only draw it again.
   */
  update(drawing = false) {
    const content = this.content;
    if (!content) return;
    const time = performance.now();
    let moved = false;
    if (content.collapse && this.liveColumns && this.liveRows) {
      const live = { columns: this.liveColumns, rows: this.liveRows };
      const rowsWere = [live.columns.first, live.columns.last];
      const columnsWere = [live.rows.low, live.rows.high];
      const changed = this.settle(false);
      if (changed.columns || changed.rows) {
        // Nothing in view before still in view, either way: easing would only sweep the lines across the box.
        const jumped =
          live.columns.last < rowsWere[0] ||
          live.columns.first > rowsWere[1] ||
          live.rows.high < columnsWere[0] ||
          live.rows.low > columnsWere[1];
        const now = jumped || this.cost > budget || reducedMotion();
        if (changed.columns) this.columns.go(time, now);
        if (changed.rows) this.rows.go(time, now);
        this.version++;
        moved = true;
      }
    }
    for (const axis of [this.columns, this.rows]) {
      if (!axis.moving) continue;
      // Finished at once when the frames of easing have turned out too slow.
      axis.step(time, this.cost > budget);
      this.version++;
      moved = true;
    }
    const shown = `${this.columnMap?.count ?? 0}|${this.rowMap?.count ?? 0}`;
    if (shown !== this.shown) {
      this.shown = shown;
      this.container.dataset.columnsShowing = String(this.columnMap?.count ?? 0);
      this.container.dataset.rowsShowing = String(this.rowMap?.count ?? 0);
    }
    const rebased = this.fitSheet(time);
    const { shift: x } = this.columns;
    const { shift: y } = this.rows;
    this.layer.style.transform = x || y ? `translate(${x}px, ${y}px)` : "";
    this.paintTiles(content, time, moved);
    this.placeNext(content);
    if (this.columns.moving || this.rows.moving) this.schedule();
    if (moved || rebased || this.toTell) {
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
    const size = this.size();
    const chartWidth = size.width + margin;
    const chartHeight = size.height;
    // Tiles are counted from the room left of the chart, so that is painted too.
    const span = (from: number, to: number, extent: number) => [
      Math.max(0, Math.floor(from / tileSize)),
      Math.min(Math.ceil(extent / tileSize) - 1, Math.floor((to - 1) / tileSize)),
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
    // A phone too slow to ease the lines has them moved at once instead, until it is quick enough again.
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
      left: this.columns.places.start,
      width: this.columns.places.size,
      top: this.rows.places.start,
      height: this.rows.places.size,
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
    style.height = `${at.height + 2}px`;
  }

  /** Where a stitch's cell is drawn, from the chart's own top left: nowhere while its column or row is closed up. */
  private placeOnLayer(id: number) {
    const content = this.content;
    if (!content) return undefined;
    const { scene } = content;
    const row = scene.rowOf[id];
    if (!row) return undefined;
    const column = scene.columnOf[id];
    const width = this.columns.places.size[column];
    const height = this.rows.places.size[row];
    if (width <= 0 || height <= 0) return undefined;
    return { x: this.columns.places.start[column], y: this.rows.places.start[row], width, height };
  }

  /** Where a stitch's cell is on the sheet, as the chart is drawn now. */
  place(id: number): { x: number; y: number } | undefined {
    const content = this.content;
    if (!content) return undefined;
    const { scene } = content;
    const row = scene.rowOf[id];
    if (!row) return undefined;
    return { x: this.columns.at(scene.columnOf[id]), y: this.rows.at(row) };
  }

  /**
   * Hold this stitch still when lines move, until the box comes to rest: the
   * chart is about to scroll to it. Counted as moving from now, so the hold
   * lasts until the scroll has had time to begin.
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
    const { scene } = content;
    const box = this.layer.getBoundingClientRect();
    const x = clientX - box.left - content.margin;
    const y = clientY - box.top;
    const row = this.rowAt(y);
    if (row === undefined) return undefined;
    const { start, column, id } = scene.index;
    const { start: left, size: width } = this.columns.places;
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

  /** The row drawn across a point `y` down the chart, if any. */
  private rowAt(y: number): number | undefined {
    const rows = this.content!.scene.layout.rows;
    const { start, size } = this.rows.places;
    // Rows rise as their number does, so their tops fall: the lowest row whose top is above the point.
    let low = 1;
    let high = rows + 1;
    while (low < high) {
      const row = (low + high) >> 1;
      if (start[row] <= y) high = row;
      else low = row + 1;
    }
    return low <= rows && size[low] > 0 && y < start[low] + size[low] ? low : undefined;
  }

  /**
   * After a zoom, where on the sheet the point zoomed about has got to: a
   * point `x` across and `y` down the sheet before it, which is to be put back
   * at `screenX`, `screenY` on screen. Its place is worked out from the column
   * and row it was in, not scaled, with the lines showing that the box needs
   * once scrolled there, laid out at once; that column and row are then held
   * still while any others the box turns out to need come and go.
   */
  zoomedTo(x: number, y: number, screenX: number, screenY: number): { x: number; y: number } | undefined {
    const content = this.content;
    const before = this.before;
    if (!content || !before || !content.collapse) return undefined;
    const { cell, scene } = content;
    const ratio = cell / before.cell;
    const column = lineAt(before.columns, scene.layout.columns, x - before.x, cell, ratio);
    const row = lineAt(before.rows, scene.layout.rows, y - before.y, cell, ratio);
    this.point = { column: column.line, row: row.line };
    this.movedAt = performance.now();
    const place = () => ({
      x: this.columns.places.start[column.line] + column.offset,
      y: this.rows.places.start[row.line] + row.offset,
    });
    // Where in the box the point will be, and so what of the chart the box will show.
    const box = this.scroller.getBoundingClientRect();
    const inBox = { x: screenX - box.left - this.scroller.clientLeft, y: screenY - box.top - this.scroller.clientTop };
    this.columns.reset(columnPlaces(this.columnMap!, cell));
    this.rows.reset(rowPlaces(this.rowMap!, cell));
    this.settle(true, () => {
      const at = place();
      return { x: at.x - inBox.x, y: at.y - inBox.y };
    });
    // The sheet takes the chart's new size now, before the box is scrolled to the point.
    const size = this.size();
    this.sheet.style.width = `${size.width}px`;
    this.sheet.style.height = `${size.height}px`;
    this.layer.style.transform = "";
    this.version++;
    this.onMove?.();
    // Painted once the box has its new scroll.
    this.schedule();
    return place();
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
