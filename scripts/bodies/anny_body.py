# A body from Anny (NAVER Labs' parametric body model: code Apache 2.0, MakeHuman assets CC0) for a size: fitted to a stature and a chest, its
# arms let down to hang at its sides, and written out as the surface the yoke's model lays stitches on - the body's outline level by level
# round an upright axis through the neck, bridged where it is hollow - with the same measurements a survey would take of it.
# usage: python3 anny_body.py <out.json> [chest cm] [stature cm] [gender 0 male .. 1 female]
import sys, json, math
import numpy as np, torch, anny

out_path = sys.argv[1]
CHEST = float(sys.argv[2]) if len(sys.argv) > 2 else 105.6
STATURE = float(sys.argv[3]) if len(sys.argv) > 3 else 175.5
GENDER = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
AGE = 0.78  # a little past Anny's "young" adult
SHIFT = float(sys.argv[6]) if len(sys.argv) > 6 else 0.0  # cm forward (back if negative) to move the upright axis, to put it through the middle of the neck's ring
FILL = float(sys.argv[5]) if len(sys.argv) > 5 else 5.0  # cm: a sweater lies across a dip a ball of this radius cannot roll into
ARM = 12.0  # degrees from upright the upper arm hangs at

model = anny.Anny().to(dtype=torch.float32)
labels = list(model.bone_labels)

def body(height, weight, pose=None):
    # Weight alone hardly moves Anny's chest, nor muscle alone: a size is fitted by the two together, as one build.
    ph = dict(gender=GENDER, age=AGE, muscle=weight, weight=weight, height=height, proportions=0.5)
    o = model(phenotype_kwargs=ph, pose_parameters=pose)
    return o

# Anny: x to the body's left, y to its back, z up, metres. Here: x to the wearer's left, y up, z to the front, centimetres.
def mine(a):
    a = np.asarray(a, dtype=np.float64) * 100
    return np.stack([a[..., 0], a[..., 2], -a[..., 1]], axis=-1)

def hull(points):
    pts = sorted(set(map(tuple, np.round(points, 4))))
    if len(pts) < 3: return np.array(pts)
    def half(seq):
        h = []
        for p in seq:
            while len(h) >= 2 and (h[-1][0] - h[-2][0]) * (p[1] - h[-2][1]) - (h[-1][1] - h[-2][1]) * (p[0] - h[-2][0]) <= 0: h.pop()
            h.append(p)
        return h
    return np.array(half(pts)[:-1] + half(pts[::-1])[:-1])

def girth(poly):
    return float(np.sum(np.linalg.norm(poly - np.roll(poly, -1, axis=0), axis=1))) if len(poly) > 2 else 0.0

def section(V, F, origin, normal):
    """Where the mesh crosses a plane: the points, in 3D."""
    d = (V - origin) @ normal
    tri = d[F]
    pts = []
    for a, b in ((0, 1), (1, 2), (2, 0)):
        da, db = tri[:, a], tri[:, b]
        cross = (da * db < 0)
        t = da[cross] / (da[cross] - db[cross])
        pa, pb = V[F[cross, a]], V[F[cross, b]]
        pts.append(pa + (pb - pa) * t[:, None])
    return np.concatenate(pts) if pts else np.zeros((0, 3))

def level(V, F, y):
    p = section(V, F, np.array([0, y, 0.0]), np.array([0, 1.0, 0]))
    return p[:, [0, 2]]

F = model.faces.numpy()

def measures(height, weight):
    o = body(height, weight)
    V = mine(o["rest_vertices"][0].numpy()); heads = mine(o["rest_bone_heads"][0].numpy())
    stature = V[:, 1].max() - V[:, 1].min()
    notch = heads[labels.index("clavicle.L")][1]
    # The chest: the trunk alone, the arms held away from it as Anny stands, where it is biggest round between armpit and ribs' end.
    best = None
    for dy in np.arange(13.0, 21.1, 1.0):
        pts = level(V, F, notch - dy * stature / 175.5)
        xs = np.sort(np.abs(pts[:, 0])); jump = np.diff(xs) > 1.5; gap = np.argmax(jump) if np.any(jump) else len(xs) - 1
        if not np.any(jump): continue  # the arms have not parted from the trunk at this level
        h = hull(pts[np.abs(pts[:, 0]) <= xs[gap] + 1e-6]); g = girth(h)
        if best is None or g > best[0]: best = (g, float(np.ptp(h[:, 1])))
    return dict(stature=stature, chest=best[0], depth=best[1], notch=notch)

# Fit the height to the stature and the build to the chest, in turn: the build as near as Anny can be made where she cannot reach the chest.
hgt, wgt = 0.37, 0.75
LO, HI = 0.02, 0.95
def solve(f, x, target):
    """x in [LO, HI] where f(x) is nearest the target: f rises or falls steadily."""
    for _ in range(8):
        y = f(x)
        if abs(y - target) < 0.05: break
        d = 0.03 if x + 0.03 <= HI else -0.03
        slope = (f(x + d) - y) / d
        if abs(slope) < 1e-6: break
        nx = float(np.clip(x + (target - y) / slope, LO, HI))
        if nx == x: break
        x = nx
    return x
for it in range(5):
    hgt = solve(lambda h: measures(h, wgt)["stature"], hgt, STATURE)
    wgt = solve(lambda w: measures(hgt, w)["chest"], wgt, CHEST)
    m = measures(hgt, wgt)
    if abs(m["stature"] - STATURE) < 0.15 and (abs(m["chest"] - CHEST) < 0.15 or wgt in (LO, HI)): break
m = measures(hgt, wgt)
print(f"fitted: height {hgt:.3f} weight {wgt:.3f} -> stature {m['stature']:.1f} chest {m['chest']:.1f} depth {m['depth']:.1f}")

# Let the arms down: turn each upper arm about the axis from front to back until it hangs ARM degrees from upright.
rest = body(hgt, wgt)
heads = mine(rest["rest_bone_heads"][0].numpy())
def arm_angle(o, side):
    hs = mine(o["bone_poses"][0][:, :3, 3].numpy())
    a, b = hs[labels.index(f"upperarm01.{side}")], hs[labels.index(f"lowerarm01.{side}")]
    return math.degrees(math.atan2(abs(b[0] - a[0]), a[1] - b[1]))
def posed(turn):
    P = torch.eye(4)[None, None].repeat(1, model.bone_count, 1, 1)
    for side, sign in (("L", 1.0), ("R", -1.0)):
        th = math.radians(turn) * sign
        R = torch.tensor([[math.cos(th), 0, math.sin(th)], [0, 1, 0], [-math.sin(th), 0, math.cos(th)]])
        P[0, labels.index(f"upperarm01.{side}"), :3, :3] = R
    return body(hgt, wgt, P)
start = arm_angle(posed(0.0), "L")
best = None
for sgn in (1, -1):
    o = posed(sgn * 10.0)
    if arm_angle(o, "L") < start: best = sgn
turn = best * (start - ARM)
o = posed(turn)
print(f"arms: {start:.1f} degrees from upright as she stands; turned {turn:.1f} -> {arm_angle(o, 'L'):.1f} (left) {arm_angle(o, 'R'):.1f} (right)")

V = mine(o["vertices"][0].numpy()); hs = mine(o["bone_poses"][0][:, :3, 3].numpy())
# Where Anny cannot be made as big or as small round the chest as asked, the nearest she can be is made wider and deeper (not taller) to it:
# all of it from the armpits down, none of it at the neck, and between them part of it - a bigger chest does not have as much bigger a neck.
WIDEN = CHEST / m["chest"]
if abs(WIDEN - 1) > 0.004:
    about = hs[labels.index("clavicle.L")][1] + 4.5 + 2.0  # a little above the notch at the top of the breastbone
    def widened(P):
        t = np.clip((about - P[:, 1]) / 12.0, 0.0, 1.0); f = 1 + (WIDEN - 1) * (t * t * (3 - 2 * t))
        P[:, 0] *= f; P[:, 2] *= f
    widened(V); widened(hs)
    print(f"widened by {WIDEN:.3f}: Anny reaches {m['chest']:.1f} at this height")
REACHED = round(m["chest"], 1)
# The notch at the top of the breastbone: on the middle line of the front, the furthest back the surface goes between chest and chin - below
# it the chest comes forward, above it the neck leans forward. (The rig's collarbone joint sits a few centimetres lower.)
joint = hs[labels.index("clavicle.L")][1]
def front_at(y):
    p = level(V, F, y); p = p[np.abs(p[:, 0]) < 1.0]
    return p[:, 1].max() if len(p) else np.nan
ys = np.arange(joint - 2, joint + 9, 0.1); zs = np.array([front_at(y) for y in ys])
notch = float(ys[np.nanargmin(zs)])
print(f"notch {notch - joint:.1f} above the rig's collarbone joint")
V[:, 1] -= notch; hs[:, 1] -= notch
stature = V[:, 1].max() - V[:, 1].min()
# The upright axis: through the middle of the neck, half way up it.
neck = level(V, F, 6.0); neck = neck[np.abs(neck[:, 0]) < 9]
cx, cz = float(neck[:, 0].mean()), float((neck[:, 1].max() + neck[:, 1].min()) / 2) + SHIFT
V[:, 0] -= cx; V[:, 2] -= cz; hs[:, 0] -= cx; hs[:, 2] -= cz
# The chin: where, going up the front of the neck on the middle line, the surface turns sharply forward under the jaw.
chin = 14.0
for y in np.arange(2.0, 16.0, 0.25):
    if front_at(y + 1.5) - front_at(y) > 2.4: chin = float(y); break
back = lambda y: (lambda p: p[np.abs(p[:, 0]) < 1.0][:, 1].min())(level(V, F, y))
TOP, BOTTOM, STEP, A = 12.0, -40.0, 0.1, 360
lean0 = math.atan2(hs[labels.index("head")][2] - hs[labels.index("neck01")][2], hs[labels.index("head")][1] - hs[labels.index("neck01")][1])
neck_half = float(np.abs(level(V, F, 1.5)[:, 0][np.abs(level(V, F, 1.5)[:, 1] - front_at(1.5)) < 5.0]).max())
neck_half = min(neck_half, 7.5)
throat = front_at(0.0)  # the front of the neck at the notch: above it the neck is taken straight up its lean, the jaw and chin left off
print(f"notch at 0; chin about {chin:.1f} above it; surface from {TOP} down to {BOTTOM}; axis moved by ({cx:.2f}, {cz:.2f})")

# What the sweater lies on is not the body itself: knitting goes straight across the hollows a body has - between neck and shoulder, in front
# of the shoulder between chest and arm, between arm and trunk - where they are small, and follows the body where they are wide. So the body
# is filled in as a ball of radius FILL rolled all over it would leave it (a closing): a dip the ball cannot get into is filled, and nothing
# else is changed. (Level by level a convex hull would fill every hollow however wide, and none that runs up and down.)
from scipy import ndimage
VOX = 0.3; X0, X1, Y0, Y1, Z0, Z1 = -60.0, 60.0, -55.0, 18.0, -34.0, 34.0
nx, ny, nz = int(round((X1 - X0) / VOX)) + 1, int(round((Y1 - Y0) / VOX)) + 1, int(round((Z1 - Z0) / VOX)) + 1
def segments(y):
    d = V[:, 1] - (y + 1e-5); tri = d[F]; sign = tri > 0; mixed = sign.any(axis=1) & ~sign.all(axis=1)
    T = F[mixed]; dd = tri[mixed]; pts = np.zeros((len(T), 3, 2)); hit = np.zeros((len(T), 3), dtype=bool)
    for e, (i, k) in enumerate(((0, 1), (1, 2), (2, 0))):
        da, db = dd[:, i], dd[:, k]; c = (da > 0) != (db > 0); hit[:, e] = c
        t = np.where(c, da / np.where(c, da - db, 1.0), 0.0)
        pts[:, e] = (V[T[:, i]] + (V[T[:, k]] - V[T[:, i]]) * t[:, None])[:, [0, 2]]
    order = np.argsort(~hit, axis=1, kind="stable")[:, :2]; r = np.arange(len(T))
    return pts[r, order[:, 0]], pts[r, order[:, 1]]
def raster(y):
    """Which cells of a level are inside the body: across each row, inside between its odd and even crossings."""
    a, b = segments(y); zc = Z0 + VOX * np.arange(nz)
    za, zb = a[:, 1][:, None], b[:, 1][:, None]; cross = (za > zc[None, :]) != (zb > zc[None, :])
    with np.errstate(divide="ignore", invalid="ignore"): x = a[:, 0][:, None] + (zc[None, :] - za) / (zb - za) * (b[:, 0] - a[:, 0])[:, None]
    si, zi = np.nonzero(cross); col = np.clip(np.ceil((x[si, zi] - X0) / VOX).astype(int), 0, nx)
    tog = np.zeros((nz, nx + 1), dtype=np.int32); np.add.at(tog, (zi, col), 1)
    return (np.cumsum(tog, axis=1)[:, :nx] % 2).astype(bool)
solid = np.zeros((ny, nz, nx), dtype=bool)
xs, zs2 = X0 + VOX * np.arange(nx), Z0 + VOX * np.arange(nz)
for iy in range(ny):
    y = Y0 + VOX * iy; m = raster(y)
    if y > 0.5:  # nothing above the shoulders but the neck: in front of its axis, no wider than the neck is and no further forward than its lean
        axis = hs[labels.index("neck01")][2] + (y - hs[labels.index("neck01")][1]) * math.tan(lean0)
        keep = (zs2[:, None] <= throat + y * math.tan(lean0) + 0.6) & ((zs2[:, None] < axis) | (np.abs(xs)[None, :] < neck_half + 0.4)) & (np.abs(xs)[None, :] < 24)
        m &= keep
    solid[iy] = m
def filled_by(radius):
    if radius <= 0: return solid
    grown = solid | (ndimage.distance_transform_edt(~solid, sampling=VOX) <= radius)
    return solid | (ndimage.distance_transform_edt(grown, sampling=VOX) > radius)
filled = filled_by(FILL)
print(f"filled with a ball of {FILL}cm: {100 * (filled.sum() / solid.sum() - 1):.1f}% more than the body, between y {Y0} and {Y1}")
def field(mask):  # positive inside, smooth enough to find the surface between cells
    return ndimage.gaussian_filter(ndimage.distance_transform_edt(mask, sampling=VOX) - ndimage.distance_transform_edt(~mask, sampling=VOX), 0.7)
def outer(mask):
    """The outermost surface of a solid round the upright axis, level by level: r(angle, y)."""
    phi = field(mask); rows = int(round((TOP - BOTTOM) / STEP)) + 1; r = np.zeros((rows, A), dtype=np.float32)
    ang = 2 * np.pi * np.arange(A) / A; dx, dz = -np.sin(ang), -np.cos(ang); ts = np.arange(58.0, 0.0, -0.25)
    for j in range(rows):
        y = TOP - j * STEP
        cx_ = (dx[:, None] * ts[None, :] - X0) / VOX; cz_ = (dz[:, None] * ts[None, :] - Z0) / VOX; cy_ = np.full_like(cx_, (y - Y0) / VOX)
        f = ndimage.map_coordinates(phi, [cy_, cz_, cx_], order=1, mode="nearest")
        inside = f > 0; first = inside.argmax(axis=1); any_in = inside.any(axis=1)
        k = np.clip(first, 1, len(ts) - 1); fa, fb = f[np.arange(A), k - 1], f[np.arange(A), k]
        with np.errstate(divide="ignore", invalid="ignore"): t = np.where(fb != fa, fa / (fa - fb), 0.0)
        r[j] = np.where(any_in, ts[k - 1] + (ts[k] - ts[k - 1]) * np.clip(t, 0, 1), 0.0)
    return r
rows = int(round((TOP - BOTTOM) / STEP)) + 1
r = outer(filled)
# For a look at what was filled: levels cut across, the body's own outline and the surface the knitting lies on; and the tops of the shoulders
# seen from the front, the body's and the filled.
def outline(mask, y):
    iy = int(round((y - Y0) / VOX)); m = mask[iy]; edge = m & ~ndimage.binary_erosion(m); zi, xi = np.nonzero(edge)
    return [[round(float(X0 + VOX * x), 1), round(float(Z0 + VOX * z), 1)] for z, x in zip(zi, xi)]
def crest(mask):
    m2 = mask.any(axis=1); has = m2.any(axis=0); top = Y0 + VOX * (m2.shape[0] - 1 - np.argmax(m2[::-1], axis=0))  # the highest inside cell over each x, whatever z
    return [[round(float(x), 1), round(float(t), 1)] for x, t, ok in zip(xs, top, has) if ok and abs(x) < 32]
cuts = []
for y in (-4.0, -12.0, -18.0, -24.0):
    pts = level(V, F, y); h = hull(pts[np.abs(pts[:, 0]) < 40])
    cuts.append(dict(y=y, body=outline(solid, y), filled=outline(filled, y), hull=[[round(float(p[0]), 1), round(float(p[1]), 1)] for p in h]))
shoulders = dict(body=crest(solid[:int(round((6.0 - Y0) / VOX))]), filled=crest(filled[:int(round((6.0 - Y0) / VOX))]))

# The same measurements the survey takes.
def top_at(x):
    best = -99
    sel = V[(np.abs(V[:, 0] - x) < 0.8)]
    return float(sel[:, 1].max()) if len(sel) else best
wide = max(((float(np.ptp(hull(level(V, F, y))[:, 0])), y) for y in np.arange(-4, -13, -0.25)))
sh = hull(level(V, F, wide[1]))
lean_a, lean_b = hs[labels.index("neck01")], hs[labels.index("head")]
lean = math.degrees(math.atan2(lean_b[2] - lean_a[2], lean_b[1] - lean_a[1]))
n = np.array([0, math.cos(math.radians(lean)), math.sin(math.radians(lean))])
mid = lean_a + (lean_b - lean_a) * 0.45
ns = section(V, F, mid, n); ns = ns[np.linalg.norm(ns - mid, axis=1) < 12]
u = np.array([1.0, 0, 0]); v2 = np.cross(n, u); neck_round = girth(hull(np.stack([(ns - mid) @ u, (ns - mid) @ v2], axis=1)))
cerv = round(float(hs[labels.index("neck01")][1]), 1)  # the joint at the neck's base, for the bone at the back of it
m = measures(hgt, wgt)
table = [
    ["Stature", 175.5, round(float(stature), 1)],
    ["Chest, round", 105.6, round(m["chest"], 1)],
    ["Chest, front to back", 25.3, round(m["depth"], 1)],
    ["Across the shoulders, over the arms", 50.9, round(wide[0], 1)],
    ["Round the shoulders, over the arms", 117.6, round(girth(sh), 1)],
    ["Neck, round", 39.5, round(neck_round, 1)],
    ["Shoulder tip above the notch", 0.2, round(top_at(20.75), 1)],
]
for row in table: print(f"  {row[0]:40s} survey {row[1]:6.1f}   Anny {row[2]:6.1f}")
print(f"  neck leans {lean:.1f} degrees forward")
json.dump(dict(reached=REACHED, widen=round(WIDEN, 4), fill=FILL, cuts=cuts, shoulders=shoulders, angles=A, rows=rows, top=TOP, step=STEP, r=[round(float(x), 3) for x in r.reshape(-1)], table=table, lean=round(lean, 1), cervicale=cerv, chin=round(float(chin), 1),
               phenotype=dict(gender=GENDER, age=AGE, muscle=round(wgt, 3), weight=round(wgt, 3), height=round(hgt, 3), proportions=0.5), arm=ARM, version=anny.__version__ if hasattr(anny, "__version__") else "0.6.2"), open(out_path, "w"))
# Outlines for a look: from the front and from the side.
try:
    from PIL import Image, ImageDraw
    S = 12; im = Image.new("RGB", (120 * S, 58 * S), "white"); g = ImageDraw.Draw(im)
    for vi in range(0, len(V), 1):
        x, y, z = V[vi]
        if -42 < y < 16:
            im.putpixel((int(30 * S + x * S), int((16 - y) * S)), (90, 85, 80)); im.putpixel((int(90 * S + z * S), int((16 - y) * S)), (90, 85, 80))
    for y in (0, 8, -10.9, -14.8): g.line([(0, (16 - y) * S), (120 * S, (16 - y) * S)], fill=(180, 180, 230))
    im.save(out_path.replace(".json", ".png"))
except Exception as e: print("no picture:", e)
