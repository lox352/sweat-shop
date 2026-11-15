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
}

/** How tall each is drawn. */
const height = 300;
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
export default function SweaterComparison({ candidates, chosen, palette }: { candidates: Candidate[]; chosen: string; palette: Palette }) {
  const [tight, setTight] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(narrow).matches);
  useEffect(() => {
    const query = window.matchMedia?.(narrow);
    const changed = () => setTight(!!query?.matches);
    query?.addEventListener("change", changed);
    return () => query?.removeEventListener("change", changed);
  }, []);
  const reducedMotion = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const posed = useMemo(
    () =>
      candidates.map(({ knitting }) => {
        const positions = pose(knitting.knitting).positions;
        return { positions, extremes: extremesOf(positions, knitting.stitches.filter(isFabric).map((stitch) => stitch.id)) };
      }),
    [candidates],
  );
  const frame = useMemo(() => posed.flatMap((one) => one.extremes), [posed]);
  const together = useMemo((): TurnedTogether => ({ stages: new Set() }), []);
  const shown = candidates.map((one, at) => ({ ...one, ...posed[at] })).filter((one, at) => !tight || at === 0 || one.id === chosen);

  return (
    <div className="sweater-comparison">
      {shown.map((one) => (
        <figure key={one.id} className={one.id === chosen ? "sweater-compared chosen" : "sweater-compared"}>
          <div className="sweater-canvas" style={{ height }} role="img" aria-label={`${one.label}, in three dimensions`}>
            <SweaterStage
              knitting={one.knitting}
              posed={one.positions}
              frame={frame}
              together={together}
              palette={palette}
              progress={Infinity}
              reducedMotion={reducedMotion}
            />
          </div>
          <figcaption>{one.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}
