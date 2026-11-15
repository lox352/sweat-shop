import { describe, expect, it } from "vitest";
import { sweaterById } from ".";
import { buildSweater } from "../engine/engine";
import { shaped, writtenPattern } from "./written";

describe("a size written out", () => {
  it("brackets a shaping round's repeats, as a pattern writes them", () => {
    expect(shaped([{ work: "m1" }, { work: "k", times: 2 }, { work: "m1" }, { work: "k", times: 2 }, { work: "m1" }, { work: "k", times: 3 }])).toBe("[m1, k2] x 2, m1, k3");
    expect(shaped([{ work: "k", times: 4 }])).toBe("k4");
  });

  it("is a line a round or instruction, with the counts the knitting names", () => {
    const pattern = sweaterById("hamefarin")!;
    const text = writtenPattern(pattern, "m", buildSweater(pattern, "m").checks);
    expect(text.split("\n")[0]).toBe("Hamefarin, size M");
    expect(text).toContain("Join to work in the round.");
    expect(text).toMatch(/Divide, in A: k\d+, put \d+ on hold for sleeve-right, cast on \d+/);
    expect(text).toMatch(/Bind off/);
  });
});
