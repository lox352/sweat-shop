/**
 * The scroll lab: runs the scroll harness's scenarios (e2e/scroll) against
 * the built site, on a phone and on a laptop, and says how each went - the
 * same measures the suite holds to, and every jump with the scroll writes
 * that came with it. Recordings are kept for a closer look.
 *
 *   npm run build && npm run preview -- --port 4319 &
 *   node scripts/scroll-lab.mjs [--only <text>] [--device phone|desktop] [--out dir] [--repeat n] [--throttle n]
 *
 * --throttle slows the browser's CPU that many times, as a phone's is
 * against a laptop's: four is about a recent iPhone against this machine.
 *
 * CHROMIUM may name a browser to use in place of Playwright's own.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices } from "playwright";
import { measure } from "../e2e/scroll/metrics.mjs";
import { instrument, record, scenariosFor } from "../e2e/scroll/scenarios.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : fallback;
};
const only = option("only");
const which = option("device");
const out = option("out", "scroll-lab");
const repeat = Number(option("repeat", "1"));
const base = option("base", "http://127.0.0.1:4319/sweat-shop/");
const throttle = Number(option("throttle", "1"));

const profiles = {
  phone: { ...devices["iPhone 13"], defaultBrowserType: undefined, input: "touch" },
  desktop: { ...devices["Desktop Chrome"], input: "wheel" },
};

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const summary = [];
for (const [device, { input, ...profile }] of Object.entries(profiles)) {
  if (which && which !== device) continue;
  for (const [name, scenario] of scenariosFor(input)) {
    if (only && !name.includes(only)) continue;
    for (let run = 0; run < repeat; run++) {
      const context = await browser.newContext({ ...profile, baseURL: base });
      await instrument(context);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      try {
        await scenario.setup(page);
        if (throttle > 1) await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: throttle });
        const recording = await record(page, () => scenario.act(page));
        const measured = measure(recording);
        const file = join(out, `${device}--${name.replace(/[^a-z0-9]+/gi, "-")}--${run}.json`);
        writeFileSync(file, JSON.stringify({ device, name, run, measured, recording }));
        summary.push({ device, name, run, measured, errors });
        const { pacing, jumps, jitter, scrollbars, painting, settling, motion, shake, follow, drift, sharpness } = measured;
        console.log(
          `${device.padEnd(7)} ${name.padEnd(44)} frames ${String(measured.frames).padStart(4)}  dropped ${String(pacing.dropped).padStart(3)}  ` +
            `long ${pacing.longFrames}/${pacing.longest}ms  jumps ${jumps.byKind.slip}/${jumps.byKind.set}/${jumps.byKind.lurch} (${jumps.worst}px)  jitter ${jitter.p95}  ` +
            `unexpl ${motion.unexplainedP95}/${motion.unexplainedMax}  bars ${scrollbars.gapMax}/${scrollbars.stepMax}  ` +
            `blank ${painting.unpaintedMax}/${painting.unpaintedNearMax}  settle ${settling.ms}ms${settling.rested ? "" : " NOT AT REST"}  writes ${measured.writes}` +
            (errors.length ? `  ERRORS ${errors.length}` : ""),
        );
        console.log(
          `        shake ${shake.reversals}/${shake.largest}px  follow ${follow.trips} trips, straight ${follow.straightness}, turns ${follow.reversals}/${follow.largest}px, off ${follow.offCentre}  ` +
            `drift ${drift.share}  past ${measured.past.max}px/${measured.past.frames}  smeared ${sharpness.smeared}/${sharpness.frames} (moving ${sharpness.shimmering}/${sharpness.moved})  ` +
            `paint ${painting.tiles} tiles, ${painting.tilesPerFrameMax}/frame, ${painting.msPerFrameP95}/${painting.msPerFrameMax}ms, ${painting.easingFrames} easing  ` +
            `audit ${measured.audit.wrong}/${measured.audit.tiles} wrong`,
        );
        for (const jump of jumps.list.slice(0, 4)) {
          console.log(`        ${jump.kind} at ${Math.round(jump.t)}ms: moved ${jump.dx},${jump.dy} (${jump.off} off), scroll ${jump.scrollX},${jump.scrollY}, unexplained ${jump.unexplained}`);
          for (const write of jump.writes.slice(0, 3)) console.log(`          ${write.what} ${write.value} from ${write.from}`);
        }
      } catch (error) {
        console.log(`${device.padEnd(7)} ${name.padEnd(44)} FAILED: ${String(error).split("\n")[0]}`);
        summary.push({ device, name, run, failed: String(error) });
      } finally {
        await context.close();
      }
    }
  }
}
writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 1));
await browser.close();
