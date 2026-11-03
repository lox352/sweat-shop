# iOS Simulator scroll lab

Scrolls the chart in Safari on the iOS Simulator with real touches, and measures how it went, two ways:

- **In the page.** The scroll harness's own recorder (`e2e/scroll/recorder.js`) is put in the page, through
  Web Inspector, before the chart mounts. Its frames are measured by `e2e/scroll/metrics.mjs`, as the Playwright
  suite measures them.
- **On screen.** The Simulator's screen is recorded, and what was actually drawn is measured from the video:
  frame timing, blank tiles, motion.

The page's view of itself can't see what Safari's compositor shows. Safari scrolls the box itself, ahead of the
page, and shows only the layers it keeps pictures of. The video can. Each catches what the other misses.

## Setting up

1. **Xcode, an iOS runtime and an iPhone Simulator.** If no runtime is installed, run
   `xcodebuild -downloadPlatform iOS` (about 8 GB). Then create and boot a device:
   `xcrun simctl create "Lab 17 Pro" com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro com.apple.CoreSimulator.SimRuntime.iOS-26-3`,
   then `xcrun simctl boot <udid>` and `open -a Simulator`.
2. **AXe** (`brew install cameroncooke/axe/axe`), which sends touches into the Simulator itself. Posting mouse
   events at the Simulator's window needs Accessibility permission. AXe doesn't, and its touches scroll as a
   finger does, momentum and bounce included.
3. **ios_webkit_debug_proxy** (`brew install ios-webkit-debug-proxy`), to reach Safari's Web Inspector without
   the Inspector window. Start it on the Simulator's socket:
   `ios_webkit_debug_proxy -s unix:$(ls /private/tmp/com.apple.launchd.*/com.apple.webinspectord_sim.socket | head -1)`.
4. **Python 3** with `pip install -r scripts/ios-lab/requirements.txt`, and **ffmpeg**.
5. **The app:** `npm run build`, then `npm run preview -- --port 4319 --host`. Open
   `http://localhost:4319/sweat-shop/` in the Simulator's Safari (`xcrun simctl openurl booted <url>`).
   Rebuilding is not enough to try a new build: the app's service worker keeps serving the last one. Clear it
   from the page, through the inspector, or from Safari's settings.

## Running

    python3 scripts/ios-lab/sim.py                      # every scenario
    python3 scripts/ios-lab/sim.py yoke-up across --tag before
    python3 scripts/ios-lab/sim.py yoke-up --extra '&keep=off'
    python3 scripts/ios-lab/sim.py yoke-up --css '.chart-hot { outline: 1px solid red }'

- `--extra` adds switches to the chart's address.
- `--css` puts a stylesheet in the page before the chart opens, to try a change without rebuilding.

Each run saves `<tag>-<scenario>.mov`, `.json` (the recorder's frames) and `.report.json` in
`test-results/ios-lab` (or `$IOS_LAB_OUT`), and prints a summary line. It drives the booted Simulator, or
`$IOS_LAB_UDID`. A run takes 30–90 seconds. `JUDGE=1` adds `scripts/stutter-judge.py`'s measure of the video,
which takes a few minutes more. The scenarios are in `sim.py`: flings and slow drags across, up, down and
diagonally over three sweaters, into a corner, and knitting a stitch and a round at a time.

## What it measures

From the video, over the chart's box:

- **`fps`:** the gaps between frames while the chart moves. The Simulator writes a frame only when the screen
  changes, so a gap over 25 ms while moving is a frame the screen didn't draw.
- **`blank`:** blank tiles. A band of page colour, 8 pt or more, at one of the box's four edges, there for a
  frame or a few with the edge filled 3 frames before and after. The round numbers' gutter, the chart's own
  edges and a bounce past them are there before or after, so they don't count. The chart's own gaps (columns
  closed up) passing an edge quickly can still count, so look at any frame it flags.
- **`gutter`:** chart colours in the round numbers' gutter, where there should be none. This is a tile showing
  some other part of the chart.
- **`motion`:** each frame's motion, read off the round numbers in the gutter, where the chart's right edge
  shows. A jolt is a frame's move against the mean of the frames either side. stutter-judge reads the chart's
  own pattern instead, and on a yoke of repeating rows it can lock on a few rows off.
- **`memMB`:** every composited layer's backing store in the page, from Web Inspector's layer tree, after each
  gesture. This is what ran an iPhone out of memory in #76 (755 MB, where 60–80 MB is usual). The Simulator has
  the Mac's memory, so it never crashes for this. Watch it.

From the page (see `e2e/scroll/metrics.mjs`):

- `jumps`, `jitter`, `pacing` (dropped frames), `unpainted`, `past`, `shake`, `settle`, the tile `audit`
  and `follow`.
- **`stale`** (`exposure.js`): how near the box the nearest stale picture on a placed canvas came, frame by
  frame. That is a tile not yet painted for the chart as it is, or the part of one painted only in part.

## Known artefacts

- **Touch timing.** AXe takes a few seconds to start each gesture, and its touches come unevenly while the
  finger is down. The page marks the touches itself (`exposure.js`), and motion while the finger is down is
  uneven for that reason, not the chart's.
- **Duplicate frames.** The Simulator's recorder sometimes writes a frame twice, 1–3 ms apart.
  `gutter_motion.py` folds those together.
- **Overscroll.** iOS's rubber-band bounce reports scrolls past the box's end and shows the page beyond it. The
  page's `past` measure counts that, though it is iOS's own behaviour.
- **Invalid runs.** Outside knitting the chart is a card part way down the page. A fling the box can't take
  scrolls the page instead, and the report marks the run `INVALID box moved`.

## The Simulator is not an iPhone

- **Memory:** the Simulator has the Mac's memory. A page that would be killed on a phone carries on here.
- **Display rate:** the Simulator draws at 60 Hz. An iPhone Pro's ProMotion screen scrolls at up to 120 Hz,
  with half the time for each frame.
- **Processor and graphics:** the CPU is the Mac's, and the GPU is the Mac's, behind Metal.

Treat its numbers as relative, one build against another. Try anything that changes how the page is
composited on a real iPhone before relying on it.
