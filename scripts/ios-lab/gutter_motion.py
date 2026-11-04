"""gutter_motion.py <base> [from to]: each frame's vertical motion, read off the round numbers in the gutter.

The numbers are painted on the tiles, a few rows apart and each unlike the next, so matching the gutter strip
between frames can't lock onto a repeat of the chart's own pattern a few rows off, as matching the whole box
can. Brute-force: the shift (in points, to a third) minimising the mean absolute difference of the strip.
"""
import json, subprocess, sys
import numpy as np

base = sys.argv[1]
meta = json.load(open(base + ".meta.json"))
w, h, x, y = map(int, meta["crop"].split(":"))
gw = 66  # the right 22 pt of the box: the gutter, if the chart's right-hand edge is in view
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", base + ".mov", "-fps_mode", "passthrough", "-vf",
                      f"crop={gw}:{h}:{x + w - gw}:{y},format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, h, gw).astype(np.float32)
# Ink: the numbers are dark on light; a row's profile is how much ink is in it.
prof = (255 - f).mean(axis=2)
pts = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "frame=pts_time", "-of", "csv=p=0", base + ".mov"],
                     capture_output=True, text=True).stdout.split()
t = [float(p.strip(",")) for p in pts if p.strip(",") not in ("", "N/A")]
lo, hi = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1, len(f))
out = []
M = 300  # most px a frame
for k in range(max(1, lo), min(hi, len(f))):
    a, b = prof[k - 1], prof[k]
    if a.std() < 1 or b.std() < 1:
        out.append((k, None)); continue
    best, err = 0, 1e9
    for s in range(-M, M + 1):
        if s >= 0:
            d = np.abs(b[s:] - a[:h - s]).mean()
        else:
            d = np.abs(b[:h + s] - a[-s:]).mean()
        if d < err:
            best, err = s, d
    out.append((k, round(best / 3, 1), round(float(err), 2), round((t[k] - t[k - 1]) * 1000, 1) if k < len(t) else None))
print(json.dumps(out))

# Summary while moving. Frames written under 6 ms after the one before are the recorder writing one frame twice:
# folded into it. A jolt is a frame's move against the mean of the frames either side, all three moving (a fling
# setting off from rest, or coming to rest, is not one).
seq = []
for o in out:
    if o[1] is None:
        seq.append(None); continue
    if seq and seq[-1] is not None and o[3] is not None and o[3] < 6:
        seq[-1] = seq[-1] + o[1]; continue
    seq.append(o[1])
jolts, back = [], 0
for k in range(1, len(seq) - 1):
    a, v, b = seq[k - 1], seq[k], seq[k + 1]
    if a is None or v is None or b is None or min(abs(a), abs(v), abs(b)) < 0.5:
        continue
    jolts.append(abs(v - (a + b) / 2))
    if v * a < 0 and v * b < 0:
        back += 1
jolts.sort()
q = lambda p: round(jolts[min(len(jolts) - 1, int(p * len(jolts)))], 1) if jolts else 0
print("SUMMARY " + json.dumps({"moving": len(jolts), "joltP50": q(0.5), "joltP90": q(0.9), "joltMax": q(1.0) if jolts else 0, "over4": sum(1 for j in jolts if j > 4), "backwards": back}))
