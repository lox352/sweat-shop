import type { Knitting } from "../pattern/knitting";
import { topologyOf } from "./topology";

/** The physics as it is, hashed: every file the settling runs on (scripts/shapes.mjs's physicsNow), put here when the site is built. */
declare const __PHYSICS__: string;

/** The physics as it is: what a shape settled by it is good for, until it changes. */
export const physicsNow: string = __PHYSICS__;

/**
 * The name of a knitting's shape: twelve hex digits of the hash of the physics
 * and its fabric, exactly as scripts/shapes.mjs names the shapes it settles
 * and commits. So a sweater settled on a knitter's device has the name it
 * would have had settled there - and where that shape is published already,
 * it need not be settled at all.
 */
export const shapeNameOf = async (knitting: Knitting): Promise<string> => {
  const named = new TextEncoder().encode(physicsNow + JSON.stringify(topologyOf(knitting)));
  const hash = await crypto.subtle.digest("SHA-256", named);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 12);
};
