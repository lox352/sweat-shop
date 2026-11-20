import { describe, expect, it } from "vitest";
import { sweaterById } from "./designs";
import { buildSweater } from "./engine/engine";
import { asEdition } from "../library/editions/own";
import { cutAfter, fit, fitOptions } from "./fit";

const once = "wool-week-strips-once-oldest";
const pieceRounds = (knitted: ReturnType<typeof buildSweater>, piece: string) => knitted.roundPieces.filter((one) => one === piece).length;

describe("a sweater fitted to its knitter, part way through", () => {
  const whole = buildSweater(sweaterById(once)!, "l");
  // A knitter whose stitches are a good deal bigger than the pattern's: 14 in 6cm, 50 rounds in 20cm.
  const loose = { stitchesPer10cm: 23.3, roundsPer10cm: 25 };
  // The last rounds of its first two years, 2014 and 2015.
  const first = cutAfter(once, whole, 1)!;
  const second = cutAfter(once, whole, first + 2)!;

  it("can be planned from the last round of a year on the yoke, and nowhere else", () => {
    expect([first, second]).toEqual([44, 68]);
    expect(cutAfter(once, whole, second)).toBe(second);
    expect(cutAfter(once, whole, whole.roundPieces.indexOf("body") + 1)).toBeUndefined();
    expect(() => fit({ design: once, sizeId: "l", knitted: whole, round: 60, tension: loose })).toThrow(/round 60/);
    expect(cutAfter("paul-klee", whole, 1)).toBeUndefined();
    expect(fitOptions(once).map((option) => option.id)).toEqual(["every", "fewer"]);
  });

  for (const option of ["every", "fewer"]) {
    it(`size L from the end of 2015 at a loose tension, ${option}: every round knitted is kept, and the yoke divides where it is`, () => {
      const fitted = fit({ design: once, sizeId: "l", knitted: whole, round: second, tension: loose, option });
      const kept = whole.rounds[second - 1][whole.rounds[second - 1].length - 1] + 1;
      expect(fitted.knitted.stitches.slice(0, kept).map(({ type, slot, links }) => ({ type, slot, links }))).toEqual(
        whole.stitches.slice(0, kept).map(({ type, slot, links }) => ({ type, slot, links })),
      );
      expect(fitted.knitted.rounds.slice(0, second)).toEqual(whole.rounds.slice(0, second));
      // 420 stitches are already more than the 396 this tension wants: no more yoke, and the 24 over shared out.
      expect(fitted.knitted.roundPieces[second]).toBe("body");
      expect(fitted.knitted.checks.yoke).toBeUndefined();
      expect(fitted.knitted.checks.body).toBe(288);
      expect(fitted.knitted.checks["sleeve-left:top"]).toBe(86);
      expect(fitted.notes.join(" ")).toMatch(/420 stitches round the yoke, 24 more/);
      // About 41.5cm of body and 46cm of sleeve at 25 rounds to 10cm.
      expect(pieceRounds(fitted.knitted, "body")).toBeGreaterThan(96);
      expect(pieceRounds(fitted.knitted, "body")).toBeLessThan(106);
      expect(pieceRounds(fitted.knitted, "sleeve-left")).toBeGreaterThan(108);
      expect(pieceRounds(fitted.knitted, "sleeve-left")).toBeLessThan(118);
      expect(fitted.finished.chestCm).toBeCloseTo(123.5, 0);
      expect(fitted.written).toMatch(/^Body \(body\)/m);
    });
  }

  it("at the pattern's own tension, the yoke goes on to the count the size divides at", () => {
    const fitted = fit({ design: once, sizeId: "l", knitted: whole, round: second, tension: { stitchesPer10cm: 32, roundsPer10cm: 38 } });
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

describe("Hamefarin worked out for a tension from the cast-on", () => {
  const pattern = sweaterById("hamefarin")!;

  it("at the pattern's own tension is the size as published, near enough: the same neck, body and sleeves, the yoke within a few rounds", () => {
    const published = buildSweater(pattern, "m");
    const fitted = fit({ design: "hamefarin", sizeId: "m", tension: { stitchesPer10cm: 28, roundsPer10cm: 32 } });
    expect(fitted.round).toBeUndefined();
    expect(fitted.knitted.checks).toMatchObject({ neck: published.checks.neck, lozenges: published.checks.lozenges, body: published.checks.body, "sleeve-left:cuff": published.checks["sleeve-left:cuff"] });
    expect(Math.abs(fitted.knitted.rounds.length - published.rounds.length)).toBeLessThan(4);
    expect(fitted.finished).toMatchObject({ chestCm: 105.5, bodyLengthCm: 37, sleeveLengthCm: 45 });
    expect(fitted.written).toMatch(/^Neck \(yoke\)\n {2}Cast on 128/m);
  });

  it("at a knitter's own, every size is cast on for it and knitted to the end of its right sleeve, or says why not", () => {
    const said: string[] = [];
    let planned = 0;
    for (const size of pattern.sizes) {
      for (const tension of [{ stitchesPer10cm: 22, roundsPer10cm: 26 }, { stitchesPer10cm: 24, roundsPer10cm: 30 }, { stitchesPer10cm: 32, roundsPer10cm: 38 }]) {
        try {
          const fitted = fit({ design: "hamefarin", sizeId: size.id, tension });
          expect(fitted.knitted.roundPieces.at(-1)).toBe("sleeve-right");
          // Cast on for the tension: the neck measures what the size's does, within a couple of centimetres.
          expect(Math.abs(fitted.finished.neckCm - size.finished.neckCm)).toBeLessThan(2.5);
          expect(Math.abs(fitted.finished.chestCm - size.finished.chestCm)).toBeLessThan(4);
          planned++;
        } catch (error) {
          said.push(`${size.id} ${tension.stitchesPer10cm}: ${(error as Error).message}`);
        }
      }
    }
    expect(said.every((one) => /fitted: /.test(one)), said.join("\n")).toBe(true);
    expect(planned, said.join("\n")).toBeGreaterThan(20);
  }, 600000);

});

describe("Each Year Once worked out for a tension from the cast-on", () => {
  const pattern = sweaterById(once)!;
  const plain = ({ type, slot, links }: { type: string; slot: string; links: number[] }) => ({ type, slot, links });

  it("at the pattern's own tension is the size as published, to the stitch", () => {
    for (const sizeId of ["m", "2xl"]) {
      const published = buildSweater(pattern, sizeId);
      const fitted = fit({ design: once, sizeId, tension: { stitchesPer10cm: 32, roundsPer10cm: 38 } });
      expect(fitted.round).toBeUndefined();
      expect(fitted.knitted.stitches.map(plain)).toEqual(published.stitches.map(plain));
      expect(fitted.knitted.roundLabels).toEqual(published.roundLabels);
      expect(fitted.knitted.checks).toEqual(published.checks);
    }
  }, 600000);

  it("at a knitter's own, every year or fewer and fuller: cast on for it, and knitted to the end of its right sleeve", () => {
    const loose = { stitchesPer10cm: 23.3, roundsPer10cm: 25 };
    const every = fit({ design: once, sizeId: "l", tension: loose, option: "every" });
    const fewer = fit({ design: once, sizeId: "l", tension: loose, option: "fewer" });
    for (const fitted of [every, fewer]) {
      expect(fitted.knitted.roundPieces.at(-1)).toBe("sleeve-right");
      expect(Math.abs(fitted.finished.chestCm - 116)).toBeLessThan(2);
      // The divide within a couple of centimetres of the size's.
      expect(Math.abs(fitted.finished.yokeDepthCm - pattern.sizes.find((size) => size.id === "l")!.finished.yokeDepthCm)).toBeLessThan(2.5);
      expect(fitted.written).toMatch(/^Yoke \(yoke\)\n {2}Cast on \d+/m);
    }
    // Every year is placed, the neck's ribbing beside the first; with fewer, the last are left out and said.
    expect(Object.keys(every.placement!.places)).toHaveLength(13);
    expect(every.notes.join(" ")).not.toMatch(/Left out/);
    expect(fewer.notes.join(" ")).toMatch(/Left out: \d{4} to 2026/);
    expect(fewer.knitted.rounds.length).toBeLessThanOrEqual(every.knitted.rounds.length + 4);
  }, 600000);

  it("for every size at tensions either side of the pattern's, or says why not", () => {
    const said: string[] = [];
    let planned = 0;
    for (const size of pattern.sizes) {
      for (const tension of [{ stitchesPer10cm: 24, roundsPer10cm: 27 }, { stitchesPer10cm: 28, roundsPer10cm: 33 }, { stitchesPer10cm: 34, roundsPer10cm: 42 }]) {
        try {
          const fitted = fit({ design: once, sizeId: size.id, tension });
          expect(fitted.knitted.roundPieces.at(-1)).toBe("sleeve-right");
          expect(Math.abs(fitted.finished.chestCm - size.finished.chestCm)).toBeLessThan(3);
          planned++;
        } catch (error) {
          said.push(`${size.id} ${tension.stitchesPer10cm}: ${(error as Error).message}`);
        }
      }
    }
    expect(planned, said.join("\n")).toBeGreaterThan(20);
  }, 900000);

  it("a design that can't be planned says so", () => {
    expect(() => fit({ design: "paul-klee", sizeId: "m", tension: { stitchesPer10cm: 28, roundsPer10cm: 32 } })).toThrow(/can't be planned/);
  });
});

/*
 * A link to a jumper whose pattern was recalculated says how it was made, and
 * names what came of it; opened where the jumper is not kept, the pattern is
 * planned again and must be the one named (see projects/remake). So the
 * planning is the same every time it is asked the same - and a change to
 * what it answers is a change to every such link made before it, which then
 * says its pattern can't be made again. That may be worth it, to put a
 * pattern right. It should not happen unnoticed: these are what the planner
 * answers now, and a change here is that change.
 */
describe("what the planner answers is what a link names", () => {
  const named = async (design: string, sizeId: string, ask: Partial<Parameters<typeof fit>[0]> = {}) =>
    (await asEdition(fit({ design, sizeId, tension: { stitchesPer10cm: 24.5, roundsPer10cm: 28 }, ...ask }).knitted, design, sizeId)).edition;

  it("the same, asked again", async () => {
    expect(await named("hamefarin", "m")).toBe(await named("hamefarin", "m"));
  });

  it("and what it was when these were written", async () => {
    const whole = buildSweater(sweaterById("hamefarin")!, "m");
    expect([
      await named("hamefarin", "m"),
      await named("hamefarin", "m", { knitted: whole, round: cutAfter("hamefarin", whole, 1)! }),
      await named(once, "l", { option: "every" }),
      await named(once, "l", { option: "fewer" }),
    ]).toEqual(["38a1e1893ce0", "c85b2bd5451b", "6ebdca8200c3", "f3902201fcdf"]);
  });
});
