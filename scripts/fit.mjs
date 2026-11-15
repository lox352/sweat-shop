import { mkdirSync, writeFileSync } from "node:fs";
import { withSite } from "./settlement-plan.mjs";

/**
 * A size fitted to a knitter part way through, written out to read: what the
 * app works out when a knitter asks for the rest of their sweater at their
 * own tension (see src/compiler/fit), every way the design offers.
 *
 *   node scripts/fit.mjs <design> <size> <round> <stitches to 10cm> <rounds to 10cm>
 *
 * The size's current edition is taken as knitted to the first round at or
 * after <round> that the design can plan on from. Written to
 * docs/written/refits, a file for each way.
 */
const [design, size, round, stitches, rounds] = process.argv.slice(2);
if (!rounds) throw new Error("usage: node scripts/fit.mjs <design> <size> <round> <stitches to 10cm> <rounds to 10cm>");
const tension = { stitchesPer10cm: Number(stitches), roundsPer10cm: Number(rounds) };
const dir = "docs/written/refits";

await withSite(async (load) => {
  const { sweaterById } = await load("/src/compiler/designs/index.ts");
  const { buildSweater } = await load("/src/compiler/engine/engine.ts");
  const { cutAfter, fit, fitOptions } = await load("/src/compiler/fit.ts");
  const pattern = sweaterById(design);
  if (!pattern) throw new Error(`no design ${design}`);
  const knitted = buildSweater(pattern, size);
  const from = cutAfter(design, knitted, Number(round));
  if (from === undefined) throw new Error(`${design} can't be planned on from round ${round}`);
  const wanted = pattern.sizes.find((one) => one.id === size).finished;
  mkdirSync(dir, { recursive: true });
  const options = fitOptions(design);
  for (const option of options.length > 0 ? options : [undefined]) {
    const fitted = fit({ design, sizeId: size, knitted, round: from, tension, option: option?.id });
    const measures = Object.entries(fitted.finished).map(([name, cm]) => `  ${name.replace(/Cm$/, "")}: ${cm}cm (the size's ${wanted[name]}cm)`);
    const head = [
      `Knitted to the end of round ${from}, and the rest fitted at ${tension.stitchesPer10cm} sts and ${tension.roundsPer10cm} rounds to 10cm.`,
      ...(option ? [`${option.label}. ${option.detail}`] : []),
      "",
      ...fitted.notes,
      "",
      "What it comes to:",
      ...measures,
      "",
      `${fitted.knitted.rounds.length - from} rounds to go, ${fitted.knitted.stitches.length - knitted.rounds[from - 1].at(-1) - 1} stitches.`,
    ];
    const path = `${dir}/${design}--${size}--after-${from}--${stitches}x${rounds}${option ? `--${option.id}` : ""}.txt`;
    writeFileSync(path, `${head.join("\n")}\n\n${fitted.written}`);
    console.log(path);
  }
});
