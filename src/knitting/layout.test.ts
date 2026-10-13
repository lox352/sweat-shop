import { describe, expect, it } from "vitest";
import { buildSweater } from "./engine";
import { layOut, layOutBanded } from "./layout";
import { testSweater } from "./test-sweater";
import { indexRounds } from "./progress";

const built = buildSweater(testSweater, "one");
const index = indexRounds(built.rounds, built.roundLabels, built.roundPieces, testSweater.pieces);
const pieceRounds = (id: string) => {
  const span = index.pieces.find((piece) => piece.id === id)!;
  return built.rounds.slice(span.first - 1, span.last);
};

describe("a piece laid out in bands", () => {
  const yoke = pieceRounds("yoke");
  const layout = layOutBanded(yoke);

  it("is as wide as its widest round, and a row a round", () => {
    expect(layout.columns).toBe(48);
    expect(layout.rounds).toBe(6);
  });

  it("centres every round, so a band's stitches stay side by side", () => {
    const columns = (round: number) => yoke[round].map((id) => layout.cells.get(id)!.column);
    // The neck: 24 stitches in the middle of 48, stitch 1 on the right.
    expect(columns(0)).toEqual(Array.from({ length: 24 }, (_, i) => 13 + i));
    // The band, side by side across the full width.
    expect(columns(4)).toEqual(Array.from({ length: 48 }, (_, i) => 1 + i));
  });

  it("numbers rounds within the piece, and stitches within their round", () => {
    const first = layout.cells.get(yoke[0][0])!;
    expect(first).toEqual({ round: 1, column: 13, index: 1 });
  });

  it("lays out a sleeve from its own pick-up round, narrowing at its decreases", () => {
    const sleeve = pieceRounds("sleeve-left");
    const laid = layOutBanded(sleeve);
    expect(laid.columns).toBe(12);
    expect(sleeve.map((round) => laid.cells.get(round[0])!.column)).toEqual([1, 1, 2, 2]);
  });
});

describe("a piece laid out by what each stitch was worked into", () => {
  it("anchors the widest round and scatters the narrow ones across it", () => {
    const yoke = pieceRounds("yoke");
    const layout = layOut(built.stitches, yoke);
    // Each neck stitch sits over every other column of the yoke above it.
    const neck = yoke[0].map((id) => layout.cells.get(id)!.column);
    expect(neck.slice(0, 3)).toEqual([1, 3, 5]);
  });
});
