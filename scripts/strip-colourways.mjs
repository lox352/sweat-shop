/**
 * Work out the strip samplers' colourways, once, from the hats and the yarn
 * library.
 *
 *     node scripts/strip-colourways.mjs
 *
 * Writes src/data/sweaters/wool-week/strips/colourways.json, which is
 * reviewed and committed; the designs read that, never this - the yarn
 * library is far too big to ship to a phone for it. Rerun after changing a
 * hat's file or the yarn library.
 *
 * What it works out:
 * - **Ladders.** Six Spindrift yarns, darkest to lightest, and each hat's
 *   yarns onto them in their own order of lightness, spread over the whole
 *   ladder: its darkest yarn on the darkest rung, its lightest on the
 *   lightest. Two yarns that meet in a round never share a rung, so every
 *   round keeps its light and dark. For "Simmer dim", the same onto each
 *   window of four rungs, for a design to choose by where a year sits.
 * - **Each year its own.** One bag of twelve Spindrift yarns, the middle of
 *   all thirteen hats' colours, and each hat's yarns onto the nearest of
 *   them that keep every round's light and dark.
 * - **Collections.** One of each hat's own published colourways, chosen so
 *   the thirteen go together: by a theme, then traded pick by pick for one
 *   that sits closer to the other twelve, until nothing changes.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = path.join(root, "src/data/sweaters/wool-week");
const out = path.join(dir, "strips/colourways.json");
const library = JSON.parse(fs.readFileSync(path.join(root, "src/data/yarns/shetland-yarns.json"), "utf8"));
const years = Object.fromEntries(
  fs.readdirSync(dir).filter((f) => /^sww\d\d\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))).map((y) => [y.year, y]),
);
const order = Object.keys(years).map(Number).sort();

/* ------------------------------------------------------------ colour maths */
const lab = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [lin(n >> 16), lin((n >> 8) & 255), lin(n & 255)];
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
};
const dE = (p, q) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
const chroma = (c) => Math.hypot(c.a, c.b);
const hue = (c) => ((Math.atan2(c.b, c.a) * 180) / Math.PI + 360) % 360;

/* ------------------------------------------------------------- the hats */
// The rows the strip samplers cut from, each year: see strips/cuts.ts.
const ranges = {
  2014: [["A", 1, 4], ["B", 1, 13], ["C", 1, 13]],
  2015: [["A", 1, 25]],
  2016: [["A", 9, 41]],
  2017: [["A", 1, 14]],
  2018: [["B", 1, 34]],
  2019: [["B", 1, 3], ["C", 1, 16], ["D", 1, 7], ["E", 1, 12]],
  2020: [["B", 1, 40]],
  2021: [["B", 1, 35]],
  2022: [["B", 1, 14], ["C", 1, 13], ["D", 1, 14]],
  2023: [["B", 1, 4], ["C", 1, 25], ["D", 1, 4]],
  2024: [["B", 1, 11], ["C", 1, 15], ["D", 1, 12]],
  2025: [["A", 1, 16]],
  2026: [["Body", 1, 40]],
};
const rowsOf = (year, printing) =>
  ranges[year].flatMap(([c, a, b]) => {
    const rows = printing ? years[year].printings[printing][c].map((r) => [...r]) : years[year].charts[c].map((r) => r.match(/../g).map((p) => p[0]));
    return rows.slice(a - 1, b);
  });

/** A hat's yarns in its first colourway, darkest first, and which pairs meet in a round. */
const hats = Object.fromEntries(order.map((year) => {
  const rows = rowsOf(year);
  const used = [...new Set(rows.flat())];
  const yarns = used.map((slot) => ({ slot, ...lab(years[year].colourway.shades[slot].hex) })).sort((p, q) => p.L - q.L);
  const index = Object.fromEntries(yarns.map((v, i) => [v.slot, i]));
  const meets = new Set();
  for (const r of rows) {
    const s = [...new Set(r)].map((x) => index[x]).sort((a, b) => a - b);
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) meets.add(`${s[i]},${s[j]}`);
  }
  return [year, { year, yarns, meets }];
}));

/**
 * The cheapest order-keeping assignment of a hat's yarns to rungs, two yarns
 * on one rung only if they never meet in a round: over (yarn, rung, start of
 * the run of yarns on that rung).
 */
const fit = (hat, rungs, cost) => {
  const n = hat.yarns.length;
  const partner = hat.yarns.map((_, i) => Math.max(-1, ...[...Array(i).keys()].filter((j) => hat.meets.has(`${j},${i}`))));
  let best = new Map();
  for (let r = 0; r < rungs.length; r++) best.set(`${r},0`, { c: cost(0, r), path: [r] });
  for (let i = 1; i < n; i++) {
    const next = new Map();
    for (const [key, v] of best) {
      const [r, s] = key.split(",").map(Number);
      const keep = (k, c, path) => { if (!next.has(k) || next.get(k).c > c) next.set(k, { c, path }); };
      if (partner[i] < s) keep(`${r},${s}`, v.c + cost(i, r), [...v.path, r]);
      for (let q = r + 1; q < rungs.length; q++) keep(`${q},${i}`, v.c + cost(i, q), [...v.path, q]);
    }
    best = next;
  }
  let found;
  for (const v of best.values()) if (!found || v.c < found.c) found = v;
  return found && Object.fromEntries(hat.yarns.map((y, i) => [y.slot, found.path[i]]));
};

/** Spread over the whole ladder: each yarn's ideal rung is its rank among the hat's yarns. */
const spread = (hat, K) => {
  const n = hat.yarns.length;
  const ideal = (i) => (n === 1 ? 0 : (i / (n - 1)) * (K - 1));
  const map = fit(hat, Array.from({ length: K }), (i, r) => (ideal(i) - r) ** 2);
  if (!map) throw new Error(`${hat.year} will not go onto ${K} rungs`);
  return map;
};

/* ---------------------------------------------------------- the library */
const spindrift = Object.entries(library["jamieson-s-of-shetland-spindrift"].colours).map(([wool, c]) => ({ wool, ...c, ...lab(c.hex) }));
const byCode = (code) => spindrift.find((s) => s.code === String(code));
const woolOf = (id) => {
  for (const range of Object.values(library)) if (range.colours[id]) return range.colours[id];
  return undefined;
};
const yarns = {};
const keep = (c) => (yarns[c.code] = { name: c.name, code: c.code, hex: c.hex, wool: c.wool });

const ladders = {
  classic: [727, 587, 688, 423, 106, 104],
  undyed: [101, 117, 110, 116, 113, 104],
  simmer: [727, 1020, 688, 423, 1160, 104],
};
for (const codes of Object.values(ladders)) codes.forEach((c) => keep(byCode(c)));
const rungs = {
  classic: Object.fromEntries(order.map((y) => [y, spread(hats[y], 6)])),
  undyed: Object.fromEntries(order.map((y) => [y, spread(hats[y], 6)])),
  // Each year onto four neighbouring rungs: the window a design picks by where the year sits.
  simmer: Object.fromEntries(order.map((y) => [y, spread(hats[y], 4)])),
};

/* ------------------------------------------------- each year its own, in a bag */
const own = (() => {
  const K = 12;
  const colours = order.flatMap((year) => hats[year].yarns.map((v) => lab(years[year].colourway.shades[v.slot].hex)));
  let centres = [...colours].sort((p, q) => p.L - q.L).filter((_, i, all) => i % Math.floor(all.length / K) === 0).slice(0, K);
  for (let t = 0; t < 20; t++) {
    const groups = centres.map(() => []);
    for (const c of colours) groups[centres.reduce((bi, m, i) => (dE(c, m) < dE(c, centres[bi]) ? i : bi), 0)].push(c);
    centres = groups.map((g, i) => (g.length ? { L: g.reduce((s, c) => s + c.L, 0) / g.length, a: g.reduce((s, c) => s + c.a, 0) / g.length, b: g.reduce((s, c) => s + c.b, 0) / g.length } : centres[i]));
  }
  const bag = [...new Map(centres.map((m) => spindrift.reduce((best, c) => (dE(c, m) < dE(best, m) ? c : best))).map((c) => [c.code, c])).values()];
  const maps = {};
  for (const year of order) {
    const h = hats[year];
    const want = h.yarns.map((v) => lab(years[year].colourway.shades[v.slot].hex));
    const meets = [...h.meets].map((k) => k.split(",").map(Number));
    const cand = want.map((o) => [...bag].sort((p, q) => dE(p, o) - dE(q, o)));
    let best = null;
    const pick = [];
    const dfs = (i, cost) => {
      if (best && cost >= best.cost) return;
      if (i === h.yarns.length) { best = { cost, pick: [...pick] }; return; }
      for (const c of cand[i]) {
        pick[i] = c;
        // Every pair that meets, both placed: still apart, the lighter still lighter by ten.
        if (meets.every(([p, q]) => p > i || q > i || (pick[q].L >= pick[p].L + 10 && dE(pick[p], pick[q]) >= 18))) dfs(i + 1, cost + dE(c, want[i]));
      }
    };
    dfs(0, 0);
    if (!best) throw new Error(`${year} will not go into the bag`);
    maps[year] = Object.fromEntries(h.yarns.map((v, i) => [v.slot, best.pick[i].code]));
    best.pick.forEach(keep);
  }
  return maps;
})();

/* -------------------------------------------------------- the collections */
const usage = (year, printing) => {
  const n = {};
  for (const r of rowsOf(year, printing)) for (const s of r) n[s] = (n[s] ?? 0) + 1;
  return n;
};
const published = Object.fromEntries(order.map((year) => [year, years[year].colourways.map((cw, index) => {
  const n = usage(year, cw.part && cw.part !== "1-2" ? cw.part : undefined);
  const total = Object.values(n).reduce((a, b) => a + b, 0);
  const colours = Object.entries(n).map(([slot, k]) => ({ w: k / total, ...lab(cw.shades[slot].hex) }));
  const ground = colours.reduce((g, c) => (c.w > g.w ? c : g));
  const sum = (f) => colours.reduce((t, c) => t + c.w * f(c), 0);
  return {
    year, index, brand: (cw.brand ?? "").replace("Uradale Yarns", "Uradale"), colours,
    C: sum(chroma), groundL: ground.L,
    cool: sum((c) => (hue(c) >= 150 && hue(c) <= 290 ? chroma(c) : 0)) / Math.max(1, sum(chroma)),
    warm: sum((c) => (hue(c) <= 90 || hue(c) >= 320 ? chroma(c) : 0)) / Math.max(1, sum(chroma)),
  };
})]));
/** How far apart two colourways look: each colour to the nearest in the other, both ways, weighted by use. */
const apart = (p, q) => {
  const one = (x, y) => x.colours.reduce((t, c) => t + c.w * Math.min(...y.colours.map((d) => dE(c, d))), 0);
  return (one(p, q) + one(q, p)) / 2;
};
const fromMills = (...mills) => (c) => { const i = mills.indexOf(c.brand); return i < 0 ? mills.length * 10 : i * 10; };
const collect = (score, lambda) => {
  const norm = Object.fromEntries(order.map((y) => {
    const v = published[y].map(score);
    const lo = Math.min(...v), hi = Math.max(...v);
    return [y, (c) => (hi > lo ? (score(c) - lo) / (hi - lo) : 0)];
  }));
  const pick = Object.fromEntries(order.map((y) => [y, published[y].reduce((b, c) => (norm[y](c) < norm[y](b) ? c : b))]));
  for (let round = 0; round < 6; round++) {
    let changed = false;
    for (const y of order) {
      const cost = (c) => norm[y](c) + (lambda * order.filter((o) => o !== y).reduce((t, o) => t + apart(c, pick[o]), 0)) / 12 / 40;
      const best = published[y].reduce((b, c) => (cost(c) < cost(b) ? c : b));
      if (best !== pick[y]) { pick[y] = best; changed = true; }
    }
    if (!changed) break;
  }
  return pick;
};
const themes = [
  ["undyed", (c) => c.C, 0.6],
  ["js", fromMills("Jamieson & Smith"), 0.6],
  ["jamiesons", fromMills("Jamieson's of Shetland"), 0.6],
  ["uradale", fromMills("Uradale", "Shetland Organics"), 0.6],
  ["sea", (c) => -60 * c.cool + 0.2 * c.C * (c.cool < 0.4 ? 1 : 0), 0.4],
  ["heath", (c) => -60 * c.warm - 0.5 * c.C, 0.25],
  ["bright", (c) => -c.C, 0.4],
];
/** The closest-sitting thirteen that are not simply the naturals: a colourway with little colour counts against. */
const together = () => {
  const dull = (c) => Math.max(0, 16 - c.C) * 1.5;
  const total = (p) => { let t = 0; for (const a of order) for (const b of order) if (a < b) t += apart(p[a], p[b]); return t + 12 * order.reduce((u, y) => u + dull(p[y]), 0); };
  let best = null;
  for (const [, score] of themes) {
    const p = collect(score, 0);
    for (let round = 0; round < 8; round++) {
      let changed = false;
      for (const y of order) {
        const cost = (c) => order.filter((o) => o !== y).reduce((t, o) => t + apart(c, p[o]), 0) + 12 * dull(c);
        const b = published[y].reduce((x, c) => (cost(c) < cost(x) ? c : x));
        if (b !== p[y]) { p[y] = b; changed = true; }
      }
      if (!changed) break;
    }
    const s = total(p);
    if (!best || s < best.s) best = { s, p };
  }
  return best.p;
};
const picksOf = (p) => Object.fromEntries(order.map((y) => [y, p[y].index]));
const collections = {
  together: picksOf(together()),
  ...Object.fromEntries(themes.map(([id, score, lambda]) => [id, picksOf(collect(score, lambda))])),
};

/* --------------------------------------- the hats' own shades, checked against the library */
// A published shade keeps its library link only where the library still says the same.
const checked = Object.fromEntries(order.map((year) => [year, years[year].colourways.map((cw) => Object.fromEntries(Object.entries(cw.shades).map(([slot, s]) => {
  const wool = s.wool && woolOf(s.wool);
  const same = wool && wool.name === s.name && wool.hex === s.hex && (wool.code ?? undefined) === (s.code ?? undefined);
  return [slot, same ? { wool: s.wool } : { approximate: true }];
})))]));

fs.writeFileSync(out, JSON.stringify({ yarns, ladders, rungs, own, collections, checked }) + "\n");
console.log(`wrote ${path.relative(root, out)}: ${Object.keys(yarns).length} yarns`);
for (const [id, p] of Object.entries(collections)) console.log(id.padEnd(10), order.map((y) => `${y}:${years[y].colourways[p[y]].name}`).join(" "));
