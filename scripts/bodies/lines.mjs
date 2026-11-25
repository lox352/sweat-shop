// The lines a yoke's columns run down a body, and the room between them: for one body (anny_body.py's file) and one size's yoke (yoke.mjs's).
//
// The neck's ring is as long as the cast-on and lies where the body's surface meets a plane tilted down to the front - tilted so that the
// back, to come level with the front where the yoke ends, wants SHORT rows more than the front: the rows the pattern's short rows give it.
// A column of knitting has the same number of rows in it all the way round, so a round lies where each column has come that many rows down
// from the cast-on; and a column runs straight down from where it starts, as seen from above.
//
// usage: node lines.mjs <yoke.json> <body.json> <out.json> [SHORT, default 6]
import { readFileSync, writeFileSync } from "node:fs";
const [yokeFile, bodyFile, out, short = "6"] = process.argv.slice(2);
const K = JSON.parse(readFileSync(yokeFile, "utf8"));
const shortRows = Number(short);
const { w, h } = K.gauge;
/** A body's surface: its outline level by level round an upright axis, r(angle, y). Angle 0 is the middle of the back, going round by the wearer's right. */
const surfaceFrom = (file) => {
  const B = JSON.parse(readFileSync(file, "utf8")); const { angles, rows, top, step } = B; const r = Float32Array.from(B.r);
  const dir = (i) => { const a = (2 * Math.PI * i) / angles; return [-Math.sin(a), -Math.cos(a)]; };
  const at = (i, j) => { const [dx, dz] = dir(i); const q = r[j * angles + ((i % angles) + angles) % angles]; return [dx * q, top - j * step, dz * q]; };
  return { angles, rows, top, step, r, dir, at, table: B.table, lean: B.lean, phenotype: B.phenotype };
};
const S = surfaceFrom(bodyFile);
/** The ring where the surface meets the plane y = yc - slope * z, at the height that makes it `length` round. */
const ringOf = (S, length, slope) => {
  // The ring is where the surface meets a plane tilted down to the front: y = yc - slope * z. Its height is found for its length.
  const yAt = (yc) => Array.from({ length: S.angles }, (_, i) => {
    // March down the column to where y - (yc - slope z) changes sign.
    for (let j = 1; j < S.rows; j++) { const p = S.at(i, j); if (p[1] <= yc - slope * p[2]) { const q = S.at(i, j - 1); const f0 = q[1] - (yc - slope * q[2]), f1 = p[1] - (yc - slope * p[2]); return j - 1 + f0 / (f0 - f1); } }
    return S.rows - 1;
  });
  const point = (i, jf) => { const j = Math.floor(jf), t = jf - j; const a = S.at(i, j), b = S.at(i, Math.min(S.rows - 1, j + 1)); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  const lengthOf = (js) => js.reduce((L, jf, i) => { const a = point(i, jf), b = point((i + 1) % S.angles, js[(i + 1) % S.angles]); return L + Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }, 0);
  let lo = -8, hi = S.top - 1;
  for (let n = 0; n < 40; n++) { const m = (lo + hi) / 2; if (lengthOf(yAt(m)) > length) lo = m; else hi = m; }
  const js = yAt((lo + hi) / 2);
  return { js, points: js.map((jf, i) => point(i, jf)), length: lengthOf(js), yc: (lo + hi) / 2 };
};

let ring, slope = 0;
{
  const fullRounds = K.rounds.filter((r) => r.kind === "round" && r.year); const frontRows = Math.min(...fullRounds[fullRounds.length - 1].rows);
  const down = (i, jf, length) => { let j = Math.floor(jf), p = S.at(i, j), t = 0; while (j + 1 < S.rows) { const q = S.at(i, j + 1), d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); if (t + d >= length) return p[1] + (q[1] - p[1]) * ((length - t) / d); t += d; p = q; j++; } return p[1]; };
  const lengthTo = (i, jf, y) => { let j = Math.floor(jf), p = S.at(i, j), t = 0; while (j + 1 < S.rows) { const q = S.at(i, j + 1); if (q[1] <= y) return t + Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) * ((p[1] - y) / (p[1] - q[1] || 1)); t += Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); p = q; j++; } return t; };
  const wantAt = (sl) => { const r = ringOf(S, K.rounds[0].n * w, sl); const yDiv = down(S.angles / 2, r.js[S.angles / 2], frontRows * h); return lengthTo(0, r.js[0], yDiv) / h - frontRows; };
  let lo = -0.3, hi = 0.9; for (let n = 0; n < 24; n++) { const m = (lo + hi) / 2; if (wantAt(m) < shortRows) lo = m; else hi = m; }
  slope = (lo + hi) / 2; ring = ringOf(S, K.rounds[0].n * w, slope);
  console.log("tilted for", shortRows, "rows more at the back: slope", slope.toFixed(3), "(down the middle lines the back wants", wantAt(slope).toFixed(1), "more)");
}
// The lines down from the neck. A column of knitting has the same number of rows in it all the way round, so a round lies where each column
// has come that many rows down from the cast-on; and a column runs straight down from where it starts, seen from above - down the body's
// surface in the upright plane through the neck's axis. LINES of them, starting evenly spaced along the ring; a point on each for each row.
const LINES = 144;
const maxRows = Math.max(...K.rounds.map((r) => Math.max(...r.rows)));
const depths = Array.from({ length: maxRows + 40 }, (_, i) => (i + 0.5) * h);
const lines = (() => {
  const n = S.angles; const cum = [0]; for (let i = 0; i < n; i++) { const a = ring.points[i], b = ring.points[(i + 1) % n]; cum.push(cum[i] + Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); }
  const at = (ia, t, j) => { const a = S.at(ia, j), b = S.at((ia + 1) % n, j); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  return Array.from({ length: LINES }, (_, k) => {
    const target = ((k + 0.5) / LINES) * cum[n]; let ia = 0; while (cum[ia + 1] < target) ia++;
    const t = (target - cum[ia]) / (cum[ia + 1] - cum[ia]); const jf = ring.js[ia] + (ring.js[(ia + 1) % n] - ring.js[ia]) * t;
    // From the ring down this plane, a point at each row's depth.
    let j = Math.floor(jf); const f = jf - j; const p0 = at(ia, t, j), p1 = at(ia, t, Math.min(S.rows - 1, j + 1));
    let p = [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f, p0[2] + (p1[2] - p0[2]) * f], gone = 0, d = 0; const out = [];
    j++;
    while (out.length < depths.length && j < S.rows) {
      const q = at(ia, t, j), seg = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
      while (out.length < depths.length && gone + seg >= depths[out.length]) { const u = (depths[out.length] - gone) / (seg || 1); out.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u]); }
      gone += seg; p = q; j++; d++;
    }
    while (out.length < depths.length) out.push(p.slice());
    return out;
  });
})();
const room = depths.map((_, r) => lines.map((line, k) => { const a = line[r], b = lines[(k + 1) % LINES][r]; return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }));
console.log("ring", ring.length.toFixed(1), "cm; back", ring.points[0].map((v) => v.toFixed(1)).join(","), "front", ring.points[S.angles / 2].map((v) => v.toFixed(1)).join(","), "slope", slope.toFixed(2));
console.log("the ring's middle is", ((ring.points[0][2] + ring.points[S.angles / 2][2]) / 2).toFixed(2), "cm forward of the axis");
const fell = ring.points[0][1] - ring.points[S.angles / 2][1];
console.log("the ring falls", fell.toFixed(1), "cm from back to front");
writeFileSync(out, JSON.stringify({ LINES, depths, fall: +fell.toFixed(1), room: room.map((row) => row.map((v) => +v.toFixed(3))), lines: lines.map((line) => line.map((p) => p.map((v) => +v.toFixed(2)))) }));
