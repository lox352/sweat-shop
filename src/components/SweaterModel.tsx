import React, { lazy, Suspense, useEffect, useState } from "react";
import { Palette } from "../knitting/palette";
import { hasSettled, loadSettled } from "../data/sweaters/settled";
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

/**
 * "?settled=0" draws the sweater blocked, as it starts, rather than where it
 * came to rest, which is the only way to see what the settling is worth.
 */
const settledWanted = () =>
  typeof window === "undefined" ||
  new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("settled") !== "0";

/** Positions already fetched this visit, so moving between pages does not fetch them again. */
const known = new Map<string, Float32Array>();

/** The sweater in three dimensions, on the design's page and a project's. */
const SweaterModel: React.FC<SweaterModelProps> = (props) => {
  const { sweaterId, sizeId } = props;
  const key = `${sweaterId}--${sizeId}`;
  const wanted = settledWanted() && hasSettled(sweaterId, sizeId);
  const [settled, setSettled] = useState(() => known.get(key));
  /** The size whose file has been asked for and has answered, found or not. */
  const [looked, setLooked] = useState<string | undefined>(() => (known.has(key) ? key : undefined));
  useEffect(() => {
    let live = true;
    setSettled(known.get(key));
    if (!wanted || known.has(key)) {
      setLooked(key);
      return;
    }
    loadSettled(sweaterId, sizeId).then((positions) => {
      if (!live) return;
      if (positions) known.set(key, positions);
      setSettled(positions);
      setLooked(key);
    });
    return () => {
      live = false;
    };
  }, [key, wanted, sweaterId, sizeId]);
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // Nothing is drawn until a settled sweater has had its chance to arrive, so it is never seen jumping into its shape.
  const waiting = wanted && looked !== key;
  return (
    <div
      className="sweater-canvas"
      style={{ height: sweaterCanvasHeight }}
      role="img"
      aria-label="The sweater in three dimensions"
    >
      <PreviewBoundary>
        <Suspense fallback={<p role="status">Loading 3D preview…</p>}>
          {!waiting && <SweaterStage {...props} reducedMotion={reducedMotion} settled={settled} />}
        </Suspense>
      </PreviewBoundary>
    </div>
  );
};

export default SweaterModel;
