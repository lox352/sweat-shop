import { readFileSync } from "node:fs";
import { test, expect } from "playwright/test";

/*
 * The rest of a sweater worked out again for its knitter's tension, on their
 * device: see src/library/fit and src/ui/components/Refit.
 */
test.use({ serviceWorkers: "block" });

const id = "project-1760000000000";
const design = "wool-week-strips-once-oldest";
const editions = JSON.parse(readFileSync("src/library/editions/manifest.json", "utf8"));
const edition = editions[design].l.current;
const file = JSON.parse(readFileSync(`public/editions/${design}--l--${edition}.json`, "utf8"));
/** The last stitch of a round of the published edition, the rounds counted from 1: a round is written as runs of stitches, each its first and how many. */
const endOf = (round) => {
  const runs = file.rounds[round - 1];
  return runs[runs.length - 2] + runs[runs.length - 1] - 1;
};

test("a knitter at the end of a band has the rest worked out for their tension, sees it, and takes it", async ({ page }) => {
  test.setTimeout(120_000);
  const scripts = [];
  page.on("request", (request) => { if (/\.js(\?|$)/.test(request.url())) scripts.push(request.url()); });
  await page.goto("");
  await page.evaluate(({ id, design, edition, progress }) => {
    const now = new Date().toISOString();
    localStorage.setItem(id, JSON.stringify({
      version: 1, id, sweaterId: design, sizeId: "l", colourwayId: "night-gentle-dark", edition, progress,
      tension: { stitchesPer10cm: 23.3, roundsPer10cm: 25 }, startedAt: now, updatedAt: now,
    }));
  }, { id, design, edition, progress: endOf(67) });
  await page.goto("#/project/1760000000000");
  const section = page.getByRole("region", { name: "Your tension" });
  await expect(section.getByRole("heading", { name: "Fit the rest to your tension" })).toBeVisible({ timeout: 20_000 });
  // Nothing that can work a pattern out is fetched until it is asked for.
  expect(scripts.filter((url) => url.includes("fit.worker"))).toEqual([]);

  await section.getByRole("button", { name: "Work out the rest", exact: true }).click();
  await expect(section.getByText("This can take up to a minute")).toBeVisible();
  const shown = section.locator(".refit-shown");
  await expect(shown).toBeVisible({ timeout: 90_000 });
  expect(scripts.filter((url) => url.includes("fit.worker")).length).toBe(1);
  await expect(shown).toContainText("416 stitches round the yoke, 20 more than this tension wants");
  await expect(shown).toContainText("The body has 2016 to 2020");
  await expect(shown.getByRole("row", { name: /Chest/ })).toContainText("122cm");
  // Nothing is changed by looking.
  expect((await page.evaluate((id) => JSON.parse(localStorage.getItem(id)), id)).edition).toBe(edition);

  // The other way of laying the rest out, worked out when it is asked for.
  await shown.getByRole("radio", { name: /Fewer years, fuller/ }).check();
  await expect(shown).toContainText("Left out: 2023 to 2026", { timeout: 90_000 });
  await shown.getByRole("radio", { name: /Every year still to come/ }).check();
  await expect(shown).toContainText("The body has 2016 to 2020", { timeout: 90_000 });
  await shown.getByText("The rest, written out").click();
  await expect(shown.locator(".refit-written")).toContainText("Divide, in 16E");

  await shown.getByRole("button", { name: "Knit the rest this way", exact: true }).click();
  await expect(section).toContainText("The rest of your pattern is worked out for this tension", { timeout: 20_000 });
  const project = await page.evaluate((id) => JSON.parse(localStorage.getItem(id)), id);
  expect(project.progress).toBe(endOf(67));
  expect(project.edition).not.toBe(edition);
  expect(project.fit).toMatchObject({ round: 67, from: edition, tension: { stitchesPer10cm: 23.3, roundsPer10cm: 25 } });
  const own = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), `edition-${design}--l--${project.edition}`);
  // Every round knitted is as it was, and the next divides the yoke.
  expect(own.rounds.slice(0, 67)).toEqual(file.rounds.slice(0, 67));
  expect(own.rounds.length).toBeLessThan(file.rounds.length);
  await expect(section.getByRole("row", { name: /Chest/ })).toContainText("122cm");

  // Its own knitting opens again with no network for it, and the chart carries on from the same stitch.
  await page.route("**/editions/**", (route) => route.abort());
  await page.goto("#/project/1760000000000/chart?knitting=1");
  await expect(page.locator(".chart-next")).toBeAttached({ timeout: 20_000 });
  // The dividing round, on the 284 stitches the body now has.
  await expect(page.locator(".knitting-panel")).toContainText("of 284 stitches");
  await page.unroute("**/editions/**");

  // And until the knitting passes the round it was fitted from, the pattern as written can be gone back to.
  await page.goto("#/project/1760000000000");
  await page.getByRole("region", { name: "Your tension" }).getByRole("button", { name: "Go back to the pattern as written", exact: true }).click();
  await expect(page.getByRole("region", { name: "Your tension" }).getByRole("heading", { name: "Fit the rest to your tension" })).toBeVisible();
  const back = await page.evaluate((id) => JSON.parse(localStorage.getItem(id)), id);
  expect(back.edition).toBe(edition);
  expect(back.fit).toBeUndefined();
  expect(await page.evaluate((key) => localStorage.getItem(key), `edition-${design}--l--${project.edition}`)).toBeNull();
});

test("Hamefarin is worked out again from the end of a band: the bands still to come, on the stitches there are", async ({ page }) => {
  test.setTimeout(120_000);
  const current = editions.hamefarin.m.current;
  const published = JSON.parse(readFileSync(`public/editions/hamefarin--m--${current}.json`, "utf8"));
  // The last round of the Border, the second band of the yoke.
  const runs = published.rounds[39];
  const progress = runs[runs.length - 2] + runs[runs.length - 1] - 1;
  await page.goto("");
  await page.evaluate(({ id, current, progress }) => {
    const now = new Date().toISOString();
    localStorage.setItem(id, JSON.stringify({
      version: 1, id, sweaterId: "hamefarin", sizeId: "m", colourwayId: "simmer-dim", edition: current, progress,
      tension: { stitchesPer10cm: 24, roundsPer10cm: 28 }, startedAt: now, updatedAt: now,
    }));
  }, { id, current, progress });
  await page.goto("#/project/1760000000000");
  const section = page.getByRole("region", { name: "Your tension" });
  await section.getByRole("button", { name: "Work out the rest", exact: true }).click();
  const shown = section.locator(".refit-shown");
  await expect(shown).toBeVisible({ timeout: 90_000 });
  await expect(shown).toContainText("From the end of Yoke, round 40.");
  await expect(shown).toContainText("The yoke has Peerie seeds, OXO, Lozenges still to come, and grows from 300 stitches to 372.");
  // One way only: nothing to choose.
  await expect(shown.getByRole("radio")).toHaveCount(0);
  await shown.getByRole("button", { name: "Knit the rest this way", exact: true }).click();
  await expect(section).toContainText("The rest of your pattern is worked out for this tension");
  const project = await page.evaluate((id) => JSON.parse(localStorage.getItem(id)), id);
  expect(project).toMatchObject({ progress, fit: { round: 40, from: current }, upTo: current });
});

test("a design that can't be worked out again does not offer to be", async ({ page }) => {
  await page.goto("");
  await page.evaluate((id) => {
    const now = new Date().toISOString();
    localStorage.setItem(id, JSON.stringify({
      version: 1, id, sweaterId: "paul-klee", sizeId: "m1", colourwayId: "klee", progress: 0, tension: { stitchesPer10cm: 24, roundsPer10cm: 30 }, startedAt: now, updatedAt: now,
    }));
  }, id);
  await page.goto("#/project/1760000000000");
  const section = page.getByRole("region", { name: "Your tension" });
  await expect(section.getByRole("table")).toBeVisible();
  await expect(section.getByRole("heading", { name: "Fit the rest to your tension" })).toHaveCount(0);
});
