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
  }, { id, design, edition, progress: endOf(68) });
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
  // The colourway steps down the sweater: each way is drawn in the yarns for where its years would sit, and says what that adds to the wool.
  await expect(shown).toContainText("This colourway steps down the sweater, so the years still to come take the yarns for where they now sit. That adds 2 yarns to what the pattern listed: Cloud (764), Bramble (155).");
  await expect(shown).toContainText("420 stitches round the yoke, 24 more than this tension wants");
  await expect(shown).toContainText("The body has 2016 to 2020");
  await expect(shown.getByRole("row", { name: /Chest/ })).toContainText("123.5cm");
  // Nothing is changed by looking.
  expect((await page.evaluate((id) => JSON.parse(localStorage.getItem(id)), id)).edition).toBe(edition);

  // The pattern as it is and each way of laying the rest out, side by side: all of them where there is room, and on a phone the first beside the one chosen.
  const wide = page.viewportSize().width > 640;
  const compared = shown.locator(".sweater-comparison figcaption");
  await expect(compared).toHaveText(wide ? ["As the pattern has it", "Every year still to come", "Fewer years, fuller"] : ["As the pattern has it", "Every year still to come"]);
  // The other way was worked out with the first: choosing it is at once, and asks for nothing more.
  await shown.getByRole("radio", { name: /Fewer years, fuller/ }).check();
  await expect(shown).toContainText("Left out: 2023 to 2026");
  if (!wide) await expect(compared).toHaveText(["As the pattern has it", "Fewer years, fuller"]);
  await shown.getByRole("radio", { name: /Every year still to come/ }).check();
  await expect(shown).toContainText("The body has 2016 to 2020");
  expect(scripts.filter((url) => url.includes("fit.worker")).length).toBe(1);
  await shown.getByText("The rest, written out").click();
  await expect(shown.locator(".refit-written")).toContainText("Divide, in 16D");

  await shown.getByRole("button", { name: "Knit the rest this way", exact: true }).click();
  await expect(section).toContainText("The rest of your pattern is worked out for this tension", { timeout: 20_000 });
  const project = await page.evaluate((id) => JSON.parse(localStorage.getItem(id)), id);
  expect(project.progress).toBe(endOf(68));
  expect(project.edition).not.toBe(edition);
  expect(project.fit).toMatchObject({ round: 68, from: edition, tension: { stitchesPer10cm: 23.3, roundsPer10cm: 25 } });
  // Where the planner put each year it planned afresh is the project's to keep, and the ribbing is beside the last of them.
  expect(Object.keys(project.fit.placement.places)).toEqual(["2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"]);
  expect(project.fit.placement.trims).toEqual({ "trim/21+26": ["2020", "2026"] });
  // The wool list is the colourway as placed: the yarns it adds are on it.
  await expect(page.locator(".wool-list")).toContainText("Bramble");
  const own = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), `edition-${design}--l--${project.edition}`);
  // Every round knitted is as it was, and the next divides the yoke.
  expect(own.rounds.slice(0, 68)).toEqual(file.rounds.slice(0, 68));
  expect(own.rounds.length).toBeLessThan(file.rounds.length);
  await expect(section.getByRole("row", { name: /Chest/ })).toContainText("123.5cm");

  // Its own knitting opens again with no network for it, and the chart carries on from the same stitch.
  await page.route("**/editions/**", (route) => route.abort());
  await page.goto("#/project/1760000000000/chart?knitting=1");
  await expect(page.locator(".chart-next")).toBeAttached({ timeout: 20_000 });
  // The dividing round, on the 288 stitches the body now has.
  await expect(page.locator(".knitting-panel")).toContainText("of 288 stitches");
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
  test.setTimeout(420_000);
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

  // Its own knitting has no published shape: it is drawn laid out, settled here with a bar for how far that has got, and the shape kept.
  const settling = page.locator(".sweater-settling");
  await expect(settling).toContainText("Settling your sweater into its shape");
  await expect(settling.getByRole("progressbar")).toBeVisible();
  await expect(settling).toHaveCount(0, { timeout: 300_000 });
  const kept = await page.evaluate(async () => (await (await caches.open("sweat-shop-shapes")).keys()).map((request) => request.url));
  expect(kept).toEqual([expect.stringContaining(`own-shapes/hamefarin--m--${project.edition}.json`)]);
  // Opened again, it is there already: nothing is settled twice.
  let workers = 0;
  page.on("worker", (worker) => { if (worker.url().includes("settle.worker")) workers++; });
  await page.reload();
  await expect(page.getByRole("region", { name: "Your tension" })).toContainText("The rest of your pattern is worked out for this tension", { timeout: 20_000 });
  await page.waitForTimeout(1500);
  await expect(settling).toHaveCount(0);
  expect(workers).toBe(0);
});

test("a tension given before starting: the pattern is worked out for it from the cast-on, shown beside the pattern as it is, and begun", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("#/sweater/hamefarin?size=m&tab=tension");
  const section = page.getByRole("region", { name: "Your tension" });
  await expect(section).toContainText("written for 28 stitches and 32 rounds to 10cm", { timeout: 20_000 });
  // The pattern's own tension needs nothing worked out.
  await section.getByLabel("Stitches counted").fill("28");
  await section.getByLabel("Rounds counted").fill("32");
  await section.getByRole("button", { name: "Compare with the pattern", exact: true }).click();
  await expect(section.getByRole("status")).toContainText("comes out as designed");
  await expect(section.getByRole("heading", { name: "A pattern for your tension" })).toHaveCount(0);

  // A looser one: as written it comes out bigger, and the pattern can be worked out for it.
  await section.getByLabel("Stitches counted").fill("24");
  await section.getByLabel("Rounds counted").fill("28");
  await section.getByRole("button", { name: "Update", exact: true }).click();
  await expect(section.getByRole("row", { name: /Chest/ }).first()).toContainText("123.5cm");
  await section.getByRole("button", { name: "Work the pattern out", exact: true }).click();
  const shown = section.locator(".refit-shown");
  await expect(shown).toBeVisible({ timeout: 90_000 });
  await expect(shown).toContainText("From the cast-on.");
  // They are compared on the stage, where the one jumper was.
  await expect(page.locator(".stage .sweater-comparison figcaption")).toHaveText(["As the pattern has it", "Worked out for you"]);
  await expect(shown.getByRole("row", { name: /Chest/ })).toContainText("106.5cm");
  await shown.getByText("The pattern, written out").click();
  await expect(shown.locator(".refit-written")).toContainText("Cast on 112");
  // Nothing is begun by looking.
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("project-")))).toEqual([]);

  await shown.getByRole("button", { name: "Start knitting this", exact: true }).click();
  await expect(page.locator(".knitting-panel")).toContainText("of 112 stitches", { timeout: 30_000 });
  const started = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((key) => key.startsWith("project-")))));
  const current = editions.hamefarin.m.current;
  expect(started).toMatchObject({ sizeId: "m", progress: 0, tension: { stitchesPer10cm: 24, roundsPer10cm: 28 }, upTo: current, fit: { from: current } });
  expect(started.fit.round).toBeUndefined();
  expect(started.edition).not.toBe(current);
  // Its project's page says so, and until a stitch is worked the pattern as written can be gone back to.
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  const own = page.getByRole("region", { name: "Your tension" });
  await expect(own).toContainText("Your pattern is worked out for this tension, from the cast-on.", { timeout: 20_000 });
  await own.getByRole("button", { name: "Go back to the pattern as written", exact: true }).click();
  await expect(own.getByRole("heading", { name: "Fit the rest to your tension" })).toBeVisible();
  expect((await page.evaluate((id) => JSON.parse(localStorage.getItem(id)), started.id)).edition).toBe(current);
});

test("Each Year Once for a tension given before starting: every year or fewer, fuller, each from the cast-on", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(`#/sweater/${design}?size=l&tab=tension`);
  const section = page.getByRole("region", { name: "Your tension" });
  await expect(section).toContainText("written for 32 stitches and 38 rounds to 10cm", { timeout: 20_000 });
  await section.getByLabel("Stitches counted").fill("23.3");
  await section.getByLabel("Rounds counted").fill("25");
  await section.getByRole("button", { name: "Compare with the pattern", exact: true }).click();
  await section.getByRole("button", { name: "Work the pattern out", exact: true }).click();
  const shown = section.locator(".refit-shown");
  await expect(shown).toBeVisible({ timeout: 150_000 });
  await expect(shown).toContainText("From the cast-on.");
  // All thirteen years, from 2014 round the yoke.
  await expect(shown).toContainText(/The yoke has \d+ rounds, 2014 to 20\d\d, and grows from \d+ stitches to \d+\./);
  await expect(shown).not.toContainText("Left out");
  // Or fewer, each fuller: worked out with the first, and the last years said to be left out.
  await shown.getByRole("radio", { name: /Fewer years, fuller/ }).check();
  await expect(shown).toContainText(/Left out: 20\d\d to 2026\./);
  await shown.getByText("The pattern, written out").click();
  await expect(shown.locator(".refit-written")).toContainText(/Cast on \d+/);

  await shown.getByRole("button", { name: "Start knitting this", exact: true }).click();
  await expect(page.locator(".knitting-panel")).toContainText(/of \d+ stitches/, { timeout: 30_000 });
  const started = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((key) => key.startsWith("project-")))));
  expect(started).toMatchObject({ sizeId: "l", progress: 0, tension: { stitchesPer10cm: 23.3, roundsPer10cm: 25 }, upTo: edition, fit: { from: edition, option: "fewer" } });
  expect(started.fit.round).toBeUndefined();
  // Every year it has is placed, from the neck down, for a colourway that steps down the sweater.
  expect(Object.keys(started.fit.placement.places)[0]).toBe("2014");
  expect(Object.keys(started.fit.placement.places).length).toBeLessThan(13);
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
