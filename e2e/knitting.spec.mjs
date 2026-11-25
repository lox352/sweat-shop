import { test, expect } from "playwright/test";
import { readFile } from "node:fs/promises";

const editions = JSON.parse(await readFile("src/library/editions/manifest.json", "utf8"));
const design = "#/sweater/hamefarin";
/** The design's last tab, where what was chosen is said and the knitting is started. */
const ready = `${design}?tab=start`;
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
  await page.goto(ready);
  await page.getByRole("button", { name: "Start knitting", exact: true }).click();
  await expect(page.getByRole("button", { name: "End of round", exact: true })).toBeVisible();
}
/** Hamefarin in a medium, as a project's choices. */
const medium = { sweaterId: "hamefarin", sizeId: "m", colourwayId: "simmer-dim" };
/** The Paul Klee Sweater in its M1, in the colours the pattern gives it. */
const klee = { sweaterId: "paul-klee", sizeId: "m1", colourwayId: "klee" };
/**
 * A sweater already knitted as far as `progress` - the id of the last stitch
 * worked - opened at its chart with the knitting showing. Knitting a yoke's
 * twenty thousand stitches a round at a time is no way to reach the divide.
 */
async function knittedTo(page, progress, choices = medium) {
  // On its size's knitting as it is now, as a project started today is: see src/library/editions.
  const edition = editions[choices.sweaterId][choices.sizeId].current;
  await page.goto("");
  await page.evaluate(({ progress, choices, edition }) => {
    const now = new Date().toISOString();
    const id = "project-1760000000000";
    localStorage.setItem(id, JSON.stringify({
      version: 1, id, ...choices, edition, progress, startedAt: now, updatedAt: now,
    }));
  }, { progress, choices, edition });
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
 * steps fall in the order of work. See src/compiler/engine/engine.ts.
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
  expect(links).toHaveLength(6);
  await page.goto(links[0]);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("tab", { name: "Start", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start knitting", exact: true })).toBeVisible();
  await expect(page.getByText("The 3D preview is unavailable.", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await knittedTo(page, yokeDone);
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await page.getByRole("link", { name: "Close the chart", exact: true }).click();
  await expect(page.getByText("The 3D preview is unavailable.", { exact: false })).toBeVisible();
  expect(physics).toEqual([]);
});

test("the 3D stage shrinks back when a phone turns from landscape to portrait", async ({ page }) => {
  await page.goto(design);
  const stage = page.locator(".stage");
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
  // The chart fills the screen; Settings is on the jumper's page, a cross away, and the chart is a tap back.
  await page.getByRole("link", { name: "Close the chart", exact: true }).click();
  const settings = await openSettings(page);
  await settings.getByRole("switch", { name: "High contrast chart" }).check();
  await settings.getByRole("switch", { name: "Written round instructions" }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("link", { name: "View chart", exact: true }).click();
  await expect(page.locator(".chart-yarn-numbers li")).not.toHaveCount(0);
  await page.getByText("Text round instructions", { exact: true }).click();
  await expect(page.getByText(/Cast on 128 in/)).toBeVisible();
  await expect(page.getByText(/^Cast on one more stitch and join in the round/)).toBeVisible();
  await page.getByLabel("Read round").selectOption("2");
  await expect(page.getByText("Yoke, round 2:", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("looked around, the chart still says where the knitting has got to, and opens there", async ({ page }) => {
  // Well up the yoke: a long way from the cast-on at the chart's bottom right.
  await knittedTo(page, 6000);
  const here = page.locator(".chart-next");
  await expect(here).toBeInViewport();
  // The knitting folded away, the stitch to be worked next is still outlined, where it was.
  const before = await here.boundingBox();
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await expect(here).toBeVisible();
  await expect(here).toBeInViewport();
  await page.waitForTimeout(300);
  const after = await here.boundingBox();
  expect(Math.abs(after.x - before.x)).toBeLessThan(2);
  expect(Math.abs(after.y - before.y)).toBeLessThan(2);
  // Closed, and opened again from the jumper's page to look around: there, not at the cast-on.
  await page.getByRole("link", { name: "Close the chart", exact: true }).click();
  await page.getByRole("link", { name: "View chart", exact: true }).click();
  await expect(page).toHaveURL(/\/chart(\?jumper=[\w-]+)?$/);
  await expect(here).toBeInViewport();
  await expect(page.getByRole("region", { name: "Your progress" }).getByRole("button", { name: "Keep knitting", exact: true })).toBeVisible();
});

test("the chart is a view over the jumper: folding the knitting away leaves you looking around it, and its cross goes back", async ({ page }) => {
  await page.goto(design);
  // The design page shows the sweater and what there is to choose, a page at a time, and ends with what was chosen and the way to start.
  await expect(page.locator(".chart-sheets")).toHaveCount(0);
  await expect(page.locator(".stage-badge")).toHaveText("M · Simmer Dim");
  await page.getByRole("tab", { name: "Start", exact: true }).click();
  await expect(page.locator(".pages-page[data-current]")).toContainText("Ready to knit");
  await expect(page).toHaveURL(/tab=start$/);
  await page.getByRole("button", { name: "Start knitting", exact: true }).click();
  await expect(page).toHaveURL(/\/project\/[^/]+\/chart\?knitting=1(&jumper=[\w-]+)?$/);
  await page.getByRole("button", { name: "End of round", exact: true }).click();
  await page.getByRole("button", { name: "Joined: carry on" }).click();

  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await expect(page).toHaveURL(/\/project\/[^/]+\/chart(\?jumper=[\w-]+)?$/);
  await expect(page.locator(".chart-sheets")).toBeVisible();
  // Not knitting, a bar under the chart says how far you have got, with the way back to the needles.
  const bar = page.getByRole("region", { name: "Your progress" });
  await expect(bar).toContainText("knitted");
  await expect(bar).toContainText("Yoke, round 2 of");
  await bar.getByRole("button", { name: "Keep knitting", exact: true }).click();
  await expect(position(page)).toContainText("Yoke, round 2, stitch 1.");

  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await page.getByRole("link", { name: "Close the chart", exact: true }).click();
  await expect(page).toHaveURL(/\/project\/[^/?]+(\?jumper=[\w-]+)?$/);
  // Its Progress shows a window of the chart at the needle, which opens the chart to look around.
  await expect(page.getByRole("link", { name: "View chart", exact: true })).toBeVisible();
  // The jumper's page: the jumper on its stage, and under it its tabs, each a few pages side by side; the way back to the needles is on the first.
  await expect(page.getByRole("tab", { name: "Progress", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".pages-page[data-current]")).toContainText("Where you are");
  await expect(page.locator(".stage-badge")).toHaveText("Simmer Dim");
  // A row of its wool list opens that wool to be changed, in a card up from the foot: the jumper still on its stage over it, and the chart in the card. Its cross comes back to the list.
  await page.getByRole("tab", { name: "Wool", exact: true }).click();
  await page.locator(".wool-row").first().click();
  const customise = page.getByRole("dialog", { name: "Customise the colours" });
  // That wool's shades are a second card over the chart's; its cross goes down to the chart, and Done back to the list.
  const shades = page.getByRole("dialog", { name: /^Wool for / });
  await expect(shades).toBeVisible();
  await expect(page.locator(".stage .sweater-canvas")).toBeVisible();
  await shades.getByRole("button", { name: "Close", exact: true }).click();
  await expect(shades).toHaveCount(0);
  await customise.getByRole("button", { name: "Done", exact: true }).click();
  await expect(customise).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Wool", exact: true })).toHaveAttribute("aria-selected", "true");
  // After its list, the design's colourways, a page a group; and at the foot of them all, the one bar for the colourway's wools, which is down again once the tab is left.
  await page.getByRole("tab", { name: "Colourways", exact: true }).click();
  await expect(page.locator(".pages-page[data-current] .colourway-option.is-chosen")).toHaveText("Simmer Dim");
  await expect(page.locator(".pages-foot").getByRole("button", { name: /^Change wool/ })).toBeVisible();
  await page.getByRole("tab", { name: "Progress", exact: true }).click();
  await expect(page.locator(".pages-foot")).toBeHidden();
  await page.locator(".pages-page[data-current]").getByRole("link", { name: "Keep knitting", exact: true }).click();
  await expect(position(page)).toContainText("Yoke, round 2, stitch 1.");

  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await page.getByRole("link", { name: "Close the chart", exact: true }).click();
  await page.getByRole("link", { name: "Sweat Shop", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sweat Shop", level: 1, exact: true })).toBeVisible();
});

/*
 * And in a window taller than either device's: closing the knitting there,
 * rounds out of view closing up slid the stitch about to be worked 5px, which
 * the fonts on CI's runners alone were enough to bring about.
 */
for (const taller of [false, true]) {
  test(`knitting fills the screen, says how to work the round's stitches, and closing it leaves the chart still${taller ? ", in a taller window" : ""}`, async ({ page }, info) => {
    test.skip(taller && info.project.use.isMobile === true, "a phone's window is the phone's");
    // The chart's views, to ask where a stitch is drawn: see TileView.probe.
    await page.addInitScript(() => {
      window.__chartViews = [];
    });
    if (taller) await page.setViewportSize({ ...page.viewportSize(), height: 840 });
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

    /*
     * Where the stitch about to be worked is on screen. Not where the sheet's
     * edge is: rounds out of view closing up above as the box grows move that
     * edge, and nothing the knitter can see.
     */
    const id = await page.evaluate(() => window.__chartViews.at(-1).probe().follow);
    expect(id).toBeGreaterThan(0);
    const at = () => page.locator(".chart-sheets").evaluate((sheet, id) => {
      const box = sheet.getBoundingClientRect();
      const place = window.__chartViews.at(-1).place(id);
      return { right: box.left + place.x, top: box.top + place.y };
    }, id);
    // Where it is once it has stopped moving, and where it was on the way, to tell of if it moved.
    const still = async () => {
      const seen = [await at()];
      for (let k = 0; k < 30; k++) {
        await page.waitForTimeout(100);
        seen.push(await at());
        const [a, b, c] = seen.slice(-3);
        if (c && a.top === c.top && b.top === c.top && a.right === c.right && b.right === c.right) break;
      }
      return { at: seen[seen.length - 1], seen: JSON.stringify(seen) };
    };
    const before = await still();
    await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
    await expect(page.getByRole("region", { name: "Your progress" })).toBeVisible();
    // At rest, every round and column that is going to close up or open has.
    await page.waitForTimeout(400);
    const after = await still();
    const moved = `before ${before.seen}, after ${after.seen}`;
    expect(Math.abs(after.at.top - before.at.top), moved).toBeLessThan(2);
    expect(Math.abs(after.at.right - before.at.right), moved).toBeLessThan(2);
  });
}

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
  // Settings is on the jumper's page; the chart is a tap back from it.
  await page.getByRole("link", { name: "Close the chart", exact: true }).click();
  const settings = await openSettings(page);
  await settings.getByRole("switch", { name: "Written round instructions" }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("link", { name: "View chart", exact: true }).click();
  // Four views of the chart, the body's the one being knitted: its underarms, without the sleeves: a round of its 296 stitches wide.
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveText(["From the neck", "Bodyknitting", "Right sleeve", "Left sleeve"]);
  await expect(page.getByRole("tab", { selected: true })).toHaveText("Bodyknitting");
  await expect(page.getByRole("img", { name: /^The chart: 296 columns and 193 rows\./ })).toBeVisible();
  // From the neck, the yoke and above it everything but the underarms: the body and the sleeves beside it.
  await page.getByRole("tab", { name: "From the neck" }).click();
  await expect(page.getByRole("img", { name: /^The chart: 436 columns and 219 rows\./ })).toBeVisible();
  await page.getByRole("tab", { name: "Body" }).click();
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
  // A design opens on what it is: its own story, the first of its tabs.
  await page.goto("#/sweater/paul-klee");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Paul Klee Sweater");
  const panel = (name) => page.getByRole("tablist", { name: "This design" }).getByRole("tab", { name, exact: true });
  const shownPage = page.locator(".pages-page[data-current]");
  await expect(page.getByRole("tablist", { name: "This design" }).getByRole("tab")).toHaveText(["About", "Size", "Colours", "Start"]);
  await expect(panel("About")).toHaveAttribute("aria-selected", "true");
  await expect(shownPage.getByText("© Midori Hirose 2022", { exact: false })).toBeVisible();
  // Starting is a page of its own, with nothing after it.
  await panel("Start").click();
  await expect(page.getByRole("tablist", { name: "Start: its pages" }).getByRole("tab")).toHaveCount(1);
  // The jumper stays on screen, and under it a page at a time. Four sizes for children, by age, and twelve for adults, by the bust they fit.
  await panel("Size").click();
  const sizes = page.locator(".size-option");
  await expect(sizes).toHaveCount(16);
  await expect(sizes.first()).toContainText("Kids 1");
  await expect(sizes.first()).toContainText("2–3 years");
  await expect(sizes.nth(4)).toContainText("to fit 71cm");
  // Only the colours a size knits: an L's eleven bands, a child's seven. The last tab says what Start would start, and the jumper's badge which size it is.
  const badge = page.locator(".stage-badge");
  const chosen = page.locator(".ready-choices");
  await expect(badge).toContainText("L ·");
  await sizes.first().click();
  await expect(badge).toContainText("Kids 1 ·");
  await panel("Start").click();
  await expect(chosen).toContainText("Kids 1");
  await expect(chosen).toContainText("15 shades");
  // Any of them can be changed, each on its own, in a card up from the foot of the colours: the chart and the wools in it, the jumper still over it.
  await panel("Colours").click();
  await page.locator(".pages-foot").getByRole("button", { name: /^Change wool/ }).click();
  const customise = page.getByRole("dialog", { name: "Customise the colours" });
  await expect(page.locator(".stage .sweater-canvas")).toBeVisible();
  await expect(customise.locator(".customise-wool")).toHaveCount(15);
  // A stitch tapped on the chart chooses its wool, and its shades come up in a second card over the whole of the first, the jumper still on its stage over it.
  const chart = customise.locator(".chart-scroll");
  await expect(customise.locator(".chart-sheets")).toBeVisible();
  const box = await chart.boundingBox();
  await chart.click({ position: { x: box.width / 2, y: box.height - 40 } });
  const sheet = page.getByRole("dialog", { name: /^Wool for / });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveClass(/\bsheet\b/);
  await expect(sheet).toContainText("Tap a shade to try it on the jumper.");
  // A shade is a tile of its own colour, named. Tapped, it is only tried: nothing is the knitter's own until it is taken.
  await sheet.getByLabel("Search the wool").fill("Scarlet");
  await sheet.getByRole("button", { name: /^Scarlet .*Spindrift/ }).click();
  await expect(badge).not.toContainText("Your own, from");
  // Let go, nothing is changed.
  await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(customise.getByRole("button", { name: /^Scarlet/ })).toHaveCount(0);
  // Tried again and taken, the card goes down to the chart and the strip, the wool among the others; and Done goes back to the design, the colourway now the knitter's own.
  await customise.locator(".customise-wool").first().click();
  await sheet.getByLabel("Search the wool").fill("Scarlet");
  await sheet.getByRole("button", { name: /^Scarlet .*Spindrift/ }).click();
  await sheet.getByRole("button", { name: /^Use Scarlet/ }).click();
  await expect(sheet).toHaveCount(0);
  await expect(customise.locator(".customise-wool")).toHaveCount(15);
  await expect(customise.getByRole("button", { name: /^Scarlet/ })).toHaveCount(1);
  await customise.getByRole("button", { name: "Done", exact: true }).click();
  await expect(customise).toHaveCount(0);
  await expect(page).toHaveURL(/tab=colours$/);
  await expect(badge).toContainText("Your own, from");
  await expect(page.locator(".pages-foot").getByRole("button", { name: /^Change wool/ })).toContainText("1 your own");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("Each Year Once knits every hat from 2014 to 2026 once, the yoke's first, the sleeves' last", async ({ page }) => {
  await page.goto("#/sweater/wool-week-strips-once-oldest?tab=start");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Each Year Once, oldest at the neck");
  await page.getByRole("tablist", { name: "This design" }).getByRole("tab", { name: "About", exact: true }).click();
  await expect(page.locator(".pages-page[data-current]").getByText("Hazel Tindall", { exact: false }).first()).toBeVisible();
  await page.getByRole("tablist", { name: "This design" }).getByRole("tab", { name: "Size", exact: true }).click();
  await expect(page.locator(".size-option")).toHaveCount(8);
  // Its colourways a group a page, the pages named over them, the one in use marked.
  await page.getByRole("tablist", { name: "This design" }).getByRole("tab", { name: "Colours", exact: true }).click();
  const groups = page.getByRole("tablist", { name: "Colours: its pages" });
  const shownPage = page.locator(".pages-page[data-current]");
  await expect(groups.getByRole("tab")).toHaveCount(7);
  await expect(groups.getByRole("tab", { selected: true })).toHaveAccessibleName("Shetland and Fair Isle");
  await expect(shownPage.getByRole("heading", { level: 2 })).toHaveText("Shetland and Fair Isle");
  await expect(shownPage.locator(".colourway-option")).toHaveCount(8);
  await expect(shownPage.locator(".is-chosen")).toContainText("Shetland naturals, all dark");
  await groups.getByRole("tab", { name: "Many colours", exact: true }).click();
  await expect(shownPage.locator(".colourway-option")).toHaveCount(13);
  // On from the colours' last page is the next tab's first: the whole design is one row.
  const track = page.locator(".pages-track");
  // Once the row has come to rest on the last of the colours - still for a fifth of a second, to a tenth of a page, a page not always being a whole number of pixels wide.
  const atRest = () =>
    track.evaluate(async (row) => {
      const was = row.scrollLeft;
      await new Promise((done) => setTimeout(done, 200));
      return row.scrollLeft === was ? Math.round((was / row.clientWidth) * 10) / 10 : -1;
    });
  // The row: what the design is, a size's three pages, the colours' seven, and starting.
  await expect.poll(atRest).toBe(10);
  await track.evaluate((row) => row.scrollTo({ left: 11 * row.clientWidth, behavior: "instant" }));
  await expect(page.getByRole("tablist", { name: "This design" }).getByRole("tab", { selected: true })).toHaveText("Start");
  await page.getByRole("tablist", { name: "This design" }).getByRole("tab", { name: "Colours", exact: true }).click();
  await expect(shownPage.getByRole("heading", { level: 2 })).toHaveText("Shetland and Fair Isle");
  // What is done to the colourway chosen is no one page's: a bar at the foot of the colours, in the same place whichever of their pages is shown, and down again when their tab is left.
  const foot = page.locator(".pages-foot");
  await expect(foot).toBeVisible();
  // Where it is, from the left and the foot of the room the pages have: come up, it is at both.
  const footAt = () =>
    foot.evaluate((bar) => {
      const [own, room] = [bar.getBoundingClientRect(), bar.parentElement.getBoundingClientRect()];
      return [Math.round(own.left - room.left), Math.round(room.bottom - own.bottom)];
    });
  await expect.poll(footAt).toEqual([0, 0]);
  await page.getByRole("tablist", { name: "Colours: its pages" }).getByRole("tab").nth(1).click();
  await expect(shownPage.getByRole("heading", { level: 2 })).not.toHaveText("Shetland and Fair Isle");
  await expect(foot).toBeVisible();
  expect(await footAt()).toEqual([0, 0]);
  expect(await page.locator(".pages-foot").count()).toBe(1);
  await page.getByRole("tablist", { name: "This design" }).getByRole("tab", { name: "Size", exact: true }).click();
  await expect(foot).toBeHidden();
  await page.getByRole("tablist", { name: "This design" }).getByRole("tab", { name: "Colours", exact: true }).click();
  await expect(foot).toBeVisible();
  // The trim is the chosen colourway's, in a card up from the foot: the darkest yarn of the hats beside each part to begin with, or any yarn of the palette.
  await foot.getByRole("button", { name: /^Trim/ }).click();
  const trim = page.getByRole("dialog", { name: "Trim" }).getByRole("group", { name: "Trim" });
  await expect(trim.getByRole("button", { pressed: true })).toHaveAccessibleName("Darkest beside each");
  await trim.getByRole("button", { name: "Moorit" }).click();
  await expect(trim.getByRole("button", { pressed: true })).toHaveAccessibleName("Moorit");
  await expect(foot.getByRole("button", { name: /^Trim/ })).toContainText("Moorit");
  await trim.getByRole("button", { name: "Darkest beside each" }).click();
  await expect(trim.getByRole("button", { pressed: true })).toHaveAccessibleName("Darkest beside each");
  await page.getByRole("dialog", { name: "Trim" }).getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Trim" })).toHaveCount(0);
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
  // And if not, where it is, and whether the chart is still on its way there, for the report.
  const whereNext = () => page.evaluate(() => {
    const next = document.querySelector(".chart-next").getBoundingClientRect();
    const view = window.__chartViews?.at(-1)?.probe();
    const box = document.querySelector(".chart-scroll");
    return { right: next.right, sheet: document.querySelector(".chart-sheets").getBoundingClientRect().right, gliding: box.dataset.gliding !== undefined, scroll: [box.scrollLeft, box.scrollTop, box.scrollWidth, box.scrollHeight], shift: view?.shift, moving: view?.moving, target: view?.target, follow: view?.follow };
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
  // Polled with where it is, so a failure says where it was last.
  await expect.poll(async () => ({ atEdge: await edge(), ...(await whereNext()) })).toMatchObject({ atEdge: true });
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

test("scrolled away from the stitch to look along the chart, a button points the way back to it and goes there, knitting nothing", async ({ page }) => {
  await knittedTo(page, 6000);
  const next = page.locator(".chart-next");
  const back = page.getByRole("button", { name: "Back to your stitch" });
  const scroll = (by) => page.locator(".chart-scroll").evaluate((box, by) => box.scrollBy(by.left ?? 0, by.top ?? 0), by);
  // The box come to rest, its scroll the same for a third of a second: a scroll set mid-glide would be glided over.
  const rest = () => page.locator(".chart-scroll").evaluate((box) => new Promise((done) => {
    let last = "";
    let since = 0;
    const look = (now) => {
      const at = `${box.scrollLeft},${box.scrollTop}`;
      if (at !== last) [last, since] = [at, now];
      if (now - since >= 300) done();
      else requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  }));
  /** How far round the arrow is from the way the stitch is, from the middle of the chart's box, in degrees. */
  const offCourse = () => page.evaluate(() => {
    const box = document.querySelector(".chart-scroll").getBoundingClientRect();
    const next = document.querySelector(".chart-next").getBoundingClientRect();
    const way = (Math.atan2(next.top + next.height / 2 - (box.top + box.height / 2), next.left + next.width / 2 - (box.left + box.width / 2)) * 180) / Math.PI;
    const arrow = Number(document.querySelector(".chart-back svg").style.transform.match(/rotate\((-?[\d.]+)deg\)/)[1]);
    return Math.abs(((arrow - way + 540) % 360) - 180);
  });
  await expect(next).toBeInViewport();
  // The knitting brings the stitch into view by itself: there is nothing to go back to.
  await rest();
  await expect(back).toHaveCount(0);
  const where = await position(page).textContent();

  // Up the chart, to see what is coming: the stitch is below.
  await scroll({ top: -600 });
  await expect(back).toBeVisible();
  expect(await offCourse()).toBeLessThanOrEqual(30);
  // Only while the chart is still: faded out within a few frames of it moving, and back once it rests.
  const shownMoving = await page.locator(".chart-scroll").evaluate(async (box) => {
    const frame = () => new Promise((done) => requestAnimationFrame(done));
    const seen = () => {
      const button = document.querySelector(".chart-back");
      if (!button) return false;
      const style = getComputedStyle(button);
      return style.visibility !== "hidden" && Number(style.opacity) > 0.1;
    };
    let shown = 0;
    for (let step = 0; step < 30; step++) {
      box.scrollBy(0, -3);
      await frame();
      if (step >= 12 && seen()) shown++;
    }
    return shown;
  });
  expect(shownMoving).toBe(0);
  await expect(back).toBeVisible();
  // And along it to the left too.
  await scroll({ left: -800 });
  await expect.poll(offCourse).toBeLessThanOrEqual(30);
  await back.click();
  await expect(back).toHaveCount(0);
  await rest();
  await expect(next).toBeInViewport();
  // Only looked at again, not knitted.
  await expect(position(page)).toHaveText(where);

  // Scrolled back to it by hand, the way back goes as it comes into view.
  await scroll({ top: -600 });
  await expect(back).toBeVisible();
  await scroll({ top: 600 });
  await expect(back).toHaveCount(0);
  // And knitting on from out of sight goes to the next stitch, the way back with it.
  await scroll({ top: -600 });
  await expect(back).toBeVisible();
  await page.locator(".knitting-panel .btn-primary").first().click();
  await expect(back).toHaveCount(0);
  await rest();
  await expect(next).toBeInViewport();
  await expect(position(page)).not.toHaveText(where);
});

test("scrolled along a round and up the chart, the round numbers stay down the box's right-hand edge, each beside its row, shown only while the chart is still", async ({ page }) => {
  // The chart's own view, to read where it draws each row: see TileView.probe.
  await page.addInitScript(() => {
    window.__chartViews = [];
  });
  await knittedTo(page, 6000);
  const scroller = page.locator(".chart-scroll");
  /** The numbers in sight: each one's way from its row's middle, as the tiles draw it, and from the box's right-hand edge, inside its padding. */
  const numbers = () => page.evaluate(() => {
    const view = window.__chartViews.at(-1);
    const box = document.querySelector(".chart-scroll");
    const edge = box.getBoundingClientRect().right - parseFloat(getComputedStyle(box).paddingRight);
    const { top, bottom } = box.getBoundingClientRect();
    const layer = document.querySelector(".chart-layer").getBoundingClientRect();
    const { start, size } = view.rows.places;
    return [...document.querySelectorAll(".chart-ruler-rows > span")]
      .map((number) => ({ row: Number(number.textContent), at: number.getBoundingClientRect() }))
      .filter(({ at }) => at.top >= top && at.bottom <= bottom)
      .map(({ row, at }) => ({
        row,
        down: Math.round(at.top + at.height / 2 - (layer.top + start[row] + size[row] / 2)),
        fromEdge: Math.round(edge - at.right),
      }));
  });
  const rest = () => page.waitForTimeout(600);
  await expect.poll(async () => (await numbers()).length).toBeGreaterThan(3);
  await rest();
  const check = async () => {
    const shown = await numbers();
    expect(shown.length).toBeGreaterThan(3);
    // Every fifth round, at least, each beside its own row and inside the box, at its right-hand edge.
    for (const { row, down, fromEdge } of shown) {
      expect(Math.abs(down), `round ${row}`).toBeLessThanOrEqual(1);
      expect(fromEdge, `round ${row}`).toBeGreaterThanOrEqual(0);
      expect(fromEdge, `round ${row}`).toBeLessThan(36);
    }
    const rows = shown.map(({ row }) => row).sort((a, b) => a - b);
    expect(rows.filter((row) => row % 5 === 0).length).toBeGreaterThanOrEqual(rows.length - 2);
    return rows;
  };
  const here = await check();
  /** How much the numbers show: their strip's opacity, as drawn now. */
  const showing = () => page.locator(".chart-ruler").evaluate((strip) => Number(getComputedStyle(strip).opacity));
  await expect.poll(showing).toBe(1);
  // Only while the chart is still: faded out within a few frames of it moving, and back once it rests.
  const shownMoving = await scroller.evaluate(async (box) => {
    const frame = () => new Promise((done) => requestAnimationFrame(done));
    const strip = document.querySelector(".chart-ruler");
    let shown = 0;
    for (let step = 0; step < 30; step++) {
      box.scrollBy(0, -3);
      await frame();
      if (step >= 12 && Number(getComputedStyle(strip).opacity) > 0.1) shown++;
    }
    return shown;
  });
  expect(shownMoving).toBe(0);
  await expect.poll(showing).toBe(1);
  // Along the round to its far end, and up the chart: the gutter beside column 1 is out of sight, and the numbers are not.
  await scroller.evaluate((box) => box.scrollBy(-100000, -300));
  await rest();
  const there = await check();
  expect(Math.max(...there)).toBeGreaterThan(Math.max(...here));
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

test("a stitch tapped says where it is and how to carry on from it, however little room there is round it, and the chart stays put", async ({ page }) => {
  // On a short row from the wrong side: every stitch the chart shows from the right side is hatched, and says why at length.
  await knittedTo(page, 1800);
  await expect(position(page)).toContainText("short row 4, wrong side");
  const scroller = page.locator(".chart-scroll");
  const box = await scroller.boundingBox();
  const picker = page.locator(".stitch-picker");
  await expect(page.locator(".chart-next")).toBeInViewport();
  const next = await page.locator(".chart-next").boundingBox();
  const cell = next.width - 2;
  // Stitches up the column of the one to be worked - in a yoke a column goes on up - from near the top of the box to its middle.
  for (const down of [0.15, 0.35, 0.55]) {
    const scrolled = await scroller.evaluate((box) => [box.scrollLeft, box.scrollTop]);
    const up = Math.max(1, Math.round((next.y + next.height / 2 - (box.y + box.height * down)) / cell));
    await page.mouse.click(next.x + next.width / 2, next.y + next.height / 2 - up * cell);
    await expect(picker).toBeVisible();
    // Its head, the round and stitch, and its way to carry on, both in the chart's box.
    const seen = await picker.evaluate((bubble) => {
      const box = bubble.closest(".chart-scroll").getBoundingClientRect();
      const inBox = (element) => {
        const at = element.getBoundingClientRect();
        return at.top >= box.top - 1 && at.bottom <= box.bottom + 1;
      };
      return { head: inBox(bubble.querySelector(".stitch-picker-head")), carryOn: inBox(bubble.querySelector(".btn-primary")) };
    });
    expect(seen, `tapped ${down * 100}% down`).toEqual({ head: true, carryOn: true });
    await expect(picker.getByRole("button", { name: /^(Knit up to|Go back to) here$/ })).toBeFocused();
    // Shown without scrolling the chart to it.
    expect(await scroller.evaluate((box) => [box.scrollLeft, box.scrollTop])).toEqual(scrolled);
    await page.keyboard.press("Escape");
    await expect(picker).toHaveCount(0);
  }
});

test("a stitch picked stays outlined, its note beside it, as the chart slides with its scroll", async ({ page }) => {
  // The chart's views, to ask where a stitch is drawn: see TileView.probe.
  await page.addInitScript(() => {
    window.__chartViews = [];
  });
  await knittedTo(page, yokeLastRound - 1);
  await tapBeside(page, 3);
  const picker = page.getByRole("dialog", { name: "Yoke, round 75, stitch 4" });
  await expect(picker).toBeVisible();
  // The knitting closed, so that the box is not sent back to the stitch to be worked.
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await expect(picker).toBeVisible();
  await page.waitForTimeout(600);
  /*
   * Up the yoke, a frame at a time: its columns closing up as its rounds
   * narrow towards the neck, the tiles slide with the box's scroll until it
   * comes to rest. Every frame, the outline is where the stitch is drawn,
   * and the note beside it - as far as keeping it on the sheet allows.
   */
  const drift = await page.locator(".chart-scroll").evaluate(async (box) => {
    const view = window.__chartViews.at(-1);
    const outline = () => document.querySelector(".chart-picked").getBoundingClientRect();
    const note = () => document.querySelector(".stitch-picker").getBoundingClientRect();
    const at = outline();
    const id = view.stitchAt(at.left + at.width / 2, at.top + at.height / 2);
    const gap = { x: note().left - at.left, y: note().top - at.top };
    let [most, apart] = [0, 0];
    for (let frame = 0; frame < 40; frame++) {
      box.scrollBy(-12, -24);
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const sheet = document.querySelector(".chart-sheets").getBoundingClientRect();
      const place = view.place(id);
      if (!place) continue;
      const now = outline();
      const [x, y] = [sheet.left + place.x - 2, sheet.top + place.y - 2];
      most = Math.max(most, Math.abs(now.left - x), Math.abs(now.top - y));
      apart = Math.max(apart, Math.abs(note().left - now.left - gap.x), Math.abs(note().top - now.top - gap.y));
    }
    return { most, apart };
  });
  expect(drift.most).toBeLessThan(1.5);
  expect(drift.apart).toBeLessThan(16);
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

test("the chart opens at the size it was last zoomed to, though not zoomed right out", async ({ page }) => {
  await knittedTo(page, 3000);
  const chart = page.getByRole("region", { name: /Scrollable knitting chart/ });
  const cell = () => page.locator(".chart-next").evaluate((mark) => Math.round(mark.getBoundingClientRect().width) - 2);
  await expect.poll(cell).toBe(16);
  await chart.press("+");
  await chart.press("+");
  await expect.poll(cell).toBe(24);
  // Closed and opened again: at the size it was left at.
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await page.getByRole("link", { name: "Close the chart", exact: true }).click();
  await page.locator(".pages-page[data-current]").getByRole("link", { name: "Keep knitting", exact: true }).click();
  await expect.poll(cell).toBe(24);
  // Zoomed out past a stitch drawn whole is a look at the whole round: opened again, it is at the last size it was knitted from.
  for (let press = 0; press < 6; press++) await chart.press("-");
  await expect.poll(cell).toBeLessThan(8);
  await page.reload();
  await expect.poll(cell).toBe(8);
});

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
  // Each Year Once's neck, swiped across and a little up the yoke: its make-ones open columns on the way.
  await page.goto("#/sweater/wool-week-strips-once-oldest?tab=start");
  await page.getByRole("button", { name: "Start knitting", exact: true }).click();
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
    // A long swipe left, a little every frame, to the end, drifting up.
    for (let step = 0; step < 600; step++) {
      const was = box.scrollLeft;
      box.scrollLeft -= 20;
      box.scrollTop -= 1;
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
  await page.goto("#/sweater/wool-week-strips-once-oldest?tab=start");
  await page.getByRole("button", { name: "Start knitting", exact: true }).click();
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
  // Away from the chart's right-hand edge, where it opens: columns that close to the right of a stitch as fewer
  // rows show can only be made up by scrolling that way, and at the edge there is nowhere to scroll to.
  await page.locator(".chart-scroll").evaluate((scroller) => scroller.scrollBy(-600, 0));
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
  // The chart fills the screen: a screen tall enough that, zoomed right out, every row is in view, and so no column closed for want of one.
  await page.setViewportSize({ width: page.viewportSize().width, height: 2400 });
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
  // And back in by no more steps, to the size it began at: the room left of the chart for a join's arrow is half a stitch.
  const room = () => page.locator(".chart-sheets").evaluate((sheet) => sheet.style.marginLeft);
  for (let press = 0; press < smaller && (await room()) !== "8px"; press++) await chart.press("+");
  await expect.poll(room).toBe("8px");
  expect(await wide()).toBeGreaterThan(0);
});

test("between its sleeves going on hold, the chart is what is left on the needles: the first sleeve gone, the second still there", async ({ page }) => {
  // Each Year Once in a medium: its right sleeve on hold at 29624, its left at 29795.
  const sampler = { sweaterId: "wool-week-strips-once-oldest", sizeId: "m", colourwayId: "early-light" };
  const chartPage = page.locator(".chart-page");
  await knittedTo(page, 29500, sampler);
  await expect(chartPage).toHaveAttribute("data-view", "neck");
  await knittedTo(page, 29700, sampler);
  await expect(chartPage).toHaveAttribute("data-view", "remaining-29624");
  // The tabs are the finished pattern's views: the body's is the one the knitting is in, and shows it as it stands.
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await expect(page.getByRole("tab")).toHaveCount(4);
  await expect(page.getByRole("tab", { name: /^Body/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /^Body/ })).toContainText("knitting");
  await expect(chartPage).toHaveAttribute("data-view", "remaining-29624");
  // Wider than the body's, by the second sleeve's stitches.
  const columns = () => page.locator(".chart-tiles").getAttribute("data-columns");
  const between = Number(await columns());
  await knittedTo(page, 29800, sampler);
  await expect(chartPage).toHaveAttribute("data-view", "remaining-29795");
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

test("closed up, every row takes its height wherever the box is along the chart, and the chart keeps its bottom", async ({ page }) => {
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
  for (let across = 0; across <= width; across += 300) {
    // Scrolled from the right, leftwards is less than nought.
    await scroller.evaluate((box, across) => { box.scrollLeft = -across; }, across);
    // Over the sleeves, where the body goes on further, its rounds are paper: every row shows, and the box stays at the bottom.
    await expect.poll(gaps).toEqual({ bottom: 0, showing: rows });
  }
  expect(await page.locator(".chart-sheets").evaluate(sheet => sheet.offsetHeight)).toBe(rows * 16);
});

test("closed up, along the top of the chart onto a sleeve and back, nothing in the box moves up or down", async ({ page }) => {
  // The chart's views, to ask where a stitch is drawn: see TileView.probe.
  await page.addInitScript(() => {
    window.__chartViews = [];
  });
  await knittedTo(page, 0, { sweaterId: "wool-week-strips-once-oldest", sizeId: "m", colourwayId: "early-light" });
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  /*
   * At the top of the chart, from its right-hand edge leftwards over the body
   * and on over a sleeve, whose rounds go on past the body's, and back, a
   * frame at a time: the sleeve's rounds are paper over the body, there all
   * the way. Every frame, a stitch in the box is where it was up and down,
   * the box scrolled only across.
   */
  const { most, showing, rows } = await page.locator(".chart-scroll").evaluate(async (box) => {
    const frame = () => new Promise((done) => requestAnimationFrame(done));
    const rest = () => new Promise((done) => setTimeout(done, 600));
    const view = window.__chartViews.at(-1);
    const tiles = box.querySelector(".chart-tiles");
    box.scrollLeft = 0;
    box.scrollTop = 0;
    await rest();
    const rect = box.getBoundingClientRect();
    const sheet = () => document.querySelector(".chart-sheets").getBoundingClientRect();
    // A stitch in the box, nearest its middle, and how far down the screen it is.
    const find = () => {
      for (let dx = 0; dx < rect.width / 2; dx += 8) {
        for (const x of [rect.left + rect.width / 2 - dx, rect.left + rect.width / 2 + dx]) {
          const id = view.stitchAt(x, rect.top + rect.height / 2);
          if (id !== undefined) return id;
        }
      }
      return undefined;
    };
    const down = (id) => {
      const cell = id === undefined ? undefined : view.cellOnSheet(id);
      const x = cell && sheet().left + cell.x;
      return cell && x > rect.left && x < rect.right ? sheet().top + cell.y : undefined;
    };
    const showing = new Set();
    let most = 0;
    let id = find();
    let was = down(id);
    for (const way of [-1, 1]) {
      for (let step = 0; step < 220; step++) {
        box.scrollLeft += way * 14;
        await frame();
        showing.add(Number(tiles.dataset.rowsShowing));
        const now = down(id);
        if (now !== undefined && was !== undefined) most = Math.max(most, Math.abs(now - was));
        if (now === undefined) id = find();
        was = down(id);
      }
      await rest();
      was = down(id);
    }
    return { most, showing: [...showing], rows: Number(tiles.dataset.rows) };
  });
  expect(showing).toEqual([rows]);
  expect(most).toBeLessThan(1);
});

test("backup restores copies and rename/delete require their dialogs", async ({ page }) => {
  await start(page);
  // The chart fills the screen; Settings is on the jumper's page, a cross away.
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await page.getByRole("link", { name: "Close the chart", exact: true }).click();
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
  // Each has a card, which opens its jumper: where it is renamed, and deleted only after asking.
  await expect(page.locator(".project-card")).toHaveCount(2);
  await page.locator(".project-card-body").first().click();
  await page.getByRole("tab", { name: "This jumper", exact: true }).click();
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByRole("textbox", { name: "Name this project" }).fill("Regression test jumper");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Regression test jumper", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("link", { name: "Sweat Shop", exact: true }).click();
  await expect(page.locator(".project-card")).toHaveCount(2);
  await expect(page.getByText("Regression test jumper", { exact: true })).toBeVisible();
  // And from its card on the home page, without opening it: renamed, and deleted only after asking.
  await page.getByRole("button", { name: "Rename Regression test jumper", exact: true }).click();
  await page.getByRole("textbox", { name: "Name this project" }).fill("Renamed from home");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Renamed from home", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete Renamed from home", exact: true }).click();
  await page.getByRole("dialog", { name: "Delete Renamed from home?" }).getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".project-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Delete Renamed from home", exact: true }).click();
  await page.getByRole("dialog", { name: "Delete Renamed from home?" }).getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator(".project-card")).toHaveCount(1);
  await expect(page.getByText("Renamed from home", { exact: true })).toHaveCount(0);
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
  await page.getByRole("link", { name: "Close the chart", exact: true }).click();
  // A jumper's page does not say so, as the home page does: it is made ready all the same.
  await expect(page.getByText(/Ready for offline knitting/)).toBeAttached({ timeout: 45_000 });
  await context.setOffline(true);
  await page.reload();
  await page.locator(".pages-page[data-current]").getByRole("link", { name: "Start knitting", exact: true }).click();
  await page.getByRole("button", { name: "End of round", exact: true }).click();
  const progress = await position(page).textContent();
  await page.reload();
  await expect(position(page)).toHaveText(progress);
});

test("a pinch that pans as it zooms leaves the stitch under the fingers where they lift", async ({ page }) => {
  // Zoomed in on the yoke of a large sampler, part way along a round: columns close and open as the box pans.
  await knittedTo(page, 9922, { sweaterId: "wool-week-strips-once-oldest", sizeId: "l", colourwayId: "naturals-dark" });
  await expect(page.locator(".chart-next")).toBeInViewport();
  await page.waitForTimeout(800);
  const outline = () => page.locator(".chart-next").evaluate((mark) => {
    const r = mark.getBoundingClientRect();
    return [r.left, r.top];
  });
  // Two fingers spread a fifth apart, their middle moved down and left, the box panned under them as Safari pans it.
  await page.locator(".chart-scroll").evaluate(async (box) => {
    const r = box.getBoundingClientRect();
    const [x, y] = [r.left + r.width / 2, r.top + r.height / 2];
    const at = (k) => [-1, 1].map((side, identifier) => new Touch({
      identifier, target: box, clientX: x - 80 * k + side * 60 * (1 + 0.2 * k), clientY: y - 60 * k,
    }));
    const send = (type, touches, changed = touches) =>
      box.dispatchEvent(new TouchEvent(type, { touches, targetTouches: touches, changedTouches: changed, bubbles: true, cancelable: true }));
    const frame = () => new Promise((done) => requestAnimationFrame(done));
    send("touchstart", at(0));
    for (let step = 1; step <= 20; step++) {
      await frame();
      send("touchmove", at(step / 20));
      box.scrollBy(80 / 20, 60 / 20);
    }
    await frame();
    window.__lifted = (() => { const m = document.querySelector(".chart-next").getBoundingClientRect(); return [m.left, m.top]; })();
    send("touchend", [], at(1));
  });
  const lifted = await page.evaluate(() => window.__lifted);
  await page.waitForTimeout(1200);
  const settled = await outline();
  expect(Math.abs(settled[0] - lifted[0])).toBeLessThan(20);
  expect(Math.abs(settled[1] - lifted[1])).toBeLessThan(20);
});

test("a tab tapped and left at once for the chart: on a slow device the knitter still gets where they were going", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("#/sweater/wool-week-strips-lined-oldest?size=m");
  await expect(page.locator(".size-option").first()).toBeAttached({ timeout: 30_000 });
  // A device slow enough that the chart is not up before the tab's address would be written: written then, it brought the knitter back to the design.
  const device = await page.context().newCDPSession(page);
  await device.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await page.getByRole("tab", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Start knitting", exact: true }).click();
  await expect(page.locator(".knitting-panel")).toContainText(/of \d+ stitches/, { timeout: 60_000 });
  // Long enough for the tab's address to have been written, were it going to be.
  await page.waitForTimeout(2000);
  await expect(page).toHaveURL(/#\/project\/[^/]+\/chart/);
  await expect(page.locator(".knitting-panel")).toBeVisible();
});
