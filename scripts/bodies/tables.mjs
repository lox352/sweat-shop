// The room bodies have for a yoke, for the app: for each size, the mean over its bodies of each sector's width at each depth below the
// cast-on, from the lines' files lines.mjs wrote (g-<size>-<body>.json). The same either side, so half the round is kept: from the middle
// of the back (0) to the middle of the front (SECTORS / 2). A body is smooth, so each depth after the first is written as what it is more
// than the depth above it: a third of the size to fetch, and nothing lost (body.ts adds them up again).
// usage: node tables.mjs <out.json> [size:files,comma,separated ...]   (with none: every size's four bodies)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const [out, ...given] = process.argv.slice(2);
const SECTORS = 48, GROUP = 3, EVEN = 2, STEP = 0.5, DEEP = 34;
const sizes = [["xs", 86], ["s", 96], ["m", 106], ["l", 116], ["xl", 126], ["2xl", 136], ["3xl", 146], ["4xl", 156]];
const names = ["man176", "man188", "man165", "woman172"];
const filesOf = Object.fromEntries(given.map((g) => { const [size, list] = g.split(":"); return [size, list.split(",")]; }));
const result = { sectors: SECTORS, stepCm: STEP, sizes: {} };
for (const [size, chestCm] of sizes) {
  const files = filesOf[size] ?? names.map((n) => `g-${size}-${n}.json`);
  if (!files.every((f) => existsSync(f))) { console.log(size, "not made yet"); continue; }
  const each = files.map((file) => {
    const G = JSON.parse(readFileSync(file, "utf8")); const FINE = G.LINES; const cell = (row, k) => row[((k % FINE) + FINE) % FINE];
    const raw = G.room.map((row) => Array.from({ length: SECTORS }, (_, s) => cell(row, s * GROUP - 2) + cell(row, s * GROUP - 1) + cell(row, s * GROUP)));
    const room = raw.map((row) => row.map((_, s) => { let t = 0, tw = 0; for (let k = -EVEN; k <= EVEN; k++) { const w = EVEN + 1 - Math.abs(k); t += w * row[(((s + k) % SECTORS) + SECTORS) % SECTORS]; tw += w; } return t / tw; }));
    const at = (cm) => { const d = G.depths; let r = 0; while (r + 2 < d.length && d[r + 1] < cm) r++; const t = Math.max(0, Math.min(1, (cm - d[r]) / (d[r + 1] - d[r]))); const a = room[Math.min(room.length - 1, r)], b = room[Math.min(room.length - 1, r + 1)]; return a.map((v, s) => v * (1 - t) + b[s] * t); };
    return Array.from({ length: Math.round(DEEP / STEP) + 1 }, (_, k) => at(k * STEP));
  });
  const room = each[0].map((_, k) => Array.from({ length: SECTORS / 2 + 1 }, (_, t) => { let sum = 0; for (const body of each) sum += (body[k][t] + body[k][(SECTORS - t) % SECTORS]) / 2; return Math.round((sum / each.length) * 100); }));
  result.sizes[size] = { chestCm, room: room.map((row, k) => (k ? row.map((v, t) => v - room[k - 1][t]) : row)) };
  console.log(size, "from", files.length, "bodies; at 10cm, back to front:", room[20].join(" "));
}
writeFileSync(out, JSON.stringify(result));
console.log(Object.keys(result.sizes).length, "sizes,", JSON.stringify(result).length, "bytes");
