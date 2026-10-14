import { SettledFile, decodeSettled } from "./format";

/**
 * Where each sweater comes to rest, size by size: worked out once by
 * scripts/settle.mjs and committed, one file a size, <sweater>--<size>.json.
 *
 * A sweater's shape depends only on its knitting, so every knitter's copy of
 * a size settles to the same shape, and none of them need wait for it. Each
 * file is its own chunk, fetched only when that size is on screen.
 */
const files = import.meta.glob<{ default: SettledFile }>("./*.json");

/** Whether a size has been settled, without fetching it. */
export const hasSettled = (sweaterId: string, sizeId: string): boolean =>
  `./${sweaterId}--${sizeId}.json` in files;

export const loadSettled = async (sweaterId: string, sizeId: string): Promise<Float32Array | undefined> => {
  const load = files[`./${sweaterId}--${sizeId}.json`];
  if (!load) return undefined;
  try {
    return decodeSettled((await load()).default);
  } catch {
    return undefined;
  }
};
