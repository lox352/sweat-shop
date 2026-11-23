/**
 * The tunic's two small motifs, drawn stitch by stitch: the creature that
 * runs round its hem band, and the feline of its sleeve ends.
 *
 * Codes: "o" the body's ground, "." red, "c" cream, "G" gold. Rows top first
 * as worn, each left to right as seen from the outside.
 */

/**
 * The hem band's creature, 36 stitches by 23 rows: a creature seen from
 * above, running left - a cat's face for a head, its two ears out ahead of
 * it, its front feet turned forward with three cream claws each, its hind
 * feet turned out with three cream-tipped toes, and its tail turned down
 * under its rump and curled in - gold on the band's red. Drawn stitch by
 * stitch from a trace measured off a close photograph of the band
 * (hem-creature.svg, in that photograph's pixels), a stitch to 39.5 of them
 * across and a row to 35 down; its two halves are no mirror of each other,
 * and nor are they here. Its lower front foot is a row deeper than on the
 * cloth, so that each of its claws has a row of red after it, and its
 * tail's curl a row deeper, so that the red shows between its turns.
 *
 * On the tunic its face and the insides of its ears are a grey-brown, its
 * eyes have red pupils and its claws sit on a grey band. Here it is gold
 * all through, its eyes and mouth cream, so that no round of the band
 * wants a fourth yarn.
 */
export const hemCreature: string[] = [
  // 012345678901234567890123456789012345
  ".......cGGGGGGGGGGG....c.c.c........", // 1  a front foot, its claws ahead; a hind foot's toes, tipped
  "........GGGGGGGGGGG....G.G.G........",
  ".......cGGGGGGGGGGG....G.G.G........",
  "........GGGGGGGGGGG....GGGGG........",
  ".......cGGGGGGGGGGG...GGGGGG........", // 5
  "................GGG..GGGGGG.........", //    the front leg; the hind leg, slanting back
  "GGGGGGGGG......GGGG..GGGGG..........", //    an ear's tip
  ".GGGGGGGGGG..GGGGGG..GGG............",
  "..GGGGGGGGGGGGGGGGG..GGGG...........",
  "...GGGGcGGGGGGGGGGGGGGGGGGG.........", // 10 an eye
  "....GGGGGcGGGGGGGGGGGGGGGGGGGGGGGGG.", //    the mouth; the body, on to the tail
  "....GGGGGcGGGGGGGGGGGGGGGGGGGGGGGGGG",
  "..GGGGGGGcGGGGGGGGGGGGGGGGGGGGGGGGGG",
  ".GGGGGGcGGGGGGGGGGGGGGGGGGGGGGGGGGGG", //    the other eye
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG", // 15 the other ear's tip
  "GGGGGGGGGG..GGGGGG...GGGG.......GGG.", //    the tail turns down under the rump
  "..............GGGG...GGG......GGG...",
  "...............GGG...GGGG....G......",
  ".......cGGGGGGGGGG...GGGGGG..G.GGGGG", //    and curls in
  "........GGGGGGGGGG....GGGGG..G.G...G", // 20
  ".......cGGGGGGGGGG....G.G.G..G.GG..G",
  "........GGGGGGGGGG....G.G.G..GG....G",
  ".......cGGGGGGGGGG....c.c.c...GGGGG.", // 23
];

/** One row of the hem band: its ground - "G" gold or "." red - and, if one is in it, which of the creature's rows. */
export interface HemRow {
  ground: string;
  creature?: number;
}

const plain = (g: string, k: number): HemRow[] => Array.from({ length: k }, () => ({ ground: g }));

/**
 * The hem band, 35 rows, top first: the creatures on the band's red, two
 * rounds of it above them and one below, and under the band the tunic's two
 * gold lines - four rounds of gold, two of red, two of gold - then a round
 * of red before the rib. On the tunic the lines are fringes, the first near
 * twice as deep as the second.
 */
export const hemBand: HemRow[] = [
  ...plain(".", 2),
  ...hemCreature.map((_row, creature) => ({ ground: ".", creature })),
  ...plain(".", 1),
  ...plain("G", 4),
  ...plain(".", 2),
  ...plain("G", 2),
  ...plain(".", 1),
];

/** Stitches of red between one creature and the next, at least: on the tunic they run nose to tail, about two stitches apart. */
export const hemGap = 2;

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
// Three rounds of red and four of gold nearest the neck: the hem band's first gold line, turned over.
const stripes = [...ground(".", 3), ...ground("G", 4)];

/**
 * The neck bands, each as deep as the hem's band, 35 rows: three rounds of
 * red and four of gold nearest the neck, then two rows of
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
