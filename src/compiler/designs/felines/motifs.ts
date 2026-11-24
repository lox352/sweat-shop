/**
 * The tunic's small motifs, drawn stitch by stitch: the creature that runs
 * round its bands, at the hem and at the sleeves' ends, and the small feline
 * of its sleeves.
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

/** One row of the hem's band or a cuff's: its ground - "G" gold or "." red - and, if one is in it, which of the creature's rows. */
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
 * The sleeves' feline, 36 stitches by 44 rows: the small red feline
 * embroidered on the tunic's sleeve beside its band - the large felines in
 * little: two ears with their whites, a face of the ground's colour with
 * eyes, a nose and a mouth of teeth, a lobe with a cream stripe hanging
 * either side of its head where the large ones have whiskers, arms out to
 * raised hands of three claws, legs out to feet of two stripes each, and
 * the tail from the body's foot into a six-sided spiral.
 *
 * Drawn stitch by stitch from a trace measured off a close photograph of
 * the sleeve (sleeve-feline.svg, in that photograph's pixels), a stitch to
 * 30.4 of them and a row to 25.8, which are as a knitted stitch and row
 * are to each other. On the tunic the sleeve lies level and the feline
 * stands on it, its head to the fold along the top of the arm: so on a
 * sleeve knitted from the shoulder down it lies across, and this is how it
 * lies on the front of the right sleeve - its head to the left, at the top
 * of the arm, its feet to the underarm, its tail's spiral to the cuff. Its
 * hands are a row or two wider than on the cloth, so that each has its
 * three claws with a row of red between them.
 */
export const sleeveFeline: string[] = [
  // 012345678901234567890123456789012345
  "ooooooooooooooooooooo..ooooooooooooo", // 1  a foot's outer end
  "oooooooooooooooooooo.c..oooooooooooo",
  "ooooooooooooooooooo...c..ooooooooooo",
  "ooooooooooooooooooo.c..c.ooooooooooo",
  "ooooooooooooooooooo..c.c.ooooooooooo", // 5
  "oooooooooooooooooooo.c.c.ooooooooooo",
  "oooooooooooooooooooo.c.c.ooooooooooo",
  "oooooooooo......oooo.c.c.ooooooooooo", // 8  the right hand's side
  "oooooooo.oc.....oooo.c...ooooooooooo", // 9  its three claws, a row of red between them
  "ooooooo..o......oo.....ooooooooooooo", // 10
  "oooooo.c.oc.....o.....oooooooooooooo",
  "ooooo.c.oo......o...oooooooooooooooo",
  "oooo...oooc.....o..ooooooooooooooooo",
  "ooo....ooo......o.oooooooooooooooooo",
  "oo.......oooo.....................oo", // 15  the body, its six rows: here an ear and the face's side too
  "o..oooooo.ooo......................o",
  ".c.ocoooo...........................", // 17  an ear's white, two rows; an eye, two rows
  ".c.ococco...........................", //     and the mouth: a tooth, and its lip
  "o..ooooco...........................",
  "oo.o.occo...........................", // 20  the nose
  "oo.ooooco..........oooooooooooooo...",
  "oo.ococco.........oooooooooooooooo..", // 22  the other eye
  "o..ocoooo..oo...o.ooooooooooooooooo.",
  ".c.oooooo.ooo...o...oooooooooooooo..",
  ".c.......oc.....o....oooooooooooo...", // 25  the other ear's white; the left hand's claws
  "o......ooo......o.....oooooooooo...o",
  "oo.....oooc.....ooo..c..ooooooo...oo", // 27  a foot's stripes begin
  "ooo...c.oo......oooo..c..ooooo...ooo",
  "oooo...c.oc.....oooo...c.oooo...oooo",
  "oooooo...ooooooooooo.c.c.ooo...ooooo", // 30  the tail, down from the body's foot
  "ooooooo..ooooooooooo.c.c.oo...oo..oo",
  "oooooooooooooooooooo.c.c.oo..oo...oo",
  "oooooooooooooooooooo.c.c.oo..o..oo.o",
  "ooooooooooooooooooo.c....oo..o..ooo.",
  "ooooooooooooooooooo.c..oooo..o....o.", // 35  the tail's spiral
  "ooooooooooooooooooo...ooooo..o....o.",
  "ooooooooooooooooooooooooooo..o....o.",
  "ooooooooooooooooooooooooooo..o....o.",
  "ooooooooooooooooooooooooooo..oooooo.",
  "ooooooooooooooooooooooooooo..oooooo.", // 40
  "oooooooooooooooooooooooooooo...ooo..",
  "ooooooooooooooooooooooooooooo......o",
  "ooooooooooooooooooooooooooooooo...oo",
  "oooooooooooooooooooooooooooooooo.ooo", // 44  the spiral's tip, nearest the cuff
];

/** A drawing seen in a mirror: each row read from its other end. */
export const mirrored = (grid: string[]): string[] => grid.map((row) => [...row].reverse().join(""));

/**
 * The creature as it runs in the band at the tunic's sleeve end, which is
 * the hem's band turned half round: to the right with the cuff below, its
 * tail's curl towards the sleeve. Traced there too (cuff-creature.svg) and
 * found the hem's creature part for part - a face with eyes and a mouth,
 * two ears ahead, front feet turned forward with three claws, hind feet
 * turned out with three tipped toes, a tail curled in under the rump - so
 * the one drawing is knitted in both bands.
 */
export const cuffCreature: string[] = mirrored([...hemCreature].reverse());

/**
 * The cuff band, 37 rows, top first: two rounds of the band's red, the
 * creature, a round of red, and towards the cuff the tunic's lines as they
 * are at its sleeve end - four rounds of gold, three of red, four of gold.
 * The cuff's red rib is the fringe after them.
 */
export const cuffBand: HemRow[] = [
  ...plain(".", 2),
  ...cuffCreature.map((_row, creature) => ({ ground: ".", creature })),
  ...plain(".", 1),
  ...plain("G", 4),
  ...plain(".", 3),
  ...plain("G", 4),
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
