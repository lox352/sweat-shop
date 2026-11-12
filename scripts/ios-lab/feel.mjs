// How a scroll by hand feels, frame by frame: node scripts/ios-lab/feel.mjs test-results/ios-lab/<tag>-<scenario>.json ...
// For each frame the box's scroll moved at least 2 px: what is on screen did against what the scroll did.
// stall: on screen moved under a third of the scroll; backwards: against it; rush: over three times it.
import { readFileSync } from "node:fs";
import { motionOf } from "../../e2e/scroll/metrics.mjs";

for (const file of process.argv.slice(2)) {
  const r = JSON.parse(readFileSync(file, "utf8"));
  const frames = r.frames.filter((f) => !f.missing);
  const motion = motionOf(frames).filter((m) => m && m.n > 0 && Number.isFinite(m.dx));
  let moving = 0, stall = 0, back = 0, rush = 0, worst = 0;
  for (const m of motion) {
    for (const [d, sc] of [[m.dx, m.scrollX], [m.dy, m.scrollY]]) {
      if (Math.abs(sc) < 2) continue;
      moving++;
      // What is on screen moves the other way to the scroll: its share of the scroll's move.
      const share = -d / sc;
      if (share < 0) back++;
      else if (share < 1 / 3) stall++;
      else if (share > 3) rush++;
      worst = Math.max(worst, Math.abs(d + sc));
    }
  }
  console.log(file.split("/").pop().padEnd(34), JSON.stringify({ moving, stall, back, rush, worstOff: Math.round(worst) }));
}
