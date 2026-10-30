/**
 * Gestures for the scroll harness, sent through the browser's own input
 * pipeline (the DevTools protocol) rather than as script setting a scroll:
 * a touch fling goes on by momentum after the finger lifts, a wheel is
 * smoothed by the browser as a mouse's is, and both scroll the box on the
 * compositor as a phone or a laptop does. Every gesture is noted in the
 * recording (see recorder.js) as it begins and ends.
 */

/** A session on the page's target, made once. */
const sessions = new WeakMap();
export const cdp = async (page) => {
  let session = sessions.get(page);
  if (!session) {
    session = await page.context().newCDPSession(page);
    sessions.set(page, session);
  }
  return session;
};

const mark = (page, what) => page.evaluate((what) => window.__scrollProbe?.mark(what), what);

/** The middle of the chart's box as it shows on screen, and its size. */
export const boxOf = async (page) =>
  page.locator(".chart-scroll").evaluate((box) => {
    const rect = box.getBoundingClientRect();
    const top = Math.max(rect.top, 0);
    const bottom = Math.min(rect.bottom, innerHeight);
    return { x: rect.left + rect.width / 2, y: (top + bottom) / 2, width: rect.width, height: bottom - top, left: rect.left, top };
  });

/**
 * A finger dragged `dx`, `dy` across the box from `at` - the content moving
 * that way, so a drag down (`dy` > 0) scrolls up the chart - at `speed`
 * pixels a second, as touches the browser scrolls the box by itself; then,
 * unless `fling` is false, flung on by momentum as it lifts (see the
 * recorder's fling: the browser here makes no fling of touches it is sent),
 * which `mode` says what a phone does with a scroll the page sets meanwhile,
 * and `bounce` whether it bounces past an end as an iPhone does.
 */
export const swipe = async (page, { dx = 0, dy = 0, speed = 1200, fling = true, mode = "ios", bounce = false, at } = {}) => {
  const session = await cdp(page);
  const box = at ?? (await boxOf(page));
  await mark(page, `swipe ${dx},${dy} @${speed}${fling ? ` ${mode}` : " no fling"}`);
  const distance = Math.hypot(dx, dy);
  const duration = (distance / speed) * 1000;
  const steps = Math.max(2, Math.round(duration / 16));
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x, y: box.y }] });
  for (let k = 1; k <= steps; k++) {
    await page.waitForTimeout(16);
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + (dx * k) / steps, y: box.y + (dy * k) / steps }] });
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await mark(page, "lifted");
  if (fling && distance > 0) {
    // The finger's speed as it lifts, the scroll going the other way to the content.
    const vx = (-dx / distance) * speed;
    const vy = (-dy / distance) * speed;
    await page.evaluate((options) => window.__scrollProbe.fling(options), { vx, vy, mode, bounce });
    await mark(page, "fling done");
  }
};

/** A mouse wheel turned `notches` clicks, each `step` pixels, down (or right, with `across`). */
export const wheelNotches = async (page, { notches = 3, step = 100, across = false, gap = 40, at } = {}) => {
  const session = await cdp(page);
  const box = at ?? (await boxOf(page));
  await mark(page, `wheel ${notches} x ${step}${across ? " across" : ""}`);
  for (let k = 0; k < Math.abs(notches); k++) {
    const delta = Math.sign(notches) * step;
    await session.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: box.x,
      y: box.y,
      deltaX: across ? delta : 0,
      deltaY: across ? 0 : delta,
    });
    await page.waitForTimeout(gap);
  }
  await mark(page, "wheel done");
};

/**
 * Two fingers on a trackpad swiped `dx`, `dy` (in scroll terms: positive
 * scrolls down and right) and let go, the momentum dying away as a laptop's
 * does: a wheel event a frame, each a little smaller than the last.
 */
export const trackpad = async (page, { dx = 0, dy = 0, frames = 60, at } = {}) => {
  const session = await cdp(page);
  const box = at ?? (await boxOf(page));
  await mark(page, `trackpad ${dx},${dy}`);
  // Deltas falling away geometrically, summing to the distance asked.
  const decay = 0.93;
  const total = (1 - decay ** frames) / (1 - decay);
  for (let k = 0; k < frames; k++) {
    const share = decay ** k / total;
    await session.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: box.x,
      y: box.y,
      deltaX: dx * share,
      deltaY: dy * share,
    });
    await page.waitForTimeout(16);
  }
  await mark(page, "trackpad done");
};

/** A trackpad pinch, or ctrl and the wheel: `steps` wheel events with ctrl held, zooming in for `delta` < 0. */
export const ctrlWheel = async (page, { delta = -40, steps = 1, at } = {}) => {
  const session = await cdp(page);
  const box = at ?? (await boxOf(page));
  await mark(page, `pinch ${delta} x ${steps}`);
  for (let k = 0; k < steps; k++) {
    await session.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: box.x, y: box.y, deltaX: 0, deltaY: delta, modifiers: 2 });
    await page.waitForTimeout(16);
  }
  await mark(page, "pinch done");
};

/** Two fingers pinched on a touch screen, by `scale`, about `at`. */
export const pinch = async (page, { scale = 1.5, at } = {}) => {
  const session = await cdp(page);
  const box = at ?? (await boxOf(page));
  await mark(page, `touch pinch ${scale}`);
  await session.send("Input.synthesizePinchGesture", {
    x: Math.round(box.x),
    y: Math.round(box.y),
    scaleFactor: scale,
    relativeSpeed: 400,
    gestureSourceType: "touch",
  });
  await mark(page, "pinch done");
};

/** Until the chart has been still, its lines and its scroll, for `quiet` milliseconds. */
export const settled = async (page, { quiet = 400, most = 5000 } = {}) => {
  await page.waitForFunction(
    ({ quiet }) => {
      const view = window.__chartViews?.[window.__chartViews.length - 1];
      const box = document.querySelector(".chart-scroll");
      if (!view || !box) return false;
      const probe = view.probe();
      const now = performance.now();
      const key = [box.scrollLeft, box.scrollTop, box.scrollWidth, box.scrollHeight, probe.moving.columns, probe.moving.rows, probe.shift.x, probe.shift.y].join();
      const memo = (window.__settle ??= { key: "", since: now });
      if (memo.key !== key) Object.assign(memo, { key, since: now });
      return now - memo.since >= quiet;
    },
    { quiet },
    { timeout: most, polling: 50 },
  ).catch(() => undefined);
};
