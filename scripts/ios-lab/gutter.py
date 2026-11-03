"""gutter.py <base>: frames where chart colours show in the round-number gutter, right of the chart's dashed edge.

The gutter should hold only page colour, grey numbers and the dashed red edge. Found per frame: the dashed
line's column (a reddish column, near the right), then rows of the gutter right of it whose pixels are mostly
saturated chart colour or navy. Only frames where the chart's right edge is in the box count.
"""
import json, subprocess, sys
import numpy as np
base = sys.argv[1]
meta = json.load(open(base + ".meta.json"))
w, h, x, y = map(int, meta["crop"].split(":"))
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", base + ".mov", "-fps_mode", "passthrough", "-vf", f"crop={meta['crop']},format=rgb24", "-f", "rawvideo", "-"], capture_output=True).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)
hits = []
for k, fr in enumerate(f):
    fr = fr.astype(np.int16)
    r, g, b = fr[..., 0], fr[..., 1], fr[..., 2]
    # The dashed edge: a column in the right third that is often red (r high, g,b low).
    red = (r > 150) & (g < 90) & (b < 110)
    colred = red.mean(axis=0)
    right = colred[w * 2 // 3:]
    if right.max() < 0.2:
        continue
    edge = w * 2 // 3 + int(np.argmax(right))
    gut = fr[:, edge + 9: w - 3]
    if gut.shape[1] < 12:
        continue
    gr, gg, gb = gut[..., 0], gut[..., 1], gut[..., 2]
    sat = (gut.max(axis=2) - gut.min(axis=2) > 45) | (gut.max(axis=2) < 70)
    rows = sat.mean(axis=1) > 0.5
    # Runs of such rows, 6 px (2 pt) or more.
    run = best = 0
    for v in rows:
        run = run + 1 if v else 0
        best = max(best, run)
    if best >= 6:
        hits.append((k, round(best / 3)))
print(json.dumps({"frames": len(hits), "at": hits[:30]}))
