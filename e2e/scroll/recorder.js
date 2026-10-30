/*
 * The scroll harness's recorder, run in the page before anything else (see
 * page.addInitScript). It asks the chart's tile views to put themselves in
 * `window.__chartViews` (see TileView.probe), and then, while recording,
 * samples every frame once it has been drawn: the view's own account of
 * itself, where on screen a few stitches are, the box's scrollbars, and the
 * long animation frames the browser reports. The samples are read back and
 * measured by metrics.mjs.
 */
(() => {
  window.__chartViews = [];
  const probe = {
    recording: false,
    frames: [],
    loafs: [],
    marks: [],
    anchors: [],
  };
  window.__scrollProbe = probe;

  /*
   * Every scroll the page's own script sets on the chart's box, with where
   * from: a jump is most often one of these, set while the browser was
   * scrolling the box itself, or not matched by the layer.
   */
  probe.writes = [];
  const caller = () => (new Error().stack ?? "").split("\n").slice(3, 6).map((line) => line.trim().replace(/^at /, "")).join(" < ");
  // A glide's writes (see glide.ts) are the page's own smooth scroll, a little a frame.
  const note = (element, what, value) => {
    if (probe.recording && element.classList?.contains("chart-scroll")) {
      probe.writes.push({ t: performance.now(), what, value, from: caller(), glide: element.dataset.gliding !== undefined });
    }
  };
  // The browser's own setters, for the fling below, which is the browser's doing and not the page's.
  const setters = {};
  for (const name of ["scrollLeft", "scrollTop"]) {
    const own = Object.getOwnPropertyDescriptor(Element.prototype, name);
    setters[name] = own.set;
    Object.defineProperty(Element.prototype, name, {
      ...own,
      set(value) {
        note(this, name, value);
        own.set.call(this, value);
      },
    });
  }
  for (const name of ["scrollTo", "scrollBy"]) {
    const own = Element.prototype[name];
    Element.prototype[name] = function (...args) {
      note(this, name, JSON.stringify(args));
      return own.apply(this, args);
    };
  }

  const view = () => window.__chartViews[window.__chartViews.length - 1];
  const scroller = () => document.querySelector(".chart-scroll");

  try {
    new PerformanceObserver((list) => {
      if (!probe.recording) return;
      for (const entry of list.getEntries()) {
        probe.loafs.push({
          start: entry.startTime,
          duration: entry.duration,
          blocking: entry.blockingDuration ?? 0,
          scripts: (entry.scripts ?? []).slice(0, 3).map((script) => ({
            invoker: script.invoker,
            duration: script.duration,
            source: script.sourceFunctionName,
          })),
        });
      }
    }).observe({ type: "long-animation-frame", buffered: false });
  } catch {
    // Not every browser reports long animation frames.
  }

  /**
   * The stitches to follow on screen: those under a grid of points across
   * the box, the middle first. A point over a gap between stitches looks a
   * little to either side.
   */
  const pick = () => {
    const v = view();
    const box = scroller();
    if (!v || !box) return [];
    const rect = box.getBoundingClientRect();
    const top = Math.max(rect.top, 0);
    const bottom = Math.min(rect.bottom, innerHeight);
    const found = [];
    for (const [fx, fy] of [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8], [0.5, 0.2], [0.5, 0.8], [0.2, 0.5], [0.8, 0.5]]) {
      const x = rect.left + rect.width * fx;
      const y = top + (bottom - top) * fy;
      let id;
      for (let step = 0; step < 12 && id === undefined; step++) {
        const dx = (step % 2 ? -1 : 1) * Math.ceil(step / 2) * 4;
        id = v.stitchAt(x + dx, y) ?? v.stitchAt(x, y + dx);
      }
      if (id !== undefined && !found.includes(id)) found.push(id);
    }
    return found;
  };

  const round = (n) => Math.round(n * 100) / 100;
  // Each view numbered as it is first seen: a new one is a new chart, the knitting gone on to another view.
  const serials = new WeakMap();
  const serialOf = (v) => {
    if (!serials.has(v)) serials.set(v, ++seen);
    return serials.get(v);
  };
  let seen = 0;

  const sample = (time) => {
    const v = view();
    const box = scroller();
    if (!v || !box) {
      probe.frames.push({ t: time, missing: true });
      return;
    }
    const state = v.probe();
    const sheet = box.querySelector(".chart-sheets").getBoundingClientRect();
    const rect = box.getBoundingClientRect();
    // Where each stitch followed is on screen, if its cell is drawn; one gone from view is let go and another found.
    const anchors = probe.anchors.map((id) => {
      const cell = v.cellOnSheet(id);
      if (!cell) return [id, null];
      return [id, round(sheet.left + cell.x), round(sheet.top + cell.y), round(cell.width)];
    });
    // The outline round the stitch to be worked next, where it is on screen: what the chart follows.
    const nextOutline = box.querySelector(".chart-next");
    const nextRect = nextOutline && !nextOutline.hidden ? nextOutline.getBoundingClientRect() : null;
    const next = nextRect ? [round(nextRect.left), round(nextRect.top), round(nextRect.width)] : null;
    const visible = anchors.filter(([, x, y]) => x !== null && x > rect.left && x < rect.right && y > rect.top && y < rect.bottom);
    if (visible.length < 3 && !state.moving.columns && !state.moving.rows) probe.anchors = pick();
    probe.frames.push({
      t: round(time),
      view: serialOf(v),
      // When the frame was sampled, after it was drawn: a scroll the page set in the frame was set before this.
      ts: round(performance.now()),
      // A pinch under way stands the sheet in at its new size by scaling it, where cells are not where the view says.
      scaled: !!box.querySelector(".chart-sheets").style.transform,
      s: state,
      box: { left: round(rect.left), top: round(rect.top), width: round(rect.width), height: round(rect.height) },
      sheetRect: { left: round(sheet.left), top: round(sheet.top) },
      transform: box.querySelector(".chart-layer")?.style.transform ?? "",
      a: anchors,
      next,
      vw: innerWidth,
      vh: innerHeight,
      dpr: devicePixelRatio,
    });
  };

  // Sampled once the frame has been drawn: a task posted from the frame runs after it.
  const channel = new MessageChannel();
  let pending = 0;
  channel.port1.onmessage = () => sample(pending);
  const tick = (time) => {
    if (!probe.recording) return;
    pending = time;
    channel.port2.postMessage(0);
    requestAnimationFrame(tick);
  };

  /*
   * A fling's momentum after a finger lifts, as a phone's: the scroll goes on
   * at the speed the finger left it, slowing as iOS's does (by 0.998 a
   * millisecond), set between frames as the browser's own scrolling is, so
   * that the page sees it in the frame it is drawn in. What a phone does with
   * a scroll the page sets meanwhile differs: iOS carries on from where the
   * fling had got to, as if it had not been set; Android stops the fling.
   * Flung into an end, iOS bounces, when `bounce`: it goes on past it,
   * slowing hard, telling the page of scrolls beyond it, and springs back by
   * itself - which this browser can't, so the box's scroll is only read as
   * past the end meanwhile, and nothing on screen moves for it.
   * `vx` and `vy` are in pixels a second, positive scrolling right and down.
   */
  probe.fling = ({ vx = 0, vy = 0, mode = "ios", bounce = false }) =>
    new Promise((done) => {
      const box = scroller();
      if (!box) return done();
      let x = box.scrollLeft;
      let y = box.scrollTop;
      let last = performance.now();
      // How far past each end it has gone, and the scroll as read meanwhile.
      const past = { x: 0, y: 0 };
      const read = {};
      for (const [name, axis] of [["scrollLeft", "x"], ["scrollTop", "y"]]) {
        const own = Object.getOwnPropertyDescriptor(Element.prototype, name);
        read[name] = own;
        Object.defineProperty(box, name, { configurable: true, get: () => own.get.call(box) + past[axis], set: (value) => own.set.call(box, value) });
      }
      const ends = () => {
        const across = Math.max(0, box.scrollWidth - box.clientWidth);
        const fromRight = getComputedStyle(box).direction === "rtl";
        return { x: fromRight ? [-across, 0] : [0, across], y: [0, Math.max(0, box.scrollHeight - box.clientHeight)] };
      };
      const finish = (why) => {
        delete box.scrollLeft;
        delete box.scrollTop;
        box.dispatchEvent(new Event("scroll"));
        done(why);
      };
      // Back from past the ends, by itself, over a little under half a second.
      const springBack = () => {
        const from = { ...past };
        const start = performance.now();
        const frame = () => {
          const s = Math.min(1, (performance.now() - start) / 450);
          past.x = from.x * (1 - s) ** 3;
          past.y = from.y * (1 - s) ** 3;
          box.dispatchEvent(new Event("scroll"));
          if (s < 1) requestAnimationFrame(frame);
          else finish("stopped");
        };
        requestAnimationFrame(frame);
      };
      const step = new MessageChannel();
      step.port1.onmessage = () => {
        const now = performance.now();
        const dt = Math.min(50, now - last);
        last = now;
        if (mode === "android" && (Math.abs(read.scrollLeft.get.call(box) - Math.round(x)) > 1 || Math.abs(read.scrollTop.get.call(box) - Math.round(y)) > 1)) return finish("stopped");
        const decay = 0.998 ** dt;
        vx *= decay;
        vy *= decay;
        x += (vx * dt) / 1000;
        y += (vy * dt) / 1000;
        const { x: [left, right], y: [top, bottom] } = ends();
        const inside = { x: Math.min(right, Math.max(left, x)), y: Math.min(bottom, Math.max(top, y)) };
        if (bounce) {
          // Past an end, a third as far as the momentum would carry it, and slowing hard.
          for (const axis of ["x", "y"]) {
            const beyond = (axis === "x" ? x : y) - inside[axis];
            if (beyond === 0) continue;
            past[axis] = Math.max(-60, Math.min(60, beyond / 3));
            if (axis === "x") vx *= 0.8;
            else vy *= 0.8;
          }
        }
        setters.scrollLeft.call(box, bounce ? inside.x : x);
        setters.scrollTop.call(box, bounce ? inside.y : y);
        // The browser tells of a scroll it makes; the parts past an end it would not otherwise.
        if (past.x || past.y) box.dispatchEvent(new Event("scroll"));
        if (Math.hypot(vx, vy) < 20) return past.x || past.y ? springBack() : finish("stopped");
        requestAnimationFrame(() => step.port2.postMessage(0));
      };
      box.dispatchEvent(new Event("scroll"));
      requestAnimationFrame(() => step.port2.postMessage(0));
    });

  probe.start = () => {
    probe.frames = [];
    probe.loafs = [];
    probe.marks = [];
    probe.writes = [];
    probe.anchors = pick();
    probe.recording = true;
    requestAnimationFrame(tick);
  };
  /** A note in the recording, for what the harness did when: a gesture begun, a button pressed. */
  probe.mark = (what) => probe.marks.push({ t: performance.now(), what });
  probe.stop = () => {
    probe.recording = false;
    return { frames: probe.frames, loafs: probe.loafs, marks: probe.marks, writes: probe.writes };
  };
})();
