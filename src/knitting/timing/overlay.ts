import type { ChartOverlay } from "../chart-painter";
import type { TimeDetail } from "./detail";
import { paceColours, paceStep, sittingColours } from "./pace";

/** What the chart can be painted over with, looking back at the knitting. */
export type Layer = "pattern" | "pace" | "sittings";

/**
 * Each stitch tinted by the pace around it. Stitches that came in one tap
 * of more than 30 are faded: their pace is only that tap's average.
 */
const paceTint = (time: TimeDetail) => (id: number) => {
  const s = time.smooth[id];
  if (!Number.isFinite(s)) return undefined;
  return { fill: paceColours[paceStep(s / time.usual)], alpha: time.tapSpan[id] > 30 ? 0.4 : 0.92 };
};

/** Each stitch in the colour of the sitting it was knitted in. */
const sittingTint = (time: TimeDetail) => (id: number) => {
  const n = time.sittingOf[id];
  return n < 0 ? undefined : { fill: sittingColours[n % sittingColours.length], alpha: 0.88 };
};

/**
 * A strip beside each round's number: the round's pace against the
 * knitter's usual. The steadiest figure there is, since a round's time
 * doesn't depend on how it is shared out among its stitches. Only for
 * rounds at least half timed.
 */
const roundStrips = (time: TimeDetail) =>
  time.perRound.flatMap((r, i) =>
    r.timed < r.stitches / 2 ? [] : [{ round: i + 1, fill: paceColours[paceStep(r.seconds / r.timed / time.usual)] }],
  );

/** What the chart is painted over with for a layer: the pace or the sittings, and each round's pace beside it. */
export const statsOverlay = (time: TimeDetail, layer: Layer): ChartOverlay => ({
  tint: layer === "pace" ? paceTint(time) : layer === "sittings" ? sittingTint(time) : undefined,
  strips: roundStrips(time),
});
