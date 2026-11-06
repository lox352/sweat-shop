import { it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { buildSweater } from "../../../knitting/engine";
import { allPositions, decodeSettled } from "../settled/format";
import raglan from "../feline-raglan";

it("dumps the raglan yoke in 3d", () => {
  const size = process.env.SIZE ?? "m";
  const built = buildSweater(raglan, size);
  const file = JSON.parse(readFileSync(process.env.FILE ?? `src/data/sweaters/settled/feline-raglan--${size}.json`, "utf8"));
  const pos = allPositions(built.stitches, decodeSettled(file));
  const out: unknown[] = [];
  built.rounds.forEach((round, i) => {
    if (built.roundPieces[i] !== "yoke") return;
    round.forEach((id, k) => { const s = built.stitches[id]; out.push([pos[id * 3], pos[id * 3 + 1], pos[id * 3 + 2], s.slot, s.type, i, k, id, s.links[0] ?? -1]); });
  });
  writeFileSync(process.env.OUT!, JSON.stringify(out));
});
