import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sweaterById } from "../../data/sweaters";
import { buildSweater } from "../engine";
import { updateSettings } from "../../helpers/settings";
import { actionsOf, isLog, readLog, recordPageEvent, recordProgress, type Action } from "./log";
import { observe, prefixFor, predict, summarise, typical } from "./model";
import { duration, range, timeLine } from "./format";
import { detail } from "./detail";

const { stitches, rounds } = buildSweater(sweaterById("hamefarin")!, "xs");
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.UTC(2026, 8, 20, 18, 0, 0));
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  updateSettings({ noStatistics: false });
});

describe("the log", () => {
  it("writes taps, undos and the page's events as small relative rows", async () => {
    recordPageEvent("project-a", "load");
    vi.advanceTimersByTime(40_000);
    recordProgress("project-a", 0, 12);
    vi.advanceTimersByTime(30_000);
    recordProgress("project-a", 12, 20);
    vi.advanceTimersByTime(3_000);
    recordProgress("project-a", 20, 12, true);
    recordPageEvent("project-a", "hide");
    await flush();
    const rows = readLog("project-a");
    expect(rows).toEqual([[Date.UTC(2026, 8, 20, 18) / 1000, 0, 12], [40, 12], [30, 8], [3, -8, 1], [0, 0, 13]]);
    expect(isLog(rows)).toBe(true);
    expect(actionsOf(rows)).toEqual([
      { t: Date.UTC(2026, 8, 20, 18, 0, 40), from: 0, to: 12 },
      { t: Date.UTC(2026, 8, 20, 18, 1, 10), from: 12, to: 20 },
      { t: Date.UTC(2026, 8, 20, 18, 1, 13), from: 20, to: 12, undo: true },
    ]);
  });

  it("marks progress that moved while nothing recorded it, and doesn't time it", () => {
    recordProgress("project-a", 0, 10);
    vi.advanceTimersByTime(3_600_000);
    recordProgress("project-a", 500, 510);
    const actions = actionsOf(readLog("project-a"));
    expect(actions.map(({ from, to, untimed }) => [from, to, !!untimed])).toEqual([
      [0, 10, false], [10, 500, true], [500, 510, false],
    ]);
    const { observations } = observe(actions, prefixFor(stitches));
    expect(observations.map(({ from, to, ms }) => [from, to, ms])).toEqual([[0, 10, undefined], [500, 510, undefined]]);
  });

  it("records nothing once statistics are turned off", () => {
    updateSettings({ noStatistics: true });
    recordProgress("project-a", 0, 10);
    recordPageEvent("project-a", "enter");
    expect(readLog("project-a")).toEqual([]);
  });

  it("rejects rows it doesn't know", () => {
    expect(isLog([[1, 2, 3]])).toBe(false);
    expect(isLog([[1, 0, 99]])).toBe(false);
    expect(isLog([[1.5, 2]])).toBe(false);
    expect(isLog("[]")).toBe(false);
  });
});

/** A steady knitter: every run tapped, at `speed` times typical, with a night's sleep in the middle. */
const knit = (upTo: number, speed = 1, runs = 8) => {
  const prefix = prefixFor(stitches);
  const actions: Action[] = [];
  let t = Date.UTC(2026, 8, 20, 18);
  for (let from = 0; from < upTo; from += runs) {
    const to = Math.min(from + runs, upTo);
    t += predict(prefix, typical, from, to) * 1000 * speed;
    if (from === Math.floor(upTo / 2 / runs) * runs) t += 10 * 3_600_000;
    actions.push({ t, from, to });
  }
  return actions;
};

describe("the summary", () => {
  it("counts the knitting and not the night between", () => {
    const actions = knit(2000, 1.2);
    const expected = predict(prefixFor(stitches), typical, 0, 2000, actions.length) * 1.2;
    const summary = summarise(actions, stitches, 2000)!;
    expect(summary.knitted / expected).toBeGreaterThan(0.97);
    expect(summary.knitted / expected).toBeLessThan(1.03);
    expect(summary.sittings).toHaveLength(2);
    expect(summary.days).toBe(2);
  });

  it("says how long is left, and brackets what it should take", () => {
    // A third of the way through: past the ribbed neck and into the yoke.
    const through = Math.round(stitches.length * 0.3);
    const summary = summarise(knit(through, 1.2), stitches, through)!;
    const truth =
      predict(prefixFor(stitches), typical, through, stitches.length - 1, (stitches.length - through - 1) / 8) * 1.2;
    expect(summary.left!.low).toBeLessThan(truth * 1.05);
    expect(summary.left!.high).toBeGreaterThan(truth * 0.95);
  });

  it("waits for enough knitting before saying how long is left", () => {
    expect(summarise(knit(80), stitches, 80)!.left).toBeUndefined();
    expect(summarise([], stitches, 0)).toBeUndefined();
  });
});

describe("the words", () => {
  it("says durations and ranges plainly", () => {
    expect(duration(30)).toBe("under a minute");
    expect(duration(38 * 60)).toBe("38 min");
    expect(duration(5 * 3600 + 18 * 60)).toBe("5 h 18 min");
    expect(duration(2 * 3600)).toBe("2 h");
    expect(range({ low: 8 * 3600, mid: 9 * 3600, high: 10.5 * 3600 })).toBe("8–11 h");
    expect(range({ low: 30 * 60, mid: 35 * 60, high: 40 * 60 })).toBe("35 min");
    const time = { knitted: 3600 * 5.3, sittings: [], days: 1, left: { low: 8 * 3600, mid: 9 * 3600, high: 10 * 3600 } };
    expect(timeLine(time, false)).toBe("5 h 18 min knitted · about 8–10 h to go");
    expect(timeLine(time, true)).toBe("Knitted in 5 h 18 min");
  });
});

describe("jumps and undos", () => {
  /** Steady knitting, with `extra` actions slipped in after reaching `at`, and everything after moved on by `delay`. */
  const withInterlude = (actions: Action[], at: number, extra: (t: number) => Action[], delay: number) => {
    const i = actions.findIndex((a) => a.to === at);
    const inserted = extra(actions[i].t);
    return [...actions.slice(0, i + 1), ...inserted, ...actions.slice(i + 1).map((a) => ({ ...a, t: a.t + delay }))];
  };

  it("ignores a jump ahead to show someone, once it is undone", () => {
    const steady = knit(3000, 1.2);
    const shown = withInterlude(
      steady,
      1600,
      (t) => [
        { t: t + 5_000, from: 1600, to: 1900 },
        { t: t + 40_000, from: 1900, to: 1600, undo: true },
      ],
      40_000,
    );
    const plain = summarise(steady, stitches, 3000)!;
    const after = summarise(shown, stitches, 3000)!;
    expect(after.left!.mid / plain.left!.mid).toBeGreaterThan(0.97);
    expect(after.left!.mid / plain.left!.mid).toBeLessThan(1.03);
    expect(after.perMinute! / plain.perMinute!).toBeLessThan(1.03);

    // Straight after the undo, the stitches jumped to aren't knitted.
    const upToUndo = shown.slice(0, shown.findIndex((a) => a.undo) + 1);
    const time = detail(upToUndo, stitches, rounds);
    expect(time.sittingOf[1700]).toBe(-1);
    expect(Number.isNaN(time.reachedAt[1700])).toBe(true);
  });

  it("times a run tapped twice and undone from the tap before it", () => {
    const prefix = prefixFor(stitches);
    const t0 = Date.UTC(2026, 8, 20, 18);
    const run = predict(prefix, typical, 80, 88) * 1000;
    const actions: Action[] = [
      { t: t0, from: 72, to: 80 },
      { t: t0 + 600, from: 80, to: 88 },
      { t: t0 + 3_100, from: 88, to: 80, undo: true },
      { t: t0 + run, from: 80, to: 88 },
    ];
    const { observations } = observe(actions, prefix);
    expect(observations.map(({ from, to, ms }) => [from, to, ms])).toEqual([[72, 80, undefined], [80, 88, run]]);
  });

  it("doesn't time a jump ahead that is kept, but still counts its stitches", () => {
    const steady = knit(1600, 1.2);
    const last = steady.at(-1)!;
    const jumped = [...steady, { t: last.t + 5_000, from: 1600, to: 1900 }];
    const { observations } = observe(jumped, prefixFor(stitches));
    expect(observations.at(-1)).toEqual({ from: 1600, to: 1900, ms: undefined });
    const plain = summarise(steady, stitches, 1600)!;
    const after = summarise(jumped, stitches, 1900)!;
    expect(after.perMinute! / plain.perMinute!).toBeLessThan(1.03);
    expect(after.knitted).toBeGreaterThan(plain.knitted);
  });
});
