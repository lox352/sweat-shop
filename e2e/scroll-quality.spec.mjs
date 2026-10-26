/**
 * How the chart moves, held to a standard: every scenario of the scroll
 * harness (see e2e/scroll), on the phone it is for or the laptop, recorded
 * frame by frame and measured as a knitter sees it - by where the stitches
 * are on screen. See e2e/scroll/metrics.mjs for what each measure means.
 *
 * The limits are set a little above what the chart does now, so that a
 * change for the worse fails here rather than in a knitter's hands; the lab
 * (scripts/scroll-lab.mjs) runs the same scenarios and says more. Each
 * test's measures are attached to its report.
 */
import { test, expect } from "playwright/test";
import { measure } from "./scroll/metrics.mjs";
import { instrument, record, scenariosFor } from "./scroll/scenarios.mjs";

/**
 * What every scenario is held to. A jump is something on screen moving by
 * more than 24 pixels at once that the scroll does not account for, or
 * moved by a scroll the page set itself; a lurch is lines easing open or
 * closed too fast at the start.
 */
const limits = {
  // Not one jump: a line put somewhere else in one frame, or a scroll the page set moving what is on screen.
  slips: 0,
  sets: 0,
  // Lines setting off too fast, a few frames in a long scenario at most.
  lurches: 3,
  // The wobble in what moves that the scroll does not account for, at the 95th percentile, in pixels a frame a frame.
  jitter: 8,
  // How far the scrollbars may be from the truth of where in the chart the box is, as a share of the way along.
  scrollbars: 0.15,
  // The box hardly ever shows an old chart in a frame: a hundredth of it at most.
  unpainted: 0.01,
  // And the chart is at rest once the gesture is over, within a second.
  settle: 1000,
};

/** Scenarios that knit, whose scrolls the page sets: each follows the next stitch, smoothly. */
const knits = (name) => name.startsWith("knit");

test.describe("the chart moves smoothly", () => {
  test.beforeEach(async ({ context }) => {
    await instrument(context);
  });

  for (const input of ["touch", "wheel"]) {
    for (const [name, scenario] of scenariosFor(input)) {
      test(`${name} (${input})`, async ({ page }, info) => {
        const touch = info.project.use.hasTouch === true;
        test.skip(scenario.input !== "any" && (scenario.input === "touch") !== touch, `a ${scenario.input} scenario`);
        test.skip(scenario.input === "any" && input === "touch" && !touch, "run once a device");
        test.skip(scenario.input === "any" && input === "wheel" && touch, "run once a device");
        test.skip(!!scenario.labOnly, "in the lab only: see the scenario");
        test.setTimeout(120_000);
        const errors = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        await scenario.setup(page);
        const recording = await record(page, () => scenario.act(page));
        const measured = measure(recording);
        // What a scenario is known to do worse than the rest, and is held to instead: see its `known`.
        const limit = { ...limits, ...scenario.known };
        await info.attach("measures.json", { body: JSON.stringify(measured, null, 1), contentType: "application/json" });

        expect(errors).toEqual([]);
        expect(measured.frames, "frames recorded").toBeGreaterThan(30);
        const { jumps, jitter, scrollbars, painting, settling } = measured;
        const listed = JSON.stringify(jumps.list.map(({ writes, ...jump }) => ({ ...jump, writes: writes.map((w) => `${w.what} ${w.from.split(" < ")[1] ?? ""}`) })), null, 1);
        expect(jumps.byKind.slip, `jumps the scroll does not account for: ${listed}`).toBeLessThanOrEqual(limit.slips);
        // Following the knitting, the page scrolls the box itself - smoothly, never at once.
        expect(jumps.byKind.set, `scrolls the page set that moved what is on screen: ${listed}`).toBeLessThanOrEqual(knits(name) ? 0 : limit.sets);
        expect(jumps.byKind.lurch, `lines setting off too fast: ${listed}`).toBeLessThanOrEqual(limit.lurches);
        expect(jitter.p95, "jitter").toBeLessThanOrEqual(limit.jitter);
        expect(scrollbars.gapP95, "scrollbars against the truth").toBeLessThanOrEqual(limit.scrollbars);
        expect(painting.unpaintedMax, "old chart showing").toBeLessThanOrEqual(limit.unpainted);
        expect(settling.rested, "at rest after").toBe(true);
        if (!knits(name)) expect(settling.ms, "time to rest").toBeLessThanOrEqual(limit.settle);
      });
    }
  }
});
