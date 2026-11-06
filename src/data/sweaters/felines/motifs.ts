/**
 * The tunic's two small motifs, drawn stitch by stitch: the creature that
 * runs round its hem band - and, turned over, round the jumper's neck - and
 * the feline of its sleeve ends.
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
 * The neck's band: the hem's, turned over - its gold stripe nearest the neck
 * and the creatures below it, tails up - as deep as the hem's, 35 rows.
 */
export const neckBand: string[] = [...hemCreature].reverse();

/** The cuff band: two rounds of gold and two of red each side of the felines. */
export const cuffEdges = { gold: 2, red: 2 };
