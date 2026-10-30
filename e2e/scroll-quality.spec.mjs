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
  // Nor a little round it, which a phone shows ahead of its scroll and bouncing at an end: two hundredths.
  unpaintedNear: 0.02,
  // Nor blank paper past the chart's edge, where the chart goes on.
  past: 4,
  // And the chart is at rest once the gesture is over, within a second.
  settle: 1000,
  // Left to itself, what is on screen goes one way and comes to rest: back and forth by 4 pixels or more, twice at most.
  shake: 2,
  // The tiles on whole device pixels, all but a twentieth of the frames: between, they are smeared and shimmer.
  smeared: 0.05,
};

/**
 * And a scenario that knits, following the stitch to be worked: it goes
 * straight there, never turning back - the chart shaking from side to side
 * as a phone's smooth scroll was carried off and sent back did - and so
 * nearly straight that it goes no more than a sixth further than it gets.
 */
const following = { reversals: 0, straightness: 0.85 };

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
        expect(painting.unpaintedNearMax, "old chart round the box").toBeLessThanOrEqual(limit.unpaintedNear);
        expect(measured.past.max, "the box past the chart's edge").toBeLessThanOrEqual(limit.past);
        // Flung into a corner, it comes to rest there, the chart's edges in the box: short of them, it would show less than nought past them.
        if (scenario.corner) {
          expect(measured.rest.right, "the box short of the chart's right-hand edge").toBeGreaterThanOrEqual(0);
          expect(measured.rest.bottom, "the box short of the chart's bottom").toBeGreaterThanOrEqual(0);
        }
        expect(settling.rested, "at rest after").toBe(true);
        expect(measured.shake.reversals, `back and forth by itself: ${JSON.stringify(measured.shake)}`).toBeLessThanOrEqual(limit.shake);
        expect(measured.sharpness.share, "tiles off whole device pixels").toBeLessThanOrEqual(limit.smeared);
        // Every tile taken to be up to date at rest shows the chart as it is.
        expect(measured.audit.wrong, `tiles showing an old chart at rest: ${measured.audit.which?.join(", ")}`).toBe(0);
        if (knits(name)) {
          expect(measured.follow.reversals, `the stitch followed turning back: ${JSON.stringify(measured.follow)}`).toBeLessThanOrEqual(following.reversals);
          expect(measured.follow.straightness, `how straight the stitch followed goes: ${JSON.stringify(measured.follow)}`).toBeGreaterThanOrEqual(following.straightness);
        }
        if (!knits(name)) expect(settling.ms, "time to rest").toBeLessThanOrEqual(limit.settle);
      });
    }
  }
});
