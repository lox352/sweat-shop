import { describe, expect, it } from "vitest";
import { sweaterById } from "./designs";
import { buildSweater } from "./engine/engine";
import { cutAfter, fit, fitOptions } from "./fit";

const once = "wool-week-strips-once-oldest";
const pieceRounds = (knitted: ReturnType<typeof buildSweater>, piece: string) => knitted.roundPieces.filter((one) => one === piece).length;

describe("a sweater fitted to its knitter, part way through", () => {
  const whole = buildSweater(sweaterById(once)!, "l");
  // A knitter whose stitches are a good deal bigger than the pattern's: 14 in 6cm, 50 rounds in 20cm.
  const loose = { stitchesPer10cm: 23.3, roundsPer10cm: 25 };

  it("can be planned from the last round of a year on the yoke, and nowhere else", () => {
    expect(cutAfter(once, whole, 1)).toBe(47);
    expect(cutAfter(once, whole, 49)).toBe(67);
    expect(cutAfter(once, whole, 67)).toBe(67);
    expect(cutAfter(once, whole, whole.roundPieces.indexOf("body") + 1)).toBeUndefined();
    expect(() => fit({ design: once, sizeId: "l", knitted: whole, round: 60, tension: loose })).toThrow(/round 60/);
    expect(cutAfter("paul-klee", whole, 1)).toBeUndefined();
    expect(fitOptions(once).map((option) => option.id)).toEqual(["every", "fewer"]);
  });

  for (const option of ["every", "fewer"]) {
    it(`size L from round 67 at a loose tension, ${option}: every round knitted is kept, and the yoke divides where it is`, () => {
      const fitted = fit({ design: once, sizeId: "l", knitted: whole, round: 67, tension: loose, option });
      const kept = whole.rounds[66][whole.rounds[66].length - 1] + 1;
      expect(fitted.knitted.stitches.slice(0, kept).map(({ type, slot, links }) => ({ type, slot, links }))).toEqual(
        whole.stitches.slice(0, kept).map(({ type, slot, links }) => ({ type, slot, links })),
      );
      expect(fitted.knitted.rounds.slice(0, 67)).toEqual(whole.rounds.slice(0, 67));
      // 416 stitches are already more than the 396 this tension wants: no more yoke, and the 20 over shared out.
      expect(fitted.knitted.roundPieces[67]).toBe("body");
      expect(fitted.knitted.checks.yoke).toBeUndefined();
      expect(fitted.knitted.checks.body).toBe(284);
      expect(fitted.knitted.checks["sleeve-left:top"]).toBe(86);
      expect(fitted.notes.join(" ")).toMatch(/416 stitches round the yoke, 20 more/);
      // About 41.5cm of body and 46cm of sleeve at 25 rounds to 10cm.
      expect(pieceRounds(fitted.knitted, "body")).toBeGreaterThan(96);
      expect(pieceRounds(fitted.knitted, "body")).toBeLessThan(106);
      expect(pieceRounds(fitted.knitted, "sleeve-left")).toBeGreaterThan(108);
      expect(pieceRounds(fitted.knitted, "sleeve-left")).toBeLessThan(118);
      expect(fitted.finished.chestCm).toBeCloseTo(122, 0);
      expect(fitted.written).toMatch(/^Body \(body\)/m);
    });
  }

  it("at the pattern's own tension, the yoke goes on to the count the size divides at", () => {
    const fitted = fit({ design: once, sizeId: "l", knitted: whole, round: 67, tension: { stitchesPer10cm: 32, roundsPer10cm: 38 } });
    expect(fitted.knitted.checks.yoke).toBe(whole.checks.yoke);
    expect(fitted.knitted.checks.body).toBe(whole.checks.body);
    expect(Math.abs(fitted.knitted.rounds.length - whole.rounds.length)).toBeLessThan(8);
  });

  it("a tighter knitter has more of the yoke to come", () => {
    const fitted = fit({ design: once, sizeId: "m", knitted: buildSweater(sweaterById(once)!, "m"), round: cutAfter(once, buildSweater(sweaterById(once)!, "m"), 1)!, tension: { stitchesPer10cm: 34, roundsPer10cm: 42 } });
    expect(fitted.knitted.checks.yoke).toBeGreaterThan(520);
    expect(fitted.notes[0]).toMatch(/The yoke has \d+ rounds more/);
  });
});

describe("Hamefarin fitted part way through its yoke", () => {
  const whole = buildSweater(sweaterById("hamefarin")!, "m");
  const endOfBand = (name: string) => whole.roundLabels.findIndex((label, at) => label.startsWith(`${name}, row`) && !whole.roundLabels[at + 1]?.startsWith(`${name}, row`)) + 1;
  const border = endOfBand("Border");

  it("can be planned from the last round of a band of the yoke", () => {
    expect(cutAfter("hamefarin", whole, 1)).toBe(endOfBand("Peerie"));
    expect(cutAfter("hamefarin", whole, border - 3)).toBe(border);
    expect(cutAfter("hamefarin", whole, whole.roundPieces.indexOf("body") + 1)).toBeUndefined();
    expect(fitOptions("hamefarin")).toEqual([]);
  });

  it("at the pattern's own tension, the rest is the size's: the same counts, the same length", () => {
    const fitted = fit({ design: "hamefarin", sizeId: "m", knitted: whole, round: border, tension: { stitchesPer10cm: 28, roundsPer10cm: 32 } });
    expect(fitted.knitted.checks).toMatchObject({ lozenges: whole.checks.lozenges, body: whole.checks.body, "sleeve-left:cuff": whole.checks["sleeve-left:cuff"] });
    expect(fitted.knitted.rounds.length).toBe(whole.rounds.length);
    expect(fitted.finished).toMatchObject({ chestCm: 105.5, bodyLengthCm: 37, sleeveLengthCm: 45 });
  });

  it("a looser knitter's yoke is deep enough sooner: bands are left out, and what the yoke has over is shared out and said", () => {
    const fitted = fit({ design: "hamefarin", sizeId: "m", knitted: whole, round: border, tension: { stitchesPer10cm: 22, roundsPer10cm: 24 } });
    const kept = whole.rounds[border - 1][whole.rounds[border - 1].length - 1] + 1;
    expect(fitted.knitted.stitches.slice(0, kept).map(({ type, slot, links }) => ({ type, slot, links }))).toEqual(whole.stitches.slice(0, kept).map(({ type, slot, links }) => ({ type, slot, links })));
    expect(fitted.notes.join(" ")).toMatch(/Left out, for want of depth at this tension: .*Lozenges/);
    expect(fitted.knitted.rounds.length).toBeLessThan(whole.rounds.length);
    // 37cm of body at 24 rounds to 10cm, the yoke's extra depth off it.
    expect(fitted.finished.bodyLengthCm).toBeLessThanOrEqual(37);
    expect(fitted.finished.sleeveLengthCm).toBe(45);
  });

  it("every size can be planned on from every band, tighter and looser, or says why not", () => {
    const pattern = sweaterById("hamefarin")!;
    const said: string[] = [];
    let planned = 0;
    for (const size of pattern.sizes) {
      const knitted = buildSweater(pattern, size.id);
      for (let round = cutAfter("hamefarin", knitted, 1); round !== undefined; round = cutAfter("hamefarin", knitted, round + 1)) {
        for (const tension of [{ stitchesPer10cm: 24, roundsPer10cm: 28 }, { stitchesPer10cm: 30, roundsPer10cm: 36 }, { stitchesPer10cm: 26, roundsPer10cm: 34 }]) {
          try {
            const fitted = fit({ design: "hamefarin", sizeId: size.id, knitted, round, tension });
            expect(fitted.knitted.roundPieces.at(-1)).toBe("sleeve-right");
            planned++;
          } catch (error) {
            said.push(`${size.id} ${round} ${tension.stitchesPer10cm}: ${(error as Error).message}`);
          }
        }
      }
    }
    expect(said.every((one) => /fitted: /.test(one)), said.join("\n")).toBe(true);
    expect(planned).toBeGreaterThan(90);
    expect(said.length, said.join("\n")).toBeLessThan(20);
  }, 600000);
});
