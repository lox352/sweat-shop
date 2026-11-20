import { useEffect, useMemo, useState } from "react";
import { allPositions, settledLength } from "../../library/settled/format";
import type { SweaterStitches } from "../../pattern/knitted";
import { isFabric } from "../../pattern/Stitch";
import { pose } from "../../physics/pose";
import type { Palette } from "../../reading/palette";
import { extremesOf } from "./framing";
import SweaterStage from "./SweaterStage";
import "./SweaterComparison.css";

export interface Candidate {
  id: string;
  label: string;
  knitting: SweaterStitches;
  /** Its yarns: each may be in a colourway placed on it. */
  palette: Palette;
  /** Where its fabric came to rest, where whoever shows it has settled it: see ui/useShape. */
  settled?: Float32Array;
  /** How wide one of its stitches is, in centimetres, where they are not all of one tension: each is then drawn its true size. */
  stitchCm?: number;
}

/** Each knitting placed, once - laid out, or where it came to rest: a colourway arriving is no reason to place any of them again. */
const placed = new WeakMap<object, { nth: number; positions: Float32Array; extremes: [number, number, number][] }>();
let nth = 0;
const place = (knitting: SweaterStitches, settled?: Float32Array) => {
  const of = settled ?? knitting;
  let out = placed.get(of);
  if (!out) {
    const positions = settled ? allPositions(knitting.stitches, settled) : pose(knitting.knitting).positions;
    out = { nth: nth++, positions, extremes: extremesOf(positions, knitting.stitches.filter(isFabric).map((stitch) => stitch.id)) };
    placed.set(of, out);
  }
  return out;
};

/** How tall each is drawn, where there is room for them all and where there is not. */
const heights = { wide: 300, tight: 210 };
/** Narrower than this, there is room for two side by side and no more. */
const narrow = "(max-width: 640px)";

/**
 * Several knittings side by side, to compare: each whole and in its wool,
 * drawn where it came to rest where every one of them has been settled, and
 * otherwise all laid out, as a sweater is before it is; all to one scale,
 * from one place, so that what differs between them is what differs in the
 * sweaters. One scale is one camera, each framed for all of them; and where
 * their stitches are not one size - a design at its own tension beside the
 * same design recalculated for a knitter's - each is drawn by the width of
 * its stitches, so that a centimetre is a centimetre in all of them.
 *
 * They are turned, moved and zoomed as one thing. A finger is taken up by
 * one surface over all of them, which every sweater's camera listens to:
 * each does the same with it, so a drag begun on one and carried over the
 * gap to the next, or a pinch with a finger on each, is one gesture.
 *
 * Where there is room for only two, the first - the one the others are
 * compared with - and the one chosen.
 */
export default function SweaterComparison({ candidates, chosen, fill }: { candidates: Candidate[]; chosen: string; /** As tall as what it is put in: a stage. */ fill?: boolean }) {
  const [tight, setTight] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(narrow).matches);
  useEffect(() => {
    const query = window.matchMedia?.(narrow);
    const changed = () => setTight(!!query?.matches);
    query?.addEventListener("change", changed);
    return () => query?.removeEventListener("change", changed);
  }, []);
  // Settled, only if all are: one hanging beside one laid flat would be no comparison.
  const rested = candidates.every((one) => one.settled?.length === settledLength(one.knitting.stitches));
  const posed = candidates.map(({ knitting, settled }) => place(knitting, rested ? settled : undefined));
  // Each by the width of its stitches, against the first's.
  const scales = candidates.map((one) => (one.stitchCm ?? 1) / (candidates[0]?.stitchCm ?? 1));
  // One frame for all of them, the same so long as they are the same sweaters at the same sizes.
  const frameKey = posed.map((one, at) => `${one.nth}@${scales[at]}`).join(" ");
  const frame = useMemo(
    () => posed.flatMap((one, at) => one.extremes.map(([x, y, z]): [number, number, number] => [x * scales[at], y * scales[at], z * scales[at]])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frameKey],
  );
  const [surface, setSurface] = useState<HTMLElement | null>(null);
  const shown = candidates.map((one, at) => ({ ...one, ...posed[at], scale: scales[at] })).filter((one, at) => !tight || at === 0 || one.id === chosen);

  return (
    <div className={fill ? "sweater-comparison fills" : "sweater-comparison"}>
      {shown.map((one) => (
        <figure key={one.id} className={one.id === chosen ? "sweater-compared chosen" : "sweater-compared"}>
          <div className="sweater-canvas" style={fill ? undefined : { height: tight ? heights.tight : heights.wide }} role="img" aria-label={`${one.label}, in three dimensions`}>
            {surface && (
              <SweaterStage
                knitting={one.knitting}
                posed={one.positions}
                frame={frame}
                scale={one.scale}
                surface={surface}
                palette={one.palette}
                progress={Infinity}
                // Turned, each stops where it is let go: a glide would be a glide drawn on all of them.
                reducedMotion
              />
            )}
          </div>
          <figcaption>{one.label}</figcaption>
        </figure>
      ))}
      {/* Over them all, and the gaps between: where they are taken hold of. */}
      <div className="sweater-comparison-surface" ref={setSurface} aria-hidden="true" />
    </div>
  );
}
