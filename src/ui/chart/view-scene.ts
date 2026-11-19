import type { Stitch } from "../../pattern/Stitch";
import { type ChartLayout, mirrorLayout } from "../../reading/layout";
import type { HoldRegion } from "../../reading/holds";
import type { MarkerLine } from "../../reading/view";
import { type ChartScene, sceneOf } from "./chart-scene";
import { type Face, type Hold, type Join, type NeedleChange, type Turn, holdsIn, joinIn, needleChangesIn, turnsIn } from "./chart-marks";

/** What a chart of one view of the knitting is drawn from, besides the view's own layout. */
export interface ViewInputs {
  stitches: Stitch[];
  rounds: number[][];
  /** The side of the sweater the chart shows: see faceAfter. */
  face: Face;
  /** Which way this pattern's make-ones lean, if it says. */
  makeOneLean?: "left" | "right";
  /** The stitch markers on the needles, each a line up the chart, as the view lays them out. */
  markers?: MarkerLine[];
  /** What each round is called. */
  names?: string[];
  pieces?: { id: string; label: string }[];
  /** The knitting's held regions. */
  holdRegions?: HoldRegion[];
}

/** A chart of one view, ready to draw: laid out as it shows, turned over or not, and everything marked on it. */
export interface ViewScene {
  layout: ChartLayout;
  scene: ChartScene;
  markers: MarkerLine[];
  needles: NeedleChange[];
  join?: Join;
  holds: Hold[];
  turns: Turn[];
}

const none: MarkerLine[] = [];
const kept = new WeakMap<ChartLayout, { inputs: ViewInputs; made: ViewScene }[]>();
const same = (a: ViewInputs, b: ViewInputs) =>
  a.stitches === b.stitches &&
  a.rounds === b.rounds &&
  a.face === b.face &&
  a.makeOneLean === b.makeOneLean &&
  a.markers === b.markers &&
  a.names === b.names &&
  a.pieces === b.pieces &&
  a.holdRegions === b.holdRegions;

/**
 * A chart of the view laid out as `laid`, made once for whatever it is drawn
 * from, however many times it is asked for: the chart is made anew for each
 * view of the knitting, as it opens on it, and the knitting going on to the
 * next view - a sleeve put on hold, part way round the dividing round - made
 * it in that tap, a third of the tap's time on a phone. Asked for ahead (see
 * the jumper's page), it is to hand by then; and a view looked at again, or
 * come back to by an undo, is not made again. Kept for each side it is seen
 * from, the last two asked for.
 */
export const sceneFor = (laid: ChartLayout, inputs: ViewInputs): ViewScene => {
  const list = kept.get(laid) ?? [];
  const hit = list.find((one) => same(one.inputs, inputs));
  if (hit) return hit.made;
  const { stitches, rounds, face, makeOneLean, names, pieces, holdRegions } = inputs;
  // Turned over with the work: every column's line to the left of it, to the left of the column on its other side.
  const layout = face === "wrong" ? mirrorLayout(laid) : laid;
  const markers =
    face === "wrong"
      ? (inputs.markers ?? none).map((line) => ({
          ...line,
          after: laid.columns - line.after,
          route: line.route.map((row) => ({ ...row, after: laid.columns - row.after })),
        }))
      : (inputs.markers ?? none);
  const needles = needleChangesIn(stitches, rounds, names);
  // Each drawn across its own piece, between the rows either side of it; held stitches taken up onto other needles are not.
  const needleRules = needles
    .filter((change) => !change.takeUp)
    .map((change) => ({
      after: laid.roundRows[change.after - 1] ?? change.after,
      piece: laid.cells.get(rounds[change.after - 1]?.[0] ?? -1)?.piece ?? "",
    }));
  const join = joinIn(stitches, rounds);
  const holds = holdsIn(stitches, rounds, pieces);
  const turns = turnsIn(stitches, rounds);
  // Every stitch a holder takes, marked where it is: in the views that show it rather than the bar.
  const held = (holdRegions ?? []).flatMap((region) => region.stitches);
  const scene = sceneOf(layout, stitches, rounds, { needleRules, join, holds, held, turns, face, makeOneLean, markers });
  const made = { layout, scene, markers, needles, join, holds, turns };
  kept.set(laid, [{ inputs, made }, ...list].slice(0, 2));
  return made;
};
