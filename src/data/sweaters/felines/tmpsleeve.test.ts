import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { buildSweater } from "../../../knitting/engine";
import raglan from "../feline-raglan";
it("dumps a sleeve", { timeout: 120000 }, () => {
  const out: Record<string, string[]> = {};
  for (const size of (process.env.SIZES ?? "xs,m,2xl").split(",")) {
    const built = buildSweater(raglan, size);
    out[size] = built.rounds.filter((_, i) => built.roundPieces[i] === "sleeve-left").map((r) => r.map((id) => built.stitches[id].slot).join(""));
  }
  writeFileSync(process.env.OUT!, JSON.stringify(out));
});
