/**
 * What the chart's sums cost, away from any browser: building a sweater's
 * scene, moving the rows in view a row at a time, and painting a phone's
 * screen and a desktop window of it.
 *
 *     node scripts/chart-bench.mjs
 *
 * The painting is timed against a context that draws nothing, so it is the
 * JavaScript's share of a frame; the browser's own drawing comes on top.
 * Each figure is the median of several runs, in milliseconds.
 */
import { withSite } from "./settlement-plan.mjs";

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const time = (runs, work) => {
  const out = [];
  for (let i = 0; i < runs; i++) {
    const started = performance.now();
    work(i);
    out.push(performance.now() - started);
  }
  return median(out);
};

/** A canvas that draws nothing, for timing what is asked of it. */
const nothing = new Proxy(
  {},
  {
    get: (target, key) => (key in target ? target[key] : () => {}),
    set: (target, key, value) => {
      target[key] = value;
      return true;
    },
  },
);

await withSite(async (load) => {
  const { sweaterById } = await load("/src/data/sweaters/index.ts");
  const { buildSweater } = await load("/src/knitting/engine.ts");
  const { layOutSweater } = await load("/src/knitting/layout.ts");
  const { sceneOf } = await load("/src/knitting/chart-scene.ts");
  const { LiveColumns, mapOf, placeFrom } = await load("/src/knitting/column-window.ts");
  const { paintRegion, laidOutPlaces, defaultColours } = await load("/src/knitting/chart-painter.ts");

  for (const [id, size] of [["hamefarin", "4xl"], ["paul-klee", "6xl"]]) {
    const sweater = sweaterById(id);
    const built = buildSweater(sweater, size);
    const layout = layOutSweater(built.stitches, built.rounds, built.roundKinds, built.roundPieces);
    const scene = sceneOf(layout, built.stitches, built.rounds);
    const build = time(5, () => sceneOf(layout, built.stitches, built.rounds));

    // A walk up the chart a row at a time, with 36 rows in view.
    const live = new LiveColumns(scene.index);
    let changes = 0;
    const steps = [];
    for (let first = 1; first + 35 <= layout.rows; first++) {
      const started = performance.now();
      if (live.moveTo(first, first + 35)) {
        changes++;
        mapOf(live);
      }
      steps.push(performance.now() - started);
    }

    const palette = Object.fromEntries(scene.slots.map((slot, i) => [slot, { name: slot, hex: `#${(i * 2654435761 >>> 8).toString(16).padStart(6, "0").slice(0, 6)}` }]));
    const paint = (width, height, cell, closed) => {
      let places = laidOutPlaces(layout.columns, cell);
      if (closed) {
        const window = new LiveColumns(scene.index);
        window.moveTo(1, Math.ceil(height / cell));
        const map = mapOf(window);
        const left = placeFrom(map, map.order[0], 0, cell);
        const w = new Float64Array(left.length);
        for (let c = 1; c < w.length - 1; c++) w[c] = map.shows[c] ? cell : 0;
        places = { left, width: w };
      }
      const state = { cell, ...places, palette, progress: built.stitches.length / 2, hatch: [], onHold: [], colours: defaultColours, ratio: 3 };
      const y = layout.rows * cell - height;
      return time(9, (i) => paintRegion(nothing, { x: (i % 3) * 40, y, width, height }, scene, state));
    };

    console.log(`${id} ${size}: ${layout.columns} columns, ${layout.rows} rows, ${layout.cells.size} stitches`);
    console.log(`  scene built                 ${build.toFixed(1)} ms`);
    console.log(`  a row's move, rows in view  ${median(steps).toFixed(3)} ms median, ${Math.max(...steps).toFixed(3)} ms at most; ${changes} changes of columns showing over a whole scroll`);
    console.log(`  phone screen, 390 x 664     ${paint(390, 664, 8).toFixed(2)} ms at cell 8, ${paint(390, 664, 16).toFixed(2)} ms at cell 16`);
    console.log(`  desktop window, 1440 x 900  ${paint(1440, 900, 8).toFixed(2)} ms at cell 8, ${paint(1440, 900, 16).toFixed(2)} ms at cell 16`);
    console.log(`  phone screen, closed up     ${paint(390, 664, 8, true).toFixed(2)} ms at cell 8`);
  }
});
