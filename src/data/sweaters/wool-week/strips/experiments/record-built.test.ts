import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { shapingOptions } from "../shaping";

it.skipIf(!process.env.OUT)("records the samplers' shaping", async () => {
  shapingOptions.widerRepeats = process.env.WIDER === "1";
  const out: unknown[] = [];
  let current = { design: "", size: "" };
  shapingOptions.record = (kind, rows, t, steps, ms) => {
    out.push({
      ...current, kind, ms,
      rounds: steps.map((s, i) => {
        const r = rows[i] as Record<string, unknown>;
        const map = s.map;
        return {
          row: "plain" in r ? `plain ${r.plain}` : `${r.year}${r.chart}${r.row}`,
          want: t.want(i), count: s.count, kind: s.kind,
          w: map ? map.length : null, cw: "plain" in r ? null : r.w, period: null as number | null, uniq: map ? new Set(map).size : null, reps: s.reps ?? null,
          seam: !!s.seam, resized: s.resized ?? null, map: map ?? null,
        };
      }),
    });
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
