import React from "react";
import type { ChartLayout } from "./layout";
import type { Hold, Join, NeedleChange, Turn } from "./chart-marks";
import type { HoldRegion } from "./holds";

/**
 * What the chart marks besides its stitches, in words: where the knitting is
 * joined, where the needles change, where sleeves go on hold, where a short
 * row turns, what is on hold now and which rows are hatched.
 *
 * A chart drawn on canvases has nothing in it for a screen reader to find, as
 * the vectors' titles were, so it is said here instead, beside the chart and
 * unseen. Each item carries what it is in `data-note`.
 */
const ChartNotes: React.FC<{
  layout: ChartLayout;
  join?: Join;
  turns: Turn[];
  holds: Hold[];
  needles: NeedleChange[];
  onHold: HoldRegion[];
  hatch: [number, number][];
  /** What each round is called: "Body, round 76". */
  names?: string[];
  /** The sweater's pieces, to name what is on hold. */
  pieces?: { id: string; label: string }[];
}> = ({ layout, join, turns, holds, needles, onHold, hatch, names, pieces }) => {
  const roundName = (id: number) => {
    const round = layout.cells.get(id)?.round;
    return round === undefined ? "" : names?.[round - 1] ?? `round ${round}`;
  };
  return (
    <ul className="chart-notes visually-hidden" aria-label="Marked on the chart">
      {join && <li data-note="join">Joined in the round after {names?.[join.after - 1] ?? `round ${join.after}`}.</li>}
      {needles.map((change, at) => (
        <li key={`needles-${at}`} data-note="needles">
          The needles are changed to {change.to}mm{change.where ? ` after ${change.where}` : ""}.
        </li>
      ))}
      {holds.map((hold) => (
        <li key={`hold-${hold.before}`} data-note="hold">
          {`The ${hold.label.toLowerCase()}'s ${hold.count} stitches go on hold in ${roundName(hold.before)}.`}
        </li>
      ))}
      {turns.map((turn) => (
        <li key={`turn-${turn.last}`} data-note="turn">
          A short row turns at the end of {roundName(turn.last)}.
        </li>
      ))}
      {onHold.map((region) => (
        <li key={`on-hold-${region.heldAt}`} data-note="on-hold">
          {`On hold, crosshatched: the ${(pieces?.find((piece) => piece.id === region.holder)?.label ?? region.holder).toLowerCase()}'s stitches, and everything to be knitted from them.`}
        </li>
      ))}
      {hatch.map(([from, to]) => (
        <li key={`hatch-${from}`} data-note="hatch">
          {from === to ? `Row ${from} is hatched` : `Rows ${from} to ${to} are hatched`}: worked with the other side towards you.
        </li>
      ))}
    </ul>
  );
};

export default ChartNotes;
