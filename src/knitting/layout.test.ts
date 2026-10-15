import { describe, expect, it } from "vitest";
import { buildSweater, type SweaterStitches } from "./engine";
import { chartRows, layOut, layOutSweater, mirrorLayout } from "./layout";
import { testBandedSweater, testSweater, testSweaterWithShortRows } from "./test-sweater";
import { indexRounds } from "./progress";
import { consumption, makesTwo } from "../types/StitchType";
import type { Stitch } from "../types/Stitch";
import { sweaters } from "../data/sweaters";

const built = buildSweater(testSweater, "one");
const index = indexRounds(built.rounds, built.roundLabels, built.roundPieces, testSweater.pieces);
const pieceRounds = (id: string) => {
  const span = index.pieces.find((piece) => piece.id === id)!;
  return built.rounds.slice(span.first - 1, span.last);
};

/** Every stitch worked one for one into a stitch on the chart, against that stitch's column. */
const offTheirStitch = (knitting: SweaterStitches, rounds: number[][], layout: ReturnType<typeof layOut>) =>
  rounds.flat().filter((id) => {
    const stitch = knitting.stitches[id];
    if (consumption[stitch.type] !== 1) return false;
    const below = layout.cells.get(stitch.links[0]);
    /*
     * A KFB's mirror, a KBF makes its new stitch on its right, so of its two
     * loops the left-hand one stands over the stitch below: worked from the
     * right side its second, the stitch after it, and on a PFB purled back,
     * which is stored as the KBF it looks like, its first.
     */
    const standing = stitch.type === "kbf" && !stitch.wrongSide ? id + 1 : id;
    return below !== undefined && below.column !== layout.cells.get(standing)!.column;
  });

describe("a piece laid out by what each stitch was worked into", () => {
  const yoke = pieceRounds("yoke");
  const layout = layOut(built.stitches, yoke);
  const columns = (round: number) => yoke[round].map((id) => layout.cells.get(id)!.column);

  it("is as wide as its widest round, and a row a round", () => {
    expect(layout.columns).toBe(48);
    expect(layout.rows).toBe(6);
  });

  it("stands every stitch over the stitch it was worked into, so a column is a column of the knitting", () => {
    expect(offTheirStitch(built, yoke, layout)).toEqual([]);
  });

  it("anchors the widest round, a column a stitch, and scatters the neck across it", () => {
    expect(columns(5)).toEqual(Array.from({ length: 48 }, (_, i) => 1 + i));
    // Each neck stitch under every other column of the yoke above it, stitch 1 on the right.
    expect(columns(0)).toEqual(Array.from({ length: 24 }, (_, i) => 1 + 2 * i));
  });

  it("leaves the column under a make-one empty", () => {
    const increases = yoke[3].filter((id) => built.stitches[id].type === "m1");
    expect(increases).toHaveLength(24);
    const below = new Set(columns(2));
    increases.forEach((id) => expect(below.has(layout.cells.get(id)!.column)).toBe(false));
  });

  it("numbers rounds within the piece, and stitches within their round", () => {
    expect(layout.cells.get(yoke[0][0])).toEqual({ row: 1, round: 1, column: 1, index: 1, piece: "yoke" });
    expect(layout.cells.get(yoke[0][1])).toEqual({ row: 1, round: 1, column: 3, index: 2, piece: "yoke" });
  });

  it("lays out a sleeve from its own pick-up round, its decreases leaving their columns empty above", () => {
    const sleeve = pieceRounds("sleeve-left");
    const laid = layOut(built.stitches, sleeve);
    expect(laid.columns).toBe(12);
    expect(offTheirStitch(built, sleeve, laid)).toEqual([]);
    const shaped = sleeve[2].map((id) => laid.cells.get(id)!.column);
    // k1, then a k2tog standing on the right of its two, ..., an ssk on the left of its two, k1.
    expect(shaped).toEqual([1, 2, 4, 5, 6, 7, 8, 9, 11, 12]);
    expect(built.stitches[sleeve[2][1]].type).toBe("k2tog");
    expect(built.stitches[sleeve[2][8]].type).toBe("ssk");
    expect(sleeve[3].map((id) => laid.cells.get(id)!.column)).toEqual(shaped);
  });

  it("lays out the body from the round that divides it from the sleeves, underarms and all", () => {
    const body = pieceRounds("body");
    const laid = layOut(built.stitches, body);
    expect(laid.columns).toBe(40);
    expect(body[0].map((id) => laid.cells.get(id)!.column)).toEqual(Array.from({ length: 40 }, (_, i) => 1 + i));
    expect(offTheirStitch(built, body, laid)).toEqual([]);
  });
});

describe("short rows on the chart", () => {
  const knitting = buildSweater(testSweaterWithShortRows(), "one");
  const indices = knitting.rounds.map((_, i) => i).filter((i) => knitting.roundPieces[i] === "yoke");
  const yoke = indices.map((i) => knitting.rounds[i]);
  const kinds = indices.map((i) => knitting.roundKinds[i]);
  const layout = layOut(knitting.stitches, yoke, kinds);

  it("stands every stitch of a short row over the stitch it was worked into", () => {
    expect(offTheirStitch(knitting, yoke, layout)).toEqual([]);
  });

  it("takes up no width of its own, a row of the chart each", () => {
    expect(layout.columns).toBe(48);
    expect(layout.rows).toBe(yoke.length);
  });

  it("works the rows back the other way across the chart, round the back of the neck", () => {
    const row = (at: number) => yoke[at].map((id) => layout.cells.get(id)!.column);
    expect(kinds.slice(3, 8)).toEqual(["right", "wrong", "right", "wrong", "right"]);
    // Leftwards past the middle of the back, then back rightwards and on round the far end.
    expect(row(3)).toEqual([1, 3, 5, 7]);
    expect(row(4)).toEqual([5, 3, 1, 47, 45, 43, 41]);
  });
});

describe("the chart turned over", () => {
  const yoke = pieceRounds("yoke");
  const layout = layOut(built.stitches, yoke);
  const over = mirrorLayout(layout);

  it("swaps left for right, each stitch keeping its round and its number", () => {
    for (const id of yoke.flat()) {
      const [here, there] = [layout.cells.get(id)!, over.cells.get(id)!];
      expect(there).toEqual({ ...here, column: layout.columns + 1 - here.column });
    }
    expect(over.columns).toBe(layout.columns);
    expect(over.rows).toBe(layout.rows);
  });

  it("comes back as it was when turned again", () => {
    expect(mirrorLayout(over)).toEqual(layout);
  });
});

describe("the whole sweater on one chart", () => {
  const layout = layOutSweater(built.stitches, built.rounds, built.roundKinds, built.roundPieces);
  const columnsOf = (piece: string, k: number) => {
    const span = index.pieces.find((one) => one.id === piece)!;
    return built.rounds[span.first - 1 + k].map((id) => layout.cells.get(id)!.column);
  };
  const run = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

  it("lets in a column for every stitch the body casts on and each sleeve picks up", () => {
    // The yoke's 48, the body's 4 cast on at each underarm, and each sleeve's 2 picked up either side.
    expect(layout.columns).toBe(48 + 2 * 4 + 2 * (2 + 2));
  });

  it("stands the body over the back and front it was knitted from, its underarms after each sleeve", () => {
    expect(columnsOf("body", 0)).toEqual([...run(1, 8), ...run(21, 24), ...run(25, 40), ...run(53, 56), ...run(57, 64)]);
  });

  it("stands each sleeve over its held stitches, between the stitches it picks up", () => {
    expect(columnsOf("sleeve-right", 0)).toEqual([9, 10, ...run(11, 18), 19, 20]);
    expect(columnsOf("sleeve-left", 0)).toEqual([41, 42, ...run(43, 50), 51, 52]);
  });

  it("leaves the columns let in empty all the way down the yoke", () => {
    expect(columnsOf("yoke", 5)).toEqual([...run(1, 8), ...run(11, 18), ...run(25, 40), ...run(43, 50), ...run(57, 64)]);
  });

  it("gives each piece's rounds above the divide the same rows, counted on from the yoke's", () => {
    const rowOf = (piece: string, k: number) => {
      const span = index.pieces.find((one) => one.id === piece)!;
      return layout.roundRows[span.first - 1 + k];
    };
    for (const piece of ["body", "sleeve-left", "sleeve-right"]) {
      expect(rowOf(piece, 0)).toBe(7);
      expect(rowOf(piece, 3)).toBe(10);
    }
    expect(layout.rows).toBe(6 + 5);
    expect(layout.roundRows).toEqual(chartRows(built.roundPieces));
    expect(chartRows(built.roundPieces)).toEqual([...run(1, 11), ...run(7, 10), ...run(7, 10)]);
  });

  it("keeps every stitch over the stitch it was worked into, no two in one place", () => {
    expect(offTheirStitch(built, built.rounds, layout)).toEqual([]);
    const places = [...layout.cells.values()].map((at) => `${at.row}|${at.column}`);
    expect(new Set(places).size).toBe(places.length);
  });
});

describe.each(sweaters.map((sweater) => [sweater.name, sweater] as const))("%s on the chart", (_, design) => {
  it("has a column for every stitch of every piece in every size, none sharing one", () => {
    const wrong: string[] = [];
    for (const size of design.sizes) {
      const knitting = buildSweater(design, size.id);
      for (const piece of design.pieces) {
        const indices = knitting.rounds.map((_, i) => i).filter((i) => knitting.roundPieces[i] === piece.id);
        const rounds = indices.map((i) => knitting.rounds[i]);
        const laid = layOut(knitting.stitches, rounds, indices.map((i) => knitting.roundKinds[i]));
        const where = `${size.id} ${piece.id}`;
        if (offTheirStitch(knitting, rounds, laid).length > 0) wrong.push(`${where}: off the stitch below`);
        rounds.forEach((round, at) => {
          const columns = round.map((id) => laid.cells.get(id)!.column);
          if (new Set(columns).size !== columns.length) wrong.push(`${where}, round ${at + 1}: shares a column`);
          if (columns.some((column) => column < 1 || column > laid.columns)) wrong.push(`${where}, round ${at + 1}: off the chart`);
        });
      }
    }
    expect(wrong).toEqual([]);
  }, 180_000);

  it("lays every size out whole, with nothing in another stitch's place", () => {
    const wrong: string[] = [];
    for (const size of design.sizes) {
      const knitting = buildSweater(design, size.id);
      const laid = layOutSweater(knitting.stitches, knitting.rounds, knitting.roundKinds, knitting.roundPieces);
      if (offTheirStitch(knitting, knitting.rounds, laid).length > 0) wrong.push(`${size.id}: off the stitch below`);
      // An increase's second loop past its first, the way its row runs: leftwards, or rightwards for a row worked back.
      for (const id of knitting.rounds.flat()) {
        const stitch = knitting.stitches[id];
        if (!makesTwo(stitch.type)) continue;
        const [first, second] = [laid.cells.get(id)!.column, laid.cells.get(id + 1)!.column];
        if (Math.sign(second - first) !== (stitch.wrongSide ? -1 : 1)) wrong.push(`${size.id}: stitch ${id}'s second loop on the wrong side of it`);
      }
      const places = new Set<string>();
      laid.cells.forEach((at) => {
        const place = `${at.row}|${at.column}`;
        if (places.has(place)) wrong.push(`${size.id}: row ${at.row} column ${at.column} twice`);
        places.add(place);
        if (at.column < 1 || at.column > laid.columns) wrong.push(`${size.id}: off the chart`);
      });
    }
    expect(wrong).toEqual([]);
  }, 180_000);
});

describe("a yoke of bands and raglan increases, on the chart", () => {
  const knitting = buildSweater(testBandedSweater, "one");
  const laid = layOutSweater(knitting.stitches, knitting.rounds, knitting.roundKinds, knitting.roundPieces);

  it("keeps every stitch over the stitch it was worked into, no two in one place", () => {
    expect(offTheirStitch(knitting, knitting.rounds, laid)).toEqual([]);
    const places = [...laid.cells.values()].map((at) => `${at.row}|${at.column}`);
    expect(new Set(places).size).toBe(places.length);
    expect(laid.cells.size).toBe(knitting.rounds.flat().length);
  });

  it("puts a KBF's new stitch to its right and a KFB's to its left, away from the raglan line between them", () => {
    const at = knitting.roundLabels.lastIndexOf("Yoke · shaping round");
    const round = knitting.rounds[at];
    const column = (id: number) => laid.cells.get(id)!.column;
    const below = (id: number) => knitting.stitches[id].links[0];
    let pairs = 0;
    round.forEach((id, index) => {
      const type = knitting.stitches[id].type;
      if (type !== "kbf" && type !== "kfb") return;
      pairs++;
      const loop = round[index + 1];
      // Column 1 is at the right: a KBF's first loop stands one column right of its second, which is over the stitch below.
      if (type === "kbf") {
        expect(column(loop)).toBe(column(below(id)));
        expect(column(id)).toBe(column(loop) - 1);
      } else {
        expect(column(id)).toBe(column(below(id)));
        expect(column(loop)).toBe(column(id) + 1);
      }
    });
    expect(pairs).toBe(8);
  });

  it("lays a PFB purled back across a short row out as the KBF it looks like from the right side", () => {
    const at = knitting.roundLabels.indexOf("Yoke · short row 4, wrong side");
    const increases = knitting.rounds[at].filter((id) => knitting.stitches[id].type === "kbf");
    expect(increases).toHaveLength(1);
    for (const id of increases) {
      const column = (one: number) => laid.cells.get(one)!.column;
      // Its first loop over the stitch below, and its second, worked after it from the wrong side, to its right.
      expect(column(id)).toBe(column(knitting.stitches[id].links[0]));
      expect(column(id + 1)).toBeLessThan(column(id));
    }
  });
});

describe("an increase on a row worked back, either side of the widest round", () => {
  const stitch = (id: number, type: Stitch["type"], links: number[], wrongSide = false): Stitch => ({
    id, type, links, slot: "MC", piece: "yoke", ...(wrongSide ? { wrongSide: true } : {}),
  });
  // A PFB, stored as the KBF it is from the right side, and its second loop, both worked into stitch 1.
  const pfb = (id: number) => [stitch(id, "kbf", [1], true), stitch(id + 1, "m1", [1], true)];

  it("stands its first loop over the stitch below and its second to its right, laid out up from the widest round", () => {
    const stitches = [0, 1, 2, 3, 4, 5].map((id) => stitch(id, "castOn", [])).concat([stitch(6, "k1", [2], true), ...pfb(7)]);
    const laid = layOut(stitches, [[0, 1, 2, 3, 4, 5], [6, 7, 8]], ["round", "wrong"]);
    const column = (id: number) => laid.cells.get(id)!.column;
    expect(column(7)).toBe(column(1));
    expect(column(8)).toBe(column(7) - 1);
    expect(column(6)).toBe(column(7) + 1);
  });

  it("and the same laid out down from it", () => {
    const stitches = [0, 1, 2].map((id) => stitch(id, "castOn", [])).concat([stitch(3, "k1", [2], true), ...pfb(4), stitch(6, "k1", [0], true)]);
    const laid = layOut(stitches, [[0, 1, 2], [3, 4, 5, 6]], ["round", "wrong"]);
    const column = (id: number) => laid.cells.get(id)!.column;
    expect(column(4)).toBe(column(1));
    expect(column(5)).toBe(column(4) - 1);
  });
});
