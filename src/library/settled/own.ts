import { type SettledFile, decodeSettled, encodeSettled, settledVersion } from "./format";

/**
 * Shapes kept on the device: where a knitter's own sweater came to rest,
 * settled there (see physics/settling) because no published shape is its.
 *
 * A shape is derived: it follows from the knitting and the physics, and can
 * be worked out again. So unlike the knitting itself (editions/own) it is no
 * part of a backup, and it is kept where the device may clear it. It is filed
 * by the edition it is the shape of, with the physics that settled it, so a
 * shape settled by an older release is not taken for this one's.
 */
const shelf = "sweat-shop-shapes";
const addressOf = (edition: string) => `${import.meta.env.BASE_URL}own-shapes/${edition}.json`;

interface Kept {
  /** The physics that settled it, and the shape's name: see physics/naming. */
  physics: string;
  shape: string;
  file: SettledFile;
}

const open = async (): Promise<Cache | undefined> => {
  try {
    return typeof caches === "undefined" ? undefined : await caches.open(shelf);
  } catch {
    return undefined;
  }
};

/** The shape kept for an edition (its key: design, size and edition), if one settled by this physics is; none where it cannot be read. */
export const ownShape = async (edition: string, physics: string): Promise<{ shape: string; positions: Float32Array } | undefined> => {
  try {
    const found = await (await open())?.match(addressOf(edition));
    if (!found) return undefined;
    const kept = (await found.json()) as Kept;
    return kept.physics === physics && kept.file.version === settledVersion ? { shape: kept.shape, positions: decodeSettled(kept.file) } : undefined;
  } catch {
    return undefined;
  }
};

/** Keep where an edition's fabric came to rest (see format's fabricPositions). Nothing is said if the device will not: it is settled again. */
export const keepShape = async (edition: string, physics: string, shape: string, fabric: ArrayLike<number>): Promise<void> => {
  try {
    const kept: Kept = { physics, shape, file: encodeSettled(fabric) };
    await (await open())?.put(addressOf(edition), new Response(JSON.stringify(kept), { headers: { "Content-Type": "application/json" } }));
  } catch {
    // A shape not kept is only a shape to settle again.
  }
};

/** Drop every shape kept for an edition that is not one of these. */
export const dropShapesBut = async (editions: string[]): Promise<void> => {
  try {
    const cache = await open();
    const wanted = new Set(editions.map((edition) => new URL(addressOf(edition), location.href).href));
    for (const request of (await cache?.keys()) ?? []) if (!wanted.has(request.url)) await cache?.delete(request);
  } catch {
    // Nothing to drop where nothing can be kept.
  }
};
