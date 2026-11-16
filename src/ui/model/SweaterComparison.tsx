import { useEffect, useMemo, useState } from "react";
import type { SweaterStitches } from "../../pattern/knitted";
import { isFabric } from "../../pattern/Stitch";
import { pose } from "../../physics/pose";
import type { Palette } from "../../reading/palette";
import { extremesOf } from "./framing";
import SweaterStage, { type TurnedTogether } from "./SweaterStage";
import "./SweaterComparison.css";

export interface Candidate {
  id: string;
  label: string;
  knitting: SweaterStitches;
  /** Its yarns: each may be in a colourway placed on it. */
  palette: Palette;
}

/** Each knitting laid out, once: a colourway arriving is no reason to lay any of them out again. */
const laid = new WeakMap<SweaterStitches, { nth: number; positions: Float32Array; extremes: [number, number, number][] }>();
let nth = 0;
const layOut = (knitting: SweaterStitches) => {
  let out = laid.get(knitting);
  if (!out) {
    const positions = pose(knitting.knitting).positions;
    out = { nth: nth++, positions, extremes: extremesOf(positions, knitting.stitches.filter(isFabric).map((stitch) => stitch.id)) };
    laid.set(knitting, out);
  }
  return out;
};

/** How tall each is drawn, where there is room for them all and where there is not. */
const heights = { wide: 300, tight: 210 };
/** Narrower than this, there is room for two side by side and no more. */
const narrow = "(max-width: 640px)";

/**
 * Several knittings side by side, to compare: each drawn laid out, as a
 * sweater is before it is settled, whole and in its wool; all to one scale,
 * from one place, and turning together, so that what differs between them is
 * what differs in the sweaters. They are the same knitter's stitches, so one
 * scale is one camera: each is framed for all of them.
 *
 * Where there is room for only two, the first - the one the others are
 * compared with - and the one chosen.
 */
export default function SweaterComparison({ candidates, chosen }: { candidates: Candidate[]; chosen: string }) {
  const [tight, setTight] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(narrow).matches);
  useEffect(() => {
    const query = window.matchMedia?.(narrow);
    const changed = () => setTight(!!query?.matches);
    query?.addEventListener("change", changed);
    return () => query?.removeEventListener("change", changed);
  }, []);
  const posed = candidates.map(({ knitting }) => layOut(knitting));
  // One frame for all of them, the same so long as they are the same sweaters.
  const frameKey = posed.map((one) => one.nth).join(" ");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const frame = useMemo(() => posed.flatMap((one) => one.extremes), [frameKey]);
  const together = useMemo((): TurnedTogether => ({ stages: new Set() }), []);
  const shown = candidates.map((one, at) => ({ ...one, ...posed[at] })).filter((one, at) => !tight || at === 0 || one.id === chosen);

  return (
    <div className="sweater-comparison">
      {shown.map((one) => (
        <figure key={one.id} className={one.id === chosen ? "sweater-compared chosen" : "sweater-compared"}>
          <div className="sweater-canvas" style={{ height: tight ? heights.tight : heights.wide }} role="img" aria-label={`${one.label}, in three dimensions`}>
            <SweaterStage
              knitting={one.knitting}
              posed={one.positions}
              frame={frame}
              together={together}
              palette={one.palette}
              progress={Infinity}
              // Turned, each stops where it is let go: a glide on one would be a glide drawn on all of them.
              reducedMotion
            />
          </div>
          <figcaption>{one.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}
