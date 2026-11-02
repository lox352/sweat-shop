/**
 * The keyframes the chart's layer slides by as the box scrolls (see
 * TileView.slideWithScroll): read back from the browser, and where they put
 * the layer at every scroll up to two boxes either side of the box held to
 * where the view itself puts it there. The browser may scroll that far before
 * the page has made them again, and puts the layer where they say meanwhile.
 *
 * Once, the box's scroll was measured while what floats over the tiles,
 * unclipped and slid hundreds of pixels, reached past the sheet: the
 * keyframes were made for a box that could scroll further than it could, and
 * put the layer as much as 230 pixels from where it goes. On a phone the
 * chart jolted, tore and flashed blank.
 */
import { test, expect } from "playwright/test";
import { eachYearOnce, instrument, open } from "./scroll/scenarios.mjs";

test("the layer's keyframes put it where the view does, at every scroll two boxes either side", async ({ page, context }) => {
  await instrument(context);
  await open(page, { choices: eachYearOnce, progress: 6000, knitting: true });
  test.skip(!(await page.evaluate(() => typeof window.ScrollTimeline === "function")), "a browser without scroll timelines puts the layer from the page");
  const worst = await page.evaluate(async () => {
    const view = window.__chartViews.at(-1);
    const box = document.querySelector(".chart-scroll");
    const frame = () => new Promise((done) => requestAnimationFrame(() => done()));
    const scrolled = (name) => Object.getOwnPropertyDescriptor(Element.prototype, name).get.call(box);
    // Where keyframes put the layer at a point along their timeline, as the browser does: steps between them.
    const at = (frames, p) => {
      if (p <= frames[0].computedOffset) return frames[0].by;
      for (let k = 0; k + 1 < frames.length; k++) {
        const [a, b] = [frames[k], frames[k + 1]];
        if (p > b.computedOffset) continue;
        const t = (p - a.computedOffset) / Math.max(1e-9, b.computedOffset - a.computedOffset);
        const steps = /steps\((\d+)/.exec(a.easing);
        return a.by + (b.by - a.by) * (steps ? Math.floor(t * Number(steps[1])) / Number(steps[1]) : t);
      }
      return frames.at(-1).by;
    };
    const worst = { across: 0, down: 0, frames: 0 };
    for (let k = 0; k < 60; k++) {
      // Up the yoke and to the left, the columns closing and the rows too.
      box.scrollBy(-14, -7);
      await frame();
      await frame();
      for (const [name, axis, index] of [["across", view.columns, 0], ["down", view.rows, 1]]) {
        const frames = view.slider.moved.get(view.layer)[index].effect.getKeyframes().map((f) => ({
          ...f,
          by: name === "across" ? parseFloat(f.translate) || 0 : new DOMMatrixReadOnly(f.transform === "none" ? undefined : f.transform).m42,
        }));
        const size = name === "across" ? box.clientWidth : box.clientHeight;
        const now = scrolled(name === "across" ? "scrollLeft" : "scrollTop");
        const fromRight = name === "across" && getComputedStyle(box).direction === "rtl";
        const extent = name === "across" ? box.scrollWidth - box.clientWidth : box.scrollHeight - box.clientHeight;
        const [lowest, highest] = fromRight ? [-extent, 0] : [0, extent];
        const along = (s) => (fromRight ? highest - s : s - lowest) / (highest - lowest);
        for (let d = -2 * size; d <= 2 * size; d += 4) {
          const s = Math.min(highest, Math.max(lowest, now + d));
          const goes = (name === "across" ? view.slideAcross(axis.places, s) : view.slideDown(axis.places, s)) + axis.held;
          worst[name] = Math.max(worst[name], Math.abs(at(frames, along(s)) - goes));
        }
      }
      worst.frames++;
    }
    return worst;
  });
  expect(worst.frames).toBe(60);
  // Within a few pixels: the keyframes are on whole pixels of the screen, and a few apart beyond the box.
  expect(worst.across, "across").toBeLessThanOrEqual(8);
  expect(worst.down, "down").toBeLessThanOrEqual(8);
});
