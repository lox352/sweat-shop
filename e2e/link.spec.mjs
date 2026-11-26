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
  }, { id, design, edition, progress: endOf(64), more });

const saved = (page, key = id) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
/** What a jumper's address says, read as the site writes it. */
const said = (url) => {
  const link = new URL(url.replace("#", "")).searchParams.get("jumper");
  return link ? JSON.parse(Buffer.from(link, "base64url").toString()) : {};
};
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
  expect(said(page.url())).toMatchObject({ v: 1, i: "1760000000000", n: "Dad's, for Yule", d: design, s: "l", c: "night-gentle-dark", e: edition, p: endOf(64) });
  await page.locator(".pages-page[data-current]").getByRole("link", { name: "Keep knitting", exact: true }).click();
  await expect(page).toHaveURL(/\/chart\?knitting=1&jumper=/);
  // A round knitted is in it once the knitting pauses - and at once where the page is put away, the phone locked mid-round.
  await page.getByRole("button", { name: "End of round", exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(said(page.url()).p).toBeGreaterThan(endOf(64));
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
  // Its link is in its address again at once: it has changed from nothing, and waits for no pause.
  await expect(page).toHaveURL(/\/project\/1760000000000\?jumper=[0-9A-Za-z_-]+$/, { timeout: 1500 });
  expect(said(page.url())).toMatchObject({ i: "1760000000000", p: progress });

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
  expect(mine.made).toEqual({ from: edition, steps: [{ fit: loose, round: 64, option: "fewer" }] });
  const pattern = await saved(page, `edition-${design}--l--${mine.edition}`);

  // Its address says how the pattern was made, and names what came of it.
  await expect.poll(() => said(page.url()).e, { timeout: 10_000 }).toBe(mine.edition);
  expect(said(page.url()).m).toEqual({ f: edition, s: [["f", 23.3, 25, 64, "fewer"]] });
  // A jumper recalculated before its making was kept says only what its last fit was: its address is made of that, and says the same.
  await page.evaluate(({ id, project }) => localStorage.setItem(id, JSON.stringify(project)), { id, project: { ...mine, made: undefined } });
  await page.reload();
  await expect(page).toHaveURL(/jumper=/);
  expect((await saved(page)).made).toBeUndefined();
  expect(said(page.url())).toMatchObject({ e: mine.edition, m: { f: edition, s: [["f", 23.3, 25, 64, "fewer"]] } });
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

test("a jumper recalculated from the cast-on at one tension, part knitted, and recalculated again at another is made again from its address", async ({ page }) => {
  test.setTimeout(300_000);
  await withoutSettling(page);
  const first = { stitchesPer10cm: 24, roundsPer10cm: 28 };
  const second = { stitchesPer10cm: 22, roundsPer10cm: 26 };
  // Begun on a pattern recalculated for the knitter's tension, before a stitch is cast on.
  await page.goto("#/sweater/hamefarin?size=m&tab=size");
  const given = page.getByRole("region", { name: "Tension", exact: true });
  await given.getByRole("button", { name: "Change", exact: true }).click();
  const card = page.getByRole("dialog", { name: "Your tension" });
  await card.getByLabel("Stitches to 10cm").fill("24");
  await card.getByLabel("Rounds to 10cm").fill("28");
  await card.getByRole("button", { name: "Recalculate the pattern", exact: true }).click();
  await expect(given.locator(".size-recalculated")).toBeVisible({ timeout: 90_000 });
  await page.getByRole("tab", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Start knitting", exact: true }).click();
  await expect(page.locator(".knitting-panel")).toContainText("of 112 stitches", { timeout: 30_000 });
  const key = await page.evaluate(() => Object.keys(localStorage).find((key) => key.startsWith("project-")));
  const begun = await saved(page, key);
  expect(begun.made).toEqual({ steps: [{ fit: first }] });

  // Knitted at that tension to part way down the yoke; then the knitter's tension turns out to be another, and the rest is recalculated for it.
  const lastOf = (file, round) => {
    const runs = file.rounds[round - 1];
    return runs[runs.length - 2] + runs[runs.length - 1] - 1;
  };
  const firstPattern = await saved(page, `edition-hamefarin--m--${begun.edition}`);
  await page.evaluate(({ key, project }) => localStorage.setItem(key, JSON.stringify(project)), {
    key,
    project: { ...begun, progress: lastOf(firstPattern, 12), tension: second, updatedAt: new Date().toISOString() },
  });
  await page.goto(`#/project/${key.replace("project-", "")}?tab=fit`);
  await page.reload();
  const section = page.getByRole("region", { name: "Your tension" });
  await section.getByRole("button", { name: "Recalculate the rest", exact: true }).click();
  await expect(section.locator(".refit-shown")).toBeVisible({ timeout: 90_000 });
  await section.locator(".refit-shown").getByRole("button", { name: "Knit the rest this way", exact: true }).click();
  await expect(section).toContainText("The rest of your pattern is recalculated for this tension", { timeout: 20_000 });
  const twice = await saved(page, key);
  // How it was made is both, in order: the whole at the first tension, then the rest at the second from the end of a band.
  expect(twice.made.steps).toHaveLength(2);
  expect(twice.made).toMatchObject({ steps: [{ fit: first }, { fit: second }] });
  const cut = twice.made.steps[1].round;
  expect(cut).toBeGreaterThanOrEqual(12);
  expect(twice.edition).not.toBe(begun.edition);
  const pattern = await saved(page, `edition-hamefarin--m--${twice.edition}`);
  // The rounds knitted are as they were knitted.
  expect(pattern.rounds.slice(0, cut)).toEqual(firstPattern.rounds.slice(0, cut));

  // Knitted on, past where it was recalculated from.
  const progress = lastOf(pattern, cut + 6);
  await page.evaluate(({ key, project }) => localStorage.setItem(key, JSON.stringify(project)), { key, project: { ...twice, progress, updatedAt: new Date().toISOString() } });
  await page.goto(`#/project/${key.replace("project-", "")}`);
  await page.reload();
  await expect.poll(() => said(page.url()).p, { timeout: 15_000 }).toBe(progress);
  expect(said(page.url()).m).toEqual({ s: [["f", 24, 28, 0], ["f", 22, 26, cut]] });
  const address = page.url();
  const mine = await saved(page, key);

  // Nothing kept: both recalculations are done again, in order, and come to the same pattern, with the place in it.
  await openCleared(page, address);
  await page.getByRole("button", { name: "Carry on where it was", exact: true }).click();
  await expect(page.locator(".pages-page[data-current]")).toContainText("Where you are", { timeout: 180_000 });
  const again = await saved(page, key);
  expect(again).toMatchObject({ edition: mine.edition, progress, made: mine.made, tension: second });
  expect(again.fit).toEqual({ ...mine.fit, from: again.fit.from });
  expect(await saved(page, `edition-hamefarin--m--${mine.edition}`)).toEqual(pattern);
  // The first pattern, which nothing knits now, is not kept.
  expect(await saved(page, `edition-hamefarin--m--${begun.edition}`)).toBeNull();
});

/*
 * No size has been superseded for these to open, so one is made up, as
 * e2e/editions.spec.mjs makes it: Hamefarin's medium as it is now, under an
 * older name, with its last two yarns the other way round.
 */
const hamefarin = editions.hamefarin.m.current;
const older = "0123456789ab";
const hamefarinFile = () => JSON.parse(readFileSync(`public/editions/hamefarin--m--${hamefarin}.json`, "utf8"));
const olderFile = () => {
  const file = hamefarinFile();
  file.edition = older;
  const slots = file.stitches.slots;
  [slots[slots.length - 1], slots[slots.length - 2]] = [slots[slots.length - 2], slots[slots.length - 1]];
  return JSON.stringify(file);
};
const servingOlder = (page) => page.route(`**/editions/hamefarin--m--${older}.json`, (route) => route.fulfill({ contentType: "application/json", body: olderFile() }));
const updated = (page) => page.getByRole("complementary", { name: "This pattern has been updated" });

test("a jumper on an older edition, joined to its update part way and then recalculated, is made again from its address at each of the three", async ({ page }) => {
  test.setTimeout(300_000);
  await servingOlder(page);
  await withoutSettling(page);
  // Part way round round 50 of the yoke, on the edition before the size's now.
  const progress = hamefarinFile().rounds[49][0] + 100;
  await page.goto("");
  await page.evaluate(({ id, older, progress }) => {
    const now = new Date().toISOString();
    localStorage.setItem(id, JSON.stringify({ version: 1, id, sweaterId: "hamefarin", sizeId: "m", colourwayId: "simmer-dim", progress, edition: older, startedAt: now, updatedAt: now }));
  }, { id, older, progress });
  await page.goto("#/project/1760000000000");
  await expect(updated(page)).toContainText("is the same pattern again at Yoke, round 50");

  // On an edition the size has moved on from: its address names that edition, and makes the jumper again on it - not on the size's now.
  await expect(page).toHaveURL(/jumper=/);
  expect(said(page.url())).toMatchObject({ e: older, p: progress });
  expect(said(page.url()).m).toBeUndefined();
  const onOlder = page.url();
  await openCleared(page, onOlder);
  await page.getByRole("button", { name: "Carry on where it was", exact: true }).click();
  await expect(updated(page)).toContainText("is the same pattern again at Yoke, round 50", { timeout: 20_000 });
  expect(await saved(page)).toMatchObject({ id, edition: older, progress });

  // Joined to the update from the end of the round in hand: the knitting is the jumper's own, and its address says what it was joined to and where.
  await updated(page).getByRole("button", { name: "Update from the end of Yoke, round 50", exact: true }).click();
  await expect(updated(page)).toHaveCount(0);
  const joined = await saved(page);
  expect(joined.made).toEqual({ from: older, steps: [{ join: hamefarin, round: 50 }] });
  const joinedPattern = await saved(page, `edition-hamefarin--m--${joined.edition}`);
  await expect.poll(() => said(page.url()).e, { timeout: 10_000 }).toBe(joined.edition);
  expect(said(page.url()).m).toEqual({ f: older, s: [["j", hamefarin, 50]] });
  const onJoined = page.url();
  await openCleared(page, onJoined);
  await page.getByRole("button", { name: "Carry on where it was", exact: true }).click();
  await expect(page.locator(".pages-page[data-current]")).toContainText("Where you are", { timeout: 30_000 });
  // The same knitting, by name and by stitch; up to date with the size's, so no update is offered it again.
  expect(await saved(page)).toMatchObject({ id, edition: joined.edition, progress, made: joined.made, upTo: hamefarin });
  expect(await saved(page, `edition-hamefarin--m--${joined.edition}`)).toEqual(joinedPattern);
  await expect(updated(page)).toHaveCount(0);

  // And then the rest recalculated for the knitter's tension: its address says both, in order.
  const tension = { stitchesPer10cm: 24, roundsPer10cm: 28 };
  await page.evaluate(({ id, project }) => localStorage.setItem(id, JSON.stringify(project)), { id, project: { ...(await saved(page)), tension, updatedAt: new Date().toISOString() } });
  await page.goto("#/project/1760000000000?tab=fit");
  await page.reload();
  const section = page.getByRole("region", { name: "Your tension" });
  await section.getByRole("button", { name: "Recalculate the rest", exact: true }).click();
  await expect(section.locator(".refit-shown")).toBeVisible({ timeout: 90_000 });
  await section.locator(".refit-shown").getByRole("button", { name: "Knit the rest this way", exact: true }).click();
  await expect(section).toContainText("The rest of your pattern is recalculated for this tension", { timeout: 20_000 });
  const fitted = await saved(page);
  expect(fitted.made).toMatchObject({ from: older, steps: [{ join: hamefarin, round: 50 }, { fit: tension }] });
  const cut = fitted.made.steps[1].round;
  expect(cut).toBeGreaterThanOrEqual(50);
  const fittedPattern = await saved(page, `edition-hamefarin--m--${fitted.edition}`);
  await expect.poll(() => said(page.url()).e, { timeout: 10_000 }).toBe(fitted.edition);
  expect(said(page.url()).m).toEqual({ f: older, s: [["j", hamefarin, 50], ["f", 24, 28, cut]] });
  await openCleared(page, page.url().replace(/tab=fit&/, ""));
  await page.getByRole("button", { name: "Carry on where it was", exact: true }).click();
  await expect(page.locator(".pages-page[data-current]")).toContainText("Where you are", { timeout: 120_000 });
  const again = await saved(page);
  expect(again).toMatchObject({ id, edition: fitted.edition, progress, made: fitted.made, tension });
  // What the fit left - the knitting joined to the update - is kept where the fit was taken, to go back to: an address has the knitting, not that.
  expect(fitted.fit.before).toMatchObject({ edition: joined.edition, made: joined.made, upTo: hamefarin });
  const { before: _left, ...fit } = fitted.fit;
  expect(again.fit).toEqual(fit);
  expect(await saved(page, `edition-hamefarin--m--${fitted.edition}`)).toEqual(fittedPattern);
});

test("where a jumper can't be made again from its address, it says why, and what can be done", async ({ page }) => {
  test.setTimeout(120_000);
  const written = (more) => `#/project/1760000000000?jumper=${Buffer.from(JSON.stringify({ v: 1, i: "1760000000000", d: design, s: "l", c: "night-gentle-dark", p: endOf(64), ...more })).toString("base64url")}`;
  const alert = page.getByRole("alert");

  // Its pattern can't be fetched: asked for again, it can.
  await page.goto("");
  await page.goto(written({ e: edition }));
  await page.reload();
  await page.route("**/editions/**", (route) => route.abort());
  await page.getByRole("button", { name: "Carry on where it was", exact: true }).click();
  await expect(alert).toContainText("Its pattern could not be fetched. Check your connection and try again.");
  await expect(alert.getByRole("button", { name: "Start on the pattern as written" })).toHaveCount(0);
  expect(await saved(page)).toBeNull();
  await page.unroute("**/editions/**");
  await alert.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByRole("button", { name: "Carry on where it was", exact: true }).click();
  await expect(page.locator(".pages-page[data-current]")).toContainText("Where you are", { timeout: 20_000 });
  expect(await saved(page)).toMatchObject({ id, edition, progress: endOf(64) });

  // It names an edition the site never published, and does not say how it was made: a jumper's own, from before a link said.
  await openCleared(page, written({ e: "0123456789ab" }));
  await page.getByRole("button", { name: "Carry on where it was", exact: true }).click();
  await expect(alert).toContainText("made before a link said how");
  await expect(alert.getByRole("button", { name: "Start on the pattern as written", exact: true })).toBeVisible();

  // It says its pattern was recalculated from a round the design can't plan on from, or a way the design has not got: nothing is planned, and nothing kept.
  for (const [step, why] of [
    // (Round 5 is in the neck's ribbing. Any round of a year on the yoke can be planned on from: see refit.spec.)
    [["f", 23.3, 25, 5, "fewer"], "can't be worked out again from where you are"],
    [["f", 23.3, 25, 64, "sideways"], "the design no longer has it"],
  ]) {
    await openCleared(page, written({ e: "0123456789ab", g: [23.3, 25], m: { f: edition, s: [step] } }));
    await page.getByRole("button", { name: "Start one like it", exact: true }).click();
    await expect(alert).toContainText(why, { timeout: 30_000 });
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => /^(project|edition)-/.test(key)))).toEqual([]);
  }
  // The pattern as written, in its place, with the tension the link had.
  await alert.getByRole("button", { name: "Start on the pattern as written", exact: true }).click();
  await expect(page.locator(".pages-page[data-current]")).toContainText("Where you are", { timeout: 20_000 });
  const started = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("project-")).map((key) => JSON.parse(localStorage.getItem(key))));
  expect(started).toHaveLength(1);
  expect(started[0]).toMatchObject({ edition, progress: 0, tension: loose });
});
