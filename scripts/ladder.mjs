/**
 * Put thirteen hats' colours onto one jumper: the Wool Week Sampler's ladder.
 *
 *     node scripts/ladder.mjs
 *
 * Writes src/data/sweaters/wool-week/ladder.json, which is reviewed and
 * committed; the design reads that, never this. Rerun only to remap.
 *
 * Every hat is knitted in its own yarns, three to eight of them, and the
 * jumper can't be knitted in sixty. So it has ten - rungs of a ladder from
 * darkest to lightest, A to J - and each hat's yarns go onto rungs in their
 * own order of lightness: a hat's darkest yarn on a lower rung than its next,
 * and so on up. A colourway is then anything that keeps its rungs in order of
 * lightness, and in every one of them every hat keeps the light and dark it
 * was drawn in - what is a light pattern on a dark ground stays one, in every
 * row of every band. That is the whole of "keeping the contrasts", and a test
 * holds every colourway to it.
 *
 * How it is fitted:
 * - The rungs begin evenly spread in lightness, and each hat's yarns go onto
 *   them by the order-keeping assignment nearest in lightness - a small
 *   dynamic programme. Then each rung moves to the average of the yarns put
 *   on it, and the hats are fitted again, nearest in lightness and in hue.
 *   A few rounds of that and the rungs are the hats' own colours, rung by
 *   rung: the consensus of thirteen years.
 * - Lightness alone keeps every hat's polarity; some rows keep their contrast
 *   by hue instead - 2016's brown and blue houses, 2019's turquoise sea and
 *   lemon sky - so every pair of rungs that shares a row somewhere needs a
 *   colour difference in each colourway of at least three quarters of the
 *   one the hat had there, or of 22 if the hat's was bigger.
 * - Each colourway is then chosen from one yarn's shades in the yarn library:
 *   near a set of targets, every rung lighter than the one below it by at
 *   least one and a half, and every pair constraint met - a small backtracking search.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = path.join(root, "src/data/sweaters/wool-week");
const library = JSON.parse(fs.readFileSync(path.join(root, "src/data/yarns/shetland-yarns.json"), "utf8"));
const years = fs
  .readdirSync(dir)
  .filter((file) => /^sww\d\d\.json$/.test(file))
  .sort()
  .map((file) => JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")));

const rungNames = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

/** CIE L*a*b* of a hex colour, D65. */
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
const difference = (p, q) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);

const cellsOf = (row) => row.match(/../g).map((pair) => pair[0]);
/** The yarns a year knits in its charts. */
const usedBy = (year) => new Set(Object.values(year.charts).flat().flatMap(cellsOf));

const hats = years.map((year) => {
  const used = usedBy(year);
  const yarns = Object.entries(year.colourway.shades)
    .filter(([slot]) => used.has(slot))
    .map(([slot, shade]) => ({ slot, ...lab(shade.hex) }))
    .sort((p, q) => p.L - q.L);
  return { year: year.year, yarns };
});

let rungs = rungNames.map((_, index) => ({ L: 12 + (80 * index) / (rungNames.length - 1), a: 0, b: 0 }));

/** Each of a hat's yarns onto a rung, darkest lowest, by the cheapest order-keeping assignment. */
const fit = (hat, hue) => {
  const n = hat.yarns.length;
  const m = rungs.length;
  const cost = (yarn, rung) => (yarn.L - rung.L) ** 2 + hue * ((yarn.a - rung.a) ** 2 + (yarn.b - rung.b) ** 2);
  const best = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity));
  const from = Array.from({ length: n + 1 }, () => Array(m + 1).fill(-1));
  best[0].fill(0);
  for (let i = 1; i <= n; i++) {
    for (let j = i; j <= m; j++) {
      for (let k = i - 1; k < j; k++) {
        const total = best[i - 1][k] + cost(hat.yarns[i - 1], rungs[j - 1]);
        if (total < best[i][j]) [best[i][j], from[i][j]] = [total, k];
      }
    }
  }
  let j = n;
  for (let k = n; k <= m; k++) if (best[n][k] < best[n][j]) j = k;
  const map = {};
  for (let i = n; i >= 1; i--) {
    map[hat.yarns[i - 1].slot] = rungNames[j - 1];
    j = from[i][j];
  }
  return map;
};

let maps = [];
for (let round = 0; round < 8; round++) {
  maps = hats.map((hat) => fit(hat, round === 0 ? 0 : 0.3));
  const sums = rungs.map(() => ({ L: 0, a: 0, b: 0, n: 0 }));
  hats.forEach((hat, k) =>
    hat.yarns.forEach((yarn) => {
      const sum = sums[rungNames.indexOf(maps[k][yarn.slot])];
      sum.L += yarn.L;
      sum.a += yarn.a;
      sum.b += yarn.b;
      sum.n++;
    }),
  );
  rungs = sums.map((sum, index) => (sum.n ? { L: sum.L / sum.n, a: sum.a / sum.n, b: sum.b / sum.n } : rungs[index]));
}

/** For each pair of rungs that share a row somewhere, the colour difference every colourway must keep between them. */
const pairs = {};
years.forEach((year, k) => {
  for (const rows of Object.values(year.charts)) {
    for (const row of rows) {
      const slots = [...new Set(cellsOf(row))];
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          const [p, q] = [maps[k][slots[i]], maps[k][slots[j]]].sort();
          const hat = difference(lab(year.colourway.shades[slots[i]].hex), lab(year.colourway.shades[slots[j]].hex));
          pairs[p + q] = Math.max(pairs[p + q] ?? 0, Math.round(Math.min(hat, 30) * 0.75));
        }
      }
    }
  }
});

const shadesOf = (range) =>
  Object.entries(library[range].colours).map(([wool, colour]) => ({ wool, name: colour.name, code: colour.code, hex: colour.hex, soldOut: !!colour.soldOut, ...lab(colour.hex) }));

/** The colourway nearest `targets` from `pool`, rungs in order of lightness and every pair constraint kept. */
const choose = (label, targets, pool, fixed = {}) => {
  const candidates = targets.map((target, index) =>
    fixed[index]
      ? [{ ...fixed[index], cost: 0 }]
      : pool
          .filter((shade) => !shade.soldOut)
          .map((shade) => ({ ...shade, cost: difference(target, shade) }))
          .sort((p, q) => p.cost - q.cost)
          .slice(0, 30),
  );
  let best;
  let bestCost = Infinity;
  const picked = [];
  const search = (index, cost) => {
    if (cost >= bestCost) return;
    if (index === targets.length) {
      best = [...picked];
      bestCost = cost;
      return;
    }
    for (const shade of candidates[index]) {
      if (index > 0 && shade.L < picked[index - 1].L + 1.5) continue;
      if (picked.some((other) => other.wool === shade.wool)) continue;
      const kept = picked.every((other, j) => difference(other, shade) >= (pairs[rungNames[j] + rungNames[index]] ?? 0));
      if (!kept) continue;
      picked.push(shade);
      search(index + 1, cost + shade.cost);
      picked.pop();
    }
  };
  search(0, 0);
  if (!best) throw new Error(`no colourway ${label} keeps every contrast`);
  return best;
};

const toHex = ({ L, a, b }) => {
  // Back from L*a*b* to sRGB, for the consensus colours' record.
  const fy = (L + 16) / 116;
  const inv = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const [x, y, z] = [inv(fy + a / 500) * 0.95047, inv(fy), inv(fy - b / 200) * 1.08883];
  const rgb = [3.2406 * x - 1.5372 * y - 0.4986 * z, -0.9689 * x + 1.8758 * y + 0.0415 * z, 0.0557 * x - 0.204 * y + 1.057 * z];
  const gamma = (c) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)));
  return "#" + rgb.map((c) => gamma(c).toString(16).padStart(2, "0")).join("");
};

const spindrift = shadesOf("jamieson-s-of-shetland-spindrift");
const jamiesonSmith = shadesOf("jamieson-smith-2ply-jumper-weight");
const uradale = shadesOf("uradale-yarns-2ply-jumper-weight");
const vintage = years.find((year) => year.year === 2025);
const vintageFixed = {};
for (const [slot, shade] of Object.entries(vintage.colourway.shades)) {
  const found = spindrift.find((one) => one.wool === shade.wool);
  if (!found) throw new Error(`2025's ${shade.name} is not in the library`);
  vintageFixed[rungNames.indexOf(maps[years.indexOf(vintage)][slot])] = found;
}

const colourways = [
  {
    id: "aa-da-years",
    name: "Aa da Years",
    brand: "Jamieson's of Shetland",
    yarn: "2ply Jumper Weight (Spindrift)",
    wool: "jamieson-s-of-shetland-spindrift",
    url: "https://www.jamiesonsofshetland.co.uk",
    ballMetres: 105,
    ballGrams: 25,
    shades: choose("Aa da Years", rungs, spindrift),
  },
  {
    id: "vintage",
    name: "Aal Ower Vintage",
    brand: "Jamieson's of Shetland",
    yarn: "2ply Jumper Weight (Spindrift)",
    wool: "jamieson-s-of-shetland-spindrift",
    url: "https://www.jamiesonsofshetland.co.uk",
    ballMetres: 105,
    ballGrams: 25,
    shades: choose("Aal Ower Vintage", rungs, spindrift, vintageFixed),
  },
  {
    id: "simmer",
    name: "Simmer",
    brand: "Jamieson & Smith",
    yarn: "2ply Jumper Weight",
    wool: "jamieson-smith-2ply-jumper-weight",
    url: "https://www.shetlandwoolbrokers.co.uk",
    ballMetres: 115,
    ballGrams: 25,
    // Brighter than the consensus, but for the darkest and the lightest, which stay a black and a white.
    shades: choose(
      "Simmer",
      rungs.map((rung, index) => (index === 0 || index === rungs.length - 1 ? rung : { ...rung, a: rung.a * 1.8, b: rung.b * 1.8 })),
      jamiesonSmith,
    ),
  },
  {
    id: "heddery",
    name: "Heddery Hill",
    brand: "Uradale",
    yarn: "2ply Jumper Weight, organic",
    wool: "uradale-yarns-2ply-jumper-weight",
    url: "https://www.uradale.com",
    ballMetres: 86,
    ballGrams: 25,
    shades: choose("Heddery Hill", rungs.map((rung) => ({ ...rung, a: rung.a * 0.5, b: rung.b * 0.5 })), uradale),
  },
];

const out = {
  rungs: rungNames.map((name, index) => ({ slot: name, consensus: toHex(rungs[index]) })),
  pairs,
  maps: Object.fromEntries(hats.map((hat, k) => [hat.year, maps[k]])),
  colourways: colourways.map(({ shades, ...colourway }) => ({
    ...colourway,
    shades: shades.map((shade, index) => ({ slot: rungNames[index], name: shade.name, ...(shade.code ? { code: shade.code } : {}), hex: shade.hex, wool: shade.wool })),
  })),
};
fs.writeFileSync(path.join(dir, "ladder.json"), JSON.stringify(out, null, 1) + "\n");
for (const colourway of out.colourways) console.log(colourway.name.padEnd(18), colourway.shades.map((shade) => `${shade.slot} ${shade.name}`).join(" | "));
for (const [year, map] of Object.entries(out.maps)) console.log(year, JSON.stringify(map));
