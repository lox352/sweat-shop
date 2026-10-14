import { test, expect } from "playwright/test";
import { readFile } from "node:fs/promises";

const design = "#/sweater/hamefarin";
const position = page => page.locator(".knitting-panel [role=status]");
const steps = /^(Joined|Changed|Held|On the needles|Turned): carry on$/;
/**
 * Work to the end of `count` rounds - or short rows - taking any step on the
 * way - joining the round, changing needles, turning a short row, putting a
 * sleeve on hold - as asked.
 */
async function workRounds(page, count) {
  for (let done = 0; done < count;) {
    const step = page.getByRole("button", { name: steps });
    if (await step.isVisible()) await step.click();
    else {
      await page.getByRole("button", { name: /^End of (round|row)$/ }).click();
      done++;
    }
  }
}
async function openSettings(page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  return page.getByRole("dialog", { name: "Settings", exact: true });
}
async function start(page) {
  await page.goto(design);
  await page.getByRole("button", { name: "Start knitting this", exact: true }).click();
  await expect(page.getByRole("button", { name: "End of round", exact: true })).toBeVisible();
}
/**
 * A medium already knitted as far as `progress` - the id of the last stitch
 * worked - opened at its chart with the knitting showing. Knitting a yoke's
 * twenty thousand stitches a round at a time is no way to reach the divide.
 */
async function knittedTo(page, progress) {
  await page.goto("");
  await page.evaluate(progress => {
    const now = new Date().toISOString();
    const id = "project-1760000000000";
    localStorage.setItem(id, JSON.stringify({
      version: 1, id, sweaterId: "hamefarin", sizeId: "m", colourwayId: "simmer-dim",
      progress, startedAt: now, updatedAt: now,
    }));
  }, progress);
  await page.goto("#/project/1760000000000/chart?knitting=1");
  await expect(position(page)).toBeAttached();
}
/** Taps the chart `across` cells to the left of the stitch to be worked next, in its round. */
async function tapBeside(page, across) {
  await page.locator(".chart-next").evaluate((mark, across) => {
    const box = mark.getBoundingClientRect();
    const cell = box.width - 2;
    mark.closest(".chart-sheets").dispatchEvent(new MouseEvent("click", { bubbles: true,
      clientX: box.left + box.width / 2 - across * cell, clientY: box.top + box.height / 2 }));
  }, across);
}

/*
 * In a medium: the yoke's last stitch, the body's bind-off's, and where the
 * steps fall in the order of work. See src/knitting/engine.ts.
 */
const yokeDone = 21146;
const bodyDone = 56077;
/** The first stitch of the yoke's last round, its 75th, of 432 stitches. */
const yokeLastRound = 20715;

test("the design and its projects work without WebGL, and nothing fetches the solver", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return kind.startsWith("webgl") ? null : original.call(this, kind, ...args);
    };
  });
  // The settling is done offline; the site only ever fetches its answers.
  const physics = [];
  page.context().on("request", request => { if (/solver/i.test(request.url())) physics.push(request.url()); });
  await page.goto("");
  const links = await page.locator(".design-card").evaluateAll(nodes => nodes.map(node => node.href));
  expect(links).toHaveLength(1);
  await page.goto(links[0]);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start knitting this", exact: true })).toBeVisible();
  await expect(page.getByText("The 3D preview is unavailable.", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await knittedTo(page, yokeDone);
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByText("The 3D preview is unavailable.", { exact: false })).toBeVisible();
  expect(physics).toEqual([]);
});

test("the 3D stage shrinks back when a phone turns from landscape to portrait", async ({ page }) => {
  await page.goto(design);
  const stage = page.locator(".sweater-stage");
  await expect(stage).toBeVisible();
  const size = page.viewportSize();
  const before = await stage.evaluate(node => node.getBoundingClientRect().width);
  await page.setViewportSize({ width: Math.max(size.width, size.height) + 200, height: Math.min(size.width, size.height) });
  await page.waitForTimeout(800);
  await page.setViewportSize(size);
  await expect.poll(() => stage.evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(Math.round(before));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("accessible chart controls and text instructions", async ({ page }) => {
  await start(page);
  // Out of knitting, so the chart stops following and any round can be read.
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  const sheetWidth = () => page.locator(".chart-sheets").evaluate(node => node.offsetWidth);
  const unzoomed = await sheetWidth();
  await page.getByRole("region", { name: /Scrollable knitting chart/ }).press("+");
  await expect.poll(sheetWidth).toBeGreaterThan(unzoomed);
  const settings = await openSettings(page);
  await settings.getByRole("switch", { name: "High contrast chart" }).check();
  await settings.getByRole("switch", { name: "Written round instructions" }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".chart-yarn-numbers li")).not.toHaveCount(0);
  await page.getByText("Text round instructions", { exact: true }).click();
  await expect(page.getByText(/Cast on 128 in/)).toBeVisible();
  await expect(page.getByText(/^Cast on one more stitch and join in the round/)).toBeVisible();
  await page.getByLabel("Read round").selectOption("2");
  await expect(page.getByText("Yoke, round 2:", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("the chart is its own page, and closing the knitting keeps you on it", async ({ page }) => {
  await page.goto(design);
  // The design page shows the sweater and its wool, and ends with the way to start.
  await expect(page.locator(".chart-sheets")).toHaveCount(0);
  await page.getByRole("button", { name: "Start knitting", exact: true }).click();
  await expect(page).toHaveURL(/\/project\/[^/]+\/chart\?knitting=1$/);
  await page.getByRole("button", { name: "End of round", exact: true }).click();
  await page.getByRole("button", { name: "Joined: carry on" }).click();

  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await expect(page).toHaveURL(/\/project\/[^/]+\/chart$/);
  await expect(page.locator(".chart-sheets")).toBeVisible();
  // Not knitting, the page ends with your progress and the ways on.
  const bar = page.getByRole("region", { name: "Your progress" });
  await expect(bar).toContainText("knitted");
  await expect(bar).toContainText("Yoke, round 2 of");
  await bar.getByRole("button", { name: "Resume knitting", exact: true }).click();
  await expect(position(page)).toContainText("Yoke, round 2, stitch 1.");

  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await bar.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page).toHaveURL(/\/project\/[^/?]+$/);
  await expect(page.locator(".chart-sheets")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your wool" })).toBeVisible();
  await page.locator(".next-step").getByRole("link", { name: "Keep knitting", exact: true }).click();
  await expect(position(page)).toContainText("Yoke, round 2, stitch 1.");

  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await bar.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sweat Shop", level: 1, exact: true })).toBeVisible();
});

test("knitting fills the screen, says how to work the round's stitches, and closing it leaves the chart still", async ({ page }) => {
  await start(page);
  // The cast-on, twelve rounds of rib, the short rows, then the first increase round.
  await workRounds(page, 20);
  await expect(position(page)).toContainText("Yoke, round 21, stitch 1.");
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);

  const hint = page.getByRole("list", { name: "Stitches in this round" });
  await expect(hint).toContainText("Make one");

  await page.getByRole("button", { name: "Key", exact: true }).click();
  const key = page.getByRole("dialog", { name: "Key" });
  await expect(key).toContainText("Admiral Navy");
  await key.getByRole("button", { name: "Close the key" }).click();
  await expect(key).toBeHidden();

  // The stitch about to be worked says what it is.
  await tapBeside(page, 0);
  const picker = page.getByRole("dialog", { name: /^Yoke, round 21, stitch 1$/ });
  await expect(picker).toContainText("Knit");
  await picker.getByRole("button", { name: "Close" }).click();

  const at = () => page.locator(".chart-sheets").evaluate(sheet => {
    const box = sheet.getBoundingClientRect();
    return { left: box.left, top: box.top };
  });
  const before = await at();
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await expect(page.getByRole("region", { name: "Your progress" })).toBeVisible();
  const after = await at();
  expect(Math.abs(after.top - before.top)).toBeLessThan(2);
  expect(Math.abs(after.left - before.left)).toBeLessThan(2);
});

test("the chart keeps its bottom right corner when its window is resized for a moment", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await page.reload();
  const gaps = () => page.locator(".chart-scroll").evaluate(scroller => ({
    right: Math.round(scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft),
    bottom: Math.round(scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop),
  }));
  await expect.poll(gaps).toEqual({ right: 0, bottom: 0 });
  // Much larger and back, as a phone taking a full-page screenshot may.
  const size = page.viewportSize();
  await page.setViewportSize({ width: size.width * 2, height: size.height * 2 });
  await page.waitForTimeout(200);
  await page.setViewportSize(size);
  await expect.poll(gaps).toEqual({ right: 0, bottom: 0 });
});

test("the cast-on is cast on, then joined in the round as a step of its own", async ({ page }) => {
  await start(page);
  await expect(page.locator(".knitting-panel")).toContainText(/Cast on 128 in/);
  // The neck is cast on long-tail, and the panel says how, step by step.
  const hint = page.getByRole("list", { name: "Stitches in this round" });
  await expect(hint).toContainText("Long-tail cast-on");
  await expect(hint).toContainText("Measure the tail");
  await page.getByRole("button", { name: "End of round", exact: true }).click();
  await expect(page.locator(".knitting-panel")).toContainText("Join in the round");
  await page.getByRole("button", { name: "Joined: carry on" }).click();
  await expect(position(page)).toContainText("Yoke, round 2, stitch 1.");
  await page.getByRole("button", { name: "Key", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Key" })).toContainText("Join in the round");
});

test("changing needles is a step of its own, which the chart and key mark", async ({ page }) => {
  await start(page);
  // The cast-on and twelve rounds of rib, on the rib's needles.
  await workRounds(page, 13);
  await expect(page.locator(".knitting-panel")).toContainText("Change to 3.25mm needles");
  await expect(page.getByRole("button", { name: "End of round", exact: true })).toHaveCount(0);
  await expect(page.locator(".chart-rule-needles")).toBeAttached();

  await page.getByRole("button", { name: "Changed: carry on" }).click();
  await expect(position(page)).toContainText("Yoke, short row 1, right side, stitch 1.");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".knitting-panel")).toContainText("Change to 3.25mm needles");

  await page.getByRole("button", { name: "Key", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Key" })).toContainText("Change needles");
});

test("short rows raise the back of the neck, each turned as a step of its own", async ({ page }) => {
  await start(page);
  // The cast-on, twelve rounds of rib, and the change to the yoke's needles.
  await workRounds(page, 13);
  await page.getByRole("button", { name: "Changed: carry on" }).click();
  await expect(position(page)).toContainText("Yoke, short row 1, right side, stitch 1. Knit 20 in");
  await expect(page.locator(".knitting-panel")).toContainText("of 7 short rows · Yoke");
  await page.getByRole("button", { name: /^Knit 20 in / }).click();

  // The turn, and the row back from the wrong side.
  await expect(page.locator(".knitting-panel")).toContainText("Turn, and make a double stitch");
  await expect(page.getByRole("button", { name: /^End of (round|row)$/ })).toHaveCount(0);
  await expect(page.locator(".chart-join")).not.toHaveCount(0);
  // The rows to be purled back are hatched: from the right side they show as the knits they make.
  const chart = page.getByRole("img", { name: /^The chart:/ });
  await expect(chart).not.toHaveAccessibleName(/wrong side towards you/);
  await expect(page.locator(".chart-hatch")).toHaveCount(3);
  await page.getByRole("button", { name: "Turned: carry on" }).click();
  await expect(position(page)).toContainText("Yoke, short row 2, wrong side, stitch 1. Purl 39 in");
  // And with the work turned, the chart is too: the wrong side towards you, every stitch as it looks
  // from there - the row back purls - and the knitting from the right side hatched on either side of it.
  await expect(chart).toHaveAccessibleName(/wrong side towards you, and the chart is turned over/);
  await expect(page.locator(".chart-hatch")).toHaveCount(4);
  await expect(page.getByRole("list", { name: "Stitches in this round" })).toContainText("Purl");
  // Undo takes the turn back, and turns the chart back with it.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".knitting-panel")).toContainText("Turn, and make a double stitch");
  await expect(chart).not.toHaveAccessibleName(/wrong side towards you/);
  await page.getByRole("button", { name: "Turned: carry on" }).click();

  // The key reads the symbols from the wrong side too: the yoke's make-ones are make-ones purlwise.
  const key = page.getByRole("dialog", { name: "Key" });
  await page.getByRole("button", { name: "Key", exact: true }).click();
  await expect(key).toContainText("Turn: a short row");
  await expect(key).toContainText("Hatched");
  await expect(key).toContainText("Make one purlwise");
  await page.getByRole("button", { name: "Close the key" }).click();

  // Five more rows, and on round to the end of the round: then whole rounds again, from the right side.
  await workRounds(page, 6);
  await expect(position(page)).toContainText("Yoke, round 21, stitch 1.");
  await expect(chart).not.toHaveAccessibleName(/wrong side towards you/);
  await page.getByRole("button", { name: "Key", exact: true }).click();
  await expect(key).toContainText("Make one");
  await expect(key).not.toContainText("Make one purlwise");
  await page.getByRole("button", { name: "Close the key" }).click();
});

test("the dividing round puts each sleeve on hold, casts on its underarm, and goes on round the body", async ({ page }) => {
  await knittedTo(page, yokeDone);
  // The chart is the body's now, and says so.
  await expect(position(page)).toContainText("Body, round 1, stitch 1.");
  await expect(page.getByRole("img", { name: /You are on Body · dividing round/ })).toBeVisible();
  await expect(page.locator(".chart-hold")).toHaveCount(2);

  // Across the back to the right sleeve, which goes on hold.
  await page.getByRole("button", { name: /^Knit 68 in / }).click();
  await expect(page.locator(".knitting-panel")).toContainText("Put 80 stitches on hold");
  await expect(page.locator(".knitting-panel")).toContainText("right sleeve");
  await expect(page.getByRole("button", { name: "End of round", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Held: carry on" }).click();

  // Its underarm, cast on in its place, step by step - with the yarn at the needle, not a long tail.
  const hint = page.getByRole("list", { name: "Stitches in this round" });
  await expect(hint).toContainText("Knitted cast-on, at the underarm");
  await expect(hint).toContainText("turn the work so the wrong side faces you");
  await expect(hint).toContainText("backward-loop cast-on");
  // Then the front, then the left sleeve.
  await page.getByRole("button", { name: /^Cast on 12 in / }).click();
  await page.getByRole("button", { name: /^Knit 136 in / }).click();
  await expect(page.locator(".knitting-panel")).toContainText("left sleeve");
  // Undo takes back the step, and only the step.
  await page.getByRole("button", { name: "Held: carry on" }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".knitting-panel")).toContainText("Put 80 stitches on hold");
  await page.getByRole("button", { name: "Held: carry on" }).click();
  await page.getByRole("button", { name: /^Cast on 12 in / }).click();
  await page.getByRole("button", { name: "End of round", exact: true }).click();
  await expect(position(page)).toContainText("Body, round 2, stitch 1.");

  await page.getByRole("button", { name: "Key", exact: true }).click();
  const key = page.getByRole("dialog", { name: "Key" });
  await expect(key).toContainText("Put stitches on hold");
  await expect(key).toContainText("the right sleeve's 80, then the left sleeve's 80");

  // Written out, the round is whole: its holds in their places.
  await key.getByRole("button", { name: "Close the key" }).click();
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  // The whole sweater is one chart: the body and the sleeves beside it, above the yoke.
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.getByRole("img", { name: /^The chart: 480 columns and 219 rows\./ })).toBeVisible();
  const settings = await openSettings(page);
  await settings.getByRole("switch", { name: "Written round instructions" }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByText("Text round instructions", { exact: true }).click();
  await page.getByLabel("Read round").selectOption({ label: "Body, round 1 · Body · dividing round" });
  await expect(page.getByText("Put the next 80 stitches on hold for the right sleeve.")).toBeVisible();
  await expect(page.getByText("Put the next 80 stitches on hold for the left sleeve.")).toBeVisible();
});

test("a sleeve begins from its held stitches, picked up round from its underarm", async ({ page }) => {
  await knittedTo(page, bodyDone);
  await expect(page.locator(".knitting-panel")).toContainText("Begin the left sleeve");
  await expect(page.locator(".knitting-panel")).toContainText("Put the 80 held stitches back on your needles");
  await page.getByRole("button", { name: "On the needles: carry on" }).click();
  await expect(position(page)).toContainText("Left sleeve, round 1, stitch 1.");
  await page.getByRole("button", { name: /^Pick up and knit 6 in / }).click();
  await page.getByRole("button", { name: /^Knit 80 in / }).click();
  await page.getByRole("button", { name: /^Pick up and knit 6 in / }).click();
  await expect(position(page)).toContainText("Left sleeve, round 2, stitch 1.");
  // On the one chart, the stitch to be worked next is the sleeve's, named as the sleeve's round.
  await tapBeside(page, 0);
  await expect(page.getByRole("dialog", { name: /^Left sleeve, round 2, stitch 1$/ })).toBeVisible();
});

test("starting to knit brings the stitch into view, and keeps it there when the panel grows", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await page.reload();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.getByRole("button", { name: "Start knitting", exact: true }).click();
  // The first round is the chart's bottom row.
  const bottomShowing = () => page.evaluate(() => {
    const window = document.querySelector(".chart-scroll").getBoundingClientRect();
    const sheet = document.querySelector(".chart-sheets").getBoundingClientRect();
    return sheet.bottom <= window.bottom + 1;
  });
  await expect.poll(bottomShowing).toBe(true);
  // As a late font would: the panel grows, and the window above it shrinks.
  await page.locator(".knitting-panel").evaluate(panel => { panel.style.paddingBottom = "80px"; });
  await expect.poll(bottomShowing).toBe(true);
});

test("the chart page does not pan sideways, and zooming leaves the chart where it lands", async ({ page }) => {
  await start(page);
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(await fits()).toBe(true);

  // Look well away from the stitch being worked, then zoom. Focus first:
  // focusing the chart scrolls it into view, which is not the zoom's doing.
  await page.evaluate(() => window.scrollTo(0, 0));
  const chart = page.getByRole("region", { name: /Scrollable knitting chart/ });
  await chart.focus();
  await page.waitForTimeout(600);
  const middle = () => page.evaluate(() => {
    const scroller = document.querySelector(".chart-scroll").getBoundingClientRect();
    const box = document.querySelector(".chart-sheets").getBoundingClientRect();
    const x = scroller.left + scroller.width / 2;
    const y = Math.max(scroller.top, 0) / 2 + Math.min(scroller.bottom, innerHeight) / 2;
    return [(x - box.left) / box.width, (y - box.top) / box.height];
  });
  const before = await middle();
  await chart.press("+");
  await page.waitForTimeout(1200);
  const after = await middle();
  expect(Math.abs(after[0] - before[0])).toBeLessThan(0.03);
  expect(Math.abs(after[1] - before[1])).toBeLessThan(0.03);

  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  expect(await fits()).toBe(true);
});

test("progress survives reload and undo; a second tab stays in sync", async ({ page, context }) => {
  await start(page);
  // Cast on and joined, so every step below is a round.
  await page.getByRole("button", { name: "End of round", exact: true }).click();
  await page.getByRole("button", { name: "Joined: carry on" }).click();
  const original = await position(page).textContent();
  await page.getByRole("button", { name: "End of round", exact: true }).click();
  const advanced = await position(page).textContent();
  expect(advanced).not.toBe(original);
  await page.getByRole("button", { name: "End of round", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(position(page)).toHaveText(advanced);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(position(page)).toHaveText(original);
  await page.getByRole("button", { name: "End of round", exact: true }).click();
  await page.reload();
  await expect(position(page)).toHaveText(advanced);
  const other = await context.newPage();
  await other.goto(page.url());
  await page.getByRole("button", { name: "End of round", exact: true }).click();
  const further = await position(page).textContent();
  await expect(position(other)).toHaveText(further);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(position(other)).toHaveText(advanced);
});

test("tapping a stitch on the chart carries on from it, and can be undone", async ({ page }) => {
  // The start of the yoke's last round, where every column has its stitch: under the
  // yoke's make-ones the rib's stitches stand apart, with nothing between them to tap.
  await knittedTo(page, yokeLastRound - 1);
  await expect(position(page)).toContainText("Yoke, round 75, stitch 1.");
  const original = await position(page).textContent();
  // Three stitches on from the one about to be worked.
  await tapBeside(page, 3);
  const picker = page.getByRole("dialog", { name: "Yoke, round 75, stitch 4" });
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: "Knit up to here" }).click();
  await expect(position(page)).toContainText("Yoke, round 75, stitch 4.");
  await expect(picker).toBeHidden();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(position(page)).toHaveText(original);
});

test("backup restores copies and rename/delete require their dialogs", async ({ page }) => {
  await start(page);
  // Knitting fills the screen; Settings is in the header, once you stop.
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await (await openSettings(page)).getByRole("button", { name: "Save", exact: true }).click();
  const download = await downloadPromise;
  const buffer = await readFile(await download.path());
  expect(JSON.parse(buffer.toString()).projects).toHaveLength(1);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("link", { name: "Sweat Shop", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sweat Shop", level: 1, exact: true })).toBeVisible();
  await (await openSettings(page)).getByLabel("Import project backup").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer });
  await page.getByRole("button", { name: "Restore copies", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("button", { name: "Rename", exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Rename", exact: true }).first().click();
  await page.getByRole("textbox", { name: "Name this project" }).fill("Regression test jumper");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Regression test jumper", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Rename", exact: true })).toHaveCount(2);
});

test("quota failures preserve progress and offer a recovery export", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException("Storage full", "QuotaExceededError"); };
  });
  await start(page);
  await page.getByRole("button", { name: "End of round", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Progress is not being saved");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export recovery backup", exact: true }).click();
  const download = await downloadPromise;
  const backup = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(backup.projects[0].progress).toBeGreaterThan(0);
});

test("a prepared project reloads and saves progress offline", async ({ page, context }) => {
  await start(page);
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await expect(page.getByText(/Ready for offline knitting/)).toBeVisible({ timeout: 45_000 });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Start knitting", exact: true }).click();
  await page.getByRole("button", { name: "End of round", exact: true }).click();
  const progress = await position(page).textContent();
  await page.reload();
  await expect(position(page)).toHaveText(progress);
});
