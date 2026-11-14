import type { Chart, Colourway, Size, SweaterPattern } from "../types";
import { measured } from "../wool-week/strips/design";
import { type Construction, type Knitted, gauge, knit } from "./knit";

/**
 * A feline jumper: the two large red felines of a Nasca tunic at the
 * Metropolitan Museum of Art, one on the front and one on the back, each as
 * large as its piece has room for; the tunic's hem band of small gold
 * creatures round the waist where there is room; and the sleeve ends' small
 * gold felines round each cuff. Each design is a call to this with a
 * construction; see knit.ts for the knitting, raster.ts for how the felines
 * are drawn at a size, and motifs.ts for the small motifs.
 */

/*
 * The sizes: the strip samplers' (Hamefarin's finished measurements, the yoke
 * a centimetre and a half deeper and the body three and a half longer), which
 * leaves the felines room to be large.
 */

const spindrift = (slot: string, name: string, code: string, hex: string): Colourway["shades"][number] => ({
  slot,
  name,
  code,
  hex,
  source: "library",
  wool: `jamieson-s-of-shetland-spindrift-${code}`,
});

const colourway = (id: string, name: string, shades: Colourway["shades"]): Colourway => ({
  id,
  wool: "jamieson-s-of-shetland-spindrift",
  name,
  brand: "Jamieson's of Shetland",
  yarn: "Spindrift",
  url: "https://www.jamiesonsofshetland.co.uk",
  ballMetres: 105,
  ballGrams: 25,
  shades,
});

/**
 * The tunic's own four - an ochre ground, a madder red, the cream of claws
 * and teeth, the gold of the bands - each the nearest Spindrift shade to the
 * photograph's; and two more.
 */
const colourways: Colourway[] = [
  colourway("tunic", "Tunic", [
    spindrift("A", "Yellow Ochre", "230", "#c28c36"),
    spindrift("B", "Poppy", "524", "#c42c31"),
    spindrift("C", "Natural White", "104", "#eae5c6"),
    spindrift("D", "Scotch Broom", "1160", "#e2ab3f"),
  ]),
  colourway("undyed", "Undyed ground", [
    spindrift("A", "Oatmeal", "337", "#bfa076"),
    spindrift("B", "Crimson", "525", "#af1b2b"),
    spindrift("C", "White", "304", "#f1f1e7"),
    spindrift("D", "Flax", "375", "#d9b665"),
  ]),
  colourway("night", "Night", [
    spindrift("A", "Prussian", "726", "#373e59"),
    spindrift("B", "Poppy", "524", "#c42c31"),
    spindrift("C", "Natural White", "104", "#eae5c6"),
    spindrift("D", "Scotch Broom", "1160", "#e2ab3f"),
  ]),
];

export interface FelineSweater {
  id: string;
  name: string;
  story: string;
  construction: Construction;
}

export const felineSweater = ({ id, name, story, construction }: FelineSweater): SweaterPattern => {
  // Each size is knitted the first time anything asks for it, and kept.
  const knitted = new Map<string, Knitted>();
  const knittedOf = (size: (typeof measured)[number]): Knitted => {
    let found = knitted.get(size.id);
    if (!found) knitted.set(size.id, (found = knit(size.finished, construction, `${id}-${size.id}-`)));
    return found;
  };
  const sizes: (Size & { knitted: () => Knitted })[] = measured.map((size) => ({
    ...size,
    stitchesPer10cm: gauge.stitches * 10,
    roundsPer10cm: gauge.rounds * 10,
    needlesMm: 3,
    ribNeedlesMm: 2.5,
    get sections() {
      return knittedOf(size).sections;
    },
    get checks() {
      return knittedOf(size).checks;
    },
    knitted: () => knittedOf(size),
  }));
  return {
    id,
    name,
    designer: "Sweat Shop, after a Nasca tunic",
    story,
    credit: "After a tunic with felines, Nasca, 1st to 3rd century, in the Metropolitan Museum of Art, traced from a photograph",
    pieces: [
      { id: "yoke", label: "Yoke" },
      { id: "body", label: "Body" },
      { id: "sleeve-left", label: "Left sleeve" },
      { id: "sleeve-right", label: "Right sleeve" },
    ],
    slots: ["A", "B", "C", "D"],
    slotRoles: {
      A: "the ground: the body, yoke and sleeves",
      B: "the felines' red, the bands' ground and the ribbing",
      C: "claws, ears, eyes and teeth, and the bands' toes",
      D: "the bands' creatures and stripes",
    },
    // A picture, not a band: the felines' reds run across a front a hundred stitches and more, floats to be caught behind the work; and a claw or an eye puts a third colour in a round.
    rules: { colours: 3, float: Infinity },
    tensions: { rib: { stitch: 0.9 } },
    stitchNotes: {
      m1: {
        abbreviation: "M1L",
        lean: "left",
        how: "Pick up the bar between the stitches from front to back with the left needle, and knit it through the back of the loop, in the colour the chart shows.",
      },
      pickUp: { how: "Insert the needle under both legs of the next stitch cast on at the underarm, wrap the yarn and draw a loop through." },
    },
    // Every chart of every size knitted so far. A size is knitted before its charts are looked for, as its sections are read first.
    get charts(): Chart[] {
      return [...knitted.values()].flatMap((k) => k.charts);
    },
    colourways,
    sizes,
  };
};
