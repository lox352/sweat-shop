import { describe, expect, it } from "vitest";
import { sweaters } from ".";
import { buildSweater } from "../../knitting/engine";
import { breaches } from "../../knitting/rules";
import { ballsFor, metresBySlot } from "../../knitting/yardage";

/**
 * Every size of every design, knitted through and held to what it says.
 *
 * The hat site checked its charts against the counts the published patterns
 * print. A design of the site's own prints its counts too - the graded table
 * in its file - and these check the knitting against them, against the
 * measurements each size was graded to, and against the rules of Fair Isle.
 * A design that does not knit up to what it claims fails the build.
 */
describe.each(sweaters.map((sweater) => [sweater.id, sweater] as const))("%s", (_, sweater) => {
  describe.each(sweater.sizes.map((size) => [size.id, size] as const))("size %s", (__, size) => {
    const built = buildSweater(sweater, size.id);
    const piece = (id: string) =>
      built.rounds.filter((_round, index) => built.roundPieces[index] === id);
    // Whole rounds only: a short row across the back of the neck adds nothing to the front.
    const wholeRounds = (id: string) =>
      built.rounds.filter((_round, index) => built.roundPieces[index] === id && built.roundKinds[index] === "round");
    const perCm = size.stitchesPer10cm / 10;
    const roundsPerCm = size.roundsPer10cm / 10;

    it("knits every count its pattern states", () => {
      expect(built.checks).toEqual(size.checks);
    });

    it("keeps to two colours a round, and never floats more than seven", () => {
      expect(breaches(built.stitches, built.rounds)).toEqual([]);
    });

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

    it("knits both sleeves alike, from the same number of held stitches", () => {
      const left = piece("sleeve-left").map((round) => round.length);
      const right = piece("sleeve-right").map((round) => round.length);
      expect(left).toEqual(right);
    });

    it("needs a believable amount of each yarn", () => {
      const metres = metresBySlot(built.stitches, built.rounds);
      const total = Object.values(metres).reduce((sum, length) => sum + length, 0);
      // A jumper-weight yoke sweater is somewhere between about 1000 and 3500 metres.
      expect(total).toBeGreaterThan(1000);
      expect(total).toBeLessThan(3500);
      // The body colour is the most of it, and every slot is used.
      for (const slot of sweater.slots) expect(metres[slot], slot).toBeGreaterThan(0);
      expect(Math.max(...Object.values(metres))).toBe(metres.A);
      sweater.colourways.forEach((colourway) => {
        if (!colourway.ballMetres) return;
        expect(ballsFor(metres.A, colourway.ballMetres)).toBeGreaterThan(4);
      });
    });
  });
});
