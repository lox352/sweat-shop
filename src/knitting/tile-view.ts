import type { ChartScene } from "./chart-scene";
import type { Break } from "./breaks";
import { type ChartColours, type ChartOverlay, type PaintState, gutter, paintRegion } from "./chart-painter";
import { scrollAcross, scrollsFromRight } from "./scroll-corner";
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
 * changes, lays those lines out again, easing them to their new places
 * rather than jumping.
 *
 * Nothing here writes the box's scroll while it is moving: a phone ignores
 * a scroll set mid-fling, or stops the fling for it, and a smooth scroll set
 * going by the chart is cancelled by one. So the sheet keeps its size while
 * the box moves, and the tiles sit on a layer that slides across it with the
 * box's scroll: a scroll the part so far along the room the sheet gives it
 * shows the chart the same part of the way along, about a pivot that far
 * across the box, however many lines have opened or closed since - see
 * along. A scroll at an end shows that edge of the chart, either way and
 * both ways, so there is never an edge out of reach or blank sheet past one;
 * the lines either side of the pivot open out from it and close in on it;
 * and where the layer goes depends only on the scroll and the lines showing,
 * never on how they came to show, so nothing creeps. Only the stitch being
 * worked, on screen, or one scrolled or zoomed to, is held still, the layer
 * moved on by as much. Once the box has come to rest, the sheet takes the
 * chart's size, the layer goes back to its corner and the box is scrolled to
 * match, in the same frame, so nothing on screen moves.
 */

/** A tile's side, in CSS pixels. */
export const tileSize = 256;
/** How far past the box tiles are kept painted, for the next moment's scrolling. */
const ahead = 128;
/** The most canvases kept beyond those in view: at three device pixels to one, about two megabytes each. */
const most = 24;
/**
 * How long lines take to ease to their new places, in milliseconds: from
 * where each is and as fast as it is going - a line sent on again while on
 * its way, as one opening after another comes into view while the box
 * scrolls, goes on as fast as it was going rather than stopping for a frame
 * and setting off afresh - to its place, coming to rest there.
 */
const easing = 150;
/** A frame's length: an easing is begun a frame back, so a line set off moves in the frame it is set off in. */
const frameTime = 1000 / 60;
/** How long after the box last moved it counts as at rest. */
const settling = 150;
/**
 * Painting slower than this a frame, lines are moved at once rather than
 * eased: two frames' worth, so only a phone that can't ease them at all
 * moves them at once. Set much lower, one slow frame on a quick laptop was
 * enough to have the next lines to open jump there, now and then.
 */
const budget = 32;
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
export interface Places {
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
/** How far apart, in cells, the two sides of a break are kept: see columnPlaces. */
const torn = 0.45;

/**
 * The columns laid out side by side, and kept a little apart where the chart
 * is torn (see breaks): two stitches either side of a break, the columns
 * between them closed up, would otherwise stand together as if worked one
 * after the other. The room goes in at the left-hand edge of the stitch on
 * the right, and only as much of it as the columns showing between the two
 * leave wanting - none with the underarm's open between them.
 */
export const columnPlaces = (map: ColumnMap, cell: number, breaks: Break[] = []): Places => {
  const places = placesFrom(map.leftOf, map.shows, cell);
  if (breaks.length === 0) return places;
  const room = Math.round(cell * torn);
  const pairs = new Map<string, Break>();
  for (const one of breaks) pairs.set(`${one.right}:${one.left}`, one);
  // The narrowest first, so that one inside another counts as room the wider already has.
  const kept = new Map<number, number>();
  for (const { right, left } of [...pairs.values()].sort((a, b) => a.left - a.right - (b.left - b.right))) {
    let open = (map.leftOf[right] - map.leftOf[left] - map.shows[left]) * cell;
    for (const [at, gap] of kept) if (at >= right && at < left) open += gap;
    if (open < room) kept.set(right, Math.max(kept.get(right) ?? 0, room - open));
  }
  if (kept.size === 0) return places;
  // Every column at or to the right of the room kept moves right by it.
  let extra = 0;
  for (let column = places.start.length - 1; column >= 0; column--) {
    extra += kept.get(column) ?? 0;
    places.start[column] += extra;
  }
  return places;
};
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
 * How far either side of the pivot, in pixels, a line opening or closing is
 * shared between the two sides, for a box `size` long at `cell` a stitch:
 * half the box, so that what opens or closes in view opens out from the
 * pivot or closes in on it on both sides, the more on the side it is
 * nearer, and the share changes as evenly as the box moves. Never less
 * than half a cell, so a line the pivot is in opens out both ways.
 */
const spreadOver = (size: number, cell: number) => Math.max(cell / 2, size / 2);

/**
 * How far lines laid out `places` reach before the pivot `at`, a place along
 * the lines as laid out `rest` - those the sheet was last given the size of
 * - in pixels from the chart's near edge: all of those whose middle was
 * well before it then, none of those well after, and those within `spread`
 * of it in part, the nearer before it the more. Lines closed up then stand
 * at a point, and share alike as they open. A line closed up counts as the
 * merest sliver, so that every place reaches a little further than the one
 * before, and the pivot can always be found again from how far the lines
 * reach before it: see pivotAt.
 */
const reach = (rest: Places, places: Places, at: number, spread: number) => {
  const lines = places.size.length - 2;
  let total = 0;
  for (let line = 1; line <= lines; line++) {
    const middle = rest.start[line] + rest.size[line] / 2;
    const part = Math.min(1, Math.max(0, 0.5 + (at - middle) / (2 * spread)));
    if (part > 0) total += part * Math.max(places.size[line], sliver);
  }
  return total;
};

/** How wide a line closed up counts as, in pixels, to reach: far less than anything drawn. */
const sliver = 1e-6;

/** How far lines laid out `places` reach in all. */
const reachAll = (places: Places) => {
  let total = 0;
  for (let line = 1; line < places.size.length - 1; line++) total += Math.max(places.size[line], sliver);
  return total;
};

/** The pivot: the place along lines laid out `rest` that they reach `length` before. */
const pivotAt = (rest: Places, length: number, spread: number) => {
  let low = -spread - 1;
  let high = rest.start[0] + spread + 1;
  for (let step = 0; step < 60; step++) {
    const middle = (low + high) / 2;
    if (reach(rest, rest, middle, spread) < length) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
};

/**
 * The pivot for a scroll the part `part` of the way along lines laid out
 * `rest`, remembered for the last part asked of each: the scroll puts the
 * layer anew every frame, and the lines the room was made for stay the same
 * from one rest to the next.
 */
const pivots = new WeakMap<Places, { part: number; spread: number; pivot: number; all: number }>();
const pivotFor = (rest: Places, part: number, spread: number) => {
  let known = pivots.get(rest);
  if (!known || known.spread !== spread) {
    known = { part: NaN, spread, pivot: 0, all: reachAll(rest) };
    pivots.set(rest, known);
  }
  if (known.part !== part) {
    known.part = part;
    known.pivot = pivotAt(rest, part * known.all, spread);
  }
  return known.pivot;
};

/**
 * How far along lines laid out `places` a box `size` long goes for a scroll
 * the part `part` of the way along the room it has, from `near` before the
 * chart's near edge to `far` past its far one: about the pivot that lines
 * laid out `rest` - those the scroll's room was made for - reach that part
 * of the way before, the same part of the way along these as they reach
 * before it. So a scroll at an end shows that edge, however the lines have
 * changed since the room was made; the lines either side of the pivot open
 * out from it and close in on it as they change, each shared between the
 * two sides the more evenly the nearer it is, over half the box either side
 * (see spreadOver), so that no line opens one way or the other for being a
 * pixel either side of the pivot; and where the box goes depends only on the scroll and the
 * lines showing, never on how they came to show. With lines just as they
 * were, it is just as far along as the scroll is. A scroll is whole pixels
 * where the chart need not be, so one within a pixel of an end counts as at it.
 * A chart the box can't be scrolled along keeps the edge the box is scrolled
 * from where it is, the far edge if `home` is 1.
 */
export const along = (rest: Places, places: Places, part: number, size: number, near: number, far: number, home: number, cell: number) => {
  const spread = spreadOver(size, cell);
  const room = places.start[0] + near + far - size;
  if (room <= 2) return home ? places.start[0] + far - size : -near;
  const goes = part <= 0 || part >= 1 ? part : reach(rest, places, pivotFor(rest, part, spread), spread) / reachAll(places);
  return (goes <= 0 ? 0 : goes >= 1 ? room : 1 + goes * (room - 2)) - near;
};

/** Nought for what the sums of a slide come to by way of rounding: far less than a pixel. */
const clean = (shift: number) => (Math.abs(shift) < 1e-6 ? 0 : shift);

/**
 * One way across the chart, the columns or the rows: where its lines are
 * drawn now, where they are going, and how far the layer is moved along it.
 * The layer slides with the box's scroll, so that the box shows the chart
 * from edge to edge whatever lines have opened or closed since the sheet
 * last took the chart's size (see along, and `slide`), and is moved on from
 * there by `held`, to hold a line still when one is held.
 */
class Axis {
  places: Places;
  /** Where the lines are going, and where the layer will be when they get there. */
  target: Places;
  /** The lines the sheet was last given the size of. */
  rest: Places;
  shift = 0;
  targetShift = 0;
  /** How far the layer is moved on from where the scroll puts it, now and once the lines arrive. */
  held = 0;
  targetHeld = 0;
  /** Where the box's scroll puts the layer, with lines laid out so: nowhere but the sheet's edge until told. */
  slide: (places: Places) => number = () => 0;
  /** While easing: when it began, and where the lines and what is held were then, and how fast they were going. */
  private ease?: { start: number; from: Places; speed: Places; held: number; heldSpeed: number };
  /** How fast each line, and what is held, was going at the last frame, in pixels a millisecond: nothing at rest. */
  private speed?: { lines: Places; held: number };

  constructor(places: Places) {
    this.places = this.target = this.rest = places;
  }

  /** Laid out afresh, at once, with the layer back at the sheet's edge. */
  reset(places: Places) {
    this.places = this.target = this.rest = places;
    this.held = this.targetHeld = 0;
    this.ease = undefined;
    this.speed = undefined;
    this.follow();
  }

  /** The layer put where the scroll and what is held put it, for the scroll as it is. */
  follow() {
    this.shift = clean(this.slide(this.places) + this.held);
    this.targetShift = clean(this.slide(this.target) + this.targetHeld);
  }

  /** What is held made up to put the layer at `shift` now, and at `target` once the lines arrive. */
  private hold(shift: number, target: number) {
    const was = this.held;
    this.shift = shift;
    this.targetShift = target;
    this.held = shift - this.slide(this.places);
    this.targetHeld = target - this.slide(this.target);
    if (this.ease) this.ease.held += this.held - was;
  }

  /** Where a line is drawn now, from the sheet's edge. */
  at(line: number) {
    return this.shift + this.places.start[line];
  }

  /** Send the lines to `to`, the layer going where the scroll puts it, holding nothing more than it holds now. */
  send(to: Places) {
    this.target = to;
    this.targetShift = this.slide(to) + this.targetHeld;
  }

  /** Or to where it holds `line` where it is drawn now. */
  retarget(to: Places, line: number) {
    this.target = to;
    this.hold(this.shift, this.at(line) - to.start[line]);
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
    this.limit(from - Math.min(Math.max(from - this.targetShift, lowest), highest));
  }

  /** The layer sent to `target` instead, once the lines arrive. */
  limit(target: number) {
    this.hold(this.shift, target);
  }

  /**
   * Set off for the target: eased over the next frames from where the lines
   * are now, as fast as they are going, or there at once.
   */
  go(time: number, now: boolean) {
    if (now) {
      this.places = this.target;
      this.held = this.targetHeld;
      this.ease = undefined;
      this.speed = undefined;
    } else {
      const lines = this.places.start.length;
      this.ease = {
        start: time - frameTime,
        from: { start: this.places.start.slice(), size: this.places.size.slice() },
        speed: this.speed?.lines ?? { start: new Float64Array(lines), size: new Float64Array(lines) },
        held: this.held,
        heldSpeed: this.speed?.held ?? 0,
      };
    }
    this.follow();
  }

  get moving() {
    return this.ease !== undefined;
  }

  /**
   * A frame of the easing, or its end at once when `finish`: each line on a
   * cubic from where it was and how fast it was going when the easing began
   * to its place, at rest. What is held eases the same way, so a line held
   * stays where it is all the way.
   */
  step(time: number, finish: boolean) {
    const ease = this.ease!;
    const s = finish ? 1 : Math.min(1, (time - ease.start) / easing);
    if (s >= 1) {
      this.places = this.target;
      this.held = this.targetHeld;
      this.ease = undefined;
      this.speed = undefined;
      this.follow();
      return;
    }
    // Hermite's: where it was, how fast it was going, and where it comes to rest.
    const s2 = s * s;
    const s3 = s2 * s;
    const [from, by, to] = [2 * s3 - 3 * s2 + 1, (s3 - 2 * s2 + s) * easing, -2 * s3 + 3 * s2];
    // And how fast it is going, a millisecond.
    const [fromNow, byNow, toNow] = [(6 * s2 - 6 * s) / easing, 3 * s2 - 4 * s + 1, (6 * s - 6 * s2) / easing];
    const lines = ease.from.start.length;
    const places = { start: new Float64Array(lines), size: new Float64Array(lines) };
    const speed = { start: new Float64Array(lines), size: new Float64Array(lines) };
    for (const key of ["start", "size"] as const) {
      const [a, v, b] = [ease.from[key], ease.speed[key], this.target[key]];
      const [p, q] = [places[key], speed[key]];
      for (let line = 0; line < lines; line++) {
        p[line] = from * a[line] + by * v[line] + to * b[line];
        q[line] = fromNow * a[line] + byNow * v[line] + toNow * b[line];
      }
    }
    this.places = places;
    this.held = from * ease.held + by * ease.heldSpeed + to * this.targetHeld;
    this.speed = { lines: speed, held: fromNow * ease.held + byNow * ease.heldSpeed + toNow * this.targetHeld };
    this.follow();
  }

  /** The layer put `shift` along from the sheet's edge, at once, and kept there. */
  anchor(shift: number) {
    this.hold(shift, shift);
  }

  /**
   * The sheet's edge moved by `by` under the layer, from where it was when
   * the layer was last put: the layer moved back by as much, so nothing on
   * it moves, whatever the scroll now puts it at.
   */
  offset(by: number) {
    this.hold(this.shift - by, this.targetShift - by);
  }

  /**
   * At rest: the layer put back at the sheet's edge, and the lines as they
   * are made those the sheet has the size of. Says how far it had moved.
   */
  rebase(): number {
    const shift = this.shift;
    this.rest = this.places;
    this.held = this.targetHeld = 0;
    this.shift = this.targetShift = 0;
    return shift;
  }
}

/**
 * What the scroll harness (e2e/scroll) reads of a view, each frame: see
 * TileView.probe. A page opts in by setting `window.__chartViews` to an
 * array before it loads; then every view puts itself in it while it lives.
 */
export interface ViewProbe {
  /** The box's scroll and size, and the sheet's place and size in it. */
  scroll: { left: number; top: number; width: number; height: number; clientWidth: number; clientHeight: number };
  sheet: { left: number; top: number; width: number; height: number };
  /** How far the layer is moved across the sheet, now and once the lines arrive. */
  shift: { x: number; y: number; targetX: number; targetY: number };
  moving: { columns: boolean; rows: boolean };
  touching: boolean;
  /** What is held still: a stitch scrolled to, a zoom's column and row. */
  target?: number;
  point?: { column: number; row: number };
  columnsShowing: number;
  rowsShowing: number;
  cell: number;
  /** The chart's width and height as drawn now, and as the sheet was last sized for. */
  chart: { width: number; height: number };
  /** The tiles in the box not yet painted as the chart is now, as a share of its area. */
  unpainted: number;
  /** What a frame's painting has cost of late, in milliseconds. */
  cost: number;
}

type Registry = { __chartViews?: TileView[] };
const registry = (): TileView[] | undefined =>
  typeof window === "undefined" ? undefined : (window as unknown as Registry).__chartViews;

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
  /**
   * Told how far across the stitch being scrolled to has been moved: by
   * keeping the box inside the chart, which comes before holding it still.
   * Wherever the box was sent was worked out from where the stitch was, so it
   * is sent on by as much - or sent again, by nothing, when the sheet grows
   * under a smooth scroll on its way there.
   */
  onTargetMoved?: (by: number) => void;

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
    this.columns.slide = (places) => this.slideAcross(places);
    this.rows.slide = (places) => this.slideDown(places);
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
    registry()?.push(this);
  }

  /** What the scroll harness reads of the view: see ViewProbe. */
  probe(): ViewProbe {
    const { scroller, sheet } = this;
    const view = this.showing();
    let blank = 0;
    if (this.content) {
      // The tiles across the box, from the chart's own top left, that show an older chart than this one.
      for (const tile of this.tiles.values()) {
        if (tile.painted === this.version) continue;
        const across = Math.min(tile.x + tileSize, view.x + view.width) - Math.max(tile.x, view.x);
        const down = Math.min(tile.y + tileSize, view.y + view.height) - Math.max(tile.y, view.y);
        if (across > 0 && down > 0) blank += across * down;
      }
    }
    const size = this.content ? this.size() : { width: 0, height: 0 };
    return {
      scroll: {
        left: scroller.scrollLeft,
        top: scroller.scrollTop,
        width: scroller.scrollWidth,
        height: scroller.scrollHeight,
        clientWidth: scroller.clientWidth,
        clientHeight: scroller.clientHeight,
      },
      sheet: { left: sheet.offsetLeft, top: sheet.offsetTop, width: sheet.offsetWidth, height: sheet.offsetHeight },
      shift: { x: this.columns.shift, y: this.rows.shift, targetX: this.columns.targetShift, targetY: this.rows.targetShift },
      moving: { columns: this.columns.moving, rows: this.rows.moving },
      touching: this.touching,
      target: this.target,
      point: this.point,
      columnsShowing: this.columnMap?.count ?? 0,
      rowsShowing: this.rowMap?.count ?? 0,
      cell: this.content?.cell ?? 0,
      chart: size,
      unpainted: view.width * view.height > 0 ? blank / (view.width * view.height) : 0,
      cost: this.cost,
    };
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
      this.columns.reset(columnPlaces(this.columnMap!, content.cell, content.scene.breaks));
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
    this.columns.reset(columnPlaces(this.columnMap, content.cell, content.scene.breaks));
    this.rows.reset(rowPlaces(this.rowMap, content.cell));
    this.anchorColumns();
    if (content.collapse) this.settle(true);
    this.version++;
  }

  /**
   * A chart laid out afresh, its right-hand edge put at the sheet's, which
   * the box is scrolled from (see scroll-corner), whatever width the sheet
   * still is from the chart before: then what is in view is as far from that
   * edge as the box is, and the sheet takes the chart's width at rest with
   * nothing on screen moving. A box scrolled from the left has the chart at
   * the sheet's left-hand edge instead. Closed up, the layer slides with the
   * box's scroll to show the chart from edge to edge, whatever width the
   * sheet is (see along), and nothing more is needed.
   */
  private anchorColumns() {
    if (this.content?.collapse) return;
    const width = parseFloat(this.sheet.style.width) || 0;
    this.columns.anchor(scrollsFromRight(this.scroller) && width > 0 ? width - this.size().width : 0);
  }

  /**
   * Give the sheet a width, and keep everything on it where it is on screen
   * if `keep`: scrolled from its right-hand edge, the box holds that edge
   * still, so the sheet's left-hand edge moves as it grows or shrinks, and the
   * layer is moved back by as much. Scrolled from the left, nothing moves.
   */
  private sheetWidth(width: number, keep: boolean) {
    const was = this.sheet.offsetLeft;
    this.sheet.style.width = `${width}px`;
    if (keep) this.columns.offset(this.sheet.offsetLeft - was);
  }

  /**
   * Where the box's scroll across puts the layer, with columns laid out
   * `places`: from where the box is along the room it has to scroll, as the
   * sheet now is, to as far along those columns (see along). The box goes
   * past the chart by its own padding, the margin left for a join's arrow,
   * and the round numbers.
   */
  private slideAcross(places: Places): number {
    const content = this.content;
    const width = parseFloat(this.sheet.style.width) || 0;
    // A sheet with no size yet has no room to scroll along: the layer stays at its edge.
    if (!content?.collapse || width <= 0) return 0;
    const style = getComputedStyle(this.scroller);
    const near = (parseFloat(style.paddingLeft) || 0) + content.margin;
    const far = gutter(content.cell) + (parseFloat(style.paddingRight) || 0);
    const size = this.scroller.clientWidth;
    const room = width - gutter(content.cell) + near + far - size;
    // A sheet the box can't be scrolled along leaves the layer at its edge.
    if (room <= 2) return 0;
    const box = this.within(this.scroller.scrollLeft - this.sheet.offsetLeft, near, room);
    const home = scrollsFromRight(this.scroller) ? 1 : 0;
    return box - along(this.columns.rest, places, this.part(box + near, room), size, near, far, home, content.cell);
  }

  /** And down, with rows laid out `places`, the box going past the chart by its padding. */
  private slideDown(places: Places): number {
    const content = this.content;
    const height = parseFloat(this.sheet.style.height) || 0;
    if (!content?.collapse || height <= 0) return 0;
    const style = getComputedStyle(this.scroller);
    const near = parseFloat(style.paddingTop) || 0;
    const far = parseFloat(style.paddingBottom) || 0;
    const size = this.scroller.clientHeight;
    const room = height + near + far - size;
    if (room <= 2) return 0;
    const box = this.within(this.scroller.scrollTop - this.sheet.offsetTop, near, room);
    return box - along(this.rows.rest, places, this.part(box + near, room), size, near, far, 0, content.cell);
  }

  /**
   * A box `at` along the sheet as far as its scroll can take it: a phone
   * bouncing the box past an end moves what is on the sheet with it, as any
   * scroll would, the layer staying where the end put it.
   */
  private within(at: number, near: number, room: number) {
    return Math.min(room - near, Math.max(-near, at));
  }

  /** How far along `room` a box `at` along it is: at an end within a pixel of one, a scroll being whole pixels. */
  private part(at: number, room: number) {
    return Math.min(1, Math.max(0, (at - 1) / (room - 2)));
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
    let columns = false;
    let rows = false;
    for (let round = 0; round < rounds; round++) {
      const [first, last] = this.rowsInView(view().y);
      const columnsMoved = this.liveColumns!.moveTo(first, last);
      if (columnsMoved) {
        this.columnMap = mapOf(this.liveColumns!);
        const to = columnPlaces(this.columnMap, cell, content.scene.breaks);
        if (fresh) {
          this.columns.reset(to);
          this.anchorColumns();
        } else {
          const held = this.columnHeld();
          if (held !== undefined) {
            this.columns.retarget(to, held);
            this.keepColumnsInBox();
          } else this.columns.send(to);
        }
        columns = true;
      }
      const rowsMoved = this.liveRows!.moveTo(this.onScreen(view().x));
      if (rowsMoved) {
        this.rowMap = rowMapOf(this.liveRows!);
        const to = rowPlaces(this.rowMap, cell);
        if (fresh) this.rows.reset(to);
        else {
          const held = this.rowHeld();
          if (held !== undefined) {
            this.rows.retarget(to, held);
            this.keepRowsInBox();
          } else this.rows.send(to);
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
   * Which column to hold still as the columns move, if any: one being
   * scrolled or zoomed to, or the stitch being worked if it is on screen.
   * Otherwise the layer goes only where the box's scroll puts it (see
   * along), and holds no column of its own.
   */
  private columnHeld(): number | undefined {
    const { scene, follow } = this.content!;
    if (this.point) return this.point.column;
    if (this.target !== undefined && scene.rowOf[this.target]) return scene.columnOf[this.target];
    if (this.followShowing()) return scene.columnOf[follow!];
    return undefined;
  }

  /** And which row, likewise. */
  private rowHeld(): number | undefined {
    const { scene, follow } = this.content!;
    if (this.point) return this.point.row;
    if (this.target !== undefined && scene.rowOf[this.target]) return scene.rowOf[this.target];
    if (this.followShowing()) return scene.rowOf[follow!];
    return undefined;
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
   * Scrolled from the right, whether the chart's right-hand edge, as drawn
   * now, is within a box of the box's: near enough for the box to be
   * scrolled to it before rest, past which it can't be until then (see
   * keepColumnsInBox). Further off, columns opening between the two can
   * run on out of sight.
   */
  private nearRight(): boolean {
    if (!scrollsFromRight(this.scroller)) return false;
    const view = this.showing();
    return this.columns.places.start[0] <= view.x + 2 * view.width;
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
    const was = this.columns.targetShift;
    const [lowest, highest] = scrollAcross(this.scroller);
    this.columns.keepBox(this.scroller.scrollLeft - left, size, lowest - left, room);
    if (this.nearRight()) {
      /*
       * Nor carried out past the furthest right the box can go, which
       * holding a stitch still would do as columns close between it and
       * the edge: the box can't follow it there, and what it held would be
       * out of reach. Scrolled from the left, the sheet grows to meet it.
       *
       * Only with that edge within a box of the box, though. Further off,
       * columns opening between the two run on out of sight, and are taken
       * into the sheet at rest, as those closing there are: held back only
       * as they opened, the stitch held would creep a column each time.
       */
      const most = highest - left - (this.columns.target.start[0] + room - size);
      if (this.columns.targetShift > most) this.columns.targetShift = most;
    }
    const by = this.columns.targetShift - was;
    if (this.target !== undefined && Math.abs(by) >= 0.5) this.onTargetMoved?.(by);
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
    // Moved by a hundredth of a pixel or more: the sums of where the scroll puts the layer may come to less.
    const shifted = Math.abs(this.columns.shift) >= 0.01 || Math.abs(this.rows.shift) >= 0.01;
    if (!still) {
      if (width === 0) {
        // Nothing on it yet to keep still.
        this.sheetWidth(wanted.width, false);
        style.height = `${wanted.height}px`;
      } else if (this.target !== undefined && wanted.width > width) {
        /*
         * While the box is being sent to a stitch, a sheet too narrow for it
         * would leave the stitch out of reach until rest. So it grows,
         * keeping everything where it is on screen, and the box is sent
         * again to the same place, which the browser now counts from an
         * edge further away.
         */
        this.sheetWidth(wanted.width, true);
        this.onTargetMoved?.(0);
      }
      /*
       * Otherwise the sheet keeps its size until rest, whatever opens and
       * closes meanwhile: the layer slides with the box's scroll so that the
       * box shows the chart from edge to edge however wide or tall it has
       * grown or shrunk (see along), and a scroll under way is never moved.
       */
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
    /*
     * Read before the sheet shrinks, which may cut the box's scroll back to
     * fit. Scrolled from its right-hand edge, the box keeps its place as the
     * sheet shrinks away from it, the layer moving back by as much (see
     * sheetWidth): it is only scrolled across by however far the layer had
     * moved beyond that - nothing, when the columns that closed were all to
     * the left of the line held, as they most often are. A scroll set here
     * can be lost on a phone scrolling the box itself; one not set cannot.
     */
    const left = this.scroller.scrollLeft;
    const top = this.scroller.scrollTop;
    this.sheetWidth(wanted.width, width > 0);
    style.height = `${wanted.height}px`;
    const x = this.columns.rebase();
    const y = this.rows.rebase();
    this.layer.style.transform = "";
    if (Math.abs(x) >= 0.5) this.scroller.scrollLeft = left - x;
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
    // The layer goes where the box's scroll puts it, every frame.
    this.columns.follow();
    this.rows.follow();
    const rebased = this.fitSheet(time);
    // And again for the sheet as it is now, given a size or brought to rest.
    this.columns.follow();
    this.rows.follow();
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

  /** A stitch's cell on the sheet, as drawn now: nowhere while its column or row is closed up. For the scroll harness. */
  cellOnSheet(id: number): { x: number; y: number; width: number; height: number } | undefined {
    const at = this.placeOnLayer(id);
    return at && { ...at, x: at.x + this.columns.shift, y: at.y + this.rows.shift };
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
    this.columns.reset(columnPlaces(this.columnMap!, cell, scene.breaks));
    this.rows.reset(rowPlaces(this.rowMap!, cell));
    this.settle(true, () => {
      const at = place();
      return { x: at.x - inBox.x, y: at.y - inBox.y };
    });
    // The sheet takes the chart's new size now, before the box is scrolled to the point: the layer then at its edge.
    const size = this.size();
    this.sheet.style.width = `${size.width}px`;
    this.sheet.style.height = `${size.height}px`;
    // Where the scroll puts it once there, the lines being those the sheet has the size of.
    for (const axis of [this.columns, this.rows]) axis.shift = axis.targetShift = 0;
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
    const views = registry();
    if (views?.includes(this)) views.splice(views.indexOf(this), 1);
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
