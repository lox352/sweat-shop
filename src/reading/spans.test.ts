import { describe, expect, it } from "vitest";
import { sweaterById } from "../compiler/designs";
import { buildSweater } from "../compiler/engine/engine";
import { isFabric, secondLoop, worksInto } from "../pattern/Stitch";
import { makesTwo } from "../pattern/kinds";
import { doneWith, holdFrom, spansOf, startOf, worksDoubleStitch } from "./spans";
import { progressBefore } from "./jump";

describe("the spans of a knitting", () => {
  const { stitches, rounds } = buildSweater(sweaterById("paul-klee")!, "m2");

  it("say and do a KFB or a KBF as one, both its loops", () => {
    const kfbs = spansOf(stitches).filter((span) => span.type === "kfb");
    expect(kfbs.length).toBe(stitches.filter((stitch) => makesTwo(stitch.type)).length);
    for (const span of kfbs) {
      expect(span).toMatchObject({ said: "one", done: "one", end: span.start + 2 });
      expect(secondLoop(stitches[span.start + 1], stitches[span.start])).toBe(true);
      expect(doneWith(stitches, span.start)).toBe(span);
      expect(doneWith(stitches, span.start + 1)).toBe(span);
      // Asked for either loop, a knitter is stood before the whole of it.
      expect(startOf(stitches, span.start + 1)).toBe(span.start);
    }
    expect(doneWith(stitches, kfbs[0].start - 1)).toBeUndefined();
  });

  it("say and do a sleeve going on hold as one, a step for each stitch it holds", () => {
    const { holds } = buildSweater(sweaterById("paul-klee")!, "m2");
    const runs = spansOf(stitches).filter((span) => span.type === "hold");
    expect(runs).toHaveLength(holds.length);
    runs.forEach((span, k) => {
      expect(span).toMatchObject({ said: "one", done: "one", end: span.start + holds[k].stitches.length });
      // Each step holds the next stitch round the needle, and the last of them is where they are held from.
      expect(stitches.slice(span.start, span.end).map((step) => worksInto(step)[0])).toEqual(holds[k].stitches);
      expect(span.end - 1).toBe(holds[k].heldAt);
      expect(holdFrom(stitches, span.start)).toEqual({ count: holds[k].stitches.length, last: span.end - 1 });
      expect(startOf(stitches, span.start + 3)).toBe(span.start);
    });
    // One step that says how many, as an edition frozen before a step was a stitch has it, is that many still.
    const old = [...stitches.slice(0, runs[0].start), { ...stitches[runs[0].start], links: [], count: 78 }, { ...stitches[1], id: runs[0].start + 1 }];
    expect(holdFrom(old, runs[0].start)).toEqual({ count: 78, last: runs[0].start });
  });

  it("stand a knitter jumped to a KFB's second loop before its first", () => {
    const span = spansOf(stitches).find((one) => one.type === "kfb")!;
    const round = rounds.findIndex((ids) => ids.includes(span.start + 1));
    expect(progressBefore(stitches, rounds, round + 1, rounds[round].indexOf(span.start + 1) + 1)).toBe(span.start - 1);
  });
});

describe("a turn's span", () => {
  const { stitches } = buildSweater(sweaterById("hamefarin")!, "m");
  const turns = spansOf(stitches).filter((span) => span.type === "turn");

  it("is the turn alone, and reaches forward to the stitch that works its double stitch as one", () => {
    expect(turns.length).toBe(stitches.filter((stitch) => stitch.type === "turn").length);
    expect(turns.length).toBeGreaterThan(0);
    for (const turn of turns) {
      expect(turn.end).toBe(turn.start + 1);
      expect(turn.done).toBeUndefined();
      // The stitch slipped and doubled is the one worked just before the turn; the closing stitch is worked into it, later.
      let doubled = turn.start - 1;
      while (!isFabric(stitches[doubled])) doubled--;
      expect(turn.closes).toBeGreaterThan(turn.start);
      expect(worksInto(stitches[turn.closes!])).toContain(doubled);
      expect(worksDoubleStitch(stitches, turn.closes!)).toBe(true);
    }
    // And each double stitch is worked once.
    expect(new Set(turns.map((turn) => turn.closes)).size).toBe(turns.length);
  });
});
