import { readFileSync } from "node:fs";
import { test, expect } from "playwright/test";

/*
 * A jumper's address says everything that makes it, and makes it again where
 * the jumper is not kept: see src/projects/link and src/projects/remake.
 */
test.use({ serviceWorkers: "block" });

const id = "project-1760000000000";
const design = "wool-week-strips-once-oldest";
const editions = JSON.parse(readFileSync("src/library/editions/manifest.json", "utf8"));
const edition = editions[design].l.current;
const file = JSON.parse(readFileSync(`public/editions/${design}--l--${edition}.json`, "utf8"));
const endOf = (round) => {
  const runs = file.rounds[round - 1];
  return runs[runs.length - 2] + runs[runs.length - 1] - 1;
};
const loose = { stitchesPer10cm: 23.3, roundsPer10cm: 25 };

/** A jumper part knitted, as the browser keeps it. */
const kept = (page, more = {}) =>
  page.evaluate(({ id, design, edition, progress, more }) => {
    localStorage.setItem(id, JSON.stringify({
      version: 1, id, name: "Dad's, for Yule", sweaterId: design, sizeId: "l", colourwayId: "night-gentle-dark", edition, progress,
      startedAt: "2026-10-03T09:00:00.000Z", updatedAt: "2026-10-03T09:00:00.000Z", ...more,
    }));
  }, { id, design, edition, progress: endOf(68), more });

const saved = (page, key = id) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
/** What a jumper's address says, read as the site writes it. */
const said = (url) => JSON.parse(Buffer.from(new URL(url.replace("#", "")).searchParams.get("jumper"), "base64url").toString());
const withSaid = (url, change) => url.replace(/jumper=[0-9A-Za-z_-]+/, `jumper=${Buffer.from(JSON.stringify({ ...said(url), ...change })).toString("base64url")}`);
/** The browser as one that has cleared what it kept, and the address opened in it afresh. */
const openCleared = async (page, url) => {
  await page.goto("");
  await page.evaluate(() => localStorage.clear());
  await page.goto(url);
  await page.reload();
};

const withoutSettling = (page) =>
  page.route(/settle\.worker[^/]*\.js/, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'self.onmessage = () => { self.postMessage({ shape: "not-settled" }); self.postMessage({ positions: new Float32Array(0), rested: false }); };',
    }));

test("a jumper's address carries the jumper: opened where it is not kept, it is carried on where it was or begun as one like it", async ({ page, context }) => {
  await page.goto("");
  await kept(page);
  await page.goto("#/project/1760000000000");
  // Its link is in its address without being asked for, and follows the jumper to its chart and as it is knitted.
  await expect(page).toHaveURL(/\/project\/1760000000000\?jumper=[0-9A-Za-z_-]+$/);
  expect(said(page.url())).toMatchObject({ v: 1, i: "1760000000000", n: "Dad's, for Yule", d: design, s: "l", c: "night-gentle-dark", e: edition, p: endOf(68) });
  await page.locator(".pages-page[data-current]").getByRole("link", { name: "Keep knitting", exact: true }).click();
  await expect(page).toHaveURL(/\/chart\?knitting=1&jumper=/);
  // A round knitted is in it once the knitting pauses - and at once where the page is put away, the phone locked mid-round.
  await page.getByRole("button", { name: "End of round", exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(said(page.url()).p).toBeGreaterThan(endOf(68));
  expect(page.url()).toMatch(/\/chart\?knitting=1&jumper=/);
  await page.goto("#/project/1760000000000");

  // And is what its own page gives to keep or to send.
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("tab", { name: "This jumper", exact: true }).click();
  const link = page.locator(".jumper-link");
  await link.scrollIntoViewIfNeeded();
  await link.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(link.getByRole("status")).toHaveText("Link copied.");
  const address = await page.evaluate(() => navigator.clipboard.readText());
  expect(address).toMatch(/#\/project\/1760000000000\?jumper=[0-9A-Za-z_-]+$/);
  const progress = (await saved(page)).progress;
  expect(said(address).p).toBe(progress);

  // The browser clears what it kept. The address is still the jumper.
  await openCleared(page, address);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dad's, for Yule");
  await expect(page.locator(".page")).toContainText("This jumper is not kept on this device.");
  await expect(page.locator(".page")).toContainText("size L");
  await page.getByRole("button", { name: "Carry on where it was", exact: true }).click();
  await expect(page.locator(".pages-page[data-current]")).toContainText("Where you are", { timeout: 20_000 });
  expect(await saved(page)).toMatchObject({ id, name: "Dad's, for Yule", sweaterId: design, sizeId: "l", colourwayId: "night-gentle-dark", edition, progress, startedAt: "2026-10-03T09:00:00.000Z" });

  // Sent to someone else, it is one like it of their own: begun at the cast-on, under its own address.
  await openCleared(page, address);
  await page.getByRole("button", { name: "Start one like it", exact: true }).click();
  await expect(page.locator(".pages-page[data-current]")).toContainText("Where you are", { timeout: 20_000 });
  await expect(page).not.toHaveURL(/1760000000000/);
  const theirs = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("project-")).map((key) => JSON.parse(localStorage.getItem(key))));
  expect(theirs).toHaveLength(1);
  expect(theirs[0]).toMatchObject({ sweaterId: design, sizeId: "l", colourwayId: "night-gentle-dark", edition, progress: 0 });
  expect(theirs[0].name).toBeUndefined();

  // Where the site is on a Home Screen there is no address bar: the link is pasted into Settings.
  await page.goto("");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await settings.getByRole("textbox", { name: "A jumper's link" }).fill("not a link");
  await settings.getByRole("button", { name: "Open", exact: true }).click();
  await expect(settings).toContainText("That is not a jumper's link.");
  await settings.getByRole("textbox", { name: "A jumper's link" }).fill(address);
  await settings.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.locator(".page")).toContainText("This jumper is not kept on this device.");

  // A jumper not begun is the same whoever opens it: it keeps the address it came by, which opens it from then on.
  await page.goto("");
  await page.goto(withSaid(address, { p: undefined }));
  await page.reload();
  await page.getByRole("button", { name: "Start knitting it", exact: true }).click();
  await expect(page.locator(".pages-page[data-current]")).toContainText("Where you are", { timeout: 20_000 });
  expect(await saved(page)).toMatchObject({ id, name: "Dad's, for Yule", progress: 0 });
  await page.goto(withSaid(address, { p: undefined }));
  await page.reload();
  await expect(page.locator(".pages-page[data-current]")).toContainText("Where you are", { timeout: 20_000 });

  // An address that says nothing is no jumper.
  await page.goto("#/project/1760000000009?jumper=nonsense");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("No such project");
});

test("a jumper whose pattern was recalculated is made again from its address, stitch for stitch, or said not to be", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto("");
  await kept(page, { tension: loose });
  await withoutSettling(page);
  await page.goto("#/project/1760000000000?tab=fit");
  const section = page.getByRole("region", { name: "Your tension" });
  await section.getByRole("button", { name: "Recalculate the rest", exact: true }).click();
  const shown = section.locator(".refit-shown");
  await expect(shown).toBeVisible({ timeout: 90_000 });
  await shown.getByRole("radio", { name: /Fewer years, fuller/ }).check();
  await shown.getByRole("button", { name: "Knit the rest this way", exact: true }).click();
  await expect(section).toContainText("The rest of your pattern is recalculated for this tension", { timeout: 20_000 });
  const mine = await saved(page);
  expect(mine.made).toEqual({ from: edition, steps: [{ fit: loose, round: 68, option: "fewer" }] });
  const pattern = await saved(page, `edition-${design}--l--${mine.edition}`);

  // Its address says how the pattern was made, and names what came of it.
  await expect.poll(() => said(page.url()).e, { timeout: 10_000 }).toBe(mine.edition);
  expect(said(page.url()).m).toEqual({ f: edition, s: [["f", 23.3, 25, 68, "fewer"]] });
  const address = page.url().replace(/tab=fit&/, "");

  // Nothing of it is kept. It is planned again as it was, and is the same pattern: the same name, the same rounds, the same fit.
  await openCleared(page, address);
  await expect(page.locator(".page")).toContainText("its pattern recalculated for 23.3 stitches and 25 rounds to 10cm");
  await page.getByRole("button", { name: "Carry on where it was", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Making its pattern again" })).toBeVisible();
  await expect(page.locator(".pages-page[data-current]")).toContainText("Where you are", { timeout: 120_000 });
  const again = await saved(page);
  expect(again).toMatchObject({ id, edition: mine.edition, progress: mine.progress, made: mine.made, tension: loose });
  expect(again.fit).toEqual(mine.fit);
  expect(await saved(page, `edition-${design}--l--${mine.edition}`)).toEqual(pattern);

  // A link that names another pattern than the one its making comes to - as one made before the planning changed would - is not given a pattern that is nearly it.
  await openCleared(page, withSaid(address, { e: "0123456789ab" }));
  await page.getByRole("button", { name: "Start one like it", exact: true }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("can't be made again exactly as it was", { timeout: 120_000 });
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => /^(project|edition)-/.test(key)))).toEqual([]);
  // The pattern as written is offered in its place, the knitter's tension kept to recalculate it by.
  await alert.getByRole("button", { name: "Start on the pattern as written", exact: true }).click();
  await expect(page.locator(".pages-page[data-current]")).toContainText("Where you are", { timeout: 20_000 });
  const written = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("project-")).map((key) => JSON.parse(localStorage.getItem(key))));
  expect(written).toHaveLength(1);
  expect(written[0]).toMatchObject({ edition, progress: 0, tension: loose });
  expect(written[0].made).toBeUndefined();
});
