import { describe, expect, it } from "vitest";
import { buildSweater } from "./engine";
import Needles, { beginning } from "./needles";
import { newBeginning, raglanLine, testSweater, testSweaterWithMarkers } from "./test-sweater";
import { topologyOf } from "../data/sweaters/settled/topology";
import { indexRounds, positionOf } from "./progress";
import { pose, distance } from "../physics/pose";
import { settle } from "../physics/solver";

const built = buildSweater(testSweaterWithMarkers(), "one");
const { stitches, knitting } = built;
const markers = stitches.filter((stitch) => stitch.type === "marker");
const roundsOf = (piece: string) => built.rounds.filter((_, index) => built.roundPieces[index] === piece);
const seamRoundsOf = (piece: string) => knitting.rounds.filter((_, index) => knitting.roundPieces[index] === piece);
const seamKindsOf = (piece: string) => knitting.roundKinds.filter((_, index) => knitting.roundPieces[index] === piece);
/** What a stitch was worked into. */
const below = (id: number) => stitches[id].links[0];

describe("markers on the needles", () => {
  it("are steps, each naming what it marks, placed and taken off where the pattern says", () => {
    expect(markers.map(({ marker, removed, begins }) => ({ marker, removed, begins }))).toEqual([
      { marker: raglanLine, removed: undefined, begins: undefined },
      { marker: raglanLine, removed: true, begins: undefined },
      { marker: newBeginning, removed: undefined, begins: true },
      // The old beginning comes off as the walk sets out from it.
      { marker: beginning, removed: true, begins: undefined },
    ]);
    // The raglan line a quarter of the way round the band's first round, after 12 of its 48.
    const band = built.rounds[built.roundLabels.findIndex((label) => label.startsWith("Band, row 1"))];
    expect(stitches[markers[0].id - 1].id).toBe(band[11]);
    expect(stitches[markers[0].id + 1].id).toBe(band[12]);
  });

  it("move the rounds' beginning to the right underarm after a walk of 10 of the body's 40", () => {
    const [divide, walk, ...rest] = roundsOf("body");
    expect(divide).toHaveLength(40);
    expect(walk).toHaveLength(10);
    // The walk knits the back's 8 and 2 of the 4 cast on at the right underarm, from the old beginning at the seam.
    expect(walk.map(below)).toEqual(divide.slice(0, 8).concat(divide.slice(8, 10)));
    expect(stitches[below(walk[8])].type).toBe("castOn");
    // Every round after it begins at the new beginning: over the third of the underarm's cast-on stitches.
    const first = rest[0][0];
    expect(below(first)).toBe(divide[10]);
    expect(rest.every((round) => round.length === 40)).toBe(true);
  });

  it("leave the rounds from the seam whole, cut at the seam, but for the last: part of a round, ending at the new beginning", () => {
    const rounds = seamRoundsOf("body");
    expect(rounds.map((round) => round.length)).toEqual([40, 40, 40, 40, 40, 10]);
    expect(seamKindsOf("body")).toEqual(["round", "round", "round", "round", "round", "part"]);
    // Each whole one after the first begins over the first stitch of the one before: at the seam.
    for (let k = 1; k < rounds.length; k++) expect(below(rounds[k][0])).toBe(rounds[k - 1][0]);
    // Every stitch of the body is in exactly one of them, in the order worked.
    expect(rounds.flat()).toEqual(roundsOf("body").flat());
  });

  it("change nothing about the fabric where none moves the beginning: the same rounds from the seam, the same key", () => {
    const pattern = structuredClone(testSweater);
    const band = pattern.sizes[0].sections[1].rounds.find((spec) => spec.type === "chart" && spec.chart === "band");
    if (band?.type !== "chart") throw new Error("no band");
    band.markers = [{ after: 12, place: raglanLine }];
    const divide = pattern.sizes[0].sections[2].rounds[0];
    if (divide.type !== "divide") throw new Error("no divide");
    divide.segments.splice(1, 0, { remove: raglanLine });
    const marked = buildSweater(pattern, "one");
    const plain = buildSweater(testSweater, "one");
    expect(marked.stitches).toHaveLength(plain.stitches.length + 2);
    expect(JSON.stringify(topologyOf(marked.knitting))).toBe(JSON.stringify(topologyOf(plain.knitting)));
  });

  it("are each a step the knitting panel asks for in turn", () => {
    const index = indexRounds(built.rounds, built.roundLabels, built.roundPieces, testSweaterWithMarkers().pieces, built.roundKinds);
    expect(markers.map((step) => positionOf(stitches, step.id - 1, index).markerNext)).toEqual([
      { marker: raglanLine },
      { marker: raglanLine, removed: true },
      { marker: newBeginning, begins: true },
      { marker: beginning, removed: true },
    ]);
  });

  it("are refused where a knitter could not place them", () => {
    const needles = () => new Needles().startPiece("yoke").castOn(8, "A", 2, 1.6, "cast on").join();
    // A new beginning only part way through a round.
    expect(() => needles().placeMarker("the new beginning", true)).toThrow();
    // No two markers for the same thing, and nothing taken off that was never placed.
    expect(() => needles().placeMarker("a band").placeMarker("a band")).toThrow();
    expect(() => needles().removeMarker("a band")).toThrow();
    // Short rows only from a beginning at the seam, and a new beginning knitted on to before the next round.
    const moved = needles().startRound("round", 2, 1.6);
    for (let i = 0; i < 3; i++) moved.knit("k1", "A");
    moved.placeMarker("the new beginning", true);
    for (let i = 0; i < 5; i++) moved.knit("k1", "A");
    moved.endRound();
    expect(() => moved.startRound("next", 2, 1.6)).toThrow();
    expect(() => moved.row("short row", 2, 1.6, "right", [0, 1], "A")).toThrow();
  });
});

describe("the physics of a sweater whose beginning moved", () => {
  it("stands the last part round over what it was worked into", () => {
    const { positions } = pose(knitting);
    const part = seamRoundsOf("body").at(-1)!;
    for (const id of part) {
      expect(distance(positions, id, below(id))).toBeLessThan(knitting.roundHeight * 1.5);
    }
  });

  it("settles it to rest", () => {
    const result = settle(knitting, pose(knitting));
    expect(result.rested).toBe(true);
    expect(result.positions.every(Number.isFinite)).toBe(true);
  });
});

