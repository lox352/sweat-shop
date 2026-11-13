import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { shapingOptions } from "../shaping";

it.skipIf(!process.env.OUT)("records the samplers' shaping problems", async () => {
  const out: unknown[] = [];
  let current = { design: "", size: "" };
  const seen = new Set<string>();
  shapingOptions.record = (kind, rows, t) => {
    const p = { ...current, kind, rows, from: t.from, to: t.to, tolerance: t.tolerance ?? null, wants: rows.map((_, i) => t.want(i)) };
    const key = JSON.stringify([current, kind, t.from, t.to, p.wants]);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  };
  const { buildSweater } = await import("../../../../../knitting/engine");
  for (const id of ["wool-week-strips-once-oldest", "wool-week-strips-lined-oldest"]) {
    const s = (await import(`../../../${id}.ts`)).default;
    for (const size of s.sizes) {
      current = { design: id, size: size.id };
      buildSweater(s, size.id);
    }
  }
  writeFileSync(process.env.OUT!, JSON.stringify(out));
}, 600000);
