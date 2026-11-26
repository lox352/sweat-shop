import { describe, expect, it } from "vitest";
import { sweaterById, sweaters } from "./designs";
import { buildSweater } from "./engine/engine";
import { asEdition } from "../library/editions/own";
import { cutAfter, fit, fitOptions, startAfter } from "./fit";

const once = "wool-week-strips-once-oldest";
const pieceRounds = (knitted: ReturnType<typeof buildSweater>, piece: string) => knitted.roundPieces.filter((one) => one === piece).length;

describe("a sweater fitted to its knitter, part way through", () => {
  const whole = buildSweater(sweaterById(once)!, "l");
  // A knitter whose stitches are a good deal bigger than the pattern's: 14 in 6cm, 50 rounds in 20cm.
  const loose = { stitchesPer10cm: 23.3, roundsPer10cm: 25 };
  // The last rounds of its first two years, 2014 and 2015.
  const first = cutAfter(once, whole, 1)!;
  const second = cutAfter(once, whole, first + 2)!;

  it("can be planned afresh from the last round of a year on the yoke, and on from any round of one", () => {
    expect([first, second]).toEqual([44, 64]);
    expect(cutAfter(once, whole, second)).toBe(second);
    expect(cutAfter(once, whole, whole.roundPieces.indexOf("body") + 1)).toBeUndefined();
    // Any round of a year's band is one the rest can be planned on from: the year is finished as it was begun (see below).
    for (const round of [18, 30, first, first + 1, 60, second]) expect(startAfter(once, whole, round), `round ${round}`).toBe(round);
    // In the neck's ribbing or its short rows, the first round after them; and once the yoke is divided, none.
    expect(startAfter(once, whole, 1)).toBe(18);
    expect(startAfter(once, whole, whole.roundPieces.indexOf("body") + 1)).toBeUndefined();
    // A design with no way to finish a band begun plans on from where it plans afresh.
    const hamefarin = buildSweater(sweaterById("hamefarin")!, "m");
    expect(startAfter("hamefarin", hamefarin, 1)).toBe(cutAfter("hamefarin", hamefarin, 1));
    expect(cutAfter("paul-klee", whole, 1)).toBeUndefined();
    expect(startAfter("paul-klee", whole, 1)).toBeUndefined();
    expect(fitOptions(once).map((option) => option.id)).toEqual(["every", "fewer"]);
  }, 60000);

  for (const option of ["every", "fewer"]) {
    it(`size L from the end of 2015 at a loose tension, ${option}: every round knitted is kept, and the yoke divides where it is`, () => {
      const fitted = fit({ design: once, sizeId: "l", knitted: whole, round: second, tension: loose, option });
      const kept = whole.rounds[second - 1][whole.rounds[second - 1].length - 1] + 1;
      expect(fitted.knitted.stitches.slice(0, kept).map(({ type, slot, links }) => ({ type, slot, links }))).toEqual(
        whole.stitches.slice(0, kept).map(({ type, slot, links }) => ({ type, slot, links })),
      );
      expect(fitted.knitted.rounds.slice(0, second)).toEqual(whole.rounds.slice(0, second));
      // 412 stitches are already more than the 396 this tension wants: no more yoke, and the 16 over shared out.
      expect(fitted.knitted.roundPieces[second]).toBe("body");
      expect(fitted.knitted.checks.yoke).toBeUndefined();
      expect(fitted.knitted.checks.body).toBe(284);
      expect(fitted.knitted.checks["sleeve-left:top"]).toBe(84);
      expect(fitted.notes.join(" ")).toMatch(/412 stitches round the yoke, 16 more/);
      // About 41.5cm of body and 46cm of sleeve at 25 rounds to 10cm.
      expect(pieceRounds(fitted.knitted, "body")).toBeGreaterThan(96);
      expect(pieceRounds(fitted.knitted, "body")).toBeLessThan(106);
      expect(pieceRounds(fitted.knitted, "sleeve-left")).toBeGreaterThan(108);
      expect(pieceRounds(fitted.knitted, "sleeve-left")).toBeLessThan(118);
      expect(fitted.finished.chestCm).toBeCloseTo(122, 0);
      expect(fitted.written).toMatch(/^Body \(body\)/m);
    }, 60000);
  }

  it("size L from the end of 2015 at 26 stitches and 26 rounds: 2017's bands are whole, each knitted in all seven of its rounds", () => {
    const fitted = fit({ design: once, sizeId: "l", knitted: whole, round: second, tension: { stitchesPer10cm: 26, roundsPer10cm: 26 }, option: "every" });
    // The rounds a zigzag is knitted in, each by the zigzag's yarn: a band of teal and a band of blue, where there were three with a row off the first and the last.
    const yarns = fitted.knitted.rounds.map((ids) => new Set(ids.map((id) => fitted.knitted.stitches[id].slot.split("/")[0])));
    expect(yarns.flatMap((slots) => (slots.has("17B") ? ["B"] : slots.has("17C") ? ["C"] : [])).join("")).toBe("CCCCCCCBBBBBBB");
    // And 2018's dancers between their two rows of plusses, from plain row to plain row.
    expect(fitted.written).toMatch(/Chart \S+-18B17-1\S*, rows 1-17\./);
  }, 60000);

  it("asked of another fit's knitting from the same round, the answer is what it would have been of the pattern's: nothing of a rest not knitted is in it", () => {
    // So the rest worked out for one tension, then another with none of it knitted, is the rest worked out for the second: fits don't build on each other.
    const tighter = { stitchesPer10cm: 28, roundsPer10cm: 33 };
    const away = fit({ design: once, sizeId: "l", knitted: whole, round: second, tension: loose, option: "every" });
    const direct = fit({ design: once, sizeId: "l", knitted: whole, round: second, tension: tighter, option: "every" });
    const through = fit({ design: once, sizeId: "l", knitted: away.knitted, round: second, tension: tighter, option: "every" });
    const said = (knitted: typeof whole) => knitted.stitches.map(({ type, slot, links }) => ({ type, slot, links }));
    expect(through.knitted.rounds).toEqual(direct.knitted.rounds);
    expect(said(through.knitted)).toEqual(said(direct.knitted));
    expect(through.written).toBe(direct.written);
  }, 60000);

  it("planned again at the tension it was written for, the rest need not be the pattern's own: which is why a project goes back to that, and does not ask (see projects' fitTaken)", () => {
    const again = fit({ design: once, sizeId: "l", knitted: whole, round: second, tension: { stitchesPer10cm: 32, roundsPer10cm: 38 }, option: "every" });
    // Every round knitted is kept, and the size is the size.
    expect(again.knitted.rounds.slice(0, second)).toEqual(whole.rounds.slice(0, second));
    expect(again.knitted.checks.body).toBe(whole.checks.body);
  }, 60000);

  it("at the pattern's own tension, the yoke goes on to the count the size divides at", () => {
    const fitted = fit({ design: once, sizeId: "l", knitted: whole, round: second, tension: { stitchesPer10cm: 32, roundsPer10cm: 38 } });
    expect(fitted.knitted.checks.yoke).toBe(whole.checks.yoke);
    expect(fitted.knitted.checks.body).toBe(whole.checks.body);
    expect(Math.abs(fitted.knitted.rounds.length - whole.rounds.length)).toBeLessThan(8);
  }, 60000);

  it("a tighter knitter has more of the yoke to come", () => {
    const fitted = fit({ design: once, sizeId: "m", knitted: buildSweater(sweaterById(once)!, "m"), round: cutAfter(once, buildSweater(sweaterById(once)!, "m"), 1)!, tension: { stitchesPer10cm: 34, roundsPer10cm: 42 } });
    expect(fitted.knitted.checks.yoke).toBeGreaterThan(520);
    expect(fitted.notes[0]).toMatch(/The yoke has \d+ rounds more/);
  }, 60000);
});

describe("Each Year Once planned on from part way down a year", () => {
  const pattern = sweaterById(once)!;
  const whole = buildSweater(pattern, "l");
  // The knitter this was made for: 27 stitches and 27 rounds to 10cm on a pattern written for 32 and 38, so every round is bigger and there are fewer of them.
  const tension = { stitchesPer10cm: 27, roundsPer10cm: 27 };
  type Knitted = typeof whole;
  const said = (knitted: Knitted, rounds: [number, number]) => knitted.rounds.slice(rounds[0] - 1, rounds[1]).map((ids) => ids.map((id) => `${knitted.stitches[id].type} ${knitted.stitches[id].slot}`));
  const yarns = (knitted: Knitted, round: number) => knitted.rounds[round - 1].map((id) => knitted.stitches[id].slot);
  const made = (knitted: Knitted, round: number) => knitted.rounds[round - 1].filter((id) => knitted.stitches[id].type === "m1").length;
  const oneYarn = (knitted: Knitted, round: number) => new Set(yarns(knitted, round)).size === 1;
  const yokeRounds = (knitted: Knitted) => knitted.roundPieces.indexOf("body");

  it("size L from round 60, part way down 2015: the year is finished as it was begun, and grows to the yoke's count in its own rounds of one yarn", () => {
    const fitted = fit({ design: once, sizeId: "l", knitted: whole, round: 60, tension, option: "every" });
    const { knitted } = fitted;
    expect(fitted.round).toBe(60);
    // Every stitch knitted is kept.
    const kept = whole.rounds[59][whole.rounds[59].length - 1] + 1;
    expect(knitted.stitches.slice(0, kept).map(({ type, slot, links }) => ({ type, slot, links }))).toEqual(whole.stitches.slice(0, kept).map(({ type, slot, links }) => ({ type, slot, links })));
    // 2015 goes on for the four rounds it had left, each the round the pattern had there - the same yarns in the same order - on the count the yoke
    // now wants: the dots and a plain round on the 384 stitches on the needle, then on 456.
    expect(yokeRounds(knitted)).toBe(64);
    for (const round of [61, 62, 63, 64]) {
      const was = yarns(whole, round);
      expect(yarns(knitted, round).every((slot, j) => slot === was[j % was.length]), `round ${round}`).toBe(true);
      expect(knitted.roundLabels[round - 1]).toBe(whole.roundLabels[round - 1].replace("plain", round === 62 ? "shaping" : "plain"));
    }
    expect([60, 61, 62, 63, 64].map((round) => knitted.rounds[round - 1].length)).toEqual([384, 384, 456, 456, 456]);
    // Its new stitches are all made in a round of one yarn, and none in the dividing round, which follows a plain round.
    expect([61, 62, 63, 64, 65].map((round) => made(knitted, round))).toEqual([0, 72, 0, 0, 0]);
    expect(oneYarn(knitted, 62)).toBe(true);
    expect(knitted.roundLabels[64]).toMatch(/dividing round/);
    // So the size is the size: 312 stitches round the chest and 96 round the arm, where the yoke left as it was would give 280 and 90.
    expect(knitted.checks).toMatchObject({ yoke: 456, body: 312, "sleeve-left:top": 96 });
    expect(fitted.finished).toMatchObject({ chestCm: 115.5, upperArmCm: 35.5 });
    expect(fitted.notes[0]).toBe(
      "The yoke has 4 rounds more, the rest of 2015 Baa-ble Hat, and grows from 384 stitches to 456. It is then within 5 rounds of its depth at this tension, too few for another year, and the body is as much longer.",
    );
    expect(fitted.notes.join(" ")).not.toMatch(/shared between/);
    // 2015 is not planned afresh: it keeps the yarns it was begun in, and the years after it are placed.
    expect(Object.keys(fitted.placement!.places).sort()[0]).toBe("2016");
    expect(fitted.written).toMatch(/^Yoke \(yoke\)\n(.*\n)+?\nBody \(body\)\n {2}Divide, in 16D/m);
  }, 60000);

  it("from the middle of a motif, the motif goes on stitch for stitch: its repeats, and its own doubled columns", () => {
    // Round 55 is the fourth of the sheep's ten.
    const fitted = fit({ design: once, sizeId: "l", knitted: whole, round: 55, tension, option: "every" });
    expect(said(fitted.knitted, [1, 61])).toEqual(said(whole, [1, 61]));
    expect([62, 63, 64].map((round) => fitted.knitted.rounds[round - 1].length)).toEqual([456, 456, 456]);
    expect(yokeRounds(fitted.knitted)).toBe(64);
    expect(fitted.knitted.checks.body).toBe(312);
  }, 60000);

  it("where the count on the needle is already what the yoke wants, the year goes on exactly as charted", () => {
    // At the pattern's own tension from part way down 2016, the last year on the yoke.
    const fitted = fit({ design: once, sizeId: "l", knitted: whole, round: 80, tension: { stitchesPer10cm: 32, roundsPer10cm: 38 }, option: "every" });
    const end = yokeRounds(whole);
    expect(yokeRounds(fitted.knitted)).toBe(end);
    expect(fitted.knitted.rounds.slice(0, end).map((ids) => ids.length)).toEqual(whole.rounds.slice(0, end).map((ids) => ids.length));
    for (let round = 81; round <= end; round++) expect(yarns(fitted.knitted, round), `round ${round}`).toEqual(yarns(whole, round));
    expect(fitted.knitted.checks.body).toBe(whole.checks.body);
  }, 60000);

  it("a yoke that would come out too deep stops the year at the end of a run of its pattern, never part way through one, and says so", () => {
    // Part way down 2016's second strip of houses, at 27 rounds to 10cm, the yoke is already eleven rounds deeper than the size's.
    const fitted = fit({ design: once, sizeId: "l", knitted: whole, round: 80, tension, option: "every" });
    const { knitted } = fitted;
    // The strip in hand is finished, as charted, and the yoke divides: the round after it in the pattern began another run, on a new count.
    expect(yokeRounds(knitted)).toBe(82);
    expect(said(knitted, [1, 82])).toEqual(said(whole, [1, 82]));
    expect(made(whole, 83)).toBeGreaterThan(0);
    expect(fitted.notes[0]).toMatch(/^The yoke has 2 rounds more, the rest of 2016 Crofthoose Hat, which stops 15 rounds short of where it was planned to, and stays at 476 stitches\./);
    // More stitches than the tension wants are shared out and said, as ever; and 2016, more than a third knitted, is not laid out again.
    expect(fitted.notes.join(" ")).toMatch(/476 stitches round the yoke, 20 more/);
    expect(fitted.notes.join(" ")).toMatch(/The body has 2017 to 2020/);
  }, 60000);

  it("a year that must stop with little of it knitted is laid out afresh with the years to come, so none of it is lost", () => {
    // Size XS at the same tension, one round into 2016's first strip of houses: the yoke is as deep as it is to be.
    const xs = buildSweater(pattern, "xs");
    const fitted = fit({ design: once, sizeId: "xs", knitted: xs, round: 62, tension, option: "every" });
    const { knitted } = fitted;
    // The strip in hand is finished, four rounds more, and a round of one yarn makes the stitches the yoke lacks before it divides.
    expect(yokeRounds(knitted)).toBe(67);
    expect(said(knitted, [1, 66])).toEqual(said(xs, [1, 66]));
    expect(oneYarn(knitted, 67)).toBe(true);
    expect([66, 67].map((round) => knitted.rounds[round - 1].length)).toEqual([336, 348]);
    expect(fitted.notes[0]).toMatch(/^The yoke has no room for the rest of 2016 Crofthoose Hat as it was planned, and little of it is knitted: it stops at the end of the part of its pattern in hand, and is laid out afresh/);
    // 2016 is the body's first year, and has a place in a colourway that steps down the sweater.
    expect(fitted.notes.join(" ")).toMatch(/The body has 2016 to 2020/);
    expect(Object.keys(fitted.placement!.places).sort()[0]).toBe("2016");
    // With none of its pattern knitted - only its opening round of one yarn - it stops at once.
    const opening = fit({ design: once, sizeId: "xs", knitted: xs, round: 61, tension, option: "every" });
    expect(opening.notes[0]).toMatch(/it stops here, and is laid out afresh/);
    expect(opening.notes.join(" ")).toMatch(/The body has 2016 to 2020/);
  }, 60000);

  it("a year barely begun whose end would leave the yoke too shallow is laid out afresh too, with the yoke's depth to fill", () => {
    // 30 stitches and 30 rounds to 10cm: 2015 as the pattern has it, twenty rounds, would end thirteen rounds short of the yoke's depth, too few for 2016.
    const at = { stitchesPer10cm: 30, roundsPer10cm: 30 };
    // One round into it, its opening round of one yarn: laid out again, 2015 and 2016 fill the yoke, as they would from the round before.
    const begun = fit({ design: once, sizeId: "l", knitted: whole, round: 45, tension: at, option: "every" });
    expect(begun.notes[0]).toMatch(/^The yoke would be too shallow at the end of 2015 Baa-ble Hat as it was planned, and little of it is knitted: it stops here, and is laid out afresh/);
    expect(begun.notes[1]).toBe("The yoke has 33 rounds more, 2015 to 2016, and grows from 328 stitches to 504.");
    expect(Math.abs(begun.finished.yokeDepthCm - 23.5)).toBeLessThanOrEqual(0.5);
    expect(said(begun.knitted, [1, 45])).toEqual(said(whole, [1, 45]));
    // Half way down its sheep it goes on as it was begun, and the yoke is as much shallower as it is said to be.
    const half = fit({ design: once, sizeId: "l", knitted: whole, round: 56, tension: at, option: "every" });
    expect(half.notes[0]).toMatch(/^The yoke has 8 rounds more, the rest of 2015 Baa-ble Hat, and grows from 360 stitches to 504\. It is then within 13 rounds of its depth/);
    expect(half.finished.yokeDepthCm).toBe(19.5);
  }, 60000);

  it("a yoke that is done at a year's end but short of its count has one round more to make the stitches in, before the dividing round", () => {
    const end = cutAfter(once, whole, 60)!;
    const fitted = fit({ design: once, sizeId: "l", knitted: whole, round: end, tension, option: "every" });
    const { knitted } = fitted;
    expect(end).toBe(64);
    expect(yokeRounds(knitted)).toBe(65);
    // The round is of the yarn the dividing round is knitted in, and the dividing round makes nothing.
    expect(oneYarn(knitted, 65)).toBe(true);
    expect(yarns(knitted, 65)[0]).toBe(yarns(knitted, 66)[0]);
    expect([64, 65].map((round) => knitted.rounds[round - 1].length)).toEqual([412, 456]);
    expect(made(knitted, 65)).toBe(44);
    expect(knitted.roundLabels[65]).toMatch(/dividing round/);
    expect(made(knitted, 66)).toBe(0);
    expect(knitted.checks).toMatchObject({ yoke: 456, body: 312, "sleeve-left:top": 96 });
    expect(fitted.finished.chestCm).toBe(115.5);
    expect(fitted.notes[0]).toMatch(/^The yoke has 1 round more, a round before the dividing round to make stitches in, and grows from 412 stitches to 456\./);
    expect(fitted.notes.join(" ")).not.toMatch(/shared between/);
  }, 60000);

  it("a run in hand that leaves the yoke on an odd count, past the count it wants: a round more makes it one it can divide on, and what is over is said", () => {
    // Size S, part way down 2016's first strip of houses, whose last round doubles a column in each of its 27 repeats: 378 stitches to 405.
    const small = buildSweater(pattern, "s");
    const fitted = fit({ design: once, sizeId: "s", knitted: small, round: 66, tension, option: "every" });
    const { knitted } = fitted;
    expect(said(knitted, [1, 70])).toEqual(said(small, [1, 70]));
    expect([70, 71].map((round) => knitted.rounds[round - 1].length)).toEqual([405, 406]);
    expect(oneYarn(knitted, 71)).toBe(true);
    expect(yokeRounds(knitted)).toBe(71);
    expect(made(knitted, 72)).toBe(0);
    expect(fitted.notes.join(" ")).toMatch(/406 stitches round the yoke, 18 more than this tension wants/);
  }, 60000);

  it("from any round of any year on the yoke, tighter and looser: what is knitted is kept, the yoke never loses a stitch, and the dividing round makes none", () => {
    for (const sizeId of ["xs", "4xl"]) {
      const knitted = buildSweater(pattern, sizeId);
      const last = yokeRounds(knitted);
      for (const at of [{ stitchesPer10cm: 27, roundsPer10cm: 27 }, { stitchesPer10cm: 34, roundsPer10cm: 42 }]) {
        for (let round = startAfter(once, knitted, 1)! + 3; round <= last; round += 11) {
          const name = `${sizeId} at ${at.stitchesPer10cm} from round ${round}`;
          expect(startAfter(once, knitted, round), name).toBe(round);
          const fitted = fit({ design: once, sizeId, knitted, round, tension: at, option: "every" });
          const divide = yokeRounds(fitted.knitted) + 1;
          expect(said(fitted.knitted, [1, round]), name).toEqual(said(knitted, [1, round]));
          expect(divide, name).toBeGreaterThan(round);
          const counts = fitted.knitted.rounds.slice(round - 1, divide - 1).map((ids) => ids.length);
          expect(counts, name).toEqual([...counts].sort((a, b) => a - b));
          expect(made(fitted.knitted, divide), name).toBe(0);
          // The chest is the size's, unless the yoke has stitches it can't use or could not make, which is said.
          const size = pattern.sizes.find((one) => one.id === sizeId)!;
          if (!/shared between/.test(fitted.notes.join(" "))) expect(Math.abs(fitted.finished.chestCm - size.finished.chestCm), name).toBeLessThanOrEqual(1);
        }
      }
    }
  }, 600000);
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

describe("Each Year Once, shaped: planned on from anywhere along a plan, the plan is itself", () => {
  const shaped = "wool-week-strips-once-oldest-shaped";
  const pattern = sweaterById(shaped)!;
  const whole = buildSweater(pattern, "l");
  const own = { stitchesPer10cm: 32, roundsPer10cm: 38 };
  const loose = { stitchesPer10cm: 26, roundsPer10cm: 26 };
  const tight = { stitchesPer10cm: 34, roundsPer10cm: 42 };
  const said = (knitted: typeof whole) => knitted.stitches.map(({ type, slot, links }) => ({ type, slot, links }));
  const cuts: number[] = [];
  for (let round = cutAfter(shaped, whole, 1); round !== undefined; round = cutAfter(shaped, whole, round + 1)) cuts.push(round);

  it("says so, and Each Year Once does not", () => {
    expect(pattern.fitting?.consistent).toBe(true);
    expect(sweaterById(once)!.fitting?.consistent).toBeUndefined();
    expect(cuts).toEqual([44, 64, 97]);
  });

  it("from every year's end at the pattern's own tension, the rest is the pattern's own, to the stitch", () => {
    for (const round of cuts) {
      const again = fit({ design: shaped, sizeId: "l", knitted: whole, round, tension: own });
      expect(again.round).toBe(round);
      expect(again.knitted.rounds).toEqual(whole.rounds);
      expect(said(again.knitted)).toEqual(said(whole));
      expect(again.notes[0]).toMatch(/the rest of that pattern/);
      // And written out from where the knitting is, not from the cast-on.
      expect(again.written).not.toMatch(/Cast on/);
    }
  }, 600000);

  it("a tension changed, and changed back before anything more is knitted, leaves the pattern as it was: the same edition", async () => {
    const named = async (knitted: typeof whole) => (await asEdition(knitted, shaped, "l")).edition;
    for (const [round, other] of [[cuts[0], tight], [cuts[1], loose]] as const) {
      const away = fit({ design: shaped, sizeId: "l", knitted: whole, round, tension: other });
      expect(said(away.knitted)).not.toEqual(said(whole));
      const back = fit({ design: shaped, sizeId: "l", knitted: away.knitted, round, tension: own });
      expect(back.knitted.rounds).toEqual(whole.rounds);
      expect(said(back.knitted)).toEqual(said(whole));
      expect(await named(back.knitted)).toBe(await named(whole));
    }
  }, 600000);

  it("a plan made for another tension, followed to a later year's end and planned again at that tension, is itself, counts and all", () => {
    const away = fit({ design: shaped, sizeId: "l", knitted: whole, round: cuts[0], tension: tight });
    const later = cutAfter(shaped, away.knitted, cuts[0] + 1)!;
    expect(later).toBeGreaterThan(cuts[0]);
    expect(away.knitted.roundPieces[later - 1]).toBe("yoke");
    const again = fit({ design: shaped, sizeId: "l", knitted: away.knitted, round: later, tension: tight });
    expect(again.knitted.rounds).toEqual(away.knitted.rounds);
    expect(said(again.knitted)).toEqual(said(away.knitted));
    expect(again.knitted.checks).toEqual(away.knitted.checks);
    // Planned from there at any other tension it is a plan of its own, from where the knitting is.
    const other = fit({ design: shaped, sizeId: "l", knitted: away.knitted, round: later, tension: loose });
    expect(other.notes[0]).not.toMatch(/the rest of that pattern/);
    expect(other.knitted.rounds.slice(0, later)).toEqual(away.knitted.rounds.slice(0, later));
  }, 600000);

  it("at the pattern's own tension from the cast-on is the size as published, to the stitch", () => {
    const fitted = fit({ design: shaped, sizeId: "l", tension: own });
    expect(said(fitted.knitted)).toEqual(said(whole));
  }, 600000);

  it("from part way down a year at the pattern's own tension, the rest is the pattern's own too, to the stitch: a chart taken up at the row it is at", async () => {
    const named = async (knitted: typeof whole) => (await asEdition(knitted, shaped, "l")).edition;
    // Part way down a band of each year, and in the rounds of one yarn between two.
    for (const round of [30, 45, 58, 62, 80]) {
      expect(startAfter(shaped, whole, round)).toBe(round);
      const again = fit({ design: shaped, sizeId: "l", knitted: whole, round, tension: own });
      expect(again.round).toBe(round);
      expect(again.knitted.rounds, `round ${round}`).toEqual(whole.rounds);
      expect(said(again.knitted), `round ${round}`).toEqual(said(whole));
      expect(again.notes[0]).toMatch(/the rest of that pattern/);
      expect(await named(again.knitted)).toBe(await named(whole));
    }
  }, 600000);

  it("a plan begun part way down a year, followed and planned again at its tension, is itself, where the round it began after is known", () => {
    // Planned on from the middle of 2015's sheep for a looser knitter: the year is finished as it was begun, and the rest is that knitter's own.
    const away = fit({ design: shaped, sizeId: "l", knitted: whole, round: 55, tension: loose });
    expect(away.notes[0]).toMatch(/the rest of 2015 Baa-ble Hat/);
    expect(said(away.knitted)).not.toEqual(said(whole));
    // Followed further down that year, into the rounds it grows in, and on into the body's first rounds' year: the plan from round 55 explains it.
    const end = away.knitted.roundPieces.indexOf("body");
    for (const later of [58, 62, end]) {
      const again = fit({ design: shaped, sizeId: "l", knitted: away.knitted, round: later, tension: loose, earlier: [55] });
      expect(again.knitted.rounds, `round ${later}`).toEqual(away.knitted.rounds);
      expect(said(again.knitted), `round ${later}`).toEqual(said(away.knitted));
      expect(again.knitted.checks).toEqual(away.knitted.checks);
      expect(again.notes[0]).toMatch(/planned from an earlier round/);
    }
    // A round that is said and explains nothing is no matter: the pattern's own knitting, asked of at its own tension, is still the pattern's.
    const still = fit({ design: shaped, sizeId: "l", knitted: whole, round: 62, tension: own, earlier: [55, 1, 9999, 61.5] });
    expect(said(still.knitted)).toEqual(said(whole));
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

  it("a design the site has not got says so", () => {
    expect(() => fit({ design: "no-such-design", sizeId: "m", tension: { stitchesPer10cm: 28, roundsPer10cm: 32 } })).toThrow(/can't be planned/);
  });
});

/*
 * The designs that can be planned whole and not part way: each lays its
 * pattern out over the whole jumper, or is another designer's, a size at a
 * time. Every design the site has is one or the other.
 */
describe("a design planned only from the cast-on", () => {
  const plain = ({ type, slot, links }: { type: string; slot: string; links: number[] }) => ({ type, slot, links });
  const lined = "wool-week-strips-lined-oldest";
  const wholeOnly = [lined, "feline-raglan", "feline-yoke", "paul-klee"];
  const tensionOf = (design: string, sizeId: string) => {
    const { stitchesPer10cm, roundsPer10cm } = sweaterById(design)!.sizes.find((size) => size.id === sizeId)!;
    return { stitchesPer10cm, roundsPer10cm };
  };

  it("is every design that can't be planned on from part of its yoke, and every design can be planned one way or the other", () => {
    expect(sweaters.filter((sweater) => sweater.fitting && !sweater.fitting.cutAfter).map((sweater) => sweater.id).sort()).toEqual([...wholeOnly].sort());
    expect(sweaters.filter((sweater) => !sweater.fitting)).toEqual([]);
  });

  it("has no round the rest can be planned from, and says so if it is asked for one", () => {
    for (const design of wholeOnly) {
      const sizeId = sweaterById(design)!.sizes[2].id;
      const whole = buildSweater(sweaterById(design)!, sizeId);
      expect(cutAfter(design, whole, 1), design).toBeUndefined();
      expect(() => fit({ design, sizeId, knitted: whole, round: 30, tension: tensionOf(design, sizeId) }), design).toThrow(/only be planned whole/);
    }
  }, 600000);

  it("at the pattern's own tension is the size as published, to the stitch", () => {
    for (const [design, sizes] of [[lined, ["m"]], ["feline-raglan", ["s", "xl"]], ["feline-yoke", ["s", "xl"]], ["paul-klee", sweaterById("paul-klee")!.sizes.map((size) => size.id)]] as const) {
      for (const sizeId of sizes) {
        const published = buildSweater(sweaterById(design)!, sizeId);
        const fitted = fit({ design, sizeId, tension: tensionOf(design, sizeId) });
        expect(fitted.round, `${design} ${sizeId}`).toBeUndefined();
        expect(fitted.knitted.stitches.map(plain), `${design} ${sizeId}`).toEqual(published.stitches.map(plain));
        expect(fitted.knitted.checks, `${design} ${sizeId}`).toEqual(published.checks);
        // And says it measures what the size does, to the stitch nearest.
        expect(Math.abs(fitted.finished.chestCm - sweaterById(design)!.sizes.find((size) => size.id === sizeId)!.finished.chestCm), `${design} ${sizeId}`).toBeLessThanOrEqual(0.5);
      }
    }
  }, 900000);

  it("Thirteen Strips at a knitter's own: every year a strip of the tension's height, down the body and the sleeves alike; or that thirteen will not go", () => {
    const fitted = fit({ design: lined, sizeId: "m", tension: { stitchesPer10cm: 28, roundsPer10cm: 34 } });
    expect(fitted.knitted.roundPieces.at(-1)).toBe("sleeve-right");
    expect(fitted.finished).toMatchObject({ chestCm: 105.5, neckCm: 45.5, upperArmCm: 33 });
    expect(Math.abs(fitted.finished.bodyLengthCm - 40.5)).toBeLessThanOrEqual(1.5);
    expect(fitted.notes.join(" ")).toMatch(/Every year is a strip of 13 to 16 rounds at this tension: 2014 to 2018 round the yoke, which grows from 128 stitches to 432, and 2019 to 2026 down the body\./);
    expect(fitted.notes.join(" ")).toMatch(/2026 Birsie Beanny carries on to the cuff/);
    expect(fitted.placement).toBeUndefined();
    expect(fitted.written).toMatch(/^Yoke \(yoke\)\n {2}Cast on 128/m);
    // Too loose, and the jumper has too few rounds for thirteen hats.
    expect(() => fit({ design: lined, sizeId: "m", tension: { stitchesPer10cm: 22, roundsPer10cm: 26 } })).toThrow(/thirteen strips will not go in the \d+ rounds/);
  }, 600000);

  for (const design of ["feline-raglan", "feline-yoke"]) {
    it(`${design} at a knitter's own: the size's measurements in their stitches, and each feline drawn afresh as large as the front then has room for`, () => {
      const size = sweaterById(design)!.sizes.find((one) => one.id === "m")!;
      const published = (size as unknown as { knitted: () => { placed: { width: number; height: number } } }).knitted().placed;
      const fitted = fit({ design, sizeId: "m", tension: { stitchesPer10cm: 28, roundsPer10cm: 34 } });
      expect(fitted.knitted.roundPieces.at(-1)).toBe("sleeve-right");
      expect(fitted.knitted.checks.body).toBe(296);
      for (const key of ["chestCm", "neckCm", "upperArmCm", "yokeDepthCm", "bodyLengthCm", "sleeveLengthCm", "cuffCm"] as const) {
        expect(Math.abs(fitted.finished[key] - size.finished[key]), key).toBeLessThanOrEqual(0.5);
      }
      // Fewer, bigger stitches: a feline of fewer of them, and about as large.
      const drawn = /Each feline is drawn afresh for this tension: (\d+) stitches wide and (\d+) rounds tall/.exec(fitted.notes[0])!;
      expect(Number(drawn[1])).toBeLessThan(published.width);
      expect(Math.abs(Number(drawn[1]) / 2.8 - published.width / 3.2)).toBeLessThan(4);
      expect(Math.abs(Number(drawn[2]) / 3.4 - published.height / 3.8)).toBeLessThan(4);
      expect(fitted.written).toMatch(/^Yoke \(yoke\)\n {2}Cast on \d+/m);
    }, 600000);

    it(`${design} for every size at tensions either side of the pattern's, or says why not`, () => {
      const said: string[] = [];
      let planned = 0;
      for (const size of sweaterById(design)!.sizes) {
        for (const tension of [{ stitchesPer10cm: 26, roundsPer10cm: 32 }, { stitchesPer10cm: 30, roundsPer10cm: 36 }, { stitchesPer10cm: 34, roundsPer10cm: 42 }]) {
          try {
            const fitted = fit({ design, sizeId: size.id, tension });
            expect(fitted.knitted.roundPieces.at(-1)).toBe("sleeve-right");
            expect(Math.abs(fitted.finished.chestCm - size.finished.chestCm)).toBeLessThan(2);
            planned++;
          } catch (error) {
            said.push(`${size.id} ${tension.stitchesPer10cm}: ${(error as Error).message}`);
          }
        }
      }
      expect(said.every((one) => /can't be laid out on this size at this tension/.test(one)), said.join("\n")).toBe(true);
      expect(planned, said.join("\n")).toBeGreaterThanOrEqual(design === "feline-yoke" ? 23 : 18);
    }, 900000);
  }

  describe("the Paul Klee Sweater, a bought pattern in sixteen sizes", () => {
    const pattern = sweaterById("paul-klee")!;
    const m1 = pattern.sizes.find((size) => size.id === "m1")!;
    const pieceOf = (knitted: ReturnType<typeof buildSweater>, piece: string) => knitted.roundPieces.filter((one) => one === piece).length;

    it("for a tighter knitter is the yoke of a larger size as the pattern writes it, to the lengths of the size asked for", () => {
      const [published, larger] = [buildSweater(pattern, "m1"), buildSweater(pattern, "l")];
      const fitted = fit({ design: "paul-klee", sizeId: "m1", tension: { stitchesPer10cm: 24, roundsPer10cm: 37 } });
      // L's yoke, stitch for stitch, from its set-up round to its divide: only the neck's rib is M1's, in the knitter's rounds.
      const yokeOf = (knitted: ReturnType<typeof buildSweater>) => {
        const from = knitted.roundLabels.findIndex((label, at) => knitted.roundKinds[at] === "round" && !/rib|cast|join/i.test(label) && at > 5);
        const to = knitted.roundPieces.indexOf("body");
        return knitted.rounds.slice(from, to).map((ids) => ids.map((id) => knitted.stitches[id].slot + knitted.stitches[id].type).join(" "));
      };
      expect(fitted.knitted.checks).toMatchObject({ neck: larger.checks.neck, "colour-11": larger.checks["colour-11"], raglan: larger.checks.raglan, body: 260, "sleeve-left:top": larger.checks["sleeve-left:top"] });
      expect(yokeOf(fitted.knitted).slice(-40)).toEqual(yokeOf(larger).slice(-40));
      // M1's cuff, in the knitter's stitches; and M1's lengths, in their rounds - within the yoke's couple of centimetres.
      expect(fitted.knitted.checks["sleeve-left:cuff"]).toBe(64);
      expect(Math.abs(pieceOf(fitted.knitted, "body") / 37 - pieceOf(published, "body") / 34)).toBeLessThan(1);
      expect(Math.abs(pieceOf(fitted.knitted, "sleeve-left") / 37 - pieceOf(published, "sleeve-left") / 34)).toBeLessThan(1);
      expect(fitted.finished).toMatchObject({ chestCm: 108, upperArmCm: 40, cuffCm: 20 });
      expect(Math.abs(fitted.finished.yokeDepthCm + fitted.finished.bodyLengthCm - m1.finished.yokeDepthCm - m1.finished.bodyLengthCm)).toBeLessThanOrEqual(0.5);
      expect(fitted.notes.join(" ")).toMatch(/The yoke is the pattern's size L, as written: at your tension its 260 stitches round the body come nearest M1's measurements\./);
      expect(fitted.notes.join(" ")).toMatch(/L's yoke has 11 bands of squares where M1's has 9, so it knits more colours: 1 to 11\./);
      expect(fitted.written).toMatch(/^Neck \(yoke\)\n {2}Cast on 118/m);
    });

    it("where only the rounds differ is the size's own yoke, its lengths in the knitter's rounds", () => {
      const published = buildSweater(pattern, "m1");
      const fitted = fit({ design: "paul-klee", sizeId: "m1", tension: { stitchesPer10cm: 22, roundsPer10cm: 30 } });
      expect(fitted.knitted.checks).toEqual(published.checks);
      expect(pieceOf(fitted.knitted, "body")).toBeLessThan(pieceOf(published, "body"));
      expect(fitted.notes[0]).toMatch(/no other size's counts come nearer than M1's own/);
      // Its yoke is as many rounds, which are now taller: deeper, and the body and sleeves as much shorter.
      expect(fitted.finished.yokeDepthCm).toBeGreaterThan(m1.finished.yokeDepthCm + 2);
      expect(fitted.notes.join(" ")).toMatch(/The yoke comes about [\d.]+cm deeper than M1's, and the body and the sleeves are as much shorter\./);
    });

    it("for every size at tensions either side of the pattern's: within a size's step of the chest asked for, or that no size has the stitches", () => {
      const said: string[] = [];
      let planned = 0;
      for (const size of pattern.sizes) {
        for (const tension of [{ stitchesPer10cm: 19, roundsPer10cm: 28 }, { stitchesPer10cm: 20.5, roundsPer10cm: 34 }, { stitchesPer10cm: 24, roundsPer10cm: 34 }, { stitchesPer10cm: 26, roundsPer10cm: 40 }]) {
          try {
            const fitted = fit({ design: "paul-klee", sizeId: size.id, tension });
            expect(fitted.knitted.roundPieces.at(-1)).toBe("sleeve-left");
            expect(Math.abs(fitted.finished.chestCm - size.finished.chestCm) / size.finished.chestCm, `${size.id} ${tension.stitchesPer10cm}`).toBeLessThan(0.045);
            expect(Math.abs(fitted.finished.yokeDepthCm + fitted.finished.bodyLengthCm - size.finished.yokeDepthCm - size.finished.bodyLengthCm), `${size.id} ${tension.stitchesPer10cm}`).toBeLessThanOrEqual(1);
            planned++;
          } catch (error) {
            said.push(`${size.id} ${tension.stitchesPer10cm}: ${(error as Error).message}`);
          }
        }
      }
      expect(said.every((one) => /no size of the pattern has the \d+ stitches round the body/.test(one)), said.join("\n")).toBe(true);
      expect(planned, said.join("\n")).toBeGreaterThan(54);
    }, 600000);
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
  }, 60000);

  it("and what it was when these were written", async () => {
    const whole = buildSweater(sweaterById("hamefarin")!, "m");
    expect([
      await named("hamefarin", "m"),
      await named("hamefarin", "m", { knitted: whole, round: cutAfter("hamefarin", whole, 1)! }),
      await named(once, "l", { option: "every" }),
      await named(once, "l", { option: "fewer" }),
    ]).toEqual(["38a1e1893ce0", "c85b2bd5451b", "db9c907bc563", "7a9bc7774f5e"]);
  }, 60000);

  /*
   * The shaped sampler's answer is its bodies' too: the table its increases
   * are placed by, and how they are placed. From the cast-on at a knitter's
   * own tension; from a year's end at another, which no earlier plan
   * explains, so planned from there; and from a year's end at the pattern's
   * own, which is the published size's own edition, counts and all - a
   * jumper recalculated back to its pattern is on its pattern again.
   */
  it("and for a yoke shaped to the body", async () => {
    const shaped = "wool-week-strips-once-oldest-shaped";
    const whole = buildSweater(sweaterById(shaped)!, "l");
    const first = cutAfter(shaped, whole, 1)!;
    expect([
      await named(shaped, "l", { tension: { stitchesPer10cm: 34, roundsPer10cm: 42 } }),
      await named(shaped, "l", { knitted: whole, round: first, tension: { stitchesPer10cm: 30, roundsPer10cm: 36 } }),
      await named(shaped, "l", { knitted: whole, round: first, tension: { stitchesPer10cm: 32, roundsPer10cm: 38 } }),
    ]).toEqual(["c1c29c6adecd", "f79a0885fb8d", (await asEdition(whole, shaped, "l")).edition]);
  }, 120000);

  it("for the designs planned only from the cast-on too", async () => {
    const tighter = { stitchesPer10cm: 29.5, roundsPer10cm: 35 };
    expect([
      await named("wool-week-strips-lined-oldest", "m", { tension: tighter }),
      await named("feline-raglan", "m", { tension: tighter }),
      await named("feline-yoke", "m", { tension: tighter }),
      await named("paul-klee", "m1", { tension: { stitchesPer10cm: 24.5, roundsPer10cm: 36 } }),
    ]).toEqual(["a0b09230e8fe", "550074b996a9", "45f34976ebd6", "148b674281c5"]);
  }, 600000);
});
