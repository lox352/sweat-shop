import { it } from "vitest";
/* eslint-disable @typescript-eslint/no-explicit-any -- an experiment harness reading its own JSON */
import { readFileSync, writeFileSync } from "node:fs";
import { growing, narrowing, shapingOptions } from "../shaping";

it.skipIf(!process.env.OUT)("solves the recorded problems", () => {
  shapingOptions.widerRepeats = process.env.WIDER === "1";
  const problems = JSON.parse(readFileSync(process.env.IN!, "utf8"));
  const out = problems.map((p: any) => {
    const t = { from: p.from, to: p.to, want: (i: number) => p.wants[i], ...(p.tolerance != null ? { tolerance: p.tolerance } : {}) };
    const t0 = performance.now();
    let steps: any[] = [];
    let error: string | null = null;
    try { steps = (p.kind === "growing" ? growing : narrowing)(p.rows, t); } catch (e) { error = String(e); }
    const ms = performance.now() - t0;
    return {
      design: p.design, size: p.size, kind: p.kind, ms, error,
      rounds: steps.map((s, i) => {
        const r = p.rows[i];
        return { row: "plain" in r ? `plain ${r.plain}` : `${r.year}${r.chart}${r.row}`, want: p.wants[i], count: s.count, kind: s.kind,
          w: s.map ? s.map.length : null, uniq: s.map ? new Set(s.map).size : null, reps: s.reps ?? null, cw: "plain" in r ? null : r.w,
          seam: !!s.seam, resized: s.resized ?? null, map: s.map ?? null };
      }),
    };
  });
  writeFileSync(process.env.OUT!, JSON.stringify(out));
}, 1200000);
