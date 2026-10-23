import type { Chart, Size, SweaterPattern } from "../../types";
import { yearOf, years } from "../years";
import { colourways } from "./colours";
import { knit, type Knitted } from "./knit";
import { type Layout, type Measured, gauge, planOf } from "./plan";
import { allSlots, letterOf, trimSlot, yearOfSlot } from "./slots";

/**
 * A strip sampler: every Shetland Wool Week hat from 2014 to 2026, each in a
 * strip of about the same length, laid out one way. Each layout is one design
 * file beside the others, a call to this and nothing more; see
 * wool-week-strips-*.ts.
 *
 * The parts, each a file in this folder: the hats cut into building blocks
 * (cuts.ts), where each year goes and how many rounds it has (plan.ts), the
 * knitting that makes of it (knit.ts), and the colourways (colours.ts, from
 * colourways.json).
 */

/*
 * The sizes: Hamefarin's finished measurements, the yoke a centimetre and a
 * half deeper and the body three and a half longer - which leaves room for
 * thirteen strips, and makes a sleeve about one strip longer than the body.
 */
export const measured: { id: string; label: string; toFitChestCm: number; finished: Measured }[] = [
  { id: "xs", label: "XS", toFitChestCm: 76, finished: { chestCm: 86, neckCm: 44, yokeDepthCm: 20.5, bodyLengthCm: 38.5, upperArmCm: 29, sleeveLengthCm: 43, cuffCm: 19 } },
  { id: "s", label: "S", toFitChestCm: 86, finished: { chestCm: 96, neckCm: 45, yokeDepthCm: 21.5, bodyLengthCm: 39.5, upperArmCm: 31, sleeveLengthCm: 44, cuffCm: 19.5 } },
  { id: "m", label: "M", toFitChestCm: 96, finished: { chestCm: 106, neckCm: 46, yokeDepthCm: 22.5, bodyLengthCm: 40.5, upperArmCm: 33, sleeveLengthCm: 45, cuffCm: 20 } },
  { id: "l", label: "L", toFitChestCm: 106, finished: { chestCm: 116, neckCm: 47, yokeDepthCm: 23.5, bodyLengthCm: 41.5, upperArmCm: 35.5, sleeveLengthCm: 46, cuffCm: 21 } },
  { id: "xl", label: "XL", toFitChestCm: 116, finished: { chestCm: 126, neckCm: 48, yokeDepthCm: 24.5, bodyLengthCm: 42.5, upperArmCm: 38, sleeveLengthCm: 47, cuffCm: 22 } },
  { id: "2xl", label: "2XL", toFitChestCm: 126, finished: { chestCm: 136, neckCm: 49, yokeDepthCm: 25.5, bodyLengthCm: 43.5, upperArmCm: 41, sleeveLengthCm: 47, cuffCm: 23 } },
  { id: "3xl", label: "3XL", toFitChestCm: 136, finished: { chestCm: 146, neckCm: 50, yokeDepthCm: 26.5, bodyLengthCm: 44.5, upperArmCm: 44, sleeveLengthCm: 48, cuffCm: 24 } },
  { id: "4xl", label: "4XL", toFitChestCm: 146, finished: { chestCm: 156, neckCm: 51, yokeDepthCm: 27.5, bodyLengthCm: 45.5, upperArmCm: 47, sleeveLengthCm: 48, cuffCm: 25 } },
];

export interface StripSampler {
  id: string;
  name: string;
  story: string;
  layout: Layout;
}

export const stripSampler = ({ id, name, story, layout }: StripSampler): SweaterPattern => {
  // Each size is planned and knitted the first time anything asks for it, and kept.
  const knitted = new Map<string, Knitted>();
  const knittedOf = (size: (typeof measured)[number]): Knitted => {
    let found = knitted.get(size.id);
    if (!found) knitted.set(size.id, (found = knit(size.finished, planOf(size.finished, layout, size.id), `${id}-`)));
    return found;
  };
  const sizes: Size[] = measured.map((size) => ({
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
  }));
  const designers = [...new Set(years.map((y) => y.designer))];
  return {
    id,
    name,
    designer: "Sweat Shop, after the Shetland Wool Week hats",
    story,
    credit: `Charts from the Shetland Wool Week hats, 2014 to 2026, by ${designers.join("; ")}`,
    pieces: [
      { id: "yoke", label: "Yoke" },
      { id: "body", label: "Body" },
      { id: "sleeve-left", label: "Left sleeve" },
      { id: "sleeve-right", label: "Right sleeve" },
    ],
    slots: [...allSlots, trimSlot],
    slotRoles: {
      ...Object.fromEntries(allSlots.map((slot) => [slot, `${yearOfSlot(slot)} ${yearOf(yearOfSlot(slot)).name}, yarn ${letterOf(slot)}`])),
      [trimSlot]: "The neck, waist and wrist ribbing",
    },
    trim: { slot: trimSlot, label: "Trim", note: "The neck, waist and wrist ribbing, in any yarn of the palette." },
    slotsVaryBySize: true,
    // Other people's charts, knitted as they drew them: floats as long as they come, caught behind the work, and one round of the Shwook Hat in three colours.
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
    // Every chart of every size knitted so far, once each. A size is knitted before its charts are looked for, as its sections are read first.
    get charts(): Chart[] {
      return [...new Map([...knitted.values()].flatMap((k) => k.charts).map((c) => [c.id, c])).values()];
    },
    colourways,
    sizes,
  };
};
