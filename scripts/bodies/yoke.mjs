// The yoke of a size as knitted: every stitch's place round the neck it descends from (u, 0 at the middle of the back, the way the knitting goes),
// how many rows down it is, and whether it was made in its round.
// usage (from the repo): node scripts/bodies/yoke.mjs <repo> <size> <out.json>
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const [repo, size = "l", out] = process.argv.slice(2);
const { createServer } = await import(pathToFileURL(`${repo}/node_modules/vite/dist/node/index.js`).href);
const vite = await createServer({ root: repo, server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom", optimizeDeps: { noDiscovery: true, include: [] }, logLevel: "error" });
try {
  const design = "wool-week-strips-once-oldest";
  const { sweaterById } = await vite.ssrLoadModule("/src/compiler/designs/index.ts");
  const { buildSweater } = await vite.ssrLoadModule("/src/compiler/engine/engine.ts");
  const { kinds } = await vite.ssrLoadModule("/src/pattern/kinds.ts");
  const { planOf } = await vite.ssrLoadModule("/src/compiler/designs/wool-week/strips/plan.ts");
  const { banded } = await vite.ssrLoadModule("/src/compiler/designs/wool-week/strips/knit.ts");
  const { unitsOf } = await vite.ssrLoadModule("/src/compiler/designs/wool-week/strips/shaping.ts");
  const { measured } = await vite.ssrLoadModule("/src/compiler/designs/wool-week/strips/design.ts");
  const pattern = sweaterById(design);
  const s = pattern.sizes.find((x) => x.id === size);
  const k = buildSweater(pattern, size);
  const st = k.stitches;
  const u = new Float64Array(st.length).fill(NaN), rows = new Int32Array(st.length);
  const rounds = [];
  const fam = (t) => kinds[t]?.family;
  const consumed = (x) => (x.links.length > 0 ? x.links.slice(0, Math.max(0, x.links.length - (x.id === 0 ? 0 : 1))) : []);
  let first = true;
  const kindsSeen = {};
  for (let r = 0; r < k.rounds.length; r++) {
    if (k.roundPieces[r] !== "yoke") break;
    const ids = k.rounds[r];
    kindsSeen[k.roundKinds[r]] = (kindsSeen[k.roundKinds[r]] ?? 0) + 1;
    const real = ids.filter((id) => fam(st[id].type) !== "step");
    if (first) { real.forEach((id, i) => { u[id] = (i + 0.5) / real.length; rows[id] = 0; }); first = false; }
    else {
      // Stitches worked into others take their place; made ones go between their neighbours.
      for (const id of real) { const c = consumed(st[id]).filter((p) => !Number.isNaN(u[p])); if (c.length) { u[id] = c.reduce((t, p) => t + u[p], 0) / c.length; rows[id] = Math.max(...c.map((p) => rows[p])) + 1; } }
      real.forEach((id, i) => {
        if (!Number.isNaN(u[id])) return;
        let a = i - 1, b = i + 1;
        while (a >= 0 && Number.isNaN(u[real[a]])) a--;
        while (b < real.length && Number.isNaN(u[real[b]])) b++;
        const ua = a >= 0 ? u[real[a]] : u[real[b]] - 1e-4, ub = b < real.length ? u[real[b]] : ua + 1e-4;
        u[id] = (ua + ub) / 2; rows[id] = Math.max(a >= 0 ? rows[real[a]] : 0, b < real.length ? rows[real[b]] : 0);
      });
    }
    const slots = new Set(real.map((id) => st[id].slot.split("/")[0]));
    rounds.push({ kind: k.roundKinds[r], n: real.length, plain: slots.size === 1, slot: st[real[0]].slot, year: st[real[0]].slot.startsWith("trim") ? 0 : 2000 + Number(st[real[0]].slot.slice(0, 2)),
      u: real.map((id) => +u[id].toFixed(5)), rows: real.map((id) => rows[id]), made: real.map((id) => (consumed(st[id]).length === 0 && r > 0 ? 1 : 0)) });
  }
  const way = pattern.colourways[0]; const hexOf = Object.fromEntries(way.shades.map((x) => [x.slot, x.hex])); const nameOf = Object.fromEntries(way.shades.map((x) => [x.slot, x.name]));
  const pal = []; const palIx = (slot) => { let i = pal.findIndex((p) => p.slot === slot); if (i < 0) { pal.push({ slot, hex: hexOf[slot] ?? "#ff00ff", name: nameOf[slot] ?? slot }); i = pal.length - 1; } return i; };
  { let r = 0; for (const round of rounds) { while (k.roundPieces[r] !== "yoke") r++; const real = k.rounds[r].filter((id) => fam(st[id].type) !== "step"); round.c = real.map((id) => palIx(st[id].slot)); round.t = real.map((id) => st[id].type); r++; } }
  const holds = k.holds.map((h) => ({ at: h.heldAt, n: h.stitches?.length ?? h.count }));
  // The plan's rows for the yoke, and the units they are shaped by: each a band on its own repeat, or a round of one yarn.
  const planRows = banded(planOf(measured.find((m) => m.id === size).finished, { kind: "refit" }).rows.yoke);
  const units = unitsOf(planRows).map((u) => ({ rows: u.rows, solid: u.solid, w: u.w, slots: u.slots }));
  writeFileSync(out, JSON.stringify({ size, gauge: { w: 10 / s.stitchesPer10cm, h: 10 / s.roundsPer10cm }, finished: s.finished, toFit: s.toFitChestCm, checks: k.checks, holds, rounds, units, pal, colourway: way.name ?? way.id, planRows: planRows.length }));
  console.log(size, kindsSeen, "rounds", rounds.length, "first", rounds[0].n, "last", rounds[rounds.length - 1].n, "made", rounds.reduce((t, r) => t + r.made.reduce((a, b) => a + b, 0), 0),
    "made in plain", rounds.filter((r) => r.plain).reduce((t, r) => t + r.made.reduce((a, b) => a + b, 0), 0), "max rows", Math.max(...rounds[rounds.length - 1].rows), Math.min(...rounds[rounds.length - 1].rows));
} catch (e) { console.log("ERR", e.stack); } finally { await vite.close(); }
