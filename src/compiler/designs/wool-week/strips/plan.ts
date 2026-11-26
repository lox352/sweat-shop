import type { ChartCell } from "../../types";
import type { Cut, CutRow } from "./cuts";
import { lined } from "./lined";
import { refit } from "./refit";
import type { Band } from "./slots";

/**
 * Where each year goes on a strip sampler, and how many rounds it has.
 *
 * Two layouts, of the same parts - a year cut down its ladder to the rounds
 * it is given, and framed by rounds of its own yarn (see refit.ts):
 * - **Lined up**: all thirteen years from the neck to the hem, each in a
 *   strip of about the same height, and the same strips again down each
 *   sleeve, round for round, so they line up when the arms hang down; the
 *   last year is cut fuller on the sleeve, to take it to the cuff. See
 *   lined.ts.
 * - **Each year once, refitted**: 2014 to 2016 round the yoke, 2017 to 2021
 *   down the body, 2022 to 2026 down both sleeves, each cut as full as there
 *   is room for; see refit.ts.
 *
 * Either way a piece's first round is its first year's own: the body's is
 * the dividing round, and a sleeve's the round its stitches are taken up in
 * (see Plan).
 */

/** A tension, to the centimetre. */
export interface Gauge {
  stitches: number;
  rounds: number;
}

/** The samplers' own: 32 stitches and 38 rounds to 10cm. */
export const gauge: Gauge = { stitches: 3.2, rounds: 3.8 };

/** How deep each rib is, in centimetres: 9 rounds at the neck and 14 at the hem and cuffs, at the samplers' own tension. */
const ribDepths = { neck: 9 / 3.8, hem: 14 / 3.8, cuff: 14 / 3.8 };

/** The rounds each rib has at a tension. */
export const ribsAt = (g: Gauge) => ({
  neck: Math.round(ribDepths.neck * g.rounds),
  hem: Math.round(ribDepths.hem * g.rounds),
  cuff: Math.round(ribDepths.cuff * g.rounds),
});

export interface Measured {
  chestCm: number;
  neckCm: number;
  yokeDepthCm: number;
  bodyLengthCm: number;
  upperArmCm: number;
  sleeveLengthCm: number;
  cuffCm: number;
}

/**
 * A round of a band already begun, still to be knitted, as the pattern in
 * hand has it (see kept.ts): read off that pattern's own stitches, not laid
 * out afresh, so the band is finished as it was started.
 */
export interface Kept {
  /** One repeat of the round as it is knitted, a make-one where the repeat has one of its own; a round all of one yarn is a repeat of one stitch. */
  cells: ChartCell[];
  /** How many repeats the pattern in hand knits it on. */
  reps: number;
  /** Which run of the band's patterned rounds it is one of: a run is knitted on one number of repeats, so its rounds stay lined up. None for a round of one yarn. */
  run?: number;
  /** Its run was begun in a round already knitted, and goes on on the repeats it has. */
  carried?: true;
  /** Where the pattern in hand makes this round's new stitches, as places in the round, where they are not in every repeat alike: a shaping round's, or those spread through a run's first round. */
  places?: number[];
}

/** A round of one of a year's charts, and where it stands in its band once a piece is being knitted (see knit's banded). */
export type ChartRow = { year: number; band?: Band } & CutRow;
export type KeptRow = { year: number; kept: Kept };

/**
 * A round of a strip before any counts: plain in one of the year's yarns, or
 * a row of one of its charts.
 */
export type Row = { year: number; plain: string } | ChartRow;
/** A round to be knitted: one laid out; or, in the rest of a band part knitted, one kept as the pattern in hand has it. */
export type Worked = Row | KeptRow;
export const isKept = (r: Worked): r is KeptRow => "kept" in r;
/** A kept round all of one yarn: where a count may change freely. */
export const keptSolid = (r: KeptRow): boolean => r.kept.cells.every((cell) => cell.slot === r.kept.cells[0].slot) && r.kept.run === undefined;

export interface Strip {
  year: number;
  height: number;
  cut: Cut;
  ground: string;
}

/** A quantum's framing, as Each Year Once lays it out: its year, and its plain rounds above it and below. */
export interface Frame {
  year: number;
  above: number;
  below: number;
}

/**
 * What goes where. The body's first row is the dividing round itself, and
 * the sleeve's the round its stitches are taken up in, so the plain round
 * that opens each is its first band's own and no round goes before it.
 */
export interface Plan {
  strips: { yoke: Strip[]; body: Strip[]; sleeve: Strip[] };
  rows: { yoke: Row[]; body: Row[]; sleeve: Row[] };
  /** Rounds of colourwork on each piece. */
  depth: { yoke: number; body: number; sleeve: number };
  /** Each piece's quanta, in order, and how they are framed. */
  frames?: { yoke: Frame[]; body: Frame[]; sleeve: Frame[] };
}

export type Layout = { kind: "lined" } | { kind: "refit" };

/** Colourwork rounds each piece has, before any year is placed. */
export const budgets = (size: Measured, g: Gauge = gauge) => {
  const ribs = ribsAt(g);
  return {
    yoke: Math.round(size.yokeDepthCm * g.rounds) - ribs.neck - 1,
    body: Math.round(size.bodyLengthCm * g.rounds) - ribs.hem - 2,
    sleeve: Math.round(size.sleeveLengthCm * g.rounds) - ribs.cuff - 2,
  };
};

/** A size's plan: what goes where, for its measurements at a tension - the samplers' own unless another is given. */
export const planOf = (size: Measured, layout: Layout, g: Gauge = gauge): Plan => (layout.kind === "lined" ? lined(size, g) : refit(size, g));
