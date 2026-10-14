import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "vite";

/**
 * Which sweaters need settling again.
 *
 * A settle is worth redoing when, and only when, what it settles has changed:
 * the knitting's shape, or the physics. So each sweater's fingerprint hashes
 * the physics' own source and, size by size, the knitting's topology - each
 * stitch's kind, what it is linked to and how wide and tall it is - and
 * nothing else. Not the colours: the hat site hashed every yarn slot too, so
 * recolouring a band re-settled the hat, and here a design is recoloured far
 * more often than it is reshaped.
 *
 * A sweater is needed when its fingerprint is not the one the manifest says
 * it was last settled at, or when any size's file is missing or has the
 * wrong number of positions.
 */
export const manifestPath = "scripts/settlement-manifest.json";
export const settledDir = "src/data/sweaters/settled";

const sources = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  if (entry.isDirectory()) return sources(path);
  return /\.ts$/.test(path) && !path.includes(".test.") ? [path] : [];
});

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

/** The knitting as the physics sees it: no colours. */
const topology = (built) => ({
  stitches: built.stitches.map((stitch) => [stitch.type, stitch.links, stitch.from ?? null, stitch.width ?? null, stitch.rise ?? null]),
  rounds: built.rounds,
  roundPieces: built.roundPieces,
  roundHeight: built.roundHeight,
});

export const settlementPlan = async (load) => {
  const { sweaters } = await load("/src/data/sweaters/index.ts");
  const { buildSweater } = await load("/src/knitting/engine.ts");
  // Everything the settling runs on; the bench's measuring tape changes nothing it does.
  const physics = ["src/constants.ts", ...sources("src/physics"), ...sources("src/types")]
    .filter((path) => !path.endsWith("gauge.ts"))
    .sort()
    .map((path) => `${path}\n${readFileSync(path, "utf8")}`)
    .join("\n");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  return sweaters.map((sweater) => {
    const hash = createHash("sha256").update(physics);
    let covered = true;
    for (const size of sweater.sizes) {
      const built = buildSweater(sweater, size.id);
      hash.update(JSON.stringify({ size: size.id, ...topology(built) }));
      const path = `${settledDir}/${sweater.id}--${size.id}.json`;
      if (!existsSync(path)) covered = false;
      else if (JSON.parse(readFileSync(path, "utf8")).deltas?.length !== built.stitches.length * 3) covered = false;
    }
    const fingerprint = hash.digest("hex");
    return {
      id: sweater.id,
      sizes: sweater.sizes.map((size) => size.id),
      fingerprint,
      needed: !covered || manifest[sweater.id] !== fingerprint,
    };
  });
};

if (process.argv[1]?.endsWith("settlement-plan.mjs")) {
  const plan = await withSite(settlementPlan);
  const needed = plan.filter((target) => target.needed);
  console.log(needed.length ? needed.map((target) => target.id).join(" ") : "Every sweater's sizes are settled and current.");
  if (process.argv.includes("--check") && needed.length) process.exitCode = 1;
}
