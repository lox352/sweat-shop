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
 * Each is written as its shape (see shapes.mjs) as soon as it has settled, so
 * an interrupted run is picked up again by --changed.
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { settlementPlan, withSite } from "./settlement-plan.mjs";
import { editionKey, pruneShapes, readShapes, shapePath, shapesDir, writeShapes } from "./shapes.mjs";

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
const requested = args.filter((arg, index) => !arg.startsWith("--") && (sizeAt < 0 || index !== sizeAt + 1));

await withSite(async (load) => {
  const plan = await settlementPlan(load);
  const unknown = requested.filter((id) => !plan.some((target) => target.id === id));
  if (unknown.length) throw new Error(`No sweater called ${unknown.join(", ")}`);
  const targets = plan.filter((target) =>
    (!onlySize || target.size === onlySize) && (requested.length ? requested.includes(target.id) : !args.includes("--changed") || target.needed),
  );
  if (!targets.length) {
    say("Every sweater's sizes are settled and current.");
    return;
  }

  const { sweaterById } = await load("/src/compiler/designs/index.ts");
  const { buildSweater } = await load("/src/compiler/engine/engine.ts");
  const { pose } = await load("/src/physics/pose.ts");
  const { settle } = await load("/src/physics/solver.ts");
  const { encodeSettled, fabricPositions } = await load("/src/library/settled/format.ts");
  mkdirSync(shapesDir, { recursive: true });
  const shapes = readShapes();
  const record = (target) => {
    shapes[editionKey(target.id, target.size, target.edition)] = target.shape;
    writeShapes(shapes);
  };

  let all = true;
  for (const target of targets) {
    const label = `${target.id}/${target.size}`;
    // Its shape is there already - a recolouring, say - and only wants recording.
    if (target.settled && args.includes("--changed")) {
      record(target);
      say(`${label}: its shape ${target.shape} is settled already`);
      continue;
    }
    const built = buildSweater(sweaterById(target.id), target.size);
    const started = Date.now();
    const result = settle(built.knitting, pose(built.knitting), {}, ({ steps, moved }) => {
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
    writeFileSync(shapePath(target.shape), JSON.stringify(encodeSettled(fabricPositions(built.stitches, result.positions))));
    record(target);
    say(`${label}: settled in ${result.steps} steps, ${seconds}s, as shape ${target.shape}`);
  }
  // A shape no edition has any longer is let go only once nothing is still waiting on its replacement.
  if (all && !requested.length && !onlySize) for (const file of pruneShapes(shapes)) say(`${file}: no edition has this shape any longer; removed`);
});
