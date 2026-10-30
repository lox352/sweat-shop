/**
 * The scroll harness's scenarios: a sweater opened at a given place, and
 * what a knitter does to its chart there, recorded frame by frame (see
 * recorder.js) and measured (see metrics.mjs). Each is a function of the
 * page, run by the suite (scroll-quality.spec.mjs) and the lab
 * (scripts/scroll-lab.mjs) alike.
 */
import { boxOf, ctrlWheel, pinch, settled, swipe, trackpad, wheelNotches } from "./gestures.mjs";
export { settled };

const recorder = new URL("./recorder.js", import.meta.url);

/** Each Year Once in a medium, whose columns open and close the most as you go. */
export const eachYearOnce = { sweaterId: "wool-week-strips-once-oldest", sizeId: "m", colourwayId: "early-light" };
/** Hamefarin in a medium, a round yoke of many make-ones. */
export const hamefarin = { sweaterId: "hamefarin", sizeId: "m", colourwayId: "simmer-dim" };
/** The Paul Klee Sweater's M1, a raglan with markers. */
export const klee = { sweaterId: "paul-klee", sizeId: "m1", colourwayId: "klee", revision: 1 };

/** The Paul Klee Sweater's L, whose yoke grows from 240 stitches to 360 as you knit up it. */
export const kleeLarge = { sweaterId: "paul-klee", sizeId: "l", colourwayId: "klee", revision: 1 };

/**
 * Where a stitch's cell is on screen, as the chart draws it now: its middle,
 * and the box's edges.
 */
export const cellOnScreen = (page, id) =>
  page.evaluate((id) => {
    const view = window.__chartViews.at(-1);
    const cell = view?.cellOnSheet(id);
    const sheet = document.querySelector(".chart-sheets").getBoundingClientRect();
    const box = document.querySelector(".chart-scroll").getBoundingClientRect();
    return {
      x: cell ? sheet.left + cell.x + cell.width / 2 : undefined,
      y: cell ? sheet.top + cell.y + cell.height / 2 : undefined,
      box: { left: box.left, top: box.top, right: box.right, bottom: Math.min(box.bottom, innerHeight) },
    };
  }, id);

/** The box scrolled straight up or down until a stitch is `from` the top of it, and let come to rest. */
const bringDown = async (page, id, from = 120) => {
  const at = await cellOnScreen(page, id);
  if (at.y === undefined) throw new Error(`stitch ${id} is not drawn`);
  await page.locator(".chart-scroll").evaluate((box, by) => {
    box.scrollTop += by;
  }, at.y - at.box.top - from);
  await settled(page, { quiet: 500 });
};

/** A stitch tapped, and knitting carried on up to it from the picker. */
const knitUpTo = async (page, id) => {
  const at = await cellOnScreen(page, id);
  await page.evaluate(() => window.__scrollProbe.mark("tapped"));
  await page.mouse.click(at.x, at.y);
  await page.getByRole("button", { name: /Knit up to here/ }).click();
  await page.evaluate(() => window.__scrollProbe.mark("knit up to here"));
};

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

/**
 * A scenario's act, recorded frame by frame; and, once the chart is at
 * rest, the tiles audited (see TileView.audit): every one taken to be up to
 * date painted again and compared.
 */
export const record = async (page, act) => {
  await page.evaluate(() => window.__scrollProbe.start());
  await act();
  await settled(page, { quiet: 600 });
  const recording = await page.evaluate(() => window.__scrollProbe.stop());
  recording.audit = await page.evaluate(() => window.__chartViews.at(-1)?.audit?.());
  return recording;
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
  "fling into the bottom right corner, bouncing past it": {
    /*
     * As a knitter caught up from the yoke flicks back to the cast-on, on an
     * iPhone: the box flung on past the chart's corner bounces back from it
     * by itself, telling of scrolls beyond it on the way. Taken at their
     * word, they had the chart's edges kept that much further out, and the
     * box came to rest as far short of the corner as it had bounced past.
     */
    input: "touch",
    corner: true,
    /*
     * The bounce here is only told of, not drawn - this browser can't scroll
     * past an end - so what is on screen does not follow the scroll it tells
     * of, and the measure of that is no measure of the chart's.
     */
    known: { jitter: Infinity },
    setup: async (page) => {
      await open(page, { choices: eachYearOnce, progress: 0, knitting: true });
      // Up and left of the corner, a swipe at a time, the finger lifted slowly.
      for (let k = 0; k < 2; k++) {
        await swipe(page, { dx: 300, speed: 600, fling: false });
        await settled(page, { quiet: 300 });
        await swipe(page, { dy: 500, speed: 600, fling: false });
        await settled(page, { quiet: 300 });
      }
    },
    act: async (page) => {
      await swipe(page, { dx: -300, dy: -500, speed: 4000, bounce: true });
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
     * width. Its slips, lurches, jitter and shake are measured and reported, but
     * how many there are turns on when the wheel's events fall between
     * frames, which differs from one machine to the next: they are not held
     * to a number until it is fixed. Everything else is.
     */
    known: { slips: Infinity, lurches: Infinity, jitter: Infinity, shake: Infinity },
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
    known: { slips: Infinity, lurches: Infinity, jitter: Infinity, shake: Infinity },
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
  "zoom in from the whole width, then fling across": {
    /*
     * As a knitter does to look closer, on a phone: the chart zoomed right
     * out, pinched in about a point left of the middle, and flung across
     * straight away, both ways. Held still about the point it was pinched
     * about, the chart's right-hand edge was carried into the box as columns
     * closed beside it, and the box showed blank paper past it until rest.
     */
    input: "touch",
    // Knitting, as the knitter in the clip was, the chart's scrollbars are put away: where they would be is not held to.
    known: { scrollbars: Infinity },
    setup: async (page) => {
      await open(page, { choices: eachYearOnce, knitting: true });
      const chart = page.getByRole("region", { name: /Scrollable knitting chart/ });
      await chart.focus();
      for (let k = 0; k < 8; k++) {
        await chart.press("-");
        await page.waitForTimeout(150);
      }
      await settled(page, { quiet: 500 });
    },
    act: async (page) => {
      const box = await boxOf(page);
      await pinch(page, { scale: Number(process.env.PINCH_SCALE ?? 6), at: { ...box, x: box.left + box.width * Number(process.env.PINCH_X ?? 0.3), y: box.top + box.height * Number(process.env.PINCH_Y ?? 0.6) } });
      await page.waitForTimeout(150);
      await swipe(page, { dx: -250, speed: 2500 });
      await page.waitForTimeout(150);
      await swipe(page, { dx: 200, speed: 2500 });
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
  "knit up to a stitch far ahead, the yoke growing on the way": {
    /*
     * As a knitter caught up with a chart left behind does: forty rounds up
     * the Paul Klee's yoke at a tap, where the round is half as long again,
     * every column opening on the way. Followed by a scroll the browser
     * eased, the chart shook from side to side for two seconds on a phone,
     * carried off by the columns opening under it and sent back.
     */
    input: "any",
    setup: async (page) => {
      await open(page, { choices: kleeLarge, progress: 6935, knitting: true });
      await bringDown(page, 16996);
    },
    act: async (page) => {
      await knitUpTo(page, 16996);
      await page.waitForTimeout(1200);
    },
  },
  "knit up to a stitch a few rounds on": {
    input: "any",
    setup: (page) => open(page, { choices: hamefarin, progress: 15000, knitting: true }),
    act: async (page) => {
      // Whatever stitch is drawn five rows up and four along from the one to be worked.
      const id = await page.evaluate(() => {
        const next = document.querySelector(".chart-next").getBoundingClientRect();
        return window.__chartViews.at(-1).stitchAt(next.left - next.width * 3.5, next.top - next.height * 4.5);
      });
      await knitUpTo(page, id);
      await page.waitForTimeout(1000);
    },
  },
  "fling up the raglan, its markers going by": {
    input: "touch",
    /*
     * From the neck, a few dozen columns wide, down into a yoke of hundreds:
     * while the box moves the sheet keeps the size it had at rest (see
     * TileView.fitSheet), and so the scrollbars, which a phone hides, say
     * less of where the box is than elsewhere.
     */
    known: { scrollbars: 0.25 },
    setup: async (page) => {
      await open(page, { choices: klee });
      await toCorner(page, { bottom: false });
    },
    act: async (page) => {
      for (let k = 0; k < 4; k++) {
        await swipe(page, { dy: -240, speed: 1500, mode: k % 2 ? "android" : "ios" });
        await page.waitForTimeout(300);
      }
    },
  },
  "drag slowly across a round, the columns opening": {
    input: "touch",
    setup: (page) => open(page, { choices: kleeLarge, progress: 16000 }),
    act: async (page) => {
      for (let k = 0; k < 4; k++) await swipe(page, { dx: 200, speed: 250, fling: false });
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
