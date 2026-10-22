/**
 * Work out the strip samplers' colourways, once, from the hats and the yarn
 * library.
 *
 *     node scripts/strip-colourways.mjs
 *
 * Writes src/data/sweaters/wool-week/strips/colourways.json, which is
 * reviewed and committed; the designs read that, never this - the yarn
 * library is far too big to ship to a phone for it. Rerun after changing a
 * hat's file, a palette or the yarn library.
 *
 * A colourway is a palette, all light or all dark. A palette is a few
 * Spindrift yarns in two families, lights and darks, the first of each the
 * ground, with perhaps some middle shades and an accent. Each hat's yarns
 * are read as ground, figure or, where it needs a third lightness, middle
 * (see roles below): all light puts the ground on the lights and the figure
 * on the darks, all dark the other way round. Then each hat's yarns go onto
 * the palette's the cheapest way that keeps every pair that meets in a round
 * apart - 20 L* between two roles, 8 between two of one role, the step Fair
 * Isle shades a ground by - and keeps the hat's order of contrast, gives its
 * rarest touches the accent and keeps its sheep white.
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

/* --------------------------------------------------------------- the hats */
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
const rowsOf = (year) => ranges[year].flatMap(([c, a, b]) => years[year].charts[c].map((r) => r.match(/../g).map((p) => p[0])).slice(a - 1, b));

/**
 * What each hat's yarns are, by what its charts depict (strips/roles.json):
 * the ground behind, the figure drawn on it, and - where a hat needs a third
 * lightness - the middle, which stands off both. A picture may pin a yarn to
 * the palette's lightest or darkest: sheep are white, and their faces black.
 */
const roles = JSON.parse(fs.readFileSync(path.join(dir, "strips/roles.json"), "utf8"));

/** Each hat's yarns in its first colourway, which pairs meet in a round, and how much of the hat each is. */
const hats = Object.fromEntries(order.map((year) => {
  const rows = rowsOf(year);
  const meets = new Set();
  const count = {};
  for (const r of rows) {
    const s = [...new Set(r)].sort();
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) meets.add(s[i] + s[j]);
    for (const x of r) count[x] = (count[x] ?? 0) + 1;
  }
  const total = Object.values(count).reduce((a, b) => a + b, 0);
  const share = Object.fromEntries(Object.entries(count).map(([k, v]) => [k, v / total]));
  const colour = Object.fromEntries(Object.keys(count).map((l) => [l, lab(years[year].colourway.shades[l].hex)]));
  const R = roles[year];
  const roleOf = Object.fromEntries([...R.ground.map((l) => [l, "ground"]), ...(R.middle ?? []).map((l) => [l, "middle"]), ...R.figure.map((l) => [l, "figure"])]);
  for (const l of Object.keys(count)) if (!roleOf[l]) throw new Error(`${year}: yarn ${l} has no role`);
  return [year, { year, roles: R, roleOf, letters: Object.keys(roleOf), pairs: [...meets].map((p) => [p[0], p[1]]), share, colour }];
}));

/* ------------------------------------------------------------- the palettes */
/**
 * The palettes, each after a knitting tradition, in Spindrift, grouped by
 * where the tradition is from for the picker. The first of each family is that
 * ground; the trim is any of the palette's yarns. T is how far apart in L* two
 * yarns of different roles that meet must be, where a palette's tradition is
 * softer than the usual 20: Bohus's close heathered shades.
 */
const palettes = [
  {
    id: "naturals", family: "Shetland and Fair Isle", name: "Shetland naturals",
    note: "Undyed: the sheep's own colours, by their Shetland names.",
    lights: [104, 105, 106, 103], darks: [101, 108, 102], mids: [107],
  },
  {
    id: "early", family: "Shetland and Fair Isle", name: "Indigo, madder and white",
    note: "Early Fair Isle: natural white and moorit with imported indigo and madder and a plant-dyed yellow.",
    lights: [104, 105, 230], darks: [727, 587, 108], mids: [676],
  },
  {
    id: "twenties", family: "Shetland and Fair Isle", name: "Fawn and grey, 1920s",
    note: "The Prince of Wales years: grounds of fawn or grey, the bands in blue, gold, red, green, brown and black.",
    lights: [105, 104, 289, 106], darks: [102, 101, 684, 525, 147, 108],
  },
  {
    id: "vintage", family: "Shetland and Fair Isle", name: "Vintage allover, 1930s",
    note: "The Aal Ower Toorie's own Vintage yarns, from the Guild's 1930s graph book, over every year.",
    lights: [105, 104, 390, 1200], darks: [108, 587, 147, 676],
  },
  {
    id: "lopi", family: "North Atlantic and Scandinavia", name: "Icelandic greys",
    note: "Lopapeysa colours: natural greys from near-white to black, a grey ground and black-and-white pattern.",
    lights: [113, 104, 103], darks: [102, 101, 110], mids: [111],
  },
  {
    id: "selbu", family: "North Atlantic and Scandinavia", name: "Black and white",
    note: "Selbu, Setesdal and the Faroes: two undyed colours, a grey only where a picture needs a third, and a touch of red.",
    lights: [104], darks: [101], mids: [103], accent: [587], midCost: 12,
  },
  {
    id: "marius", family: "North Atlantic and Scandinavia", name: "Marius: navy, white, red",
    note: "Norway's Mariusgenser of 1953, in the flag's three colours.",
    lights: [104], darks: [730], mids: [500], midCost: 1,
  },
  {
    id: "bohus", family: "North Atlantic and Scandinavia", name: "Bohus blues",
    note: "Bohus Stickning's way: many close, heathered shades of one colour, soft contrast, one small bright.",
    lights: [655, 134, 175], darks: [160, 150, 722], accent: [1010], T: 17,
  },
  {
    id: "muhu", family: "The Baltic", name: "Muhu brights",
    note: "Estonia's Muhu island: black grounds with fluorescent pink, orange, yellow and red, and white in older pieces.",
    lights: [104, 410], darks: [999], mids: [530, 470, 790, 500], midCost: 0,
  },
  {
    id: "latvia", family: "The Baltic", name: "Latvian white ground",
    note: "Zemgale mittens: bright bands of red, green, blue and yellow on white, or on a deep red.",
    lights: [304, 1160], darks: [595, 684], mids: [525, 790, 684], midCost: 0,
  },
  {
    id: "andes", family: "Further afield", name: "Cochineal and indigo",
    note: "Andean chullos: cochineal reds and indigo with white and plant yellows.",
    lights: [104, 1160], darks: [580, 727], mids: [525, 470, 805], midCost: 1,
  },
  {
    id: "sanquhar", family: "Further afield", name: "Sanquhar peat and gold",
    note: "Dumfriesshire's two-colour gloves: black and white, or brown and yellow; here the brown and yellow.",
    lights: [289], darks: [198], mids: [1190], midCost: 12,
  },
  {
    id: "buggiflooer", family: "From the hats", name: "Buggiflooer brights",
    note: "2023's black ground with turquoise, blue, lemon and its one red round, over every year.",
    lights: [350, 182, 660], darks: [999, 757], mids: [524], midCost: 2, accent: [524],
  },
  {
    id: "anemone", family: "From the hats", name: "Sea anemone",
    note: "2026's Sea Anemone yarns, port wine and gentian, cloud, orchid and lilac, over every year.",
    lights: [764, 547, 620], darks: [293, 710, 763],
  },
  {
    id: "classic", family: "The samplers' first colours", name: "Aa ae colour, classic",
    note: "The six yarns the samplers were first knitted in, put on by ground and figure.",
    lights: [104, 106, 423], darks: [727, 587, 688],
  },
];

const spindrift = Object.entries(library["jamieson-s-of-shetland-spindrift"].colours).map(([wool, c]) => ({ wool, ...c }));
const byCode = (code) => {
  const found = spindrift.find((s) => s.code === String(code));
  if (!found) throw new Error(`no Spindrift ${code}`);
  return found;
};

const T = 20;
const SAME = 8;

/** Each hat's yarns onto a palette's, all light or all dark. */
const solve = (pal, light) => {
  const codes = [...new Set([...pal.lights, ...pal.darks, ...(pal.mids ?? []), ...(pal.accent ?? [])])];
  const Y = Object.fromEntries(codes.map((c) => [c, lab(byCode(c).hex)]));
  const lightest = codes.reduce((a, c) => (Y[c].L > Y[a].L ? c : a));
  const darkest = codes.reduce((a, c) => (Y[c].L < Y[a].L ? c : a));
  const ground = light ? pal.lights : pal.darks, figure = light ? pal.darks : pal.lights;
  const mids = pal.mids ?? [], midCost = pal.midCost ?? 3, accent = pal.accent ?? [];
  // How often each yarn has been a figure so far, so the years share the palette out.
  const used = new Map();
  let usedTotal = 0;
  const maps = {};
  for (const year of order) {
    const h = hats[year];
    const role = (l) => h.roleOf[l];
    const main = h.roles.ground[0];
    const contrast = Object.fromEntries(h.letters.map((l) => [l, Math.abs(h.colour[l].L - h.colour[main].L)]));
    const unary = (l, c) => {
      const pin = h.roles.pins?.[l];
      if (pin === "lightest" && c !== lightest) return Infinity;
      if (pin === "darkest" && c !== darkest) return Infinity;
      const accentOnly = accent.includes(c) && !ground.includes(c) && !figure.includes(c) && !mids.includes(c);
      const inMid = mids.includes(c) || accentOnly;
      let k = 0;
      if (pin) k = 0;
      else if (l === main) k = c === ground[0] ? 0 : ground.includes(c) ? 20 : inMid ? 30 : 40;
      else if (role(l) === "ground") k = c === ground[0] ? 0 : ground.includes(c) ? 3 : inMid ? 8 + midCost : 20;
      else if (role(l) === "middle") k = inMid ? 0 : 2;
      else k = figure.includes(c) ? 0 : inMid ? midCost : 20;
      if (accent.length && role(l) !== "ground") {
        const small = (h.share[l] ?? 0) < 0.03;
        if (small) k += accent.includes(c) ? (accentOnly ? -midCost : 0) : 2;
        else if (accent.includes(c)) k += accentOnly ? 10 : 2;
      }
      const spread = role(l) === "ground" ? 0 : (0.6 * (used.get(c) ?? 0)) / Math.max(1, usedTotal);
      return k + 0.005 * dE(h.colour[l], Y[c]) + spread;
    };
    // The pinned and the main ground first, then the yarns with most to keep apart.
    const degree = (l) => h.pairs.filter((p) => p.includes(l)).length;
    const seq = [...h.letters].sort((a, b) => (h.roles.pins?.[b] ? 1 : 0) - (h.roles.pins?.[a] ? 1 : 0) || (b === main) - (a === main) || degree(b) - degree(a));
    const cands = Object.fromEntries(seq.map((l) => [l, codes.map((c) => [c, unary(l, c)]).filter(([, k]) => k < Infinity).sort((p, q) => p[1] - q[1])]));
    const rest = [...seq, null].map((_, i) => seq.slice(i).reduce((s, l) => s + cands[l][0][1], 0));
    let best = null;
    const pick = {};
    // A middle stands between: lighter than every ground and darker than every figure all dark, the other way all light.
    const rank = { ground: 0, middle: 1, figure: 2 };
    const between = (l, c) => h.letters.every((o) => {
      if (pick[o] === undefined || o === l || (role(l) !== "middle" && role(o) !== "middle") || role(l) === role(o)) return true;
      const up = (rank[role(l)] - rank[role(o)]) * (light ? -1 : 1);
      return up > 0 ? Y[c].L > Y[pick[o]].L : Y[c].L < Y[pick[o]].L;
    });
    const apart = (l, c) => between(l, c) && h.pairs.every(([a, b]) => {
      const o = a === l ? b : b === l ? a : null;
      if (!o || pick[o] === undefined) return true;
      const need = role(a) === role(b) && !h.roles.pins?.[a] && !h.roles.pins?.[b] ? SAME : (pal.T ?? T);
      return c !== pick[o] && Math.abs(Y[c].L - Y[pick[o]].L) >= need;
    });
    const pairCost = (l, c) => {
      if (role(l) === "ground") return 0;
      const gl = Y[pick[main] ?? ground[0]].L;
      let k = 0;
      for (const o of h.letters) {
        if (o === l || role(o) === "ground" || pick[o] === undefined) continue;
        if (pick[o] === c) k += 1.5;
        const want = contrast[l] - contrast[o], got = Math.abs(Y[c].L - gl) - Math.abs(Y[pick[o]].L - gl);
        if (Math.abs(want) > 8 && Math.sign(want) !== Math.sign(got)) k += 2;
      }
      return k;
    };
    const search = (i, cost) => {
      if (best && cost + rest[i] >= best.cost) return;
      if (i === seq.length) { best = { cost, pick: { ...pick } }; return; }
      const l = seq[i];
      for (const [c, u] of cands[l]) {
        if (!apart(l, c)) continue;
        pick[l] = c;
        search(i + 1, cost + u + pairCost(l, c));
        delete pick[l];
      }
    };
    search(0, 0);
    if (!best) throw new Error(`${pal.id}, ${light ? "light" : "dark"}: ${year} will not go onto the palette`);
    maps[year] = Object.fromEntries(Object.entries(best.pick).map(([l, c]) => [l, String(c)]));
    for (const l of h.letters) if (role(l) !== "ground") { used.set(best.pick[l], (used.get(best.pick[l]) ?? 0) + 1); usedTotal++; }
  }
  return maps;
};

const yarns = {};
const keep = (code) => {
  const c = byCode(code);
  yarns[c.code] = { name: c.name, code: c.code, hex: c.hex, wool: c.wool };
};
const lightness = (code) => lab(byCode(code).hex).L;
const written = palettes.map((pal) => {
  const all = [...new Set([...pal.lights, ...pal.darks, ...(pal.mids ?? []), ...(pal.accent ?? [])])];
  all.forEach(keep);
  return {
    id: pal.id,
    family: pal.family,
    name: pal.name,
    note: pal.note,
    // The trim: any of the palette's yarns, lightest first; by default the ground's.
    yarns: all.sort((a, b) => lightness(b) - lightness(a)).map(String),
    light: { ground: String(pal.lights[0]), maps: solve(pal, true) },
    dark: { ground: String(pal.darks[0]), maps: solve(pal, false) },
  };
});

fs.writeFileSync(out, JSON.stringify({ yarns, palettes: written }) + "\n");
console.log(`wrote ${path.relative(root, out)}: ${Object.keys(yarns).length} yarns, ${written.length} palettes`);
