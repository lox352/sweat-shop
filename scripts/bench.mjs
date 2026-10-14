/**
 * How well the sweaters settle: each piece's tension and frill, size by size.
 *
 *     npm run bench                      the committed settled files
 *     npm run bench -- --size m          one size
 *     npm run bench -- --fresh           settle again first, and say how long it took
 *     npm run bench -- --fresh pressure=4 yokePressure=3
 *                                        ...with any of src/physics/tuning.ts changed
 *
 * The tension is a stitch's width over its round's height in the plain
 * fabric of each piece, against what the size's tension asks for; frill is
 * how much longer a round is than the circle it encloses, one being round.
 * See src/physics/gauge.ts. The aim is every piece within about 3% of its
 * tension and frill under about 1.1.
 */
import { readFileSync, existsSync } from "node:fs";
import { settledDir, withSite } from "./settlement-plan.mjs";

const args = process.argv.slice(2);
const sizeAt = args.indexOf("--size");
const onlySize = sizeAt >= 0 ? args[sizeAt + 1] : undefined;
const fresh = args.includes("--fresh");
const overrides = Object.fromEntries(
  args.filter((arg) => /^\w+=/.test(arg)).map((arg) => {
    const [key, value] = arg.split("=");
    return [key, Number(value)];
  }),
);

await withSite(async (load) => {
  const { sweaters } = await load("/src/data/sweaters/index.ts");
  const { buildSweater } = await load("/src/knitting/engine.ts");
  const { pose } = await load("/src/physics/pose.ts");
  const { settle } = await load("/src/physics/solver.ts");
  const { measurePiece } = await load("/src/physics/gauge.ts");
  const { decodeSettled } = await load("/src/data/sweaters/settled/format.ts");

  for (const sweater of sweaters) {
    for (const size of sweater.sizes.filter((candidate) => !onlySize || candidate.id === onlySize)) {
      const built = buildSweater(sweater, size.id);
      const path = `${settledDir}/${sweater.id}--${size.id}.json`;
      let positions;
      let note = "";
      if (fresh) {
        const started = Date.now();
        const result = settle(built, pose(built), overrides);
        const seconds = (Date.now() - started) / 1000;
        positions = result.positions;
        note = `${result.rested ? "settled" : "did not settle"} in ${result.steps} steps, ${seconds.toFixed(0)}s, ${(result.steps / seconds).toFixed(1)} steps a second`;
      } else if (existsSync(path)) {
        positions = decodeSettled(JSON.parse(readFileSync(path, "utf8")));
        note = "as committed";
      } else {
        console.log(`${sweater.id}/${size.id}: not settled yet`);
        continue;
      }
      console.log(`${sweater.id}/${size.id}: ${note}`);
      for (const piece of [...new Set(built.roundPieces)]) {
        const gauge = measurePiece(built, positions, piece);
        const off = ((gauge.ratio / gauge.wanted - 1) * 100).toFixed(1);
        console.log(
          `  ${piece.padEnd(13)} tension ${gauge.ratio.toFixed(3)} against ${gauge.wanted.toFixed(3)} (${off}%), ` +
            `frill ${gauge.frill.toFixed(3)}, across ${gauge.across.toFixed(2)}, up ${gauge.up.toFixed(2)}`,
        );
      }
    }
  }
});
