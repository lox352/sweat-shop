import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { measured } from "../wool-week/strips/design";
import { gauge, knit } from "./knit";
import { drawFeline, drawTraced } from "./raster";
it("dumps old and traced felines at each size's width", { timeout: 120000 }, () => {
  const out: Record<string, unknown> = {};
  for (const size of measured) {
    const k = knit(size.finished, "raglan", "t-");
    const w = k.placed.width;
    out[size.id] = {
      width: w,
      height: k.placed.height,
      old: { left: drawFeline("left", w, gauge).grid, right: drawFeline("right", w, gauge).grid },
      new: { left: drawTraced("left", w, gauge).grid, right: drawTraced("right", w, gauge).grid },
    };
  }
  writeFileSync(process.env.OUT!, JSON.stringify(out));
});
