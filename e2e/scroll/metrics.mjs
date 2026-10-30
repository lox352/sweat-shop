/**
 * What a recording (see recorder.js) says of how the chart moved: measured
 * as a knitter sees it, by where stitches are on screen frame to frame.
 *
 * - Pacing: how evenly frames came, how many were dropped, and the long
 *   animation frames the browser blamed on script.
 * - Motion: each frame, how far the stitches followed moved on screen - the
 *   median of them, so one column opening beside a stitch does not count -
 *   and how much of that the box's scroll does not account for: lines
 *   easing open or closed, the layer sliding, or a jump.
 * - Jumps: a frame where what is on screen moves by more than the frames
 *   either side of it lead you to expect, all at once.
 * - Jitter: frame-to-frame wobble in that motion, while it should be smooth.
 * - Scrollbars: how far the box's scrollbars are from telling the truth of
 *   where in the chart the box is, and how far they move in one frame.
 * - Painting: the most of the box left showing an old chart in a frame,
 *   and of it and a little round it, which a phone shows ahead of its
 *   scroll; how many tiles were painted, how long that took a frame, and
 *   how many frames of lines easing repainted any.
 * - Past the edge: the box showing blank paper beyond the chart's edge.
 * - Settling: how long after the last gesture the chart is at rest.
 * - Shake: what is on screen going back and forth by itself, outside the
 *   knitter's gestures: it should go one way and come to rest.
 * - Following: the stitch to be worked, as the chart follows the knitting
 *   to it - how straight it goes, whether it ever turns back, and how far
 *   from the middle of the box it comes to rest.
 * - Drift: how much of what moves while the knitter scrolls is not the
 *   scroll - lines opening and closing as they come into view.
 * - Sharpness: the frames in which the tiles are off the screen's own
 *   pixels, smeared, and shimmering as they move.
 * - Audit: tiles at rest showing anything but the chart as it now is, each
 *   painted again and compared once the scenario is over.
 */

const median = (values) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const quantile = (values, q) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};
const round = (n, places = 1) => Math.round(n * 10 ** places) / 10 ** places;
const hypot = (x, y) => Math.sqrt(x * x + y * y);

/** One frame's display period, as the frames say: the commonest interval. */
const periodOf = (dts) => {
  const plausible = dts.filter((dt) => dt > 4 && dt < 40);
  return plausible.length ? median(plausible) : 16.7;
};

/**
 * Each frame's motion on screen: the median, over the stitches followed in
 * both it and the frame before, of how far each moved; and of that, how far
 * the box's own scroll did not move it.
 */
export const motionOf = (frames) => {
  const out = [];
  for (let i = 1; i < frames.length; i++) {
    const was = frames[i - 1];
    const now = frames[i];
    // A new view is a new chart, cut to rather than moved to.
    if (!was.s || !now.s || was.view !== now.view) {
      out.push(undefined);
      continue;
    }
    const before = new Map(was.a.filter((a) => a[1] !== null).map((a) => [a[0], a]));
    const dxs = [];
    const dys = [];
    for (const a of now.a) {
      if (a[1] === null) continue;
      const b = before.get(a[0]);
      if (!b) continue;
      dxs.push(a[1] - b[1]);
      dys.push(a[2] - b[2]);
    }
    // The box's own scroll, and the box itself moving with the page's: both move what is in it, and neither is the chart's doing.
    const scrollX = now.s.scroll.left - was.s.scroll.left - (now.box.left - was.box.left);
    const scrollY = now.s.scroll.top - was.s.scroll.top - (now.box.top - was.box.top);
    if (dxs.length === 0) {
      out.push({ i, dx: NaN, dy: NaN, scrollX, scrollY, ux: NaN, uy: NaN, n: 0 });
      continue;
    }
    const dx = median(dxs);
    const dy = median(dys);
    // A scroll moves what is on screen the other way.
    out.push({ i, dx, dy, scrollX, scrollY, ux: dx + scrollX, uy: dy + scrollY, n: dxs.length, dt: now.t - was.t });
  }
  return out;
};

/** Whether a box is scrolled across from the right: its scroll across is then nought at the right and less than nought left of it. */
const fromRight = (frames) => frames.some((f) => f.s && (f.s.scroll.left < 0 || f.s.sheet.left < 0));

/**
 * Where the box's scrollbars put it, as a share of the way along, and where
 * in the chart it truly is: the chart's own scroll, as the view reads it.
 */
export const scrollbarsOf = (frames) => {
  const rtl = fromRight(frames);
  return frames.map((f) => {
    if (!f.s) return undefined;
    const { scroll, sheet, shift, chart } = f.s;
    const extentX = scroll.width - scroll.clientWidth;
    const extentY = scroll.height - scroll.clientHeight;
    const thumbX = extentX > 0 ? (rtl ? (scroll.left + extentX) / extentX : scroll.left / extentX) : 0;
    const thumbY = extentY > 0 ? scroll.top / extentY : 0;
    // From the chart's own top left: see TileView.showing.
    const x = scroll.left - sheet.left - shift.x;
    const y = scroll.top - sheet.top - shift.y;
    const roomX = chart.width - scroll.clientWidth;
    const roomY = chart.height - scroll.clientHeight;
    const trueX = roomX > 0 ? Math.min(1, Math.max(0, x / roomX)) : 0;
    const trueY = roomY > 0 ? Math.min(1, Math.max(0, y / roomY)) : 0;
    // How much of the track the thumb takes.
    const sizeX = scroll.width > 0 ? scroll.clientWidth / scroll.width : 1;
    const sizeY = scroll.height > 0 ? scroll.clientHeight / scroll.height : 1;
    return { thumbX, thumbY, trueX, trueY, sizeX, sizeY, extentX, extentY };
  });
};

/**
 * When the knitter's own input was moving the box: from each gesture's mark
 * to its end - a swipe's flung momentum included - as [from, to] times.
 * Whatever moves outside these is the chart's own doing: following the
 * knitting, a zoom, lines opening and closing as it comes to rest.
 */
export const gesturesOf = (marks = []) => {
  const spans = [];
  let open;
  for (const { t, what } of marks) {
    if (/^(swipe|wheel|trackpad|pinch|touch pinch)/.test(what)) open = { from: t, flung: /^swipe/.test(what) && !/no fling/.test(what) };
    else if (open && (what === "fling done" || (what === "lifted" && !open.flung) || / done$/.test(what))) {
      spans.push([open.from, t]);
      open = undefined;
    }
  }
  if (open) spans.push([open.from, Infinity]);
  return spans;
};

/**
 * How often something on screen goes one way and then back, by at least
 * `amplitude` pixels each way: a series of positions, null where it is not
 * on screen or is cut to (a new view). Each run of motion one way is
 * counted once it has gone `amplitude`; a reversal is a run that far one way
 * followed by one that far the other. Lines easing and a glide come to rest
 * without turning back; the chart shaking from side to side turns back
 * every few frames.
 */
export const reversalsOf = (series, amplitude = 4) => {
  let count = 0;
  let largest = 0;
  for (const axis of [0, 1]) {
    let direction = 0;
    let run = 0;
    let previousRun = 0;
    for (let k = 1; k < series.length; k++) {
      const [a, b] = [series[k - 1], series[k]];
      if (!a || !b) {
        direction = 0;
        run = previousRun = 0;
        continue;
      }
      const d = b[axis] - a[axis];
      if (Math.abs(d) < 0.25) continue;
      const sign = Math.sign(d);
      if (sign === direction) run += Math.abs(d);
      else {
        if (direction !== 0 && run >= amplitude) previousRun = run;
        else if (direction !== 0) previousRun = 0;
        direction = sign;
        run = Math.abs(d);
      }
      if (previousRun >= amplitude && run >= amplitude) {
        count++;
        largest = Math.max(largest, Math.min(previousRun, run));
        previousRun = 0;
      }
    }
  }
  return { count, largest: round(largest) };
};

/**
 * Each trip something on screen takes between rests - frames where it moves
 * less than a pixel - and how straight it went: how far it got, over how far
 * it went along the way. One that goes straight there scores one; one that
 * overshoots and comes back, or wanders off and back, less.
 */
export const tripsOf = (series) => {
  const trips = [];
  let trip;
  let still = 0;
  for (let k = 1; k < series.length; k++) {
    const [a, b] = [series[k - 1], series[k]];
    if (!a || !b) {
      trip = undefined;
      continue;
    }
    const step = hypot(b[0] - a[0], b[1] - a[1]);
    if (step < 1) {
      if (trip && ++still >= 3) {
        trips.push(trip);
        trip = undefined;
      }
      continue;
    }
    still = 0;
    if (!trip) trip = { from: a, to: b, path: 0, frames: 0 };
    trip.to = b;
    trip.path += step;
    trip.frames++;
  }
  if (trip) trips.push(trip);
  return trips
    .filter((t) => t.path >= 8)
    .map((t) => ({ ...t, straightness: round(hypot(t.to[0] - t.from[0], t.to[1] - t.from[1]) / t.path, 3) }));
};

/** How far a value in pixels is from the nearest device pixel, in device pixels. */
const offGrid = (value, ratio) => {
  const device = value * ratio;
  return Math.abs(device - Math.round(device));
};

/**
 * Everything measured of one recording. `allow` is how far, in pixels, the
 * frames either side of one let it move without counting as a jump.
 */
export const measure = (recording, { allow = 24 } = {}) => {
  const frames = recording.frames.filter((f) => !f.missing);
  const dts = frames.slice(1).map((f, i) => f.t - frames[i].t);
  const period = periodOf(dts);
  const dropped = dts.filter((dt) => dt > period * 1.5);
  const loafs = recording.loafs ?? [];

  const motion = motionOf(frames);
  /*
   * What the scroll does not account for, as a speed: pixels a frame of the
   * display's. A frame that comes late shows lines easing on by as much
   * more as it is late, which is right, and no jump; what it costs is
   * counted with the frames dropped.
   */
  for (const m of motion) {
    if (!m) continue;
    const scale = m.dt > 0 ? period / Math.max(period, m.dt) : 1;
    m.vx = m.ux * scale;
    m.vy = m.uy * scale;
  }
  const moves = motion.filter((m) => m && m.n > 0 && Number.isFinite(m.dx));
  /*
   * A jump: what is on screen moving, all at once, by more than `allow`
   * pixels that the box's scroll does not account for - the lines or the
   * layer put somewhere else in one frame - or by a scroll the page set
   * itself, which a knitter did not make. The box's own scrolling, a finger's
   * or a fling's however unevenly it comes, is not a jump: what moves with
   * it is where it was.
   *
   * Lines easing open or closed move what is on screen as the scroll does
   * not, but a little each frame, much as the frame before did: measured
   * against the mean of the frames either side, an easing hardly counts.
   */
  const writes = recording.writes ?? [];
  /*
   * The scroll writes in a frame, but a glide's (see glide.ts): those are the
   * page's own smooth scroll, a little a frame, and move what is on screen
   * as any scroll does - what the scroll does not account for is measured
   * as it is for a finger's.
   */
  const writesIn = (k) => writes.filter((w) => !w.glide && w.t > (frames[k - 1].ts ?? frames[k - 1].t) && w.t <= (frames[k].ts ?? frames[k].t + 1));
  // A frame whose scroll the page set, whose unexplained motion is the scroll's undoing (see fitSheet), and one zoomed in.
  const set = motion.map((m) => (m ? writesIn(m.i).length > 0 : false));
  const zoomed = motion.map((m) => (m ? frames[m.i].s.cell !== frames[m.i - 1].s.cell || frames[m.i].scaled || frames[m.i - 1].scaled : false));
  const usable = (k) => motion[k] && Number.isFinite(motion[k].ux) && !set[k] && !zoomed[k];
  const easing = (i) => {
    const [a, b] = [frames[i - 1].s.moving, frames[i].s.moving];
    return a.columns || a.rows || b.columns || b.rows;
  };
  const jumps = [];
  for (let k = 0; k < motion.length; k++) {
    const m = motion[k];
    if (!m || !Number.isFinite(m.dx) || zoomed[k]) continue;
    let off;
    let kind;
    if (set[k]) {
      /*
       * A scroll the page set: at once, nothing on screen should move by it
       * - it puts the box back under a layer that has moved, at rest - but
       * the box keeping a corner as it changes size, which moves what is on
       * screen as much as the box changed. Set going smoothly, it is the
       * browser's to move, a little a frame, and no jump.
       */
      const now = frames[m.i].s.scroll;
      const was = frames[m.i - 1].s.scroll;
      const resized = hypot(now.clientWidth - was.clientWidth, now.clientHeight - was.clientHeight);
      const instant = writesIn(m.i).some((w) => !String(w.value).includes('"smooth"'));
      // As far as the box changed size is the box's keeping its corner; any further is a jump.
      off = instant ? Math.max(0, hypot(m.dx, m.dy) - resized) : 0;
      kind = "set";
    } else {
      const side = [k - 2, k - 1, k + 1, k + 2].filter(usable).map((j) => motion[j]);
      const ex = median(side.map((o) => o.vx));
      const ey = median(side.map((o) => o.vy));
      off = hypot(m.vx - ex, m.vy - ey);
      kind = easing(m.i) ? "lurch" : "slip";
    }
    if (off > allow) {
      const frame = frames[m.i];
      jumps.push({
        frame: m.i,
        t: frame.t,
        kind,
        dx: round(m.dx),
        dy: round(m.dy),
        off: round(off),
        scrollX: round(m.scrollX),
        scrollY: round(m.scrollY),
        unexplained: round(hypot(m.ux, m.uy)),
        writes: writesIn(m.i),
      });
    }
  }
  /*
   * Jitter: frame-to-frame wobble in what moves that the scroll does not
   * account for. A line easing open changes it smoothly; the layer put one
   * way then back, or a frame drawn with the lines of the frame before,
   * changes it back and forth.
   */
  const accel = [];
  for (let k = 2; k < motion.length; k++) {
    const [a, b, c] = [motion[k - 2], motion[k - 1], motion[k]];
    if (![k - 2, k - 1, k].every(usable)) continue;
    accel.push(hypot(c.vx - 2 * b.vx + a.vx, c.vy - 2 * b.vy + a.vy));
  }
  // What moves on screen that the box's scroll does not account for, frame to frame.
  const unexplained = motion.filter((m, k) => usable(k)).map((m) => hypot(m.ux, m.uy));

  /*
   * What the chart does on its own, outside the knitter's gestures: what is
   * on screen should go one way and come to rest, never back and forth.
   * Its place, frame to frame, by the motion of the stitches followed; and
   * the outline round the stitch to be worked, which the chart follows.
   */
  const spans = gesturesOf(recording.marks);
  const attended = (t) => spans.some(([from, to]) => t >= from && t <= to + 50);
  // Each thing the harness did - a button pressed, a key - sets the chart going afresh: what it does then is a new movement.
  const marked = (k) => (recording.marks ?? []).some((m) => m.t > frames[k - 1].t && m.t <= frames[k].t);
  const own = [null];
  let place = [0, 0];
  let resting = 0;
  for (let k = 0; k < motion.length; k++) {
    const m = motion[k];
    const frame = frames[k + 1];
    // A movement ends where it rests, for three frames.
    resting = m && Number.isFinite(m.dx) && hypot(m.dx, m.dy) < 0.5 ? resting + 1 : 0;
    if (!m || !Number.isFinite(m.dx) || zoomed[k] || attended(frame.t) || marked(k + 1) || resting >= 3) {
      own.push(null);
      place = [0, 0];
      continue;
    }
    // Where a movement starts, after the gap that ends the one before.
    if (own[own.length - 1] === null) own.push([...place]);
    place = [place[0] + m.dx, place[1] + m.dy];
    own.push([...place]);
  }
  const shake = reversalsOf(own);
  // The outline round the stitch to be worked, from when it is put round a stitch until it is put round another.
  const nexts = frames.map((f, k) => {
    if (!f.next || attended(f.t)) return null;
    const was = frames[k - 1];
    if (was && (was.view !== f.view || was.s?.cell !== f.s.cell || was.s?.follow !== f.s.follow || !was.next)) return null;
    return [f.next[0], f.next[1]];
  });

  const followTrips = tripsOf(nexts);
  const followTurns = reversalsOf(nexts);
  const lastFrame = frames[frames.length - 1];
  // Where the stitch followed came to rest, from the middle of the box across.
  const followOff = lastFrame?.next ? round(lastFrame.next[0] + lastFrame.next[2] / 2 - (lastFrame.box.left + lastFrame.box.width / 2)) : null;

  /*
   * How much of what moves on screen while the knitter scrolls is not the
   * scroll: lines opening and closing as they come into view, the layer
   * sliding. Some is the chart closing up; all of it is motion the finger
   * did not make.
   */
  let scrolled = 0;
  let drifted = 0;
  for (let k = 0; k < motion.length; k++) {
    const m = motion[k];
    if (!usable(k) || !attended(frames[m.i].t)) continue;
    scrolled += hypot(m.dx, m.dy);
    drifted += hypot(m.ux, m.uy);
  }

  // The tiles painted each frame, and how long that took.
  const paintSteps = [];
  for (let k = 1; k < frames.length; k++) {
    const [a, b] = [frames[k - 1], frames[k]];
    if (!a.s || !b.s || a.view !== b.view || b.s.paints === undefined) continue;
    paintSteps.push({ tiles: b.s.paints - a.s.paints, ms: b.s.paintTime - a.s.paintTime, moving: b.s.moving.columns || b.s.moving.rows });
  }

  /*
   * Sharpness: the tiles are drawn at the device's own pixels, and are sharp
   * only where they land on whole device pixels; between, every line is
   * smeared across two. Moved across the sheet by a part of a device pixel
   * - lines easing, the layer sliding - they shimmer, sharp one frame and
   * smeared the next, as the chart is drawn. And the box itself may sit on
   * no whole pixel, as the page lays it out, which smears them all alike.
   * Mid-pinch the sheets are scaled, and no pixel is whole: those frames are
   * left out.
   */
  const layerOff = (f) => {
    const found = /translate\(([-\d.e]+)px, ([-\d.e]+)px\)/.exec(f.transform ?? "");
    const [x, y] = found ? [Number(found[1]), Number(found[2])] : [0, 0];
    return Math.max(offGrid(f.sheetRect.left + x, f.dpr ?? 1), offGrid(f.sheetRect.top + y, f.dpr ?? 1));
  };
  const drawn = frames.filter((f) => f.s && f.sheetRect && !f.scaled);
  const smeared = drawn.filter((f) => layerOff(f) > 0.05);
  const moved = drawn.filter((f) => f.transform);
  const shimmering = smeared.filter((f) => f.transform).length;

  /*
   * Past the edge: how far the box shows beyond the chart's own edges, as
   * the view reads where it is - blank paper where the chart should go on.
   * The box goes past the chart by its padding, the room left for a join's
   * arrow, and the round numbers, which the chart's width counts already: a
   * couple of dozen pixels. Only a chart wider than the box can be scrolled
   * past.
   */
  const pastEdge = frames.map((f) => {
    if (!f.s || f.scaled || f.s.chart.width <= f.s.scroll.clientWidth) return 0;
    const x = f.s.scroll.left - f.s.sheet.left - f.s.shift.x;
    return Math.max(0, -x - 24, x + f.s.scroll.clientWidth - f.s.chart.width - 24);
  });

  const restAt = (f) => {
    if (!f) return null;
    const x = f.s.scroll.left - f.s.sheet.left - f.s.shift.x;
    const y = f.s.scroll.top - f.s.sheet.top - f.s.shift.y;
    return { right: round(x + f.s.scroll.clientWidth - f.s.chart.width), bottom: round(y + f.s.scroll.clientHeight - f.s.chart.height) };
  };

  const bars = scrollbarsOf(frames);
  const barGaps = bars.filter(Boolean).map((b) => Math.max(Math.abs(b.thumbX - b.trueX), Math.abs(b.thumbY - b.trueY)));
  const barSteps = [];
  for (let k = 1; k < bars.length; k++) {
    const [a, b] = [bars[k - 1], bars[k]];
    if (!a || !b) continue;
    barSteps.push({
      frame: k,
      step: Math.max(a.extentX > 0 && b.extentX > 0 ? Math.abs(b.thumbX - a.thumbX) : 0, a.extentY > 0 && b.extentY > 0 ? Math.abs(b.thumbY - a.thumbY) : 0),
      resized: a.extentX !== b.extentX || a.extentY !== b.extentY,
    });
  }

  // Settling: from the last gesture's end to the last frame anything changed.
  const ends = (recording.marks ?? []).filter((m) => /lifted|done/.test(m.what)).map((m) => m.t);
  const lastInput = ends.length ? Math.max(...ends) : frames[0]?.t ?? 0;
  const key = (f) => (f.s ? [f.s.scroll.left, f.s.scroll.top, f.s.scroll.width, f.s.scroll.height, f.s.shift.x, f.s.shift.y, f.s.moving.columns, f.s.moving.rows].join() : "");
  let lastChange = lastInput;
  for (let k = 1; k < frames.length; k++) if (key(frames[k]) !== key(frames[k - 1])) lastChange = Math.max(lastChange, frames[k].t);
  const last = frames[frames.length - 1];
  const rested = !!last?.s && Math.abs(last.s.shift.x) < 0.01 && Math.abs(last.s.shift.y) < 0.01 && !last.s.moving.columns && !last.s.moving.rows;

  return {
    frames: frames.length,
    seconds: round(frames.length ? (frames[frames.length - 1].t - frames[0].t) / 1000 : 0, 2),
    pacing: {
      period: round(period),
      p50: round(median(dts)),
      p95: round(quantile(dts, 0.95)),
      p99: round(quantile(dts, 0.99)),
      worst: round(Math.max(0, ...dts)),
      dropped: dropped.length,
      droppedShare: round(dts.length ? dropped.length / dts.length : 0, 3),
      longFrames: loafs.length,
      longest: round(Math.max(0, ...loafs.map((l) => l.duration))),
      blocking: round(loafs.reduce((sum, l) => sum + l.blocking, 0)),
    },
    motion: {
      followed: round(median(moves.map((m) => m.n)), 0),
      fastest: round(Math.max(0, ...moves.map((m) => hypot(m.dx, m.dy)))),
      unexplainedP95: round(quantile(unexplained, 0.95)),
      unexplainedMax: round(Math.max(0, ...unexplained)),
    },
    jumps: {
      count: jumps.length,
      worst: round(Math.max(0, ...jumps.map((j) => j.off))),
      byKind: Object.fromEntries(["slip", "set", "lurch"].map((kind) => [kind, jumps.filter((j) => j.kind === kind).length])),
      list: jumps.slice(0, 12),
    },
    jitter: { rms: round(Math.sqrt(accel.reduce((sum, a) => sum + a * a, 0) / Math.max(1, accel.length)), 2), p95: round(quantile(accel, 0.95), 2), max: round(Math.max(0, ...accel), 1) },
    scrollbars: {
      gapMax: round(Math.max(0, ...barGaps), 3),
      gapP95: round(quantile(barGaps, 0.95), 3),
      stepMax: round(Math.max(0, ...barSteps.map((s) => s.step)), 3),
      resizes: barSteps.filter((s) => s.resized).length,
    },
    painting: {
      /*
       * Measured in the frames sampled as they were drawn: one sampled late,
       * a fling's scroll moved on meanwhile, shows the box where the frame
       * never had it, and the next frame paints for where it has got to.
       */
      unpaintedMax: round(Math.max(0, ...frames.filter((f) => (f.ts ?? f.t) - f.t <= period * 1.5).map((f) => f.s?.unpainted ?? 0)), 3),
      // And a little round the box, which a phone shows ahead of its scroll and bouncing at an end: see TileView.probe.
      unpaintedNearMax: round(Math.max(0, ...frames.filter((f) => (f.ts ?? f.t) - f.t <= period * 1.5).map((f) => f.s?.unpaintedNear ?? 0)), 3),
      costMax: round(Math.max(0, ...frames.map((f) => f.s?.cost ?? 0)), 1),
      tiles: paintSteps.reduce((sum, p) => sum + p.tiles, 0),
      tilesPerFrameMax: Math.max(0, ...paintSteps.map((p) => p.tiles)),
      msPerFrameP95: round(quantile(paintSteps.filter((p) => p.tiles > 0).map((p) => p.ms), 0.95)),
      msPerFrameMax: round(Math.max(0, ...paintSteps.map((p) => p.ms))),
      // Frames repainting while lines ease, each of which repaints what it shows.
      easingFrames: paintSteps.filter((p) => p.moving && p.tiles > 0).length,
    },
    shake: { reversals: shake.count, largest: shake.largest },
    follow: {
      trips: followTrips.length,
      straightness: followTrips.length ? Math.min(...followTrips.map((t) => t.straightness)) : 1,
      reversals: followTurns.count,
      largest: followTurns.largest,
      offCentre: followOff,
    },
    drift: { share: round(scrolled > 0 ? drifted / scrolled : 0, 3), pixels: round(drifted) },
    past: { max: round(Math.max(0, ...pastEdge)), frames: pastEdge.filter((p) => p > 2).length },
    // Where the box came to rest against the chart's right-hand and bottom edges: the box's padding past them when it is in the corner, less when short of it.
    rest: restAt(frames.findLast((f) => f.s && !f.scaled)),
    sharpness: { smeared: smeared.length, frames: drawn.length, share: round(drawn.length ? smeared.length / drawn.length : 0, 3), shimmering, moved: moved.length },
    settling: { ms: round(Math.max(0, lastChange - lastInput), 0), rested },
    writes: (recording.writes ?? []).length,
    // Tiles at rest that show something other than the chart as it is: see TileView.audit.
    audit: recording.audit ?? { tiles: 0, wrong: 0 },
  };
};
