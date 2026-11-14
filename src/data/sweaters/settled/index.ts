import { SettledFile, decodeSettled } from "./format";
import { editionUrl, isSuperseded } from "../editions";

/**
 * Where each sweater comes to rest, size by size: worked out once by
 * scripts/settle.mjs and committed, one file a size, <sweater>--<size>.json.
 *
 * A sweater's shape depends only on its knitting, so every knitter's copy of
 * a size settles to the same shape, and none of them need wait for it. Each
 * file is its own chunk, fetched only when that size is on screen.
 *
 * Those are each size's knitting as it is now. The settled sweater of an
 * edition a size has moved on from is kept beside that edition's frozen copy
 * (see keep.ts), for the projects still knitting it.
 */
const files = import.meta.glob<{ default: SettledFile }>("./*.json");

/** Whether a size has been settled, without fetching it - or, for an edition it has moved on from, may have been kept. */
export const hasSettled = (sweaterId: string, sizeId: string, edition?: string): boolean =>
  isSuperseded(sweaterId, sizeId, edition) || `./${sweaterId}--${sizeId}.json` in files;

/** Where a size's fabric came to rest, stitch by stitch in id order: see format's allPositions for every stitch. */
export const loadSettled = async (sweaterId: string, sizeId: string, edition?: string): Promise<Float32Array | undefined> => {
  if (isSuperseded(sweaterId, sizeId, edition)) {
    try {
      const response = await fetch(editionUrl(sweaterId, sizeId, edition).replace(/\.json$/, ".settled.json"));
      return response.ok ? decodeSettled((await response.json()) as SettledFile) : undefined;
    } catch {
      return undefined;
    }
  }
  const load = files[`./${sweaterId}--${sizeId}.json`];
  if (!load) return undefined;
  try {
    return decodeSettled((await load()).default);
  } catch {
    return undefined;
  }
};
