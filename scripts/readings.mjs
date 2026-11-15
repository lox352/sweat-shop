import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { withSite } from "./settlement-plan.mjs";

/**
 * What the site reads off every frozen edition, fingerprinted.
 *
 * A project knits the edition it was started on for as long as it takes, so
 * what that edition reads as - its rounds as counted, what the panel says to
 * do in each, the key, where each stitch is on the chart and in each view,
 * what it is from either side, its time and its yarn - must not change under
 * it while the code that reads it does. This reads every file in
 * public/editions as the site would and writes a hash of each of those to
 * scripts/readings.json: a change to how patterns are read that is meant to
 * change nothing leaves that file as it is.
 *
 *   node scripts/readings.mjs            write the fingerprints
 *   node scripts/readings.mjs --check    fail if any edition reads differently
 */
const out = "scripts/readings.json";
const sha = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 12);

const main = async () => {
  const check = process.argv.includes("--check");
  const was = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
  const now = await withSite(async (load) => {
    const { decodeEdition } = await load("/src/library/editions/format.ts");
    const { sweaterById } = await load("/src/library/catalogue/index.ts");
    const { countedAt, seamLayout, viewChart } = await load("/src/reading/counted.ts");
    const { roundNames, roundParts, runInstruction } = await load("/src/reading/progress.ts");
    const { stitchKey } = await load("/src/reading/stitch-key.ts");
    const { chartViews } = await load("/src/reading/views.ts");
    const { seenFrom, workedAs } = await load("/src/reading/sides.ts");
    const { prefixFor } = await load("/src/projects/timing/model.ts");
    const { metresBySlot } = await load("/src/reading/yardage.ts");
    const { holdRegions } = await load("/src/reading/holds.ts");
    const { markersPassed } = await load("/src/reading/marker-routes.ts");
    const cells = (layout) => [layout.columns, [...layout.cells].map(([id, cell]) => [id, cell.row, cell.column])];
    const readings = {};
    for (const name of readdirSync("public/editions").sort()) {
      const file = JSON.parse(readFileSync(`public/editions/${name}`, "utf8"));
      const design = sweaterById(file.design);
      const built = decodeEdition(file);
      const { stitches } = built;
      const last = stitches.length - 1;
      // As the knitter counts them before anything is worked, and once everything is: a pattern may move the beginning of the round between.
      const counted = [0, last].map((progress) => {
        const { view, index } = countedAt(design, built, progress);
        const said = view.rounds.map((ids) =>
          roundParts(stitches, ids, index).map((part) => ("run" in part ? runInstruction(part.run) : [part.step.type, part.step.id])),
        );
        return { rounds: view.rounds, labels: view.labels, pieces: view.pieces, kinds: view.kinds, rows: view.rows, names: roundNames(index), said, view };
      });
      const views = chartViews(built, design.pieces);
      readings[name.replace(/\.json$/, "")] = {
        rounds: sha(counted.map(({ rounds, labels, pieces, kinds, rows, names }) => [rounds, labels, pieces, kinds, rows, names])),
        panel: sha(counted.map(({ said }) => said)),
        key: sha(["worked", "right", "wrong"].map((view) => stitchKey(stitches, design.stitchNotes, view))),
        chart: sha([cells(seamLayout(built)), counted.map(({ view }) => [cells(view.layout), view.markers])]),
        views: sha(views.map((view) => {
          const { layout, markers } = viewChart(built, counted[1].view, view);
          return [view.id, view.label, view.kind, cells(layout), markers];
        })),
        sides: sha(stitches.map((stitch) => [workedAs(stitch), seenFrom(stitch, "right"), seenFrom(stitch, "wrong")])),
        time: sha([...prefixFor(stitches).counts(0, last)]),
        yarn: sha(metresBySlot(stitches, built.rounds)),
        holds: sha([holdRegions(stitches, built.holds).map((region) => [...Object.entries(region)].map(([key, value]) => [key, value instanceof Set ? [...value] : value])), [...markersPassed(built)]]),
      };
    }
    return readings;
  });
  if (!check) {
    writeFileSync(out, `${JSON.stringify(now, null, 1)}\n`);
    console.log(`${Object.keys(now).length} editions read.`);
    return;
  }
  const differs = [...new Set([...Object.keys(was), ...Object.keys(now)])].sort().flatMap((edition) => {
    const facets = Object.keys({ ...was[edition], ...now[edition] }).filter((facet) => was[edition]?.[facet] !== now[edition]?.[facet]);
    return facets.length ? [`${edition}: ${facets.join(", ")}`] : [];
  });
  if (differs.length) {
    console.error(`Editions read differently - if meant, run node scripts/readings.mjs:\n  ${differs.join("\n  ")}`);
    process.exitCode = 1;
  } else console.log(`Every edition reads as it did (${Object.keys(now).length}).`);
};

await main();
