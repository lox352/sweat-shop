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
/**
 * The settling, answered at once: that the sweater did not come to rest, so
 * it is shown laid out. Settling is what the site does slowest - minutes a
 * sweater - and a recalculated pattern is not shown until every sweater it
 * is shown with has been settled; so the tests that are of something else
 * stand this in for the worker that settles (src/physics/settle.worker).
 * The one below that is of the settling does not.
 */
const withoutSettling = (page) =>
  page.route(/settle\.worker[^/]*\.js/, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'self.onmessage = () => { self.postMessage({ shape: "not-settled" }); self.postMessage({ positions: new Float32Array(0), rested: false }); };',
    }));

/*
 * A tension chosen on a design's page: Change, by the tension under the
 * sizes, brings its card up from the foot, where the knitter's own is put in
 * and the pattern recalculated for it.
 */
const tensionCard = (page) => page.getByRole("dialog", { name: "Your tension" });
const recalculateFor = async (page, stitches, rounds) => {
  await page.getByRole("region", { name: "Tension", exact: true }).getByRole("button", { name: "Change", exact: true }).click();
  const card = tensionCard(page);
  await card.getByLabel("Stitches to 10cm").fill(String(stitches));
  await card.getByLabel("Rounds to 10cm").fill(String(rounds));
  await card.getByRole("button", { name: "Recalculate the pattern", exact: true }).click();
  await expect(card).toHaveCount(0);
};

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
  // Each way is settled into its shape before it is shown, which for three samplers is many minutes: here they are shown laid out. Hamefarin, below, is settled.
  await withoutSettling(page);
  await page.goto("#/project/1760000000000?tab=fit");
  const section = page.getByRole("region", { name: "Your tension" });
  await expect(section.getByRole("heading", { name: "Recalculate the rest" })).toBeVisible({ timeout: 20_000 });
  // Nothing that can work a pattern out is fetched until it is asked for.
  expect(scripts.filter((url) => url.includes("fit.worker"))).toEqual([]);

  // It says how long it may take before it is asked for: while it is at it is too short a while, here, to be sure of seeing.
  await expect(section).toContainText("which can take several minutes");
  await section.getByRole("button", { name: "Recalculate the rest", exact: true }).click();
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
  // On the stage, where the one jumper was.
  const compared = page.locator(".stage .sweater-comparison figcaption");
  await expect(compared).toHaveText(wide ? ["If you keep knitting", "Every year still to come", "Fewer years, fuller"] : ["If you keep knitting", "Every year still to come"]);
  // The other way was worked out with the first: choosing it is at once, and asks for nothing more.
  await shown.getByRole("radio", { name: /Fewer years, fuller/ }).check();
  await expect(shown).toContainText("Left out: 2023 to 2026");
  if (!wide) await expect(compared).toHaveText(["If you keep knitting", "Fewer years, fuller"]);
  await shown.getByRole("radio", { name: /Every year still to come/ }).check();
  await expect(shown).toContainText("The body has 2016 to 2020");
  expect(scripts.filter((url) => url.includes("fit.worker")).length).toBe(1);
  await shown.getByText("The rest, written out").click();
  await expect(shown.locator(".refit-written")).toContainText("Divide, in 16D");

  await shown.getByRole("button", { name: "Knit the rest this way", exact: true }).click();
  await expect(section).toContainText("The rest of your pattern is recalculated for this tension", { timeout: 20_000 });
  const project = await page.evaluate((id) => JSON.parse(localStorage.getItem(id)), id);
  expect(project.progress).toBe(endOf(68));
  expect(project.edition).not.toBe(edition);
  expect(project.fit).toMatchObject({ round: 68, from: edition, tension: { stitchesPer10cm: 23.3, roundsPer10cm: 25 } });
  // Where the planner put each year it planned afresh is the project's to keep, and the ribbing is beside the last of them.
  expect(Object.keys(project.fit.placement.places)).toEqual(["2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"]);
  expect(project.fit.placement.trims).toEqual({ "trim/21+26": ["2020", "2026"] });
  // The wool list is the colourway as placed: the yarns it adds are on it.
  await page.getByRole("tab", { name: "Wool", exact: true }).click();
  await expect(page.locator(".wool-list")).toContainText("Bramble");
  await page.getByRole("tab", { name: "Fit", exact: true }).click();
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
  await page.goto("#/project/1760000000000?tab=fit");
  await page.getByRole("region", { name: "Your tension" }).getByRole("button", { name: "Go back to the pattern as written", exact: true }).click();
  await expect(page.getByRole("region", { name: "Your tension" }).getByRole("heading", { name: "Recalculate the rest" })).toBeVisible();
  const back = await page.evaluate((id) => JSON.parse(localStorage.getItem(id)), id);
  expect(back.edition).toBe(edition);
  expect(back.fit).toBeUndefined();
  expect(await page.evaluate((key) => localStorage.getItem(key), `edition-${design}--l--${project.edition}`)).toBeNull();
});

test("Hamefarin is worked out again from the end of a band: the bands still to come, on the stitches there are", async ({ page }) => {
  test.setTimeout(600_000);
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
  await page.goto("#/project/1760000000000?tab=fit");
  const section = page.getByRole("region", { name: "Your tension" });
  await section.getByRole("button", { name: "Recalculate the rest", exact: true }).click();
  const shown = section.locator(".refit-shown");
  // Worked out, nothing is shown yet: the pattern as it was and the rest worked out are each settled into their shape first, and the bar goes on to follow that.
  await expect(section.getByText("Now settling both sweaters into their shape")).toBeVisible({ timeout: 90_000 });
  await expect(section.getByRole("progressbar")).toBeVisible();
  await expect(shown).toHaveCount(0);
  await expect(shown).toBeVisible({ timeout: 420_000 });
  await expect(page.locator(".stage .sweater-comparison figcaption")).toHaveText(["If you keep knitting", "Recalculated"]);
  await expect(shown).toContainText("From the end of Yoke, round 40.");
  await expect(shown).toContainText("The yoke has Peerie seeds, OXO, Lozenges still to come, and grows from 300 stitches to 372.");
  // One way only: nothing to choose.
  await expect(shown.getByRole("radio")).toHaveCount(0);
  await shown.getByRole("button", { name: "Knit the rest this way", exact: true }).click();
  await expect(section).toContainText("The rest of your pattern is recalculated for this tension");
  const project = await page.evaluate((id) => JSON.parse(localStorage.getItem(id)), id);
  expect(project).toMatchObject({ progress, fit: { round: 40, from: current }, upTo: current });

  // Its own knitting has no published shape, but it was settled before it was shown: taken, it is drawn in that shape at once, with nothing more to settle, and the shape is kept.
  const settling = page.locator(".sweater-settling");
  await expect
    .poll(() => page.evaluate(async () => (await (await caches.open("sweat-shop-shapes")).keys()).map((request) => request.url)), { timeout: 20_000 })
    .toEqual([expect.stringContaining(`own-shapes/hamefarin--m--${project.edition}.json`)]);
  await expect(settling).toHaveCount(0);
  // Opened again, it is there already: nothing is settled twice.
  let workers = 0;
  page.on("worker", (worker) => { if (worker.url().includes("settle.worker")) workers++; });
  await page.reload();
  await expect(page.getByRole("region", { name: "Your tension" })).toContainText("The rest of your pattern is recalculated for this tension", { timeout: 20_000 });
  await page.waitForTimeout(1500);
  await expect(settling).toHaveCount(0);
  expect(workers).toBe(0);
});

test("a tension chosen with the size: the pattern is recalculated for it from the cast-on, the page becomes that pattern's, and it is begun", async ({ page }) => {
  test.setTimeout(180_000);
  // The jumper is drawn laid out: the settling of it is the test above's. The tension is chosen with the size; an address from when it had a tab, or a page, of its own comes there.
  await withoutSettling(page);
  await page.goto("#/sweater/hamefarin?size=m&tab=tension");
  await expect(page.getByRole("tablist", { name: "This design" }).getByRole("tab", { name: "Size", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tablist", { name: "Size: its pages" }).getByRole("tab", { name: "Size", exact: true })).toHaveAttribute("aria-selected", "true");
  const section = page.getByRole("region", { name: "Tension", exact: true });
  // The pattern's own tension is said, and needs nothing worked out.
  await expect(section).toContainText("28 stitches and 32 rounds to 10cm", { timeout: 20_000 });
  await expect(section).toContainText("The pattern's own");
  // Its card comes up from the foot: the one card a trim and a colourway's wools are changed in. It says what the fields are for, and has nothing to recalculate until they hold another tension.
  await section.getByRole("button", { name: "Change", exact: true }).click();
  const card = tensionCard(page);
  await expect(card).toHaveClass(/\bsheet\b/);
  await expect(card).toContainText("The pattern is written for 28 stitches and 32 rounds to 10cm. If your swatch measures otherwise");
  await expect(card.getByLabel("Stitches to 10cm")).toHaveValue("28");
  await expect(card.getByLabel("Rounds to 10cm")).toHaveValue("32");
  await expect(card.getByRole("button", { name: "Recalculate the pattern", exact: true })).toBeDisabled();
  // Closed, nothing is changed, whatever was typed.
  await card.getByLabel("Stitches to 10cm").fill("24");
  await card.getByRole("button", { name: "Close", exact: true }).click();
  await expect(section).toContainText("28 stitches and 32 rounds to 10cm");
  await page.getByRole("tab", { name: "Start", exact: true }).click();
  await expect(page.locator(".ready-choices")).toContainText("As the pattern");
  // The last tab's line of the tension opens the same card, and a looser tension is recalculated for from there.
  await page.locator(".ready-choices").getByRole("button", { name: /Tension/ }).click();
  await tensionCard(page).getByLabel("Stitches to 10cm").fill("24");
  await tensionCard(page).getByLabel("Rounds to 10cm").fill("28");
  await tensionCard(page).getByRole("button", { name: "Recalculate the pattern", exact: true }).click();
  await page.getByRole("tab", { name: "Size", exact: true }).first().click();
  const shown = section.locator(".size-recalculated");
  await expect(shown).toBeVisible({ timeout: 90_000 });
  await expect(shown).toContainText("24 stitches and 28 rounds to 10cm");
  await expect(shown).toContainText("Recalculated for yours");
  // Nothing is set beside anything: the one jumper on the stage is the recalculated one, and its badge says at what tension.
  await expect(page.locator(".stage-badge")).toContainText("M · 24 sts & 28 rounds · ");
  await expect(page.locator(".stage .sweater-comparison")).toHaveCount(0);
  // What recalculating changed, and the pattern written out, are in the card.
  await shown.getByRole("button", { name: "Change", exact: true }).click();
  await card.getByText("What recalculating changed").click();
  await expect(card.locator(".refit-written")).toContainText("Cast on 112");
  await card.getByRole("button", { name: "Close", exact: true }).click();
  // The pages after are that pattern's: what it measures, at the knitter's tension.
  await page.getByRole("tab", { name: "Size M at your tension, finished", exact: true }).click();
  const measurements = page.locator(".pages-page[data-current] .measurements");
  await expect(measurements).toContainText("106.5cm");
  await expect(measurements).toContainText("24 sts & 28 rounds to 10cm");
  // Nothing is begun by looking.
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("project-")))).toEqual([]);

  // The pattern's tension put back, the page is the pattern's again; and another tension is another question.
  await page.getByRole("tablist", { name: "Size: its pages" }).getByRole("tab", { name: "Size", exact: true }).click();
  await shown.getByRole("button", { name: "Change", exact: true }).click();
  await card.getByRole("button", { name: "Back to the pattern as written", exact: true }).click();
  await expect(card).toHaveCount(0);
  await expect(shown).toHaveCount(0);
  await expect(page.locator(".stage-badge")).not.toContainText("rounds");
  await expect(section).toContainText("28 stitches and 32 rounds to 10cm");
  await expect(page.getByRole("tab", { name: "Size M, finished", exact: true })).toHaveCount(1);
  await recalculateFor(page, 24, 28);
  await expect(shown).toBeVisible({ timeout: 90_000 });

  // The last tab says that starting starts this one, and does.
  await page.getByRole("tab", { name: "Start", exact: true }).click();
  await expect(page.locator(".ready-choices")).toContainText("Recalculated for yours");
  await page.getByRole("button", { name: "Start knitting", exact: true }).click();
  await expect(page.locator(".knitting-panel")).toContainText("of 112 stitches", { timeout: 30_000 });
  const started = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((key) => key.startsWith("project-")))));
  const current = editions.hamefarin.m.current;
  expect(started).toMatchObject({ sizeId: "m", progress: 0, tension: { stitchesPer10cm: 24, roundsPer10cm: 28 }, upTo: current, fit: { from: current } });
  expect(started.fit.round).toBeUndefined();
  expect(started.edition).not.toBe(current);
  // Its project's page says so, and until a stitch is worked the pattern as written can be gone back to.
  await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
  await page.getByRole("link", { name: "Close the chart", exact: true }).click();
  await page.getByRole("tab", { name: "Fit", exact: true }).click();
  const own = page.getByRole("region", { name: "Your tension" });
  await expect(own).toContainText("Your pattern is recalculated for this tension, from the cast-on.", { timeout: 20_000 });
  await own.getByRole("button", { name: "Go back to the pattern as written", exact: true }).click();
  await expect(own.getByRole("heading", { name: "Recalculate the rest" })).toBeVisible();
  expect((await page.evaluate((id) => JSON.parse(localStorage.getItem(id)), started.id)).edition).toBe(current);
});

test("Each Year Once for a tension chosen with the size: every year, from the cast-on, and nothing to choose between", async ({ page }) => {
  test.setTimeout(240_000);
  await withoutSettling(page);
  await page.goto(`#/sweater/${design}?size=l&tab=size`);
  const section = page.getByRole("region", { name: "Tension", exact: true });
  await expect(section).toContainText("32 stitches and 38 rounds to 10cm", { timeout: 20_000 });
  await recalculateFor(page, 23.3, 25);
  const shown = section.locator(".size-recalculated");
  await expect(shown).toBeVisible({ timeout: 150_000 });
  await shown.getByRole("button", { name: "Change", exact: true }).click();
  const card = tensionCard(page);
  await card.getByText("What recalculating changed").click();
  // All thirteen years, from 2014 round the yoke.
  await expect(card).toContainText(/The yoke has \d+ rounds, 2014 to 20\d\d, and grows from \d+ stitches to \d+\./);
  await expect(card).not.toContainText("Left out");
  // Fewer years, each fuller, is a way of laying out the rest of one part knitted: with nothing knitted there is nothing to choose between.
  await expect(card.getByRole("radio")).toHaveCount(0);
  await expect(card.locator(".refit-written")).toContainText(/Cast on \d+/);
  await card.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("tab", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Start knitting", exact: true }).click();
  await expect(page.locator(".knitting-panel")).toContainText(/of \d+ stitches/, { timeout: 30_000 });
  const started = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((key) => key.startsWith("project-")))));
  expect(started).toMatchObject({ sizeId: "l", progress: 0, tension: { stitchesPer10cm: 23.3, roundsPer10cm: 25 }, upTo: edition, fit: { from: edition } });
  expect(started.fit.round).toBeUndefined();
  expect(started.fit.option).toBeUndefined();
  expect(started.made).toEqual({ steps: [{ fit: { stitchesPer10cm: 23.3, roundsPer10cm: 25 } }] });
  // Every year is placed, from the neck down, for a colourway that steps down the sweater.
  expect(Object.keys(started.fit.placement.places)[0]).toBe("2014");
  expect(Object.keys(started.fit.placement.places)).toHaveLength(13);
});

/*
 * The designs worked out whole, and not on from part knitted: each on its
 * design's page, from a tension chosen there. What each lays out is the
 * compiler's (see src/compiler/fit.test.ts); this is that its page offers
 * it, becomes what it came to and starts it.
 */
for (const { design, size, written, swatch, says, casts } of [
  { design: "paul-klee", size: "m1", written: [22, 34], swatch: [24, 37], says: /The yoke is the pattern's size L, as written: at your tension its 260 stitches round the body come nearest M1's measurements\./, casts: 118 },
  { design: "wool-week-strips-lined-oldest", size: "m", written: [32, 38], swatch: [28, 34], says: /Every year is a strip of 13 to 16 rounds at this tension/, casts: 128 },
  { design: "feline-raglan", size: "m", written: [32, 38], swatch: [28, 34], says: /Each feline is drawn afresh for this tension: \d+ stitches wide and \d+ rounds tall/, casts: 128 },
  { design: "feline-yoke", size: "m", written: [32, 38], swatch: [28, 34], says: /Each feline is drawn afresh for this tension: \d+ stitches wide and \d+ rounds tall/, casts: 128 },
]) {
  test(`${design} for a tension chosen with the size: worked out from the cast-on, and only then`, async ({ page }) => {
    test.setTimeout(240_000);
    await withoutSettling(page);
    await page.goto(`#/sweater/${design}?size=${size}&tab=size`);
    const section = page.getByRole("region", { name: "Tension", exact: true });
    await expect(section).toContainText(`${written[0]} stitches and ${written[1]} rounds to 10cm`, { timeout: 30_000 });
    await recalculateFor(page, swatch[0], swatch[1]);
    const shown = section.locator(".size-recalculated");
    await expect(shown).toBeVisible({ timeout: 150_000 });
    await expect(page.locator(".stage-badge")).toContainText(`${swatch[0]} sts & ${swatch[1]} rounds`);
    await expect(page.locator(".stage .sweater-comparison")).toHaveCount(0);
    await shown.getByRole("button", { name: "Change", exact: true }).click();
    const card = tensionCard(page);
    await card.getByText("What recalculating changed").click();
    await expect(card).toContainText(says);
    await expect(card.locator(".refit-written")).toContainText(`Cast on ${casts}`);
    await card.getByRole("button", { name: "Close", exact: true }).click();

    await page.getByRole("tab", { name: "Start", exact: true }).click();
    await expect(page.locator(".ready-choices")).toContainText("Recalculated for yours");
    await page.getByRole("button", { name: "Start knitting", exact: true }).click();
    await expect(page.locator(".knitting-panel")).toContainText(/of \d+ stitches/, { timeout: 30_000 });
    const started = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((key) => key.startsWith("project-")))));
    const current = editions[design][size].current;
    expect(started).toMatchObject({ sizeId: size, progress: 0, tension: { stitchesPer10cm: swatch[0], roundsPer10cm: swatch[1] }, upTo: current, fit: { from: current }, made: { steps: [{ fit: { stitchesPer10cm: swatch[0], roundsPer10cm: swatch[1] } }] } });
    expect(started.fit.round).toBeUndefined();
    expect(started.edition).not.toBe(current);
    // Its page says it is, and offers nothing more to work out: the rest of one begun can't be.
    await page.getByRole("button", { name: "Stop knitting", exact: true }).click();
    await page.getByRole("link", { name: "Close the chart", exact: true }).click();
    await page.getByRole("tab", { name: "Fit", exact: true }).click();
    const own = page.getByRole("region", { name: "Your tension" });
    await expect(own).toContainText("Your pattern is recalculated for this tension, from the cast-on.", { timeout: 30_000 });
    await expect(own.getByRole("heading", { name: "Recalculate the rest" })).toHaveCount(0);
  });
}

test("a tension the design can't be laid out at says why, and the pattern stays as written", async ({ page }) => {
  await page.goto("#/sweater/wool-week-strips-lined-oldest?size=m&tab=size");
  const section = page.getByRole("region", { name: "Tension", exact: true });
  await expect(section).toContainText("32 stitches and 38 rounds to 10cm", { timeout: 30_000 });
  await recalculateFor(page, 22, 26);
  const alert = section.getByRole("alert");
  await expect(alert).toContainText("The pattern can't be recalculated for that tension.", { timeout: 60_000 });
  await expect(alert).toContainText("thirteen strips will not go in");
  await expect(section.locator(".size-recalculated")).toHaveCount(0);
  await page.getByRole("tab", { name: "Start", exact: true }).click();
  await expect(page.locator(".ready-choices")).toContainText("As the pattern");
});

test("a design worked out only from the cast-on does not offer to be once it is begun, and says why", async ({ page }) => {
  await page.goto("");
  await page.evaluate((id) => {
    const now = new Date().toISOString();
    localStorage.setItem(id, JSON.stringify({
      version: 1, id, sweaterId: "paul-klee", sizeId: "m1", colourwayId: "klee", progress: 0, tension: { stitchesPer10cm: 24, roundsPer10cm: 30 }, startedAt: now, updatedAt: now,
    }));
  }, id);
  await page.goto("#/project/1760000000000?tab=fit");
  const section = page.getByRole("region", { name: "Your tension" });
  await expect(section.getByRole("table")).toBeVisible();
  await expect(section.getByRole("heading", { name: "Recalculate the rest" })).toHaveCount(0);
  await expect(section).toContainText("This design can only be recalculated for a tension before it is cast on, so this pattern carries on as written.");
  await expect(section).toContainText("start another from the design's page and give your tension there");
});
