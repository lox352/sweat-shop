import { it, expect } from "vitest";
import { buildSweater } from "../../../knitting/engine";
import raglan from "../feline-raglan";

it("builds every raglan size", () => {
  for (const size of raglan.sizes) expect(() => buildSweater(raglan, size.id), size.id).not.toThrow();
});
