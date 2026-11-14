import { existsSync, readFileSync } from "node:fs";

// Named here, not taken from editions.mjs: the site's config loads this, and that script starts a server of its own.
const cataloguePath = "src/data/sweaters/catalogue/catalogue.json";
const manifestFile = "src/data/sweaters/editions/manifest.json";

/**
 * Developing, the patterns as they are in hand.
 *
 * The site has one way to a pattern: it reads the catalogue of designs, and
 * fetches each size's knitting as a frozen edition (see
 * src/data/sweaters/editions). Those files are written by `npm run editions`,
 * so they are as old as its last run. While developing, the server writes
 * them afresh instead - the catalogue, the manifest, and each size's edition
 * now when it is asked for - from the designs and the engine as they are,
 * and loads the page again when either changes. Nothing of the site knows.
 * An edition a size has moved on from is the file it always was.
 */
const live = "0";

export const livePatterns = () => {
  let server;
  const load = (path) => server.ssrLoadModule(path);
  const manifestNow = async () => {
    const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, "utf8")) : {};
    const { sweaters } = await load("/src/data/sweaters/index.ts");
    // A design or size not yet named has an edition all the same, for as long as it is being worked on.
    for (const sweater of sweaters) for (const size of sweater.sizes) (manifest[sweater.id] ??= {})[size.id] ??= { first: live, current: live };
    return manifest;
  };
  return {
    name: "live-patterns",
    // The dev server alone: not a build, the tests, or a script's own server (see settlement-plan's withSite).
    apply: (config, { command }) => command === "serve" && !process.env.VITEST && !config.server?.middlewareMode,
    configureServer(dev) {
      server = dev;
      dev.middlewares.use(async (request, response, next) => {
        const asked = /\/editions\/([^/]+)--([^/]+)--([0-9a-f]+)\.json$/.exec((request.url ?? "").split("?")[0]);
        if (!asked) return next();
        try {
          const [, design, size, edition] = asked;
          if ((await manifestNow())[design]?.[size]?.current !== edition) return next();
          const { sweaters } = await load("/src/data/sweaters/index.ts");
          const { buildSweater } = await load("/src/knitting/engine.ts");
          const { encodeEdition } = await load("/src/data/sweaters/editions/format.ts");
          const sweater = sweaters.find((one) => one.id === design);
          response.setHeader("Content-Type", "application/json");
          response.setHeader("Cache-Control", "no-store");
          response.end(JSON.stringify(encodeEdition(buildSweater(sweater, size), design, size, edition)));
        } catch (error) {
          next(error);
        }
      });
      // A design's file or the engine is no part of the page, so nothing would load it again of itself.
      dev.watcher.on("change", (file) => {
        if (!/\/src\/.*\.ts$/.test(file) || dev.environments.client.moduleGraph.getModulesByFile(file)?.size) return;
        for (const path of [cataloguePath, manifestFile]) {
          for (const module of dev.environments.client.moduleGraph.getModulesByFile(`${process.cwd()}/${path}`) ?? []) {
            dev.environments.client.moduleGraph.invalidateModule(module);
          }
        }
        dev.ws.send({ type: "full-reload" });
      });
    },
    async load(id) {
      const file = id.split("?")[0];
      if (file.endsWith(`/${manifestFile}`)) return JSON.stringify(await manifestNow());
      if (!file.endsWith(`/${cataloguePath}`)) return undefined;
      const { sweaters } = await load("/src/data/sweaters/index.ts");
      const { buildSweater } = await load("/src/knitting/engine.ts");
      const { encodeCatalogue } = await load("/src/data/sweaters/catalogue/format.ts");
      // A sampler's yarns are those its sizes knit, known once they are knitted: see editions.mjs.
      for (const sweater of sweaters) if (sweater.slotsVaryBySize) for (const size of sweater.sizes) buildSweater(sweater, size.id);
      return JSON.stringify(encodeCatalogue(sweaters));
    },
  };
};
