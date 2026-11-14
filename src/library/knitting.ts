import type { Design } from "../pattern/design";
import type { SweaterStitches } from "../pattern/knitted";
import { askAgain, editionKnitting, isSuperseded, loadEdition } from "./editions";

/**
 * A size's knitting, as the site has it: fetched as a frozen edition (see
 * editions), and had no other way.
 */

/**
 * For the tests alone, which knit the designs as they are in hand: see
 * test-setup. Nothing a browser loads can work a pattern out.
 */
type InHand = (design: Design, sizeId?: string) => SweaterStitches;
let inHand: InHand | undefined;
export const knitInHand = (knit: InHand) => {
  inHand = knit;
};

/** A size's knitting could not be fetched. Thrown by useKnitting, for KnittingBoundary to say so. */
export class NoKnitting extends Error {}

/** Forget what could not be had, so that it is asked for again. */
export const retryKnitting = askAgain;

/** A size's knitting, if it is to hand: its frozen copy, fetched - the size's edition now, or the one a project is on. */
export const knittingToHand = (pattern: Design, sizeId?: string, edition?: string): SweaterStitches | undefined =>
  (sizeId ? editionKnitting(pattern.id, sizeId, edition) : undefined) ??
  // In hand is the size as it is now, never an edition it has moved on from.
  (inHand && !(sizeId && isSuperseded(pattern.id, sizeId, edition)) ? inHand(pattern, sizeId) : undefined);

/** A size's knitting, which a caller has waited for: see whenKnitting and useKnitting. */
export const sweaterStitches = (pattern: Design, sizeId?: string, edition?: string): SweaterStitches => {
  const knitting = knittingToHand(pattern, sizeId, edition);
  if (!knitting) throw new Error(`${pattern.id} ${sizeId ?? ""}: its knitting has not been fetched`);
  return knitting;
};

/** The fetching of a size's knitting: rejects where it cannot be had. */
export const whenKnitting = async (pattern: Design, sizeId: string, edition?: string): Promise<SweaterStitches> =>
  knittingToHand(pattern, sizeId, edition) ?? loadEdition(pattern.id, sizeId, edition);
