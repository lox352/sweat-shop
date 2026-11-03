"""iOS Simulator scroll lab: real touches (AXe) on Safari, the repo's recorder in the page, and a screen recording.

    sim.py [<scenario> ...] [--tag TAG] [--extra '&keep=off'] [--css '<stylesheet>'] [--no-probe]

See README.md for setting it up and for what each measure means. With no scenario named, runs them all.

For each scenario: seeds the project, injects e2e/scroll/recorder.js before the chart mounts, opens the
chart, records the screen while the gestures are made, then saves <out>/<tag>-<scenario>.json (the
recorder's frames, marks, writes and the tile audit) and .mov, and prints the page and video measures.
"""
import json, math, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import inspector as wi  # noqa: E402

REPO = os.path.dirname(os.path.dirname(HERE))


def booted():
    """The Simulator to drive: $IOS_LAB_UDID, or the one booted."""
    if os.environ.get("IOS_LAB_UDID"):
        return os.environ["IOS_LAB_UDID"]
    listed = json.loads(subprocess.run(["xcrun", "simctl", "list", "devices", "booted", "-j"], capture_output=True, text=True).stdout)
    found = [d["udid"] for ds in listed["devices"].values() for d in ds if d.get("state") == "Booted"]
    if not found:
        sys.exit("No Simulator booted: boot an iPhone, or set IOS_LAB_UDID.")
    return found[0]


UDID = booted()
OUT = os.environ.get("IOS_LAB_OUT", os.path.join(REPO, "test-results", "ios-lab"))
os.makedirs(OUT, exist_ok=True)
SCREEN_TOP = 62  # where Safari's page starts on an iPhone 17 Pro screen, in points

eachYearOnce = {"sweaterId": "wool-week-strips-once-oldest", "sizeId": "m", "colourwayId": "early-light"}
eachYearOnceL = {"sweaterId": "wool-week-strips-once-oldest", "sizeId": "l", "colourwayId": "early-light"}
hamefarin = {"sweaterId": "hamefarin", "sizeId": "m", "colourwayId": "simmer-dim"}
klee = {"sweaterId": "paul-klee", "sizeId": "m1", "colourwayId": "klee", "revision": 1}


def fling(dx, dy, wait=1.6, duration=0.1):
    return ("fling", dx, dy, wait, duration)


def drag(dx, dy, duration=1.5, wait=0.8):
    return ("drag", dx, dy, wait, duration)


def tap(where, wait=0.35):
    return ("tap", where, wait)


# Scroll to put the box at a place first: JS run on the box once the chart is open.
TOP = "box.scrollTop = 0"
BOTTOM = "box.scrollTop = 1e7"
MIDDLE_ACROSS = "box.scrollLeft = -(box.scrollWidth - box.clientWidth) / 2"
RIGHT_EDGE = "box.scrollLeft = 0"

SCENARIOS = {
    # The bug that started this: flung across the top rows of a large chart, knitting.
    "across": dict(choices=eachYearOnceL, progress=6000, knitting=True, prep="box.scrollLeft = -2900; box.scrollTop = 0",
                   at=(0.5, 0.45), gestures=[fling(300, 0), fling(-300, 0)] * 4),
    # Up the yoke, where columns close and open the most as rows come into view.
    "yoke-up": dict(choices=eachYearOnce, progress=0, prep=BOTTOM, at=(0.5, 0.3), gestures=[fling(0, 300)] * 6),
    "yoke-down": dict(choices=eachYearOnce, progress=0, prep=TOP, at=(0.5, 0.7), gestures=[fling(0, -300)] * 6),
    "yoke-diagonal": dict(choices=eachYearOnce, progress=0, prep=BOTTOM + "; " + MIDDLE_ACROSS, at=(0.5, 0.5),
                          gestures=[fling(200, 220), fling(-200, 220), fling(200, -220), fling(-200, -220)] * 2),
    # Slowly, a finger dragging up through the decreases: each column easing shut is in plain view.
    "yoke-drag": dict(choices=eachYearOnce, progress=0, prep=BOTTOM, at=(0.5, 0.25), gestures=[drag(0, 260, 2.0)] * 5),
    "across-drag": dict(choices=eachYearOnce, progress=0, prep="box.scrollTop = box.scrollHeight * 0.3", at=(0.15, 0.5),
                        gestures=[drag(280, 0, 2.0), drag(-280, 0, 2.0)] * 3),
    # Into the corner and bouncing past it, then out.
    # Knitting, where the chart fills the screen: otherwise a fling at the box's end scrolls the page instead.
    "corner": dict(choices=eachYearOnce, progress=0, knitting=True, prep="box.scrollTop = box.scrollHeight * 0.6; " + MIDDLE_ACROSS, at=(0.5, 0.5),
                   gestures=[fling(-350, -300)] * 4 + [fling(350, 300)] * 2),
    # A round yoke of make-ones, and a raglan with markers.
    "hamefarin-up": dict(choices=hamefarin, progress=0, prep=BOTTOM, at=(0.5, 0.3), gestures=[fling(0, 300)] * 6),
    "klee-up": dict(choices=klee, progress=0, prep=BOTTOM, at=(0.5, 0.3), gestures=[fling(0, 300)] * 6),
    # Knitting: the chart following the stitch, a stitch at a time and a round at a time.
    "knit": dict(choices=eachYearOnce, progress=4000, knitting=True, prep="", at=(0.5, 0.5),
                 gestures=[tap("knit")] * 12 + [tap("round", 1.2)] * 3),
}


class Lab:
    def __init__(self):
        self.i = wi.Inspector("4319")

    def js(self, expr):
        return self.i.js(expr)

    def wait_for(self, expr, timeout=15):
        end = time.time() + timeout
        while time.time() < end:
            try:
                if self.js(expr):
                    return True
            except Exception:
                pass
            time.sleep(0.25)
        raise TimeoutError(expr)

    def open(self, s, extra):
        # A fresh page at the home route, the recorder put in before the chart mounts, then the chart.
        self.js('location.href = "/sweat-shop/#/"; 1')
        time.sleep(0.3)
        self.js("location.reload(); 1")
        time.sleep(2.5)
        self.i = wi.Inspector("4319")
        self.wait_for("document.readyState === 'complete'")
        choices = json.dumps(s["choices"])
        self.js(f"""(() => {{ const now = new Date().toISOString(), id = "project-1760000000000"; localStorage.clear();
            localStorage.setItem(id, JSON.stringify({{ version: 1, id, ...{choices}, progress: {s['progress']}, startedAt: now, updatedAt: now }})); return 1; }})()""")
        if self.probe:
            src = open(os.path.join(REPO, "e2e/scroll/recorder.js")).read()
            self.js("window.__scrollProbe ? 1 : (eval(" + json.dumps(src) + "), 1)")
            self.js("eval(" + json.dumps(open(os.path.join(HERE, "exposure.js")).read()) + "), 1")
        query = ("?knitting=1" if s.get("knitting") else "") + extra
        if query and not query.startswith("?"):
            query = "?" + query.lstrip("&")
        if self.css:
            self.js("(() => { const st = document.createElement('style'); st.id = 'lab-css'; st.textContent = " + json.dumps(self.css) + "; document.head.appendChild(st); return 1; })()")
        self.js(f'location.hash = "#/project/1760000000000/chart{query}"; 1')
        self.wait_for("document.querySelector('.chart-tiles canvas') !== null")
        time.sleep(1.2)
        # The whole box on screen: outside knitting the chart is a card part way down the page.
        self.js("document.querySelector('.chart-scroll').scrollIntoView({ block: 'start' }); 1")
        if s.get("prep"):
            self.js(f"(() => {{ const box = document.querySelector('.chart-scroll'); {s['prep']}; return 1; }})()")
        time.sleep(1.5)

    def memory(self):
        """Every composited layer's backing store in the page, from Web Inspector's layer tree: MB, and how many have one."""
        try:
            root = self.i.call("DOM.getDocument")["root"]["nodeId"]
            self.i.call("LayerTree.enable")
            layers = self.i.call("LayerTree.layersForNode", {"nodeId": root})["layers"]
            return [round(sum(l["memory"] for l in layers) / 1e6, 1), sum(1 for l in layers if l["memory"])]
        except Exception as e:
            return [None, str(e)[:80]]

    def box(self):
        r = json.loads(self.js("JSON.stringify(document.querySelector('.chart-scroll').getBoundingClientRect())"))
        r["bottom"] = min(r["bottom"], self.js("innerHeight"))
        return r

    def button(self, which):
        label = {"knit": "^Knit ", "round": "End of round"}[which]
        r = self.js(f"""(() => {{ const b = [...document.querySelectorAll('button')].find(b => new RegExp({json.dumps(label)}).test(b.textContent.trim()));
            if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }})()""")
        return r

    def mark(self, what):
        if self.probe:
            self.js(f"window.__scrollProbe.mark({json.dumps(what)}); 1")

    def axe(self, *args):
        subprocess.run(["axe", *map(str, args), "--udid", UDID], check=True, capture_output=True)

    def act(self, s, box):
        fx, fy = s["at"]
        x0 = box["left"] + box["width"] * fx
        y0 = SCREEN_TOP + box["top"] + (box["bottom"] - box["top"]) * fy
        clamp = lambda v, lo, hi: max(lo, min(hi, v))
        for g in s["gestures"]:
            if g[0] in ("fling", "drag"):
                _, dx, dy, wait, duration = g
                sx = clamp(x0 - dx / 2, 8, 394)
                sy = clamp(y0 - dy / 2, SCREEN_TOP + box["top"] + 8, SCREEN_TOP + box["bottom"] - 8)
                ex, ey = clamp(sx + dx, 8, 394), clamp(sy + dy, SCREEN_TOP + box["top"] + 8, SCREEN_TOP + box["bottom"] - 8)
                flung = g[0] == "fling"
                # The page marks the touch itself (see exposure.js): AXe takes seconds to start.
                self.axe("swipe", "--start-x", round(sx), "--start-y", round(sy), "--end-x", round(ex), "--end-y", round(ey),
                         "--duration", duration, "--delta", 6 if flung else 1)
                time.sleep(wait)
                self.mark("fling done")
                self.mem.append(self.memory())
            elif g[0] == "tap":
                _, which, wait = g
                at = self.button(which)
                if at is None:
                    print("  no button", which)
                    continue
                self.mark(f"tap {which}")
                self.axe("tap", "-x", round(at[0]), "-y", round(SCREEN_TOP + at[1]))
                self.mark("tap done")
                time.sleep(wait)

    def run(self, name, tag, extra, probe=True, css=""):
        s = SCENARIOS[name]
        self.css = css
        self.probe = probe
        self.open(s, extra)
        box = self.box()
        base = os.path.join(OUT, f"{tag}-{name}")
        mov = base + ".mov"
        if os.path.exists(mov):
            os.remove(mov)
        rec = subprocess.Popen(["xcrun", "simctl", "io", UDID, "recordVideo", "--codec", "h264", "--force", mov],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1.2)
        if probe:
            self.js("window.__scrollProbe.start(); window.__exposure.start(); window.__lineLog = []; 1")
        self.mem = [self.memory()]
        self.act(s, box)
        time.sleep(1.5)
        self.mem.append(self.memory())
        recording = None
        if probe:
            n = self.js("(window.__rec = JSON.stringify(window.__scrollProbe.stop())).length")
            chunks = [self.js(f"window.__rec.slice({k}, {k + 400000})") for k in range(0, n, 400000)]
            recording = json.loads("".join(chunks))
            recording["audit"] = self.js("JSON.stringify(window.__chartViews.at(-1)?.audit?.())")
            recording["audit"] = json.loads(recording["audit"]) if recording["audit"] else None
            self.js("delete window.__rec; 1")
            recording["exposure"] = json.loads(self.js("JSON.stringify(window.__exposure.stop())"))
            recording["lineLog"] = json.loads(self.js("JSON.stringify(window.__lineLog || [])"))
        rec.send_signal(2)
        rec.wait()
        # The box exactly, and no lower than Safari's toolbar floating over the page's foot.
        top, bottom = SCREEN_TOP + box["top"], min(SCREEN_TOP + box["bottom"], 750)
        left, right = math.ceil(box["left"]), math.floor(box["right"])
        crop = f"{(right - left) * 3 // 6 * 6}:{round((bottom - top) * 3) // 6 * 6}:{left * 3}:{round(top * 3)}"
        meta = {"scenario": name, "tag": tag, "extra": extra, "css": css, "box": box, "crop": crop, "memory": self.mem}
        if recording:
            recording["meta"] = meta
            json.dump(recording, open(base + ".json", "w"))
        json.dump(meta, open(base + ".meta.json", "w"))
        return base


if __name__ == "__main__":
    args = sys.argv[1:]
    tag, extra, probe = "run", "", True
    if "--tag" in args:
        k = args.index("--tag"); tag = args[k + 1]; del args[k:k + 2]
    if "--extra" in args:
        k = args.index("--extra"); extra = args[k + 1]; del args[k:k + 2]
    css = ""
    if "--css" in args:
        k = args.index("--css"); css = args[k + 1]; del args[k:k + 2]
    if "--no-probe" in args:
        args.remove("--no-probe"); probe = False
    names = args or list(SCENARIOS)
    lab = Lab()
    for name in names:
        t = time.time()
        base = lab.run(name, tag, extra, probe, css)
        env = dict(os.environ, JUDGE="1") if name.startswith("across") else dict(os.environ)
        r = subprocess.run([sys.executable, os.path.join(HERE, "report.py"), base], capture_output=True, text=True, env=env)
        print(f"{name} ({round(time.time() - t)}s): {r.stdout.strip()} {r.stderr.strip()[-400:]}", flush=True)
