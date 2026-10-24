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

/* ------------------------------------------------- many-colour palettes */
/**
 * Nine palettes of tens of yarns each, one organising idea apiece: a path
 * round the colour circle, the same after dark, Shetland's places, undyed
 * grounds, Fair Isle shading, the hats' own hues, Bohus's close tones,
 * Muhu's brights and the seasons. Every hat's yarns go on by what they draw
 * - ground or figure, by the site's foreground map, 2014's by the hat's own
 * light and dark since its yarns change role from band to band - each within
 * its lightness band, nearest a target (its own hat's colour unless the
 * palette sets one), from the palette's pool where it has one, and every two
 * that meet in a round 20 L* apart (17 in the Bohus heathers). The sheep stay
 * Natural White with Black faces, so nothing lighter than Natural White goes
 * in. Fair Isle shading also gives each band's rounds their own shades: see
 * `shading` and the slots' shade variants (strips/slots.ts).
 */
const stock = spindrift.filter((s) => !s.soldOut && s.code !== "304").map((s) => ({ ...s, lab: lab(s.hex) }));
const yarnOf = (code) => {
  const found = stock.find((s) => s.code === String(code));
  if (!found) throw new Error(`no Spindrift ${code} in stock`);
  return found;
};
const many = (codes) => codes.map(yarnOf);
const chroma = (l) => Math.hypot(l.a, l.b);
const ROLE_2014 = { B: "ground", D: "ground", A: "figure", C: "figure", E: "figure" };
const roleIn = (year, l) => (year === 2014 ? ROLE_2014[l] ?? "figure" : hats[year].roleOf[l]);
const pinOf = (year, l) => roles[year].pins?.[l];
const pinned = (year) => Object.keys(roles[year].pins ?? {}).length > 0;
const darkYear = (year) => Object.values(roles[year].pins ?? {}).includes("lightest") || year === 2023;
const partnersOf = (year, l) => hats[year].pairs.filter((p) => p.includes(l)).map((p) => (p[0] === l ? p[1] : p[0]));
const hueTarget = (deg, C, L) => ({ L, a: C * Math.cos((deg * Math.PI) / 180), b: C * Math.sin((deg * Math.PI) / 180) });

const nearestIn = (target, ok, avoid = [], list = stock, extra) => {
  let best = null, bestK = Infinity;
  for (const s of list) {
    if (!ok(s)) continue;
    let k = Math.hypot(s.lab.a - target.a, s.lab.b - target.b) + 0.35 * Math.abs(s.lab.L - target.L) + (extra ? extra(s) : 0);
    if (avoid.some((o) => o.code === s.code)) k += 1000;
    else if (avoid.some((o) => Math.abs(o.lab.L - s.lab.L) < 6)) k += 25;
    if (k < bestK) { bestK = k; best = s; }
  }
  return best;
};

const assign = ({ bands, target, pools, apartBy = 20, spread = 0 }) => {
  const maps = {};
  const uses = new Map();
  const extra = spread ? (s) => spread * (uses.get(s.code) ?? 0) : undefined;
  order.forEach((year, yi) => {
    const h = hats[year];
    const dark = darkYear(year);
    const seq = [...h.letters].sort((a, b) => (pinOf(year, b) ? 1 : 0) - (pinOf(year, a) ? 1 : 0) || partnersOf(year, b).length - partnersOf(year, a).length);
    const m = {};
    const used = { ground: [], middle: [], figure: [] };
    const apart = (l, c) => partnersOf(year, l).every((o) => !m[o] || Math.abs(m[o].lab.L - c.L) >= apartBy);
    for (const l of seq) {
      const pin = pinOf(year, l);
      if (pin === "lightest") { m[l] = yarnOf(104); continue; }
      if (pin === "darkest") { m[l] = yarnOf(999); continue; }
      const role = roleIn(year, l);
      const band = bands(role, dark, year);
      const inBand = (c) => c.L >= band.lo && c.L <= band.hi && chroma(c) >= (band.cmin ?? 0) && chroma(c) <= (band.cmax ?? 999);
      const t0 = target ? target(year, yi, l, role, used[role].length, dark) : h.colour[l];
      const t = { ...t0, L: Math.min(band.hi, Math.max(band.lo, t0.L)) };
      const pool = pools?.(year, role, dark);
      const ex = role === "ground" ? undefined : extra;
      const pick = (pool && nearestIn(t, (s) => apart(l, s.lab), used[role], pool, ex))
        ?? nearestIn(t, (s) => inBand(s.lab) && apart(l, s.lab), used[role], stock, ex)
        ?? nearestIn(t, (s) => apart(l, s.lab), used[role])
        ?? nearestIn(t, (s) => inBand(s.lab), used[role]);
      m[l] = pick;
      used[role].push(pick);
      uses.set(pick.code, (uses.get(pick.code) ?? 0) + 1);
    }
    maps[year] = Object.fromEntries(Object.entries(m).map(([l, c]) => [l, c.code]));
  });
  return maps;
};

const lightBands = (lo) => (role, dark) =>
  dark
    ? role === "ground" ? { lo: 26, hi: 48, cmax: 40 } : role === "middle" ? { lo: 45, hi: 62, cmin: 12 } : { lo: 62, hi: 92, cmax: 50 }
    : role === "ground" ? { lo, hi: 96, cmax: 26 } : role === "middle" ? { lo: 44, hi: 66, cmin: 12 } : { lo: 8, hi: 44, cmax: 50 };
// A path round the colour circle, a step a year; middles lean towards the next year's hue to bridge the bands.
const pathTarget = (hues) => (year, yi, l, role, k, dark) => {
  const h = hues[yi] + (role === "middle" ? (hues[yi + 1] ?? hues[yi] + 26) - hues[yi] : 0);
  const C = role === "ground" ? (dark ? 14 : 6) : role === "middle" ? 34 : 28;
  const L = role === "ground" ? (dark ? 38 - 6 * k : 88 - 6 * k) : role === "middle" ? 55 : dark ? 78 - 7 * k : 32 - 7 * k;
  return hueTarget(h, C, L);
};

/*
 * Each year's place down the jumper, 0 at the neck to 1 at the hem or cuff, as Each Year Once in M has it: the yoke the
 * first part, then the body and the sleeves each the rest from the underarm, so a body band and the sleeve band level
 * with it share a place. The journeys in step take their hues from it rather than from the year.
 */
const DEPTH = { 2014: 0.056, 2015: 0.166, 2016: 0.294, 2017: 0.421, 2018: 0.528, 2019: 0.64, 2020: 0.773, 2021: 0.921, 2022: 0.422, 2023: 0.538, 2024: 0.662, 2025: 0.794, 2026: 0.928 };
// A journey round the colour circle by place down the jumper, from `start` through `span` degrees; middles lean a twelfth of the way on.
const inStep = (start, span) => (year) => start + span * DEPTH[year];
const lightJourney = (hueOf, lean) => (year, yi, l, role, k, dark) => {
  const h = hueOf(year) + (role === "middle" ? lean : 0);
  const C = role === "ground" ? (dark ? 14 : 6) : role === "middle" ? 34 : 28;
  const L = role === "ground" ? (dark ? 38 - 6 * k : 88 - 6 * k) : role === "middle" ? 55 : dark ? 78 - 7 * k : 32 - 7 * k;
  return hueTarget(h, C, L);
};
const nightBands = (role, dark, year) => pinned(year)
  ? role === "ground" ? { lo: 34, hi: 48 } : role === "middle" ? { lo: 52, hi: 64, cmin: 10 } : { lo: 66, hi: 92 }
  : role === "ground" ? { lo: 10, hi: 34, cmax: 34 } : role === "middle" ? { lo: 44, hi: 62, cmin: 12 } : { lo: 62, hi: 92, cmax: 48 };
const nightJourney = (hueOf, lean) => (year, yi, l, role, k) => {
  const h = hueOf(year) + (role === "middle" ? lean : 0);
  if (role === "ground") return hueTarget(h, 12, (pinned(year) ? 42 : 22) - 5 * k);
  return role === "middle" ? hueTarget(h, 30, 54) : hueTarget(h, 26, 82 - 6 * k);
};

const LAND = {
  2014: [[104, 120, 183], [880, 198, 1190, 118], [429]],
  2015: [[286, 319, 812, 147], [1130, 375, 104], [425]],
  2016: [[375, 183, 179], [587, 150, 815, 880], [1160]],
  2017: [[135, 764, 768], [150, 1020, 258, 688], [760]],
  2018: [[113, 768, 1390], [1270, 150, 789, 160], [617]],
  2019: [[688, 258, 1020, 292], [770, 1130, 375, 104], [470]],
  2020: [[547, 153, 268], [1270, 596, 239, 1290], [562]],
  2021: [[1390, 120, 113], [640, 677, 123, 102], [1010]],
  2022: [[768, 104, 764], [258, 1020, 292, 150], [790]],
  2023: [[117, 198, 101, 880], [1160, 182, 929, 555, 350], [524]],
  2024: [[183, 121, 114], [239, 1290, 815, 880], [616]],
  2025: [[104, 120, 121, 183], [676, 587, 147, 1200], [1160]],
  2026: [[764, 620, 120], [293, 710, 1290, 633], [616]],
};
const NAT_LIGHT = many([104, 120, 183, 114, 106, 121]);
const NAT_DARK = many([102, 118, 117, 101]);
const MUHU_FIG = many([530, 570, 540, 555, 562, 550, 581, 470, 308, 271, 435, 478, 462, 500, 524, 526, 425, 1160, 410, 104, 400]);
const MUHU_HUES = [352, 48, 22, 80];
const SEASON = [[250, 8], [230, 12], [205, 14], [160, 22], [130, 26], [100, 30], [350, 24], [75, 32], [60, 32], [45, 36], [30, 34], [345, 26], [315, 22]];
// Fair Isle shading: for each year a ground ramp and a figure ramp, edge of the band to its centre, and a bright for centre rounds.
const SHADES = {
  2014: { G: [106, 183, 120, 104], F: [1190, 880, 198, 970], M: 423 },
  2015: { G: [286, 319, 812, 147], F: [1130, 274, 768, 104], M: 425 },
  2016: { G: [342, 183, 179, 343], F: [572, 587, 595, 293], M: 790 },
  2017: { G: [760, 135, 764, 104], F: [685, 684, 727, 730], M: 676 },
  2018: { G: [320, 113, 768, 104], F: [610, 1300, 599, 598], M: 425 },
  2019: { G: [688, 258, 1020, 292], F: [770, 929, 135, 764], M: 470 },
  2020: { G: [153, 555, 547, 268], F: [812, 788, 800, 820], M: 530 },
  2021: { G: [180, 620, 547, 104], F: [726, 710, 727, 730], M: 665 },
  2022: { G: [320, 113, 768, 104], F: [258, 1020, 292, 820], M: 1140 },
  2023: { G: [102, 123, 126, 999], F: [425, 1160, 182, 350], M: 470 },
  2024: { G: [153, 555, 547, 268], F: [1190, 880, 198, 970], M: 616 },
  2025: { G: [121, 183, 120, 104], F: [676, 684, 727, 730], M: 587 },
  2026: { G: [620, 547, 764, 104], F: [633, 1260, 1290, 293], M: 616 },
};

// 2025's allover already shades itself, its diamonds' light ground inside and dark outside both in every row: it keeps its own yarns, one each.
const UNSHADED = [2025];

/** The shaded palette's yarn for each shade variant of each year's slots: see slots.ts. */
const shadingOf = () =>
  Object.fromEntries(order.filter((year) => !UNSHADED.includes(year)).map((year) => {
    const S = SHADES[year];
    const G = many(S.G), F = many(S.F), M = yarnOf(S.M);
    const L = (y) => y.lab.L;
    // A second ground in a round: the ramp's shade farthest from the first, still 20 off the figure.
    const h = G.map((g, i) => {
      const others = G.filter((_, j) => j !== i).sort((p, q) => Math.abs(L(q) - L(g)) - Math.abs(L(p) - L(g)));
      return (others.find((o) => Math.abs(L(o) - L(F[i])) >= 20) ?? others[0]).code;
    });
    // A second figure: the bright where it stands 20 off the ground and 8 off the first figure, else the figure ramp's farthest shade.
    const m = F.map((f, i) => {
      if (Math.abs(L(M) - L(G[i])) >= 20 && Math.abs(L(M) - L(f)) >= 8) return M.code;
      const others = F.filter((_, j) => j !== i).sort((p, q) => Math.abs(L(q) - L(f)) - Math.abs(L(p) - L(f)));
      return (others.find((o) => Math.abs(L(o) - L(G[i])) >= 20) ?? others[0]).code;
    });
    // The centre round's figure: the bright, where it stands 20 off the centre's ground.
    const c = Math.abs(L(M) - L(G[3])) >= 20 ? M.code : F[3].code;
    return [year, { G: S.G.map(String), F: S.F.map(String), h, m, c }];
  }));
const shadedMaps = () => {
  const own = assign({ bands: lightBands(74) });
  return Object.fromEntries(order.map((year) => [year, UNSHADED.includes(year) ? own[year] : Object.fromEntries(hats[year].letters.map((l) => {
    const pin = pinOf(year, l);
    if (pin) return [l, pin === "lightest" ? "104" : "999"];
    return [l, String(roleIn(year, l) === "ground" ? SHADES[year].G[0] : SHADES[year].F[0])];
  }))]));
};

const manyPalettes = [
  {
    id: "journey", mode: "light", name: "Colour journey", trim: 198,
    note: "One step round the colour circle each year, from 2014's peat browns through gold, moss, sea, blue and heather to madder at the cuffs: related hues at every join, pale near-natural grounds, heathered figures.",
    maps: () => assign({ bands: lightBands(76), target: pathTarget(order.map((_, i) => 45 + 26 * i)) }),
  },
  {
    id: "night-journey", mode: "dark", name: "Night journey", trim: 999,
    note: "The same walk round the colour circle after dark, from midnight blue through violet, rose, madder, ochre and moss: deep grounds, lit figures, the sheep on dusk so their faces show.",
    maps: () => assign({
      bands: (role, dark, year) => pinned(year)
        ? role === "ground" ? { lo: 34, hi: 48 } : role === "middle" ? { lo: 52, hi: 64, cmin: 10 } : { lo: 66, hi: 92 }
        : role === "ground" ? { lo: 10, hi: 34, cmax: 34 } : role === "middle" ? { lo: 44, hi: 62, cmin: 12 } : { lo: 62, hi: 92, cmax: 48 },
      target: (year, yi, l, role, k) => {
        const h = 230 + 26 * yi + (role === "middle" ? 26 : 0);
        if (role === "ground") return hueTarget(h, 12, (pinned(year) ? 42 : 22) - 5 * k);
        return role === "middle" ? hueTarget(h, 30, 54) : hueTarget(h, 26, 82 - 6 * k);
      },
    }),
  },
  {
    id: "journey-in-step", mode: "light", name: "Colour journey, in step", trim: 198,
    note: "The colour journey's route, peat browns through gold, moss, sea, blue and heather to madder, each band's hue set by how far down the jumper it sits rather than by its year: the yoke takes the first part of the circle, then the body and sleeves walk the rest together from the underarm, so each body band and the sleeve band level with it share a hue.",
    maps: () => assign({ bands: lightBands(76), target: lightJourney(inStep(45, 312), 26) }),
  },
  {
    id: "journey-gentle", mode: "light", name: "Colour journey, in step, gentler", trim: 198,
    note: "In step, on half the circle: peat browns through gold and moss to sea green. Smaller steps between neighbouring bands, so the whole jumper reads as one gradual turn.",
    maps: () => assign({ bands: lightBands(76), target: lightJourney(inStep(45, 180), 15) }),
  },
  {
    id: "night-in-step", mode: "dark", name: "Night journey, in step", trim: 999,
    note: "The night journey's route, midnight blue through violet, rose, madder, ochre and moss to sea green, in step down the jumper: each body band and the sleeve band level with it share a hue.",
    maps: () => assign({ bands: nightBands, target: nightJourney(inStep(230, 312), 26) }),
  },
  {
    id: "night-gentle", mode: "dark", name: "Night journey, in step, gentler", trim: 999,
    note: "In step, on half the circle: midnight blue through violet and rose to madder, deep grounds and lit figures in smaller steps.",
    maps: () => assign({ bands: nightBands, target: nightJourney(inStep(230, 160), 13) }),
  },
  {
    id: "landscape", mode: "light", name: "Shetland landscape", trim: 102,
    note: "Each year a place - peat bank, hill park, crofts, the voe, simmer dim, roadside, heather and thrift, drystone dyke, cliffs, buggiflooers, heather moor, the allover and the shore - in soft heathers on natural or pale grounds.",
    maps: () => assign({ bands: lightBands(72), pools: (year, role) => many(LAND[year][role === "ground" ? 0 : role === "middle" ? 2 : 1]) }),
  },
  {
    id: "undyed-grounds", mode: "light", name: "Undyed grounds, dyed figures", trim: 118,
    note: "The Shetland Museum's rule, that there is always a natural however many dyed shades go in: every ground the sheep's own colour, every figure a dyed shade near its own hat's.",
    maps: () => assign({
      bands: (role, dark) =>
        dark ? role === "middle" ? { lo: 45, hi: 62, cmin: 22, cmax: 55 } : role === "ground" ? { lo: 10, hi: 45, cmax: 18 } : { lo: 62, hi: 92, cmin: 22, cmax: 55 }
          : role === "middle" ? { lo: 45, hi: 66, cmin: 22, cmax: 55 } : role === "ground" ? { lo: 66, hi: 96, cmax: 18 } : { lo: 8, hi: 45, cmin: 22, cmax: 55 },
      pools: (year, role, dark) => (role === "ground" ? (year === 2023 ? many([101, 117]) : dark ? NAT_DARK : NAT_LIGHT) : null),
    }),
  },
  {
    id: "shaded", mode: "light", name: "Shaded Fair Isle", trim: 727, shaded: true,
    note: "Fair Isle's own way with many colours: in every band the ground steps through four shades of one family and the pattern four of another, edge to centre and back, a bright in the centre round of every deep band. 2025's allover, which shades itself, keeps its own yarns.",
    maps: shadedMaps,
  },
  {
    id: "hats-hues", mode: "light", name: "The hats' own hues", trim: 102,
    note: "Every band in its own hat's hues, set on one plan of pale grounds and deep figures, the sheep and the Buggiflooer on dark: each band like its hat, every round legible.",
    maps: () => assign({ bands: lightBands(74) }),
  },
  {
    id: "bohus-heathers", mode: "light", name: "Bohus heathers", trim: 160,
    note: "After Bohus Stickning: many close heathered blues, blue-greys and lilacs, mid-light grounds and deeper figures, a small warm surprise in the middles, and the softest contrast here.",
    maps: () => assign({
      apartBy: 17, spread: 6,
      bands: (role, dark) =>
        dark ? role === "ground" ? { lo: 30, hi: 46 } : role === "middle" ? { lo: 48, hi: 62 } : { lo: 64, hi: 92 }
          : role === "ground" ? { lo: 58, hi: 82, cmax: 24 } : role === "middle" ? { lo: 44, hi: 62 } : { lo: 18, hi: 46, cmax: 36 },
      pools: (year, role, dark) =>
        dark
          ? role === "ground" ? many([150, 162, 168, 1020, 750]) : role === "middle" ? many([665, 616, 540, 628]) : many([655, 135, 764, 104, 620, 929, 770])
          : role === "ground" ? many([134, 655, 130, 1390, 135, 274, 620, 764, 760, 929, 615, 617, 770])
            : role === "middle" ? many([1010, 665, 616, 540, 628, 136])
            : many([160, 150, 162, 168, 726, 1020, 633, 722, 677, 684, 685, 750, 258]),
    }),
  },
  {
    id: "muhu-stockings", mode: "dark", name: "Muhu stockings", trim: 999,
    note: "After Muhu's island stockings, which went from black, faded red and white to near-neon pink and orange in a generation: black grounds, pink, orange, coral and gold figures, the sheep on raspberry so their faces show.",
    maps: () => assign({
      spread: 14,
      bands: (role, dark, year) => (role === "ground" ? (pinned(year) ? { lo: 28, hi: 42 } : { lo: 4, hi: 22 }) : { lo: 45, hi: 92 }),
      pools: (year, role) => (role === "ground" ? (pinned(year) ? many([1260, 633]) : many([999, 1340, 101, 126])) : role === "middle" ? many([400, 104, 182, 350]) : MUHU_FIG),
      target: (year, yi, l, role, k) =>
        role === "ground" ? hueTarget(0, 0, pinned(year) ? 34 : 12) : role === "middle" ? hueTarget(95, 30, 88) : hueTarget(MUHU_HUES[(yi + k) % 4], 62, 60 + 6 * (k % 3)),
    }),
  },
  {
    id: "seasons", mode: "light", name: "Shetland seasons", trim: 102,
    note: "The jumper as a year: a winter yoke of grey, ice blue and white, a body from spring greens into summer pinks and golds, autumn sleeves of ochre, rust, madder and heather.",
    maps: () => assign({
      bands: lightBands(76),
      target: (year, yi, l, role, k, dark) => {
        const [h, c] = SEASON[yi];
        const nh = (SEASON[yi + 1] ?? SEASON[yi])[0];
        const C = role === "ground" ? (dark ? 14 : 5) : role === "middle" ? c + 6 : c;
        const L = role === "ground" ? (dark ? 38 - 6 * k : 88 - 6 * k) : role === "middle" ? 55 : dark ? 78 - 7 * k : 32 - 7 * k;
        return hueTarget(role === "middle" ? nh : h, C, L);
      },
    }),
  },
];

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

const writtenMany = manyPalettes.map((pal) => {
  const maps = pal.maps();
  const shading = pal.shaded ? shadingOf() : undefined;
  const codes = new Set([String(pal.trim), ...Object.values(maps).flatMap((m) => Object.values(m))]);
  if (shading) for (const s of Object.values(shading)) for (const c of [...s.G, ...s.F, ...s.h, ...s.m, s.c]) codes.add(String(c));
  codes.forEach(keep);
  // The trim: the palette's own, then the years' main grounds and its darkest yarns, lightest first, a dozen at most.
  const mains = order.map((year) => maps[year][roles[year].ground[0]]);
  const darkest = [...codes].sort((a, b) => lightness(a) - lightness(b)).slice(0, 4);
  const trims = [...new Set([String(pal.trim), ...mains, ...darkest])].slice(0, 12).sort((a, b) => lightness(b) - lightness(a));
  return { id: pal.id, family: "Many colours", name: pal.name, note: pal.note, mode: pal.mode, trim: String(pal.trim), trims, maps, ...(shading ? { shading } : {}) };
});

fs.writeFileSync(out, JSON.stringify({ yarns, palettes: written, many: writtenMany }) + "\n");
console.log(`wrote ${path.relative(root, out)}: ${Object.keys(yarns).length} yarns, ${written.length} palettes, ${writtenMany.length} many-colour palettes`);
