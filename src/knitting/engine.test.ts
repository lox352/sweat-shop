import { describe, expect, it } from "vitest";
import { buildSweater, expand } from "./engine";
import { testSweater, testSweaterWithShortRows } from "./test-sweater";
import { isFabric, isStep } from "../types/Stitch";
import type { SweaterPattern } from "../data/sweaters/types";

const built = buildSweater(testSweater, "one");
const { stitches, rounds, roundPieces, roundLabels, checks } = built;
const byType = (type: string) => stitches.filter((stitch) => stitch.type === type);

describe("the test sweater, stitch by stitch", () => {
  it("leaves every count the pattern names", () => {
    expect(checks).toEqual(testSweater.sizes[0].checks);
  });

  it("knits its rounds in the order and the pieces the pattern gives", () => {
    expect(rounds.map((round) => round.length)).toEqual([
      24, 24, 24, // cast on, two rounds of rib
      48, 48, 48, // the increase, two rows of the band
      40, 40, 40, 40, 40, // the dividing round, three rounds, the bind-off
      12, 12, 10, 10, // the left sleeve
      12, 12, 10, 10, // and the right
    ]);
    expect(roundPieces).toEqual([
      ...Array(6).fill("yoke"),
      ...Array(5).fill("body"),
      ...Array(4).fill("sleeve-left"),
      ...Array(4).fill("sleeve-right"),
    ]);
    expect(roundLabels[0]).toBe("Neck · cast on");
    expect(roundLabels[4]).toBe("Band, row 1");
    expect(roundLabels[6]).toBe("Body · dividing round");
    expect(roundLabels[7]).toBe("Body · plain round");
    expect(roundLabels[11]).toBe("Left sleeve · pick-up round");
  });

  it("puts every stitch in exactly one round, and no step in any", () => {
    const seen = new Map<number, number>();
    rounds.flat().forEach((id) => seen.set(id, (seen.get(id) ?? 0) + 1));
    for (const stitch of stitches) {
      expect(seen.get(stitch.id) ?? 0, `stitch ${stitch.id}`).toBe(isFabric(stitch) ? 1 : 0);
    }
  });

  it("keeps the work in order: ids ascend through every round, and from piece to piece", () => {
    const flat = rounds.flat();
    expect([...flat].sort((a, b) => a - b)).toEqual(flat);
    stitches.forEach((stitch, index) => expect(stitch.id).toBe(index));
  });

  it("takes its steps where a knitter would", () => {
    const steps = stitches
      .filter(isStep)
      .map((stitch) => [stitch.type, stitch.holder ?? (stitch.type === "needles" ? stitch.needles : undefined)]);
    expect(steps).toEqual([
      ["join", undefined],
      ["needles", 3.25],
      ["hold", "sleeve-right"],
      ["hold", "sleeve-left"],
      ["resume", "sleeve-left"],
      ["resume", "sleeve-right"],
    ]);
    // The join comes straight after the last stitch cast on.
    expect(byType("join")[0].id).toBe(25);
  });

  it("closes the cast-on into a ring at the join", () => {
    expect(stitches[1].links).toEqual([24]);
    expect(stitches[2].links).toEqual([1]);
    // The phantom stitch 0 is nothing: no links, no round.
    expect(stitches[0].links).toEqual([]);
  });

  it("works every stitch into the one below, and makes increases out of nothing", () => {
    const increase = rounds[3];
    increase.forEach((id, index) => {
      const stitch = stitches[id];
      if (index % 2 === 0) {
        expect(stitch.type).toBe("k1");
        expect(stitch.links[0]).toBe(rounds[2][index / 2]);
      } else {
        expect(stitch.type).toBe("m1");
        expect(stitch.links).toEqual([increase[index - 1]]);
      }
    });
  });

  it("divides the yoke: knits the body's stitches, holds the sleeves', casts on the underarms", () => {
    const yoke = rounds[5];
    const divide = rounds[6];
    const worked = (id: number) => stitches[id].links[0];
    // Back, from the beginning of the round.
    expect(divide.slice(0, 8).map(worked)).toEqual(yoke.slice(0, 8));
    // The right underarm: cast on, each held by nothing but the stitch before.
    const right = divide.slice(8, 12);
    right.forEach((id) => expect(stitches[id].type).toBe("castOn"));
    expect(stitches[right[0]].links).toEqual([divide[7]]);
    // The front carries on after the right sleeve's eight held stitches.
    expect(divide.slice(12, 28).map(worked)).toEqual(yoke.slice(16, 32));
    // And the back's other half after the left sleeve's.
    expect(divide.slice(32).map(worked)).toEqual(yoke.slice(40));
  });

  it("begins each sleeve with new yarn, picking up its underarm the other way round", () => {
    const yoke = rounds[5];
    const divide = rounds[6];
    // The left sleeve: its underarm is the second the dividing round cast on.
    const top = rounds[11];
    const edge = divide.slice(28, 32);
    // The first stitch is picked up from the middle of the edge, with no yarn before it.
    expect(stitches[top[0]].type).toBe("pickUp");
    expect(stitches[top[0]].links).toEqual([]);
    expect(top.slice(0, 2).map((id) => stitches[id].from)).toEqual([edge[1], edge[0]]);
    // Then the held stitches, in the order they were held.
    expect(top.slice(2, 10).map((id) => stitches[id].links[0])).toEqual(yoke.slice(32, 40));
    // Then the rest of the edge, from its far end back to the middle.
    expect(top.slice(10).map((id) => stitches[id].from)).toEqual([edge[3], edge[2]]);
  });

  it("decreases a sleeve either side of its underarm, leaning each way", () => {
    const shaping = rounds[13];
    expect(shaping.map((id) => stitches[id].type)).toEqual([
      "k1", "k2tog", "k1", "k1", "k1", "k1", "k1", "k1", "ssk", "k1",
    ]);
  });

  it("binds off: the stitches are finished, and the next piece takes up its own", () => {
    for (const id of rounds[10]) expect(stitches[id].type).toBe("bindOff");
    expect(byType("bindOff")).toHaveLength(40 + 10 + 10);
  });

  it("puts every stitch on the needles it is worked on", () => {
    expect(stitches[1].needles).toBe(2.75);
    expect(stitches[rounds[2][0]].needles).toBe(2.75);
    expect(stitches[rounds[3][0]].needles).toBe(3.25);
    expect(built.needleChanges).toEqual([3]);
    // Each sleeve's held stitches are taken up onto the main needles.
    expect(byType("resume").map((stitch) => stitch.needles)).toEqual([3.25, 3.25]);
  });

  it("knits the rib narrower, as its fabric says", () => {
    expect(stitches[rounds[1][0]].width).toBeCloseTo(1.8);
    expect(stitches[rounds[3][0]].width).toBe(2);
    expect(stitches[rounds[3][0]].rise).toBeCloseTo(1.75);
  });
});

describe("what the engine will not knit", () => {
  const withSections = (change: (pattern: SweaterPattern) => void) => {
    const pattern = structuredClone(testSweater);
    change(pattern);
    return () => buildSweater(pattern, "one");
  };

  it("refuses a chart whose repeat does not go into the round", () => {
    expect(
      withSections((pattern) => {
        pattern.sizes[0].sections[0].rounds[0] = { type: "castOn", count: 26, slot: "A" };
      }),
    ).toThrow(/does not go into the 26 stitches/);
  });

  it("refuses a shaping round that leaves the wrong count", () => {
    expect(
      withSections((pattern) => {
        const round = pattern.sizes[0].sections[1].rounds[1];
        if (round.type === "shaping") round.to = 50;
      }),
    ).toThrow(/left 48 stitches, but the pattern says 50/);
  });

  it("refuses to finish with stitches still on hold", () => {
    expect(withSections((pattern) => pattern.sizes[0].sections.pop())).toThrow(
      /still on hold: sleeve-right/,
    );
  });

  it("refuses to pick up fewer than the edge has, leaving some of it out", () => {
    expect(
      withSections((pattern) => {
        const round = pattern.sizes[0].sections[3].rounds[0];
        if (round.type === "piece") round.after = 1;
      }),
    ).toThrow(/picks up 2 \+ 1 stitches from an edge of 4/);
  });
});

describe("shaping rounds", () => {
  it("expands a repeat against what is left on the needle", () => {
    expect(
      expand([{ work: "k", times: 1 }, { repeat: [{ work: "m1" }, { work: "k", times: 2 }], untilRemaining: 1 }, { work: "k", times: 1 }], 6),
    ).toEqual(["k1", "m1", "k1", "k1", "m1", "k1", "k1", "k1"]);
  });
});

describe("short rows across the back of the neck", () => {
  const built = buildSweater(testSweaterWithShortRows(), "one");
  const { stitches, rounds, roundKinds, roundLabels } = built;
  const rows = rounds.slice(3, 8);
  const rib = rounds[2];
  // Where each stitch sits on the ring: by the stitch below it, all the way down to the rib.
  const placeOf = (id: number): number => {
    const index = rib.indexOf(id);
    return index >= 0 ? index : placeOf(stitches[id].links[0]);
  };

  it("works two pairs of rows, each reaching further, then on to the end of the round", () => {
    expect(rows.map((row) => row.length)).toEqual([4, 7, 9, 11, 5]);
    expect(roundKinds.slice(3, 8)).toEqual(["right", "wrong", "right", "wrong", "right"]);
    expect(roundLabels[3]).toBe("Yoke · short row 1, right side");
    expect(roundLabels[7]).toBe("Yoke · short rows, to the end of the round");
    // And the round after them is a whole one again.
    expect(roundKinds[8]).toBe("round");
    expect(rounds[8].length).toBe(48);
  });

  it("turns at the end of every row but the last, as a step", () => {
    const turns = stitches.filter((stitch) => stitch.type === "turn");
    expect(turns).toHaveLength(4);
    rows.slice(0, 4).forEach((row, index) => expect(turns[index].id).toBe(row[row.length - 1] + 1));
  });

  it("knits each row into the stitches at its places, past the middle of the back each way", () => {
    expect(rows.map((row) => row.map(placeOf))).toEqual([
      [0, 1, 2, 3],
      [2, 1, 0, 23, 22, 21, 20],
      [21, 22, 23, 0, 1, 2, 3, 4, 5],
      [4, 3, 2, 1, 0, 23, 22, 21, 20, 19, 18],
      [19, 20, 21, 22, 23],
    ]);
    // Row 3 reaches the double stitch row 1 turned at, and works it as one.
    const third = rows[2];
    expect(stitches[third[6]].links[0]).toBe(rows[0][3]);
  });

  it("purls the wrong side's rows, which the right side sees as knits", () => {
    for (const id of rows[1]) {
      expect(stitches[id].type).toBe("k1");
      expect(stitches[id].wrongSide).toBe(true);
    }
    expect(stitches[rows[2][0]].wrongSide).toBeUndefined();
  });

  it("raises the back: rows over the middle of the back, none over the front", () => {
    const rowsOver = (place: number) => rows.filter((row) => row.some((id) => placeOf(id) === place)).length;
    expect(rowsOver(0)).toBe(4);
    expect(rowsOver(12)).toBe(0);
  });
});
