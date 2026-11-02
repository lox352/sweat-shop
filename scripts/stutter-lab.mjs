/**
 * The stutter lab: what the screen shows as a finger drags across the
 * chart, frame by frame, rather than what the page says of itself.
 *
 * The scroll harness (e2e/scroll) reads the chart from the page's own
 * script, where the box's scroll and the layer the tiles are on are always
 * in step. On a phone they are not: the browser scrolls the box itself, and
 * the page hears of it after, so a layer the page moves for the scroll is
 * drawn a frame behind it. That is the stutter an iPhone showed across the
 * bottom of the chart, and only a recording of the screen shows it. So this
 * runs a browser with a window on a virtual screen, drags across the box
 * with touches the browser scrolls it by on its compositor, records the
 * screen at 60 frames a second, and measures how far the chart moves each
 * frame (see stutter-lab.py): with the layer slid by the browser as it
 * scrolls (see TileView.slideWithScroll), and without (`--without`).
 *
 *   npm run build && npm run preview -- --port 4319 &
 *   xvfb-run -a -s "-screen 0 1280x1024x24" node scripts/stutter-lab.mjs out/run [--without] [--throttle 4] [--diagonal] [--progress 6000]
 *   python3 scripts/stutter-lab.py out/run.mkv ...
 *
 * `--diagonal` draws the finger down and to the right as well, scrolling up
 * and left; `--progress` starts the knitting further on (6000: in the yoke,
 * with rounds above to scroll up into). A phone's own screen recording is
 * measured by scripts/stutter-judge.py.
 *
 * Needs Xvfb, ffmpeg with x11grab, and Python with numpy.
 * CHROMIUM may name a browser to use in place of Playwright's own.
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const out = args.find((arg, k) => !arg.startsWith("--") && !args[k - 1]?.startsWith("--throttle"));
if (!out || !process.env.DISPLAY) {
  console.error("usage: xvfb-run ... node scripts/stutter-lab.mjs <out> [--without]");
  process.exit(1);
}
const without = args.includes("--without");
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : fallback;
};
/*
 * The page slowed as a phone's is against this machine (see scroll-lab.mjs):
 * quick enough, the page puts the layer in the same frame the browser
 * scrolls the box in, and this browser shows no stutter that an iPhone,
 * whose page hears of each scroll a frame after it is drawn, does.
 */
const throttle = Number(option("throttle", "4"));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  headless: false,
  args: ["--window-position=0,0", "--window-size=420,900", "--hide-scrollbars"],
});
// A phone's box, at a pixel a pixel, so the recording is the page's own size.
const context = await browser.newContext({
  viewport: { width: 390, height: 664 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  baseURL: "http://127.0.0.1:4319/sweat-shop/",
});
const page = await context.newPage();
if (without) await page.addInitScript(() => (window.__noSlider = true));
// Each Year Once in a large, in its back neck's short rows: dragging across, columns open and close up as they come into view.
await page.goto("");
await page.evaluate((progress) => {
  const now = new Date().toISOString();
  const id = "project-1760000000000";
  localStorage.clear();
  localStorage.setItem(id, JSON.stringify({ version: 1, id, sweaterId: "wool-week-strips-once-oldest", sizeId: "l", colourwayId: "early-light", progress, startedAt: now, updatedAt: now }));
}, Number(option("progress", "1700")));
await page.goto("#/project/1760000000000/chart?knitting=1");
await page.waitForSelector(".chart-tiles canvas", { timeout: 60000 });
await page.waitForTimeout(2500);
const box = await page.locator(".chart-scroll").boundingBox();

const ffmpeg = spawn("ffmpeg", ["-v", "error", "-y", "-f", "x11grab", "-framerate", "60", "-video_size", "440x920", "-i", `${process.env.DISPLAY}+0,0`, "-c:v", "libx264rgb", "-qp", "0", "-preset", "ultrafast", `${out}.mkv`], { stdio: "inherit" });
await page.waitForTimeout(800);

/*
 * Six strokes of a finger 300 pixels across the box, each in 0.4 seconds,
 * one straight after another: the chart never comes to rest between them,
 * so its layer slides with the scroll throughout, as columns open.
 */
const session = await context.newCDPSession(page);
if (throttle > 1) await session.send("Emulation.setCPUThrottlingRate", { rate: throttle });
const [x, y] = [box.x + box.width / 2, box.y + box.height * 0.5];
// Diagonal, as a finger drawn down and to the right: the chart scrolls up and left, up the yoke, its columns closing.
const [ddx, ddy] = args.includes("--diagonal") ? [300, 160] : [300, 0];
for (let stroke = 0; stroke < 6; stroke++) {
  const steps = 24;
  const from = x - ddx / 2;
  const fromY = y - ddy / 2;
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from, y: fromY }] });
  const began = Date.now();
  for (let k = 1; k <= steps; k++) {
    const wait = began + (k * 1000) / 60 - Date.now();
    if (wait > 0) await new Promise((done) => setTimeout(done, wait));
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from + (ddx * k) / steps, y: fromY + (ddy * k) / steps }] });
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(16);
}
await page.waitForTimeout(500);
ffmpeg.kill("SIGINT");
await new Promise((done) => ffmpeg.on("exit", done));
await browser.close();
