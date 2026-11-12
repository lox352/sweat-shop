"""report.py <base> [--full]: page measures (metrics.mjs) and video measures of one run; one summary line, full JSON to <base>.report.json.

Video measures, over the chart's box as recorded (3 px a point):
- frames: frame intervals from the recording's own timestamps while the screen changes (the Simulator writes a
  frame only when something on screen changed, so a gap while moving is a frame not drawn).
- blank: frames with a band of page background >= 8 pt at the box's left or right edge (tiles not shown).
- motion: stutter-judge.py's jolts and steps back, as a knitter sees them.
"""
import json, os, subprocess, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable
REPO = os.path.dirname(os.path.dirname(HERE))
base = sys.argv[1]
meta = json.load(open(base + ".meta.json"))
mov = base + ".mov"
out = {"scenario": meta["scenario"], "tag": meta["tag"]}
mem = [m for m in meta.get("memory", []) if m and m[0] is not None]
out["memory"] = {"maxMB": max([m[0] for m in mem], default=None), "maxLayers": max([m[1] for m in mem], default=None), "samples": mem}

# Page side.
if os.path.exists(base + ".json"):
    r = subprocess.run(["node", os.path.join(HERE, "measure.mjs"), base + ".json"], capture_output=True, text=True)
    out["page"] = json.loads(r.stdout) if r.returncode == 0 else {"error": r.stderr[-500:]}
    # A run is only good while the box stays put on the page: a fling the box can't take scrolls the page.
    tops = [f["box"]["top"] for f in json.load(open(base + ".json"))["frames"] if f.get("box")]
    out["boxMoved"] = sum(1 for t in tops if abs(t - tops[0]) > 2)

# Stale pictures on placed canvases near the box, page side (see exposure.js), in the chart's pixels:
# frames where the nearest is in the box, within 32 px, within 100 px.
if os.path.exists(base + ".json"):
    ex = [e for e in (json.load(open(base + ".json")).get("exposure") or []) if e[1] >= 0]
    out["stale"] = {"in": sum(1 for e in ex if e[1] == 0), "32": sum(1 for e in ex if e[1] <= 32), "100": sum(1 for e in ex if e[1] <= 100)}

# Video: frame times.
pts = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "frame=pts_time", "-of", "csv=p=0", mov],
                     capture_output=True, text=True).stdout.split()
t = np.array([float(x.strip(",")) for x in pts if x.strip(",") not in ("", "N/A")])
crop = meta["crop"]
w, h, _, _ = map(int, crop.split(":"))
W, H = w // 3, h // 3
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", mov, "-fps_mode", "passthrough", "-vf", f"crop={crop},scale={W}:{H},format=rgb24", "-f", "rawvideo", "-"],
                     capture_output=True).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.int16)
n = min(len(f), len(t))
f, t = f[:n], t[:n]
# Which frames differ from the one before (the screen changed), and the gaps between changes while moving.
diff = np.array([0] + [np.abs(f[k].astype(int) - f[k - 1]).mean() for k in range(1, n)])
moving = diff > 0.5
gaps = np.diff(t) * 1000
# A gap counts while the chart was moving on both sides of it: a frame the screen should have drawn and didn't.
mg = [gaps[k - 1] for k in range(2, n) if moving[k] and moving[k - 1]]
mg = np.array(mg) if mg else np.array([16.7])
out["frames"] = {"moving": int(moving.sum()), "p50": round(float(np.median(mg)), 1), "p95": round(float(np.percentile(mg, 95)), 1),
                 "worst": round(float(mg.max()), 1), "over25ms": int((mg > 25).sum()), "over40ms": int((mg > 40).sum())}

# Blank bands at the box's four edges: page background all the way across (>= 90%), from the edge in.
bg = (np.abs(f[..., 0] - 240) < 12) & (np.abs(f[..., 1] - 238) < 12) & (np.abs(f[..., 2] - 234) < 14)
cols = bg.mean(axis=1) > 0.9   # frames x W
rows = bg.mean(axis=2) > 0.9   # frames x H
def band(c):
    return len(c) if c.all() else int(np.argmin(c))
B = np.array([[band(cols[k]), band(cols[k][::-1]), band(rows[k]), band(rows[k][::-1])] for k in range(n)])  # left right top bottom
# A tile shown late is a band there for a frame or a few, at an edge filled 3 frames before and after.
# The round numbers' gutter, the chart's own edges, a bounce past them and closed-up gaps are there before or after.
spikes = []
for k in range(3, n - 3):
    for e, name in enumerate("LRTB"):
        over = B[k, e] - max(B[k - 3, e], B[k + 3, e])
        if B[k, e] >= 8 and B[k - 3, e] < 4 and B[k + 3, e] < 4:
            spikes.append((k, name, int(B[k, e]), int(over)))
frames_hit = sorted({s[0] for s in spikes})
out["blank"] = {"frames": len(frames_hit), "widest": max([s[3] for s in spikes], default=0),
                "ptFrames": int(sum(s[3] for s in spikes)), "at": spikes[:40]}

# Motion as seen, off the round numbers in the gutter (see gutter_motion.py), where the chart's right edge shows.
gm = subprocess.run([PY, os.path.join(HERE, "gutter_motion.py"), base], capture_output=True, text=True).stdout
line = [l for l in gm.splitlines() if l.startswith("SUMMARY ")]
out["gutterMotion"] = json.loads(line[0][8:]) if line else None

# Motion as seen.
r = subprocess.run([PY, os.path.join(REPO, "scripts/stutter-judge.py"), mov, crop, "3"], capture_output=True, text=True) if os.environ.get("JUDGE") else subprocess.CompletedProcess([], 0, "{}", "")
try:
    out["seen"] = json.loads(r.stdout.strip().splitlines()[-1])
except Exception:
    out["seen"] = {"error": (r.stderr or r.stdout)[-300:]}

g = subprocess.run([PY, os.path.join(HERE, "gutter.py"), base], capture_output=True, text=True)
out["gutter"] = json.loads(g.stdout) if g.returncode == 0 else {"error": g.stderr[-300:]}
json.dump(out, open(base + ".report.json", "w"), indent=1)
p = out.get("page", {})
summary = {
    "INVALID box moved": out.get("boxMoved"),
    "memMB": out["memory"]["maxMB"],
    "fps": out["frames"],
    "blank": {k: out["blank"][k] for k in ("frames", "widest", "ptFrames")}, "gutter": out["gutter"].get("frames"), "stale": out.get("stale"),
    "motion": out["gutterMotion"],
}
if "jumps" in p:
    summary["page"] = {
        "jumps": p["jumps"]["byKind"], "worstJump": p["jumps"]["worst"], "jitterP95": p["jitter"]["p95"],
        "dropped": p["pacing"]["dropped"], "pace": [p["pacing"]["p50"], p["pacing"]["p95"], p["pacing"]["worst"]],
        "unpainted": p["painting"]["unpaintedMax"], "unpaintedNear": p["painting"]["unpaintedNearMax"],
        "past": p["past"]["max"], "shake": p["shake"]["reversals"], "settle": p["settling"],
        "smeared": p["sharpness"]["share"], "audit": p["audit"].get("wrong") if p.get("audit") else None,
        "drift": p["drift"]["share"], "follow": p["follow"] if meta["scenario"].startswith("knit") else None,
    }
elif "page" in out:
    summary["page"] = p
if not summary["INVALID box moved"]:
    del summary["INVALID box moved"]
print(json.dumps(summary, separators=(",", ":")))
