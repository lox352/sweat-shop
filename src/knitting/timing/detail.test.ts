import { describe, expect, it } from "vitest";
import { sweaterById } from "../../data/sweaters";
import { buildSweater } from "../engine";
import { detail, windowed } from "./detail";
import type { Action } from "./log";
import { prefixFor, predict, typical } from "./model";

const { stitches, rounds } = buildSweater(sweaterById("hamefarin")!, "xs");

describe("a running average", () => {
  it("averages the stitches around each, in knitting order, skipping any without a time", () => {
    const values = [NaN, 1, 2, 3, NaN, 5];
    const out = windowed(values, [1, 2, 3, 4, 5], 3);
    // At the start the window can't be centred, so it takes the first three.
    expect(Array.from(out.slice(1))).toEqual([2, 2, 2.5, NaN, 5]);
  });
});

describe("the detail", () => {
  // Two evenings, every run of eight tapped, the second evening half again slower.
  const prefix = prefixFor(stitches);
  const actions: Action[] = [];
  let t = Date.UTC(2026, 8, 20, 18);
  for (let from = 0; from < 1600; from += 8) {
    if (from === 800) t += 20 * 3_600_000;
    t += predict(prefix, typical, from, from + 8) * 1000 * (from < 800 ? 1 : 1.5);
    actions.push({ t, from, to: from + 8 });
  }
  const time = detail(actions, stitches, rounds);

  it("knows which sitting each stitch was knitted in, and when", () => {
    expect(time.sittings).toHaveLength(2);
    expect(time.sittingOf[400]).toBe(0);
    expect(time.sittingOf[1200]).toBe(1);
    expect(time.sittingOf[2000]).toBe(-1);
    expect(time.reachedAt[8]).toBe(actions[0].t);
  });

  it("sees the slower evening in the pace around each stitch", () => {
    const early = time.smooth[500] / time.usual;
    const late = time.smooth[1300] / time.usual;
    expect(late / early).toBeGreaterThan(1.3);
    expect(Number.isNaN(time.smooth[2000])).toBe(true);
  });

  it("counts what the timed taps covered, for how sure each speed is", () => {
    expect(time.seen.tap).toBeGreaterThan(190);
    expect(time.seen.knit + time.seen.purl + time.seen.tbl).toBeGreaterThan(1000);
  });
});
