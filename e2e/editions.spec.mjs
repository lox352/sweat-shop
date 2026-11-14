import { test, expect } from "playwright/test";
import { readFile } from "node:fs/promises";

/*
 * A project knits the edition of its size's knitting it was started on: see
 * src/data/sweaters/editions. No size has been superseded for these to open,
 * so one is made up: Hamefarin's medium as it is now, under an older name,
 * with its last two yarns the other way round - the same number of stitches,
 * and a difference part way down the yoke.
 */
test.use({ serviceWorkers: "block" });

const older = "0123456789ab";
const id = "project-1760000000000";
const manifest = JSON.parse(await readFile("src/data/sweaters/editions/manifest.json", "utf8"));
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
  // Where the two first differ, and that it is still to come.
  await expect(note(page)).toContainText(/The update first differs at Yoke, round \d+\./);
  await expect(note(page)).toContainText("switching changes nothing you have knitted");
  expect(asked).toHaveLength(1);
  // Nothing of the project's has been touched by opening it.
  expect(await saved(page)).toMatchObject({ progress: 400, edition: older });

  // It knits: the chart and the panel are its own edition's.
  await page.goto("#/project/1760000000000/chart?knitting=1");
  await expect(page.locator(".knitting-panel [role=status]")).toBeAttached();
  await expect(note(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await expect(note(page)).toBeVisible();

  // Moving on is asked twice, and then the project is on its size's knitting as it is now.
  await note(page).getByRole("button", { name: "Switch to the updated pattern", exact: true }).click();
  await note(page).getByRole("button", { name: "Not now", exact: true }).click();
  expect(await saved(page)).toMatchObject({ edition: older });
  await note(page).getByRole("button", { name: "Switch to the updated pattern", exact: true }).click();
  await note(page).getByRole("button", { name: "Yes, switch", exact: true }).click();
  await expect(note(page)).toHaveCount(0);
  expect(await saved(page)).toMatchObject({ progress: 400, edition: current });
});

test("a change before where a project has got to is said to be", async ({ page }) => {
  await page.route(`**/editions/hamefarin--m--${older}.json`, async (route) => route.fulfill({ contentType: "application/json", body: await olderFile() }));
  await projectOn(page, older, 30000);
  await page.goto("#/project/1760000000000");
  await expect(note(page)).toContainText("That is before where you are");
  await expect(note(page)).toContainText("Knit up to here");
});

test("a project whose edition cannot be fetched is not shown some other knitting", async ({ page }) => {
  let reachable = false;
  await page.route(`**/editions/hamefarin--m--${older}.json`, async (route) =>
    reachable ? route.fulfill({ contentType: "application/json", body: await olderFile() }) : route.abort());
  await projectOn(page, older, 400);
  await page.goto("#/project/1760000000000/chart?knitting=1");
  await expect(page.getByText("the version you are knitting could not be fetched")).toBeVisible();
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
  await expect(page.locator(".measurements").first()).toBeVisible();
  await expect(note(page)).toHaveCount(0);
  expect((await saved(page)).edition).toBeUndefined();
  // The pattern is fetched, not worked out here: the size's edition now, and no other.
  expect(asked).toEqual([`hamefarin--m--${current}.json`]);

  await page.evaluate(() => localStorage.clear());
  await page.goto("#/sweater/hamefarin");
  await page.getByRole("button", { name: "Start knitting this", exact: true }).click();
  await expect(page.getByRole("button", { name: "End of round", exact: true })).toBeVisible();
  const started = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((key) => key.startsWith("project-")))));
  // Whatever size the design page starts in, its edition now.
  expect(started.edition).toBe(manifest.hamefarin[started.sizeId].current);
});

test("where a size's frozen copy cannot be had, its pattern is worked out here as it always was", async ({ page }) => {
  await page.route("**/editions/**", (route) => route.abort());
  await page.goto("#/sweater/hamefarin");
  await page.getByRole("button", { name: "Start knitting this", exact: true }).click();
  await expect(page.getByRole("button", { name: "End of round", exact: true })).toBeVisible();
  await expect(page.locator(".knitting-panel [role=status]")).toBeAttached();
});

test("where neither a size's frozen copy nor what works a pattern out can be had, the page says so, and tries again when asked", async ({ page }) => {
  let reachable = false;
  const unless = (route) => (reachable ? route.continue() : route.abort());
  await page.route("**/editions/**", unless);
  await page.route("**/assets/builder-*.js", unless);
  await page.goto("#/sweater/hamefarin");
  await expect(page.getByRole("alert").filter({ hasText: "The pattern could not be fetched" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start knitting this", exact: true })).toHaveCount(0);
  reachable = true;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start knitting this", exact: true })).toBeVisible();
});

