/**
 * Where the box's scroll puts the chart, as lines open and close: the
 * pivot, measured along lines laid out as they were, that a scroll the part
 * so far along the room the sheet gives it reaches the same part of the way
 * before; and where the box goes along the lines as they are, about it (see
 * along). Taken out of tile-view, which lays the tiles out by it, so that
 * the rest of how the chart scrolls can be worked out from it alone.
 */

/**
 * Each line's leading edge from the chart's own top left corner - a
 * column's left, a row's top - and its size: a cell, or none closed up.
 */
export interface Places {
  start: Float64Array;
  size: Float64Array;
}

/**
 * How far either side of the pivot, in pixels, a line opening or closing is
 * shared between the two sides, for a box `size` long at `cell` a stitch:
 * half the box, so that what opens or closes in view opens out from the
 * pivot or closes in on it on both sides, the more on the side it is
 * nearer, and the share changes as evenly as the box moves. Never less
 * than half a cell, so a line the pivot is in opens out both ways.
 */
export const spreadOver = (size: number, cell: number) => Math.max(cell / 2, size / 2);

/**
 * How far lines laid out `places` reach before the pivot `at`, a place along
 * the lines as laid out `ref` - the lines the pivot is measured along, see
 * keepsRef - in pixels from the chart's near edge: all of those whose middle
 * was well before it there, none of those well after, and those within
 * `spread` of it in part, the nearer before it the more. Lines closed up
 * there stand at a point, and share alike as they open. A line closed up
 * counts as the merest sliver, so that every place reaches a little further
 * than the one before, and the pivot can always be found again from how far
 * the lines reach before it: see pivotAt.
 */
export const reach = (ref: Places, places: Places, at: number, spread: number) => {
  const lines = places.size.length - 2;
  let total = 0;
  for (let line = 1; line <= lines; line++) {
    const middle = ref.start[line] + ref.size[line] / 2;
    const part = Math.min(1, Math.max(0, 0.5 + (at - middle) / (2 * spread)));
    if (part > 0) total += part * Math.max(places.size[line], sliver);
  }
  return total;
};

/** How wide a line closed up counts as, in pixels, to reach: far less than anything drawn. */
const sliver = 1e-6;

/** How far lines laid out `places` reach in all. */
export const reachAll = (places: Places) => {
  let total = alls.get(places);
  if (total === undefined) {
    total = 0;
    for (let line = 1; line < places.size.length - 1; line++) total += Math.max(places.size[line], sliver);
    alls.set(places, total);
  }
  return total;
};
const alls = new WeakMap<Places, number>();

/**
 * How far lines laid out `places` reach before every place along lines laid
 * out `ref`, at once: see reach, which this is, worked out ahead. Each line
 * counts in part over `spread` either side of its middle, the more the
 * further on, so how far they reach is a run of straight stretches, bending
 * where a line begins or ends counting in part. Found once for the lines,
 * how far they reach before a place is then a search among the bends, and
 * the place they reach a length before is the same search the other way:
 * the layer is put for many scrolls at once as the box scrolls (see
 * slideWithScroll), and each, worked out line by line, was most of a
 * frame's work.
 */
export class Reach {
  /** Where each bend is, how far the lines reach there, and how much further they reach a pixel on. */
  private readonly at: Float64Array;
  private readonly reaches: Float64Array;
  private readonly slopes: Float64Array;

  constructor(ref: Places, places: Places, spread: number) {
    const lines = places.size.length - 2;
    const bends: { at: number; by: number }[] = [];
    for (let line = 1; line <= lines; line++) {
      const middle = ref.start[line] + ref.size[line] / 2;
      const by = Math.max(places.size[line], sliver) / (2 * spread);
      bends.push({ at: middle - spread, by }, { at: middle + spread, by: -by });
    }
    bends.sort((a, b) => a.at - b.at);
    this.at = new Float64Array(bends.length);
    this.reaches = new Float64Array(bends.length);
    this.slopes = new Float64Array(bends.length);
    let [reached, slope] = [0, 0];
    bends.forEach((bend, k) => {
      if (k > 0) reached += slope * (bend.at - bends[k - 1].at);
      slope += bend.by;
      this.at[k] = bend.at;
      this.reaches[k] = reached;
      this.slopes[k] = Math.max(0, slope);
    });
  }

  /** How far the lines reach before `at`. */
  before(at: number) {
    const k = this.last(this.at, at, (value, to) => value <= to);
    return k < 0 ? 0 : this.reaches[k] + this.slopes[k] * (at - this.at[k]);
  }

  /** Where the lines have reached `length`. */
  where(length: number) {
    const k = this.last(this.reaches, length, (value, to) => value < to);
    if (k < 0) return this.at[0] ?? 0;
    return this.slopes[k] > 0 ? this.at[k] + (length - this.reaches[k]) / this.slopes[k] : this.at[k];
  }

  /** The last of `values`, which never fall, that is still short of `to`, or -1. */
  private last(values: Float64Array, to: number, short: (value: number, to: number) => boolean) {
    let [low, high] = [-1, values.length - 1];
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (short(values[middle], to)) low = middle;
      else high = middle - 1;
    }
    return low;
  }
}

/** The Reach of lines laid out `places` along those laid out `ref`, kept while they are asked of again. */
const reaches = new WeakMap<Places, { ref: Places; spread: number; reach: Reach }>();
export const reachOf = (ref: Places, places: Places, spread: number) => {
  let known = reaches.get(places);
  if (!known || known.ref !== ref || known.spread !== spread) {
    known = { ref, spread, reach: new Reach(ref, places, spread) };
    reaches.set(places, known);
  }
  return known.reach;
};

/** The pivot: the place along lines laid out `ref` that lines laid out `rest` reach `length` before. */
const pivotAt = (ref: Places, rest: Places, length: number, spread: number) => reachOf(ref, rest, spread).where(length);

/**
 * The pivot for a scroll the part `part` of the way along lines laid out
 * `rest`, remembered for every part asked of each: the scroll puts the
 * layer anew every frame, and the lines the room was made for stay the same
 * from one rest to the next.
 */
const pivots = new WeakMap<Places, { ref: Places; spread: number; pivots: Map<number, number>; all: number }>();
export const pivotFor = (ref: Places, rest: Places, part: number, spread: number) => {
  let known = pivots.get(rest);
  if (!known || known.spread !== spread || known.ref !== ref) {
    known = { ref, spread, pivots: new Map(), all: reachAll(rest) };
    pivots.set(rest, known);
  }
  let pivot = known.pivots.get(part);
  if (pivot === undefined) {
    // Asked of many parts at once to slide the layer with the scroll (see slideWithScroll), and kept for the next frame's.
    if (known.pivots.size > 4096) known.pivots.clear();
    pivot = pivotAt(ref, rest, part * known.all, spread);
    known.pivots.set(part, pivot);
  }
  return pivot;
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
export const along = (rest: Places, places: Places, part: number, size: number, near: number, far: number, home: number, cell: number, ref = rest) => {
  const spread = spreadOver(size, cell);
  const room = places.start[0] + near + far - size;
  if (room <= 2) return home ? places.start[0] + far - size : -near;
  const goes = part <= 0 || part >= 1 ? part : reachOf(ref, places, spread).before(pivotFor(ref, rest, part, spread)) / reachAll(places);
  return (goes <= 0 ? 0 : goes >= 1 ? room : 1 + goes * (room - 2)) - near;
};


/**
 * One way across the chart, as the box's scroll sees it: the lines as they
 * are, those the sheet was last given the size of, and those the pivot is
 * measured along (see keepsRef in tile-view); the box's length that way,
 * how far its scroll goes before the chart's near edge and past its far
 * one, the room the sheet gives the scroll, and which edge a chart too
 * short to scroll keeps where it is.
 */
export interface Course {
  places: Places;
  rest: Places;
  ref: Places;
  size: number;
  near: number;
  far: number;
  room: number;
  home: number;
  cell: number;
}

/**
 * Where the box shows the chart from, along the lines as they are, with the
 * box `box` along the sheet: as far along the room as the scroll is (see
 * along). A scroll is whole pixels, so one within a pixel of an end counts as
 * at it. Nothing held: what is held moves the chart on from here by as much.
 */
export const boxAt = (course: Course, box: number): number => {
  const { places, rest, ref, size, near, far, room, home, cell } = course;
  const part = Math.min(1, Math.max(0, (box + near - 1) / (room - 2)));
  return along(rest, places, part, size, near, far, home, cell, ref);
};

/** The box's place along the sheet that the scroll can take, from `near` before it to the room's end. */
const within = (course: Course, box: number) => Math.min(course.room - course.near, Math.max(-course.near, box));

/**
 * And the other way: where along the sheet to put the box for it to show
 * the chart from `x`, with nothing held - the nearest the scroll can take it
 * to. Where the box shows the chart from only ever grows as it scrolls on,
 * so it is found by halving.
 */
export const scrollFor = (course: Course, x: number): number => {
  let low = -course.near;
  let high = course.room - course.near;
  if (high <= low || boxAt(course, low) >= x) return low;
  if (boxAt(course, high) <= x) return high;
  for (let k = 0; k < 48 && high - low > 0.01; k++) {
    const mid = (low + high) / 2;
    if (boxAt(course, mid) < x) low = mid;
    else high = mid;
  }
  return within(course, (low + high) / 2);
};

/**
 * Where to put the box for it to show, with nothing held, what it shows now
 * at `box` with `held` held: the chart moved on by what is held, taken into
 * the scroll instead. Wherever the page sets the box's scroll itself - as it
 * glides, and at rest - what is held can go this way with nothing on screen
 * moving, and where the box shows the chart depends again on the scroll and
 * the lines alone. Short of the room it needs, as far as the scroll goes, and
 * the rest still held: says how much.
 */
export const absorb = (course: Course, box: number, held: number): { box: number; held: number } => {
  const x = boxAt(course, box) - held;
  const to = scrollFor(course, x);
  return { box: to, held: boxAt(course, to) - x };
};
