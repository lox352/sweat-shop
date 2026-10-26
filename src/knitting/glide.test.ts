import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Glide, glideTime, hermite } from "./glide";

/** Frames run by hand: each at the time given. */
let frames: ((time: number) => void)[] = [];
const run = (time: number) => {
  const now = frames;
  frames = [];
  for (const frame of now) frame(time);
};

/** A box to scroll, keeping every scroll written; scrolled no further left than `least`, as a box is held at its edge. */
const box = (least = -Infinity) => {
  const scroller = document.createElement("div");
  let left = 0;
  let top = 0;
  const written: [number, number][] = [];
  Object.defineProperty(scroller, "scrollLeft", { get: () => left, set: (value: number) => { left = Math.max(least, value); written.push([left, top]); } });
  Object.defineProperty(scroller, "scrollTop", { get: () => top, set: (value: number) => { top = value; written[written.length - 1][1] = top; } });
  return { scroller, written };
};

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (frame: (time: number) => void) => frames.push(frame));
  vi.stubGlobal("cancelAnimationFrame", () => (frames = []));
});
afterEach(() => vi.unstubAllGlobals());

describe("gliding the chart's box", () => {
  it("eases from where it is, as fast as it is going, to rest at its goal", () => {
    expect(hermite(10, 0, 110, 200, 0)).toEqual([10, 0]);
    const [end, speed] = hermite(10, 0.5, 110, 200, 200);
    expect(end).toBe(110);
    expect(speed).toBe(0);
    // Going at the speed it set off at.
    expect(hermite(10, 0.5, 110, 200, 0.001)[1]).toBeCloseTo(0.5, 2);
  });

  it("goes the whole way in one movement, each frame further, and stops there", () => {
    const { scroller, written } = box();
    const told: number[] = [];
    const glide = new Glide(scroller, () => told.push(scroller.scrollTop));
    glide.to({ left: -600, top: 300 }, 0);
    const time = glideTime(Math.hypot(600, 300));
    for (let t = 16; t < time + 50; t += 16) run(t);
    expect(glide.going).toBe(false);
    expect(written[written.length - 1]).toEqual([-600, 300]);
    for (let k = 1; k < written.length; k++) {
      expect(written[k][0]).toBeLessThanOrEqual(written[k - 1][0]);
      expect(written[k][1]).toBeGreaterThanOrEqual(written[k - 1][1]);
    }
    // Told after every frame's scroll, to draw the chart to match it.
    expect(told.length).toBe(written.length);
  });

  it("sent on elsewhere on the way, carries on from where it got to without a jolt", () => {
    const { scroller, written } = box();
    const glide = new Glide(scroller);
    glide.to({ left: 0, top: 1000 }, 0);
    for (let t = 16; t <= 112; t += 16) run(t);
    const before = written.slice(-2).map(([, top]) => top);
    glide.to({ left: 0, top: 1200 }, 112);
    run(128);
    const after = written[written.length - 1][1];
    // As far again as the frame before went, near enough: no standing start.
    const step = before[1] - before[0];
    expect(after - before[1]).toBeGreaterThan(step * 0.7);
    for (let t = 144; t < 1000; t += 16) run(t);
    expect(written[written.length - 1][1]).toBe(1200);
  });

  it("stops once the box is held at its edge short of where it was sent, as a browser's smooth scroll does", () => {
    // A box that scrolls no further left than -300.
    const { scroller, written } = box(-300);
    const glide = new Glide(scroller);
    glide.to({ left: -600, top: 0 }, 0);
    let t = 0;
    while (glide.going && t < 2000) run((t += 16));
    // Well before the glide's own time was up: it is not still sending the box to where it cannot go.
    expect(t).toBeLessThan(glideTime(600));
    expect(written[written.length - 1][0]).toBe(-300);
  });

  it("stops where it is when the knitter takes over", () => {
    const { scroller, written } = box();
    const glide = new Glide(scroller);
    glide.to({ left: 0, top: 1000 }, 0);
    run(16);
    run(32);
    scroller.dispatchEvent(new Event("touchstart"));
    expect(glide.going).toBe(false);
    const count = written.length;
    run(48);
    expect(written.length).toBe(count);
    glide.destroy();
  });
});
