import { it } from "vitest";
import { buildSweater } from "../../../knitting/engine";
import raglan from "../feline-raglan";
it("prints fits", { timeout: 120000 }, () => {
  for (const size of raglan.sizes) { buildSweater(raglan, size.id); }
});
