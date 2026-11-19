import { describe, expect, it } from "vitest";
import { type Course, type Places, absorb, blockNear, boxAt, middleLine, placeOf, scrollFor, universalOf } from "./scroll-model";

const cell = 16;

/**
 * Lines laid out as the chart lays columns out: line 1 at the far edge's
 * end, each a cell in from the near edge for every line showing beyond it;
 * line 0 and the one past the last stand for the edges, and never show.
 */
const linesOf = (shows: boolean[]): Places => {
  const lines = shows.length;
  const start = new Float64Array(lines + 2);
  const size = new Float64Array(lines + 2);
  let beyond = 0;
  for (let line = lines; line >= 1; line--) {
    start[line] = beyond * cell;
    size[line] = shows[line - 1] ? cell : 0;
    if (shows[line - 1]) beyond++;
  }
  start[0] = beyond * cell;
  start[lines + 1] = 0;
  return { start, size };
};

const open = linesOf(Array.from({ length: 300 }, () => true));
// A block of forty columns closed up in the middle, and a few here and there.
const closed = linesOf(Array.from({ length: 300 }, (_, k) => !((k >= 130 && k < 170) || k % 37 === 0)));

/** A box 400 long over lines laid out `places`, the sheet sized for `rest`, as the chart's box is. */
const courseOf = (places: Places, rest: Places, ref = rest): Course => {
  const [size, near, far] = [400, 8, 40];
  return { places, rest, ref, size, near, far, room: rest.start[0] + near + far - size, home: 1, cell };
};

describe("the box's scroll, as one way across the chart", () => {
  it("shows the chart just as far along as the scroll is, the lines as they were", () => {
    const course = courseOf(open, open);
    for (const box of [10, 500, 2000, 4200]) expect(boxAt(course, box)).toBeCloseTo(box, 6);
  });

  it("shows each edge with the box at that end, however the lines have changed", () => {
    const course = courseOf(closed, open);
    expect(boxAt(course, -course.near)).toBeCloseTo(-course.near, 6);
    expect(boxAt(course, course.room - course.near)).toBeCloseTo(closed.start[0] + course.far - course.size, 6);
  });

  it("finds the scroll for where the box shows the chart from, the lines changed", () => {
    const course = courseOf(closed, open);
    let was = -Infinity;
    for (let box = -course.near; box <= course.room - course.near; box += 97) {
      const x = boxAt(course, box);
      // Only ever further on as the scroll goes on.
      expect(x).toBeGreaterThanOrEqual(was - 1e-9);
      was = x;
      expect(boxAt(course, scrollFor(course, x))).toBeCloseTo(x, 1);
    }
  });

  it("takes what is held into the scroll, nothing on screen moving and nothing left held", () => {
    const course = courseOf(closed, open);
    for (const [box, held] of [[1500, 120], [2400, -300], [900, 48]]) {
      const shown = boxAt(course, box) - held;
      const to = absorb(course, box, held);
      expect(Math.abs(to.held)).toBeLessThan(0.1);
      expect(boxAt(course, to.box) - to.held).toBeCloseTo(shown, 1);
    }
  });

  it("takes only as much as the scroll can, near an end, and says what is still held", () => {
    const course = courseOf(closed, open);
    const end = course.room - course.near;
    const to = absorb(course, end - 10, -500);
    expect(to.box).toBeCloseTo(end, 6);
    expect(boxAt(course, to.box) - to.held).toBeCloseTo(boxAt(course, end - 10) + 500, 1);
    expect(to.held).toBeLessThan(0);
  });
});

describe("the chart opened out", () => {
  it("is where the lines are, every line showing", () => {
    for (const x of [0, 17, 800, 4790]) {
      expect(universalOf(open, open, x)).toBeCloseTo(x, 9);
      expect(placeOf(open, open, x)).toBeCloseTo(x, 9);
    }
  });

  it("finds a point on screen there and back again, in the lines showing", () => {
    for (let x = 0; x < closed.start[0]; x += 37) {
      expect(placeOf(closed, open, universalOf(closed, open, x))).toBeCloseTo(x, 6);
    }
  });

  it("gives a block closed up on screen its full length there, and a point back on screen", () => {
    // Columns 131 to 170 closed: on screen they stand where column 130 does, beyond the block.
    const [first, last] = [131, 170];
    const onScreen = closed.start[first];
    expect(closed.start[last]).toBeCloseTo(onScreen, 9);
    const spanned = open.start[first] + cell - open.start[last];
    expect(spanned).toBeCloseTo((last - first + 1) * cell, 9);
    for (const u of [open.start[last], (open.start[first] + open.start[last]) / 2, open.start[first] + cell / 2]) {
      expect(placeOf(closed, open, u)).toBeCloseTo(onScreen, 6);
    }
  });
});

describe("lines opening and closing in a block", () => {
  // Rows as the chart lays them out: line 1 the bottom row, the last the top; the top of the chart, nought, past the last.
  const rows = 40;
  const upTo = (top: number) => linesOf(Array.from({ length: rows }, (_, k) => k + 1 <= top));

  it("hold what is in view still: a sleeve's rounds opening past the body's at the top, the box there", () => {
    // The box at the top of the chart: rounds 31 to 40 open above the body's thirty, at the box's edge.
    expect(blockNear(upTo(30), upTo(40), 0, 10 * cell, 3)).toBe(true);
  });

  it("and within half a box of it, where the pivot would share it out", () => {
    expect(blockNear(upTo(30), upTo(40), 4 * cell, 10 * cell, 3)).toBe(true);
  });

  it("but not further off, which the pivot leaves the box alone for", () => {
    expect(blockNear(upTo(30), upTo(40), 20 * cell, 6 * cell, 3)).toBe(false);
  });

  it("nor a line or a few, nor lines opening here and there, as a yoke's make-ones do", () => {
    expect(blockNear(upTo(30), upTo(33), 0, 10 * cell, 3)).toBe(false);
    const scattered = linesOf(Array.from({ length: rows }, (_, k) => k % 2 === 0));
    expect(blockNear(scattered, upTo(40), 0, 10 * cell, 3)).toBe(false);
  });

  it("taking lines closed up either way between them as no gap on screen", () => {
    const gapped = (open: boolean) => linesOf(Array.from({ length: rows }, (_, k) => (k >= 10 && k < 20 ? open && k % 2 === 0 : true)));
    expect(blockNear(gapped(false), gapped(true), 10 * cell, 10 * cell, 3)).toBe(true);
  });

  it("hold the line in the middle of the box, showing before and after", () => {
    const was = upTo(30);
    const middle = middleLine(was, upTo(40), 4 * cell + cell / 2)!;
    // Four cells down from the top of thirty rows: row 26.
    expect(was.start[middle]).toBe(4 * cell);
    expect(middle).toBe(26);
  });
});
