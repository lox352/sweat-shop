import { describe, expect, it } from "vitest";
import { buildSweater, type SweaterStitches } from "./engine";
import { layOut, mirrorLayout } from "./layout";
import { testSweater, testSweaterWithShortRows } from "./test-sweater";
import { indexRounds } from "./progress";
import { consumption } from "../types/StitchType";
import hamefarin from "../data/sweaters/hamefarin";

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
    return below !== undefined && below.column !== layout.cells.get(id)!.column;
  });

describe("a piece laid out by what each stitch was worked into", () => {
  const yoke = pieceRounds("yoke");
  const layout = layOut(built.stitches, yoke);
  const columns = (round: number) => yoke[round].map((id) => layout.cells.get(id)!.column);

  it("is as wide as its widest round, and a row a round", () => {
    expect(layout.columns).toBe(48);
    expect(layout.rounds).toBe(6);
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
    expect(layout.cells.get(yoke[0][0])).toEqual({ round: 1, column: 1, index: 1 });
    expect(layout.cells.get(yoke[0][1])).toEqual({ round: 1, column: 3, index: 2 });
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
    expect(layout.rounds).toBe(yoke.length);
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
    expect(over.rounds).toBe(layout.rounds);
  });

  it("comes back as it was when turned again", () => {
    expect(mirrorLayout(over)).toEqual(layout);
  });
});

describe("Hamefarin on the chart", () => {
  it("has a column for every stitch of every piece in every size, none sharing one", () => {
    const wrong: string[] = [];
    for (const size of hamefarin.sizes) {
      const knitting = buildSweater(hamefarin, size.id);
      for (const piece of hamefarin.pieces) {
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
  }, 60_000);
});
