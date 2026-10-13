import { Stitch, isFabric } from "../types/Stitch";

/**
 * The rules a Fair Isle design keeps, as things a test can check.
 *
 * Two colours in a round, at most: the knitter holds one in each hand, and a
 * third has nowhere to go. And no colour carried further behind the work
 * than about seven stitches, or the float snags on fingers and puckers the
 * fabric: past that a knitter has to catch it, and a design that never asks
 * them to is a kinder one.
 */

/** The yarns a round is knitted in. */
export const yarnsIn = (stitches: Stitch[], round: number[]): Set<string> =>
  new Set(round.map((id) => stitches[id]).filter(isFabric).map((stitch) => stitch.slot));

/**
 * The longest stretch a yarn is carried behind the work in a round: the
 * longest run of the other yarn, counted round the round's end, since a
 * round has no end. A round in one yarn floats nothing.
 */
export const longestFloat = (stitches: Stitch[], round: number[]): number => {
  const slots = round.map((id) => stitches[id].slot);
  if (new Set(slots).size < 2) return 0;
  const start = slots.findIndex((slot, index) => slot !== slots[(index + slots.length - 1) % slots.length]);
  let longest = 0;
  let run = 0;
  for (let step = 0; step < slots.length; step++) {
    const index = (start + step) % slots.length;
    run = step > 0 && slots[index] === slots[(index + slots.length - 1) % slots.length] ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  return longest;
};

export interface Breach {
  round: number;
  rule: "colours" | "float";
  found: number;
}

/** Every round that breaks a rule, 1-based. */
export const breaches = (
  stitches: Stitch[],
  rounds: number[][],
  { colours = 2, float = 7 } = {},
): Breach[] => {
  const out: Breach[] = [];
  rounds.forEach((round, index) => {
    const yarns = yarnsIn(stitches, round).size;
    if (yarns > colours) out.push({ round: index + 1, rule: "colours", found: yarns });
    const longest = longestFloat(stitches, round);
    if (longest > float) out.push({ round: index + 1, rule: "float", found: longest });
  });
  return out;
};
