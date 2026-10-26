import { describe, expect, it } from "vitest";
import { type SweaterStitches, buildSweater } from "./engine";
import { testSweater, testSweaterDivided } from "./test-sweater";
import { seamLayout } from "./useSweater";
import { beginningAt, viewFor } from "./view";
import { type ChartView, chartViews, layOutView, markersInView, viewFollowedAt, viewsFollowed } from "./views";
import { isFabric } from "../types/Stitch";
import { consumption } from "../types/StitchType";
import { sweaters } from "../data/sweaters";

const built = buildSweater(testSweater, "one");
const views = chartViews(built, testSweater.pieces);
const byId = (id: string) => views.find((view) => view.id === id)!;
const [right, left] = built.holds;
const ofPiece = (piece: string) => built.stitches.filter((stitch) => isFabric(stitch) && stitch.piece === piece).map((stitch) => stitch.id);
const edges = new Set(built.holds.flatMap((held) => held.edge ?? []));
const body = ofPiece("body").filter((id) => !edges.has(id));
const sleeve = (piece: string) => ofPiece(piece);
const every = (ids: number[], view: ChartView) => ids.every((id) => view.members.has(id));
const none = (ids: number[], view: ChartView) => ids.every((id) => !view.members.has(id));

describe("the chart's views", () => {
  it("are four for a sweater with two sleeves held: the neck's, the body's and one a sleeve, and a stage on the way to the body's between the two holds", () => {
    expect(views.map((view) => [view.kind, view.label, view.stageOf])).toEqual([
      ["neck", "From the neck", undefined],
      ["remaining", "Body", "remaining-" + left.heldAt],
      ["remaining", "Body", undefined],
      ["held", "Right sleeve", undefined],
      ["held", "Left sleeve", undefined],
    ]);
  });

  it("from the neck: the yoke, and the body and sleeves above it but for the underarms", () => {
    const neck = byId("neck");
    expect(every(ofPiece("yoke"), neck)).toBe(true);
    expect(none([...edges], neck)).toBe(true);
    // Nothing picked up out of an underarm, nor knitted on from one.
    for (const id of neck.members) {
      const stitch = built.stitches[id];
      expect(stitch.type).not.toBe("pickUp");
      if (stitch.type !== "castOn") expect(stitch.links.slice(0, consumption[stitch.type]).some((below) => edges.has(below))).toBe(false);
    }
    expect(body.some((id) => neck.members.has(id))).toBe(true);
    expect(sleeve("sleeve-left").some((id) => neck.members.has(id))).toBe(true);
  });

  it("between the two holds: what is left on the needles - the body, its first underarm and the second sleeve - over the yoke but for the first sleeve", () => {
    const view = byId("remaining-" + right.heldAt);
    // The first sleeve's held stitches and all that is knitted from them are gone from it.
    expect(none([...right.stitches, ...sleeve("sleeve-right")], view)).toBe(true);
    // And the yoke's stitches below them that nothing else was worked out of: the stitches each is knitted into, as far down as they are its alone.
    const neck = byId("neck");
    const below = (id: number) => built.stitches[id].links.slice(0, consumption[built.stitches[id].type]);
    const theirs = right.stitches.flatMap(below).filter((id) => !view.members.has(id));
    expect(theirs.length).toBeGreaterThan(0);
    for (const id of theirs) expect(neck.members.has(id)).toBe(true);
    // The second sleeve's stitches are still on the needles, so they stay, and the sleeve knitted from them.
    expect(every(left.stitches, view)).toBe(true);
    expect(sleeve("sleeve-left").some((id) => view.members.has(id))).toBe(true);
    // The first underarm is cast on, and the body knitted from it; the second is not yet.
    expect(every(right.edge!, view)).toBe(true);
    expect(none(left.edge!, view)).toBe(true);
    // Nothing picked up out of an underarm.
    for (const id of view.members) expect(built.stitches[id].type).not.toBe("pickUp");
  });

  it("the body's, once the last sleeve is held: both underarms and the whole body, over the yoke but for the sleeves' stitches", () => {
    const view = byId("remaining-" + left.heldAt);
    expect(every([...edges], view)).toBe(true);
    expect(every(body, view)).toBe(true);
    expect(none([...right.stitches, ...left.stitches], view)).toBe(true);
    expect(none([...sleeve("sleeve-left"), ...sleeve("sleeve-right")], view)).toBe(true);
    // The dividing round, but for the held stitches, generates it.
    expect(view.generator).toContain(right.edge![0]);
  });

  it("a sleeve's: its held stitches, its underarm reversed after them, and the whole sleeve - none of the body", () => {
    for (const held of built.holds) {
      const view = byId("held-" + held.holder);
      expect(view.generator).toEqual([...held.stitches, ...[...held.edge!].reverse()]);
      expect(every(sleeve(held.holder), view)).toBe(true);
      expect(none(body, view)).toBe(true);
      const other = built.holds.find((one) => one !== held)!;
      expect(none([...other.stitches, ...other.edge!, ...sleeve(other.holder)], view)).toBe(true);
    }
  });

  it("are followed as the needles change: to what is left on them as each sleeve goes on hold, to a sleeve as it is taken up again", () => {
    const at = viewsFollowed(views, built);
    const name = (id: number) => views[at[id]].label;
    const which = (id: number) => views[at[id]].id;
    expect(name(right.stitches[0])).toBe("From the neck");
    // The hold itself is in the view before it: until it is done, the stitches are still on the needles.
    expect(which(right.heldAt)).toBe("neck");
    expect(which(right.heldAt + 1)).toBe("remaining-" + right.heldAt);
    expect(which(right.edge![0])).toBe("remaining-" + right.heldAt);
    expect(which(left.heldAt)).toBe("remaining-" + right.heldAt);
    expect(which(left.edge![0])).toBe("remaining-" + left.heldAt);
    expect(name(body[body.length - 1])).toBe("Body");
    const firstPickUp = (holder: string) => built.stitches.find((stitch) => stitch.type === "pickUp" && stitch.piece === holder)!.id;
    expect(name(firstPickUp("sleeve-left"))).toBe("Left sleeve");
    expect(name(firstPickUp("sleeve-left") - 1)).toBe("Body");
    expect(name(firstPickUp("sleeve-right"))).toBe("Right sleeve");
    const last = sleeve("sleeve-right").at(-1)!;
    expect(name(last)).toBe("Right sleeve");
    // The knitting is in the view of the stitch it is about to work.
    expect(views[viewFollowedAt(views, built, right.edge![0] - 1)].id).toBe("remaining-" + right.heldAt);
  });

  it("never wait on what comes after: worked out from the stitches so far, each view's stitches as made so far are the same", () => {
    const at = viewsFollowed(views, built);
    const cuts = [right.heldAt, right.edge![1], left.heldAt + 3, left.resumedAt! + 2, right.resumedAt! + 5, built.stitches.length - 1];
    for (const cut of cuts) {
      const stitches = built.stitches.slice(0, cut + 1);
      const sofar = {
        stitches,
        holds: built.holds
          .filter((held) => held.heldAt <= cut)
          .map((held) => ({ ...held, edge: held.edge?.filter((id) => id <= cut), resumedAt: undefined })),
        knitting: {
          rounds: built.knitting.rounds.map((round) => round.filter((id) => id <= cut)).filter((round) => round.length > 0),
          roundPieces: built.knitting.roundPieces,
        },
      };
      const partial = chartViews(sofar, testSweater.pieces);
      expect(partial.map((view) => view.id)).toEqual(views.filter((view) => view.createdAt <= cut).map((view) => view.id));
      partial.forEach((view) => {
        const whole = byId(view.id);
        for (const id of view.members) expect(whole.members.has(id)).toBe(true);
      });
      const followed = viewsFollowed(partial, sofar);
      for (let id = 0; id <= cut; id++) expect(partial[followed[id]].id).toBe(views[at[id]].id);
    }
  });
});

describe("a sleeve held a part at a time", () => {
  // The right sleeve's eight held four and four, half its underarm cast on after each.
  const one = buildSweater(
    testSweaterDivided([
      { work: 8 },
      { hold: "sleeve-right", count: 4, castOn: 2 },
      { hold: "sleeve-right", count: 4, castOn: 2 },
      { work: 16 },
      { hold: "sleeve-left", count: 8, castOn: 4 },
      { work: 8 },
    ]),
    "one",
  );
  const all = chartViews(one, testSweater.pieces);
  const [right, left] = one.holds;
  const [first, second] = right.parts;

  it("has a stage after each part, the last of them the body's", () => {
    expect(all.map((view) => [view.id, view.stageOf])).toEqual([
      ["neck", undefined],
      ["remaining-" + first.at, "remaining-" + left.heldAt],
      ["remaining-" + second.at, "remaining-" + left.heldAt],
      ["remaining-" + left.heldAt, undefined],
      ["held-sleeve-right", undefined],
      ["held-sleeve-left", undefined],
    ]);
  });

  it("with some of the sleeve on hold, the rest of it is still on the chart, and its half of the underarm", () => {
    const stage = all.find((view) => view.id === "remaining-" + first.at)!;
    expect(first.stitches.some((id) => stage.members.has(id))).toBe(false);
    expect(second.stitches.every((id) => stage.members.has(id))).toBe(true);
    expect(right.edge!.slice(0, 2).every((id) => stage.members.has(id))).toBe(true);
    expect(right.edge!.slice(2).some((id) => stage.members.has(id))).toBe(false);
    // The next part's stage has the whole sleeve gone, and the whole underarm.
    const next = all.find((view) => view.id === "remaining-" + second.at)!;
    expect(right.stitches.some((id) => next.members.has(id))).toBe(false);
    expect(right.edge!.every((id) => next.members.has(id))).toBe(true);
  });

  it("is followed part by part, and the sleeve's view is its whole block", () => {
    const at = viewsFollowed(all, one);
    expect(all[at[first.at + 1]].id).toBe("remaining-" + first.at);
    expect(all[at[second.at + 1]].id).toBe("remaining-" + second.at);
    expect(all[at[left.heldAt + 1]].id).toBe("remaining-" + left.heldAt);
    const sleeve = all.find((view) => view.id === "held-sleeve-right")!;
    expect(sleeve.generator.slice(0, 8)).toEqual(right.stitches);
    checkLayouts(one, all);
  });
});

/** The whole dividing round, everything it was worked out of and everything worked out of it, but nothing picked up. */
const roundFamily = ({ stitches, holds, knitting }: SweaterStitches): Set<number> => {
  const roundOf = new Map<number, number>();
  knitting.rounds.forEach((round, index) => round.forEach((id) => roundOf.set(id, index)));
  let after = holds[0].heldAt + 1;
  while (!isFabric(stitches[after])) after++;
  const row = knitting.rounds[roundOf.get(after)!].filter((id) => isFabric(stitches[id]));
  const into = (id: number) => stitches[id].links.slice(0, consumption[stitches[id].type]);
  const out = new Set(row);
  for (let id = row[0]; id < stitches.length; id++) {
    const stitch = stitches[id];
    if (out.has(id) || !isFabric(stitch) || stitch.type === "pickUp") continue;
    const beside = stitch.type === "m1" ? stitch.links[stitch.links.length - 1] : undefined;
    if ((beside !== undefined && out.has(beside)) || into(id).some((below) => out.has(below))) out.add(id);
  }
  const waiting = [...row];
  while (waiting.length > 0) {
    for (const below of into(waiting.pop()!)) {
      if (out.has(below) || !isFabric(stitches[below])) continue;
      out.add(below);
      waiting.push(below);
    }
  }
  return out;
};
const sameAs = (a: Set<number>, b: Set<number>) => a.size === b.size && [...a].every((id) => b.has(id));

/** Every view's chart for a sweater, and the checks every one of them must pass. */
const checkLayouts = (sweater: SweaterStitches, all: ChartView[], beginning?: number) => {
  const layout = viewFor(sweater, () => seamLayout(sweater), beginning).layout;
  for (const view of all) {
    const held = sweater.holds.find((one) => view.kind === "held" && one.holder === view.holder);
    const { layout: laid } = layOutView(view, layout, sweater, held?.edge);
    const taken = new Map<string, number>();
    for (const [id, cell] of laid.cells) {
      if (!view.members.has(id)) throw new Error(`${view.id}: stitch ${id} is not in the view`);
      if (cell.column < 1 || cell.column >= laid.columns + 1) throw new Error(`${view.id}: stitch ${id} in column ${cell.column}`);
      const key = `${cell.row}:${cell.column}`;
      if (taken.has(key)) throw new Error(`${view.id}: stitches ${taken.get(key)} and ${id} share ${key}`);
      taken.set(key, id);
    }
    // Every column has a stitch in it.
    const used = new Set([...laid.cells.values()].map((cell) => Math.floor(cell.column)));
    expect(used.size).toBe(laid.columns);
    if (held) {
      // Each stitch picked up out of the underarm stands over a stitch of it, in the row above.
      const edge = new Set(held.edge);
      for (const id of view.members) {
        const stitch = sweater.stitches[id];
        if (stitch.type !== "pickUp" || stitch.from === undefined) continue;
        const under = laid.cells.get(stitch.from)!;
        const cell = laid.cells.get(id)!;
        if (!edge.has(stitch.from) || cell.row !== under.row + 1) throw new Error(`${view.id}: ${id} is not picked up from the row below`);
      }
      const over = new Map<number, number[]>();
      for (const id of view.members) {
        const from = sweater.stitches[id].from;
        if (from !== undefined) over.set(from, [...(over.get(from) ?? []), laid.cells.get(id)!.column]);
      }
      for (const id of held.edge ?? []) expect(over.get(id)).toContain(laid.cells.get(id)!.column);
      // The piece's round begins at the right-hand edge.
      const first = [...view.members].sort((a, b) => a - b).find((id) => sweater.stitches[id].type === "pickUp");
      if (first !== undefined) expect(laid.cells.get(first)!.column).toBe(1);
    }
  }
};

describe("each view's chart", () => {
  it("has each of its stitches in a cell of its own, in columns renumbered from the right, a sleeve's picked-up stitches over its underarm", () => {
    checkLayouts(built, views);
  });

  it("from the neck, before the divide, is the whole chart as it was", () => {
    const layout = seamLayout(built);
    const { layout: laid } = layOutView(byId("neck"), layout, built);
    for (const id of built.stitches.map((stitch) => stitch.id).filter((id) => id < right.heldAt && layout.cells.has(id))) {
      expect(laid.cells.get(id)!.row).toBe(layout.cells.get(id)!.row);
    }
  });

  for (const sweater of sweaters) {
    it(`are sound in every size of ${sweater.name}: four views and a stage between the holds, every stitch in one`, () => {
      for (const size of sweater.sizes) {
        const one = buildSweater(sweater, size.id);
        const all = chartViews(one, sweater.pieces);
        expect(all.map((view) => view.kind)).toEqual(["neck", "remaining", "remaining", "held", "held"]);
        // Once the last sleeve is held, the body's view is the dividing round's: that row, all it was worked out of, and all worked out of it.
        expect(sameAs(all[2].members, roundFamily(one))).toBe(true);
        const seen = new Set(all.flatMap((view) => [...view.members]));
        expect(one.stitches.filter((stitch) => isFabric(stitch) && !seen.has(stitch.id))).toEqual([]);
        checkLayouts(one, all);
        // And turned to a beginning of the round the pattern moves, where it does.
        const moved = beginningAt(one, one.stitches.length - 1);
        if (moved !== undefined) checkLayouts(one, all, moved);
      }
    }, 120_000);
  }
});

describe("a view's markers", () => {
  it("are every marker on the chart from the neck, each between the same stitches as on the sweater's chart", () => {
    const klee = sweaters.find((one) => one.id === "paul-klee")!;
    const one = buildSweater(klee, "m1");
    const counted = viewFor(one, () => seamLayout(one), undefined);
    const neck = chartViews(one, klee.pieces)[0];
    const { layout, boundary } = layOutView(neck, counted.layout, one);
    const lines = markersInView(counted.markers, boundary);
    expect(lines).toHaveLength(counted.markers.length);
    // The stitch to the right of each line on the sweater's chart is to its right on the view's.
    for (const [k, line] of counted.markers.entries()) {
      const right = [...counted.layout.cells].find(([id, cell]) => neck.members.has(id) && cell.row === line.from && Math.round(cell.column) === line.after);
      if (right) expect(Math.round(layout.cells.get(right[0])!.column)).toBe(lines[k].after);
    }
  });
});
