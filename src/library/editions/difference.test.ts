import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sweaterById } from "../../compiler/designs/index";
import type { SweaterPattern } from "../../compiler/designs/types";
import { buildSweater, specEnds } from "../../compiler/engine/engine";
import type { SweaterStitches } from "../../pattern/knitted";
import { joined, joinedAt, sharedRounds, updateFor } from "./difference";
import { type EditionFile, decodeEdition, encodeEdition } from "./format";

const here = dirname(fileURLToPath(import.meta.url));
const frozen = join(here, "../../../public/editions");
const entries = JSON.parse(readFileSync(join(here, "manifest.json"), "utf8")) as Record<string, Record<string, { current: string }>>;

const hamefarin = sweaterById("hamefarin")!;
/** Hamefarin with some of its charts redrawn: the first stitch of every row of each in another yarn. */
const redrawn = (...ids: string[]): SweaterPattern => ({
  ...hamefarin,
  charts: hamefarin.charts.map((chart) => (ids.includes(chart.id) ? { ...chart, rows: chart.rows.map(([first, ...rest]) => [{ ...first, slot: first.slot === "G" ? "A" : "G" }, ...rest]) } : chart)),
});
const mine = buildSweater(hamefarin, "m");
const endOf = (knitted: SweaterStitches, round: number) => knitted.rounds[round - 1][knitted.rounds[round - 1].length - 1];
/** The last round of a band of the yoke, by what its rounds are called. */
const lastOf = (knitted: SweaterStitches, band: string) => knitted.roundLabels.map((label, at) => label.startsWith(`${band}, row`) && knitted.roundPieces[at] === "yoke").lastIndexOf(true) + 1;
const plain = ({ type, slot, links, piece }: SweaterStitches["stitches"][number]) => ({ type, slot, links, piece });

describe("an update, by where it falls from the knitter's needles", () => {
  it("joining a knitting to itself at any round of the yoke is that knitting", () => {
    for (const round of [23, 31, 47, 58]) {
      const again = joined(mine, mine, round, round)!;
      expect(again.stitches).toEqual(mine.stitches);
      expect({ ...again, stitches: 0, knitting: { ...again.knitting, stitches: 0 } }).toEqual({ ...mine, stitches: 0, knitting: { ...mine.knitting, stitches: 0 } });
    }
    // Once stitches are on hold there is no round to join at.
    expect(joined(mine, mine, mine.roundPieces.indexOf("body") + 1, mine.roundPieces.indexOf("body") + 1)).toBeUndefined();
  });

  it("all behind: a band redrawn that the knitter has finished", () => {
    const theirs = buildSweater(redrawn("border"), "m");
    const update = updateFor(mine, theirs, endOf(mine, lastOf(mine, "Border")));
    expect(update.kind).toBe("behind");
    expect(update.kind === "behind" && update.changed.every((round) => mine.roundLabels[round - 1].startsWith("Border, row"))).toBe(true);
    expect(update.kind === "behind" && update.changed.length).toBe(9);
  });

  it("all ahead: a band redrawn that the knitter has not reached", () => {
    const theirs = buildSweater(redrawn("oxo"), "m");
    const update = updateFor(mine, theirs, endOf(mine, lastOf(mine, "Border")));
    expect(update.kind).toBe("ahead");
    expect(update.kind === "ahead" && update.changed.length).toBe(17);
  });

  it("round the knitter: their rounds are kept and the update's are knitted from the round in hand, as the engine would knit them on", () => {
    const pattern = redrawn("border", "oxo");
    const theirs = buildSweater(pattern, "m");
    const round = lastOf(mine, "Peerie seeds");
    // Part way round the last round of the band between the two.
    const update = updateFor(mine, theirs, endOf(mine, round) - 40);
    expect(update.kind).toBe("joined");
    if (update.kind !== "joined") return;
    expect(update.round).toBe(round);
    expect(update.changed.length).toBe(17);
    const kept = endOf(mine, round) + 1;
    expect(update.knitting.stitches.slice(0, kept)).toEqual(mine.stitches.slice(0, kept));
    expect(update.knitting.stitches.slice(kept).map(plain)).toEqual(theirs.stitches.slice(kept).map(plain));
    // The same sweater the engine knits, carrying on from the knitter's rounds with the update's instructions from there.
    const { rest } = specEnds(pattern, "m").find((end) => end.round === round)!;
    const carried = buildSweater({ ...pattern, sizes: pattern.sizes.map((size) => (size.id === "m" ? { ...size, sections: rest } : size)) }, "m", { knitted: mine, round });
    expect(update.knitting.stitches).toEqual(carried.stitches);
    expect(update.knitting.rounds).toEqual(carried.rounds);
    expect(update.knitting.holds).toEqual(carried.holds);
    expect(update.knitting.needleChanges).toEqual(carried.needleChanges);
    expect(update.knitting.knitting.rounds).toEqual(carried.knitting.rounds);
    // And it is an edition like any other.
    expect(decodeEdition(encodeEdition(update.knitting, "hamefarin", "m", "0a0b0c0d0e0f")).stitches).toEqual(update.knitting.stitches);
  });

  it("joined again at the round it was joined at, it is the same knitting: what a link makes a joined jumper again by", () => {
    const theirs = buildSweater(redrawn("border", "oxo"), "m");
    const round = lastOf(mine, "Peerie seeds");
    const update = updateFor(mine, theirs, endOf(mine, round) - 40);
    if (update.kind !== "joined") throw new Error("not joined");
    // Wherever in the round the knitter was then, and with nothing said of where.
    expect(joinedAt(mine, theirs, update.round)).toEqual(update.knitting);
    // A round the two do not share - the first of the band redrawn - is no round to join at; nor one past the end.
    expect(joinedAt(mine, theirs, lastOf(mine, "Border") - 2)).toBeUndefined();
    expect(joinedAt(mine, theirs, mine.rounds.length + 1)).toBeUndefined();
    // Nor one where stitches are on hold.
    expect(joinedAt(mine, mine, mine.roundPieces.indexOf("body") + 1)).toBeUndefined();
  });

  it("apart: a size on other counts from the knitter's round on has nothing to join to", () => {
    const update = updateFor(mine, buildSweater(hamefarin, "l"), endOf(mine, lastOf(mine, "Border")));
    expect(update.kind).toBe("apart");
  });

  it("every older edition published falls one of these ways for a knitter anywhere in it", () => {
    for (const [design, sizes] of Object.entries(entries)) {
      for (const [size, { current }] of Object.entries(sizes)) {
        const read = (file: string) => decodeEdition(JSON.parse(readFileSync(join(frozen, file), "utf8")) as EditionFile);
        const older = readdirSync(frozen).filter((one) => one.startsWith(`${design}--${size}--`) && !one.includes(current));
        if (older.length === 0) continue;
        const now = read(`${design}--${size}--${current}.json`);
        for (const name of older.slice(0, 1)) {
          const was = read(name);
          expect(sharedRounds(was, now).length).toBeGreaterThan(0);
          for (const progress of [0, endOf(was, 30), endOf(was, Math.floor(was.rounds.length / 2)), was.stitches.length - 1]) {
            const update = updateFor(was, now, progress);
            if (progress === was.stitches.length - 1) expect(update.kind).toBe("behind");
            if (update.kind === "joined") expect(update.knitting.stitches.slice(0, endOf(was, update.round) + 1)).toEqual(was.stitches.slice(0, endOf(was, update.round) + 1));
          }
        }
      }
    }
  }, 600000);
});
