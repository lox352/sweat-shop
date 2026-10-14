import React, { lazy, Suspense } from "react";
import { Palette } from "../knitting/palette";
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
}

/** The sweater in three dimensions, on the design's page and a project's. */
const SweaterModel: React.FC<SweaterModelProps> = (props) => {
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <div
      className="sweater-canvas"
      style={{ height: sweaterCanvasHeight }}
      role="img"
      aria-label="The sweater in three dimensions"
    >
      <PreviewBoundary>
        <Suspense fallback={<p role="status">Loading 3D preview…</p>}>
          <SweaterStage {...props} reducedMotion={reducedMotion} />
        </Suspense>
      </PreviewBoundary>
    </div>
  );
};

export default SweaterModel;
