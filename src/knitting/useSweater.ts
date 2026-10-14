import { useMemo } from "react";
import { SweaterPattern } from "../data/sweaters/types";
import { buildSweater } from "./engine";
import { indexRounds } from "./progress";
import { holdRegions } from "./holds";

/**
 * A sweater's stitches and rounds, for a size.
 *
 * Building them is pure and quick enough - eighty thousand small objects for
 * a medium - but it is the same answer every time for a given design and
 * size, and the home page, the design page and a project all ask for it, so
 * it is worth keeping. Colourways share the knitting completely.
 */
const cache = new Map<string, ReturnType<typeof buildSweater>>();

export const sweaterStitches = (pattern: SweaterPattern, sizeId?: string) => {
  const key = `${pattern.id}::${sizeId ?? ""}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const built = buildSweater(pattern, sizeId);
  cache.set(key, built);
  return built;
};

/**
 * The rounds of the first piece knitted - for a top-down sweater, the yoke,
 * whose bands are what the strips on the cards and the colourway picker
 * show.
 */
export const yokeRounds = (built: { rounds: number[][]; roundPieces: string[] }): number[][] =>
  built.rounds.filter((_, index) => built.roundPieces[index] === built.roundPieces[0]);

export const useSweater = (pattern: SweaterPattern, sizeId?: string) => {
  const built = useMemo(() => sweaterStitches(pattern, sizeId), [pattern, sizeId]);
  const index = useMemo(
    () => indexRounds(built.rounds, built.roundLabels, built.roundPieces, pattern.pieces, built.roundKinds),
    [built, pattern.pieces],
  );
  const yoke = useMemo(() => yokeRounds(built), [built]);
  const holds = useMemo(() => holdRegions(built.stitches, built.holds), [built]);
  return { ...built, index, yoke, holdRegions: holds };
};

/**
 * The size to show first: the one made for a chest nearest an average
 * adult's, rather than whichever happens to be in the middle of the list.
 */
export const defaultSize = (pattern: SweaterPattern) =>
  pattern.sizes.reduce((best, size) =>
    Math.abs(size.toFitChestCm - 96) < Math.abs(best.toFitChestCm - 96) ? size : best,
  );
