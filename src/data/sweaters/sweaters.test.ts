import { describe, expect, it } from "vitest";
import { sweaters } from ".";
import { buildSweater } from "../../knitting/engine";
import { breaches } from "../../knitting/rules";
import { ballsFor, metresBySlot } from "../../knitting/yardage";

/**
 * Every size of every design, knitted through and held to what it says.
 *
 * The hat site checked its charts against the counts the published patterns
 * print. A design prints its counts too - the graded table in its file, or
 * the numbers its pattern states - and these check the knitting against
 * them and against the rules of Fair Isle. What a design's sizes measure,
 * and how, is each design's own: see its own tests. A design that does not
 * knit up to what it claims fails the build.
 */
describe.each(sweaters.map((sweater) => [sweater.id, sweater] as const))("%s", (_, sweater) => {
  describe.each(sweater.sizes.map((size) => [size.id, size] as const))("size %s", (__, size) => {
    const built = buildSweater(sweater, size.id);
    const piece = (id: string) =>
      built.rounds.filter((_round, index) => built.roundPieces[index] === id);

    it("knits every count its pattern states", () => {
      expect(built.checks).toEqual(size.checks);
    });

    it("has the physics stand on the rounds as worked from each piece's seam: the pattern's own, while no marker moves", () => {
      expect(built.knitting.rounds).toEqual(built.rounds);
      expect(built.knitting.roundKinds).toEqual(built.roundKinds);
      expect(built.knitting.roundPieces).toEqual(built.roundPieces);
      expect(built.knitting.stitches).toBe(built.stitches);
    });

    it("keeps to two colours a round, and never floats more than seven", () => {
      expect(breaches(built.stitches, built.rounds)).toEqual([]);
    });

    it("takes each sleeve up onto the main needles, and changes to the rib's for its cuff", () => {
      for (const id of ["sleeve-left", "sleeve-right"]) {
        const rounds = piece(id);
        const [first, last] = [rounds[0][0], rounds[rounds.length - 1].at(-1)!];
        expect(built.stitches[first].needles, `${id}, its first round`).toBe(size.needlesMm);
        expect(built.stitches[last].needles, `${id}, its bind-off`).toBe(size.ribNeedlesMm);
        const changes = built.stitches.filter((stitch) => stitch.type === "needles" && stitch.id > first && stitch.id < last);
        expect(changes.map((stitch) => stitch.needles), id).toEqual([size.ribNeedlesMm]);
      }
    });

    it("knits both sleeves alike, from the same number of held stitches", () => {
      const left = piece("sleeve-left").map((round) => round.length);
      const right = piece("sleeve-right").map((round) => round.length);
      expect(left).toEqual(right);
    });

    it("needs a believable amount of each yarn, of every yarn this size knits", () => {
      const estimated = metresBySlot(built.stitches, built.rounds);
      const knitted = Object.keys(estimated).filter((slot) => estimated[slot] > 0).sort();
      const total = (metres: Record<string, number>) => Object.values(metres).reduce((sum, length) => sum + length, 0);
      if (size.yardage) {
        // A pattern's own shopping list: for exactly the yarns the knitting uses, and near what it knits up to.
        expect(Object.keys(size.yardage).sort()).toEqual(knitted);
        expect(total(estimated) / total(size.yardage)).toBeGreaterThan(0.5);
        expect(total(estimated) / total(size.yardage)).toBeLessThan(1.5);
        return;
      }
      // A jumper-weight yoke sweater is somewhere between about 1000 and 3500 metres.
      expect(total(estimated)).toBeGreaterThan(1000);
      expect(total(estimated)).toBeLessThan(3500);
      // The body colour is the most of it, and every slot is used.
      expect(knitted).toEqual([...sweater.slots].sort());
      expect(Math.max(...Object.values(estimated))).toBe(estimated[sweater.slots[0]]);
      sweater.colourways.forEach((colourway) => {
        if (!colourway.ballMetres) return;
        expect(ballsFor(estimated[sweater.slots[0]], colourway.ballMetres)).toBeGreaterThan(4);
      });
    });
  });
});
