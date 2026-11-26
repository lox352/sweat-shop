import type { ChartCell } from "../../types";
import type { SweaterStitches } from "../../../../pattern/knitted";
import { isSpacer } from "../../../../pattern/knitted";
import { isStepKind } from "../../../../pattern/kinds";
import type { KeptRow } from "./plan";
import { baseSlot, yearOfSlot } from "./slots";

/**
 * The rest of a band part knitted, read off the pattern in hand.
 *
 * A knitter part way down a year has the rest of it charted already: the
 * rounds of the pattern they are knitting from. The rest of the sweater is
 * planned on from the round they are at, and that band is finished as it was
 * begun - the same rounds in the same order - on whatever count the yoke now
 * wants. So its rounds are read from the knitting itself, stitch by stitch,
 * and not laid out again from the hat: whatever pattern was in hand, of
 * whatever edition or earlier plan, is what goes on.
 *
 * - **A round of one yarn** is where a count may change freely.
 * - **A run** of patterned rounds, with no round of one yarn among them, is
 *   knitted on one number of repeats, so its rounds stay lined up with each
 *   other: one repeat of each is kept, the smallest all of them share, with a
 *   make-one where the repeat makes one of its own (a doubled column). A run
 *   whose first round spreads new stitches through it is a run begun on a
 *   new count, and may be begun on another.
 * - **A run begun already**, in a round knitted, goes on on the repeats it
 *   has: `carried`.
 */

type Cell = ChartCell;
/** More repeats than any round of a yoke has of a pattern: a round of 720 stitches, the widest, has 360 of a repeat of two. */
const REPEATS = 512;
const same = (a: Cell, b: Cell, bare: boolean) => a.slot === b.slot && (bare || (a.symbol === b.symbol && a.spacer === b.spacer));
/** Is a round `d` repeats of its first `length / d` stitches: counting its make-ones, or `bare`, by its yarns alone. */
const repeats = (cells: Cell[], d: number, bare: boolean): boolean => {
  if (cells.length % d !== 0) return false;
  const p = cells.length / d;
  for (let j = p; j < cells.length; j++) if (!same(cells[j], cells[j - p], bare)) return false;
  return true;
};
/** The most repeats a round is of, counted so. */
const most = (cells: Cell[], bare: boolean): number => {
  for (let d = cells.length; d > 1; d--) if (repeats(cells, d, bare)) return d;
  return 1;
};

/** A round as it is knitted: a cell for each stitch, its steps left out. None where it has a stitch a band's round can't be read from. */
const cellsOf = (knitted: SweaterStitches, round: number): Cell[] | undefined => {
  const cells: Cell[] = [];
  for (const id of knitted.rounds[round - 1]) {
    const stitch = knitted.stitches[id];
    if (isStepKind(stitch.type)) continue;
    if (stitch.type !== "k1" && stitch.type !== "m1") return undefined;
    cells.push({ slot: stitch.slot, ...(stitch.type === "m1" ? { symbol: "m1" as const } : {}), ...(isSpacer(stitch) ? { spacer: true as const } : {}) });
  }
  return cells;
};

const solid = (cells: Cell[]) => cells.every((cell) => cell.slot === cells[0].slot);
const made = (cells: Cell[]) => cells.flatMap((cell, j) => (cell.symbol === "m1" ? [j] : []));
const bare = (cells: Cell[]): Cell[] => cells.map(({ slot, spacer }) => ({ slot, ...(spacer ? { spacer } : {}) }));

/** Is a round of the knitting all of one yarn? */
export const isSolidRound = (knitted: SweaterStitches, round: number): boolean => {
  const cells = cellsOf(knitted, round);
  return !!cells && cells.length > 0 && solid(cells);
};

/**
 * The rounds after `round` to `end`, the last of the band `round` is in, as
 * the knitting has them. None where one can't be read: it is no whole round,
 * or has a stitch that is neither knitted nor made.
 */
export const restOfBand = (knitted: SweaterStitches, round: number, end: number): KeptRow[] | undefined => {
  const rounds: Cell[][] = [];
  for (let r = round + 1; r <= end; r++) {
    const cells = knitted.roundKinds[r - 1] === "round" ? cellsOf(knitted, r) : undefined;
    if (!cells || cells.length === 0) return undefined;
    rounds.push(cells);
  }
  const yearOf = (cells: Cell[]) => yearOfSlot(baseSlot(cells[0].slot));
  const out: KeptRow[] = [];
  let run = 0;
  const before = cellsOf(knitted, round);
  for (let i = 0; i < rounds.length; ) {
    const cells = rounds[i];
    if (solid(cells)) {
      const places = made(cells);
      out.push({ year: yearOf(cells), kept: { cells: [{ slot: cells[0].slot }], reps: cells.length, ...(places.length ? { places } : {}) } });
      i++;
      continue;
    }
    // A patterned round whose new stitches are not the same in every repeat of its yarns spreads them through itself: it begins a run.
    const spreads = (c: Cell[]) => made(c).length > 0 && most(c, false) < most(bare(c), true);
    let j = i + 1;
    while (j < rounds.length && !solid(rounds[j]) && !spreads(rounds[j])) j++;
    const first = spreads(cells) ? bare(cells) : cells;
    const all = [first, ...rounds.slice(i + 1, j)];
    // The most repeats every round of the run is of: under REPEATS, which is as many as the search for a yoke's counts tells apart (see shaping).
    let d = 1;
    for (let k = Math.min(REPEATS - 1, ...all.map((c) => c.length)); k > 1; k--) {
      if (all.every((c) => repeats(c, k, false))) {
        d = k;
        break;
      }
    }
    // Begun in a round knitted: the round before is patterned too, and this one does not begin on a new count.
    const carried = i === 0 && !!before && !solid(before) && first === cells;
    all.forEach((c, k) => {
      const places = k === 0 && first !== cells ? made(cells) : undefined;
      out.push({
        year: yearOf(c),
        kept: { cells: c.slice(0, c.length / d), reps: d, run, ...(carried ? { carried: true as const } : {}), ...(places ? { places } : {}) },
      });
    });
    run++;
    i = j;
  }
  return out;
};
