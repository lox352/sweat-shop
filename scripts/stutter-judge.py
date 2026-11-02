"""
How evenly the chart moves in a screen recording - a phone's own, or the
stutter lab's (scripts/stutter-lab.mjs) - as a knitter sees it.

    python3 scripts/stutter-judge.py recording.mov W:H:X:Y [pixels-a-point]

W:H:X:Y is the part of the frame to measure (ffmpeg's crop): the chart's box,
with nothing fixed over it. An iPhone records 3 pixels a point: an iPhone 16
Pro's recording, 1206 wide, is the chart's box at 1206:1170:0:200.

Each frame's move is measured by phase correlation against the frame before.
The chart's cells repeat every 16 points or so, and a frame matches itself a
cell off nearly as well as where it is: so the frames are blurred by 5
points first, leaving the chart's larger shapes - its bands of colour and
the gaps between its columns - and of each frame's best few matches, the
run through them taken is the one that both matches best and changes speed
least (Viterbi). A frame the same as the one before - the browser not drawing that
frame - is folded into the next one drawn, as its speed over both.

Then, of each frame drawn while the chart moves: how far its move is from
the moves of the two drawn either side (a jolt), and whether it goes against
them (a step back). Prints a line of JSON; the moves frame by frame are
written beside the recording, as <recording>.motion.json.
"""
import json
import subprocess
import sys

import numpy as np
from scipy.ndimage import gaussian_filter

path, crop = sys.argv[1], sys.argv[2]
scale = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
w, h, _, _ = map(int, crop.split(":"))
raw = subprocess.run(
    ["ffmpeg", "-v", "error", "-i", path, "-vf", f"crop={crop},format=gray", "-f", "rawvideo", "-"],
    capture_output=True,
    check=True,
).stdout
frames = [gaussian_filter(frame, 5 * scale) for frame in np.frombuffer(raw, dtype=np.uint8).reshape(-1, h, w).astype(np.float32)]
window = np.outer(np.hanning(h), np.hanning(w))


def surface(a, b):
    """Phase correlation of two frames, the no-move peak at the middle."""
    A = np.fft.fft2((a - a.mean()) * window)
    B = np.fft.fft2((b - b.mean()) * window)
    R = A * np.conj(B)
    R /= np.abs(R) + 1e-9
    return np.fft.fftshift(np.fft.ifft2(R).real)


def parabola(a, b, c):
    d = a - 2 * b + c
    return (a - c) / (2 * d) if d else 0


def matches(r, count=6):
    """The best few moves, in points, with how well each matches."""
    cy, cx = h // 2, w // 2
    left = r.copy()
    found = []
    for _ in range(count):
        i, j = np.unravel_index(np.argmax(left), left.shape)
        if 0 < i < h - 1 and 0 < j < w - 1:
            dx = j + parabola(r[i, j - 1], r[i, j], r[i, j + 1]) - cx
            dy = i + parabola(r[i - 1, j], r[i, j], r[i + 1, j]) - cy
            found.append((dx / scale, dy / scale, float(r[i, j])))
        left[max(0, i - 4) : i + 5, max(0, j - 4) : j + 5] = -1
    # Not moving at all, if the frame is much as it was.
    if r[cy, cx] > 0.5:
        found.append((0.0, 0.0, float(r[cy, cx])))
    return found or [(0.0, 0.0, 0.0)]


candidates = [matches(surface(frames[k], frames[k - 1])) for k in range(1, len(frames))]
# Matching well counts for 4 a frame; changing speed by 12 points costs 1.
cost = [[-4 * p for (_, _, p) in candidates[0]]]
back = []
for t in range(1, len(candidates)):
    row, came = [], []
    for x, y, p in candidates[t]:
        c, i = min((cost[-1][i] + ((x - px) ** 2 + (y - py) ** 2) / 144, i) for i, (px, py, _) in enumerate(candidates[t - 1]))
        row.append(c - 4 * p)
        came.append(i)
    cost.append(row)
    back.append(came)
i = int(np.argmin(cost[-1]))
taken = [i]
for t in range(len(back) - 1, -1, -1):
    i = back[t][i]
    taken.append(i)
taken = taken[::-1]
moves = np.array([candidates[k][taken[k]] for k in range(len(candidates))])
dx, dy, peak = moves[:, 0], moves[:, 1], moves[:, 2]

# The frames drawn, each with its speed over the frames it took.
same = (np.abs(dx) < 0.25) & (np.abs(dy) < 0.25) & (peak > 0.9)
drawn = []
gap = 1
for k in range(len(dx)):
    if same[k]:
        gap += 1
        continue
    drawn.append((dx[k] / gap, dy[k] / gap, gap))
    gap = 1
drawn = np.array(drawn) if drawn else np.zeros((0, 3))
vx, vy = drawn[:, 0], drawn[:, 1]
speed = np.hypot(vx, vy)
moving = np.where(speed > 1)[0]
jolts = []
backwards = 0
for k in moving:
    around = [j for j in (k - 2, k - 1, k + 1, k + 2) if 0 <= j < len(speed) and speed[j] > 1]
    if len(around) < 2:
        continue
    ex, ey = np.median(vx[around]), np.median(vy[around])
    jolts.append(float(np.hypot(vx[k] - ex, vy[k] - ey)))
    if ex * vx[k] + ey * vy[k] < 0:
        backwards += 1
jolts = np.array(jolts) if jolts else np.zeros(1)
print(
    json.dumps(
        {
            "frames": len(frames),
            "moving": int(len(moving)),
            "repeated": round(float((drawn[moving, 2] > 1).mean()) if len(moving) else 0, 2),
            "speed": round(float(np.median(speed[moving])) if len(moving) else 0, 2),
            "jolt": {"median": round(float(np.median(jolts)), 2), "p90": round(float(np.quantile(jolts, 0.9)), 2), "max": round(float(jolts.max()), 2)},
            "over4": int((jolts > 4).sum()),
            "backwards": backwards,
        }
    )
)
json.dump({"dx": dx.round(2).tolist(), "dy": dy.round(2).tolist(), "peak": peak.round(3).tolist()}, open(path + ".motion.json", "w"))
