import { describe, expect, it } from "vitest";
import { chartWidth, fitCell, leastCell, maxCell, minCell, settleCell, stepCell } from "./zoom";

describe("how far the chart zooms", () => {
  it("fits a chart's whole width to the box, as near as a hundredth of a pixel a stitch", () => {
    // Each Year Once's from-the-neck chart in a phone's box, and in a laptop's.
    for (const [room, columns] of [[319, 448], [1240, 448], [374, 240]]) {
      const cell = fitCell(room, columns);
      expect(chartWidth(columns, cell)).toBeLessThanOrEqual(room);
      expect(chartWidth(columns, cell + 0.01)).toBeGreaterThan(room);
    }
    // Room kept at a tear makes it fit smaller.
    expect(fitCell(1240, 448, 4)).toBeLessThanOrEqual(fitCell(1240, 448));
  });

  it("goes out as far as fitting the box, or to the least whole size where the chart fits already", () => {
    const fit = fitCell(319, 448);
    expect(fit).toBeLessThan(1);
    expect(leastCell(319, 448)).toBe(fit);
    // A narrow chart in a wide box fits at more than the least whole size: it zooms out to that and no further.
    expect(leastCell(1240, 40)).toBe(minCell);
  });

  it("keeps whole pixels from the least whole size up, hundredths below, and lands on the least when near it", () => {
    const least = 0.69;
    expect(settleCell(16.4, least)).toBe(16);
    expect(settleCell(99, least)).toBe(maxCell);
    expect(settleCell(3.456, least)).toBe(3.46);
    expect(settleCell(0.7, least)).toBe(least);
    expect(settleCell(0.1, least)).toBe(least);
  });

  it("steps by four pixels from the least whole size up, by half again below it, ending at the box's width", () => {
    const least = 0.69;
    expect(stepCell(16, -1, least)).toBe(12);
    expect(stepCell(8, 1, least)).toBe(12);
    // From 8 out, a third less each press, all the way to fitting the box.
    const outs = [8];
    while (outs[outs.length - 1] > least) outs.push(stepCell(outs[outs.length - 1], -1, least));
    expect(outs[outs.length - 1]).toBe(least);
    expect(outs.length).toBeLessThan(10);
    for (let k = 1; k < outs.length; k++) expect(outs[k]).toBeLessThan(outs[k - 1]);
    // And back in by the same steps, to 8 and on.
    expect(stepCell(least, 1, least)).toBeCloseTo(least * 1.5, 2);
    expect(stepCell(6, 1, least)).toBe(minCell);
    expect(stepCell(least, -1, least)).toBe(least);
  });
});
