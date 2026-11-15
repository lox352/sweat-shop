import React, { lazy, Suspense } from "react";
import { Palette } from "../../reading/palette";
import { sweaterById } from "../../library/catalogue";
import { knittingToHand } from "../../library/knitting";
import { useShape } from "../useShape";
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
 * The sweater in three dimensions, on the design's page and a project's:
 * which knitting that is, and whether it has a settled shape, are found here,
 * and the stage is handed what it is to draw.
 */
const SweaterModel: React.FC<SweaterModelProps> = ({
  sweaterId,
  sizeId,
  edition,
  palette,
  progress,
}) => {
  // The size's knitting as the project knits it, which the page that shows this has to hand already; until it has, nothing is drawn.
  const knitting = knittingToHand(sweaterById(sweaterId)!, sizeId, edition);
  const { settled, waiting, settling, unsettled } = useShape(
    sweaterId,
    sizeId,
    edition,
    knitting,
  );
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <>
      <div
        className="sweater-canvas"
        style={{ height: sweaterCanvasHeight }}
        role="img"
        aria-label="The sweater in three dimensions"
      >
        <PreviewBoundary>
          <Suspense fallback={<p role="status">Loading 3D preview…</p>}>
            {!waiting && knitting && (
              <SweaterStage
                knitting={knitting}
                palette={palette}
                progress={progress}
                reducedMotion={reducedMotion}
                settled={settled}
              />
            )}
          </Suspense>
        </PreviewBoundary>
      </div>
      {settling !== undefined && (
        <p className="sweater-settling" role="status">
          Settling your sweater into its shape. It is drawn laid out until then.
          <progress
            value={settling}
            max={1}
            aria-label="How far the settling has got"
          />
        </p>
      )}
      {unsettled && (
        <p className="sweater-settling" role="status">
          This sweater could not be settled into its shape here, and is drawn
          laid out.
        </p>
      )}
    </>
  );
};

export default SweaterModel;
