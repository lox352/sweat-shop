/**
 * The site's icons as a phone's Home Screen wants them, drawn from the one
 * it has: public/favicon.svg.
 *
 *     node scripts/icons.mjs
 *
 * A Home Screen takes pictures, not drawings, each at its own size: Apple's
 * at 180, and the manifest's at 192 and 512. One more is drawn smaller on
 * its ground, for a launcher that cuts its icons to a circle and would lose
 * the corners of the band (the manifest's "maskable"). Run when the favicon
 * changes, and the pictures kept beside it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const drawing = readFileSync("public/favicon.svg", "utf8");
const ground = /<rect width="16" height="16" fill="(#[0-9a-f]{6})"/.exec(drawing)?.[1];
if (!ground) throw new Error("The favicon has no ground to draw an icon on.");

/** Each picture: its file, its size, and how much of it the drawing fills. */
const pictures = [
  { file: "apple-touch-icon.png", size: 180, fills: 1 },
  { file: "icon-192.png", size: 192, fills: 1 },
  { file: "icon-512.png", size: 512, fills: 1 },
  { file: "icon-maskable-512.png", size: 512, fills: 0.72 },
];

const browser = await chromium.launch();
try {
  for (const { file, size, fills } of pictures) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const inner = Math.round(size * fills);
    await page.setContent(
      `<body style="margin:0;width:${size}px;height:${size}px;background:${ground};display:grid;place-items:center">` +
        drawing.replace("<svg ", `<svg width="${inner}" height="${inner}" shape-rendering="crispEdges" `) +
        "</body>",
    );
    writeFileSync(`public/${file}`, await page.screenshot({ type: "png" }));
    await page.close();
    console.log(`public/${file}: ${size}px`);
  }
} finally {
  await browser.close();
}
