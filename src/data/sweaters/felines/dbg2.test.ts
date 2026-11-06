import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { buildSweater } from "../../../knitting/engine";
import raglan from "../feline-raglan";

it("dumps the raglan yoke's slots", () => {
  const built = buildSweater(raglan, process.env.SIZE ?? "m");
  const out: string[] = [];
  built.rounds.forEach((round, i) => {
    if (built.roundPieces[i] !== "yoke") return;
    out.push(round.map((id) => `${built.stitches[id].slot}:${built.stitches[id].type}:${id}:${built.stitches[id].links[0] ?? -1}`).join(" "));
  });
  writeFileSync(process.env.OUT!, out.join("\n"));
});
