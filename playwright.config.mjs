import { defineConfig, devices } from "playwright/test";

const tiles = {
  storageState: {
    cookies: [],
    origins: [{ origin: "http://127.0.0.1:4319", localStorage: [{ name: "chart", value: "tiles" }] }],
  },
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  maxFailures: process.env.CI ? 1 : 0,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4319/sweat-shop/", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
    // The same again with the chart on canvas tiles, as "?chart=tiles" leaves it chosen.
    { name: "desktop-tiles", use: { ...devices["Desktop Chrome"], ...tiles } },
    { name: "phone-tiles", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", ...tiles } },
  ],
  webServer: { command: "npm run preview -- --host 127.0.0.1 --port 4319 --strictPort",
    url: "http://127.0.0.1:4319/sweat-shop/", reuseExistingServer: !process.env.CI },
});
