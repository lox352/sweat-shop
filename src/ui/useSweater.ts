import { useMemo } from "react";
import type { Design } from "../pattern/design";
import { editionFailed, loadEdition } from "../library/editions";
import { NoKnitting, knittingToHand } from "../library/knitting";
import { countedAt, yokeRounds } from "../reading/counted";
import { holdRegions } from "../reading/holds";
import { chartViews, viewFollowedAt } from "../reading/views";

/**
 * A size's knitting, for a component: suspended, under the nearest Suspense,
 * while its frozen copy is fetched, and NoKnitting, for the nearest
 * KnittingBoundary, where it cannot be.
 */
export const useKnitting = (pattern: Design, sizeId: string, edition?: string) => {
  const knitting = knittingToHand(pattern, sizeId, edition);
  if (!knitting) {
    if (editionFailed(pattern.id, sizeId, edition)) throw new NoKnitting(`${pattern.id} ${sizeId}`);
    // Either way it settles, and the page is drawn again to find which.
    throw loadEdition(pattern.id, sizeId, edition).then(() => undefined, () => undefined);
  }
  return knitting;
};

/** A sweater, and its rounds as the knitter counts them once `progress` stitches are worked: see countedAt. */
export const useSweater = (pattern: Design, sizeId: string, progress = 0, edition?: string) => {
  const built = useKnitting(pattern, sizeId, edition);
  const { view, index } = countedAt(pattern, built, progress);
  const yoke = useMemo(() => yokeRounds(built), [built]);
  const holds = useMemo(() => holdRegions(built.stitches, built.holds), [built]);
  const views = useMemo(() => chartViews(built, pattern.pieces), [built, pattern]);
  const following = viewFollowedAt(views, built, progress);
  return { ...built, index, yoke, holdRegions: holds, view, views, following };
};
