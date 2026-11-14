/**
 * The tunic's two small motifs, drawn stitch by stitch: the creature that
 * runs round its hem band, and the feline of its sleeve ends.
 *
 * Codes: "o" the body's ground, "." red, "c" cream, "G" gold. Rows top first
 * as worn, each left to right as seen from the outside.
 */

/**
 * The hem band's creature, 40 stitches by 35 rows: a creature seen from
 * above, running left - a cat's face for a head, its ears out ahead of it,
 * legs splayed to feet with cream toes, a tail curled into a spiral - gold
 * on the red band, over a gold stripe. Drawn from the band's seven clear
 * repeats in a photograph of the tunic, lined up and averaged: it repeats
 * every 111.6 of the photograph's pixels there, which is what sets the
 * scale of the felines (see knit.ts). Its upper half is drawn, its lower half
 * the upper mirrored, then the tail added.
 */
const UPPER = [
  // 0123456789012345678901234567890123456789
  "........................................", // 1
  "........................................",
  "........................................",
  "........................................",
  ".......cGGGGGGGGGG.....c.c.c............", // 5  front foot, toes ahead; the hind foot's toes
  "........GGGGGGGGGG.....GGGGG............",
  ".......cGGGGGGGGGG.....GGGGG............",
  "........GGGGGGGGGG....GGGGG.............",
  ".......cGGGGGGGGGG....GGGG..............",
  "...............GGG...GGGG...............", // 10 front leg; hind leg, slanting back
  "..GGGGGGGG.....GGG...GGG................", //    an ear
  "..GGGGGGGGGGGGGGGGGGGGGGG...............",
  "...GGGGcGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG..", //    an eye; the body
  "....GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG..",
  ".....GGGG.GGGGGGGGGGGGGGGGGGGGGGGGGGGG..", // 15 the mouth
];
/** The tail, out of the body's end and curled in: rows 19 to 26, stitches 29 to 37. */
const TAIL: Record<number, string> = {
  19: "........G",
  20: "GGGGGGG.G",
  21: "G.....G.G",
  22: "G.GGG.G.G",
  23: "G.G...G.G",
  24: "G.GGGGG.G",
  25: "G.......G",
  26: "GGGGGGGGG",
};
const UNDER = [
  "........................................", // 27
  "........................................",
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG", //    the gold stripe under the band
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
  "........................................",
  "........................................",
  "........................................", // 35
];

export const hemCreature: string[] = (() => {
  // Rows numbered from 1: the upper half 1 to 15, the lower 16 to 26 its mirror about the body's middle (between 15 and 16), then what is under it.
  const rows = [...UPPER];
  for (let r = 16; r <= 26; r++) rows.push(UPPER[31 - r - 1] ?? ".".repeat(40));
  for (const [r, s] of Object.entries(TAIL)) {
    const row = rows[Number(r) - 1];
    rows[Number(r) - 1] = row.slice(0, 29) + s + row.slice(29 + s.length);
  }
  return [...rows, ...UNDER];
})();

/**
 * The sleeve ends' feline, 30 stitches by 32 rows: the large feline in
 * miniature, gold on red as on the tunic's sleeve bands, each part placed
 * where the large one's model puts it at this size - arms raised with cream
 * claws, ears with their cream whites, a face with eyes, a nose and a mouth,
 * knees, feet with cream claws, and the tail running from the body's foot up
 * into a squared spiral.
 */
export const cuffFeline: string[] = [
  // 012345678901234567890123456789
  "........GG........GG..........", // ear tips
  ".......GGGG......GGGG.........",
  "......GGcGGG....GGGcGG........", // ear whites
  ".cGc..GGGGGGGGGGGGGGGG...cGc..", // claws; the head's top
  ".GGG..GGG..........GGG...GGG..", // the face
  ".GGG..GGG..c.GG.c..GGG...GGG..", // eyes, nose
  ".GGG..GGG..........GGG...GGG..",
  ".GGG..GGGG.cccccc.GGGG...GGG..", // mouth
  ".GGG..GGGGG......GGGGG...GGG..",
  ".GGG..GGGGGGGGGGGGGGGG...GGG..",
  ".GGG..GGGGGGGGGGGGGGGG...GGG..",
  ".GGGGGGGGGGGGGGGGGGGGGGGGGGG..", // shoulders
  ".GGGGGGGGGGGGGGGGGGGGGGGGGGG..",
  ".......GGGGGGGGGGGGGG.........",
  "...GGGGGGGGGGGGGGGGGGGGGG.....", // knees
  "...GGGGGGGGGGGGGGGGGGGGGG.....",
  "...GGGGG.GGGGGGGGGGGG.GGGG....",
  ".cGGGGGG.GGGGGGGGGGGG.GGGGGGc.", // feet, claws ahead
  "..GGGGGG.GGGGGGGGGGGG.GGGGGG..",
  ".cGGGGGG.GGGGGGGGGGGG.GGGGGGc.",
  "..GGGGGG..GGGGGGGGGGG.GGGGGG..",
  "..........GGGGGGGGGGG.........",
  "GGGGGGGG...GGGGGGGGGGG........", // the spiral's top runs into the tail
  "G......GG..GGGGGGGGGGG........",
  "G.GGGGG.GG.GGGGGGGGGGG........",
  "G.G...G.GG..GGGGGGGGGG........",
  "G.G.G.G..G..GGGGGGGGGG........",
  "G.G.G.G..GG..GGGGGGGGG........",
  "G.G.G.G...G..GGGGGGGG.........",
  "G.GGG.G...GG..GGGGGGG.........",
  "G.....G....G..GGGGGG..........",
  "GGGGGGG....GGGGGGGGG..........", // tail and body meet at the foot
];

/**
 * A squared spiral `w` stitches by `h` rows, gold on red: the hem creature's
 * tail, alone, at any size. Drawn from its stem, down the right-hand side,
 * then round and in - along the foot, up the left, along the top - each
 * stretch two shorter than the one before it, a row or a stitch of red
 * between each turn and the next.
 */
export const squareSpiral = (w: number, h: number): string[] => {
  const grid = Array.from({ length: h }, () => Array<string>(w).fill("."));
  let [r, c] = [0, w - 1];
  grid[r][c] = "G";
  // Down the full height, along the full width, up the full height; then each stretch two shorter than the last one the same way, until none is left.
  const lengths = [h - 1, w - 1, h - 1];
  while (lengths[lengths.length - 2] - 2 > 0) lengths.push(lengths[lengths.length - 2] - 2);
  const ways = [[1, 0], [0, -1], [-1, 0], [0, 1]];
  lengths.forEach((length, k) => {
    const [dr, dc] = ways[k % 4];
    for (let i = 0; i < length; i++) grid[(r += dr)][(c += dc)] = "G";
  });
  return grid.map((row) => row.join(""));
};

/** A drawing turned a quarter clockwise: its left-hand column becomes its top row. */
export const quarterTurned = (grid: string[]): string[] => grid[0].split("").map((_, x) => grid.map((row) => row[x]).reverse().join(""));

/** One row of a neck band: its ground - "G" gold or "." red - and, if it is one, which row of spirals it is in and which of a spiral's rows. */
export interface BandRow {
  ground: string;
  spirals?: { tier: number; row: number };
}

/** A neck band: its rows, top first, and the spiral of each of its rows of them, `gap` stitches of red between each and the next. */
export interface NeckBand {
  rows: BandRow[];
  spirals: string[][];
  gap: number;
}

const ground = (g: string, k: number): BandRow[] => Array.from({ length: k }, () => ({ ground: g }));
const tier = (tier: number, h: number): BandRow[] => Array.from({ length: h }, (_, row) => ({ ground: ".", spirals: { tier, row } }));
// As the hem band's, turned over: three rounds of red and four of gold nearest the neck.
const stripes = [...ground(".", 3), ...ground("G", 4)];

/**
 * The neck bands, each as deep as the hem's band, 35 rows: the hem band's
 * three rounds of red and four of gold nearest the neck, then two rows of
 * squared spirals turned a quarter clockwise, the same 2-stitch gap
 * everywhere - under the stripe, between spirals, between the rows and
 * after them. A raglan's yoke seen from above is a square frame - four
 * straight panels, the lines running out from its corners - and its spirals
 * are 11 by 11 in both rows, all the way round it, its corners included:
 * see knit.ts. A round yoke is a circle, growing all the way round, and its
 * spirals go round in rays: as many in each row, 9 by 9 near the neck and
 * 13 by 13 below, so that they line up out from it.
 */
const spiral = (w: number) => quarterTurned(squareSpiral(w, w));
export const neckBands: Record<"raglan" | "yoke", NeckBand> = {
  raglan: { spirals: [spiral(11), spiral(11)], gap: 2, rows: [...stripes, ...ground(".", 2), ...tier(0, 11), ...ground(".", 2), ...tier(1, 11), ...ground(".", 2)] },
  yoke: { spirals: [spiral(9), spiral(13)], gap: 2, rows: [...stripes, ...ground(".", 2), ...tier(0, 9), ...ground(".", 2), ...tier(1, 13), ...ground(".", 2)] },
};

/** The cuff band: two rounds of gold and two of red each side of the felines. */
export const cuffEdges = { gold: 2, red: 2 };
