import { test, expect } from "playwright/test";
import { readFile } from "node:fs/promises";

const pattern = "#/hat/sww18-merrie-dancers-toorie";
const position = page => page.locator(".knitting-panel [role=status]");
/**
 * Work to the end of `count` rounds, taking any step on the way - joining the
 * round, changing needles - as asked.
 */
async function workRounds(page, count) {
  for (let done = 0; done < count;) {
    const step = page.getByRole("button", { name: /^(Joined|Changed): carry on$/ });
    if (await step.isVisible()) await step.click();
    else {
      await page.getByRole("button", { name: "End of round", exact: true }).click();
      done++;
    }
  }
}
async function openSettings(page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  return page.getByRole("dialog", { name: "Settings", exact: true });
}
async function start(page) {
  await page.goto(pattern);
  await page.getByRole("button", { name: "Start knitting this", exact: true }).click();
  await expect(page.getByRole("button", { name: "End of round", exact: true })).toBeVisible();
}

test("all patterns remain usable without WebGL; default visits never request live physics", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return kind.startsWith("webgl") ? null : original.call(this, kind, ...args);
    };
  });
  const physics = [];
  page.context().on("request", request => { if (/\/ChainModel-/.test(request.url())) physics.push(request.url()); });
  await page.goto("");
  const links = await page.locator(".hat-card").evaluateAll(nodes => nodes.map(node => node.href));
  expect(links).toHaveLength(13);
  for (const href of links) {
    await page.goto(href);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start knitting this", exact: true })).toBeVisible();
    await expect(page.getByText("The 3D preview is unavailable.", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  expect(physics).toEqual([]);
});

test("the 3D hat shrinks back when a phone turns from landscape to portrait", async ({ page }) => {
  await page.goto(pattern);
  const stage = page.locator(".hat-stage");
  await expect(stage).toBeVisible();
  const size = page.viewportSize();
  const before = await stage.evaluate(node => node.getBoundingClientRect().width);
  await page.setViewportSize({ width: Math.max(size.width, size.height) + 200, height: Math.min(size.width, size.height) });
  await page.waitForTimeout(800);
  await page.setViewportSize(size);
  await expect.poll(() => stage.evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(Math.round(before));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("DK selection, accessible chart controls and text instructions", async ({ page }) => {
  await page.goto(pattern);
  await page.getByRole("button", { name: "Yarn weight 1 · DK", exact: true }).click();
  await expect(page.getByRole("button", { name: "Yarn weight 1 · DK", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Start knitting this", exact: true }).click();
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
  await expect(page.getByText(/Cast on 108 in/)).toBeVisible();
  await expect(page.getByText(/^Cast on one more stitch and join in the round/)).toBeVisible();
  await page.getByLabel("Read round").selectOption("2");
  await expect(page.getByText("Round 2:", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("the chart is its own page, and closing the knitting keeps you on it", async ({ page }) => {
  await page.goto(pattern);
  // The hat page shows the hat and its wool, and ends with the way to start.
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
  await expect(bar).toContainText("Round 2 of");
  await bar.getByRole("button", { name: "Resume knitting", exact: true }).click();
  await expect(position(page)).toContainText("Round 2, stitch 1.");

  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await bar.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page).toHaveURL(/\/project\/[^/?]+$/);
  await expect(page.locator(".chart-sheets")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your wool" })).toBeVisible();
  await page.locator(".next-step").getByRole("link", { name: "Keep knitting", exact: true }).click();
  await expect(position(page)).toContainText("Round 2, stitch 1.");

  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await bar.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Wool Week Toories", level: 1, exact: true })).toBeVisible();
});

test("knitting fills the screen, says how to work the round's stitches, and closing it leaves the chart still", async ({ page }) => {
  await page.goto("#/hat/sww19-roadside-beanie");
  await page.getByRole("button", { name: "Start knitting this", exact: true }).click();
  // The crown's first decrease round.
  await workRounds(page, 54);
  await expect(position(page)).toContainText("Round 55, stitch 1.");
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);

  const hint = page.getByRole("list", { name: "Stitches in this round" });
  await expect(hint).toContainText("Knit two together");

  await page.getByRole("button", { name: "Key", exact: true }).click();
  const key = page.getByRole("dialog", { name: "Key" });
  await expect(key).toContainText("Light Grey Green Mix");
  await key.getByRole("button", { name: "Close the key" }).click();
  await expect(key).toBeHidden();

  // Round 55, the second stitch from the right-hand edge: a k2tog.
  await page.locator(".chart-sheets").evaluate(sheet => {
    const cell = 16;
    const box = sheet.getBoundingClientRect();
    const columns = Math.round((box.width - Math.round(cell * 2.2)) / cell);
    sheet.dispatchEvent(new MouseEvent("click", { bubbles: true,
      clientX: box.left + (columns - 1.5) * cell, clientY: box.bottom - 54.5 * cell }));
  });
  const picker = page.getByRole("dialog", { name: /^Round 55, stitch/ });
  await expect(picker).toContainText("Knit two together");
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

test("the Birsie Beanny's brim takes your own words, until they are knitted", async ({ page }) => {
  await page.goto("#/hat/sww26-birsie-beanny");
  const words = page.getByLabel("Your words");
  await words.fill("Café");
  await expect(page.locator(".brim-lettering-status")).toContainText("There is no É");
  // Typed and started at once, before the page has caught up: still kept.
  await words.fill("Happy birthday Mum");
  await expect(page.locator(".brim-lettering-status")).toContainText("hearts between the words");
  await page.getByRole("button", { name: "Start knitting this", exact: true }).click();
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByLabel("Your words")).toHaveValue("HAPPY BIRTHDAY MUM");
  await expect(page.getByRole("img", { name: "The brim, lettered HAPPY BIRTHDAY MUM" })).toBeVisible();

  // Knitted into the lettering, the words are set.
  await page.getByRole("link", { name: /^(Start|Keep) knitting$/ }).first().click();
  await workRounds(page, 12);
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByLabel("Your words")).toHaveCount(0);
  await expect(page.locator(".brim-lettering")).toContainText("The lettering is knitted: HAPPY BIRTHDAY MUM");
});

test("turning the work is a step of its own, and turns the chart over with it", async ({ page }) => {
  await page.goto("#/hat/sww26-birsie-beanny");
  await page.getByRole("button", { name: "Start knitting this", exact: true }).click();
  // Where the first stitch sits across the chart: at the right, as printed,
  // while the brim is worked.
  const firstStitchAtRight = () => page.locator(".chart-next").evaluate((mark) => {
    const svg = mark.ownerSVGElement.getBoundingClientRect(), box = mark.getBoundingClientRect();
    return box.left - svg.left > svg.width / 2;
  });
  await expect.poll(firstStitchAtRight).toBe(true);
  await expect(page.locator(".chart-hatch").first()).toBeAttached();

  await workRounds(page, 51);
  await expect(page.locator(".knitting-panel")).toContainText("Turn your work inside out");
  await expect(page.getByRole("button", { name: "End of round", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Turned: carry on" }).click();
  await expect(position(page)).toContainText("Round 52, stitch 1.");
  // Turned over: the body reads as its chart does, stitch 1 at the right,
  // and the brim below, seen from its other face now, is what is hatched.
  await expect.poll(firstStitchAtRight).toBe(true);

  // Undo takes the turn back, and the chart with it.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".knitting-panel")).toContainText("Turn your work inside out");
});

test("changing needles is a step of its own, which the chart and key mark", async ({ page }) => {
  await page.goto("#/hat/sww25-aal-ower-toorie");
  await page.getByRole("button", { name: "Start knitting this", exact: true }).click();
  // The cast-on, ten rounds of rib and the increase round, on the rib's needles.
  await workRounds(page, 12);
  await expect(page.locator(".knitting-panel")).toContainText(/Change to [\d.]+mm needles/);
  await expect(page.getByRole("button", { name: "End of round", exact: true })).toHaveCount(0);
  await expect(page.locator(".chart-rule-needles")).toBeAttached();

  await page.getByRole("button", { name: "Changed: carry on" }).click();
  await expect(position(page)).toContainText("Round 13, stitch 1.");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".knitting-panel")).toContainText(/Change to [\d.]+mm needles/);

  await page.getByRole("button", { name: "Key", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Key" })).toContainText("Change needles");
});

test("the cast-on is cast on, then joined in the round as a step of its own", async ({ page }) => {
  await start(page);
  await expect(page.locator(".knitting-panel")).toContainText(/Cast on \d+ in/);
  await page.getByRole("button", { name: "End of round", exact: true }).click();
  await expect(page.locator(".knitting-panel")).toContainText("Join in the round");
  await page.getByRole("button", { name: "Joined: carry on" }).click();
  await expect(position(page)).toContainText("Round 2, stitch 1.");
  await page.getByRole("button", { name: "Key", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Key" })).toContainText("Join in the round");
});

test("2022 is turned to work its first row flat, then joined across", async ({ page }) => {
  await page.goto("#/hat/sww22-bonnie-isle-hat");
  await page.getByRole("button", { name: "Start knitting this", exact: true }).click();
  await page.getByRole("button", { name: "End of round", exact: true }).click();
  // Not joined yet, so it is turned over, not inside out.
  await expect(page.locator(".knitting-panel")).toContainText("Turn your work");
  await expect(page.locator(".knitting-panel")).not.toContainText("inside out");
  await page.getByRole("button", { name: "Turned: carry on" }).click();
  await page.getByRole("button", { name: "End of round", exact: true }).click();
  await expect(page.locator(".knitting-panel")).toContainText("Join in the round");
  await expect(page.locator(".knitting-panel")).toContainText("pulling a little tighter");
  await page.getByRole("button", { name: "Joined: carry on" }).click();
  await expect(position(page)).toContainText("Round 3, stitch 1.");
  await page.getByRole("button", { name: "Key", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Key" })).toContainText("Without turning, knit the next stitch");
});

test("the key explains the turn, on a hat that is turned inside out", async ({ page }) => {
  await page.goto("#/hat/sww26-birsie-beanny");
  await page.getByRole("button", { name: "Start knitting this", exact: true }).click();
  await page.getByRole("button", { name: "Key", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Key" })).toContainText("Turn the work");
  await expect(page.getByRole("dialog", { name: "Key" })).toContainText("Hatched");
  await page.getByRole("button", { name: "Close the key" }).click();
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await page.getByText("Stitch-symbol key", { exact: true }).click();
  await expect(page.locator(".stitch-key")).toContainText("turned inside out after round 51");
});

test("a hatched stitch says so when tapped", async ({ page }) => {
  await page.goto("#/hat/sww26-birsie-beanny");
  await page.getByRole("button", { name: "Start knitting this", exact: true }).click();
  const tap = (round) => page.locator(".chart-sheets").evaluate((sheet, round) => {
    const cell = 16;
    const box = sheet.getBoundingClientRect();
    const columns = Math.round((box.width - Math.round(cell * 2.2)) / cell);
    sheet.dispatchEvent(new MouseEvent("click", { bubbles: true,
      clientX: box.left + (columns - 3.5) * cell, clientY: box.bottom - (round - 0.5) * cell }));
  }, round);
  // In the brim, on this side of the turn: not hatched.
  await tap(20);
  const brim = page.getByRole("dialog", { name: /^Round 20, stitch/ });
  await expect(brim).toBeVisible();
  await expect(brim).not.toContainText("Hatched.");
  await brim.getByRole("button", { name: "Close" }).click();
  // In the body, past the turn: hatched while the brim is worked.
  await tap(60);
  const body = page.getByRole("dialog", { name: /^Round 60, stitch/ });
  await expect(body).toContainText("Hatched.");
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
  await start(page);
  const original = await position(page).textContent();
  // Round 20, the fourth stitch from the right-hand edge.
  await page.locator(".chart-sheets").evaluate(sheet => {
    const cell = 16;
    const box = sheet.getBoundingClientRect();
    const columns = Math.round((box.width - Math.round(cell * 2.2)) / cell);
    sheet.dispatchEvent(new MouseEvent("click", { bubbles: true,
      clientX: box.left + (columns - 3.5) * cell, clientY: box.bottom - 19.5 * cell }));
  });
  const picker = page.getByRole("dialog", { name: "Round 20, stitch 4" });
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: "Knit up to here" }).click();
  await expect(position(page)).toContainText("Round 20, stitch 4.");
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
  await page.getByRole("link", { name: "Wool Week Toories", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Wool Week Toories", level: 1, exact: true })).toBeVisible();
  await (await openSettings(page)).getByLabel("Import project backup").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer });
  await page.getByRole("button", { name: "Restore copies", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("button", { name: "Rename", exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Rename", exact: true }).first().click();
  await page.getByRole("textbox", { name: "Name this project" }).fill("Regression test hat");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Regression test hat", { exact: true })).toBeVisible();
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
