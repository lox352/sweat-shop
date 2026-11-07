import { it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { buildSweater } from "../../../knitting/engine";
import { allPositions, decodeSettled } from "../settled/format";
import raglan from "../feline-raglan";
it("dumps the left sleeve in 3d", () => {
  const built = buildSweater(raglan, "m");
  const file = JSON.parse(readFileSync("src/data/sweaters/settled/feline-raglan--m.json", "utf8"));
  const pos = allPositions(built.stitches, decodeSettled(file));
  const out: unknown[] = [];
  built.rounds.forEach((round, i) => {
    const piece = built.roundPieces[i];
    if (!["sleeve-left", "sleeve-right", "yoke", "body"].includes(piece)) return;
    round.forEach((id, k) => { const s = built.stitches[id]; out.push([pos[id * 3], pos[id * 3 + 1], pos[id * 3 + 2], s.slot, s.type, i, k, id, s.links[0] ?? -1, piece]); });
  });
  writeFileSync(process.env.OUT!, JSON.stringify(out));
});
