import { existsSync, readFileSync } from "node:fs";
import { createServer } from "vite";
import { editionKey, readShapes, shapeNamer, shapePath } from "./shapes.mjs";

/**
 * Which sizes need settling.
 *
 * A size's knitting has a shape (see shapes.mjs), named by its fabric and the
 * physics: a size is needed when its edition now is not recorded as having
 * that shape, or the shape's file is missing or of an older version. So a
 * settle is redone when, and only when, what it settles has changed - not
 * for a recolouring, nor a step added - and an interrupted run is picked up
 * where it stopped.
 */

/** A Vite server to load the site's TypeScript with, and close afterwards. */
export const withSite = async (work) => {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    logLevel: "warn",
  });
  try {
    return await work((path) => vite.ssrLoadModule(path));
  } finally {
    await vite.close();
  }
};

/** Every size, with its edition and shape now, and whether that has still to be settled. */
export const settlementPlan = async (load) => {
  const { sweaters } = await load("/src/data/sweaters/index.ts");
  const { buildSweater } = await load("/src/knitting/engine.ts");
  const { settledLength, settledVersion } = await load("/src/data/sweaters/settled/format.ts");
  const { encodeEdition, hashable } = await load("/src/data/sweaters/editions/format.ts");
  const { nameOf } = await import("./editions.mjs");
  const shapeOf = await shapeNamer(load);
  const shapes = readShapes();
  return sweaters.flatMap((sweater) =>
    sweater.sizes.map((size) => {
      const built = buildSweater(sweater, size.id);
      const edition = nameOf(hashable(encodeEdition(built, sweater.id, size.id, "")));
      const shape = shapeOf(built.knitting);
      const path = shapePath(shape);
      const file = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined;
      const fits = file?.version === settledVersion && file.deltas?.length === settledLength(built.stitches);
      return { id: sweater.id, size: size.id, edition, shape, settled: fits, needed: !fits || shapes[editionKey(sweater.id, size.id, edition)] !== shape };
    }),
  );
};

if (process.argv[1]?.endsWith("settlement-plan.mjs")) {
  const plan = await withSite(settlementPlan);
  const needed = plan.filter((target) => target.needed);
  console.log(needed.length ? needed.map((target) => `${target.id}/${target.size}`).join(" ") : "Every sweater's sizes are settled and current.");
  if (process.argv.includes("--check") && needed.length) process.exitCode = 1;
}
