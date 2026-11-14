import { SettledFile, decodeSettled } from "./format";
import { currentEdition } from "../editions";
import shapes from "./shapes.json";

/**
 * Where each sweater comes to rest: worked out once by scripts/settle.mjs and
 * committed, a file a shape, public/shapes/<shape>.json.
 *
 * A sweater's shape depends only on its fabric, so every knitter's copy of a
 * size settles to the same shape, and none of them need wait for it; and a
 * design recoloured, or given a step more, has the shape it had. shapes.json
 * says which shape each edition of each size has (see scripts/shapes.mjs):
 * the size's knitting now, and each edition it has moved on from, for the
 * projects still knitting those. A file is fetched only when its size is on
 * screen, and kept by the service worker from then on.
 */
const shapeOf = (sweaterId: string, sizeId: string, edition?: string): string | undefined =>
  (shapes as Record<string, string>)[`${sweaterId}--${sizeId}--${edition ?? currentEdition(sweaterId, sizeId)}`];

/** The shape an edition of a size has, if it has been settled, without fetching it: the size's edition now, for none given. */
export const settledShape = shapeOf;

/** Where a shape's fabric came to rest, stitch by stitch in id order: see format's allPositions for every stitch. */
export const loadSettled = async (shape: string): Promise<Float32Array | undefined> => {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}shapes/${shape}.json`);
    return response.ok ? decodeSettled((await response.json()) as SettledFile) : undefined;
  } catch {
    return undefined;
  }
};
