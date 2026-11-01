"""
The stutter lab's measure: how far the chart moves on screen each frame of
a recording (see stutter-lab.mjs), and how evenly.

Each frame's shift from the last is found by phase correlation over the
chart's box. Frames that repeat the last are left out: the browser drew
nothing new. While a finger drags at a steady pace, every frame should move
about as far as the frames either side of it; one that moves less than half
as far, or more than half as far again, is uneven. Behind the page, the
layer drawn a frame after the scroll, frames alternate long and short -
13 pixels, then 2, then 12 - and most are uneven.

    python3 scripts/stutter-lab.py run.mkv [other.mkv ...]
"""
import json
import statistics
import subprocess
import sys

import numpy as np

W, H, TOP = 390, 380, 90


def frames(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-vf", f"crop={W}:{H}:0:{TOP},format=gray", "-f", "rawvideo", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(-1, H, W).astype(np.float32)


def shift(a, b):
    """How far `a` is moved from `b`, across and down, and how sure: phase correlation's peak, 1 for a clean move."""
    window = np.outer(np.hanning(H), np.hanning(W))
    fa = np.fft.fft2((a - a.mean()) * window)
    fb = np.fft.fft2((b - b.mean()) * window)
    r = fa * np.conj(fb)
    r = np.fft.ifft2(r / (np.abs(r) + 1e-9)).real
    i, j = np.unravel_index(np.argmax(r), r.shape)
    left, here, right = r[i, (j - 1) % W], r[i, j], r[i, (j + 1) % W]
    bend = left - 2 * here + right
    x = j + ((left - right) / (2 * bend) if bend else 0)
    return (x - W if x > W / 2 else x), (i if i <= H / 2 else i - H), float(r.max())


for path in sys.argv[1:]:
    f = frames(path)
    moves = []
    for k in range(1, len(f)):
        if float(np.abs(f[k] - f[k - 1]).mean()) < 0.05:
            continue
        dx, dy, sure = shift(f[k], f[k - 1])
        if abs(dx) + abs(dy) > 0.3:
            moves.append({"k": k, "dx": round(dx, 2), "dy": round(dy, 2), "sure": round(sure, 2)})
    dragged = uneven = back = 0
    off = []
    for i, move in enumerate(moves):
        if move["dx"] < -0.5 and move["sure"] >= 0.5:
            back += 1
        near = [abs(m["dx"]) for m in moves[max(0, i - 3):i + 4] if m is not move]
        if len(near) < 3:
            continue
        typical = statistics.median(near)
        # The drag itself, not the browser's own fling slowing to a stop after it.
        if typical < 8:
            continue
        dragged += 1
        off.append(abs(move["dx"] - typical))
        if abs(move["dx"]) < 0.5 * typical or abs(move["dx"]) > 1.5 * typical:
            uneven += 1
    off.sort()
    print(json.dumps({
        "recording": path,
        "frames": len(f),
        "dragged": dragged,
        "uneven": round(uneven / max(1, dragged), 2),
        "off": {"median": statistics.median(off) if off else 0, "p90": off[int(len(off) * 0.9)] if off else 0},
        "backwards": back,
    }))
