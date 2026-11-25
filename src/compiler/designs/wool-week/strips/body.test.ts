import { describe, expect, it } from "vitest";
import { isStepKind } from "../../../../pattern/kinds";
import { sweaterById } from "../..";
import { buildSweater } from "../../../engine/engine";
import { bodyFor, LEAN, respread, SECTORS, Shaper, shaperFrom, uniform } from "./body";
import { measured } from "./design";
import { shaperOf, shortRowsOf } from "./knit";
import { gauge, planOf } from "./plan";

const shaped = sweaterById("wool-week-strips-once-oldest-shaped")!;
const once = sweaterById("wool-week-strips-once-oldest")!;
type Knitted = ReturnType<typeof buildSweater>;
/** A yoke's rounds, short rows left out: each stitch's kind. */
const yokeRounds = (knitted: Knitted): string[][] =>
  knitted.rounds.flatMap((ids, r) => (knitted.roundPieces[r] === "yoke" && knitted.roundKinds[r] === "round" ? [ids.map((id) => knitted.stitches[id].type).filter((type) => !isStepKind(type))] : []));

describe("where a stitch is round the neck", () => {
  it("a round with nothing made in it leaves every stitch where it was", () => {
    const B = uniform(40);
    expect(respread(B, new Array(40).fill(0))).toBe(B);
  });

  it("a made stitch pushes its neighbours aside, and the round still goes once round", () => {
    const made = new Array<number>(44).fill(0);
    for (const at of [5, 16, 27, 38]) made[at] = 1;
    const B = respread(uniform(40), made);
    expect(B).toHaveLength(45);
    expect(B[44] - B[0]).toBeCloseTo(1, 12);
    for (let i = 0; i < 44; i++) expect(B[i + 1]).toBeGreaterThan(B[i]);
    // Four made evenly round forty: every stitch has the same, near enough.
    for (let i = 0; i < 44; i++) expect((B[i + 1] - B[i]) * 44).toBeCloseTo(1, 1);
  });

  it("a round of the wrong count says so", () => {
    expect(() => respread(uniform(40), new Array(44).fill(0))).toThrow(/does not follow/);
  });
});

describe("a round's increases, placed for the bodies", () => {
  const setup = (neck: number) => ({ body: bodyFor(116), neck, roundsPerCm: gauge.rounds, shortRows: shortRowsOf(neck) });

  it("has a table for every size, the same either side: half the round, back to front", () => {
    for (const size of measured) {
      const body = bodyFor(size.finished.chestCm);
      expect(body.room.length).toBeGreaterThan(40);
      for (const row of body.room) {
        expect(row).toHaveLength(SECTORS / 2 + 1);
        for (const width of row) expect(width).toBeGreaterThan(0);
      }
    }
  });

  it("are as many as asked for, in order, no two together, and the same either side of the round's middle", () => {
    const shaper = new Shaper(setup(152));
    for (let r = 0; r < 10; r++) shaper.knitAt(152, []);
    let count = 152;
    for (const next of [216, 232, 233, 264, 300]) {
      const places = shaper.place(next);
      expect(places).toHaveLength(next - count);
      for (let k = 1; k < places.length; k++) expect(places[k] - places[k - 1]).toBeGreaterThan(1);
      const made = new Array<number>(next).fill(0);
      for (const at of places) made[at] = 1;
      // An odd one goes beside the middle of the front: but for it, the round reads the same from either end.
      if ((next - count) % 2 === 0 && count % 2 === 0) expect(made.join("")).toBe([...made].reverse().join(""));
      shaper.knitAt(next, places);
      count = next;
    }
  });

});

describe("Each Year Once, shaped", () => {
  for (const id of ["xs", "l", "4xl"]) {
    const size = shaped.sizes.find((one) => one.id === id)!;
    const knitted = buildSweater(shaped, id);
    const plain = buildSweater(once, id);

    it(`${id}: is Each Year Once round for round but for where its yoke's increases are`, () => {
      expect(knitted.checks).toEqual(plain.checks);
      expect(knitted.rounds.map((ids) => ids.length)).toEqual(plain.rounds.map((ids) => ids.length));
      expect(knitted.rounds.map((ids) => ids.map((id2) => knitted.stitches[id2].type).filter((type) => type === "m1").length)).toEqual(
        plain.rounds.map((ids) => ids.map((id2) => plain.stitches[id2].type).filter((type) => type === "m1").length),
      );
      // Below the yoke, the same stitch for stitch.
      const below = knitted.roundPieces.indexOf("body");
      expect(knitted.rounds.slice(below).map((ids) => ids.map((id2) => `${knitted.stitches[id2].type} ${knitted.stitches[id2].slot}`))).toEqual(
        plain.rounds.slice(below).map((ids) => ids.map((id2) => `${plain.stitches[id2].type} ${plain.stitches[id2].slot}`)),
      );
      expect(yokeRounds(knitted).map((round) => round.join(""))).not.toEqual(yokeRounds(plain).map((round) => round.join("")));
    }, 120000);

    it(`${id}: every round that increases between its bands' own doublings is the same either side of its middle`, () => {
      const [now, even] = [yokeRounds(knitted), yokeRounds(plain)];
      let placed = 0;
      now.forEach((round, r) => {
        if (!round.includes("m1") || round.join() === even[r].join()) return;
        placed++;
        expect(round.join(), `yoke round ${r + 1}`).toBe([...round].reverse().join());
      });
      expect(placed).toBeGreaterThan(6);
    }, 120000);

    it(`${id}: lies more evenly round its body than Each Year Once does, all the way down its yoke`, () => {
      const finished = measured.find((one) => one.id === id)!.finished;
      const neck = knitted.rounds[0].length;
      const setup = { body: bodyFor(finished.chestCm), neck, roundsPerCm: size.roundsPer10cm / 10, shortRows: shortRowsOf(neck) };
      const end = knitted.roundPieces.indexOf("body");
      for (const part of [0.5, 0.65, 0.8, 1]) {
        const round = Math.round(end * part);
        const [now, even] = [shaperFrom(knitted, round, setup).unevenness(), shaperFrom(plain, round, setup).unevenness()];
        expect(now, `at round ${round}`).toBeLessThan(even * 0.75);
      }
      // And at its foot, by half.
      expect(shaperFrom(knitted, end, setup).unevenness()).toBeLessThan(shaperFrom(plain, end, setup).unevenness() / 2);
    }, 120000);

    it(`${id}: no round's increases carry a stitch far round from where an even round would leave it`, () => {
      const [now, even] = [yokeRounds(knitted), yokeRounds(plain)];
      now.forEach((round, r) => {
        if (!round.includes("m1") || round.join() === even[r].join()) return;
        const made = round.filter((type) => type === "m1").length;
        const before = round.length - made;
        let [seen, new_, most] = [0, 0, 0];
        for (const type of round) {
          if (type === "m1") new_++;
          else seen++;
          most = Math.max(most, Math.abs(new_ - (made * seen) / before));
        }
        expect(most, `yoke round ${r + 1}`).toBeLessThanOrEqual(LEAN + 2);
      });
    }, 120000);

    it(`${id}: its increases are placed by its stitches alone - the yoke as it is planned and the yoke read back from its knitting are in the same place`, () => {
      const finished = measured.find((one) => one.id === id)!.finished;
      const body = bodyFor(finished.chestCm);
      const told = shaperOf(finished, planOf(finished, { kind: "refit" }).rows.yoke, body);
      const end = knitted.roundPieces.indexOf("body");
      const neck = knitted.rounds[0].length;
      const read = shaperFrom(knitted, end, { body, neck, roundsPerCm: size.roundsPer10cm / 10, shortRows: shortRowsOf(neck) });
      expect(Array.from(read.division())).toEqual(Array.from(told.division()));
      // And so they would put the next round's increases in the same places.
      expect(read.place(knitted.checks.yoke + 24)).toEqual(told.place(knitted.checks.yoke + 24));
    }, 120000);
  }
});
