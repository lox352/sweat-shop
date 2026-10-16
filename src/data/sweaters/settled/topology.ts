import { isFabric } from "../../../types/Stitch";
import type { Knitting } from "../../../physics/knitting";

/**
 * The knitting as the settling sees it, to tell when a size has to be settled
 * again: each stitch of the fabric - its kind, what it is linked to, how wide
 * and how tall - and the rounds from each piece's seam, every stitch numbered
 * among the fabric's alone.
 *
 * Not the colours: a design is recoloured far more often than reshaped. And
 * not the steps. A change of needles or a marker placed moves the id of every
 * stitch after it, and nothing the physics does: a step is no part of the
 * fabric, and is put where a stitch beside it is. See settled/format.
 */
export const topologyOf = (knitting: Knitting) => {
  const fabric = knitting.stitches.filter(isFabric);
  const number = new Map(fabric.map((stitch, index) => [stitch.id, index]));
  const renumber = (id: number) => number.get(id) ?? null;
  return {
    stitches: fabric.map((stitch) => [
      stitch.type,
      stitch.links.map(renumber),
      stitch.from === undefined ? null : renumber(stitch.from),
      stitch.width ?? null,
      stitch.rise ?? null,
    ]),
    rounds: knitting.rounds.map((round) => round.map(renumber)),
    roundKinds: knitting.roundKinds,
    roundPieces: knitting.roundPieces,
    roundHeight: knitting.roundHeight,
  };
};
