// Per frame, once drawn: how near the box the nearest stale picture on a placed canvas is - a tile not painted
// for the chart as it is, or the part of one painted only in part - which Safari shows if its scroll runs ahead
// of the page's. In the chart's own pixels, by the view's own account of what the box shows (TileView.showing).
// Also marks each real touch on the box in the recorder, as the harness's own marks come seconds early.
(() => {
  if (window.__exposure) return;
  const ex = (window.__exposure = { frames: [], on: false });
  const size = 256;
  const gap = (a, b) => Math.max(0, b.x0 - a.x1, a.x0 - b.x1, b.y0 - a.y1, a.y0 - b.y1);
  const sample = (time) => {
    const v = window.__chartViews?.at(-1);
    if (!v) return;
    const s = v.showing();
    const view = { x0: s.x, y0: s.y, x1: s.x + s.width, y1: s.y + s.height };
    let nearest = Infinity;
    let count200 = 0;
    for (const tile of v.tiles.values()) {
      if (tile.canvas.style.left === "-9999px" || !tile.canvas.isConnected) continue;
      const whole = { x0: tile.x, y0: tile.y, x1: tile.x + size, y1: tile.y + size };
      let stale = [];
      if (tile.painted !== v.version) stale = [whole];
      else if (tile.part) {
        const p = tile.part;
        stale = [
          { x0: whole.x0, y0: whole.y0, x1: whole.x1, y1: Math.max(whole.y0, p.y0) },
          { x0: whole.x0, y0: Math.min(whole.y1, p.y1), x1: whole.x1, y1: whole.y1 },
          { x0: whole.x0, y0: whole.y0, x1: Math.max(whole.x0, p.x0), y1: whole.y1 },
          { x0: Math.min(whole.x1, p.x1), y0: whole.y0, x1: whole.x1, y1: whole.y1 },
        ].filter((r) => r.x1 - r.x0 > 0.5 && r.y1 - r.y0 > 0.5);
      }
      for (const r of stale) {
        const d = gap(r, view);
        nearest = Math.min(nearest, d);
        if (d <= 200) count200++;
      }
    }
    ex.frames.push([Math.round(time), nearest === Infinity ? -1 : Math.round(nearest), count200, Math.round(view.x0), Math.round(view.y0)]);
  };
  const channel = new MessageChannel();
  let pending = 0;
  channel.port1.onmessage = () => sample(pending);
  const tick = (time) => {
    if (!ex.on) return;
    pending = time;
    channel.port2.postMessage(0);
    requestAnimationFrame(tick);
  };
  const mark = (what) => window.__scrollProbe?.recording && window.__scrollProbe.mark(what);
  document.addEventListener("touchstart", (e) => e.target.closest?.(".chart-scroll") && mark("swipe touch ios"), { passive: true, capture: true });
  document.addEventListener("touchend", (e) => e.target.closest?.(".chart-scroll") && mark("lifted"), { passive: true, capture: true });
  ex.start = () => { ex.frames = []; ex.on = true; requestAnimationFrame(tick); };
  ex.stop = () => { ex.on = false; return ex.frames; };
})();
