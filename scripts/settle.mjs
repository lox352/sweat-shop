/**
 * Settle each size of each sweater once, and write down where it came to rest.
 *
 * A sweater's shape depends only on its knitting, so it is worked out here,
 * once, and committed: see src/physics/solver.ts. Nothing but Node is needed
 * - no browser, no build - and it runs the site's own TypeScript, so what is
 * written down is what the site would compute.
 *
 *     npm run settle                 every size of every sweater
 *     npm run settle -- hamefarin    every size of one
 *     npm run settle -- --changed    only those whose knitting or physics changed
 *     npm run settle -- hamefarin --size m
 *
 * A sweater's entry in the manifest moves on only once every one of its
 * sizes has settled, so an interrupted run is picked up again by --changed.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { manifestPath, settledDir, settlementPlan, withSite } from "./settlement-plan.mjs";

/*
 * Progress goes to settle.log as well as the terminal: Node holds back output
 * that is not going to a terminal, so a run piped to a file looks silent
 * until it ends - which the hat site once mistook for a settle that never
 * finished.
 */
const logPath = "settle.log";
writeFileSync(logPath, "");
const say = (line) => {
  process.stdout.write(`${line}\n`);
  appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`);
};

const args = process.argv.slice(2);
const sizeAt = args.indexOf("--size");
const onlySize = sizeAt >= 0 ? args[sizeAt + 1] : undefined;
const requested = args.filter((arg, index) => !arg.startsWith("--") && index !== sizeAt + 1);

await withSite(async (load) => {
  const plan = await settlementPlan(load);
  const unknown = requested.filter((id) => !plan.some((target) => target.id === id));
  if (unknown.length) throw new Error(`No sweater called ${unknown.join(", ")}`);
  const targets = plan.filter((target) =>
    requested.length ? requested.includes(target.id) : !args.includes("--changed") || target.needed,
  );
  if (!targets.length) {
    say("Every sweater's sizes are settled and current.");
    return;
  }

  const { sweaterById } = await load("/src/data/sweaters/index.ts");
  const { buildSweater } = await load("/src/knitting/engine.ts");
  const { pose } = await load("/src/physics/pose.ts");
  const { settle } = await load("/src/physics/solver.ts");
  const { encodeSettled } = await load("/src/data/sweaters/settled/format.ts");
  mkdirSync(settledDir, { recursive: true });
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};

  for (const target of targets) {
    const sweater = sweaterById(target.id);
    const sizes = target.sizes.filter((size) => !onlySize || size === onlySize);
    let all = sizes.length === target.sizes.length;
    for (const sizeId of sizes) {
      const label = `${target.id}/${sizeId}`;
      const built = buildSweater(sweater, sizeId);
      const started = Date.now();
      const result = settle(built, pose(built), {}, ({ steps, moved }) => {
        if (steps % 50 === 0) {
          say(`  ${label}: ${steps} steps, the average stitch moving ${moved.toFixed(5)} of its width a step, ${((Date.now() - started) / 1000).toFixed(0)}s`);
        }
      });
      const seconds = ((Date.now() - started) / 1000).toFixed(0);
      if (!result.rested) {
        say(`${label}: did not come to rest in ${result.steps} steps (${seconds}s); not written`);
        all = false;
        continue;
      }
      writeFileSync(`${settledDir}/${target.id}--${sizeId}.json`, JSON.stringify(encodeSettled(result.positions)));
      say(`${label}: settled in ${result.steps} steps, ${seconds}s`);
    }
    if (all) {
      manifest[target.id] = target.fingerprint;
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      say(`${target.id}: every size settled; the manifest is up to date`);
    }
  }
});
