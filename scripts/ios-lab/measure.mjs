// node measure.mjs rec.json -> the repo's own measures of a recording (e2e/scroll/metrics.mjs), as JSON.
import { readFileSync } from "node:fs";
import { measure } from "../../e2e/scroll/metrics.mjs";

const recording = JSON.parse(readFileSync(process.argv[2], "utf8"));
const m = measure(recording);
m.jumps.list = m.jumps.list.map(({ writes, ...j }) => ({ ...j, writes: writes.map((w) => `${w.what}=${w.value}`) }));
console.log(JSON.stringify(m));
