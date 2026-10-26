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
 * - Painting: the most of the box left showing an old chart in a frame.
 * - Settling: how long after the last gesture the chart is at rest.
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
  const writesIn = (k) => writes.filter((w) => w.t > (frames[k - 1].ts ?? frames[k - 1].t) && w.t <= (frames[k].ts ?? frames[k].t + 1));
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
    painting: { unpaintedMax: round(Math.max(0, ...frames.map((f) => f.s?.unpainted ?? 0)), 3), costMax: round(Math.max(0, ...frames.map((f) => f.s?.cost ?? 0)), 1) },
    settling: { ms: round(Math.max(0, lastChange - lastInput), 0), rested },
    writes: (recording.writes ?? []).length,
  };
};
