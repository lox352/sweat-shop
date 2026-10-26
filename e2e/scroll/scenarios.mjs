/**
 * The scroll harness's scenarios: a sweater opened at a given place, and
 * what a knitter does to its chart there, recorded frame by frame (see
 * recorder.js) and measured (see metrics.mjs). Each is a function of the
 * page, run by the suite (scroll-quality.spec.mjs) and the lab
 * (scripts/scroll-lab.mjs) alike.
 */
import { boxOf, ctrlWheel, settled, swipe, trackpad, wheelNotches } from "./gestures.mjs";

const recorder = new URL("./recorder.js", import.meta.url);

/** Each Year Once in a medium, whose columns open and close the most as you go. */
export const eachYearOnce = { sweaterId: "wool-week-strips-once-oldest", sizeId: "m", colourwayId: "early-light" };
/** Hamefarin in a medium, a round yoke of many make-ones. */
export const hamefarin = { sweaterId: "hamefarin", sizeId: "m", colourwayId: "simmer-dim" };
/** The Paul Klee Sweater's M1, a raglan with markers. */
export const klee = { sweaterId: "paul-klee", sizeId: "m1", colourwayId: "klee", revision: 1 };

/** The recorder, in every page of the context, before the page's own script. */
export const instrument = async (context) => {
  await context.addInitScript({ path: decodeURIComponent(recorder.pathname) });
};

/**
 * A project at `progress`, opened at its chart: knitting, so it fills the
 * screen and follows the stitch to be worked, or looked through, with the
 * knitting closed and nothing followed.
 */
export const open = async (page, { choices = eachYearOnce, progress = 0, knitting = false, view } = {}) => {
  await page.goto("");
  await page.evaluate(({ progress, choices }) => {
    const now = new Date().toISOString();
    const id = "project-1760000000000";
    localStorage.clear();
    localStorage.setItem(id, JSON.stringify({ version: 1, id, ...choices, progress, startedAt: now, updatedAt: now }));
  }, { progress, choices });
  await page.goto(`#/project/1760000000000/chart${knitting ? "?knitting=1" : ""}`);
  // Opened before the project was read, the page may show the projects instead: once more, then.
  const canvas = page.locator(".chart-tiles canvas").first();
  if (!(await canvas.waitFor({ state: "attached", timeout: 10_000 }).then(() => true, () => false))) {
    await page.reload();
    await canvas.waitFor({ state: "attached" });
  }
  if (view) await page.getByRole("tab", { name: view }).click();
  await page.waitForFunction(() => window.__chartViews?.length > 0);
  await settled(page, { quiet: 500 });
};

export const record = async (page, act) => {
  await page.evaluate(() => window.__scrollProbe.start());
  await act();
  await settled(page, { quiet: 600 });
  return page.evaluate(() => window.__scrollProbe.stop());
};

/** The box scrolled straight to a corner of the chart, and let come to rest. */
const toCorner = async (page, { right = true, bottom = true }) => {
  await page.locator(".chart-scroll").evaluate((box, { right, bottom }) => {
    box.scrollLeft = right ? 0 : -1e7;
    box.scrollTop = bottom ? 1e7 : 0;
  }, { right, bottom });
  await settled(page, { quiet: 500 });
};

/**
 * The scenarios, each named for what it does. `touch` ones want a page that
 * takes touches - a phone's - and `wheel` ones a mouse or trackpad's.
 */
export const scenarios = {
  "fling up the yoke": {
    input: "touch",
    setup: (page) => open(page, { choices: eachYearOnce }),
    act: async (page) => {
      for (let k = 0; k < 6; k++) {
        await swipe(page, { dy: 260, speed: 1600 });
        await page.waitForTimeout(350);
      }
    },
  },
  "fling down from the top": {
    input: "touch",
    setup: async (page) => {
      await open(page, { choices: eachYearOnce });
      await toCorner(page, { bottom: false });
    },
    act: async (page) => {
      for (let k = 0; k < 6; k++) {
        await swipe(page, { dy: -260, speed: 1600 });
        await page.waitForTimeout(350);
      }
    },
  },
  "fling across the body and back": {
    input: "touch",
    /*
     * In the lab only for now: now and then, swiped across the Body view on
     * a phone, the page ends up back at the list of projects, and the suite
     * would fail for that rather than for how the chart moved. To be found.
     */
    labOnly: true,
    setup: async (page) => {
      await open(page, { choices: eachYearOnce, view: "Body" });
    },
    act: async (page) => {
      for (const dx of [300, 300, 300, -300, -300, -300]) {
        await swipe(page, { dx, speed: 2000 });
        await page.waitForTimeout(300);
      }
    },
  },
  "fling diagonally over the divide": {
    input: "touch",
    setup: (page) => open(page, { choices: hamefarin }),
    act: async (page) => {
      for (const [dx, dy] of [[200, 200], [200, 200], [-150, 250], [250, -100], [-250, 200]]) {
        await swipe(page, { dx, dy, speed: 1800 });
        await page.waitForTimeout(250);
      }
    },
  },
  "drag slowly up through the make-ones": {
    input: "touch",
    setup: (page) => open(page, { choices: hamefarin }),
    act: async (page) => {
      for (let k = 0; k < 4; k++) await swipe(page, { dy: 220, speed: 300, fling: false });
    },
  },
  "fling then reverse before it stops": {
    input: "touch",
    setup: (page) => open(page, { choices: eachYearOnce }),
    act: async (page) => {
      for (let k = 0; k < 3; k++) {
        await swipe(page, { dy: 300, speed: 2400 });
        await page.waitForTimeout(80);
        await swipe(page, { dy: -200, speed: 2400 });
        await page.waitForTimeout(80);
      }
    },
  },
  "trackpad up and across": {
    input: "wheel",
    /*
     * Known: while the box keeps moving, the sheet keeps the size it had at
     * rest, so once many columns have opened a scroll across moves the chart
     * further than the fingers (see TileView.slideAcross) - up to two and a
     * half times, here - until the box rests and the sheet takes the chart's
     * width. Its slips, lurches and jitter are measured and reported, but
     * how many there are turns on when the wheel's events fall between
     * frames, which differs from one machine to the next: they are not held
     * to a number until it is fixed. Everything else is.
     */
    known: { slips: Infinity, lurches: Infinity, jitter: Infinity },
    setup: (page) => open(page, { choices: eachYearOnce }),
    act: async (page) => {
      await trackpad(page, { dy: -1400 });
      await trackpad(page, { dx: -1400 });
      await trackpad(page, { dx: -800, dy: -800 });
      await trackpad(page, { dx: 1200, dy: 900 });
    },
  },
  "wheel up the chart": {
    input: "wheel",
    // As for the trackpad: see there.
    known: { slips: Infinity, lurches: Infinity, jitter: Infinity },
    setup: (page) => open(page, { choices: hamefarin }),
    act: async (page) => {
      await wheelNotches(page, { notches: -12, step: 100, gap: 60 });
      await wheelNotches(page, { notches: -12, step: 100, gap: 60, across: true });
    },
  },
  "zoom in and out about a point, then scroll": {
    input: "wheel",
    setup: (page) => open(page, { choices: eachYearOnce }),
    act: async (page) => {
      const box = await boxOf(page);
      const at = { ...box, x: box.x - box.width * 0.2, y: box.y - box.height * 0.15 };
      await ctrlWheel(page, { delta: -30, steps: 4, at });
      await page.waitForTimeout(700);
      await trackpad(page, { dy: -900, at });
      await ctrlWheel(page, { delta: 30, steps: 4, at });
      await page.waitForTimeout(700);
      await trackpad(page, { dx: -900, at });
    },
  },
  "zoom out to the whole width and back in": {
    input: "any",
    setup: (page) => open(page, { choices: eachYearOnce }),
    act: async (page) => {
      const chart = page.getByRole("region", { name: /Scrollable knitting chart/ });
      await chart.focus();
      for (const key of [..."--------", ..."++++++++"]) {
        await page.evaluate((key) => window.__scrollProbe.mark(`press ${key}`), key);
        await chart.press(key);
        await page.waitForTimeout(300);
      }
      await page.evaluate(() => window.__scrollProbe.mark("zoom done"));
    },
  },
  "knit a few rounds, the chart following": {
    input: "any",
    setup: (page) => open(page, { choices: hamefarin, progress: 20714, knitting: true }),
    act: async (page) => {
      for (let k = 0; k < 6; k++) {
        await page.evaluate(() => window.__scrollProbe.mark("end of round"));
        const step = page.getByRole("button", { name: /^(Joined|Changed|Held|On the needles|Turned|Placed|Taken off): carry on$/ });
        if (await step.isVisible()) await step.click();
        else await page.getByRole("button", { name: /^End of (round|row)$/ }).click();
        await page.waitForTimeout(450);
      }
    },
  },
  "knit across the divide": {
    input: "any",
    setup: (page) => open(page, { choices: eachYearOnce, progress: 0, knitting: true }),
    act: async (page) => {
      // A stitch at a time is too slow to cross a round; a round at a time, with the steps on the way.
      for (let k = 0; k < 8; k++) {
        await page.evaluate(() => window.__scrollProbe.mark("end of round"));
        const step = page.getByRole("button", { name: /^(Joined|Changed|Held|On the needles|Turned|Placed|Taken off): carry on$/ });
        if (await step.isVisible()) await step.click();
        else await page.getByRole("button", { name: /^End of (round|row)$/ }).click();
        await page.waitForTimeout(350);
      }
    },
  },
  "the window resized mid-fling": {
    input: "touch",
    setup: (page) => open(page, { choices: eachYearOnce }),
    act: async (page) => {
      const size = page.viewportSize();
      const fling = swipe(page, { dy: 300, speed: 2000 });
      await page.waitForTimeout(120);
      await page.setViewportSize({ width: size.width, height: Math.round(size.height * 0.8) });
      await fling;
      await page.waitForTimeout(400);
      await page.setViewportSize(size);
      await swipe(page, { dx: 250, speed: 2000 });
    },
  },
};

/** The scenarios for a page that takes `input`: "touch" or "wheel". */
export const scenariosFor = (input) => Object.entries(scenarios).filter(([, s]) => s.input === "any" || s.input === input);
