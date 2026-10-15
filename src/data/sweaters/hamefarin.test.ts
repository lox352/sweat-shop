import { describe, expect, it } from "vitest";
import hamefarin from "./hamefarin";
import { buildSweater } from "../../knitting/engine";

/**
 * Hamefarin, held to what its grading worked out: every size knits up to the
 * measurements it was graded to, at the tension it is written for, and its
 * short rows raise the back of the neck as a yoke's should.
 */
describe.each(hamefarin.sizes.map((size) => [size.id, size] as const))("Hamefarin in size %s", (_, size) => {
  const built = buildSweater(hamefarin, size.id);
  const piece = (id: string) =>
    built.rounds.filter((_round, index) => built.roundPieces[index] === id);
  // Whole rounds only: a short row across the back of the neck adds nothing to the front.
  const wholeRounds = (id: string) =>
    built.rounds.filter((_round, index) => built.roundPieces[index] === id && built.roundKinds[index] === "round");
  const perCm = size.stitchesPer10cm / 10;
  const roundsPerCm = size.roundsPer10cm / 10;

  it("knits up to its measurements", () => {
    const { finished } = size;
    const within = (got: number, wanted: number, what: string) =>
      expect(Math.abs(got - wanted), `${what}: ${got.toFixed(1)}cm against ${wanted}cm`).toBeLessThanOrEqual(1);

    within(size.checks.body / perCm, finished.chestCm, "chest");
    within(size.checks.neck / perCm, finished.neckCm, "neck");
    within(size.checks["sleeve-left:top"] / perCm, finished.upperArmCm, "upper arm");
    within(size.checks["sleeve-left:cuff"] / perCm, finished.cuffCm, "cuff");
    // Depths and lengths in rounds; the cast-on is an edge, not a round's height.
    within((wholeRounds("yoke").length - 1) / roundsPerCm, finished.yokeDepthCm, "yoke depth, at the front");
    within(piece("body").length / roundsPerCm, finished.bodyLengthCm, "body length");
    within(piece("sleeve-left").length / roundsPerCm, finished.sleeveLengthCm, "sleeve length");
    within(piece("sleeve-right").length / roundsPerCm, finished.sleeveLengthCm, "sleeve length");
  });

  it("raises the back of the neck by about two centimetres, and the front not at all", () => {
    // Where each short row's stitches stand: on the ring of the round before the first of them.
    const ring = built.rounds[built.roundKinds.indexOf("right") - 1];
    const placeOf = (id: number): number => {
      const at = ring.indexOf(id);
      return at >= 0 ? at : placeOf(built.stitches[id].links[0]);
    };
    const rows = built.rounds.filter((_round, index) => built.roundKinds[index] !== "round");
    const rowsOver = (place: number) => rows.filter((row) => row.some((id) => placeOf(id) === place)).length;
    expect(Math.abs(rowsOver(0) / roundsPerCm - 2)).toBeLessThanOrEqual(0.5);
    expect(rowsOver(ring.length / 2)).toBe(0);
  });
});
