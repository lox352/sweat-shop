import { test, expect } from "playwright/test";
import { readFile } from "node:fs/promises";

/*
 * A project knits the edition of its size's knitting it was started on: see
 * src/library/editions. No size has been superseded for these to open,
 * so one is made up: Hamefarin's medium as it is now, under an older name,
 * with its last two yarns the other way round - the same number of stitches,
 * and a difference part way down the yoke.
 */
test.use({ serviceWorkers: "block" });

const older = "0123456789ab";
const id = "project-1760000000000";
const manifest = JSON.parse(await readFile("src/library/editions/manifest.json", "utf8"));
const current = manifest.hamefarin.m.current;
const olderFile = async () => {
  const file = JSON.parse(await readFile(`public/editions/hamefarin--m--${current}.json`, "utf8"));
  file.edition = older;
  const slots = file.stitches.slots;
  [slots[slots.length - 1], slots[slots.length - 2]] = [slots[slots.length - 2], slots[slots.length - 1]];
  return JSON.stringify(file);
};
const saved = (page) => page.evaluate((id) => JSON.parse(localStorage.getItem(id)), id);
async function projectOn(page, edition, progress) {
  await page.goto("");
  await page.evaluate(({ id, edition, progress }) => {
    const now = new Date().toISOString();
    localStorage.setItem(id, JSON.stringify({
      version: 1, id, sweaterId: "hamefarin", sizeId: "m", colourwayId: "simmer-dim", progress,
      ...(edition ? { edition } : {}), startedAt: now, updatedAt: now,
    }));
  }, { id, edition, progress });
}
const note = (page) => page.getByRole("complementary", { name: "This pattern has been updated" });

test("a project started before its pattern was updated knits what it was started on, until its knitter moves it on", async ({ page }) => {
  const asked = [];
  await page.route(`**/editions/hamefarin--m--${older}.json`, async (route) => {
    asked.push(route.request().url());
    await route.fulfill({ contentType: "application/json", body: await olderFile() });
  });
  await projectOn(page, older, 400);
  await page.goto("#/project/1760000000000");
  await expect(note(page)).toBeVisible();
  await expect(note(page)).toContainText("You are still knitting the version you started");
  // The update is all ahead of the knitter: it can be taken as it is published.
  await expect(note(page)).toContainText("Everything you have knitted is the same in the update. 11 rounds ahead of you are different.");
  expect(asked).toHaveLength(1);
  // Nothing of the project's has been touched by opening it.
  expect(await saved(page)).toMatchObject({ progress: 400, edition: older });

  // It knits: the chart and the panel are its own edition's.
  await page.goto("#/project/1760000000000/chart?knitting=1");
  await expect(page.locator(".knitting-panel [role=status]")).toBeAttached();
  await expect(note(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await page.getByRole("link", { name: "Close the chart", exact: true }).click();
  await expect(note(page)).toBeVisible();

  // Taken, the project is on its size's knitting as it is now, its place where it was.
  await note(page).getByRole("button", { name: "Update from here", exact: true }).click();
  await expect(note(page)).toHaveCount(0);
  expect(await saved(page)).toMatchObject({ progress: 400, edition: current });
});

/** The first stitch of a round of the size's knitting, the rounds counted from 1: a round is written as runs of stitches, each its first and how many. */
const startOf = async (round) => JSON.parse(await readFile(`public/editions/hamefarin--m--${current}.json`, "utf8")).rounds[round - 1][0];
const servingOlder = (page) => page.route(`**/editions/hamefarin--m--${older}.json`, async (route) => route.fulfill({ contentType: "application/json", body: await olderFile() }));

test("an update with changes behind the knitter and ahead is taken from the round in hand: their rounds are kept, and the rest is the update's", async ({ page }) => {
  await servingOlder(page);
  // Part way round round 50 of the yoke: the two differ in rounds 36 and 45 behind, and from 56 on ahead.
  const progress = (await startOf(50)) + 100;
  await projectOn(page, older, progress);
  await page.goto("#/project/1760000000000");
  await expect(note(page)).toContainText("is the same pattern again at Yoke, round 50");
  await expect(note(page)).toContainText("9 rounds ahead of you are different");
  await note(page).getByRole("button", { name: "Update from the end of Yoke, round 50", exact: true }).click();
  await expect(note(page)).toHaveCount(0);
  // The knitting is now the project's own: neither edition, up to date with the size's, and kept on the device.
  const project = await saved(page);
  expect(project.progress).toBe(progress);
  expect(project.upTo).toBe(current);
  expect([older, current]).not.toContain(project.edition);
  const own = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), `edition-hamefarin--m--${project.edition}`);
  const [was, now] = [JSON.parse(await olderFile()), JSON.parse(await readFile(`public/editions/hamefarin--m--${current}.json`, "utf8"))];
  expect(own.rounds).toEqual(now.rounds);
  // Its yarns to the end of round 50 are the older edition's, and from there the update's.
  const yarns = (file, from, to) => {
    const each = [];
    for (let at = 0; at < file.stitches.slot.length; at += 2) for (let n = 0; n < file.stitches.slot[at + 1]; n++) each.push(file.stitches.slots[file.stitches.slot[at]]);
    return each.slice(from, to).join("");
  };
  const end = await startOf(51);
  expect(yarns(own, 0, end)).toBe(yarns(was, 0, end));
  expect(yarns(own, end)).toBe(yarns(now, end));
  // It opens again from the device, with neither edition to be fetched, on the stitch it was on.
  await page.route("**/editions/**", (route) => route.abort());
  await page.goto("#/project/1760000000000/chart?knitting=1");
  await expect(page.locator(".knitting-panel [role=status]")).toBeAttached();
  await expect(note(page)).toHaveCount(0);
});

test("an update all behind the knitter is said once, and changes nothing", async ({ page }) => {
  await servingOlder(page);
  const all = JSON.parse(await readFile(`public/editions/hamefarin--m--${current}.json`, "utf8")).stitches.count;
  await projectOn(page, older, all - 1);
  await page.goto("#/project/1760000000000");
  await expect(note(page)).toContainText("The change is in what you have already knitted, from Yoke, round 36 to");
  await expect(note(page)).toContainText("Nothing ahead of you changes");
  await note(page).getByRole("button", { name: "Understood", exact: true }).click();
  await expect(note(page)).toHaveCount(0);
  expect(await saved(page)).toMatchObject({ progress: all - 1, edition: older, upTo: current });
  // The edition it stays on is kept with it, so it need not stay published.
  expect(await page.evaluate((key) => localStorage.getItem(key) !== null, `edition-hamefarin--m--${older}`)).toBe(true);
  await page.reload();
  await expect(page.locator(".jumper-progress")).toBeVisible();
  await expect(note(page)).toHaveCount(0);
});

test("an update that can't be joined to the knitting, in a design that can't work the rest out again, leaves the knitter as they were", async ({ page }) => {
  await servingOlder(page);
  // On the body: the two differ behind, in the yoke, and ahead, above the hem, and stitches are on hold between.
  await projectOn(page, older, 30000);
  await page.goto("#/project/1760000000000");
  await expect(note(page)).toContainText("can't be joined to your knitting. You knit on as you were.");
  await expect(note(page).getByRole("button")).toHaveCount(0);
  expect(await saved(page)).toMatchObject({ progress: 30000, edition: older });
});

test("a project whose edition cannot be fetched is not shown some other knitting", async ({ page }) => {
  let reachable = false;
  await page.route(`**/editions/hamefarin--m--${older}.json`, async (route) =>
    reachable ? route.fulfill({ contentType: "application/json", body: await olderFile() }) : route.abort());
  await projectOn(page, older, 400);
  await page.goto("#/project/1760000000000/chart?knitting=1");
  await expect(page.getByRole("alert").filter({ hasText: "The pattern could not be fetched" })).toBeVisible();
  await expect(page.locator(".chart-page")).toHaveCount(0);
  expect(await saved(page)).toMatchObject({ progress: 400, edition: older });
  reachable = true;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".knitting-panel [role=status]")).toBeAttached();
});

test("a project on its size's knitting as it is now knits that from its frozen copy, and one newly started records it", async ({ page }) => {
  const asked = [];
  page.on("request", (request) => {
    if (request.url().includes("/editions/")) asked.push(request.url().split("/").pop());
  });
  // Saved before editions: it knits the first, which is still the size's knitting.
  await projectOn(page, undefined, 400);
  asked.length = 0;
  await page.goto("#/project/1760000000000");
  await expect(page.locator(".jumper-progress")).toBeVisible();
  await expect(note(page)).toHaveCount(0);
  expect((await saved(page)).edition).toBeUndefined();
  // The pattern is fetched, not worked out here: the size's edition now, and no other.
  expect(asked).toEqual([`hamefarin--m--${current}.json`]);

  await page.evaluate(() => localStorage.clear());
  await page.goto("#/sweater/hamefarin?tab=start");
  await page.getByRole("button", { name: "Start knitting", exact: true }).click();
  await expect(page.getByRole("button", { name: "End of round", exact: true })).toBeVisible();
  const started = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((key) => key.startsWith("project-")))));
  // Whatever size the design page starts in, its edition now.
  expect(started.edition).toBe(manifest.hamefarin[started.sizeId].current);
});

test("where a size's frozen copy cannot be fetched, the page says so, and tries again when asked", async ({ page }) => {
  let reachable = false;
  await page.route("**/editions/**", (route) => (reachable ? route.continue() : route.abort()));
  await page.goto("#/sweater/hamefarin?tab=start");
  await expect(page.getByRole("alert").filter({ hasText: "The pattern could not be fetched" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start knitting", exact: true })).toHaveCount(0);
  reachable = true;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start knitting", exact: true })).toBeVisible();
});

test("nothing the site loads can work a pattern out: no script of it holds a chart or the engine", async ({ page }) => {
  const scripts = [];
  page.on("response", (response) => {
    if (response.url().endsWith(".js")) scripts.push(response);
  });
  await page.goto("#/sweater/hamefarin?tab=start");
  await page.getByRole("button", { name: "Start knitting", exact: true }).click();
  await expect(page.locator(".knitting-panel [role=status]")).toBeAttached();
  expect(scripts.length).toBeGreaterThan(0);
  // What the engine says of a design with no tension for a fabric: in no script the page fetched.
  for (const script of scripts) expect(await script.text()).not.toContain("no tension for the fabric");
});
