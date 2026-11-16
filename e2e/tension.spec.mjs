import { test, expect } from "playwright/test";

/*
 * A knitter's own tension, entered on a project's page, and what the pattern
 * knits up to at it: see src/ui/components/MyTension.
 */
test.use({ serviceWorkers: "block" });

const id = "project-1760000000000";

test("a measured tension shows what the pattern knits up to as written, and is kept", async ({ page }) => {
  await page.goto("");
  await page.evaluate((id) => {
    const now = new Date().toISOString();
    localStorage.setItem(id, JSON.stringify({
      version: 1, id, sweaterId: "wool-week-strips-once-oldest", sizeId: "l", colourwayId: "night-gentle-dark", progress: 400, startedAt: now, updatedAt: now,
    }));
  }, id);
  await page.goto("#/project/1760000000000?tab=fit");
  const section = page.getByRole("region", { name: "Your tension" });
  // The largest of patterns to open: its page takes a moment.
  await expect(section).toContainText("written for 32 stitches and 38 rounds to 10cm", { timeout: 20_000 });
  await expect(section.getByRole("table")).toHaveCount(0);

  await section.getByLabel("Stitches counted").fill("14");
  await section.getByLabel("Centimetres the stitches were counted over").fill("6");
  await section.getByLabel("Rounds counted").fill("50");
  await section.getByLabel("Centimetres the rounds were counted over").fill("20");
  await section.getByRole("button", { name: "Compare with the pattern", exact: true }).click();

  await expect(section.getByRole("status")).toContainText("23.3 stitches and 25 rounds to 10cm");
  const chest = section.getByRole("row", { name: /Chest/ });
  await expect(chest).toContainText("116cm");
  await expect(chest).toContainText("159.5cm");
  await expect(section.getByRole("row", { name: /Yoke depth/ })).toContainText("35.5cm");
  expect((await page.evaluate((id) => JSON.parse(localStorage.getItem(id)), id)).tension).toEqual({ stitchesPer10cm: 23.3, roundsPer10cm: 25 });

  // Kept with the project, and still there when it is opened again.
  await page.reload();
  await expect(page.getByRole("region", { name: "Your tension" }).getByRole("row", { name: /Chest/ })).toContainText("159.5cm");
  await page.getByRole("region", { name: "Your tension" }).getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByRole("region", { name: "Your tension" }).getByRole("table")).toHaveCount(0);
  expect((await page.evaluate((id) => JSON.parse(localStorage.getItem(id)), id)).tension).toBeUndefined();
});

test("the pattern's own tension comes out as designed", async ({ page }) => {
  await page.goto("");
  await page.evaluate((id) => {
    const now = new Date().toISOString();
    localStorage.setItem(id, JSON.stringify({
      version: 1, id, sweaterId: "hamefarin", sizeId: "m", colourwayId: "simmer-dim", progress: 0, tension: { stitchesPer10cm: 28, roundsPer10cm: 32 }, startedAt: now, updatedAt: now,
    }));
  }, id);
  await page.goto("#/project/1760000000000?tab=fit");
  const section = page.getByRole("region", { name: "Your tension" });
  await expect(section.getByRole("status")).toContainText("comes out as designed");
  await expect(section.getByRole("table")).toHaveCount(0);
});
