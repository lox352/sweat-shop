import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { buildSweater } from "../knitting/engine";
import { testSweater } from "../knitting/test-sweater";
import { pose } from "./pose";
import { settle } from "./solver";

const built = buildSweater(testSweater, "one");
const hash = (positions: Float32Array) =>
  createHash("sha256").update(Buffer.from(positions.buffer)).digest("hex");

describe("settling the test sweater", () => {
  const posed = pose(built);
  const first = settle(built, posed);

  it("comes to rest", () => {
    expect(first.rested).toBe(true);
    expect(first.positions.every(Number.isFinite)).toBe(true);
  });

  it("gives the same answer every time it is run", () => {
    expect(hash(settle(built, posed).positions)).toBe(hash(first.positions));
  });

  it("holds the neck where the pose put it", () => {
    for (const id of built.rounds[0]) {
      for (let axis = 0; axis < 3; axis++) {
        expect(first.positions[id * 3 + axis]).toBe(posed.positions[id * 3 + axis]);
      }
    }
  });

  it("lets the body fall below where it started, and the sleeves down their arms", () => {
    const meanY = (piece: string, positions: Float32Array) => {
      const ids = built.rounds.filter((_, index) => built.roundPieces[index] === piece).flat();
      return ids.reduce((sum, id) => sum + positions[id * 3 + 1], 0) / ids.length;
    };
    expect(meanY("body", first.positions)).toBeLessThan(meanY("body", posed.positions) + 0.5);
    expect(meanY("sleeve-left", first.positions)).toBeLessThan(meanY("yoke", first.positions));
  });
});
