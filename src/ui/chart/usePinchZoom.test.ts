import { describe, expect, it } from "vitest";
import { resisted } from "./usePinchZoom";

describe("a chart pulled past its edge mid-pinch", () => {
  it("goes less and less far the further it is pulled, and never a box's length", () => {
    const box = 400;
    let was = 0;
    for (const over of [0, 10, 50, 100, 400, 2000]) {
      const went = resisted(over, box);
      expect(went).toBeGreaterThanOrEqual(was);
      expect(went).toBeLessThanOrEqual(over);
      expect(went).toBeLessThan(box);
      was = went;
    }
    // A little past it goes nearly as far as the fingers, a long way past hardly further.
    expect(resisted(10, box)).toBeGreaterThan(5);
    expect(resisted(2000, box) - resisted(1000, box)).toBeLessThan(100);
  });

  it("goes nowhere in a box with no length", () => {
    expect(resisted(100, 0)).toBe(0);
  });
});
