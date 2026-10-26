import { test, expect } from "playwright/test";
import { readFile } from "node:fs/promises";

const design = "#/sweater/hamefarin";
const position = page => page.locator(".knitting-panel [role=status]");
const steps = /^(Joined|Changed|Held|On the needles|Turned|Placed|Taken off): carry on$/;
/**
 * Work to the end of `count` rounds - or short rows - taking any step on the
 * way - joining the round, changing needles, turning a short row, putting a
 * sleeve on hold, placing or taking off a marker - as asked.
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
/** Hamefarin in a medium, as a project's choices. */
const medium = { sweaterId: "hamefarin", sizeId: "m", colourwayId: "simmer-dim" };
/** The Paul Klee Sweater in its M1, in the colours the pattern gives it, counted with its markers: see helpers/revisions. */
const klee = { sweaterId: "paul-klee", sizeId: "m1", colourwayId: "klee", revision: 1 };
/**
 * A sweater already knitted as far as `progress` - the id of the last stitch
 * worked - opened at its chart with the knitting showing. Knitting a yoke's
 * twenty thousand stitches a round at a time is no way to reach the divide.
 */
async function knittedTo(page, progress, choices = medium) {
  await page.goto("");
  await page.evaluate(({ progress, choices }) => {
    const now = new Date().toISOString();
    const id = "project-1760000000000";
    localStorage.setItem(id, JSON.stringify({
      version: 1, id, ...choices, progress, startedAt: now, updatedAt: now,
    }));
  }, { progress, choices });
  await page.goto("#/project/1760000000000/chart?knitting=1");
  await expect(position(page)).toBeAttached();
}
/**
 * Taps the chart `across` cells to the left of the stitch to be worked next,
 * in its round, once the chart has brought it into view: with the columns
 * closed up, the stitches beside it are only side by side while its row is
 * in view.
 */
async function tapBeside(page, across) {
  await expect(page.locator(".chart-next")).toBeInViewport();
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
/*
 * In the Paul Klee Sweater's M1: the last stitch before the raglan's set-up
 * round; the back's first half of its dividing round knitted, with the
 * raglan's first marker to come off and the right sleeve to go on hold next;
 * the last stitch before its hem's rib; and the last before the rib is bound
 * off.
 */
const kleeBeforeSetUp = 13004;
const kleeBeforeHold = 20367;
const kleeBeforeRib = 36194;
const kleeBeforeBindOff = 43510;

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
  expect(links).toHaveLength(4);
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
  // Taller, a row at a time: closed up, the chart need not be wider with fewer rows in view.
  const sheetHeight = () => page.locator(".chart-sheets").evaluate(node => node.offsetHeight);
  const unzoomed = await sheetHeight();
  await page.getByRole("region", { name: /Scrollable knitting chart/ }).press("+");
  await expect.poll(sheetHeight).toBeGreaterThan(unzoomed);
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
    // By its right-hand edge, which it is scrolled across from: columns opening to the left move nothing.
    return { right: box.right, top: box.top };
  });
  const before = await at();
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await expect(page.getByRole("region", { name: "Your progress" })).toBeVisible();
  const after = await at();
  expect(Math.abs(after.top - before.top)).toBeLessThan(2);
  expect(Math.abs(after.right - before.right)).toBeLessThan(2);
});

test("the chart keeps its bottom right corner when its window is resized for a moment", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await page.reload();
  const gaps = () => page.locator(".chart-scroll").evaluate(scroller => ({
    // Scrolled across from the right, a scroll is how far it is from there, less than nought: see scroll-corner.
    right: Math.round(-scroller.scrollLeft) || 0,
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
  // Its steps are folded away until asked for, so the chart keeps its room.
  await expect(hint.getByText("Measure the tail", { exact: false })).toBeHidden();
  await hint.getByText("Step by step", { exact: true }).click();
  await expect(hint.getByText("Measure the tail", { exact: false })).toBeVisible();
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
  await expect(page.locator("[data-note=needles]")).not.toHaveCount(0);

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
  await expect(page.locator("[data-note=turn]")).not.toHaveCount(0);
  // The rows to be purled back are hatched: from the right side they show as the knits they make.
  const chart = page.getByRole("img", { name: /^The chart:/ });
  await expect(chart).not.toHaveAccessibleName(/wrong side towards you/);
  await expect(page.locator("[data-note=hatch]")).toHaveCount(3);
  await page.getByRole("button", { name: "Turned: carry on" }).click();
  await expect(position(page)).toContainText("Yoke, short row 2, wrong side, stitch 1. Purl 39 in");
  // And with the work turned, the chart is too: the wrong side towards you, every stitch as it looks
  // from there - the row back purls - and the knitting from the right side hatched on either side of it.
  await expect(chart).toHaveAccessibleName(/wrong side towards you, and the chart is turned over/);
  await expect(page.locator("[data-note=hatch]")).toHaveCount(4);
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
  // The chart is the body's now, and says so. Its rounds are counted on from the yoke's 75.
  await expect(position(page)).toContainText("Body, round 76, stitch 1.");
  await expect(page.getByRole("img", { name: /You are on Body, round 76: dividing round\./ })).toBeVisible();
  await expect(page.locator("[data-note=hold]")).toHaveCount(2);
  const onHold = page.locator("[data-note=on-hold]");
  await expect(onHold).toHaveCount(0);

  // Across the back to the right sleeve, which goes on hold.
  await page.getByRole("button", { name: /^Knit 68 in / }).click();
  await expect(page.locator(".knitting-panel")).toContainText("Put 80 stitches on hold");
  await expect(page.locator(".knitting-panel")).toContainText("right sleeve");
  await expect(page.getByRole("button", { name: "End of round", exact: true })).toHaveCount(0);
  // The chart is the view from the neck until the first stitch cast on at the underarm, which is the body's.
  const view = page.locator(".chart-page");
  await expect(view).toHaveAttribute("data-view", "neck");
  await page.getByRole("button", { name: "Held: carry on" }).click();
  await expect(view).toHaveAttribute("data-view", /^remaining-/);
  // Crosshatched once on hold, with the whole sleeve to be knitted from them.
  await expect(onHold).toHaveCount(1);

  // Its underarm, cast on in its place, step by step - with the yarn at the needle, not a long tail.
  const hint = page.getByRole("list", { name: "Stitches in this round" });
  await expect(hint).toContainText("Knitted cast-on, at the underarm");
  await hint.getByText("Step by step", { exact: true }).click();
  await expect(hint.getByText("turn the work so the wrong side faces you", { exact: false })).toBeVisible();
  await expect(hint).toContainText("backward-loop cast-on");
  // Then the front, then the left sleeve.
  await page.getByRole("button", { name: /^Cast on 12 in / }).click();
  await page.getByRole("button", { name: /^Knit 136 in / }).click();
  await expect(page.locator(".knitting-panel")).toContainText("left sleeve");
  // Undo takes back the step, and only the step.
  await page.getByRole("button", { name: "Held: carry on" }).click();
  await expect(onHold).toHaveCount(2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".knitting-panel")).toContainText("Put 80 stitches on hold");
  await expect(onHold).toHaveCount(1);
  await page.getByRole("button", { name: "Held: carry on" }).click();
  await page.getByRole("button", { name: /^Cast on 12 in / }).click();
  await page.getByRole("button", { name: "End of round", exact: true }).click();
  await expect(position(page)).toContainText("Body, round 77, stitch 1.");

  await page.getByRole("button", { name: "Key", exact: true }).click();
  const key = page.getByRole("dialog", { name: "Key" });
  await expect(key).toContainText("Put stitches on hold");
  await expect(key).toContainText("the right sleeve's 80, then the left sleeve's 80");

  // Written out, the round is whole: its holds in their places.
  await key.getByRole("button", { name: "Close the key" }).click();
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  // Four views of the chart, the body's the one being knitted: its underarms, without the sleeves: a round of its 296 stitches wide.
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveText(["From the neck", "Bodyknitting", "Right sleeve", "Left sleeve"]);
  await expect(page.getByRole("tab", { selected: true })).toHaveText("Bodyknitting");
  await expect(page.getByRole("img", { name: /^The chart: 296 columns and 193 rows\./ })).toBeVisible();
  // From the neck, the yoke and above it everything but the underarms: the body and the sleeves beside it.
  await page.getByRole("tab", { name: "From the neck" }).click();
  await expect(page.getByRole("img", { name: /^The chart: 436 columns and 219 rows\./ })).toBeVisible();
  await page.getByRole("tab", { name: "Body" }).click();
  const settings = await openSettings(page);
  await settings.getByRole("switch", { name: "Written round instructions" }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByText("Text round instructions", { exact: true }).click();
  await page.getByLabel("Read round").selectOption({ label: "Body, round 76 · dividing round" });
  await expect(page.getByText("Put the next 80 stitches on hold for the right sleeve.")).toBeVisible();
  await expect(page.getByText("Put the next 80 stitches on hold for the left sleeve.")).toBeVisible();
});

test("a sleeve begins from its held stitches, picked up round from its underarm", async ({ page }) => {
  await knittedTo(page, bodyDone);
  await expect(page.locator(".knitting-panel")).toContainText("Begin the left sleeve");
  await expect(page.locator(".knitting-panel")).toContainText("Put the 80 held stitches back onto 3.25mm needles, changing from the 2.75mm ones");
  // Both sleeves are on hold until each is taken up; the right waits for the left.
  const onHold = page.locator("[data-note=on-hold]");
  await expect(onHold).toHaveCount(2);
  // The chart stays the body's until the first stitch picked up, which is the sleeve's.
  const view = page.locator(".chart-page");
  await expect(view).toHaveAttribute("data-view", /^remaining-/);
  await page.getByRole("button", { name: "On the needles: carry on" }).click();
  await expect(view).toHaveAttribute("data-view", "held-sleeve-left");
  // The sleeve's chart, just opened, brings the stitch to be worked next into view.
  await expect(page.locator(".chart-next")).toBeInViewport();
  await expect(onHold).toHaveCount(1);
  await expect(position(page)).toContainText("Left sleeve, round 76, stitch 1.");
  await page.getByRole("button", { name: /^Pick up and knit 6 in / }).click();
  await page.getByRole("button", { name: /^Knit 80 in / }).click();
  await page.getByRole("button", { name: /^Pick up and knit 6 in / }).click();
  await expect(position(page)).toContainText("Left sleeve, round 77, stitch 1.");
  // On the sleeve's chart, the stitch to be worked next is named as the sleeve's round.
  await tapBeside(page, 0);
  await expect(page.getByRole("dialog", { name: /^Left sleeve, round 77, stitch 1$/ })).toBeVisible();
});

test("a bought design comes in every size it is written for, by its own wool, every colour of it yours to change", async ({ page }) => {
  await page.goto("#/sweater/paul-klee");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Paul Klee Sweater");
  await expect(page.getByText("© Midori Hirose 2022", { exact: false })).toBeVisible();
  // Four sizes for children, by age, and twelve for adults, by the bust they fit.
  const sizes = page.locator(".size-option");
  await expect(sizes).toHaveCount(16);
  await expect(sizes.first()).toContainText("Kids 1");
  await expect(sizes.first()).toContainText("2–3 years");
  await expect(sizes.nth(4)).toContainText("to fit 71cm");
  // The metres are the pattern's, and only for the colours a size knits: an L's eleven bands, a child's seven.
  await expect(page.getByText("The metres are the pattern's own", { exact: false })).toBeVisible();
  const wool = page.locator(".wool-row");
  await expect(wool).toHaveCount(23);
  await sizes.first().click();
  await expect(wool).toHaveCount(15);
  // Any of them can be changed, each on its own.
  const first = wool.filter({ has: page.locator(".shade-chip", { hasText: /^1A$/ }) });
  await first.click();
  const picker = page.getByRole("dialog", { name: "Wool for Yarn 1A" });
  await picker.getByLabel("Search the wool").fill("Scarlet");
  await picker.getByRole("button", { name: /^Scarlet .*Spindrift/ }).click();
  await picker.getByRole("button", { name: "Close", exact: true }).click();
  await expect(first).toContainText("Scarlet");
  await expect(first).toContainText("yours");
  await expect(wool.filter({ has: page.locator(".shade-chip", { hasText: /^1B$/ }) })).not.toContainText("yours");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("Each Year Once knits every hat from 2014 to 2026 once, the yoke's first, the sleeves' last", async ({ page }) => {
  await page.goto("#/sweater/wool-week-strips-once-oldest");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Each Year Once, oldest at the neck");
  await expect(page.getByText("Hazel Tindall", { exact: false }).first()).toBeVisible();
  await expect(page.locator(".size-option")).toHaveCount(8);
  // The trim chosen apart from the rest: the darkest yarn of the hats beside each part to begin with, or any yarn of the palette.
  const trim = page.getByRole("group", { name: "Trim" });
  await expect(trim.getByRole("button", { pressed: true })).toHaveAccessibleName("Darkest beside each");
  await trim.getByRole("button", { name: "Moorit" }).click();
  await expect(trim.getByRole("button", { pressed: true })).toHaveAccessibleName("Moorit");
  await trim.getByRole("button", { name: "Darkest beside each" }).click();
  await expect(trim.getByRole("button", { pressed: true })).toHaveAccessibleName("Darkest beside each");
  // Knitting it in a medium: the yoke begins with the Shwook Hat and has the Crofthoose Hat's houses; a sleeve ends with the Birsie Beanny.
  const sampler = { sweaterId: "wool-week-strips-once-oldest", sizeId: "m", colourwayId: "early-light" };
  const onChart = (what) => page.getByRole("img", { name: new RegExp(`You are on .*: ${what}`) });
  await knittedTo(page, 4600, sampler);
  await expect(onChart("2014 Shwook Hat")).toBeVisible();
  await knittedTo(page, 17500, sampler);
  await expect(onChart("2016 Crofthoose Hat")).toBeVisible();
  await knittedTo(page, 92900, sampler);
  await expect(onChart("2026 Birsie Beanny, sleeve")).toBeVisible();
  await expect(page.locator(".chart-page")).toHaveAttribute("data-view", "held-sleeve-left");
});

test("a raglan's set-up round places its four markers where the pattern says, each a line up the chart", async ({ page }) => {
  await knittedTo(page, kleeBeforeSetUp, klee);
  for (const [knit, line] of [[44, "right back"], [56, "right front"], [88, "left front"], [56, "left back"]]) {
    await page.getByRole("button", { name: new RegExp(`^Knit ${knit} in `) }).click();
    await expect(position(page)).toContainText(`Place the marker for the ${line} raglan line.`);
    await expect(page.locator(".knitting-panel")).toContainText(`Place a marker for the ${line} raglan line`);
    await page.getByRole("button", { name: "Placed: carry on" }).click();
  }
  await expect(page.getByRole("button", { name: /^Knit 44 in / })).toBeVisible();
  // The four raglan lines, and the colourwork's seven before them.
  const lines = page.locator(".chart-notes [data-note=marker]");
  await expect(lines).toHaveCount(11);
  await expect(lines.filter({ hasText: "raglan line" })).toHaveCount(4);
});

test("a raglan divides as its pattern says: its markers off either side of each sleeve, a wrap at each corner, one cast on more than stays, and a new beginning of the round", async ({ page }) => {
  // Whether the stitch to be worked next is in the chart's first column, at its right-hand edge.
  const edge = () => page.evaluate(() => {
    const next = document.querySelector(".chart-next").getBoundingClientRect();
    const cell = next.width - 2;
    // Column 1 ends where the round numbers' gutter begins, 2.2 cells from the sheet's edge: see chart-painter.
    const end = document.querySelector(".chart-sheets").getBoundingClientRect().right - Math.round(cell * 2.2);
    return Math.abs(end - next.right) < cell / 2;
  });
  await knittedTo(page, kleeBeforeHold, klee);
  await expect(position(page)).toContainText("Body, round 107, stitch 55. Take off the marker for the right back raglan line.");
  await expect.poll(edge).toBe(false);
  await page.getByRole("button", { name: "Taken off: carry on" }).click();
  await expect(position(page)).toContainText("Put 78 stitches on hold.");
  await expect(page.locator(".knitting-panel")).toContainText("First wrap the next stitch");
  await page.getByRole("button", { name: "Held: carry on" }).click();
  await expect(position(page)).toContainText("Take off the marker for the right front raglan line.");
  await page.getByRole("button", { name: "Taken off: carry on" }).click();
  // The underarm is cable cast on, the new beginning of the round half way along it, and closed up by the stitch after.
  const hint = page.getByRole("list", { name: "Stitches in this round" });
  await expect(hint).toContainText("Cable cast-on, at the underarm");
  await expect(hint).toContainText("the marker for the new beginning of the round");
  await page.getByRole("button", { name: /^Cast on 4 in / }).click();
  await expect(position(page)).toContainText("Place the marker for the new beginning of the round.");
  await page.getByRole("button", { name: "Placed: carry on" }).click();
  // The whole chart is cut at it from now on: a new round, and the next stitch the chart's right-hand edge. The
  // rounds are numbered by its rows, two more now below: the cast-on's part, and the set-up round's beside the short rows.
  await expect(position(page)).toContainText("Body, round 109, stitch 1.");
  await expect.poll(edge).toBe(true);
  await page.getByRole("button", { name: /^Cast on 5 in / }).click();
  await page.getByRole("button", { name: /^Slip 1 and pass the cast-on over in / }).click();
  await page.getByRole("button", { name: /^Knit 109 in / }).click();
  await expect(position(page)).toContainText("Take off the marker for the left front raglan line.");
  await page.getByRole("button", { name: "Taken off: carry on" }).click();
  await page.getByRole("button", { name: "Held: carry on" }).click();
  await expect(position(page)).toContainText("Take off the marker for the left back raglan line.");
  await page.getByRole("button", { name: "Taken off: carry on" }).click();
  await page.getByRole("button", { name: /^Cast on 9 in / }).click();
  await page.getByRole("button", { name: /^Slip 1 and pass the cast-on over in / }).click();
  await page.getByRole("button", { name: /^Knit 54 in / }).click();
  // At the old beginning, which comes off; then on to the new one, a quarter of the way round, to end the round.
  await expect(position(page)).toContainText("Take off the marker for the beginning of the round.");
  await page.getByRole("button", { name: "Taken off: carry on" }).click();
  await expect(position(page)).toContainText("Body, round 109, stitch 180. Knit 59 in");
  await page.getByRole("button", { name: /^Knit 59 in / }).click();
  await expect(position(page)).toContainText("Body, round 110, stitch 1. Knit 236 in");
  await expect.poll(edge).toBe(true);
});

test("a rib is worked as its pattern words it, and bound off in pattern", async ({ page }) => {
  await knittedTo(page, kleeBeforeRib, klee);
  await expect(page.getByRole("button", { name: /^\(K1, p1\) x 118 in / })).toBeVisible();
  await knittedTo(page, kleeBeforeBindOff, klee);
  await expect(page.getByRole("button", { name: /^Bind off 236 in pattern in / })).toBeVisible();
  await expect(page.getByRole("list", { name: "Stitches in this round" })).toContainText("Bind off purlwise");
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

/** Clicks the chart at a point on screen. */
async function tapAt(page, x, y) {
  await page.locator(".chart-sheets").evaluate((sheet, { x, y }) => {
    sheet.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }));
  }, { x, y });
}
/** The stitch the picker is open at, by name, and the middle of its cell on screen; then closes it. */
async function picked(page) {
  const picker = page.getByRole("dialog", { name: /, stitch \d+$/ });
  const name = await picker.getAttribute("aria-label");
  const box = await page.locator(".chart-picked").boundingBox();
  await picker.getByRole("button", { name: "Close" }).click();
  return { name, x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
/** Zooms the chart in as far as it goes, a press of "+" at a time. */
async function zoomAllTheWayIn(page) {
  const chart = page.getByRole("region", { name: /Scrollable knitting chart/ });
  const tall = () => page.locator(".chart-sheets").evaluate(sheet => sheet.offsetHeight);
  // From 16 pixels a stitch to 40, 4 at a time.
  for (let press = 0; press < 6; press++) {
    const before = await tall();
    await chart.press("+");
    await expect.poll(tall).toBeGreaterThan(before);
  }
}

test("closed up, the rib at the neck is its stitches side by side, and every column shows by the widest round", async ({ page }) => {
  await start(page);
  // Close enough that the rows in view are the neck's, below the yoke's first make-ones.
  await zoomAllTheWayIn(page);
  await page.getByRole("button", { name: "End of round", exact: true }).click();
  await page.getByRole("button", { name: "Joined: carry on" }).click();
  await expect(position(page)).toContainText("Yoke, round 2, stitch 1.");
  // The next cell along is the next stitch: the columns the yoke's make-ones open stay closed while their rows are out of view.
  await tapBeside(page, 1);
  const next = page.getByRole("dialog", { name: "Yoke, round 2, stitch 2" });
  await expect(next).toBeVisible();
  await next.getByRole("button", { name: "Close" }).click();

  // Up the chart a little at a time, from the neck: fewer columns there than in all, and every one of them further up.
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  const tiles = page.locator(".chart-tiles");
  const columns = Number(await tiles.getAttribute("data-columns"));
  const scroller = page.locator(".chart-scroll");
  /*
   * Half a view at a time, so every row is well inside some view: the widest
   * round is only a few rows. Up from wherever the box is, to the top: the
   * chart grows taller as rows open, and its scroll is put right at rest,
   * so places counted from its height at the start would stop short. All in
   * the page, a step a frame or two, as a slow runner has time for.
   */
  const { counts, top } = await scroller.evaluate(async box => {
    const frames = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    const tiles = box.querySelector(".chart-tiles");
    box.scrollTop = box.scrollHeight;
    const counts = [];
    for (let step = 0; step < 400; step++) {
      await frames();
      counts.push(Number(tiles.dataset.columnsShowing));
      if (box.scrollTop === 0) break;
      box.scrollTop = Math.max(0, box.scrollTop - Math.floor(box.clientHeight / 2));
    }
    return { counts, top: box.scrollTop };
  });
  // It got there.
  expect(top).toBe(0);
  expect(counts[0]).toBeLessThan(columns);
  expect(Math.max(...counts)).toBe(columns);
});

test("closed up, scrolled all the way left, the chart's left-hand edge is never cut off as columns open", async ({ page }) => {
  await start(page);
  await zoomAllTheWayIn(page);
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  const scroller = page.locator(".chart-scroll");
  // At the neck, as far left as the box goes, then up the yoke a little every frame, its make-ones opening columns to the left.
  const { cut, opened } = await scroller.evaluate(async box => {
    const frame = () => new Promise(done => requestAnimationFrame(done));
    const layer = box.querySelector(".chart-layer");
    const tiles = box.querySelector(".chart-tiles");
    box.scrollTop = box.scrollHeight;
    await frame();
    await new Promise(done => setTimeout(done, 400));
    const showing = () => Number(tiles.dataset.columnsShowing);
    const from = showing();
    let cut = 0;
    for (let step = 0; step < 240 && box.scrollTop > 0; step++) {
      box.scrollLeft = box.clientWidth - box.scrollWidth;
      box.scrollTop -= 6;
      await frame();
      // Where the layer puts the chart's left-hand edge on the sheet: cut off, and out of reach, if past nought.
      const x = Number(/translate\((-?[\d.e-]+)px/.exec(layer.style.transform)?.[1] ?? 0);
      cut = Math.max(cut, -x);
    }
    return { cut, opened: showing() - from };
  });
  expect(opened).toBeGreaterThan(0);
  expect(cut).toBeLessThan(1);
});

test("closed up, scrolled left, the box stops at the chart's left-hand edge, with no blank past it to come back out of", async ({ page }) => {
  // Each Year Once's neck, where columns open and close again on the way across.
  await page.goto("#/sweater/wool-week-strips-once-oldest");
  await page.getByRole("button", { name: "Start knitting this", exact: true }).click();
  await expect(page.getByRole("button", { name: "End of round", exact: true })).toBeVisible();
  const scroller = page.locator(".chart-scroll");
  const { most, rest, opened } = await scroller.evaluate(async box => {
    const frame = () => new Promise(done => requestAnimationFrame(done));
    await new Promise(done => setTimeout(done, 600));
    const sheet = box.querySelector(".chart-sheets");
    const layer = box.querySelector(".chart-layer");
    const tiles = box.querySelector(".chart-tiles");
    const style = getComputedStyle(box);
    const inside = box.getBoundingClientRect().left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
    // How far right of the inside of the box the chart's left-hand edge is.
    const blank = () => sheet.getBoundingClientRect().left + Number(/translate\((-?[\d.e-]+)px/.exec(layer.style.transform)?.[1] ?? 0) - inside;
    const counts = new Set();
    let most = -Infinity;
    // A long swipe left, a little every frame, to the end.
    for (let step = 0; step < 600; step++) {
      const was = box.scrollLeft;
      box.scrollLeft -= 20;
      await frame();
      counts.add(tiles.dataset.columnsShowing);
      most = Math.max(most, blank());
      if (box.scrollLeft === was) break;
    }
    await new Promise(done => setTimeout(done, 600));
    return { most, rest: blank(), opened: counts.size };
  });
  // Columns opened and closed on the way.
  expect(opened).toBeGreaterThan(1);
  // Never further than it comes to rest, its margin for a join's arrow: no blank sheet past it.
  expect(most - rest).toBeLessThan(1);
});

test("closed up, scrolled all the way left and then gently up, the chart's left-hand edge stays where it is", async ({ page }) => {
  await page.goto("#/sweater/wool-week-strips-once-oldest");
  await page.getByRole("button", { name: "Start knitting this", exact: true }).click();
  await expect(page.getByRole("button", { name: "End of round", exact: true })).toBeVisible();
  const scroller = page.locator(".chart-scroll");
  const { start, least, most, opened } = await scroller.evaluate(async box => {
    const frame = () => new Promise(done => requestAnimationFrame(done));
    const rest = () => new Promise(done => setTimeout(done, 600));
    const sheet = box.querySelector(".chart-sheets");
    const layer = box.querySelector(".chart-layer");
    const tiles = box.querySelector(".chart-tiles");
    // Where the chart's left-hand edge is across the box.
    const edge = () => sheet.getBoundingClientRect().left + Number(/translate\((-?[\d.e-]+)px/.exec(layer.style.transform)?.[1] ?? 0) - box.getBoundingClientRect().left;
    box.scrollLeft = -1e6;
    await rest();
    box.scrollLeft = -1e6;
    await rest();
    const start = edge();
    const counts = new Set();
    let least = Infinity;
    let most = -Infinity;
    // Up the yoke a little every frame, its make-ones opening columns as their rows come into view.
    for (let step = 0; step < 300 && box.scrollTop > 0; step++) {
      box.scrollTop -= 2;
      await frame();
      counts.add(tiles.dataset.columnsShowing);
      least = Math.min(least, edge());
      most = Math.max(most, edge());
    }
    await rest();
    least = Math.min(least, edge());
    most = Math.max(most, edge());
    return { start, least, most, opened: counts.size };
  });
  expect(opened).toBeGreaterThan(1);
  expect(start - least).toBeLessThan(1);
  expect(most - start).toBeLessThan(1);
});

test("closed up, zooming keeps the stitch under the point zoomed about", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await page.waitForTimeout(400);
  // A stitch of the rib, near the middle of the box: tapped for leftwards from the middle, past any columns between.
  const box = await page.locator(".chart-scroll").boundingBox();
  const picker = page.getByRole("dialog", { name: /, stitch \d+$/ });
  for (let step = 0; step < 40 && !(await picker.count()); step++) {
    await tapAt(page, box.x + box.width / 2 - step * 6, box.y + box.height * 0.8);
  }
  const before = await picked(page);
  // Zoomed in about the middle of its cell, as a trackpad pinches: fewer rows in view, and fewer columns.
  await page.mouse.move(before.x, before.y);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -40);
  await page.keyboard.up("Control");
  await page.waitForTimeout(1200);
  await tapAt(page, before.x, before.y);
  const after = await picked(page);
  expect(after.name).toBe(before.name);
});

test("zoomed out as far as it goes, the chart's whole width fits the box, and it zooms back in as it went", async ({ page }) => {
  await knittedTo(page, 0, { sweaterId: "wool-week-strips-once-oldest", sizeId: "m", colourwayId: "early-light" });
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  const chart = page.getByRole("region", { name: /Scrollable knitting chart/ });
  await chart.focus();
  const scroller = page.locator(".chart-scroll");
  const wide = () => scroller.evaluate((box) => box.scrollWidth - box.clientWidth);
  const tall = () => page.locator(".chart-sheets").evaluate((sheet) => sheet.offsetHeight);
  expect(await wide()).toBeGreaterThan(0);
  // Out a press at a time until it goes no further: then nothing is left to scroll across.
  const heights = [await tall()];
  for (let press = 0; press < 12; press++) {
    await chart.press("-");
    await page.waitForTimeout(150);
    heights.push(await tall());
  }
  await expect.poll(wide).toBeLessThanOrEqual(0);
  // It got smaller each press until it fitted, and then stayed put.
  const smaller = heights.findIndex((h, k) => k > 0 && h === heights[k - 1]);
  expect(smaller).toBeGreaterThan(3);
  expect(new Set(heights.slice(smaller)).size).toBe(1);
  // Every column showing, with all the rows in view.
  const tiles = page.locator(".chart-tiles");
  expect(await tiles.getAttribute("data-columns-showing")).toBe(await tiles.getAttribute("data-columns"));
  // And back in by the same steps, to the size it began at: the room left of the chart for a join's arrow is half a stitch.
  const room = () => page.locator(".chart-sheets").evaluate((sheet) => sheet.style.marginLeft);
  for (let press = 0; press < smaller; press++) await chart.press("+");
  await expect.poll(room).toBe("8px");
  expect(await wide()).toBeGreaterThan(0);
});

test("between its sleeves going on hold, the chart is what is left on the needles: the first sleeve gone, the second still there", async ({ page }) => {
  // Each Year Once in a medium: its right sleeve on hold at 29464, its left at 29635.
  const sampler = { sweaterId: "wool-week-strips-once-oldest", sizeId: "m", colourwayId: "early-light" };
  const chartPage = page.locator(".chart-page");
  await knittedTo(page, 29400, sampler);
  await expect(chartPage).toHaveAttribute("data-view", "neck");
  await knittedTo(page, 29500, sampler);
  await expect(chartPage).toHaveAttribute("data-view", "remaining-29464");
  // The tabs are the finished pattern's views: the body's is the one the knitting is in, and shows it as it stands.
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await expect(page.getByRole("tab")).toHaveCount(4);
  await expect(page.getByRole("tab", { name: /^Body/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /^Body/ })).toContainText("knitting");
  await expect(chartPage).toHaveAttribute("data-view", "remaining-29464");
  // Wider than the body's, by the second sleeve's stitches.
  const columns = () => page.locator(".chart-tiles").getAttribute("data-columns");
  const between = Number(await columns());
  await knittedTo(page, 29700, sampler);
  await expect(chartPage).toHaveAttribute("data-view", "remaining-29635");
  expect(between).toBeGreaterThan(Number(await columns()));
});

test("the Body view tears the yoke apart either side of each underarm, where a sleeve's stitches are left out", async ({ page }) => {
  await knittedTo(page, 0, { sweaterId: "wool-week-strips-once-oldest", sizeId: "m", colourwayId: "early-light" });
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  const notes = page.locator(".chart-notes [data-note=break]");
  // From the neck, nothing is left out between two stitches side by side.
  await expect(notes).toHaveCount(0);
  await page.getByRole("tab", { name: "Body" }).click();
  await expect(notes.first()).toContainText("are not on this chart");
  expect(await notes.count()).toBeGreaterThanOrEqual(2);
});

test("closed up, a row with no stitch in the columns on screen takes no height, and the chart keeps its bottom", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  const tiles = page.locator(".chart-tiles");
  const scroller = page.locator(".chart-scroll");
  const rows = Number(await tiles.getAttribute("data-rows"));
  const gaps = () => scroller.evaluate(box => ({
    bottom: Math.round(box.scrollHeight - box.clientHeight - box.scrollTop),
    showing: Number(box.querySelector(".chart-tiles").dataset.rowsShowing),
  }));
  await expect.poll(async () => (await gaps()).bottom).toBe(0);
  // Along the bottom of the chart from its right edge, a few hundred pixels at a time, each let come to rest.
  const width = await scroller.evaluate(box => box.scrollWidth);
  const counts = [];
  for (let across = 0; across <= width; across += 300) {
    // Scrolled from the right, leftwards is less than nought.
    await scroller.evaluate((box, across) => { box.scrollLeft = -across; }, across);
    await page.waitForTimeout(250);
    const now = await gaps();
    counts.push(now.showing);
    // Rows close and open far above, over the sleeves, where the body goes on further: the box stays at the bottom.
    expect(now.bottom).toBe(0);
  }
  // Fewer rows than in all somewhere along it, and more elsewhere.
  expect(Math.min(...counts)).toBeLessThan(rows);
  expect(Math.max(...counts)).toBeGreaterThan(Math.min(...counts));
  // At rest, the sheet is as tall as the rows showing.
  const showing = Number(await tiles.getAttribute("data-rows-showing"));
  expect(await page.locator(".chart-sheets").evaluate(sheet => sheet.offsetHeight)).toBe(showing * 16);
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
