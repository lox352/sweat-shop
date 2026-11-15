import React, { lazy, Suspense, useEffect, useState } from "react";
import { Palette } from "../../reading/palette";
import { sweaterById } from "../../library/catalogue";
import { knittingToHand } from "../../library/knitting";
import { loadSettled, settledShape } from "../../library/settled";
import PreviewBoundary from "./PreviewBoundary";

/** How tall the stage is, so nothing on the page moves when it arrives. */
export const sweaterCanvasHeight = 420;

/**
 * The 3D stage, loaded on demand: three.js is most of a megabyte, and a page
 * that is never scrolled to the sweater, or a phone that cannot draw it, has
 * no use for it. The placeholder is exactly the canvas's height.
 */
const SweaterStage = lazy(() => import("../model/SweaterStage"));

export interface SweaterModelProps {
  sweaterId: string;
  sizeId: string;
  palette: Palette;
  /** Id of the last stitch worked; earlier stitches are shown in their wool. */
  progress: number;
  /** The edition of the knitting to show, for a project that knits one its size has moved on from: see library/editions. */
  edition?: string;
}

/**
 * "?settled=0" draws the sweater blocked, as it starts, rather than where it
 * came to rest, which is the only way to see what the settling is worth.
 */
const settledWanted = () =>
  typeof window === "undefined" ||
  new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("settled") !== "0";

/** Positions already fetched this visit, so moving between pages does not fetch them again. */
const known = new Map<string, Float32Array>();

/**
 * The sweater in three dimensions, on the design's page and a project's:
 * which knitting that is, and whether it has a settled shape, are found here,
 * and the stage is handed what it is to draw.
 */
const SweaterModel: React.FC<SweaterModelProps> = ({ sweaterId, sizeId, edition, palette, progress }) => {
  // The size's knitting as the project knits it, which the page that shows this has to hand already; until it has, nothing is drawn.
  const knitting = knittingToHand(sweaterById(sweaterId)!, sizeId, edition);
  // The shape its edition has, if that has been settled: a project's own edition's, or the size's now.
  const shape = settledWanted() ? settledShape(sweaterId, sizeId, edition) : undefined;
  const [settled, setSettled] = useState(() => (shape ? known.get(shape) : undefined));
  /** The shape whose file has been asked for and has answered, found or not. */
  const [looked, setLooked] = useState<string | undefined>(() => (shape && known.has(shape) ? shape : undefined));
  useEffect(() => {
    let live = true;
    setSettled(shape ? known.get(shape) : undefined);
    if (!shape || known.has(shape)) {
      setLooked(shape);
      return;
    }
    loadSettled(shape).then((positions) => {
      if (!live) return;
      if (positions) known.set(shape, positions);
      setSettled(positions);
      setLooked(shape);
    });
    return () => {
      live = false;
    };
  }, [shape]);
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // Nothing is drawn until a settled sweater has had its chance to arrive, so it is never seen jumping into its shape.
  const waiting = !!shape && looked !== shape;
  return (
    <div
      className="sweater-canvas"
      style={{ height: sweaterCanvasHeight }}
      role="img"
      aria-label="The sweater in three dimensions"
    >
      <PreviewBoundary>
        <Suspense fallback={<p role="status">Loading 3D preview…</p>}>
          {!waiting && knitting && <SweaterStage knitting={knitting} palette={palette} progress={progress} reducedMotion={reducedMotion} settled={settled} />}
        </Suspense>
      </PreviewBoundary>
    </div>
  );
};

export default SweaterModel;
